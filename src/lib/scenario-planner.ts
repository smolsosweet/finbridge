import type { AppState } from "../components/sites/rolly/replica/store";
import { budgetSummary } from "../components/sites/rolly/replica/planningModel";
import { unpaidOccurrences } from "./fixed-expense-payments";

export interface ScenarioChange {
  title: string;
  amount: number | null;
  direction: "income" | "expense";
  walletId: string | null;
  currency: string | null;
  date: string | null;
  category: string | null;
}

export interface SpendingReduction {
  category: string | null;
  percent: number;
  walletId: string | null;
  currency: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface DailySpendingLimit {
  amount: number | null;
  walletId: string | null;
  currency: string | null;
  category: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface FinancialScenario {
  id: string;
  name: string;
  changes: ScenarioChange[];
  spendingReductions?: SpendingReduction[];
  dailySpendingLimits?: DailySpendingLimit[];
  horizonEnd: string | null;
  estimateSpending: boolean;
  assumptions: string[];
}

export interface ScenarioResult {
  scenarioId: string;
  wallets: Array<{ walletId: string; currency: string; balanceNow: number; projectedBalance: number; shortfall: number }>;
  budgets: Array<{ budgetId: string; currency: string; actualRemaining: number; afterScenario: number; unallocatedAfterScenario: number; projectedSpend: number; projectedRemaining: number; plannedAmount: number; paceAmount: number; dailyFlexibleLimit: number; forecastEnd: string; forecastAvailable: boolean }>;
  plannedBills: Array<{ title: string; amount: number; currency: string; date: string }>;
  estimatedSpending: Array<{ walletId: string; currency: string; amount: number; dailyAverage: number; days: number; basis: "current-month-pace" | "historical-average" }>;
  savings: Array<{ walletId: string; currency: string; category: string; percent: number; baselineAmount: number; savedAmount: number; days: number; startDate: string; endDate: string }>;
  unavailableEstimates: string[];
  confidence: "assumption-based" | "historical-estimate" | "current-pace" | "user-defined";
  includesPaceForecast: boolean;
  assumptions: string[];
  suggestions: string[];
}

const validDateKey = (value: string | null): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00`)) && new Date(`${value}T12:00:00`).toISOString().slice(0, 10) === value;
const cents = (amount: number) => Math.round(amount * 100);
function nextDate(key: string) {
  const value = new Date(`${key}T12:00:00`);
  value.setDate(value.getDate() + 1);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function calculateScenario(state: AppState, scenario: FinancialScenario, today: string): ScenarioResult {
  const assumptions = [...scenario.assumptions];
  const changes = scenario.changes.filter((change): change is ScenarioChange & { amount: number; walletId: string; currency: string; date: string } => Number.isFinite(change.amount) && change.amount! > 0 && !!change.walletId && !!change.currency && validDateKey(change.date) && change.date >= today && (!scenario.horizonEnd || change.date <= scenario.horizonEnd) && state.wallets.some((wallet) => wallet.id === change.walletId && wallet.currency === change.currency && !wallet.archived));
  const dailyLimits = (scenario.dailySpendingLimits || []).filter((limit): limit is DailySpendingLimit & { amount: number; walletId: string; currency: string; startDate: string; endDate: string } => Number.isFinite(limit.amount) && limit.amount! >= 0 && !!limit.walletId && !!limit.currency && validDateKey(limit.startDate) && validDateKey(limit.endDate) && limit.startDate >= today && limit.endDate >= limit.startDate && state.wallets.some((wallet) => wallet.id === limit.walletId && wallet.currency === limit.currency && !wallet.archived));
  const walletTotals = new Map<string, number>();
  for (const wallet of state.wallets.filter((item) => !item.archived)) {
    const balance = state.transactions.reduce((sum, item) => {
      if (item.wallet === wallet.id) return sum + (item.type === "income" ? cents(item.amount) : -cents(item.amount));
      if (item.type === "transfer" && item.targetWallet === wallet.id) return sum + cents(item.amount);
      return sum;
    }, cents(wallet.initial));
    walletTotals.set(wallet.id, balance);
  }

  const changeHorizon = [...changes.map((change) => change.date), ...(scenario.spendingReductions || []).flatMap((item) => item.endDate && validDateKey(item.endDate) ? [item.endDate] : [])].reduce((latest, date) => date > latest ? date : latest, today);
  const end = validDateKey(scenario.horizonEnd) && scenario.horizonEnd >= today
    ? (scenario.horizonEnd > changeHorizon ? scenario.horizonEnd : changeHorizon)
    : changeHorizon;
  const plannedBills: ScenarioResult["plannedBills"] = [];
  const plannedByWallet = new Map<string, number>();
  for (const expense of state.fixedExpenses || []) {
    if (!expense.active) continue;
    const budget = state.goals.find((goal) => goal.id === expense.budgetId && goal.kind === "budget");
    const wallet = state.wallets.find((item) => item.id === (budget?.wallet || expense.walletId) && !item.archived);
    if (!wallet || (expense.budgetId && !budget) || (budget && wallet.currency !== budget.currency)) continue;
    for (const dueDate of unpaidOccurrences(state, expense, nextDate(today), end)) {
      plannedBills.push({ title: expense.title, amount: expense.amount, currency: wallet.currency, date: dueDate });
      plannedByWallet.set(wallet.id, (plannedByWallet.get(wallet.id) || 0) + cents(expense.amount));
    }
  }

  const spendingEstimates: ScenarioResult["estimatedSpending"] = [];
  const dailyLimitByWallet = new Map<string, number>();
  const dailyLimitWalletIds = new Set(dailyLimits.map((limit) => limit.walletId));
  const limitStartDate = nextDate(today);
  for (const limit of dailyLimits) {
    const start = limit.startDate > limitStartDate ? limit.startDate : limitStartDate;
    const finish = limit.endDate < end ? limit.endDate : end;
    if (finish < start) continue;
    const limitDays = Math.max(1, Math.round((Date.parse(`${finish}T12:00:00`) - Date.parse(`${start}T12:00:00`)) / 86_400_000) + 1);
    dailyLimitByWallet.set(limit.walletId, (dailyLimitByWallet.get(limit.walletId) || 0) + cents(limit.amount) * limitDays);
  }
  const savings: ScenarioResult["savings"] = [];
  const unavailableEstimates: string[] = [];
  const forecastCategoriesByWallet = new Map<string, Set<string>>();
  const reducedCategories = new Set((state.fixedExpenses || []).filter((item) => item.active).map((item) => item.category));
  for (const reduction of scenario.spendingReductions || []) {
    const wallet = state.wallets.find((item) => item.id === reduction.walletId && !item.archived && item.currency === reduction.currency);
    if (!wallet || !reduction.category || !validDateKey(reduction.startDate) || !validDateKey(reduction.endDate) || reduction.startDate < today || reduction.endDate < reduction.startDate || !Number.isFinite(reduction.percent) || reduction.percent <= 0 || reduction.percent > 100) {
      unavailableEstimates.push("A spending reduction needs a known category, same-currency wallet, future period and percentage from 1–100%.");
      continue;
    }
    const startDate = new Date(`${today}T12:00:00`);
    startDate.setDate(1);
    startDate.setMonth(startDate.getMonth() - 3);
    const historyStart = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-01`;
    const currentMonthStart = `${new Date(`${today}T12:00:00`).getFullYear()}-${String(new Date(`${today}T12:00:00`).getMonth() + 1).padStart(2, "0")}-01`;
    const history = state.transactions.filter((item) => item.wallet === wallet.id && item.type === "expense" && item.category === reduction.category && item.date.slice(0, 10) >= historyStart && item.date.slice(0, 10) < currentMonthStart && !reducedCategories.has(item.category));
    const activeMonths = new Set(history.map((item) => item.date.slice(0, 7)));
    if (activeMonths.size < 2) {
      unavailableEstimates.push(`Not enough history to estimate savings for ${reduction.category}; at least two of the previous three complete months need recorded spending.`);
      continue;
    }
    const elapsedDays = Math.max(1, Math.round((Date.parse(`${currentMonthStart}T12:00:00`) - Date.parse(`${historyStart}T12:00:00`)) / 86_400_000));
    const periodDays = Math.max(1, Math.round((Date.parse(`${reduction.endDate}T12:00:00`) - Date.parse(`${reduction.startDate}T12:00:00`)) / 86_400_000) + 1);
    const historicalTotal = history.reduce((sum, item) => sum + cents(item.amount), 0);
    const baselineCents = Math.round(historicalTotal / elapsedDays * periodDays);
    const savedCents = Math.round(baselineCents * reduction.percent / 100);
    savings.push({ walletId: wallet.id, currency: wallet.currency, category: reduction.category, percent: reduction.percent, baselineAmount: baselineCents / 100, savedAmount: savedCents / 100, days: periodDays, startDate: reduction.startDate, endDate: reduction.endDate });
    walletTotals.set(wallet.id, (walletTotals.get(wallet.id) || 0) - baselineCents + savedCents);
    const categories = forecastCategoriesByWallet.get(wallet.id) || new Set<string>();
    categories.add(reduction.category);
    forecastCategoriesByWallet.set(wallet.id, categories);
  }

