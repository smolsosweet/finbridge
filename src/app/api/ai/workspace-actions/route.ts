import { createHash } from "node:crypto";
import { ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { requireAiSession } from "@/lib/ai-access";
import { createQuotaGemini } from "@/lib/ai-quota-gemini";
import { aiQuotaErrorResponse } from "@/lib/ai-quota";
import { database } from "@/lib/database";
import { workspaceRepository } from "@/lib/workspace-repository";
import { workspaceSchema } from "@/lib/workspace-model";
import { getGeminiTimeoutMs } from "@/lib/gemini-config";
import type { AppState } from "@/components/sites/rolly/replica/store";
import { emptyWorkspaceAction, inspectWorkspaceProposal, isWorkspaceCreationRequest, resolveWorkspaceDateReply, workspaceActionCopy, workspaceActionSchema, workspaceProposalSchema } from "@/lib/workspace-actions";
import { resolveWorkspaceFieldReply } from "@/lib/workspace-action-replies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 35;
const fields = ["name", "currency", "walletType", "initialBalance", "creditLimit", "amount", "walletId", "budgetId", "category", "date", "cycle", "recurrence", "intervalMonths", "monthPosition", "reminderDays"] as const;
const patchSchema = workspaceActionSchema.omit({ id: true }).partial().extend({ kind: workspaceActionSchema.shape.kind, id: z.string().uuid().nullable().optional() }).strict();
const outputSchema = z.object({ mode: z.enum(["manage", "unrelated", "cancel"]), actions: z.array(patchSchema).max(6) }).strict();
const inputSchema = z.object({
  batchId: z.string().uuid(), message: z.string().trim().min(1).max(2000), language: z.enum(["vi", "en", "zh"]), today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pending: workspaceProposalSchema.nullable(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(1000) }).strict()).max(8),
  choice: z.object({ operationId: z.string().uuid(), field: z.enum(fields), value: z.union([z.string().max(100), z.number().finite()]) }).strict().optional(),
  context: z.object({ wallets: workspaceSchema.shape.wallets, goals: workspaceSchema.shape.goals, fixedExpenses: workspaceSchema.shape.fixedExpenses, categories: workspaceSchema.shape.categories, categoryMeta: workspaceSchema.shape.categoryMeta, walletCategories: workspaceSchema.shape.walletCategories }).strict().optional(),
}).strict();

