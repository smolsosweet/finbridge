import type { AppState, FixedExpense, Goal } from "./store";
import { localDateKey } from "./chartWeek";

export function currencyScale(currency: string) {
  return 10 ** (new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2);
}
export function validPlanningMoney(amount: number, currency: string) {
  const scale = currencyScale(currency);
  return Number.isFinite(amount) && amount > 0 && amount <= 1e12 && Number.isSafeInteger(Math.round(amount * scale)) && Math.abs(amount * scale - Math.round(amount * scale)) <= 1e-5;
}
// A matching amount/date is not proof of payment. Only a user-confirmed link
// identifies the exact bill occurrence, including early or adjusted payments.
export function occurrencePayment(state: Pick<AppState, "transactions">, expenseId: string, due: string) {
  return state.transactions.find(t => t.type === "expense" && t.paymentConfirmation === "user" && t.fixedExpenseId === expenseId && t.fixedExpenseDueDate === due);
}

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
export function budgetSummary(state: Pick<AppState, "wallets" | "transactions" | "fixedExpenses">, budget: Goal, asOf: string) {
  const window = budgetWindow(budget, asOf);
  const wallet = state.wallets.find((item) => item.id === budget.wallet);
  const matchingCurrency = wallet?.currency === budget.currency;
  const actualEnd = asOf < window.end ? asOf : window.end;
  const scale = currencyScale(budget.currency);
  const actual = matchingCurrency ? state.transactions.filter((item) => item.type === "expense" && Number.isFinite(item.amount) && item.amount >= 0 && item.wallet === budget.wallet && (!budget.category || item.category === budget.category) && item.date.slice(0, 10) >= window.start && item.date.slice(0, 10) <= actualEnd).reduce((sum, item) => sum + Math.round(item.amount * scale), 0) / scale : 0;
  const children = (state.fixedExpenses || []).filter((item) => item.budgetId === budget.id);
  const planned = children.filter((item) => Number.isFinite(item.amount) && item.amount >= 0).reduce((sum, item) => sum + Math.round(item.amount * scale) * plannedOccurrences(item, window.start, window.end).length, 0) / scale;
  const unpaidPlanned = children.filter(item => Number.isFinite(item.amount) && item.amount > 0).reduce((sum, item) => sum + Math.round(item.amount * scale) * plannedOccurrences(item, window.start, window.end).filter(due => !occurrencePayment(state, item.id, due)).length, 0) / scale;
  const afterCommitments = Math.round((budget.amount - actual - unpaidPlanned) * scale) / scale;
  return { ...window, actual, planned, unpaidPlanned, afterCommitments, remaining: Math.round((budget.amount - actual) * scale) / scale, allocationRemaining: budget.amount - planned, children, matchingCurrency };
}

export interface WeeklySpendingRow {
  start: string;
  end: string;
  walletId: string;
  currency: string;
  fixed: number;
  variable: number;
  total: number;
  transactionCount: number;
  unspent: number | null;
}

export function weeklyPeriodStatus(start: string, end: string, actualThrough: string): "future" | "partial" | "complete" {
  if (start > actualThrough) return "future";
  return end > actualThrough ? "partial" : "complete";
}

