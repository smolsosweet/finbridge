import type { ActionQuestion, WorkspaceAction } from "./workspace-actions";
import { parseTransactionAmounts } from "./transaction-drafts";

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase().replace(/\s+/g, " ").trim();
type FieldReply = { patch: Partial<WorkspaceAction> } | { error: "INVALID_NUMBER" | "CURRENCY_MISMATCH"; currency?: string; expectedCurrency?: string };
const currencies: Record<string, string> = { "$": "USD", usd: "USD", dollar: "USD", dollars: "USD", do: "USD", "do la": "USD", vnd: "VND", dong: "VND", d: "VND", "₫": "VND", cny: "CNY", rmb: "CNY", yuan: "CNY", te: "CNY", "元": "CNY", "人民币": "CNY", "美元": "USD", "€": "EUR", "£": "GBP" };
const multipliers: Record<string, number> = { k: 1000, nghin: 1000, ngan: 1000, thousand: 1000, trieu: 1e6, tr: 1e6, m: 1e6, million: 1e6, ty: 1e9, billion: 1e9, "千": 1000, "万": 1e4, "百万": 1e6 };

/** Bind an unambiguous short answer to the *current* question only. Longer,
 * multi-field requests remain with the structured model; never scan arbitrary
 * questions/transaction descriptions for an amount and treat it as a reply. */
export function resolveWorkspaceFieldReply(message: string, question: ActionQuestion, action: WorkspaceAction): FieldReply | null {
  const text = normalize(message).replace(/[!。！]+$/u, "").trim();
  const choiceText = text.replace(/^(?:toi |minh |i )?(?:chon|dung|su dung|choose|use|select|选择|使用)\s*(?:vi\s+|wallet\s+)?/u, "");
  const choices = question.choices.filter(choice => {
    const label = normalize(choice.label);
    return choiceText === label || choiceText === normalize(String(choice.value)) || (question.field === "walletId" && choiceText === label.split(" · ")[0]);
  });
  if (choices.length === 1) return { patch: { [question.field]: choices[0].value } };
  if (!["amount", "initialBalance", "creditLimit", "intervalMonths", "reminderDays"].includes(question.field)) return null;
  const numericText = text
    .replace(/^(?:(?:so tien|ngan sach|han muc|so du(?: ban dau)?|amount|budget|opening balance|credit limit|金额|预算|初始余额)\s*(?:la|is|:|：|是)?\s*)/u, "")
    .replace(/\s+(?:nhe|nha|a|please)$/u, "");
  const match = numericText.match(/^(\$|€|£|[a-z]{3}|人民币)?\s*([+-]?\d[\d.,]*)(?:\s*(k|nghin|ngan|trieu|tr|m|million|thousand|ty|billion|百万|万|千))?(?:\s*(\$|€|£|[a-z]{3}|dollars?|do la|do|dong|d|₫|rmb|yuan|te|元|美元|人民币))?$/u);
  if (!match) return null;
  const [, prefix, raw, unit, suffix] = match;
  const code = (value: string | undefined) => value ? currencies[value] || (Intl.supportedValuesOf("currency").includes(value.toUpperCase()) ? value.toUpperCase() : null) : null;
  const before = code(prefix), after = code(suffix);
  if ((prefix && !before) || (suffix && !after) || (before && after && before !== after)) return { error: "INVALID_NUMBER" };
  const inferred = unit && /^(?:k|nghin|ngan|trieu|tr|ty)$/.test(unit) ? "VND" : null;
  const currency = after || before || inferred;
  // Reuse the transaction parser's decimal/thousands normalization. The USD
  // marker is only a parsing adapter; it never becomes the action currency.
  const unsigned = raw.replace(/^[+-]/, "");
  const base = /^0+(?:[.,]0+)?$/.test(unsigned) ? 0 : parseTransactionAmounts(`${unsigned} USD`)[0]?.amount;
  if (base === undefined) return { error: "INVALID_NUMBER" };
  const amount = base * (multipliers[unit || ""] || 1) * (raw.startsWith("-") ? -1 : 1);
  if (["intervalMonths", "reminderDays"].includes(question.field)) {
    const minimum = question.field === "intervalMonths" ? 1 : 0;
    const maximum = question.field === "intervalMonths" ? 12 : 30;
    return !unit && !currency && Number.isInteger(amount) && amount >= minimum && amount <= maximum ? { patch: { [question.field]: amount } } : { error: "INVALID_NUMBER" };
  }
  if (!Number.isFinite(amount) || Math.abs(amount) > 1e12 || (question.field !== "initialBalance" && amount <= 0)) return { error: "INVALID_NUMBER" };
  if (currency && action.currency && currency !== action.currency) return { error: "CURRENCY_MISMATCH", currency, expectedCurrency: action.currency };
  const effectiveCurrency = currency || action.currency;
  if (effectiveCurrency) {
    const digits = new Intl.NumberFormat("en", { style: "currency", currency: effectiveCurrency }).resolvedOptions().maximumFractionDigits ?? 2;
    if (Math.abs(amount * 10 ** digits - Math.round(amount * 10 ** digits)) > 1e-5) return { error: "INVALID_NUMBER" };
  }
  return { patch: { [question.field]: amount, ...(currency ? { currency } : {}) } };
}
