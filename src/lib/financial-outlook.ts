import type { AppState, Goal } from "@/components/finbridge/workspace/store";
import { budgetSummary, currencyScale } from "../components/finbridge/workspace/planningModel";
import { validFixedExpense } from "../components/finbridge/workspace/planningModel";
import { nextExpenseDue, fixedExpensePayment, unpaidOccurrences, expenseWallet, fixedExpenseOccurrence, nextScheduledExpenseDue, type ExpenseOccurrenceStatus } from "./fixed-expense-payments";
import { z } from "zod";
const days = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000);
export function validOutlookDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
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
  const precise = (n: number) => Number.isFinite(n) && Number.isSafeInteger(cents(n)) && Math.abs(n * scale - cents(n)) < 1e-5;
  let total = Number.isFinite(wallet.initial) ? cents(wallet.initial) : 0, complete = precise(wallet.initial);
  const seen = new Set<string>();
  for (const t of state.transactions) {
    const relevant = t.wallet === walletId || (t.type === "transfer" && t.targetWallet === walletId);
    if (!relevant) continue;
    if (seen.has(t.id)) { complete = false; continue; }
    seen.add(t.id);
    const transactionDate = t.date.slice(0, 10);
    if (asOf && !validOutlookDate(transactionDate)) {
      if (t.wallet === walletId || (t.type === "transfer" && t.targetWallet === walletId)) complete = false;
      continue;
    }
    if (asOf && transactionDate > asOf) continue;
    if (!["income", "expense", "transfer"].includes(t.type)) { complete = false; continue; }
    if (!precise(t.amount) || t.amount < 0) {
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
  const remaining = Math.max(0, summary.afterCommitments);
  const flexibleSpent = state.transactions.filter(t => t.wallet === budget.wallet && t.type === "expense" && (!budget.category || t.category === budget.category) && t.date.slice(0, 10) >= summary.start && t.date.slice(0, 10) <= asOf && !(t.fixedExpenseId && t.paymentConfirmation === "user") && Number.isFinite(t.amount) && t.amount >= 0).reduce((sum, t) => sum + Math.round(t.amount * currencyScale(budget.currency)), 0) / currencyScale(budget.currency);
  let scale = 100;
  try { scale = 10 ** (new Intl.NumberFormat("en", { style: "currency", currency: budget.currency }).resolvedOptions().maximumFractionDigits ?? 2); } catch { /* Keep legacy currency formatting safe. */ }
  return { ...summary, spent, remainingDays, dailyAllowance: remainingDays ? Math.floor(remaining * scale / remainingDays) / scale : 0,
    projected: elapsedDays ? Math.round((spent + summary.unpaidPlanned + flexibleSpent / elapsedDays * remainingDays) * scale) / scale : summary.unpaidPlanned,
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
    const occurrence = fixedExpenseOccurrence(state, expense, due, asOf);
    const scale = currencyScale(wallet.currency);
    const after = (Math.round(balance.amount * scale) - Math.round(expense.amount * scale)) / scale;
    return [{ expense, wallet, due, daysUntil: days(asOf, due), balance, after, reserve: reserves[wallet.id] || 0,
      belowReserve: balance.complete && after < (reserves[wallet.id] || 0), remind: occurrence.reminderActive, status: occurrence.status }];
  }).sort((a, b) => a.due.localeCompare(b.due) || a.expense.id.localeCompare(b.expense.id));
  const running = new Map<string, number>();
  for (const item of expenses) {
    const scale = currencyScale(item.wallet.currency);
    const before = running.get(item.wallet.id) ?? Math.round(item.balance.amount * scale);
    const after = before - Math.round(item.expense.amount * scale);
    running.set(item.wallet.id, after);
    item.after = after / scale;
    item.belowReserve = item.balance.complete && item.after < item.reserve;
  }
  return { expenses, budgets: state.goals.filter(b => b.kind === "budget" && state.wallets.some(w => !w.archived && w.id === b.wallet)).map(budget => ({ budget, ...budgetPace(state, budget, asOf) })) };
}

// Parameters only: these can travel with existing conversation metadata. No
// financial snapshot or separate persistence layer is introduced.
export const spendingPlanOptionsSchema = z.object({
  walletIds: z.array(z.string().min(1).max(100)).max(50).optional(),
  reductions: z.array(z.object({ walletId: z.string().min(1).max(100), category: z.string().min(1).max(100), percent: z.number().finite().min(0).max(100) }).strict()).max(50).optional(),
  reserves: z.record(z.string().min(1).max(100), z.number().finite().min(0).max(1e12)).optional(),
}).strict();
export type SpendingPlanOptions = z.infer<typeof spendingPlanOptionsSchema>;

