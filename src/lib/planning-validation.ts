import { isDeepStrictEqual } from "node:util";
import type { AppState } from "../components/sites/rolly/replica/store";
import { validBudget, validFixedExpense, validPlanningMoney } from "../components/sites/rolly/replica/planningModel";

/** Enforce business rules at the database boundary, even for forged requests.
 * Unchanged legacy records remain readable/editable through unrelated settings.
 */
export function validatePlanningChanges(previous: AppState | null, next: AppState) {
  const changed = (before: unknown, after: unknown) => !isDeepStrictEqual(before, after);
  for (const wallet of next.wallets) {
    const old = previous?.wallets.find(w => w.id === wallet.id);
    if (old && old.currency !== wallet.currency && (previous!.transactions.some(t => t.wallet === wallet.id || t.targetWallet === wallet.id)
      || previous!.goals.some(g => g.wallet === wallet.id)
      || previous!.fixedExpenses?.some(e => e.walletId === wallet.id))) throw new Error("INVALID_PLANNING_CHANGE");
  }
  for (const budget of next.goals.filter(g => g.kind === "budget")) {
    const old = previous?.goals.find(g => g.id === budget.id);
    const wallet = next.wallets.find(w => w.id === budget.wallet);
    const oldWallet = previous?.wallets.find(w => w.id === old?.wallet);
    const contextChanged = wallet?.currency !== oldWallet?.currency || next.categoryMeta[budget.category]?.type !== previous?.categoryMeta[old?.category || ""]?.type;
    if ((changed(old, budget) || contextChanged) && !validBudget({ ...next, wallets: next.wallets.map(w => ({ ...w, archived: false })) }, budget)) throw new Error("INVALID_PLANNING_CHANGE");
    if (!old && wallet?.archived) throw new Error("INVALID_PLANNING_CHANGE");
    // Moving an existing commitment into another currency would reinterpret its
    // amount and recipient. Require unlinking it and creating a new plan instead.
    if (old && old.currency !== budget.currency && next.fixedExpenses?.some(e => e.budgetId === budget.id)) throw new Error("INVALID_PLANNING_CHANGE");
  }
  for (const expense of next.fixedExpenses || []) {
    const old = previous?.fixedExpenses?.find(e => e.id === expense.id);
    const budget = next.goals.find(g => g.id === expense.budgetId);
    const oldBudget = previous?.goals.find(g => g.id === old?.budgetId);
    const wallet = next.wallets.find(w => w.id === (budget?.wallet || expense.walletId));
    const contextChanged = changed(oldBudget, budget) || wallet?.currency !== previous?.wallets.find(w => w.id === (oldBudget?.wallet || old?.walletId))?.currency
      || next.categoryMeta[expense.category]?.type !== previous?.categoryMeta[old?.category || ""]?.type;
    if ((changed(old, expense) || contextChanged) && !validFixedExpense({ ...next, wallets: next.wallets.map(w => ({ ...w, archived: false })) }, expense)) throw new Error("INVALID_PLANNING_CHANGE");
    if (!old && wallet?.archived) throw new Error("INVALID_PLANNING_CHANGE");
    const oldWallet = previous?.wallets.find(w => w.id === (oldBudget?.wallet || old?.walletId));
    if (oldWallet && wallet && oldWallet.currency !== wallet.currency) throw new Error("INVALID_PLANNING_CHANGE");
  }
  for (const tx of next.transactions) {
    const old = previous?.transactions.find(t => t.id === tx.id);
    if (changed(old, tx)) {
      const wallet = next.wallets.find(w => w.id === tx.wallet);
      if (!wallet || !validPlanningMoney(tx.amount, wallet.currency) || (!old && wallet.archived)) throw new Error("INVALID_PLANNING_CHANGE");
    }
  }
}
