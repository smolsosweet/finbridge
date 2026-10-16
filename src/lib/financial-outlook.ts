import type { AppState, Goal } from "@/components/sites/rolly/replica/store";
import { budgetSummary, currencyScale } from "../components/sites/rolly/replica/planningModel";
import { nextExpenseDue, fixedExpensePayment } from "./fixed-expense-payments";
const days = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000);
export function reserveAmounts(state: AppState): Record<string, number> {
  try {
    const data: unknown = JSON.parse(String(state.settings.reserveByWallet || "{}"));
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return Object.fromEntries(Object.entries(data).filter(([id, value]) => state.wallets.some(w => w.id === id) && typeof value === "number" && Number.isFinite(value) && value >= 0));
  } catch { return {}; }
}
export function trackedBalance(state: Pick<AppState, "wallets" | "transactions">, walletId: string, asOf?: string) {
  const wallet = state.wallets.find(w => w.id === walletId);
  if (!wallet) return { amount: 0, complete: false };
  const scale = currencyScale(wallet.currency);
  const cents = (n: number) => Math.round(n * scale);
  let total = Number.isFinite(wallet.initial) ? cents(wallet.initial) : 0, complete = Number.isFinite(wallet.initial);
  for (const t of state.transactions) {
    const transactionDate = t.date.slice(0, 10);
    if (asOf && transactionDate > asOf) continue;
    if (asOf && !/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
      if (t.wallet === walletId || (t.type === "transfer" && t.targetWallet === walletId)) complete = false;
      continue;
    }
    if (!Number.isFinite(t.amount) || t.amount < 0) {
      if (t.wallet === walletId || (t.type === "transfer" && t.targetWallet === walletId)) complete = false;
      continue;
    }
    if (t.wallet === walletId) total += (t.type === "income" ? 1 : -1) * cents(t.amount);
    if (t.type === "transfer" && t.targetWallet === walletId) {
      if (state.wallets.find(w => w.id === t.wallet)?.currency === wallet.currency) total += cents(t.amount);
      else complete = false; // Destination amount/rate is absent; never invent a conversion.
    }
  }
  return { amount: total / scale, complete: complete && Number.isSafeInteger(total) };
}
export function budgetPace(state: AppState, budget: Goal, asOf: string) {
  const summary = budgetSummary(state, budget, asOf);
  const totalDays = days(summary.start, summary.end) + 1;
  const elapsedDays = Math.min(totalDays, Math.max(0, days(summary.start, asOf) + 1));
  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const spent = summary.actual;
  const remaining = Math.max(0, budget.amount - spent);
  let scale = 100;
  try { scale = 10 ** (new Intl.NumberFormat("en", { style: "currency", currency: budget.currency }).resolvedOptions().maximumFractionDigits ?? 2); } catch { /* Keep legacy currency formatting safe. */ }
  return { ...summary, spent, remainingDays, dailyAllowance: remainingDays ? Math.floor(remaining * scale / remainingDays) / scale : 0,
    projected: elapsedDays ? Math.round(spent * scale * totalDays / elapsedDays) / scale : 0,
    aheadOfPace: summary.matchingCurrency && elapsedDays > 0 && remainingDays > 0 && spent / budget.amount > elapsedDays / totalDays,
  };
}
export function financialOutlook(state: AppState, asOf: string) {
  const reserves = reserveAmounts(state);
  const horizon = new Date(asOf + "T12:00:00"); horizon.setFullYear(horizon.getFullYear() + 2);
  const end = `${horizon.getFullYear()}-${String(horizon.getMonth() + 1).padStart(2, "0")}-${String(horizon.getDate()).padStart(2, "0")}`;
  const expenses = (state.fixedExpenses || []).filter(e => e.active).flatMap(expense => {
    const budget = state.goals.find(b => b.kind === "budget" && b.id === expense.budgetId);
    const wallet = state.wallets.find(w => !w.archived && w.id === (budget?.wallet || expense.walletId));
    if (!wallet || (expense.budgetId && !budget) || (budget && wallet.currency !== budget.currency)) return [];
    const due = nextExpenseDue(state, expense, asOf); if (!due || due > end || fixedExpensePayment(state, expense.id, due)) return [];
    const balance = trackedBalance(state, wallet.id, asOf);
    const scale = currencyScale(wallet.currency);
    const after = (Math.round(balance.amount * scale) - Math.round(expense.amount * scale)) / scale;
    return [{ expense, wallet, due, daysUntil: days(asOf, due), balance, after, reserve: reserves[wallet.id] || 0,
      belowReserve: balance.complete && after < (reserves[wallet.id] || 0), remind: days(asOf, due) <= (expense.reminderDays ?? 3) }];
  }).sort((a, b) => a.due.localeCompare(b.due));
  return { expenses, budgets: state.goals.filter(b => b.kind === "budget" && state.wallets.some(w => !w.archived && w.id === b.wallet)).map(budget => ({ budget, ...budgetPace(state, budget, asOf) })) };
}
