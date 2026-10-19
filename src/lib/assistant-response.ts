import { z } from "zod";
import { normalizePlannerResponse, type PlannerInput } from "./scenario-planner";

const nullableText = z.string().max(160).nullable();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
/** Interpretation only. No calculated balances or free-form financial conclusions. */
export const assistantScenarioSchema = z.object({
  name: z.string().trim().min(1).max(160),
  walletId: nullableText,
  horizonEnd: date,
  estimateSpending: z.boolean(),
  reserveAmount: z.number().finite().min(0).max(1e12).nullable().optional(),
  reserveCurrency: z.string().regex(/^[A-Z]{3}$/).nullable().optional(),
  actions: z.array(z.object({
    kind: z.enum(["change", "daily_limit", "spending_reduction"]),
    title: nullableText, amount: z.number().finite().min(0).max(1e12).nullable(),
    direction: z.enum(["income", "expense"]).nullable(),
    percent: z.number().finite().min(1).max(100).nullable(),
    walletId: nullableText, currency: z.string().max(8).nullable(), category: nullableText,
    date, startDate: date, endDate: date,
  }).strict()).max(10),
}).strict();
export type AssistantScenario = z.infer<typeof assistantScenarioSchema>;
export const answerPresentationSchema = z.object({
  detail: z.enum(["brief", "standard", "detailed"]),
  layout: z.enum(["conversation", "list", "comparison"]),
  lead: z.string().max(220).nullable().optional(),
}).strict();
export type AnswerPresentation = z.infer<typeof answerPresentationSchema>;

/** Model wording may introduce the question, but may not supply a financial
 * verdict, amount, date or promise. Those belong to the verified answer slot. */
export function conversationalLead(lead: string | null | undefined, answer: string) {
  if (!lead || lead.split("{{answer}}").length !== 2) return answer;
  const literal = lead.replace("{{answer}}", "");
  const normalized = literal.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d");
  if (/\b(?:trieu|nghin|dong|du|thieu|am|chac|da|guaranteed|certain|certainly|surely|affordable|duoc luu)\b|so du|dam bao|vuot ngan sach|dang tinh|cho doi|tiet kiem/i.test(normalized)) return answer;
  if (literal.length > 140 || /[\d\n{}<>]|\b(?:VND|USD|CNY|EUR|RMB|triệu|nghìn|đồng|dollars?|yuan|đủ|dư|thiếu|âm|giàu|chắc|đảm bảo|đã|enough|afford|safe|guarantee|saved|paid|balance|profit|shortfall|remaining)\b|(?:số dư|vượt ngân sách|đang tính|chờ|đợi|万|元|余额|足够|保证|已经|等待)/iu.test(literal)) return answer;
  const value = lead.startsWith("{{answer}}") ? answer : answer.charAt(0).toLocaleLowerCase() + answer.slice(1);
  return lead.replace("{{answer}}", value).trim();
}

