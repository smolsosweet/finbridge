import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { getSession } from "@/lib/auth-session";
import { getGeminiTimeoutMs } from "@/lib/gemini-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  mimeType: z.string().min(1).max(100),
  audioBase64: z.string().min(100).max(7_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
}).strict();

function isLocalDemoRequest(request: Request) {
  if (process.env.NODE_ENV !== "development" || process.env.FINBRIDGE_DEMO_MODE !== "true") return false;
  const host = request.headers.get("host")?.split(":")[0];
  const origin = request.headers.get("origin");
  if (host !== "localhost" && host !== "127.0.0.1") return false;
  try { return !!origin && new URL(origin).host === request.headers.get("host"); }
  catch { return false; }
}

export async function POST(request: Request) {
  if (!isLocalDemoRequest(request) && !(await getSession())) {
    return Response.json({ error: "UNAUTHENTICATED", message: "Hãy đăng nhập để dùng FinBridge AI." }, { status: 401 });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: "AI_NOT_CONFIGURED", message: "Chuyển giọng nói hiện chưa sẵn sàng. Vui lòng thử lại sau." }, { status: 503 });

  let raw: unknown;
  try { raw = await request.json(); }
  catch { return Response.json({ error: "INVALID_REQUEST", message: "Bản ghi âm không hợp lệ." }, { status: 400 }); }
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "INVALID_REQUEST", message: "Bản ghi âm không hợp lệ hoặc quá lớn." }, { status: 400 });

  const mimeType = parsed.data.mimeType.split(";")[0].trim().toLowerCase();
  if (!["audio/webm", "audio/mp4", "audio/ogg", "audio/wav", "audio/mpeg"].includes(mimeType)) {
    return Response.json({ error: "UNSUPPORTED_AUDIO", message: "Định dạng âm thanh này chưa được hỗ trợ." }, { status: 415 });
  }

  const startedAt = Date.now();
  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { retryOptions: { attempts: 1 } } });
    const result = await ai.models.generateContent({
      model: process.env.GEMINI_AUDIO_MODEL?.trim() || process.env.GEMINI_TRANSACTION_MODEL?.trim() || "gemini-3.1-flash-lite",
      contents: [{ parts: [
        { text: "Transcribe the spoken words exactly in the original language. Automatically identify the language, including Vietnamese and English. Preserve names and numbers as spoken. Return only the transcription, with no translation, explanation, or invented words." },
        { inlineData: { mimeType, data: parsed.data.audioBase64 } },
      ] }],
      config: { abortSignal: AbortSignal.any([AbortSignal.timeout(getGeminiTimeoutMs("GEMINI_AUDIO_TIMEOUT_MS", 18_000, 25_000)), request.signal]) },
    });
    const text = result.text?.trim();
    if (!text || text.length > 4000) {
      return Response.json({ error: "EMPTY_TRANSCRIPTION", message: "Chưa nhận diện được lời nói. Hãy thử nói lại." }, { status: 502 });
    }
    return Response.json({ text });
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : null;
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    console.error("[FinBridge AI] transcription failed", { durationMs: Date.now() - startedAt, status, name: error instanceof Error ? error.name : "UnknownError" });
    if (status === 429) return Response.json({ error: "AI_QUOTA_OR_RATE_LIMIT", message: "Hiện có quá nhiều yêu cầu. Hãy thử chuyển giọng nói lại sau ít phút." }, { status: 429 });
    if (status === 503) return Response.json({ error: "AI_BUSY", message: "Dịch vụ đang bận. Vui lòng thử lại sau." }, { status: 503 });
    if (status === 400 || status === 401 || status === 403) return Response.json({ error: "AI_CONFIGURATION_ERROR", message: "Chuyển giọng nói tạm thời không khả dụng. Vui lòng thử lại sau hoặc liên hệ hỗ trợ." }, { status: 502 });
    return Response.json({ error: timedOut ? "AI_TIMEOUT" : "TRANSCRIPTION_FAILED", message: timedOut ? "Chuyển giọng nói mất nhiều thời gian hơn dự kiến. Hãy thử lại." : "FinBridge chưa chuyển được giọng nói thành chữ. Vui lòng thử lại." }, { status: timedOut ? 504 : 502 });
  }
}
