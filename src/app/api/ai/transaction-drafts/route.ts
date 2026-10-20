import { traceAiRequest, type AiRequestTiming } from "@/lib/ai-request-timing";
import { readAiJson } from "@/lib/ai-request";
import { AI_JSON_BYTES } from "@/lib/ai-limits";
import { z } from "zod";
import { requireAiSession } from "@/lib/ai-access";
import { createQuotaGemini } from "@/lib/ai-quota-gemini";
import { aiQuotaErrorResponse } from "@/lib/ai-quota";
import { getGeminiTimeoutMs } from "@/lib/gemini-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 40;

const requestSchema = z.object({
  batchId: z.string().uuid(),
  message: z.string().trim().min(1).max(2000),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeZone: z.string().min(1).max(80),
  defaultWalletId: z.string().min(1).max(100),
  clarificationDraft: z.object({
    id: z.string().min(1).max(200), title: z.string().min(1).max(160),
    amount: z.number().positive().nullable(), type: z.enum(["expense", "income"]).nullable(),
    category: z.string().nullable(), date: z.string().nullable(), wallet: z.string().nullable(),
    currency: z.string().nullable(), needsReview: z.array(z.enum(["amount", "type", "category", "date", "wallet"])),
  }).strict().optional(),
  wallets: z.array(z.object({ id: z.string().min(1).max(100), name: z.string().min(1).max(100), currency: z.string().min(3).max(8) }).strict()).min(1).max(30),
  categories: z.array(z.object({ name: z.string().min(1).max(100), type: z.enum(["expense", "income"]) }).strict()).max(100),
}).strict().superRefine((value, context) => {
  if (!value.wallets.some((wallet) => wallet.id === value.defaultWalletId)) {
    context.addIssue({ code: "custom", path: ["defaultWalletId"], message: "Wallet not found." });
  }
  if (new Set(value.wallets.map((wallet) => wallet.id)).size !== value.wallets.length) {
    context.addIssue({ code: "custom", path: ["wallets"], message: "Wallet IDs must be unique." });
  }
  if (new Set(value.categories.map((category) => `${category.type}:${category.name}`)).size !== value.categories.length) {
    context.addIssue({ code: "custom", path: ["categories"], message: "Categories must be unique." });
  }
});

const responseSchema = z.object({
  drafts: z.array(z.object({
    title: z.string().trim().min(1).max(160),
    amount: z.number().finite().positive().max(1_000_000_000_000).nullable(),
    type: z.enum(["expense", "income"]).nullable(),
    category: z.string().trim().min(1).max(100).nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    walletId: z.string().min(1).max(100).nullable(),
    needsReview: z.array(z.enum(["amount", "type", "category", "date", "wallet"])).max(5),
  }).strict()).min(1).max(20),
}).strict();


function validDate(value: string | null): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export async function POST(request: Request) {
  return traceAiRequest("transaction-drafts", timing => handleRequest(request, timing));
}

