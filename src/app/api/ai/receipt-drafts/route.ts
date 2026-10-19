import { readAiJson } from "@/lib/ai-request";
import { AI_RECEIPT_JSON_BYTES } from "@/lib/ai-limits";
import { AI_IMAGE_DATA_URL_LENGTH } from "@/lib/ai-limits";
import { ThinkingLevel, Type } from "@google/genai";
import { z } from "zod";
import { requireAiSession } from "@/lib/ai-access";
import { createQuotaGemini } from "@/lib/ai-quota-gemini";
import { aiQuotaErrorResponse } from "@/lib/ai-quota";
import { getGeminiTimeoutMs } from "@/lib/gemini-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  imageDataUrl: z.string().max(AI_IMAGE_DATA_URL_LENGTH),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeZone: z.string().min(1).max(80),
  defaultWalletId: z.string().min(1).max(100),
  wallets: z.array(z.object({ id: z.string().min(1).max(100), name: z.string().min(1).max(100), currency: z.string().min(3).max(8) }).strict()).min(1).max(30),
  categories: z.array(z.object({ name: z.string().min(1).max(100), type: z.enum(["expense", "income"]) }).strict()).max(100),
}).strict().superRefine((value, context) => {
  if (!value.wallets.some((wallet) => wallet.id === value.defaultWalletId)) {
    context.addIssue({ code: "custom", path: ["defaultWalletId"], message: "Wallet not found." });
  }
  if (new Set(value.wallets.map((wallet) => wallet.id)).size !== value.wallets.length) {
    context.addIssue({ code: "custom", path: ["wallets"], message: "Wallet IDs must be unique." });
  }
});

