import { readAiJson } from "@/lib/ai-request";
import { AI_JSON_BYTES } from "@/lib/ai-limits";
import { ThinkingLevel, Type } from "@google/genai";
import { z } from "zod";
import { requireAiSession } from "@/lib/ai-access";
import { createQuotaGemini } from "@/lib/ai-quota-gemini";
import { aiQuotaErrorResponse } from "@/lib/ai-quota";
import { getGeminiTimeoutMs } from "@/lib/gemini-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 40;

const inputSchema = z.object({
  language: z.enum(["vi", "en", "zh"]),
  alerts: z.array(z.object({
    id: z.string().min(1).max(200), kind: z.enum(["budget-exceeded", "budget-risk", "cash-shortfall", "fixed-due", "negative-balance"]),
    problem: z.string().min(1).max(240), figures: z.string().min(1).max(400), when: z.string().min(1).max(80),
    cause: z.string().min(1).max(400), priority: z.enum(["high", "medium", "low"]),
    suggestedAction: z.string().min(1).max(300), assumptions: z.string().min(1).max(300),
  }).strict()).min(1).max(30),
}).strict();
const outputSchema = z.object({ alerts: z.array(z.object({ id: z.string().min(1).max(200), explanation: z.string().trim().min(1).max(300), suggestion: z.string().trim().min(1).max(300) }).strict()).max(30) }).strict();

export async function POST(request: Request) {
  const session = await requireAiSession(request);
  if (session instanceof Response) return session;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: "AI_NOT_CONFIGURED" }, { status: 503 });
  const body = await readAiJson(request, AI_JSON_BYTES);
  if (body instanceof Response) return body;
  const raw = body.value;
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success || new Set(parsed.data.alerts.map((alert) => alert.id)).size !== parsed.data.alerts.length) return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const { language, alerts } = parsed.data;
  const allowedIds = new Set(alerts.map((alert) => alert.id));
  const model = process.env.GEMINI_TRANSACTION_MODEL?.trim() || "gemini-3.5-flash-lite";
  const timeoutMs = getGeminiTimeoutMs("GEMINI_FEED_TIMEOUT_MS", 6_000, 9_000);
  const startedAt = Date.now();
  try {
    const ai = createQuotaGemini(apiKey, session.user.id, "proactive-feed");
    const result = await ai.models.generateContent({
      model,
      contents: [
        `Write in ${language === "vi" ? "Vietnamese" : language === "zh" ? "Chinese" : "English"}. For each deterministic financial alert, write one concise explanation and one practical suggestion. Use only the supplied cause, figures and assumptions. Do not change the facts or priority, add amounts/dates/numbers, claim payment happened, or imply certainty for forecasts. Return every alert exactly once using its id.`,
        JSON.stringify(alerts),
      ].join("\n"),
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.OBJECT, properties: { alerts: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
          id: { type: Type.STRING }, explanation: { type: Type.STRING }, suggestion: { type: Type.STRING },
        }, required: ["id", "explanation", "suggestion"] } } }, required: ["alerts"] },
        temperature: 0.2, maxOutputTokens: 1200,
        ...(model.startsWith("gemini-3.") ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } } : {}),
        abortSignal: AbortSignal.any([AbortSignal.timeout(timeoutMs), request.signal]),
      },
    });
    let decoded: unknown;
    try { decoded = JSON.parse(result.text || ""); }
    catch { return Response.json({ error: "INVALID_AI_RESPONSE" }, { status: 502 }); }
    const validated = outputSchema.safeParse(decoded);
    if (!validated.success || validated.data.alerts.length !== alerts.length) return Response.json({ error: "INVALID_AI_RESPONSE" }, { status: 502 });
    const seen = new Set<string>();
    for (const item of validated.data.alerts) {
      if (!allowedIds.has(item.id) || seen.has(item.id) || /[\d$€£¥₫]/.test(`${item.explanation} ${item.suggestion}`)) return Response.json({ error: "UNSAFE_AI_RESPONSE" }, { status: 502 });
      seen.add(item.id);
    }
    console.info("[FinBridge AI] proactive feed explanations completed", { durationMs: Date.now() - startedAt, count: seen.size });
    return Response.json({ alerts: validated.data.alerts });
  } catch (error) {
    const quotaResponse = aiQuotaErrorResponse(error, request);
    if (quotaResponse) return quotaResponse;
    const status = error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : null;
    console.warn("[FinBridge AI] proactive feed explanations unavailable", { durationMs: Date.now() - startedAt, status, name: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: status === 429 ? "AI_RATE_LIMITED" : "AI_UNAVAILABLE" }, { status: status === 429 ? 429 : 503 });
  }
}
