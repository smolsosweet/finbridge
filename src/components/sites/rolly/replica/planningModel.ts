import type { AppState, FixedExpense, Goal } from "./store";
import { localDateKey } from "./chartWeek";

function date(key: string) { return new Date(key + "T12:00:00"); }
function addMonths(key: string, months: number): string {
  const current = date(key);
  const target = new Date(current.getFullYear(), current.getMonth() + months, 1, 12);
  target.setDate(Math.min(current.getDate(), new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()));
  return localDateKey(target);
}
function addDays(key: string, days: number): string {
  const next = date(key); next.setDate(next.getDate() + days); return localDateKey(next);
}
export function budgetWindow(budget: Goal, asOf: string): { start: string; end: string } {
  const cycle = budget.cycle;
  const months = cycle === "yearly" || cycle === "Hàng năm" ? 12 : cycle === "monthly" || cycle === "Hàng tháng" ? 1 : 0;
  if (months) {
    const anchor = date(budget.date), today = date(asOf);
    let index = Math.max(0, Math.floor(((today.getFullYear() - anchor.getFullYear()) * 12 + today.getMonth() - anchor.getMonth()) / months));
    if (addMonths(budget.date, index * months) > asOf && index > 0) index--;
    return { start: addMonths(budget.date, index * months), end: addDays(addMonths(budget.date, (index + 1) * months), -1) };
  }
  const days = cycle === "daily" || cycle === "Hàng ngày" ? 1 : cycle === "weekly" || cycle === "Hàng tuần" ? 7 : cycle === "Hai tuần" ? 14 : 0;
  if (days) {
    const elapsed = Math.round((Date.UTC(...parseDate(asOf)) - Date.UTC(...parseDate(budget.date))) / 86400000);
    const start = addDays(budget.date, Math.max(0, Math.floor(elapsed / days)) * days);
    return { start, end: addDays(start, days - 1) };
  }
  // Existing one-off budgets keep a month-long period.
  return { start: budget.date, end: addDays(addMonths(budget.date, 1), -1) };
}
function parseDate(key: string): [number, number, number] {
  const [year, month, day] = key.split("-").map(Number); return [year, month - 1, day];
}
export function plannedOccurrences(expense: FixedExpense, start: string, end: string): string[] {
  if (!expense.active || end < expense.dueDate) return [];
  if (expense.recurrence === "once") return expense.dueDate >= start && expense.dueDate <= end ? [expense.dueDate] : [];
  const results: string[] = [];
  if (expense.recurrence === "weekly") {
    const elapsed = Math.round((Date.UTC(...parseDate(start)) - Date.UTC(...parseDate(expense.dueDate))) / 86400000);
    let next = addDays(expense.dueDate, Math.max(0, Math.ceil(elapsed / 7)) * 7);
    while (next <= end && results.length < 400) { results.push(next); next = addDays(next, 7); }
  } else {
    const step = expense.recurrence === "yearly" ? 12 : expense.intervalMonths && Number.isInteger(expense.intervalMonths) && expense.intervalMonths >= 1 && expense.intervalMonths <= 12 ? expense.intervalMonths : 1;
    const anchor = date(expense.dueDate), begin = date(start);
    let index = Math.max(0, Math.floor(((begin.getFullYear() - anchor.getFullYear()) * 12 + begin.getMonth() - anchor.getMonth()) / step) - 1);
    const occurrence = (i: number) => {
      const key = addMonths(expense.dueDate, i * step);
      if (expense.monthPosition !== "end") return key;
      const d = date(key);
      return localDateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12));
    };
    let next = occurrence(index);
    while (next <= end && results.length < 400) {
      if (next >= start) results.push(next);
      next = occurrence(++index);
    }
  }
  return results;
}
export function budgetSummary(state: AppState, budget: Goal, asOf: string) {
  const window = budgetWindow(budget, asOf);
  const wallet = state.wallets.find((item) => item.id === budget.wallet);
  const matchingCurrency = wallet?.currency === budget.currency;
  const actual = matchingCurrency ? state.transactions.filter((item) => item.type === "expense" && item.wallet === budget.wallet && (!budget.category || item.category === budget.category) && item.date.slice(0, 10) >= window.start && item.date.slice(0, 10) <= window.end).reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100 : 0;
  const children = (state.fixedExpenses || []).filter((item) => item.budgetId === budget.id);
  const planned = children.reduce((sum, item) => sum + Math.round(item.amount * 100) * plannedOccurrences(item, window.start, window.end).length, 0) / 100;
  return { ...window, actual, planned, remaining: budget.amount - actual, allocationRemaining: budget.amount - planned, children, matchingCurrency };
}
export function validFixedExpense(state: AppState, expense: FixedExpense): boolean {
  const budget = state.goals.find((item) => item.id === expense.budgetId && item.kind === "budget");
  const wallet = state.wallets.find((item) => item.id === (budget?.wallet || expense.walletId) && !item.archived);
  return (!expense.budgetId || !!budget) && !!wallet && (!budget || wallet.currency === budget.currency)
    && expense.title.trim().length > 0 && Number.isFinite(expense.amount) && expense.amount > 0 && (!budget || expense.dueDate >= budget.date)
    && /^\d{4}-\d{2}-\d{2}$/.test(expense.dueDate) && Number.isFinite(date(expense.dueDate).getTime()) && localDateKey(date(expense.dueDate)) === expense.dueDate
    && ["once", "weekly", "monthly", "yearly"].includes(expense.recurrence) && (expense.intervalMonths === undefined || (Number.isInteger(expense.intervalMonths) && expense.intervalMonths >= 1 && expense.intervalMonths <= 12))
    && (expense.reminderDays === undefined || (Number.isInteger(expense.reminderDays) && expense.reminderDays >= 0 && expense.reminderDays <= 30))
    && !!expense.category.trim() && state.categoryMeta[expense.category]?.type !== "income" && (!budget?.category || expense.category === budget.category);
}
export function validBudget(state: AppState, budget: Goal): boolean {
  const wallet = state.wallets.find((item) => item.id === budget.wallet && !item.archived);
  return budget.kind === "budget" && !!wallet && wallet.currency === budget.currency && !!budget.title.trim() && Number.isFinite(budget.amount) && budget.amount > 0 && ["weekly", "monthly", "yearly"].includes(budget.cycle) && /^\d{4}-\d{2}-\d{2}$/.test(budget.date) && Number.isFinite(date(budget.date).getTime()) && localDateKey(date(budget.date)) === budget.date && (!budget.category || state.categoryMeta[budget.category]?.type !== "income");
}
