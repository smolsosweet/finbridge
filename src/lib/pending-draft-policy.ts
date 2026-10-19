import type { AppState } from "../components/sites/rolly/replica/store";
import type { TransactionDraft } from "./transaction-drafts";
import { isClearlyNewTransaction, isDraftCorrection, isHypotheticalMessage } from "./conversation-intent";

export function shouldBlockNewDraft(message: string, pending: TransactionDraft[], modelIntent?: string) {
  const chineseEntry = /买|花了|支付|收入/.test(message) && /\d+(?:[.,]\d+)?\s*(?:元|块|人民币|美元)/.test(message)
    && !/[?？]|吗|多少|为什么/.test(message) && !isDraftCorrection(message) && !isHypotheticalMessage(message);
  return pending.length > 0 && (isClearlyNewTransaction(message) || chineseEntry || modelIntent === "transaction");
}
export function pendingDraftReminder(language: "vi" | "en" | "zh", count: number) {
  return { vi: `Bạn còn ${count} bản nháp chưa hoàn tất. Hãy xác nhận hoặc hủy bản nháp bên dưới trước khi gửi giao dịch tiếp theo; giao dịch mới chưa được tạo.`, en: `You have ${count} unfinished draft(s). Confirm or cancel them below before adding another transaction; no new draft has been created.`, zh: `你还有 ${count} 笔未完成草稿。请先确认或取消，再添加下一笔；尚未创建新交易。` }[language];
}
/** A definite rejection did not reach durable storage. Roll back only the
 * optimistic records from that attempt, preserving unrelated edits. */
export function rollbackRejectedDrafts(current: AppState, before: AppState, ids: string[]): AppState {
  const remove = new Set(ids.filter(id => !before.transactions.some(t => t.id === id)));
  const attemptCategories = new Set(current.transactions.filter(t => remove.has(t.id)).map(t => t.category));
  const transactions = current.transactions.filter(t => !remove.has(t.id));
  const unusedNewCategories = new Set(current.categories.filter(name => attemptCategories.has(name) && !before.categories.includes(name) && !transactions.some(t => t.category === name) && !current.goals.some(g => g.category === name) && !(current.fixedExpenses || []).some(e => e.category === name)));
  return { ...current, transactions, categories: current.categories.filter(name => !unusedNewCategories.has(name)), categoryMeta: Object.fromEntries(Object.entries(current.categoryMeta).filter(([name]) => !unusedNewCategories.has(name))), ...(current.walletCategories ? { walletCategories: Object.fromEntries(Object.entries(current.walletCategories).map(([id, names]) => [id, names.filter(name => !unusedNewCategories.has(name))])) } : {}) };
}
