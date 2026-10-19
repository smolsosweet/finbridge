import type { AppState, Wallet } from "../components/sites/rolly/replica/store";
import { isClearlyNewTransaction } from "./conversation-intent";
import { createTimeoutTransactionDraft, normalizeVietnameseMessage, unavailableWalletReply, validateDraftForState, type TransactionDraft } from "./transaction-drafts";
import { resolveExplicitWallet, resolveUniqueCurrencyWallet } from "./transaction-currency";
import { pendingDraftReminder } from "./pending-draft-policy";

type Language = "vi" | "en" | "zh";
type RecoveryState = Pick<AppState, "categories" | "categoryMeta" | "goals" | "fixedExpenses"> & { wallets: Array<Pick<Wallet, "id" | "name" | "currency"> & { archived?: boolean }> };

/** Whole-message salutations/identity only. Never consumes a financial request. */
export function assistantSmallTalk(message: string, language: Language): string | null {
  const text = normalizeVietnameseMessage(message).replace(/[!.,?？。！👋]/gu, " ").replace(/\s+/g, " ").trim();
  if (/^(?:(?:xin )?chao|hello|hi|hey|你好|您好)(?:\s*(?:finn|ban|bạn))?$|^finn\s+oi$/i.test(text)) return {
    vi: "Chào bạn! Mình là Finn. Bạn muốn ghi thu chi, xem kế hoạch hay quản lý ví và ngân sách?",
    en: "Hi! I'm Finn. Would you like to record spending, review a plan, or manage wallets and budgets?",
    zh: "你好！我是 Finn。你想记录收支、查看计划，还是管理钱包和预算？",
  }[language];
  if (/^(?:ban ten (?:la )?gi|ban la ai|finn la ai|what(?:'s| is) your name|who are you|你叫什么名字|你是谁)$/i.test(text)) return {
    vi: "Mình là Finn, trợ lý tài chính của bạn trong FinBridge.",
    en: "I'm Finn, your financial assistant in FinBridge.",
    zh: "我是 Finn，你在 FinBridge 的财务助手。",
  }[language];
  return null;
}

/** Recovery is draft-only and deliberately conservative. Normal contextual
 * interpretation stays with the model; a failure cannot authorize a write. */
export function recoverTransactionDraft(input: { message: string; batchId: string; today: string; selectedWalletId: string | null; pendingDrafts?: TransactionDraft[]; pendingScenario?: unknown; language: Language }, state: RecoveryState) {
  if (input.pendingScenario || !isClearlyNewTransaction(input.message, state)) return null;
  const normalized = normalizeVietnameseMessage(input.message);
  if (/(?:^|\s)đừng(?:\s|$)/iu.test(input.message) || /^(?:dung|stop)\b/.test(normalized) || /\b(?:khong|chua|neu|gia su|doi|chuyen|gui|not|never|tomorrow|next|ngay mai|tuan sau|thang toi|hang thang|moi ngay|hang ngay|daily|every|tra gop|co dat|nen mua)\b|没|不|明天|下个月/.test(normalized)) return null;
  const active = state.wallets.filter(w => !w.archived);
  const currencyMatch = resolveUniqueCurrencyWallet(input.message, active);
  if (currencyMatch.ambiguous && !currencyMatch.currency) return null;
  const draftState = { ...state, wallets: active, transactions: [] };
  const fallback = createTimeoutTransactionDraft(input.message, input.batchId, input.today, draftState);
  if (!fallback || !fallback.type) return null;
  if (input.pendingDrafts?.length) return { intent: "transaction", operationIntent: "create_transaction", drafts: [], reply: pendingDraftReminder(input.language, input.pendingDrafts.length) };
  const namedId = resolveExplicitWallet(input.message, active);
  const named = active.find(w => w.id === namedId);
  const selected = active.find(w => w.id === input.selectedWalletId);
  const required = fallback.currency || currencyMatch.currency;
  const matching = required ? active.filter(w => w.currency.toUpperCase() === required) : active;
  if (!matching.length) return { intent: "general", operationIntent: "unsupported_or_ambiguous_request", drafts: [], reply: unavailableWalletReply([required], input.language) };
  const wallet = named ? (!required || named.currency.toUpperCase() === required ? named : undefined)
    : selected && (!required || selected.currency.toUpperCase() === required) ? selected : matching.length === 1 ? matching[0] : undefined;
  const draft = validateDraftForState({ ...fallback, id: `${input.batchId}:0`, wallet: wallet?.id || null, currency: required || wallet?.currency || null }, draftState);
  return { intent: "transaction", operationIntent: "create_transaction", interpretationSource: "local-recovery", drafts: [draft], reply: {
    vi: "Finn đã đọc được khoản này và tạo bản nháp. Bạn kiểm tra thông tin rồi xác nhận trước khi lưu nhé.",
    en: "Finn could read this entry and prepared a draft. Review the details and confirm before saving.",
    zh: "Finn 已识别这笔收支并准备好草稿，请核对信息后确认保存。",
  }[input.language] };
}