export function resolveAssistantScenario(spec: AssistantScenario, input: PlannerInput) {
  // RMB is another name for CNY, not an exchange or a different wallet currency.
  const isoCurrency = (value: string | null | undefined) => value ? value.toUpperCase() === "RMB" ? "CNY" : value.toUpperCase() : null;
  spec = { ...spec, reserveCurrency: isoCurrency(spec.reserveCurrency), actions: spec.actions.map(action => ({ ...action, currency: isoCurrency(action.currency) })) };
  const language = input.preferredLanguage || "en";
  const ask = (vi: string, en: string, zh: string) => ({ vi, en, zh })[language];
  const fail = (clarification: string) => ({ intent: "clarification" as const, reply: "", clarification, query: null, scenarios: [], pendingScenario: spec });
  const validDate = (key: string | null) => !key || (Number.isFinite(Date.parse(key + "T12:00:00Z")) && new Date(key + "T12:00:00Z").toISOString().slice(0, 10) === key);
  if (!validDate(spec.horizonEnd) || (spec.horizonEnd && spec.horizonEnd < input.today)) return fail(ask("Bạn muốn dự báo đến ngày nào từ hôm nay?", "Through which date from today should I forecast?", "你想从今天预测到哪一天？"));
  const currencies = [...new Set([...spec.actions.flatMap(a => a.currency ? [a.currency.toUpperCase()] : []), ...(spec.reserveCurrency ? [spec.reserveCurrency] : [])])];
  const matching = currencies.length === 1 ? input.context.wallets.filter(w => w.currency.toUpperCase() === currencies[0]) : [];
  const selected = input.context.wallets.find(w => w.id === input.selectedWalletId);
  const walletId = spec.walletId || (currencies.length === 1 ? selected?.currency.toUpperCase() === currencies[0] ? selected.id : matching.length === 1 ? matching[0].id : null : input.selectedWalletId) || (input.context.wallets.length === 1 ? input.context.wallets[0].id : null);
  if (!walletId || !input.context.wallets.some(w => w.id === walletId)) return fail(ask("Bạn muốn tính cho ví nào?", "Which wallet should I use?", "要使用哪个钱包？"));
  const wallet = input.context.wallets.find(w => w.id === walletId)!;
  if (spec.reserveAmount != null) {
    if (spec.reserveCurrency && spec.reserveCurrency !== wallet.currency) return fail(ask("Bạn muốn giữ tiền dự phòng ở ví nào cùng tiền tệ?", "Which matching-currency wallet should hold the reserve?", "要在哪个同币种钱包中预留资金？"));
    const scale = 10 ** (new Intl.NumberFormat("en", { style: "currency", currency: wallet.currency }).resolvedOptions().maximumFractionDigits ?? 2);
    if (Math.abs(spec.reserveAmount * scale - Math.round(spec.reserveAmount * scale)) > 1e-5) return fail(ask("Bạn nhập lại tiền dự phòng đúng đơn vị tiền tệ của ví nhé.", "Please enter a reserve with valid precision for the wallet currency.", "请按钱包币种的有效精度输入备用金。"));
  }
  for (const action of spec.actions) {
    const wallet = input.context.wallets.find(w => w.id === (action.walletId || walletId));
    if (!wallet || (action.currency && action.currency.toUpperCase() !== wallet.currency.toUpperCase())) return fail(ask("Tiền tệ của khoản giả định khác với ví. Bạn muốn dùng ví nào?", "The hypothetical currency differs from the wallet. Which wallet should I use?", "假设金额的币种与钱包不同，要使用哪个钱包？"));
    if (action.amount !== null) {
      const scale = 10 ** (new Intl.NumberFormat("en", { style: "currency", currency: wallet.currency }).resolvedOptions().maximumFractionDigits ?? 2);
      if (Math.abs(action.amount * scale - Math.round(action.amount * scale)) > 1e-5) return fail(ask("Số tiền chưa đúng đơn vị nhỏ nhất của tiền tệ trong ví. Bạn nhập lại nhé.", "Please enter an amount with valid precision for this wallet's currency.", "请按钱包币种的有效精度输入金额。"));
    }
    if (![action.date, action.startDate, action.endDate].every(validDate) || (action.date && action.date < input.today) || (action.startDate && action.startDate < input.today) || (action.startDate && action.endDate && action.endDate < action.startDate) || (spec.horizonEnd && [action.date, action.startDate, action.endDate].some(key => key && key > spec.horizonEnd!))) return fail(ask("Bạn cho Finn biết lại ngày áp dụng và ngày kết thúc kịch bản nhé.", "Please clarify the scenario dates and forecast end date.", "请明确情景日期和预测结束日期。"));
    if (action.kind === "spending_reduction" && !action.category) return fail(ask("Bạn muốn giảm chi ở danh mục nào?", "Which category would you like to reduce?", "你想减少哪个类别的支出？"));
    if (action.kind === "spending_reduction" && action.percent === null) return fail(ask("Bạn muốn giảm bao nhiêu phần trăm?", "What percentage would you like to reduce?", "你想减少百分之几？"));
    if (action.kind !== "spending_reduction" && (action.amount === null || action.kind === "change" && action.amount <= 0)) return fail(ask("Khoản này bao nhiêu tiền?", "What is the amount for this item?", "这笔金额是多少？"));
    if (action.kind === "change" && !action.direction) return fail(ask("Đây là khoản bạn sẽ nhận hay sẽ chi?", "Is this money you will receive or spend?", "这是预计收入还是支出？"));
  }
  const normalized = normalizePlannerResponse({ intent: "scenario", scenarios: [{ ...spec, actions: spec.actions.map(a => ({ ...a, walletId: a.walletId || walletId })), assumptions: [] }] }, { ...input, selectedWalletId: walletId });
  const walletIds = [...new Set([walletId, ...spec.actions.flatMap(a => a.walletId ? [a.walletId] : [])])];
  return { ...normalized, pendingScenario: normalized.intent === "clarification" ? spec : undefined, scenarios: normalized.scenarios.map(s => ({ ...s, walletIds, ...(spec.reserveAmount != null ? { reserves: { [walletId]: spec.reserveAmount } } : {}) })) };
}

/** A synchronous request cannot promise a later calculation after it has ended. */
export function isDeferredAssistantReply(reply: string) {
  return /(?:đang|sẽ|để (?:tôi|mình|Finn)).{0,100}(?:tính toán|kiểm tra|hoàn tất|tính lại)|(?:vui lòng|hãy|bạn).{0,20}(?:đợi|chờ)|kết quả sẽ|(?:i(?:'m| am| will)|please).{0,40}(?:calculat|check|wait)|正在.{0,20}(?:计算|检查)|请稍等/i.test(reply);
}
