import type { AppState, ChatMessage } from "../components/finbridge/workspace/store";
import type { TransactionDraft } from "./transaction-drafts";
import { formatTransactionMoney, parseTransactionAmounts } from "./transaction-drafts";
import { isClearlyNewTransaction, isDraftCorrection, isHypotheticalMessage } from "./conversation-intent";

export function shouldBlockNewDraft(message: string, pending: TransactionDraft[], modelIntent?: string) {
  const chineseEntry = /买|花了|支付|收入/.test(message) && /\d+(?:[.,]\d+)?\s*(?:元|块|人民币|美元)/.test(message)
    && !/[?？]|吗|多少|为什么/.test(message) && !isDraftCorrection(message) && !isHypotheticalMessage(message);
  return pending.length > 0 && (isClearlyNewTransaction(message) || chineseEntry || modelIntent === "transaction");
}
export function pendingDraftReminder(language: "vi" | "en" | "zh", count: number) {
  return { vi: `Bạn còn ${count} bản nháp chưa hoàn tất. Hãy xác nhận hoặc hủy bản nháp bên dưới trước khi gửi giao dịch tiếp theo; giao dịch mới chưa được tạo.`, en: `You have ${count} unfinished draft(s). Confirm or cancel them below before adding another transaction; no new draft has been created.`, zh: `你还有 ${count} 笔未完成草稿。请先确认或取消，再添加下一笔；尚未创建新交易。` }[language];
}

/** An entry while another draft is pending can be a correction or a new
 * purchase. Explain the parsed amount and let the user choose the edit target;
 * do not silently overwrite the old draft or discard the new currency. */
export function pendingDraftInterruption(message: string, pending: TransactionDraft[], language: "vi" | "en" | "zh"): ChatMessage {
  const amounts = parseTransactionAmounts(message);
  const recognized = amounts.length ? amounts.map(amount => amount.currency ? formatTransactionMoney(amount.amount, amount.currency) : String(amount.amount)).join("; ") : null;
  const text = {
    vi: `${recognized ? `Finn hiểu số tiền bạn vừa nói là **${recognized}**. ` : ""}Bạn muốn **sửa bản nháp đang chờ** hay **thêm giao dịch khác**? Nếu sửa, chọn bản nháp bên dưới. Nếu thêm mới, hãy xác nhận hoặc hủy bản nháp cũ trước. Chưa có giao dịch nào được lưu.`,
    en: `${recognized ? `Finn reads the amount as **${recognized}**. ` : ""}Do you want to **edit the pending draft** or **add another transaction**? To edit, select the draft below. To add another, confirm or cancel the old draft first. No transaction has been saved.`,
    zh: `${recognized ? `Finn 识别的金额是 **${recognized}**。` : ""}你想**修改待确认草稿**还是**添加另一笔交易**？修改请选择下方草稿；新增请先确认或取消旧草稿。尚未保存交易。`,
  }[language];
  return { role: "assistant", text, draftIds: pending.map(draft => draft.id), draftTargetChoices: pending.map(draft => draft.id), pendingFollowup: { vi: "Sửa bản nháp này: ", en: "Update this draft: ", zh: "修改这笔草稿：" }[language] + message };
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