async function handleRequest(request: Request, timing: AiRequestTiming) {
  const session = await timing.measure("auth", () => requireAiSession(request));
  if (session instanceof Response) return session;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: "AI_NOT_CONFIGURED", message: "Phân tích giao dịch hiện chưa sẵn sàng. Vui lòng thử lại sau." }, { status: 503 });

  const body = await readAiJson(request, AI_JSON_BYTES);
  if (body instanceof Response) return body;
  const raw = body.value;
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "INVALID_REQUEST", message: "Thông tin ví hoặc danh mục không hợp lệ." }, { status: 400 });
  const input = parsed.data;
  const categories = new Map(input.categories.map((category) => [`${category.type}:${category.name}`, true]));

  try {
    const ai = createQuotaGemini(apiKey, session.user.id, "transaction-drafts");
    const result = await timing.measure("model", () => ai.models.generateContent({
      model: process.env.GEMINI_TRANSACTION_MODEL?.trim() || "gemini-3.5-flash-lite",
      contents: [
        "Chuyển tin nhắn tiếng Việt thành các bản nháp giao dịch. KHÔNG lưu và KHÔNG khẳng định giao dịch đã được ghi nhận.",
        `Ngày hiện tại theo múi giờ ${input.timeZone}: ${input.today}. Nếu người dùng không nói ngày và ngữ cảnh là giao dịch thường ngày, dùng ngày hôm nay. Chuyển ngày tương đối sang YYYY-MM-DD. Nếu người dùng nói mơ hồ như "mấy hôm trước" hoặc nêu khoảng ngày không xác định, date=null và thêm date vào needsReview.`,
        `Ví hợp lệ: ${JSON.stringify(input.wallets)}. Ví mặc định người dùng đang chọn: ${input.defaultWalletId}. Chỉ dùng ID ví được cung cấp; dùng ví mặc định nếu không nêu ví và tiền tệ phù hợp. Nếu tin nhắn nói tiền tệ không có ví tương ứng hoặc ví không rõ, walletId=null và đánh dấu wallet.`,
        `Danh mục hợp lệ theo loại: ${JSON.stringify(input.categories)}. Chỉ dùng đúng tên danh mục hợp lệ phù hợp với loại. Không dùng danh mục chung "Chưa được phân loại" thay cho một danh mục phù hợp. Nếu không tìm thấy danh mục khớp hoặc không chắc, category=null và thêm category vào needsReview; cần hỏi người dùng hoặc để họ tạo danh mục.`,
        "amount phải là số dương theo đơn vị tiền của ví (ví dụ 35k=35000, 8 triệu=8000000); tuyệt đối không đoán số tiền bị thiếu. type chỉ expense hoặc income. Nếu mơ hồ, dùng null và đánh dấu review.",
        "Tạo một draft cho từng giao dịch được nêu rõ. Không biến khoản chuyển ví thành thu/chi; nếu không biểu diễn được bằng expense/income thì không tạo draft cho khoản đó. Không bịa mô tả, ngày, danh mục hay thông tin tài chính.",
        ...(input.clarificationDraft ? [
          `Đây là câu trả lời làm rõ cho một bản nháp đang chờ, không phải giao dịch mới. Bản nháp hiện tại: ${JSON.stringify(input.clarificationDraft)}. Cập nhật các trường đang thiếu hoặc được người dùng sửa dựa trên câu trả lời; giữ nguyên mọi trường đã có và hợp lệ. Trả đúng một draft đã cập nhật. Nếu câu trả lời vẫn chưa đủ rõ, giữ trường đó null và thêm vào needsReview.`,
        ] : []),
        `Tin nhắn: ${input.message}`,
      ].join("\n"),
      config: { maxOutputTokens: 4096, responseMimeType: "application/json", responseSchema, abortSignal: AbortSignal.any([AbortSignal.timeout(getGeminiTimeoutMs("GEMINI_CHAT_TIMEOUT_MS", 20_000, 25_000)), request.signal]) },
    }));
    const decoded: unknown = JSON.parse(result.text || "");
    const output = responseSchema.safeParse(decoded);
    if (!output.success) return Response.json({ error: "INVALID_AI_RESPONSE", message: "AI trả về dữ liệu chưa hợp lệ. Hãy thử diễn đạt lại." }, { status: 502 });

    const drafts = output.data.drafts.map((draft, index) => {
      const needsReview = new Set(draft.needsReview);
      const wallet = draft.walletId ? input.wallets.find((candidate) => candidate.id === draft.walletId) : undefined;
      const selectedWallet = wallet || (draft.walletId === null && !needsReview.has("wallet") ? input.wallets.find((candidate) => candidate.id === input.defaultWalletId) : undefined);
      if (!selectedWallet) needsReview.add("wallet");
      if (draft.walletId && !wallet) needsReview.add("wallet");
      const genericCategory = draft.category?.trim().toLocaleLowerCase("vi") === "chưa được phân loại";
      if (genericCategory || (draft.category && draft.type && !categories.has(`${draft.type}:${draft.category}`))) needsReview.add("category");
      if (!draft.category || !draft.type || (draft.category && draft.type && !categories.has(`${draft.type}:${draft.category}`))) needsReview.add("category");
      if (!draft.amount || draft.amount <= 0) needsReview.add("amount");
      if (!draft.type) needsReview.add("type");
      const resolvedDate = validDate(draft.date) ? draft.date : (needsReview.has("date") ? null : input.today);
      if (!validDate(resolvedDate)) needsReview.add("date");
      return {
        id: `${input.batchId}:${index}`,
        title: draft.title,
        amount: draft.amount,
        type: draft.type,
        category: draft.category && !genericCategory && draft.type && categories.has(`${draft.type}:${draft.category}`) ? draft.category : null,
        date: resolvedDate,
        wallet: selectedWallet?.id || null,
        currency: selectedWallet?.currency || null,
        needsReview: [...needsReview],
      };
    });
    return Response.json({ batchId: input.batchId, drafts });
  } catch (error) {
    const quotaResponse = aiQuotaErrorResponse(error, request);
    if (quotaResponse) return quotaResponse;
    return Response.json({ error: "AI_REQUEST_FAILED", message: "Không thể phân tích giao dịch lúc này. Vui lòng thử lại." }, { status: 502 });
  }
}
