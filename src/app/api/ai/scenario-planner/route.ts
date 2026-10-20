import { FINN_VOICE_POLICY, finnChatCopy } from "@/lib/finn-voice";
import { traceAiRequest, type AiRequestTiming } from "@/lib/ai-request-timing";
import { readAiJson } from "@/lib/ai-request";
import { AI_JSON_BYTES } from "@/lib/ai-limits";
import { ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { requireAiSession } from "@/lib/ai-access";
import { createQuotaGemini } from "@/lib/ai-quota-gemini";
import { aiQuotaErrorResponse } from "@/lib/ai-quota";
import { database } from "@/lib/database";
import { workspaceRepository } from "@/lib/workspace-repository";
import type { AppState } from "@/components/finbridge/workspace/store";
import { getGeminiTimeoutMs } from "@/lib/gemini-config";
import {
  cleanJsonText,
  normalizePlannerResponse,
  parseVietnameseFinancialExpressions,
  calculateScenario,
  scenarioContext,
} from "@/lib/scenario-planner";

export const runtime = "nodejs";
export const maxDuration = 40;

const requestSchema = z.object({
  message: z.string().trim().min(1).max(1200),
  preferredLanguage: z.enum(["vi", "en", "zh"]).default("vi"),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeZone: z.string().min(1).max(80),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(1200) }).strict()).max(6),
  selectedWalletId: z.string().max(100).nullable().optional(),
  context: z.object({
    wallets: z.array(z.object({ id: z.string().max(100), name: z.string().max(100), currency: z.string().max(8) }).strict()).max(30),
    budgets: z.array(z.object({ id: z.string().max(100), title: z.string().max(100), currency: z.string().max(8), category: z.string().max(100), wallet: z.string().max(100) }).strict()).max(50),
    fixedExpenses: z.array(z.object({ id: z.string().max(100), budgetId: z.string().max(100), title: z.string().max(100), category: z.string().max(100), dueDate: z.string().max(10), recurrence: z.enum(["once", "weekly", "monthly", "yearly"]), walletId: z.string().max(100).nullable() }).strict()).max(60),
    goals: z.array(z.object({ id: z.string().max(100), title: z.string().max(100), kind: z.string().max(40), date: z.string().max(10), currency: z.string().max(8), wallet: z.string().max(100) }).strict()).max(30),
    categories: z.array(z.string().max(100)).max(80),
  }).strict(),
}).strict();

export async function POST(request: Request) {
  return traceAiRequest("scenario-planner", timing => handleRequest(request, timing));
}

