import type { AppState, Transaction, Wallet } from "../components/sites/rolly/replica/store";
import { trackedBalance, validOutlookDate } from "./financial-outlook";
import { currencyScale } from "../components/sites/rolly/replica/planningModel";
import { formatScenarioMoney, type ScenarioLanguage } from "./scenario-format";

export interface FundingState {
  wallets: Array<Pick<Wallet, "id" | "currency"> & Partial<Wallet>>;
  transactions: Array<Pick<Transaction, "id"> & Partial<Transaction>>;
  settings?: Record<string, string | boolean>;
}
interface FundingDraft { id: string; type: string | null; amount: number | null; wallet: string | null; currency: string | null; }
export interface FundingIssue { kind: "INSUFFICIENT_FUNDS" | "BALANCE_UNAVAILABLE"; currency: string; available: number | null; shortfall: number | null; credit: boolean; }

export function fundingDate(state: FundingState, now = new Date()) {
  let timeZone = String(state.settings?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  try { new Intl.DateTimeFormat("en", { timeZone }); } catch { timeZone = "UTC"; }
  const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return ["year", "month", "day"].map(key => parts.find(part => part.type === key)!.value).join("-");
}

/** Recorded balance only. A credit limit is not money recorded in the wallet. */
export function availableTransactionFunds(state: FundingState, walletId: string, asOf = fundingDate(state)): number | null {
  const wallet = state.wallets.find(item => item.id === walletId && !item.archived);
  if (!wallet || !Number.isFinite(wallet.initial) || !validOutlookDate(asOf)) return null;
  if (state.transactions.some(t => !t.wallet || !t.type || !t.date || typeof t.amount !== "number")) return null;
  try {
    const scale = currencyScale(wallet.currency);
    const balance = trackedBalance(state as Pick<AppState, "wallets" | "transactions">, walletId, asOf);
    if (!balance.complete) return null;
    const units = Math.round(balance.amount * scale);
    return Number.isSafeInteger(units) ? units / scale : null;
  } catch { return null; }
}

/** Reserve funds cumulatively for the whole confirmation batch; pending income
 * is not money already recorded. Stable IDs already saved are never charged twice.
 */
export function draftFundingIssues(drafts: FundingDraft[], state: FundingState, asOf = fundingDate(state)) {
  const remaining = new Map<string, number | null>(), seen = new Set(state.transactions.map(t => t.id));
  const issues: Array<{ id: string; issue: FundingIssue }> = [];
  for (const draft of drafts) {
    if (seen.has(draft.id)) continue;
    seen.add(draft.id);
    if (draft.type !== "expense" || !draft.wallet || !draft.currency || draft.amount === null || !Number.isFinite(draft.amount) || draft.amount <= 0) continue;
    const wallet = state.wallets.find(w => w.id === draft.wallet && !w.archived && w.currency === draft.currency);
    if (!wallet) continue; // Required wallet/currency validation handles this separately.
    if (!remaining.has(wallet.id)) remaining.set(wallet.id, availableTransactionFunds(state, wallet.id, asOf));
    const available = remaining.get(wallet.id)!;
    const credit = wallet.type === "credit";
    if (available === null) { issues.push({ id: draft.id, issue: { kind: "BALANCE_UNAVAILABLE", currency: wallet.currency, available: null, shortfall: null, credit } }); continue; }
    const scale = currencyScale(wallet.currency), amount = Math.round(draft.amount * scale), funds = Math.round(available * scale);
    if (amount > funds) issues.push({ id: draft.id, issue: { kind: "INSUFFICIENT_FUNDS", currency: wallet.currency, available, shortfall: (amount - funds) / scale, credit } });
    remaining.set(wallet.id, Math.max(0, funds - amount) / scale);
  }
  return issues;
}

export function fundingIssueMessage(issue: FundingIssue, language: ScenarioLanguage) {
  if (issue.kind === "BALANCE_UNAVAILABLE") return {
    vi: "Chưa xác định được số dư của ví. Hãy kiểm tra số dư và giao dịch chuyển ví trước khi xác nhận.",
    en: "The wallet balance cannot be verified. Check the balance and wallet transfers before confirming.",
    zh: "无法核实钱包余额，请先检查余额和钱包转账再确认。",
  }[language];
  const available = formatScenarioMoney(issue.available!, issue.currency, language), shortfall = formatScenarioMoney(issue.shortfall!, issue.currency, language);
  return {
    vi: `Chưa thể lưu: ví hiện có ${available}, còn thiếu ${shortfall}. Hãy sửa số tiền hoặc chọn ví đủ tiền. Nếu cần ghi nhận khoản thu thực tế, hãy hủy bản nháp này trước.`,
    en: `Cannot save: ${available} available; ${shortfall} short. Edit the amount or choose a funded wallet. To record an actual income first, cancel this draft.`,
    zh: `暂不能保存：可用金额 ${available}，还差 ${shortfall}。请修改金额或选择余额充足的钱包。若要先记录实际收入，请先取消此草稿。`,
  }[language];
}

/** Check new expenses against the revision locked by workspaceRepository.save.
 * Existing historical deficits and explicit initial history imports are preserved.
 */
export function validateNewExpenseFunding(previous: AppState | null, next: AppState) {
  if (!previous) return;
  const oldIds = new Set(previous.transactions.map(t => t.id));
  const added = next.transactions.filter(t => t.type === "expense" && !oldIds.has(t.id));
  const newIds = new Set(added.map(t => t.id));
  const base = { ...next, transactions: next.transactions.filter(t => !newIds.has(t.id)) };
  const drafts = added.map(t => ({ ...t, currency: next.wallets.find(w => w.id === t.wallet)?.currency || null }));
  const issue = draftFundingIssues(drafts, base)[0];
  if (issue) throw new Error(issue.issue.kind);
}