/** Read-only month-end plan. All amounts use each wallet's minor units. Paid
 * occurrences are recognized solely through existing explicit payment links. */
export function calculateSpendingPlan(state: AppState, asOf: string, rawOptions: SpendingPlanOptions = {}) {
  if (!validOutlookDate(asOf)) throw new Error("INVALID_PLAN_DATE");
  const options = spendingPlanOptionsSchema.parse(rawOptions);
  const start = `${asOf.slice(0, 7)}-01`;
  const end = new Date(Date.UTC(Number(asOf.slice(0, 4)), Number(asOf.slice(5, 7)), 0, 12)).toISOString().slice(0, 10);
  const remainingDays = days(asOf, end), elapsedDays = Number(asOf.slice(8));
  const reserves = reserveAmounts(state);
  const transactionIds = new Set<string>();
  const transactions = state.transactions.filter(t => {
    if (transactionIds.has(t.id)) return false;
    transactionIds.add(t.id);
    return validOutlookDate(t.date.slice(0, 10)) && t.date.slice(0, 10) <= asOf && Number.isFinite(t.amount) && t.amount >= 0;
  });
  const ledger = { ...state, transactions };
  const historyStart = new Date(Date.UTC(Number(asOf.slice(0, 4)), Number(asOf.slice(5, 7)) - 4, 1, 12)).toISOString().slice(0, 10);
  const isFixedPayment = (t: AppState["transactions"][number]) => !!t.fixedExpenseId && !!t.fixedExpenseDueDate && t.paymentConfirmation === "user";
  const wallets = state.wallets.filter(w => !w.archived && (!options.walletIds || options.walletIds.includes(w.id))).map(wallet => {
    const scale = currencyScale(wallet.currency), units = (n: number) => Math.round(n * scale);
    const balance = trackedBalance(state, wallet.id, asOf);
    const issues: string[] = [];
    if (!balance.complete) issues.push("incomplete-balance");
    const reserve = options.reserves?.[wallet.id] ?? reserves[wallet.id] ?? null;
    if (reserve !== null && (!Number.isSafeInteger(units(reserve)) || Math.abs(reserve * scale - units(reserve)) > 1e-5)) issues.push("invalid-reserve");
    const actual = transactions.filter(t => t.wallet === wallet.id && t.type === "expense" && t.date.slice(0, 10) >= start);
    const actualUnits = actual.reduce((sum, t) => sum + units(t.amount), 0);
    const incomeUnits = transactions.filter(t => t.wallet === wallet.id && t.type === "income").reduce((sum, t) => sum + units(t.amount), 0);
    const expenseUnits = transactions.filter(t => t.wallet === wallet.id && t.type === "expense").reduce((sum, t) => sum + units(t.amount), 0);
    const transferUnits = transactions.filter(t => t.type === "transfer").reduce((sum, t) => sum - (t.wallet === wallet.id ? units(t.amount) : 0) + (t.targetWallet === wallet.id && state.wallets.find(w => w.id === t.wallet)?.currency === wallet.currency ? units(t.amount) : 0), 0);
    const pending: Array<{ id: string; title: string; date: string; amount: number; budgetId: string; category: string; status: ExpenseOccurrenceStatus; overdue: boolean; before: number | null; after: number | null }> = [];
    const seenBills = new Set<string>();
    for (const expense of state.fixedExpenses || []) {
      if (!expense.active || expenseWallet(state, expense)?.id !== wallet.id) continue;
      if (seenBills.has(expense.id)) { issues.push("duplicate-bill"); continue; }
      seenBills.add(expense.id);
      if (!validFixedExpense(state, expense)) { issues.push("invalid-bill"); continue; }
      for (const due of unpaidOccurrences(ledger, expense, expense.dueDate, end)) {
        const occurrence = fixedExpenseOccurrence(ledger, expense, due, asOf);
        pending.push({ id: occurrence.id, title: expense.title, date: due, amount: expense.amount, budgetId: expense.budgetId, category: expense.category, status: occurrence.status, overdue: occurrence.status === "overdue", before: null, after: null });
      }
    }
    // Distinct confirmed payments for the same occurrence are inconsistent;
    // retain actual ledger amounts, but do not claim a reliable projection.
    const linked = new Set<string>();
    for (const t of transactions.filter(t => t.type === "expense" && isFixedPayment(t))) {
      const expense = state.fixedExpenses?.find(e => e.id === t.fixedExpenseId);
      const expectedWallet = expense && expenseWallet(state, expense);
      if (expense && (!expectedWallet || state.wallets.find(w => w.id === t.wallet)?.currency !== expectedWallet.currency || !validOutlookDate(t.fixedExpenseDueDate!)) && (t.wallet === wallet.id || expectedWallet?.id === wallet.id)) issues.push("invalid-payment");
      const key = `${t.fixedExpenseId}:${t.fixedExpenseDueDate}`;
      if (linked.has(key) && (t.wallet === wallet.id || transactions.some(other => other.wallet === wallet.id && other.fixedExpenseId === t.fixedExpenseId && other.fixedExpenseDueDate === t.fixedExpenseDueDate))) issues.push("duplicate-payment");
      linked.add(key);
    }
    pending.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const committedUnits = pending.reduce((sum, bill) => sum + units(bill.amount), 0);
    if (![actualUnits, incomeUnits, expenseUnits, transferUnits, committedUnits, units(balance.amount) - committedUnits].every(Number.isSafeInteger)) issues.push("unsafe-total");
    const complete = !issues.length;
    let running = units(balance.amount);
    for (const bill of pending) {
      bill.before = complete ? running / scale : null;
      running -= units(bill.amount);
      bill.after = complete ? running / scale : null;
    }
    const monthFlexible = actual.filter(t => !isFixedPayment(t));
    const historyFlexible = transactions.filter(t => t.wallet === wallet.id && t.type === "expense" && !isFixedPayment(t) && t.date.slice(0, 10) >= historyStart && t.date.slice(0, 10) < start);
    const historicalMonths = new Set(historyFlexible.map(t => t.date.slice(0, 7))).size;
    const basis = monthFlexible.length && elapsedDays >= 3 ? "current-month" : historicalMonths >= 2 ? "previous-three-months" : null;
    const samples = basis === "current-month" ? monthFlexible : basis ? historyFlexible : [];
    const sampleDays = basis === "current-month" ? elapsedDays : days(historyStart, start);
    const byCategory = new Map<string, number>();
    for (const t of samples) byCategory.set(t.category, (byCategory.get(t.category) || 0) + units(t.amount));
    const baselineUnits = Math.round(samples.reduce((sum, t) => sum + units(t.amount), 0) / sampleDays * remainingDays);
    let savedUnits = 0;
    for (const [category, total] of byCategory) {
      const percent = options.reductions?.find(r => r.walletId === wallet.id && r.category === category)?.percent || 0;
      savedUnits += Math.round(total / sampleDays * remainingDays * percent / 100);
    }
    const forecastUnits = Math.max(0, baselineUnits - savedUnits);
    const reductionMissing = remainingDays > 0 && options.reductions?.some(r => r.walletId === wallet.id && r.percent > 0 && !byCategory.has(r.category));
    const forecastAvailable = complete && !reductionMissing && (remainingDays === 0 || basis !== null);
    if (reductionMissing) issues.push("missing-category-history");
    const spendable = complete && reserve !== null ? (units(balance.amount) - committedUnits - units(reserve)) / scale : null;
    const budgets = state.goals.filter(b => b.kind === "budget" && b.wallet === wallet.id).map(budget => {
      const summary = budgetSummary(ledger, budget, asOf);
      const budgetBills = pending.filter(b => b.date <= summary.end && (b.budgetId === budget.id || (!b.budgetId && (!budget.category || b.category === budget.category) && b.date >= summary.start)));
      const afterBills = summary.matchingCurrency ? (units(budget.amount) - units(summary.actual) - budgetBills.reduce((sum, b) => sum + units(b.amount), 0)) / scale : null;
      const futureDays = days(asOf, summary.end < end ? summary.end : end);
      return { id: budget.id, title: budget.title, currency: budget.currency, category: budget.category, limit: budget.amount, actual: summary.matchingCurrency && complete ? summary.actual : null, start: summary.start, end: summary.end, through: summary.end < end ? summary.end : end, afterBills: complete ? afterBills : null, dailyLimit: complete && afterBills !== null && futureDays > 0 && summary.start <= asOf ? Math.max(0, Math.floor(units(afterBills) / futureDays)) / scale : null };
    });
    const paidIds = new Set<string>();
    const paidPeriods = transactions.flatMap(payment => {
      if (!isFixedPayment(payment) || payment.type !== "expense" || !payment.fixedExpenseDueDate || payment.fixedExpenseDueDate > end || (payment.fixedExpenseDueDate < start && payment.date.slice(0, 10) < start)) return [];
      const expense = state.fixedExpenses?.find(e => e.id === payment.fixedExpenseId);
      if (!expense || expenseWallet(state, expense)?.id !== wallet.id || state.wallets.find(w => w.id === payment.wallet)?.currency !== wallet.currency) return [];
      const id = `${expense.id}:${payment.fixedExpenseDueDate}`;
      if (paidIds.has(id)) return [];
      paidIds.add(id);
      return [{ id, title: expense.title, due: payment.fixedExpenseDueDate, paidOn: payment.date.slice(0, 10), amount: payment.amount, paymentWalletId: payment.wallet, nextDue: nextScheduledExpenseDue(expense, payment.fixedExpenseDueDate) }];
    }).sort((a, b) => b.due.localeCompare(a.due));
    return { walletId: wallet.id, name: wallet.name, currency: wallet.currency, complete, issues: [...new Set(issues)], balance: complete ? balance.amount : null,
      balanceInputs: { initial: wallet.initial, income: incomeUnits / scale, expenses: expenseUnits / scale, transfers: transferUnits / scale },
      actualSpent: complete ? actualUnits / scale : null, transactionCount: actual.length, reserve, pending, paidPeriods, committed: committedUnits / scale, spendable,
      dailyLimit: spendable !== null && remainingDays > 0 ? Math.max(0, Math.floor(units(spendable) / remainingDays)) / scale : null,
      afterBills: complete ? running / scale : null, forecastAvailable, flexibleForecast: forecastAvailable ? forecastUnits / scale : null,
      projected: forecastAvailable ? (running - forecastUnits) / scale : null,
      projectedAfterReserve: forecastAvailable && reserve !== null ? (running - forecastUnits - units(reserve)) / scale : null,
      savings: forecastAvailable ? (baselineUnits - forecastUnits) / scale : null,
      basis, sampleStart: basis === "current-month" ? start : basis ? historyStart : null, sampleEnd: basis === "current-month" ? asOf : basis ? new Date(Date.parse(start + "T12:00:00Z") - 86400000).toISOString().slice(0, 10) : null,
      sampleDays: basis ? sampleDays : null, sampleSpent: samples.reduce((sum, t) => sum + units(t.amount), 0) / scale, budgets };
  });
  const unassignedExpenses = (state.fixedExpenses || []).filter(e => e.active && !expenseWallet(state, e)).map(e => e.title);
  return { asOf, start, end, remainingDays, wallets, options, unassignedExpenses };
}
export type SpendingPlan = ReturnType<typeof calculateSpendingPlan>;