  const days = Math.max(0, Math.round((Date.parse(`${end}T12:00:00`) - Date.parse(`${today}T12:00:00`)) / 86_400_000));
  const currentMonthStart = `${today.slice(0, 7)}-01`;
  const elapsedMonthDays = Math.max(1, Number(today.slice(8, 10)));
  const daysToForecastEnd = Math.max(0, Math.round((Date.parse(`${end}T12:00:00`) - Date.parse(`${today}T12:00:00`)) / 86_400_000));
  if (scenario.estimateSpending && days > 0) {
    for (const wallet of state.wallets.filter((item) => !item.archived)) {
      if (dailyLimitWalletIds.has(wallet.id)) continue;
      const startDate = new Date(`${today}T12:00:00`);
      startDate.setDate(1);
      startDate.setMonth(startDate.getMonth() - 3);
      const historyStart = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`;
      const excludedCategories = new Set([...reducedCategories, ...(forecastCategoriesByWallet.get(wallet.id) || [])]);
      const monthToDate = state.transactions.filter((item) => item.wallet === wallet.id && item.type === "expense" && item.date.slice(0, 10) >= currentMonthStart && item.date.slice(0, 10) <= today && !excludedCategories.has(item.category));
      if (monthToDate.length && daysToForecastEnd > 0) {
        const monthTotalCents = monthToDate.reduce((sum, item) => sum + cents(item.amount), 0);
        const dailyCents = monthTotalCents / elapsedMonthDays;
        const estimateCents = Math.round(dailyCents * daysToForecastEnd);
        spendingEstimates.push({ walletId: wallet.id, currency: wallet.currency, amount: estimateCents / 100, dailyAverage: Math.round(dailyCents) / 100, days: daysToForecastEnd, basis: "current-month-pace" });
        walletTotals.set(wallet.id, (walletTotals.get(wallet.id) || 0) - estimateCents);
        continue;
      }
      const history = state.transactions.filter((item) => item.wallet === wallet.id && item.type === "expense" && item.date.slice(0, 10) >= historyStart && item.date.slice(0, 10) < currentMonthStart && !excludedCategories.has(item.category));
      const activeMonths = new Set(history.map((item) => item.date.slice(0, 7)));
      if (activeMonths.size < 2) continue;
      const elapsedDays = Math.max(1, Math.round((Date.parse(`${currentMonthStart}T12:00:00`) - Date.parse(`${historyStart}T12:00:00`)) / 86_400_000));
      const dailyCents = history.reduce((sum, item) => sum + cents(item.amount), 0) / elapsedDays;
      const estimateCents = Math.round(dailyCents * days);
      spendingEstimates.push({ walletId: wallet.id, currency: wallet.currency, amount: estimateCents / 100, dailyAverage: Math.round(dailyCents) / 100, days, basis: "historical-average" });
      walletTotals.set(wallet.id, (walletTotals.get(wallet.id) || 0) - estimateCents);
    }
    assumptions.push("Flexible spending uses this month's recorded daily pace when available; otherwise it falls back to the average from the previous three complete months. Fixed-expense categories are excluded from the pace and scheduled fixed payments are counted separately.");
    if (state.wallets.some((wallet) => !wallet.archived && !spendingEstimates.some((estimate) => estimate.walletId === wallet.id))) unavailableEstimates.push("There is not enough current-month or prior-month expense history to estimate a spending pace for at least one wallet; only the known balance, scenario changes and scheduled fixed expenses are included there.");
  }

  for (const [walletId, amount] of dailyLimitByWallet) walletTotals.set(walletId, (walletTotals.get(walletId) || 0) - amount);

  for (const [walletId, amount] of plannedByWallet) walletTotals.set(walletId, (walletTotals.get(walletId) || 0) - amount);
  for (const change of changes) {
    if (!change.walletId || !walletTotals.has(change.walletId)) continue;
    const sign = change.direction === "income" ? 1 : -1;
    walletTotals.set(change.walletId, walletTotals.get(change.walletId)! + sign * cents(change.amount));
  }

  const touchedWallets = new Set([...changes.flatMap((change) => change.walletId ? [change.walletId] : []), ...(scenario.spendingReductions || []).flatMap((item) => item.walletId ? [item.walletId] : []), ...dailyLimits.map((item) => item.walletId), ...plannedByWallet.keys(), ...spendingEstimates.map((item) => item.walletId)]);
  const wallets = [...touchedWallets].map((walletId) => {
    const wallet = state.wallets.find((item) => item.id === walletId)!;
    const balanceNow = state.wallets.find((item) => item.id === walletId) ? (() => {
      const item = state.wallets.find((entry) => entry.id === walletId)!;
      return state.transactions.reduce((sum, transaction) => transaction.wallet === walletId ? sum + (transaction.type === "income" ? cents(transaction.amount) : -cents(transaction.amount)) : transaction.type === "transfer" && transaction.targetWallet === walletId ? sum + cents(transaction.amount) : sum, cents(item.initial)) / 100;
    })() : 0;
    const projectedBalance = (walletTotals.get(walletId) || 0) / 100;
    return { walletId, currency: wallet.currency, balanceNow, projectedBalance, shortfall: Math.max(0, -projectedBalance) };
  });

  const budgets = state.goals.filter((goal) => goal.kind === "budget").flatMap((budget) => {
    const wallet = state.wallets.find((item) => item.id === budget.wallet && !item.archived);
    if (!wallet || wallet.currency !== budget.currency) return [];
    const summary = budgetSummary(state, budget, today);
    const scenarioSpend = changes.filter((change) => change.direction === "expense" && change.walletId === budget.wallet && change.date >= summary.start && change.date <= summary.end && (!budget.category || change.category === budget.category)).reduce((sum, change) => sum + cents(change.amount), 0);
    const savingsCents = savings.filter((item) => item.walletId === budget.wallet && item.endDate >= summary.start && item.startDate <= summary.end && (!budget.category || item.category === budget.category)).reduce((sum, item) => {
      const overlapStart = item.startDate > summary.start ? item.startDate : summary.start;
      const overlapEnd = item.endDate < summary.end ? item.endDate : summary.end;
      const periodDays = Math.max(1, Math.round((Date.parse(`${item.endDate}T12:00:00`) - Date.parse(`${item.startDate}T12:00:00`)) / 86_400_000) + 1);
      const overlapDays = Math.max(0, Math.round((Date.parse(`${overlapEnd}T12:00:00`) - Date.parse(`${overlapStart}T12:00:00`)) / 86_400_000) + 1);
      return sum + Math.round((cents(item.savedAmount) - cents(item.baselineAmount)) * overlapDays / periodDays);
    }, 0);
    const forecastEnd = end < summary.end ? end : summary.end;
    const actualToDateCents = state.transactions.filter((item) => item.wallet === budget.wallet && item.type === "expense" && (!budget.category || item.category === budget.category) && item.date.slice(0, 10) >= summary.start && item.date.slice(0, 10) <= today).reduce((sum, item) => sum + cents(item.amount), 0);
    const plannedAmountCents = (state.fixedExpenses || []).filter((item) => item.active && item.budgetId === budget.id).reduce((sum, item) => sum + unpaidOccurrences(state, item, nextDate(today), forecastEnd).length * cents(item.amount), 0);
    const fixedCategories = new Set((state.fixedExpenses || []).filter((item) => item.active && item.budgetId === budget.id).map((item) => item.category));
    const budgetMonthStart = summary.start > currentMonthStart ? summary.start : currentMonthStart;
    const monthSpendCents = state.transactions.filter((item) => item.wallet === budget.wallet && item.type === "expense" && (!budget.category || item.category === budget.category) && !fixedCategories.has(item.category) && item.date.slice(0, 10) >= budgetMonthStart && item.date.slice(0, 10) <= today).reduce((sum, item) => sum + cents(item.amount), 0);
    const futureDays = Math.max(0, Math.round((Date.parse(`${forecastEnd}T12:00:00`) - Date.parse(`${today}T12:00:00`)) / 86_400_000));
    const budgetDailyLimits = dailyLimits.filter((limit) => limit.walletId === budget.wallet && (!budget.category || limit.category === budget.category));
    const dailyLimitAmountCents = budgetDailyLimits.reduce((sum, limit) => {
      const start = limit.startDate > nextDate(today) ? limit.startDate : nextDate(today);
      const finish = limit.endDate < forecastEnd ? limit.endDate : forecastEnd;
      if (finish < start) return sum;
      const count = Math.max(1, Math.round((Date.parse(`${finish}T12:00:00`) - Date.parse(`${start}T12:00:00`)) / 86_400_000) + 1);
      return sum + cents(limit.amount) * count;
    }, 0);
    const paceAmountCents = budgetDailyLimits.length ? dailyLimitAmountCents : scenario.estimateSpending ? Math.round(monthSpendCents / elapsedMonthDays * futureDays) : 0;
    const forecastScenarioSpend = changes.filter((change) => change.direction === "expense" && change.walletId === budget.wallet && change.date >= summary.start && change.date <= forecastEnd && (!budget.category || change.category === budget.category)).reduce((sum, change) => sum + cents(change.amount), 0);
    const projectedSpendCents = actualToDateCents + plannedAmountCents + paceAmountCents + forecastScenarioSpend - savingsCents;
    const dailyFlexibleLimitCents = futureDays > 0 ? Math.max(0, Math.floor((cents(budget.amount) - actualToDateCents - plannedAmountCents - forecastScenarioSpend + savingsCents) / futureDays)) : 0;
    const forecastAvailable = !scenario.estimateSpending || monthSpendCents > 0 || futureDays === 0;
    return [{ budgetId: budget.id, currency: budget.currency, actualRemaining: summary.remaining, afterScenario: Math.round(summary.remaining * 100 - scenarioSpend + savingsCents) / 100, unallocatedAfterScenario: Math.round(summary.allocationRemaining * 100 - scenarioSpend + savingsCents) / 100, projectedSpend: projectedSpendCents / 100, projectedRemaining: (cents(budget.amount) - projectedSpendCents) / 100, plannedAmount: plannedAmountCents / 100, paceAmount: paceAmountCents / 100, dailyFlexibleLimit: dailyFlexibleLimitCents / 100, forecastEnd, forecastAvailable }];
  });

  if (plannedBills.length) assumptions.push("Active fixed expenses due during the scenario period were subtracted from projected wallet balances; they remain plans, not recorded transactions.");
  assumptions.push("Each wallet is projected in its own currency. No exchange rates or cross-currency totals are assumed.");
  if (!scenario.estimateSpending) assumptions.push("Projected balances do not include unplanned future spending outside the modeled scenario changes and category reductions.");
  if (spendingEstimates.length || savings.length) assumptions.push("Historical projections use the previous three complete months only; actual future spending can vary and is not guaranteed.");
  if (scenario.estimateSpending && budgets.some((item) => !item.forecastAvailable)) unavailableEstimates.push("A budget has no recorded flexible spending this month, so its remaining-spend pace cannot be estimated; the projection includes recorded spending and scheduled fixed expenses only.");
  if (scenario.changes.some((change) => change.direction === "expense" && !change.category) && state.goals.some((goal) => goal.kind === "budget" && !!goal.category)) assumptions.push("A scenario expense has no validated category; it was not assigned to category-specific budgets.");
  const suggestions = [
    ...(wallets.some((wallet) => wallet.shortfall > 0) ? ["Review the amount or timing, or select a same-currency wallet with enough projected funds."] : []),
    ...(budgets.some((budget) => budget.afterScenario < 0) ? ["This scenario exceeds a budget limit; consider lowering or rescheduling the expense, or review the budget separately."] : []),
  ];
  if (dailyLimits.length) assumptions.push("User-specified daily spending limits replace the current-pace estimate for those wallets.");
  const confidence = dailyLimits.length ? "user-defined" : spendingEstimates.some((item) => item.basis === "current-month-pace") ? "current-pace" : spendingEstimates.length || savings.length ? "historical-estimate" : "assumption-based";
  return { scenarioId: scenario.id, wallets, budgets, plannedBills, estimatedSpending: spendingEstimates, savings, unavailableEstimates, confidence, includesPaceForecast: scenario.estimateSpending || dailyLimits.length > 0, assumptions: [...new Set(assumptions)], suggestions };
}

export function scenarioContext(state: AppState, today: string, selectedWalletId?: string | null) {
  const windowStart = new Date(`${today}T12:00:00`);
  windowStart.setMonth(windowStart.getMonth() - 3);
  const from = `${windowStart.getFullYear()}-${String(windowStart.getMonth() + 1).padStart(2, "0")}-${String(windowStart.getDate()).padStart(2, "0")}`;
  const selectedWallet = state.wallets.find((wallet) => wallet.id === selectedWalletId && !wallet.archived);
  const wallets = state.wallets.filter((item) => !item.archived && Number.isFinite(item.initial) && (!selectedWallet || item.id === selectedWallet.id));
  const budgets = state.goals.filter((item) => item.kind === "budget" && Number.isFinite(item.amount) && (!selectedWallet || item.wallet === selectedWallet.id));
  const budgetIds = new Set(budgets.map((item) => item.id));
  return {
    defaultWalletId: selectedWallet?.id || wallets[0]?.id || null,
    // User-created labels and imported receipt descriptions are not guaranteed to
    // fit the API schema. Bound them here so a single old record cannot break chat.
    wallets: wallets.slice(0, 30).map(({ id, name, currency, initial }) => ({ id: id.slice(0, 100), name: name.slice(0, 100), currency: currency.slice(0, 8), initial })),
    budgets: budgets.slice(0, 100).map(({ id, title, amount, currency, date, cycle, category, wallet }) => ({ id: id.slice(0, 100), title: title.slice(0, 100), amount, currency: currency.slice(0, 8), date: String(date).slice(0, 20), cycle: String(cycle).slice(0, 20), category: String(category || "").slice(0, 100), wallet: wallet.slice(0, 100) })),
    fixedExpenses: (state.fixedExpenses || []).filter((item) => item.active && Number.isFinite(item.amount) && (!selectedWallet || budgetIds.has(item.budgetId))).slice(0, 200).map(({ id, budgetId, title, amount, category, dueDate, recurrence }) => ({ id: id.slice(0, 100), budgetId: budgetId.slice(0, 100), title: title.slice(0, 100), amount, category: String(category || "").slice(0, 100), dueDate: String(dueDate).slice(0, 20), recurrence })),
    categories: state.categories.filter((item): item is string => typeof item === "string").slice(0, 100).map((item) => item.slice(0, 100)),
    recentTransactions: state.transactions.filter((item) => typeof item.date === "string" && item.date.slice(0, 10) >= from && item.date.slice(0, 10) <= today && Number.isFinite(item.amount) && (!selectedWallet || item.wallet === selectedWallet.id || item.targetWallet === selectedWallet.id)).slice(-150).map(({ title, amount, type, category, date, wallet, targetWallet }) => ({ title: String(title || "").slice(0, 160), amount, type, category: String(category || "").slice(0, 100), date: String(date).slice(0, 30), wallet: String(wallet || "").slice(0, 100), ...(targetWallet ? { targetWallet: targetWallet.slice(0, 100) } : {}) })),
  };
}
