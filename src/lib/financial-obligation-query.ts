import type { FinancialQuery, FinancialState } from "./financial-chat";
import { currencyScale, occurrencePayment, plannedOccurrences, validPlanningMoney } from "../components/sites/rolly/replica/planningModel";
import { trackedBalance, validOutlookDate } from "./financial-outlook";

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d").trim();

/** References, not prior computed balances. Revalidated against the current workspace on every query. */
export function financialConversationEntities(state: FinancialState, asOf?: string) {
  return (state.fixedExpenses || []).filter(expense => expense.active).slice(0, 30).map(expense => ({
    id: expense.id, title: expense.title, dueDate: expense.dueDate,
    ...(asOf && validOutlookDate(asOf) ? { nextDueDate: plannedOccurrences(expense, asOf, `${Number(asOf.slice(0, 4)) + 1}-12-31`).find(date => !occurrencePayment(state, expense.id, date)) || null } : {}),
    walletId: state.goals.find(goal => goal.kind === "budget" && goal.id === expense.budgetId)?.wallet || expense.walletId || null,
  }));
}

export function resolveObligationReference(message: string, query: FinancialQuery, state: FinancialState, history: Array<{ role: string; text: string }>): FinancialQuery {
  if (query.action !== "balance_after_obligation") return query;
  const text = normalize(message);
  const entities = financialConversationEntities(state);
  const named = entities.filter(entity => text.includes(normalize(entity.title)));
  const prior = [...history].reverse().find(item => item.role === "assistant" && item.text.startsWith("Previous financial result context"));
  const reference = /(?:khoan (?:do|nay)|tien (?:do|nay)|that (?:bill|payment)|this (?:bill|payment)|这笔|那笔)/.test(text);
  const priorTitle = reference ? prior?.text.match(/; bill=("(?:[^"\\]|\\.)*")\./)?.[1] : null;
  let title: string | null = null;
  if (priorTitle) { try { title = JSON.parse(priorTitle); } catch { /* Incomplete legacy context: ask instead. */ } }
  const referenced = !named.length && title ? entities.filter(entity => entity.title === title && (!query.walletId || entity.walletId === query.walletId)) : [];
  const target = named.length === 1 ? named[0] : referenced.length === 1 ? referenced[0] : null;
  if (!target) return query;
  return { ...query, searchTerm: target.title, walletId: query.walletId || target.walletId, scope: query.walletId || target.walletId ? "selected" : query.scope };
}

export function balanceAfterObligation(query: FinancialQuery, state: FinancialState, wallets: Array<{ id: string; name: string; currency: string; initial: number }>, today: string, lang: "en" | "vi" | "zh") {
  const t = (vi: string, en: string, zh: string) => lang === "vi" ? vi : lang === "zh" ? zh : en;
  const money = (value: number, currency: string) => new Intl.NumberFormat("en-US", { maximumFractionDigits: Math.round(Math.log10(currencyScale(currency))) }).format(value) + " " + currency;
  const term = normalize(query.searchTerm || "");
  if (!term) return t("Bạn muốn tính sau khi trả khoản nào? Cho Finn biết tên khoản chi nhé.", "Which bill should I deduct? Please tell Finn its name.", "你想计算支付哪笔费用后的余额？请告诉 Finn 费用名称。");
  const matches = (state.fixedExpenses || []).filter(expense => expense.active && normalize(expense.title).includes(term)).flatMap(expense => {
    const budget = state.goals.find(goal => goal.kind === "budget" && goal.id === expense.budgetId);
    const wallet = wallets.find(item => item.id === (budget?.wallet || expense.walletId));
    return wallet ? [{ expense, wallet, budget }] : [];
  });
  if (matches.length !== 1) return matches.length
    ? t("Có nhiều khoản trùng tên. Bạn muốn tính khoản nào, trong ví nào?", "Several bills match. Which bill and wallet do you mean?", "有多笔同名费用，请指定费用和钱包。")
    : t("Chưa tìm thấy khoản cố định này trong ví đang xét. Bạn cho biết tên khoản chi và ví nhé.", "I couldn't find that bill in the selected wallets. Please specify its name and wallet.", "所选钱包中未找到该固定费用，请提供名称和钱包。");
  const { expense, wallet, budget } = matches[0];
  const balance = trackedBalance(state, wallet.id, today);
  if (!balance.complete || !validPlanningMoney(expense.amount, wallet.currency) || (budget && budget.currency !== wallet.currency)) return t("Dữ liệu số dư hoặc tiền tệ chưa nhất quán; Finn chưa thể tính chính xác khoản này.", "The balance or currency data is inconsistent; Finn can't calculate this reliably yet.", "余额或币种数据不一致，Finn 暂时无法准确计算。");
  const start = query.periodStart || (expense.recurrence === "once" && expense.dueDate < today ? expense.dueDate : today);
  const endDate = new Date(start + "T12:00:00Z");
  endDate.setUTCFullYear(endDate.getUTCFullYear() + 1);
  const end = query.periodEnd || (Number.isFinite(endDate.getTime()) ? endDate.toISOString().slice(0, 10) : "");
  if (!validOutlookDate(start) || !validOutlookDate(end) || start > end) return t("Khoảng ngày chưa hợp lệ. Bạn muốn tính đến ngày nào?", "The date range is invalid. Which date do you mean?", "日期范围无效，你想计算到哪一天？");
  const due = plannedOccurrences(expense, start, end)[0];
  if (!due) return t("Không có lần đến hạn chưa trả của khoản này trong kỳ đã chọn. Finn không trừ lại khoản đã xác nhận thanh toán.", "There is no unpaid occurrence in this period. Finn won't deduct a confirmed payment again.", "所选期间没有该费用的未付账单，Finn 不会重复扣除已确认付款。");
  if (occurrencePayment(state, expense.id, due)) return t(
    `**${expense.title}** đến hạn ${due} đã được xác nhận thanh toán. Số dư hiện tại của **${wallet.name}** là **${money(balance.amount, wallet.currency)}**; Finn không trừ lần nữa.`,
    `**${expense.title}** due ${due} has a confirmed payment. **${wallet.name}** currently has **${money(balance.amount, wallet.currency)}**; Finn won't deduct it again.`,
    `到期日为 ${due} 的 **${expense.title}** 已确认支付。**${wallet.name}** 当前余额为 **${money(balance.amount, wallet.currency)}**，Finn 不会再次扣除。`);
  const scale = currencyScale(wallet.currency);
  const after = (Math.round(balance.amount * scale) - Math.round(expense.amount * scale)) / scale;
  return [
    t(`Nếu trả **${expense.title}**, ví **${wallet.name}** sẽ còn **${money(after, wallet.currency)}**.`, `After paying **${expense.title}**, **${wallet.name}** would have **${money(after, wallet.currency)}** left.`, `支付 **${expense.title}** 后，**${wallet.name}** 将剩余 **${money(after, wallet.currency)}**。`),
    `${money(balance.amount, wallet.currency)} − ${money(expense.amount, wallet.currency)} = **${money(after, wallet.currency)}**`,
    `${t("Đến hạn", "Due", "到期")}: ${due}`,
    t("Chỉ giả định trả khoản này từ số dư hiện tại; chưa tính thu chi khác. Chưa ghi nhận thanh toán.", "Assumes only this bill is paid from today's balance; excludes other income and expenses. No payment has been recorded.", "仅假设从当前余额支付此费用，不包含其他收支，未记录付款。"),
  ].join("\n\n");
}