async function handleRequest(request: Request, timing: AiRequestTiming) {
  const session = await timing.measure("auth", () => requireAiSession(request));
  if (session instanceof Response) return session;

  const body = await readAiJson(request, AI_JSON_BYTES);
  if (body instanceof Response) return body;
  const raw = body.value;

  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_REQUEST", message: "Scenario context did not pass validation." }, { status: 400 });
  }
  const input = parsed.data;
  let workspace: AppState | null = null;
  if (session) {
    const ownerHeader = request.headers.get("x-finbridge-workspace-owner");
    if (ownerHeader && ownerHeader !== session.user.id) return Response.json({ error: "ACCOUNT_CHANGED", message: "Please reload the page after changing accounts." }, { status: 409 });
    try {
      workspace = (await timing.measure("workspace", () => { const repository = workspaceRepository(database(), timing); return repository.readForAnalysis ? repository.readForAnalysis(session.user.id) : repository.read(session.user.id); })).data;
      if (!workspace) throw new Error("WORKSPACE_UNAVAILABLE");
      input.context = scenarioContext(workspace);
    } catch { return Response.json({ error: "FINANCIAL_DATA_UNAVAILABLE", message: "Chưa đọc được dữ liệu tài chính. Hãy tải lại trang rồi thử lại." }, { status: 503 }); }
  }
  const respondPlan = (plan: ReturnType<typeof normalizePlannerResponse>) => Response.json({
    ...plan,
    ...(workspace ? { calculations: plan.scenarios.map(scenario => timing.measureSync("calculation", () => calculateScenario(workspace!, scenario, input.today))) } : {}),
  });

  const preParsed = parseVietnameseFinancialExpressions(input.message, input.today, input.context);
  const walletIds = new Set(input.context.wallets.map((wallet) => wallet.id));
  const selectedWalletId = input.selectedWalletId && walletIds.has(input.selectedWalletId) ? input.selectedWalletId : null;
  const selectedWallet = input.context.wallets.find((wallet) => wallet.id === selectedWalletId);
  const preferredWallet = selectedWallet || (input.context.wallets.length === 1 ? input.context.wallets[0] : undefined);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // If Gemini is not configured, fall back to deterministic parsing when possible
    const fallback = timing.measureSync("calculation", () => normalizePlannerResponse(null, input));
    if (fallback.scenarios.length || fallback.query || fallback.intent === "clarification") {
      return respondPlan(fallback);
    }
    return Response.json({ error: "AI_NOT_CONFIGURED", message: finnChatCopy[input.preferredLanguage].configuration }, { status: 503 });
  }

  const model = process.env.GEMINI_TRANSACTION_MODEL?.trim() || "gemini-3.5-flash-lite";
  const timeoutMs = getGeminiTimeoutMs("GEMINI_SCENARIO_TIMEOUT_MS", 20_000, 30_000);
  const started = Date.now();

  try {
    const ai = createQuotaGemini(apiKey, session.user.id, "scenario-planner");
    const modelContext = {
      wallets: input.context.wallets.map(({ id, name, currency }) => ({ id, name, currency })),
      budgets: input.context.budgets.map(({ id, title, currency, category, wallet }) => ({ id, title, currency, category, wallet })),
      fixedExpenses: input.context.fixedExpenses.map(({ id, title, category, dueDate, recurrence, walletId }) => ({ id, title, category, dueDate, recurrence, walletId: walletId || null })),
      goals: input.context.goals.map(({ id, title, kind, date, currency, wallet }) => ({ id, title, kind, date, currency, wallet })),
      categories: input.context.categories,
    };

    const promptInstructions = [
          FINN_VOICE_POLICY,
      `You are FinBridge Financial Assistant, an intelligent personal finance planner.`,
      `Interpret questions in natural Vietnamese, English, or Chinese, including informal expressions, typos, and follow-ups.`,
      `Respond in the user's language (fallback: ${input.preferredLanguage}).`,
      `Never calculate or invent financial numbers; all calculations are executed deterministically by FinBridge.`,
      ``,
      `Supported intents:`,
      `1. "financial_query": The user is asking about saved financial data (balance, spending, categories, transactions, budgets, fixed bills, goals, anomalies, trends).`,
      `   - For compound questions (e.g. "Tháng này tôi tiêu nhiều nhất vào khoản nào? Có gì bất thường không?"), set "action" to the primary action and "actions" to the list of sub-actions (e.g. ["top_category", "anomalies"]).`,
      `2. "scenario": The user is asking a hypothetical what-if question, daily spending limit simulation, one-off expense/income simulation, category spending reduction, or end-of-period forecast.`,
      `   - For follow-up modifications (e.g. "đổi thành 200k/ngày", "đổi thành 200k", "còn nếu 200k thì sao", "đổi học phí thành 4 triệu"), preserve the wallet, currency, and horizonEnd from "Recent conversation" and update the modified parameter.`,
      `3. "general_advice": The user is asking for general financial guidance, budgeting principles (e.g., 50/30/20 rule, emergency fund, saving strategies, debt management), or financial concepts.`,
      `4. "clarification": Essential information (e.g. which wallet to use when multiple distinct wallets exist with different balances) is missing and cannot be safely inferred.`,
      `5. "unsupported": Completely unrelated to personal finance or life planning.`,
      ``,
      `Entities & Conventions:`,
      `- Vietnamese amounts: "300k" / "300 ngàn" = 300,000 VND; "1 củ" / "1 chai" / "1 tr" = 1,000,000 VND; "5 lít" = 500,000 VND; "1 tỏi" = 1,000,000,000 VND.`,
      `- Relative dates: "tháng này" = current month (periodStart = 1st of month, periodEnd = last day of month); "tháng trước" = previous month; "tuần này" = current week; "cuối tháng" = end of current month; "ngày mai" = tomorrow.`,
      `- Daily spending limit ("mỗi ngày tiêu 300k", "ngày dùng 200k"): action kind="daily_limit", amount=300000, startDate=tomorrow, endDate=end of month.`,
      `- Pre-extracted hints from user message: ${JSON.stringify(preParsed)}.`,
      ``,
      `Today: ${input.today} (${input.timeZone}). Candidate wallets/categories: ${JSON.stringify(modelContext)}. Prior wallet: ${JSON.stringify(preferredWallet ? { id: preferredWallet.id, name: preferredWallet.name, currency: preferredWallet.currency } : null)}.`,
      `Recent conversation: ${JSON.stringify(input.history)}.`,
      `User message: ${input.message}`,
      ``,
      `Return a single valid JSON object:`,
      `{`,
      `  "intent": "financial_query" | "scenario" | "general_advice" | "clarification" | "unsupported",`,
      `  "reply": "Clear, concise direct answer or explanation in user's language",`,
      `  "clarification": "Concise follow-up question if essential info is missing, else null",`,
      `  "query": { "action": "...", "actions": ["..."], "walletId": "...", "scope": "selected"|"all", "periodStart": "YYYY-MM-DD", "periodEnd": "YYYY-MM-DD", "category": "...", "searchTerm": "...", "transactionType": "expense"|"income"|null } or null,`,
      `  "scenarios": [`,
      `    {`,
      `      "name": "Concise scenario title",`,
      `      "actions": [`,
      `        { "kind": "daily_limit"|"change"|"spending_reduction", "title": "...", "amount": number, "direction": "expense"|"income"|null, "percent": number|null, "walletId": "...", "currency": "...", "category": "...", "date": "YYYY-MM-DD"|null, "startDate": "YYYY-MM-DD"|null, "endDate": "YYYY-MM-DD"|null }`,
      `      ],`,
      `      "horizonEnd": "YYYY-MM-DD",`,
      `      "estimateSpending": boolean,`,
      `      "assumptions": ["..."]`,
      `    }`,
      `  ]`,
      `}`,
    ].join("\n");

    const result = await timing.measure("model", () => ai.models.generateContent({
      model,
      contents: promptInstructions,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 800,
        ...(model.startsWith("gemini-3.") ? { thinkingConfig: { thinkingLevel: /flash-lite$/.test(model) ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW } } : {}),
        abortSignal: AbortSignal.any([AbortSignal.timeout(timeoutMs), request.signal]),
      },
    }));

    let decoded: unknown = null;
    try {
      const cleaned = cleanJsonText(result.text || "");
      decoded = JSON.parse(cleaned);
    } catch {
      // If model returned slightly malformed JSON, normalizePlannerResponse will heal via pre-parsed expressions
      decoded = null;
    }

    const normalized = timing.measureSync("calculation", () => normalizePlannerResponse(decoded, input));
    return respondPlan(normalized);
  } catch (error) {
    const quotaResponse = aiQuotaErrorResponse(error, request);
    if (quotaResponse) return quotaResponse;
    const status = providerStatus(error);
    const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error(`[FinBridge AI] scenario planner failed ${JSON.stringify({ durationMs: Date.now() - started, status, name: errorName, code: providerCode(error) })}`);

    // Resilient fallback: If Gemini fails, check if request can be deterministically calculated
    const fallback = timing.measureSync("calculation", () => normalizePlannerResponse(null, input));
    if (fallback.scenarios.length || fallback.query || fallback.intent === "clarification") {
      return respondPlan(fallback);
    }

    const errorCopy = finnChatCopy[input.preferredLanguage];
    if (status === 429) {
      return Response.json({
        error: "AI_RATE_LIMIT",
        message: errorCopy.rateLimit,
      }, { status: 429 });
    }
    if (status === 401 || status === 403) {
      return Response.json({
        error: "AI_AUTHENTICATION_ERROR",
        message: errorCopy.configuration,
      }, { status: 502 });
    }
    if (timeout) {
      return Response.json({
        error: "AI_TIMEOUT",
        message: errorCopy.timeout,
      }, { status: 504 });
    }
    if (isNetworkError(error)) {
      return Response.json({
        error: "AI_NETWORK_ERROR",
        message: errorCopy.unavailable,
      }, { status: 502 });
    }

    return Response.json({
      error: "AI_REQUEST_FAILED",
      message: errorCopy.unavailable,
    }, { status: 502 });
  }
}

function providerStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { status?: unknown; response?: { status?: unknown }; cause?: { status?: unknown; response?: { status?: unknown } } };
  for (const value of [candidate.status, candidate.response?.status, candidate.cause?.status, candidate.cause?.response?.status]) {
    if (typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599) return value;
  }
  return null;
}

function providerCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { code?: unknown; cause?: { code?: unknown } };
  const value = typeof candidate.code === "string" ? candidate.code : candidate.cause?.code;
  return typeof value === "string" && /^[A-Z0-9_]{1,60}$/i.test(value) ? value : null;
}

function isNetworkError(error: unknown): boolean {
  const code = providerCode(error);
  return error instanceof TypeError || ["ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT"].includes(code || "");
}