const resultSchema = z.object({
  title: z.string().trim().min(1).max(160),
  amount: z.number().finite().positive().max(1_000_000_000_000).nullable(),
  type: z.enum(["expense", "income"]).nullable(),
  category: z.string().trim().min(1).max(100).nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  walletId: z.string().min(1).max(100).nullable(),
  needsReview: z.array(z.enum(["amount", "type", "category", "date", "wallet"])).max(5),
}).strict();

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING }, amount: { type: Type.NUMBER, nullable: true },
    type: { type: Type.STRING, nullable: true, enum: ["expense", "income"] },
    category: { type: Type.STRING, nullable: true }, date: { type: Type.STRING, nullable: true },
    walletId: { type: Type.STRING, nullable: true },
    needsReview: { type: Type.ARRAY, items: { type: Type.STRING, enum: ["amount", "type", "category", "date", "wallet"] } },
  },
  required: ["title", "amount", "type", "category", "date", "walletId", "needsReview"],
};

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export async function POST(request: Request) {
  const session = await requireAiSession(request);
  if (session instanceof Response) return session;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: "AI_NOT_CONFIGURED", message: "Đọc hóa đơn hiện chưa sẵn sàng. Vui lòng thử lại sau." }, { status: 503 });

  const body = await readAiJson(request, AI_RECEIPT_JSON_BYTES);
  if (body instanceof Response) return body;
  const raw = body.value;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "INVALID_REQUEST", message: "Ảnh hoặc thông tin ví không hợp lệ." }, { status: 400 });
  const input = parsed.data;
  const imageMatch = input.imageDataUrl.match(/^data:(image\/(?:jpeg|png|webp|heic|heif));base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!imageMatch) {
    return Response.json({ error: "INVALID_IMAGE", message: "Định dạng ảnh chưa hỗ trợ hoặc ảnh quá lớn. Hãy chọn JPEG, PNG hoặc WebP dưới 5 MB." }, { status: 400 });
  }

  const model = process.env.GEMINI_TRANSACTION_MODEL?.trim() || "gemini-3.1-flash-lite";
  const timeoutMs = getGeminiTimeoutMs("GEMINI_OCR_TIMEOUT_MS", 50_000, 50_000);
  const startedAt = Date.now();
  try {
    const ai = createQuotaGemini(apiKey, session.user.id, "receipt-drafts");
    const result = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [
        { text: [
          "Đọc hóa đơn/biên lai trong ảnh và trích xuất đúng MỘT bản nháp giao dịch chi tiêu; không lưu và không khẳng định đã ghi nhận.",
          `Ngày hiện tại theo múi giờ ${input.timeZone}: ${input.today}. Chỉ dùng ngày in rõ trên hóa đơn, chuyển thành YYYY-MM-DD. Nếu không đọc rõ hoặc không có ngày thì date=null và thêm date vào needsReview; không dùng ngày hiện tại thay cho ngày hóa đơn.`,
          `Ví hợp lệ: ${JSON.stringify(input.wallets)}. Ví đang chọn: ${input.defaultWalletId}. Dùng đúng ví mặc định và đơn vị tiền của ví. Nếu hóa đơn dùng tiền tệ khác hoặc không xác định được tiền tệ, walletId=null và thêm wallet vào needsReview.`,
          `Danh mục có sẵn: ${JSON.stringify(input.categories)}. Chọn danh mục phù hợp nhất chỉ khi chắc chắn. Nếu không khớp danh mục có sẵn, category=null và thêm category vào needsReview.`,
          "Amount là tổng tiền thực trả cuối cùng, bỏ qua tạm tính/tiền thối/thuế riêng nếu đã có tổng thanh toán; không đoán chữ số bị mờ. Nếu không đọc chắc số tiền, amount=null và thêm amount vào needsReview.",
          "Title là tên cửa hàng hoặc mặt hàng ngắn gọn, dựa trên phần đọc được. Hóa đơn mua hàng/dịch vụ thông thường là expense. Nếu không thể xác định đây là giao dịch thu hay chi thì type=null và cần review. Không suy đoán thông tin bị che, mờ hoặc không có trên ảnh.",
          "Trả một JSON object đúng schema đã cung cấp.",
        ].join("\n") },
        { inlineData: { mimeType: imageMatch[1].toLowerCase(), data: imageMatch[2] } },
      ] }],
      config: { responseMimeType: "application/json", responseSchema, temperature: 0.1, maxOutputTokens: 1024,
        ...(model.startsWith("gemini-3.") ? { thinkingConfig: { thinkingLevel: /flash-lite$/.test(model) ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW } } : {}),
        abortSignal: AbortSignal.any([AbortSignal.timeout(timeoutMs), request.signal]) },
    });
    let decoded: unknown;
    try { decoded = JSON.parse(result.text || ""); }
    catch { return Response.json({ error: "INVALID_AI_RESPONSE", message: "Không đọc được thông tin hóa đơn. Hãy chụp ảnh rõ hơn hoặc nhập giao dịch bằng chat." }, { status: 502 }); }
    const output = resultSchema.safeParse(decoded);
    if (!output.success) return Response.json({ error: "INVALID_AI_RESPONSE", message: "Thông tin đọc từ hóa đơn chưa hợp lệ. Hãy thử ảnh rõ hơn." }, { status: 502 });
    const draft = output.data;
    const needsReview = new Set(draft.needsReview);
    const wallet = draft.walletId ? input.wallets.find((candidate) => candidate.id === draft.walletId) : undefined;
    if (!wallet) needsReview.add("wallet");
    if (draft.walletId && !wallet) needsReview.add("wallet");
    const categoryExists = !!draft.type && !!draft.category && input.categories.some((category) => category.type === draft.type && category.name === draft.category);
    if (!categoryExists) needsReview.add("category");
    if (!draft.amount) needsReview.add("amount");
    if (!draft.type) needsReview.add("type");
    if (!validDate(draft.date)) needsReview.add("date");
    return Response.json({ draft: {
      id: crypto.randomUUID(), title: draft.title, amount: draft.amount, type: draft.type,
      category: categoryExists ? draft.category : null, date: validDate(draft.date) ? draft.date : null,
      wallet: wallet?.id || null, currency: wallet?.currency || null, needsReview: [...needsReview],
    } });
  } catch (error) {
    const quotaResponse = aiQuotaErrorResponse(error, request);
    if (quotaResponse) return quotaResponse;
    const status = error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : null;
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    console.error("[FinBridge AI] receipt failed", { durationMs: Date.now() - startedAt, status, name: error instanceof Error ? error.name : "UnknownError" });
    if (status === 429) return Response.json({ error: "AI_QUOTA_OR_RATE_LIMIT", message: "Hiện có quá nhiều yêu cầu. Hãy thử đọc hóa đơn lại sau ít phút." }, { status: 429 });
    if (status === 503) return Response.json({ error: "AI_BUSY", message: "Dịch vụ đang bận. Vui lòng thử lại sau." }, { status: 503 });
    if (status === 400 || status === 401 || status === 403) return Response.json({ error: "AI_CONFIGURATION_ERROR", message: "Đọc hóa đơn tạm thời không khả dụng. Vui lòng thử lại sau hoặc liên hệ hỗ trợ." }, { status: 502 });
    return Response.json({ error: timedOut ? "AI_TIMEOUT" : "AI_REQUEST_FAILED", message: timedOut ? "Đọc hóa đơn mất nhiều thời gian hơn dự kiến. Hãy thử ảnh nhỏ, rõ hơn hoặc gửi lại sau." : "Không thể đọc hóa đơn lúc này. Vui lòng thử lại." }, { status: timedOut ? 504 : 502 });
  }
}