export const spendingPlanAdjustmentSchema = z.object({
  walletId: z.string().max(100).nullable(), currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  category: z.string().max(100).nullable(), percent: z.number().finite().min(0).max(100).nullable(),
  reserve: z.number().finite().min(0).max(1e12).nullable(), reset: z.boolean(),
}).strict();
export function resolveSpendingPlanAdjustment(state: AppState, previous: SpendingPlanOptions, raw: z.infer<typeof spendingPlanAdjustmentSchema>) {
  const adjustment = spendingPlanAdjustmentSchema.parse(raw);
  if (adjustment.reset) return { options: { ...(previous.walletIds ? { walletIds: previous.walletIds } : {}) } satisfies SpendingPlanOptions, missing: null };
  const wallets = state.wallets.filter(w => !w.archived);
  const wallet = wallets.find(w => w.id === adjustment.walletId) || (!adjustment.walletId && previous.walletIds?.length === 1 ? wallets.find(w => w.id === previous.walletIds![0]) : !adjustment.walletId && wallets.length === 1 ? wallets[0] : null);
  if (!wallet) return { options: null, missing: "wallet" as const };
  if (adjustment.currency && adjustment.currency !== wallet.currency) return { options: null, missing: "currency" as const };
  if (adjustment.reserve !== null && Math.abs(adjustment.reserve * currencyScale(wallet.currency) - Math.round(adjustment.reserve * currencyScale(wallet.currency))) > 1e-5) return { options: null, missing: "precision" as const };
  if (adjustment.percent !== null && (!adjustment.category || !state.categories.includes(adjustment.category) || state.categoryMeta[adjustment.category]?.type === "income")) return { options: null, missing: "category" as const };
  const options = spendingPlanOptionsSchema.parse({ ...previous,
    ...(adjustment.reserve !== null ? { reserves: { ...previous.reserves, [wallet.id]: adjustment.reserve } } : {}),
    ...(adjustment.percent !== null ? { reductions: [...(previous.reductions || []).filter(r => r.walletId !== wallet.id || r.category !== adjustment.category), { walletId: wallet.id, category: adjustment.category!, percent: adjustment.percent }] } : {}),
  });
  return { options, missing: null };
}