function stableActionId(batch: string, index: number) {
  const hash = createHash("sha256").update(`${batch}:create:${index}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
export async function POST(request: Request) {
  const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  const session = await requireAiSession(request);
  if (session instanceof Response) return session;
  if (session && request.headers.get("x-finbridge-workspace-owner") !== session.user.id) return respond({ error: "ACCOUNT_CHANGED" }, 409);
  if (Number(request.headers.get("content-length") || 0) > 600_000) return respond({ error: "PAYLOAD_TOO_LARGE" }, 413);
  let raw: unknown;
  try { const body = await request.text(); if (body.length > 600_000) return respond({ error: "PAYLOAD_TOO_LARGE" }, 413); raw = JSON.parse(body); }
  catch { return respond({ error: "INVALID_REQUEST" }, 400); }
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return respond({ error: "INVALID_REQUEST" }, 400);
  const input = parsed.data, t = workspaceActionCopy[input.language];
  try {
    const state = session ? (await workspaceRepository(database()).read(session.user.id)).data
      : input.context ? { ...input.context, transactions: [], recurring: [], rules: [], settings: { language: input.language } } as AppState : null;
    if (!state) return respond({ error: "WORKSPACE_UNAVAILABLE", message: t.unavailable }, 503);
    const pending = input.pending && ["collecting", "review", "failed"].includes(input.pending.status) && !input.pending.applied ? input.pending : null;
    const currentInspection = pending ? inspectWorkspaceProposal(state, pending, input.language) : null;
    let actions = currentInspection?.proposal.actions.map(action => ({ ...action })) || [];
    const currentQuestion = currentInspection?.question || null;
    const currentAction = currentQuestion ? actions.find(action => action.id === currentQuestion.operationId) : null;
    const fieldReply = !input.choice && currentQuestion && currentAction ? resolveWorkspaceFieldReply(input.message, currentQuestion, currentAction) : null;
    const dateReply = !input.choice && currentQuestion?.field === "date" ? resolveWorkspaceDateReply(input.message, input.today) : null;
    if (input.choice) {
      if (!pending) return respond({ error: "STALE_CHOICE", message: t.invalid }, 409);
      const question = inspectWorkspaceProposal(state, pending, input.language).question;
      if (!question || question.operationId !== input.choice.operationId || question.field !== input.choice.field || !question.choices.some(choice => choice.value === input.choice!.value)) return respond({ error: "INVALID_CHOICE", message: t.invalid }, 409);
      actions = actions.map(action => action.id === input.choice!.operationId ? workspaceActionSchema.parse({ ...action, [input.choice!.field]: input.choice!.value }) : action);
    } else if (fieldReply) {
      if ("error" in fieldReply) {
        const message = fieldReply.error === "CURRENCY_MISMATCH"
          ? input.language === "vi" ? `Số tiền bạn nói là ${fieldReply.currency}, nhưng ví đã chọn dùng ${fieldReply.expectedCurrency}. Bạn muốn đổi ví hay nhập lại số tiền đúng tiền tệ của ví?`
            : input.language === "zh" ? `你输入的币种为 ${fieldReply.currency}，所选钱包使用 ${fieldReply.expectedCurrency}。请更换钱包或输入正确币种的金额。`
              : `You specified ${fieldReply.currency}, but the selected wallet uses ${fieldReply.expectedCurrency}. Change the wallet or enter an amount in its currency.`
          : input.language === "vi" ? `Giá trị ${t[currentQuestion!.field].toLowerCase()} chưa hợp lệ. Bạn nhập một số trong phạm vi cho phép; Finn vẫn giữ các thông tin đã có.`
            : input.language === "zh" ? `${t[currentQuestion!.field]}无效，请输入允许范围内的数值。其他信息已保留。`
              : `The ${t[currentQuestion!.field].toLowerCase()} is invalid. Enter a number within the allowed range; the other details are kept.`;
        return respond({ error: fieldReply.error, message }, 422);
      }
      actions = actions.map(action => action.id === currentQuestion!.operationId ? workspaceActionSchema.parse({ ...action, ...fieldReply.patch }) : action);
    } else if (dateReply) {
      if (dateReply.candidates) {
        const options = dateReply.candidates.join(input.language === "vi" ? " hay " : input.language === "zh" ? " 还是 " : " or ");
        return respond({ error: "AMBIGUOUS_DATE", message: input.language === "vi" ? `Bạn muốn ngày ${options}? Bạn nhắn lại theo dạng năm-tháng-ngày (YYYY-MM-DD) để Finn chọn đúng nhé.` : input.language === "zh" ? `你指的是 ${options}？请用 YYYY-MM-DD 格式回复。` : `Do you mean ${options}? Reply in YYYY-MM-DD format so Finn uses the right date.` }, 422);
      }
      if (!dateReply.date) return respond({ error: "INVALID_DATE", message: input.language === "vi" ? "Ngày này không tồn tại. Bạn nhập lại ngày/tháng/năm hoặc “ngày mai” nhé." : input.language === "zh" ? "该日期不存在，请重新输入日期或“明天”。" : "That date does not exist. Enter a valid date or “tomorrow”." }, 422);
      actions = actions.map(action => action.id === currentQuestion!.operationId ? { ...action, date: dateReply.date } : action);
    } else {
      const key = process.env.GEMINI_API_KEY;
      if (!key) return respond({ error: "AI_NOT_CONFIGURED", message: t.unavailable }, 503);
      const model = process.env.GEMINI_TRANSACTION_MODEL?.trim() || "gemini-3.1-flash-lite";
      const ai = createQuotaGemini(key, session.user.id, "workspace-actions");
      const result = await ai.models.generateContent({ model,
        contents: [
          "You are Finn's financial workspace creation planner. You ONLY propose new manually tracked wallets, budgets and fixed expense schedules. You NEVER save, transfer/pay money, delete data or claim an operation succeeded. Output JSON matching the schema.",
          "Use mode=manage for creation or answering/editing a pending creation. Use mode=unrelated for Q&A, recorded transactions, category commands, or hypothetical simulations. Use mode=cancel only when the user explicitly cancels the pending creation. Multiple requested objects may be proposed (max six).",
          "For each action use kind=wallet|budget|fixed_expense. Reuse the exact pending id when supplying updates; use id=null for a new object. Return only fields explicitly supplied in the newest message. Do not invent or zero-fill missing facts, names, amounts, categories, currencies or dates. Ask via null/omitted fields. Keep previously known values unless the user explicitly changes them. Interpret informal Vietnamese, English and Chinese, typos, relative dates and follow-ups using the current question.",
          "All date fields MUST be calendar dates in YYYY-MM-DD. Resolve relative dates from today, not the server clock. A reply to the currentQuestion updates that pending action; do not leave actions empty when the user supplies the requested value. 'ngày bắt đầu là ngày mai' and 'ngày đến hạn là ngày mai' both set date to tomorrow. Both 'ngày 20/10/2026' (day/month/year) and 'ngày 10/20/2026' (month/day/year) mean 2026-10-20. Numeric dates where both parts are <=12 and different are ambiguous: leave date null for clarification, never guess the order from language. If multiple dates or targets are ambiguous, do not guess.",
          "Wallet fields: name,currency,walletType(cash=regular manually tracked wallet,credit=credit wallet),initialBalance,creditLimit(for credit). Budget fields: name,amount,walletId,date(start),cycle(weekly/monthly/yearly),category(empty string ONLY if user asks for all categories). Fixed expense: name,amount,walletId,budgetId(empty string ONLY if explicitly standalone),category,date(first due),recurrence(once/weekly/monthly/yearly). A fixed schedule is not a paid transaction.",
          "Fixed expense optional fields when explicitly requested: intervalMonths=1..12 for monthly schedules (every 3 months => recurrence=monthly,intervalMonths=3), monthPosition=start|end|date, reminderDays=0..30. Match the first due date to the requested start/end of month. Unsupported frequencies such as every two weeks must leave recurrence null and ask for a supported schedule, not silently become weekly. Never invent a reminder interval.",
          "Resolve walletId/budgetId/category to actual existing names/IDs or pending creation IDs. NEVER choose a default wallet or category arbitrarily. For an explicitly chosen linked budget its wallet and specific category are derived by application logic. Currency for budgets/fixed expenses derives from the chosen wallet, but preserve any currency explicitly stated by the user so mismatches are detected. 25k=25000 VND, 1,5 triệu=1500000 VND, 100 tệ=100 CNY, 10 đô=10 USD. A plain numeric answer fills only the current requested numeric field. Explicit opening balance zero is valid. No dates are assumed unless user says today/this month or an actual date.",
          JSON.stringify({ today: input.today, language: input.language, wallets: state.wallets.filter(wallet => !wallet.archived).map(({ id, name, currency, type }) => ({ id, name, currency, type })), budgets: state.goals.filter(goal => goal.kind === "budget").map(({ id, title, wallet, currency, category, date }) => ({ id, name: title, wallet, currency, category, date })), categories: state.categories.filter(name => !state.categoryMeta[name]?.archived).map(name => ({ name, type: state.categoryMeta[name]?.type || "expense" })), pending: actions, currentQuestion, history: input.history, message: input.message }),
        ].join("\n"),
        config: { responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(outputSchema), temperature: 0.1, maxOutputTokens: 1600,
          ...(model.startsWith("gemini-3.") ? { thinkingConfig: { thinkingLevel: /flash-lite$/.test(model) ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW } } : {}),
          abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(getGeminiTimeoutMs("GEMINI_CHAT_TIMEOUT_MS", 20_000, 25_000))]) },
      });
      const decoded = outputSchema.safeParse(JSON.parse(result.text || "null"));
      if (!decoded.success) return respond({ error: "INVALID_AI_RESPONSE", message: t.unavailable }, 502);
      if (decoded.data.mode !== "manage") return respond({ mode: decoded.data.mode });
      for (const patch of decoded.data.actions) {
        const sameKind = actions.filter(action => action.kind === patch.kind);
        const implicitTarget = pending && !isWorkspaceCreationRequest(input.message)
          ? (currentQuestion ? sameKind.find(action => action.id === currentQuestion.operationId) : null) || (sameKind.length === 1 ? sameKind[0] : null) : null;
        if (!patch.id && pending && !isWorkspaceCreationRequest(input.message) && sameKind.length > 1 && !implicitTarget) return respond({ error: "AMBIGUOUS_ACTION_TARGET", message: t.invalid }, 409);
        const index = patch.id ? actions.findIndex(action => action.id === patch.id && action.kind === patch.kind)
          : implicitTarget ? actions.findIndex(action => action.id === implicitTarget.id) : -1;
        if (patch.id && index < 0) return respond({ error: "INVALID_ACTION_TARGET", message: t.invalid }, 409);
        const base = index >= 0 ? actions[index] : emptyWorkspaceAction(patch.kind, stableActionId(pending?.id || input.batchId, actions.length));
        const changes = Object.fromEntries(Object.entries(patch).filter(([field, value]) => field !== "id" && field !== "kind" && value !== null && value !== undefined));
        if (typeof changes.date === "string") {
          const resolved = resolveWorkspaceDateReply(changes.date, input.today);
          if (resolved?.date) changes.date = resolved.date;
        }
        const next = workspaceActionSchema.parse({ ...base, ...changes });
        if (index >= 0) actions[index] = next; else actions.push(next);
      }
      if (pending && JSON.stringify(actions) === JSON.stringify(currentInspection?.proposal.actions)) return respond({ error: "ACTION_REPLY_NOT_UNDERSTOOD", message: input.language === "vi" ? "Finn chưa ghép được câu trả lời này vào yêu cầu đang tạo. Thông tin và lời nhắn vẫn được giữ; bạn có thể nói rõ trường muốn bổ sung hoặc sửa nhé." : input.language === "zh" ? "Finn 暂时无法将此回复关联到正在创建的项目。信息和消息已保留，请说明要补充或修改的字段。" : "Finn couldn't apply this reply to the pending creation. Your details and message are kept; please specify the field to add or change." }, 422);
    }
    const proposal = workspaceProposalSchema.safeParse({ id: pending?.id || input.batchId, actions, status: "collecting" });
    if (!proposal.success) return respond({ error: "INVALID_AI_RESPONSE", message: t.unavailable }, 502);
    const inspection = inspectWorkspaceProposal(state, proposal.data, input.language);
    return respond({ mode: "manage", ...inspection, reply: inspection.question ? [inspection.error, inspection.question.text].filter(Boolean).join("\n") : inspection.error || t.ready });
  } catch (error) {
    const quotaResponse = aiQuotaErrorResponse(error, request);
    if (quotaResponse) return quotaResponse;
    const status = error && typeof error === "object" && "status" in error ? Number(error.status) : null;
    const timeout = error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name);
    console.error("[FinBridge AI] workspace creation unavailable", { status, name: error instanceof Error ? error.name : "UnknownError" });
    return respond({ error: timeout ? "AI_TIMEOUT" : status === 429 ? "AI_RATE_LIMIT" : "WORKSPACE_ACTION_UNAVAILABLE", message: t.unavailable }, timeout ? 504 : status === 429 ? 429 : 503);
  }
}