export function weeklySpendingRows(
  state: Pick<AppState, "wallets" | "transactions" | "fixedExpenses">,
  budgets: Goal[],
  month: string,
  actualThrough: string,
  walletFilter = "all",
): WeeklySpendingRow[] {
  if (!/^\d{4}-\d{2}$/.test(month)) return [];
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(daysInMonth).padStart(2, "0")}`;
  const cutoff = actualThrough < monthEnd ? actualThrough : monthEnd;
  const actualExpenses = state.transactions.filter((transaction) => transaction.type === "expense"
    && transaction.amount > 0 && Number.isFinite(transaction.amount)
    && /^\d{4}-\d{2}-\d{2}$/.test(transaction.date)
    && transaction.date >= monthStart && transaction.date <= cutoff
    && (walletFilter === "all" || transaction.wallet === walletFilter));
  const wallets = state.wallets.filter((wallet) => walletFilter === "all" || wallet.id === walletFilter);
  const result: WeeklySpendingRow[] = [];

  for (const wallet of wallets) {
    for (let firstDay = 1; firstDay <= daysInMonth; firstDay += 7) {
      const start = `${month}-${String(firstDay).padStart(2, "0")}`;
      const lastDay = Math.min(daysInMonth, firstDay + 6);
      const end = `${month}-${String(lastDay).padStart(2, "0")}`;
      const transactions = actualExpenses.filter((transaction) => transaction.wallet === wallet.id && transaction.date >= start && transaction.date <= end);
      const fixedTransactions = transactions.filter((transaction) => {
        return !!transaction.fixedExpenseId && !!transaction.fixedExpenseDueDate && transaction.paymentConfirmation === "user";
      });
      const scale = currencyScale(wallet.currency);
      const fixed = fixedTransactions.reduce((sum, item) => sum + Math.round(item.amount * scale), 0) / scale;
      const total = transactions.reduce((sum, item) => sum + Math.round(item.amount * scale), 0) / scale;
      const remainingAsOf = end < cutoff ? end : cutoff;
      const walletBudgets = budgets.filter((budget) => budget.wallet === wallet.id);
      const badCurrency = walletBudgets.some((budget) => budget.currency !== wallet.currency);
      const overlapping = walletBudgets.some((entry, index) => walletBudgets.slice(index + 1).some((other) =>
        entry.currency === other.currency && (!entry.category || !other.category || entry.category === other.category)));
      const unspent = !walletBudgets.length || badCurrency || overlapping
        ? null
        : walletBudgets.reduce((sum, budget) => sum + budgetSummary(state, budget, remainingAsOf).remaining, 0);
      result.push({ start, end, walletId: wallet.id, currency: wallet.currency, fixed, variable: total - fixed, total, transactionCount: transactions.length, unspent });
    }
  }
  return result;
}

export function validFixedExpense(state: AppState, expense: FixedExpense): boolean {
  const budget = state.goals.find((item) => item.id === expense.budgetId && item.kind === "budget");
  const wallet = state.wallets.find((item) => item.id === (budget?.wallet || expense.walletId) && !item.archived);
  return (!expense.budgetId || !!budget) && !!wallet && (!budget || wallet.currency === budget.currency)
    && expense.title.trim().length > 0 && validPlanningMoney(expense.amount, wallet.currency) && (!budget || expense.dueDate >= budget.date)
    && /^\d{4}-\d{2}-\d{2}$/.test(expense.dueDate) && Number.isFinite(date(expense.dueDate).getTime()) && localDateKey(date(expense.dueDate)) === expense.dueDate
    && ["once", "weekly", "monthly", "yearly"].includes(expense.recurrence) && (expense.intervalMonths === undefined || (Number.isInteger(expense.intervalMonths) && expense.intervalMonths >= 1 && expense.intervalMonths <= 12))
    && (expense.reminderDays === undefined || (Number.isInteger(expense.reminderDays) && expense.reminderDays >= 0 && expense.reminderDays <= 30))
    && !!expense.category.trim() && state.categoryMeta[expense.category]?.type !== "income" && (!budget?.category || expense.category === budget.category);
}
export function validBudget(state: AppState, budget: Goal): boolean {
  const wallet = state.wallets.find((item) => item.id === budget.wallet && !item.archived);
  return budget.kind === "budget" && !!wallet && wallet.currency === budget.currency && !!budget.title.trim() && validPlanningMoney(budget.amount, budget.currency) && ["weekly", "monthly", "yearly"].includes(budget.cycle) && /^\d{4}-\d{2}-\d{2}$/.test(budget.date) && Number.isFinite(date(budget.date).getTime()) && localDateKey(date(budget.date)) === budget.date && (!budget.category || state.categoryMeta[budget.category]?.type !== "income");
}
