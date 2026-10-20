import type { AppState } from "../components/finbridge/workspace/store";
import type { TransactionDraft } from "./transaction-drafts";
import { currencyScale } from "../components/finbridge/workspace/planningModel";
import { validOutlookDate } from "./financial-outlook";
import { availableTransactionFunds } from "./transaction-funding";

export interface DraftAmountWarning {
  kind: "unusually_high" | "unusually_low" | "exceeds_balance";
  currency: string;
  referenceAmount: number;
  category: string | null;
}

/** Review hints only: never correct an amount, change validation, or persist data.
 * Category comparisons use the selected wallet's own prior 90 days, not price
 * assumptions or exchange rates. A small sample cannot establish a norm.
 */
export function draftAmountWarnings(
  draft: TransactionDraft,
  state: Pick<AppState, "wallets" | "transactions">,
  asOf: string,
): DraftAmountWarning[] {
  const wallet = state.wallets.find(item => item.id === draft.wallet && !item.archived);
  if (!wallet || !draft.currency || wallet.currency !== draft.currency ||
      !validOutlookDate(asOf) || !draft.date || !validOutlookDate(draft.date) ||
      (draft.type !== "expense" && draft.type !== "income")) return [];
  let scale: number;
  try { scale = currencyScale(wallet.currency); } catch { return []; }
  const validAmount = (amount: number | null): amount is number => amount !== null &&
    Number.isFinite(amount) && amount > 0 && Number.isSafeInteger(Math.round(amount * scale)) &&
    Math.abs(amount * scale - Math.round(amount * scale)) < 1e-5;
  if (!validAmount(draft.amount) || state.transactions.some(item => item.id === draft.id)) return [];
  const warnings: DraftAmountWarning[] = [];
  const cutoff = draft.date < asOf ? draft.date : asOf;
  const start = new Date(cutoff + "T12:00:00Z");
  start.setUTCDate(start.getUTCDate() - 90);
  const startDate = start.toISOString().slice(0, 10);
  // Conflicting/repeated IDs must not manufacture evidence for a category norm.
  const ids = new Map<string, number>();
  for (const item of state.transactions) ids.set(item.id, (ids.get(item.id) || 0) + 1);
  const amounts = draft.category && !draft.newCategory ? state.transactions.filter(item => {
    const date = item.date.slice(0, 10);
    return ids.get(item.id) === 1 && item.wallet === wallet.id && item.type === draft.type &&
      item.category === draft.category && validAmount(item.amount) && validOutlookDate(date) &&
      date >= startDate && date <= cutoff;
  }).map(item => item.amount).sort((a, b) => a - b) : [];
  if (amounts.length >= 5) {
    const middle = Math.floor(amounts.length / 2);
    const median = amounts.length % 2 ? amounts[middle] : amounts[middle - 1] / 2 + amounts[middle] / 2;
    const referenceAmount = Math.round(median * scale) / scale;
    if (draft.amount >= median * 3 || draft.amount <= median / 5) warnings.push({
      kind: draft.amount >= median * 3 ? "unusually_high" : "unusually_low",
      currency: wallet.currency, referenceAmount, category: draft.category,
    });
  }
  if (draft.type === "expense") {
    const available = availableTransactionFunds(state, wallet.id, asOf);
    if (available !== null && draft.amount > available) warnings.push({
      kind: "exceeds_balance", currency: wallet.currency,
      referenceAmount: available, category: null,
    });
  }
  return warnings;
}
