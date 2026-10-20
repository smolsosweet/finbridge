import type { AppState } from "../components/finbridge/workspace/store";
import { budgetSummary, currencyScale } from "../components/finbridge/workspace/planningModel";
import { unpaidOccurrences } from "./fixed-expense-payments";
import { reserveAmounts, trackedBalance } from "./financial-outlook";
import type { FinancialAction, FinancialQuery } from "./financial-chat";

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
  reserves?: Record<string, number>;
  walletIds?: string[];
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
  wallets: Array<{ walletId: string; currency: string; balanceNow: number; projectedBalance: number; shortfall: number; protectedReserve?: number | null; availableAfterReserve?: number | null; balanceComplete?: boolean; components?: { unpaidBills: number; paceSpending: number; dailyLimitSpending: number; hypotheticalIncome: number; hypotheticalExpense: number; reducedCategorySpending: number } }>;
  budgets: Array<{ budgetId: string; title?: string; currency: string; actualRemaining: number; afterScenario: number; unallocatedAfterScenario: number; projectedSpend: number; projectedRemaining: number; plannedAmount: number; paceAmount: number; dailyFlexibleLimit: number; forecastEnd: string; forecastAvailable: boolean }>;
  plannedBills: Array<{ walletId?: string; title: string; amount: number; currency: string; date: string }>;
  estimatedSpending: Array<{ walletId: string; currency: string; amount: number; dailyAverage: number; days: number; basis: "current-month-pace" | "historical-average" }>;
  savings: Array<{ walletId: string; currency: string; category: string; percent: number; baselineAmount: number; savedAmount: number; days: number; startDate: string; endDate: string }>;
  unavailableEstimates: string[];
  confidence: "assumption-based" | "historical-estimate" | "current-pace" | "user-defined";
  includesPaceForecast: boolean;
  assumptions: string[];
  suggestions: string[];
}

export const validDateKey = (value: string | null | undefined): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00`)) && new Date(`${value}T12:00:00`).toISOString().slice(0, 10) === value;

export function getStartOfMonth(dateStr: string): string {
  const parts = dateStr.split("-").map(Number);
  const year = parts[0] || new Date().getFullYear();
  const month = parts[1] || 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function getEndOfMonth(dateStr: string): string {
  const parts = dateStr.split("-").map(Number);
  const year = parts[0] || new Date().getFullYear();
  const month = parts[1] || 1;
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

export function getPriorMonthRange(dateStr: string): { start: string; end: string } {
  const parts = dateStr.split("-").map(Number);
  let year = parts[0] || new Date().getFullYear();
  let month = (parts[1] || 1) - 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  const lastDay = new Date(year, month, 0).getDate();
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export function getWeekRange(dateStr: string, offsetWeeks = 0): { start: string; end: string } {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday + offsetWeeks * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const format = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  return { start: format(monday), end: format(sunday) };
}

export function resolveRelativePeriod(text: string, today: string): { start: string | null; end: string | null } {
  const norm = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLocaleLowerCase("vi");
  if (/\b(?:thang\s+truoc|thang\s+vua\s+roi|last\s+month)\b/i.test(norm)) {
    return getPriorMonthRange(today);
  }
  if (/\b(?:thang\s+nay|thang\s+hien\s+tai|this\s+month)\b/i.test(norm)) {
    return { start: getStartOfMonth(today), end: getEndOfMonth(today) };
  }
  if (/\b(?:tuan\s+truoc|last\s+week)\b/i.test(norm)) {
    return getWeekRange(today, -1);
  }
  if (/\b(?:tuan\s+nay|this\s+week)\b/i.test(norm)) {
    return getWeekRange(today, 0);
  }
  if (/\b(?:hom\s+nay|today)\b/i.test(norm)) {
    return { start: today, end: today };
  }
  if (/\b(?:hom\s+qua|yesterday)\b/i.test(norm)) {
    const yest = addDays(today, -1);
    return { start: yest, end: yest };
  }
  const lastDaysMatch = norm.match(/(\d+)\s*ngay\s*(?:qua|gan\s+day|truoc)/i);
  if (lastDaysMatch) {
    const count = parseInt(lastDaysMatch[1], 10);
    if (!isNaN(count) && count > 0 && count <= 365) {
      return { start: addDays(today, -count), end: today };
    }
  }
  return { start: null, end: null };
}

export function findPreviousScenarioFromHistory(
  history?: Array<{ role: "user" | "assistant"; text: string }>
): FinancialScenario | null {
  if (!history || !history.length) return null;
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    const marker = ["Previous hypothetical scenario parameters: ", "Previous hypothetical assumptions only (recalculate from current data): "].find(value => item.text.includes(value));
    if (!marker) continue;
    const idx = item.text.indexOf(marker);
    if (idx !== -1) {
      try {
        const jsonStr = item.text.slice(idx + marker.length).trim();
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed) && parsed[0]) {
          const s = parsed[0];
          return {
            id: s.id || "prev-scenario",
            name: s.name || "Previous scenario",
            ...(Array.isArray(s.walletIds) ? { walletIds: s.walletIds.filter((id: unknown): id is string => typeof id === "string") } : {}),
            changes: Array.isArray(s.changes) ? s.changes : [],
            spendingReductions: Array.isArray(s.spendingReductions) ? s.spendingReductions : [],
            dailySpendingLimits: Array.isArray(s.dailySpendingLimits) ? s.dailySpendingLimits : [],
            horizonEnd: s.horizonEnd || null,
            estimateSpending: !!s.estimateSpending,
            assumptions: Array.isArray(s.assumptions) ? s.assumptions : [],
            ...(s.reserves && typeof s.reserves === "object" && !Array.isArray(s.reserves) ? { reserves: s.reserves } : {}),
          };
        }
      } catch {
        // Continue searching older messages
      }
    }
  }
  return null;
}

export function addDays(dateStr: string, count: number): string {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  d.setDate(d.getDate() + count);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function cleanJsonText(rawText: string): string {
  let text = (rawText || "").trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }
  return text.trim();
}

export interface ParsedVietnameseExpression {
  detectedAmount: number | null;
  detectedCurrency: string | null;
  isDaily: boolean;
  isEndOfMonth: boolean;
  isTomorrow: boolean;
  inferredCategory: string | null;
  inferredWalletId: string | null;
  intentHint: "scenario" | "financial_query" | "general_advice" | null;
  actionHint: string | null;
  actionHints: string[];
  periodStart: string | null;
  periodEnd: string | null;
  isFollowUpScenario: boolean;
}

export function parseVietnameseFinancialExpressions(
  text: string,
  _today: string,
  context?: {
    wallets?: Array<{ id: string; name: string; currency: string }>;
    categories?: string[];
  }
): ParsedVietnameseExpression {
  const norm = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLocaleLowerCase("vi");
  let detectedAmount: number | null = null;
  let detectedCurrency: string | null = null;

  if (/\b(?:nua\s+(?:cu|chai|trieu|tr)|0[.,]5\s*(?:cu|chai|trieu|tr))\b/i.test(norm)) {
    detectedAmount = 500_000;
    detectedCurrency = "VND";
  } else if (/(\d+(?:[.,]\d+)?)\s*(?:cu|chai|trieu|tr)\s*(?:ruoi|nam)\b/i.test(norm)) {
    const match = norm.match(/(\d+(?:[.,]\d+)?)\s*(?:cu|chai|trieu|tr)\s*(?:ruoi|nam)\b/i);
    if (match) {
      detectedAmount = Math.round((Number(match[1].replace(",", ".")) + 0.5) * 1_000_000);
      detectedCurrency = "VND";
    }
  } else if (/(\d+(?:[.,]\d+)?)\s*(?:cu|chai|trieu|tr)\b/i.test(norm)) {
    const match = norm.match(/(\d+(?:[.,]\d+)?)\s*(?:cu|chai|trieu|tr)\b/i);
    if (match) {
      detectedAmount = Math.round(Number(match[1].replace(",", ".")) * 1_000_000);
      detectedCurrency = "VND";
    }
  } else if (/(\d+(?:[.,]\d+)?)\s*(?:ty|toi)\b/i.test(norm)) {
    const match = norm.match(/(\d+(?:[.,]\d+)?)\s*(?:ty|toi)\b/i);
    if (match) {
      detectedAmount = Math.round(Number(match[1].replace(",", ".")) * 1_000_000_000);
      detectedCurrency = "VND";
    }
  } else if (/(\d+(?:[.,]\d+)?)\s*(?:lit)\b/i.test(norm)) {
    const match = norm.match(/(\d+(?:[.,]\d+)?)\s*(?:lit)\b/i);
    if (match) {
      detectedAmount = Math.round(Number(match[1].replace(",", ".")) * 100_000);
      detectedCurrency = "VND";
    }
  } else if (/(\d+(?:[.,]\d+)?)\s*(?:k|nghin|ngan)\b/i.test(norm)) {
    const match = norm.match(/(\d+(?:[.,]\d+)?)\s*(?:k|nghin|ngan)\b/i);
    if (match) {
      detectedAmount = Math.round(Number(match[1].replace(",", ".")) * 1_000);
      detectedCurrency = "VND";
    }
  } else if (/(?:\$|\busd\b)\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:\$|\busd\b)/i.test(norm)) {
    const match = norm.match(/(?:\$|\busd\b)\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:\$|\busd\b)/i);
    const val = match?.[1] || match?.[2];
    if (val) {
      detectedAmount = Number(val.replace(",", "."));
      detectedCurrency = "USD";
    }
  } else if (/(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?)\s*(?:d|vnd|dong)?\b/i.test(norm)) {
    const match = norm.match(/(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?)\s*(?:d|vnd|dong)?\b/i);
    if (match) {
      const cleaned = match[1].replace(/[.,]/g, "");
      detectedAmount = Number(cleaned);
      detectedCurrency = "VND";
    }
  }

  const isDaily = /\b(?:moi\s+ngay|1\s+ngay|mot\s+ngay|ngay\s+dung|ngay\s+tieu|ngay\s+chi|ngay\s+an|hang\s+ngay|daily|per\s+day)\b/i.test(norm);
  const isEndOfMonth = /\b(?:cuoi\s+thang|het\s+thang|den\s+cuoi\s+thang|toi\s+cuoi\s+thang|end\s+of\s+month|month\s+end)\b/i.test(norm);
  const isTomorrow = /\b(?:ngay\s+mai|mai|tomorrow)\b/i.test(norm);
  const isFollowUpScenario = /\b(?:doi\s+(?:thanh|sang)|chuyen\s+(?:thanh|sang)|giam\s+(?:xuong|con)|tang\s+(?:len|thanh)|con\s+neu|neu\s+(?:doi|giam|tang)|the\s+con)\b/i.test(norm) || /^(?:doi|con\s+neu|the\s+con|giam|tang)\b/i.test(norm);

  const { start: periodStart, end: periodEnd } = resolveRelativePeriod(text, _today);

  const wallets = context?.wallets || [];
  let inferredWalletId: string | null = null;
  if (wallets.length === 1) {
    inferredWalletId = wallets[0].id;
  } else if (detectedCurrency) {
    const matching = wallets.filter((w) => w.currency.toUpperCase() === detectedCurrency);
    if (matching.length === 1) inferredWalletId = matching[0].id;
  }
  if (!inferredWalletId) {
    for (const wallet of wallets) {
      const walletNorm = wallet.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLocaleLowerCase("vi").trim();
      if (walletNorm && walletNorm !== "." && norm.includes(walletNorm)) {
        inferredWalletId = wallet.id;
        break;
      }
    }
  }

  let inferredCategory: string | null = null;
  if (context?.categories?.length) {
    for (const cat of context.categories) {
      const catNorm = cat.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLocaleLowerCase("vi").trim();
      if (catNorm && norm.includes(catNorm)) {
        inferredCategory = cat;
        break;
      }
    }
  }

  const actionHints: string[] = [];
  if (/\b(?:(?:chi|tieu)\s+nhieu\s+nhat|khoan\s+(?:chi|tieu)\s+(?:lon|nhieu)\s+nhat|danh\s+muc\s+(?:chi|tieu)\s+nhieu|top\s+category)\b/i.test(norm)) {
    actionHints.push("top_category");
  }
  if (/\b(?:bat\s+thuong|anomal|dot\s+bien)\b/i.test(norm)) {
    actionHints.push("anomalies");
  }
  if (/\b(?:so\s+du|con\s+bao\s+nhieu\s+tien|tong\s+tien|so\s+tien\s+con\s+lai|balance)\b/i.test(norm)) {
    actionHints.push("balance");
  }
  if (/\b(?:da\s+(?:chi|tieu)\s+bao\s+nhieu|tong\s+(?:chi|tieu)|(?:chi|tieu)\s+thang|tong\s+thu\s+chi|spending)\b/i.test(norm)) {
    actionHints.push("spending_summary");
  }
  if (/\b(?:han\s+muc\s+an\s+toan|moi\s+ngay\s+(?:duoc\s+)?(?:tieu|chi)\s+toi\s+da|safe\s+daily)\b/i.test(norm)) {
    actionHints.push("safe_daily_allowance");
  }
  if (/\b(?:sap\s+toi|khoan\s+co\s+dinh|hoa\s+don|den\s+han|upcoming)\b/i.test(norm)) {
    actionHints.push("upcoming_obligations");
  }
  if (/\b(?:ngan\s+sach|budget)\b/i.test(norm)) {
    actionHints.push("budget_status");
  }
  if (/\b(?:muc\s+tieu|goal)\b/i.test(norm)) {
    actionHints.push("goals");
  }
  if (/\b(?:giao\s+dich|lich\s+su\s+(?:chi|tieu)|transactions|history)\b/i.test(norm)) {
    actionHints.push("transactions");
  }

  let intentHint: "scenario" | "financial_query" | "general_advice" | null = null;
  const actionHint: string | null = actionHints[0] || null;

  if (isDaily || isFollowUpScenario || /\b(?:neu|gia\s+su|what\s*if|co\s+bi\s+am\s+khong)\b/i.test(norm)) {
    intentHint = "scenario";
  } else if (actionHints.length > 0) {
    intentHint = "financial_query";
  } else if (/\b(?:cach\s+tiet\s+kiem|meo\s+tiet\s+kiem|quy\s+tac\s+50|quy\s+khan\s+cap|loi\s+khuyen|tu\s+van\s+tai\s+chinh|nguyen\s+tac\s+chi\s+tieu)\b/i.test(norm)) {
    intentHint = "general_advice";
  }

  return {
    detectedAmount,
    detectedCurrency,
    isDaily,
    isEndOfMonth,
    isTomorrow,
    inferredCategory,
    inferredWalletId,
    intentHint,
    actionHint,
    actionHints,
    periodStart,
    periodEnd,
    isFollowUpScenario,
  };
}

const cents = (amount: number) => Math.round(amount * 100);
function nextDate(key: string) {
  const value = new Date(`${key}T12:00:00`);
  value.setDate(value.getDate() + 1);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function calculateScenario(state: AppState, scenario: FinancialScenario, today: string): ScenarioResult {
  // Historical balance and payment links must use the same as-of ledger.
  state = { ...state, transactions: state.transactions.filter(t => t.date.slice(0, 10) <= today) };
  const activeWallets = state.wallets.filter(w => !w.archived && (!scenario.walletIds || scenario.walletIds.includes(w.id)));
  const savedReserves = reserveAmounts(state);
  const scopedWalletIds = new Set(activeWallets.map(w => w.id));
  const isLinkedPayment = (t: AppState["transactions"][number]) => !!t.fixedExpenseId && !!t.fixedExpenseDueDate && t.paymentConfirmation === "user";
  const assumptions = [...scenario.assumptions];
  const changes = scenario.changes.filter((change): change is ScenarioChange & { amount: number; walletId: string; currency: string; date: string } => Number.isFinite(change.amount) && change.amount! > 0 && !!change.walletId && !!change.currency && validDateKey(change.date) && change.date >= today && (!scenario.horizonEnd || change.date <= scenario.horizonEnd) && state.wallets.some((wallet) => wallet.id === change.walletId && wallet.currency === change.currency && !wallet.archived));
  const dailyLimits = (scenario.dailySpendingLimits || []).filter((limit): limit is DailySpendingLimit & { amount: number; walletId: string; currency: string; startDate: string; endDate: string } => Number.isFinite(limit.amount) && limit.amount! >= 0 && !!limit.walletId && !!limit.currency && validDateKey(limit.startDate) && validDateKey(limit.endDate) && limit.startDate >= today && limit.endDate >= limit.startDate && state.wallets.some((wallet) => wallet.id === limit.walletId && wallet.currency === limit.currency && !wallet.archived));
  const walletTotals = new Map<string, number>();
  for (const wallet of activeWallets) {
    const balance = trackedBalance(state, wallet.id, today);
    walletTotals.set(wallet.id, cents(balance.amount));
  }

  const changeHorizon = [
    ...changes.map((change) => change.date),
    ...(scenario.spendingReductions || []).flatMap((item) => item.endDate && validDateKey(item.endDate) ? [item.endDate] : []),
    ...(scenario.dailySpendingLimits || []).flatMap((item) => item.endDate && validDateKey(item.endDate) ? [item.endDate] : []),
  ].reduce((latest, date) => date > latest ? date : latest, today);
  const end = validDateKey(scenario.horizonEnd) && scenario.horizonEnd >= today
    ? (scenario.horizonEnd > changeHorizon ? scenario.horizonEnd : changeHorizon)
    : changeHorizon;
  const plannedBills: ScenarioResult["plannedBills"] = [];
  const plannedByWallet = new Map<string, number>();
  for (const expense of state.fixedExpenses || []) {
    if (!expense.active) continue;
    const budget = state.goals.find((goal) => goal.id === expense.budgetId && goal.kind === "budget");
    const wallet = state.wallets.find((item) => item.id === (budget?.wallet || expense.walletId) && !item.archived);
    if (!wallet || !scopedWalletIds.has(wallet.id) || (expense.budgetId && !budget) || (budget && wallet.currency !== budget.currency)) continue;
    for (const dueDate of unpaidOccurrences(state, expense, expense.dueDate, end)) {
      plannedBills.push({ walletId: wallet.id, title: expense.title, amount: expense.amount, currency: wallet.currency, date: dueDate });
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
  for (const wallet of activeWallets) if (!trackedBalance(state, wallet.id, today).complete) unavailableEstimates.push(`Wallet ${wallet.id} has incomplete or inconsistent balance data; a reliable affordability conclusion is unavailable.`);
  const forecastCategoriesByWallet = new Map<string, Set<string>>();
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
    const history = state.transactions.filter((item) => item.wallet === wallet.id && item.type === "expense" && item.category === reduction.category && item.date.slice(0, 10) >= historyStart && item.date.slice(0, 10) < currentMonthStart && !isLinkedPayment(item));
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
    for (const wallet of activeWallets) {
      if (dailyLimitWalletIds.has(wallet.id)) continue;
      const startDate = new Date(`${today}T12:00:00`);
      startDate.setDate(1);
      startDate.setMonth(startDate.getMonth() - 3);
      const historyStart = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`;
      const excludedCategories = forecastCategoriesByWallet.get(wallet.id) || new Set<string>();
      const monthToDate = state.transactions.filter((item) => item.wallet === wallet.id && item.type === "expense" && item.date.slice(0, 10) >= currentMonthStart && item.date.slice(0, 10) <= today && !isLinkedPayment(item) && !excludedCategories.has(item.category));
      if (monthToDate.length && elapsedMonthDays >= 3 && daysToForecastEnd > 0) {
        const monthTotalCents = monthToDate.reduce((sum, item) => sum + cents(item.amount), 0);
        const dailyCents = monthTotalCents / elapsedMonthDays;
        const scale = currencyScale(wallet.currency);
        const estimateCents = cents(Math.round(dailyCents / 100 * daysToForecastEnd * scale) / scale);
        spendingEstimates.push({ walletId: wallet.id, currency: wallet.currency, amount: estimateCents / 100, dailyAverage: Math.round(dailyCents) / 100, days: daysToForecastEnd, basis: "current-month-pace" });
        walletTotals.set(wallet.id, (walletTotals.get(wallet.id) || 0) - estimateCents);
        continue;
      }
      const history = state.transactions.filter((item) => item.wallet === wallet.id && item.type === "expense" && item.date.slice(0, 10) >= historyStart && item.date.slice(0, 10) < currentMonthStart && !isLinkedPayment(item) && !excludedCategories.has(item.category));
      const activeMonths = new Set(history.map((item) => item.date.slice(0, 7)));
      if (activeMonths.size < 2) continue;
      const elapsedDays = Math.max(1, Math.round((Date.parse(`${currentMonthStart}T12:00:00`) - Date.parse(`${historyStart}T12:00:00`)) / 86_400_000));
      const dailyCents = history.reduce((sum, item) => sum + cents(item.amount), 0) / elapsedDays;
      const scale = currencyScale(wallet.currency);
      const estimateCents = cents(Math.round(dailyCents / 100 * days * scale) / scale);
      spendingEstimates.push({ walletId: wallet.id, currency: wallet.currency, amount: estimateCents / 100, dailyAverage: Math.round(dailyCents) / 100, days, basis: "historical-average" });
      walletTotals.set(wallet.id, (walletTotals.get(wallet.id) || 0) - estimateCents);
    }
    const hasCurrentPace = spendingEstimates.some((e) => e.basis === "current-month-pace");
    const hasHistoricalAvg = spendingEstimates.some((e) => e.basis === "historical-average");
    if (hasCurrentPace && !hasHistoricalAvg) {
      assumptions.push("Flexible spending uses this month's recorded daily pace. Only explicitly linked fixed payments are excluded from the pace; unpaid bills, including overdue ones, are counted separately.");
    } else if (hasHistoricalAvg && !hasCurrentPace) {
      assumptions.push("Flexible spending uses the average daily spending from the previous three complete months with at least two months of recorded history. Only explicitly linked fixed payments are excluded from the pace; unpaid bills, including overdue ones, are counted separately.");
    } else {
      assumptions.push("Flexible spending uses this month's recorded daily pace after at least three elapsed days; otherwise it falls back to the average from the previous three complete months with at least two months of history. Only explicitly linked fixed payments are excluded from the pace; unpaid scheduled occurrences, including overdue ones, are counted separately.");
    }
    if (activeWallets.some((wallet) => !dailyLimitWalletIds.has(wallet.id) && !spendingEstimates.some((estimate) => estimate.walletId === wallet.id))) {
      unavailableEstimates.push("There is not enough current-month or prior-month expense history to estimate a spending pace for at least one wallet; only the known balance, scenario changes and scheduled fixed expenses are included there.");
    }
  }

  for (const [walletId, amount] of dailyLimitByWallet) walletTotals.set(walletId, (walletTotals.get(walletId) || 0) - amount);

  for (const [walletId, amount] of plannedByWallet) walletTotals.set(walletId, (walletTotals.get(walletId) || 0) - amount);
  for (const change of changes) {
    if (!change.walletId || !walletTotals.has(change.walletId)) continue;
    const sign = change.direction === "income" ? 1 : -1;
    walletTotals.set(change.walletId, walletTotals.get(change.walletId)! + sign * cents(change.amount));
  }

  const touchedWallets = new Set([...changes.flatMap((change) => change.walletId ? [change.walletId] : []), ...(scenario.spendingReductions || []).flatMap((item) => item.walletId ? [item.walletId] : []), ...dailyLimits.map((item) => item.walletId), ...plannedByWallet.keys(), ...spendingEstimates.map((item) => item.walletId)]);
  if (scenario.walletIds || scenario.estimateSpending) activeWallets.forEach(w => touchedWallets.add(w.id));
  const wallets = [...touchedWallets].filter(id => scopedWalletIds.has(id)).map((walletId) => {
    const wallet = state.wallets.find((item) => item.id === walletId)!;
    const balanceNow = trackedBalance(state, walletId, today).amount;
    const projectedBalance = (walletTotals.get(walletId) || 0) / 100;
    const components = {
      unpaidBills: (plannedByWallet.get(walletId) || 0) / 100,
      paceSpending: spendingEstimates.filter(e => e.walletId === walletId).reduce((sum, e) => sum + cents(e.amount), 0) / 100,
      dailyLimitSpending: (dailyLimitByWallet.get(walletId) || 0) / 100,
      hypotheticalIncome: changes.filter(c => c.walletId === walletId && c.direction === "income").reduce((sum, c) => sum + cents(c.amount), 0) / 100,
      hypotheticalExpense: changes.filter(c => c.walletId === walletId && c.direction === "expense").reduce((sum, c) => sum + cents(c.amount), 0) / 100,
      reducedCategorySpending: savings.filter(s => s.walletId === walletId).reduce((sum, s) => sum + cents(s.baselineAmount) - cents(s.savedAmount), 0) / 100,
    };
    const candidateReserve = scenario.reserves?.[walletId] ?? savedReserves[walletId];
    const scale = currencyScale(wallet.currency);
    const protectedReserve = typeof candidateReserve === "number" && Number.isFinite(candidateReserve) && candidateReserve >= 0 && Number.isSafeInteger(Math.round(candidateReserve * scale)) && Math.abs(candidateReserve * scale - Math.round(candidateReserve * scale)) < 1e-5 ? candidateReserve : null;
    return { walletId, currency: wallet.currency, balanceNow, projectedBalance, shortfall: Math.max(0, -projectedBalance), protectedReserve, availableAfterReserve: protectedReserve === null ? null : (Math.round(projectedBalance * scale) - Math.round(protectedReserve * scale)) / scale, balanceComplete: trackedBalance(state, walletId, today).complete, components };
  });

  const budgets = state.goals.filter((goal) => goal.kind === "budget").flatMap((budget) => {
    const wallet = state.wallets.find((item) => item.id === budget.wallet && !item.archived);
    if (!wallet || !scopedWalletIds.has(wallet.id) || wallet.currency !== budget.currency) return [];
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
    const plannedAmountCents = (state.fixedExpenses || []).filter((item) => item.active && item.budgetId === budget.id).reduce((sum, item) => sum + unpaidOccurrences(state, item, item.dueDate, forecastEnd).length * cents(item.amount), 0);
    const budgetMonthStart = summary.start > currentMonthStart ? summary.start : currentMonthStart;
    const monthSpendCents = state.transactions.filter((item) => item.wallet === budget.wallet && item.type === "expense" && (!budget.category || item.category === budget.category) && !isLinkedPayment(item) && item.date.slice(0, 10) >= budgetMonthStart && item.date.slice(0, 10) <= today).reduce((sum, item) => sum + cents(item.amount), 0);
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
    return [{ budgetId: budget.id, title: budget.title, currency: budget.currency, actualRemaining: summary.remaining, afterScenario: Math.round(summary.remaining * 100 - scenarioSpend + savingsCents) / 100, unallocatedAfterScenario: Math.round(summary.allocationRemaining * 100 - scenarioSpend + savingsCents) / 100, projectedSpend: projectedSpendCents / 100, projectedRemaining: (cents(budget.amount) - projectedSpendCents) / 100, plannedAmount: plannedAmountCents / 100, paceAmount: paceAmountCents / 100, dailyFlexibleLimit: dailyFlexibleLimitCents / 100, forecastEnd, forecastAvailable }];
  });

  if (plannedBills.length) assumptions.push("Active fixed expenses due during the scenario period were subtracted from projected wallet balances; they remain plans, not recorded transactions.");
  assumptions.push("Each wallet is projected in its own currency. No exchange rates or cross-currency totals are assumed.");
  if (!scenario.estimateSpending) assumptions.push("Projected balances do not include unplanned future spending outside the modeled scenario changes and category reductions.");
  if (spendingEstimates.some((e) => e.basis === "historical-average") || savings.length) {
    assumptions.push("Historical projections use the previous three complete months only; actual future spending can vary and is not guaranteed.");
  }
  if (spendingEstimates.some((e) => e.basis === "current-month-pace")) {
    assumptions.push("Projected daily spending is based on your pace so far this month; actual future spending may vary.");
  }
  if (scenario.estimateSpending && budgets.some((item) => !item.forecastAvailable)) unavailableEstimates.push("A budget has no recorded flexible spending this month, so its remaining-spend pace cannot be estimated; the projection includes recorded spending and scheduled fixed expenses only.");
  if (scenario.changes.some((change) => change.direction === "expense" && !change.category) && state.goals.some((goal) => goal.kind === "budget" && !!goal.category)) assumptions.push("A scenario expense has no validated category; it was not assigned to category-specific budgets.");
  const suggestions = [
    ...(wallets.some((wallet) => wallet.shortfall > 0) ? ["Review the amount or timing, or select a same-currency wallet with enough projected funds."] : []),
    ...(budgets.some((budget) => budget.afterScenario < 0) ? ["This scenario exceeds a budget limit; consider lowering or rescheduling the expense, or review the budget separately."] : []),
  ];
  for (const limit of dailyLimits) {
    const wallet = state.wallets.find((w) => w.id === limit.walletId);
    const projection = wallets.find((w) => w.walletId === limit.walletId);
    if (wallet && projection && projection.shortfall > 0) {
      const start = limit.startDate > limitStartDate ? limit.startDate : limitStartDate;
      const finish = limit.endDate < end ? limit.endDate : end;
      const limitDays = Math.max(1, Math.round((Date.parse(`${finish}T12:00:00`) - Date.parse(`${start}T12:00:00`)) / 86_400_000) + 1);
      const plannedBillsCents = plannedByWallet.get(wallet.id) || 0;
      const initialBalanceCents = cents(trackedBalance(state, wallet.id, today).amount);
      const availableCents = initialBalanceCents - plannedBillsCents;
      if (availableCents > 0 && limitDays > 0) {
        const safeDaily = Math.floor(availableCents / limitDays / 100);
        suggestions.push(`To avoid a shortfall in ${wallet.name}, consider a daily spending limit of at most ${safeDaily} ${wallet.currency}/day.`);
      } else {
        suggestions.push(`Upcoming obligations leave no funds for flexible spending in ${wallet.name}; pause non-essential daily spending to avoid a shortfall.`);
      }
    }
  }
  if (dailyLimits.length) assumptions.push("User-specified daily spending limits replace the current-pace estimate for those wallets.");
  const confidence = dailyLimits.length ? "user-defined" : spendingEstimates.some((item) => item.basis === "current-month-pace") ? "current-pace" : spendingEstimates.length || savings.length ? "historical-estimate" : "assumption-based";
  return { scenarioId: scenario.id, wallets, budgets, plannedBills, estimatedSpending: spendingEstimates, savings, unavailableEstimates, confidence, includesPaceForecast: scenario.estimateSpending || dailyLimits.length > 0, assumptions: [...new Set(assumptions)], suggestions };
}

export function scenarioContext(state: AppState) {
  const wallets = state.wallets.filter((item) => !item.archived);
  return {
    // Gemini receives only identifiers and labels needed to resolve intent.
    // Balances, transaction rows and all financial amounts stay in the app.
    wallets: wallets.slice(0, 30).map(({ id, name, currency }) => ({ id: id.slice(0, 100), name: name.slice(0, 100), currency: currency.slice(0, 8) })),
    budgets: state.goals.filter((item) => item.kind === "budget").slice(0, 50).map(({ id, title, currency, category, wallet }) => ({ id: id.slice(0, 100), title: title.slice(0, 100), currency: currency.slice(0, 8), category: String(category || "").slice(0, 100), wallet: wallet.slice(0, 100) })),
    fixedExpenses: (state.fixedExpenses || []).filter((item) => item.active).slice(0, 60).map(({ id, budgetId, title, category, dueDate, recurrence, walletId }) => ({ id: id.slice(0, 100), budgetId: budgetId.slice(0, 100), title: title.slice(0, 100), category: String(category || "").slice(0, 100), dueDate: String(dueDate).slice(0, 10), recurrence, walletId: walletId || null })),
    goals: state.goals.filter((item) => item.kind !== "budget").slice(0, 30).map(({ id, title, kind, date, currency, wallet }) => ({ id: id.slice(0, 100), title: title.slice(0, 100), kind: kind.slice(0, 40), date: String(date).slice(0, 10), currency: currency.slice(0, 8), wallet: wallet.slice(0, 100) })),
    categories: state.categories.filter((item): item is string => typeof item === "string").slice(0, 80).map((item) => item.slice(0, 100)),
  };
}

export interface PlannerInput {
  message: string;
  today: string;
  timeZone?: string;
  preferredLanguage?: "vi" | "en" | "zh";
  selectedWalletId?: string | null;
  history?: Array<{ role: "user" | "assistant"; text: string }>;
  context: {
    wallets: Array<{ id: string; name: string; currency: string }>;
    budgets: Array<{ id: string; title: string; currency: string; category: string; wallet: string }>;
    fixedExpenses: Array<{ id: string; budgetId: string; title: string; category: string; dueDate: string; recurrence: "once" | "weekly" | "monthly" | "yearly"; walletId: string | null }>;
    goals: Array<{ id: string; title: string; kind: string; date: string; currency: string; wallet: string }>;
    categories: string[];
  };
}

export interface NormalizedPlannerResponse {
  intent: "financial_query" | "scenario" | "general_advice" | "clarification" | "unsupported";
  reply: string;
  clarification: string | null;
  query: FinancialQuery | null;
  scenarios: FinancialScenario[];
  walletChoices?: Array<{ id: string; name: string; currency: string }>;
}

export function normalizePlannerResponse(
  rawDecoded: unknown,
  input: PlannerInput
): NormalizedPlannerResponse {
  const lang = input.preferredLanguage || "vi";
  const parsedExpr = parseVietnameseFinancialExpressions(input.message, input.today, input.context);
  const activeWallets = input.context.wallets;
  const walletIds = new Set(activeWallets.map((w) => w.id));
  const selectedWallet = input.selectedWalletId && walletIds.has(input.selectedWalletId)
    ? activeWallets.find((w) => w.id === input.selectedWalletId)
    : undefined;
  const defaultWallet = selectedWallet
    || (activeWallets.length === 1 ? activeWallets[0] : undefined)
    || (parsedExpr.inferredWalletId ? activeWallets.find((w) => w.id === parsedExpr.inferredWalletId) : undefined);

  const raw = (rawDecoded && typeof rawDecoded === "object" ? rawDecoded : {}) as Record<string, unknown>;

  type IntentType = "financial_query" | "scenario" | "general_advice" | "clarification" | "unsupported";
  const intent: IntentType =
    typeof raw.intent === "string" && ["financial_query", "scenario", "general_advice", "clarification", "unsupported"].includes(raw.intent)
      ? (raw.intent as IntentType)
      : parsedExpr.intentHint || "scenario";

  let reply = typeof raw.reply === "string" ? raw.reply.trim().slice(0, 2000) : "";
  let clarification = typeof raw.clarification === "string" ? raw.clarification.trim().slice(0, 500) : null;

  if (intent === "general_advice") {
    if (!reply) {
      reply = lang === "vi"
        ? "Để quản lý tài chính hiệu quả, FinBridge khuyến nghị bạn: (1) Đặt ngân sách chi tiêu cho từng danh mục, (2) Tạo quỹ dự phòng khẩn cấp bằng ít nhất 3–6 tháng chi phí cố định, (3) Ghi nhận thu chi đều đặn để theo dõi hạn mức."
        : lang === "zh"
        ? "为有效管理个人财务，FinBridge 建议：(1) 按类别设定预算，(2) 准备至少3-6个月固定支出的紧急备用金，(3) 及时记录收支以跟踪限额。"
        : "To manage your finances effectively, FinBridge suggests: (1) Set category budgets, (2) Build an emergency reserve covering 3–6 months of fixed expenses, (3) Record spending consistently to track budget limits.";
    }
    return { intent: "general_advice", reply, clarification: null, query: null, scenarios: [] };
  }

  if (intent === "financial_query") {
    const rawQuery = (raw.query && typeof raw.query === "object" ? raw.query : {}) as Record<string, unknown>;
    const rawActions = Array.isArray(rawQuery.actions) ? (rawQuery.actions as string[]) : [];
    const validActions = ["balance", "spending_summary", "top_category", "transactions", "largest_transaction", "budget_status", "safe_daily_allowance", "upcoming_obligations", "goals", "spending_trend", "anomalies", "explain", "unknown"];

    let actions: FinancialAction[] | undefined = undefined;
    if (rawActions.length > 0) {
      actions = rawActions.filter((a): a is FinancialAction => validActions.includes(a));
    } else if (parsedExpr.actionHints.length > 1) {
      actions = parsedExpr.actionHints.filter((a): a is FinancialAction => validActions.includes(a)) as FinancialAction[];
    }

    const actionCandidate = (typeof rawQuery.action === "string" ? rawQuery.action : null)
      || (actions && actions[0])
      || parsedExpr.actionHint
      || "spending_summary";
    const action = validActions.includes(actionCandidate) ? (actionCandidate as FinancialAction) : "spending_summary";

    const requestedScope = rawQuery.scope === "all" ? "all" : rawQuery.scope === "selected" ? "selected" : null;
    const queryWalletId = typeof rawQuery.walletId === "string" && walletIds.has(rawQuery.walletId) ? rawQuery.walletId : defaultWallet?.id || null;
    const scope = requestedScope || (queryWalletId ? "selected" : "all");
    if (scope === "selected" && !queryWalletId && activeWallets.length > 1) {
      const choices = activeWallets.map((w) => `${w.name} (${w.currency})`).join(", ");
      clarification = lang === "vi" ? `Bạn muốn xem ví nào: ${choices}?` : lang === "zh" ? `您想查询哪个钱包：${choices}？` : `Which wallet should I use: ${choices}?`;
      return {
        intent: "clarification",
        reply: clarification,
        clarification,
        query: null,
        scenarios: [],
        walletChoices: activeWallets.map((w) => ({ id: w.id, name: w.name, currency: w.currency })),
      };
    }

    const relativePeriod = resolveRelativePeriod(input.message, input.today);
    const periodStart = validDateKey(rawQuery.periodStart as string)
      ? (rawQuery.periodStart as string)
      : (relativePeriod.start || parsedExpr.periodStart || null);
    const periodEnd = validDateKey(rawQuery.periodEnd as string)
      ? (rawQuery.periodEnd as string)
      : (relativePeriod.end || parsedExpr.periodEnd || null);
    const category = typeof rawQuery.category === "string" ? rawQuery.category.trim().slice(0, 100) : parsedExpr.inferredCategory;
    const searchTerm = typeof rawQuery.searchTerm === "string" ? rawQuery.searchTerm.trim().slice(0, 100) : null;
    const transactionType = rawQuery.transactionType === "expense" || rawQuery.transactionType === "income" ? rawQuery.transactionType : null;

    const query: FinancialQuery = {
      action,
      actions: actions && actions.length > 1 ? actions : undefined,
      walletId: queryWalletId,
      scope,
      periodStart,
      periodEnd,
      category,
      searchTerm,
      transactionType,
    };
    return { intent: "financial_query", reply, clarification, query, scenarios: [] };
  }

  const prevScenario = findPreviousScenarioFromHistory(input.history);
  const isFollowUp = parsedExpr.isFollowUpScenario || (!!prevScenario && (parsedExpr.isDaily || parsedExpr.detectedAmount !== null) && !parsedExpr.actionHint);

  let rawScenarios = Array.isArray(raw.scenarios) ? raw.scenarios : [];
  if (!rawScenarios.length) {
    if (isFollowUp && prevScenario) {
      const newAmount = parsedExpr.detectedAmount;
      const prevLimit = prevScenario.dailySpendingLimits?.[0];
      const prevChange = prevScenario.changes?.[0];

      if (parsedExpr.isDaily || (prevLimit && newAmount !== null && !prevChange)) {
        const horizonEnd = prevScenario.horizonEnd || getEndOfMonth(input.today);
        const updatedLimits: DailySpendingLimit[] = (prevScenario.dailySpendingLimits?.length ? prevScenario.dailySpendingLimits : [{
          amount: newAmount ?? 0,
          walletId: defaultWallet?.id || null,
          currency: defaultWallet?.currency || "VND",
          category: null,
          startDate: addDays(input.today, 1),
          endDate: horizonEnd,
        }]).map((limit) => ({
          ...limit,
          amount: newAmount ?? limit.amount,
          startDate: limit.startDate && limit.startDate >= input.today ? limit.startDate : addDays(input.today, 1),
          endDate: limit.endDate || horizonEnd,
        }));

        rawScenarios = [{
          name: lang === "vi" ? `Giới hạn chi ${(newAmount ?? prevLimit?.amount ?? 0).toLocaleString("en-US")} ₫/ngày` : `Spend ${(newAmount ?? prevLimit?.amount ?? 0)}/day`,
          dailySpendingLimits: updatedLimits,
          changes: prevScenario.changes || [],
          spendingReductions: prevScenario.spendingReductions || [],
          horizonEnd,
          estimateSpending: prevScenario.estimateSpending,
          assumptions: prevScenario.assumptions || [],
        }];
      } else if (prevChange && newAmount !== null) {
        const updatedChanges: ScenarioChange[] = prevScenario.changes.map((change, idx) => idx === 0 ? {
          ...change,
          amount: newAmount,
        } : change);
        rawScenarios = [{
          name: lang === "vi" ? `Khoản chi ${newAmount.toLocaleString("en-US")} ₫` : `Expense ${newAmount}`,
          changes: updatedChanges,
          dailySpendingLimits: prevScenario.dailySpendingLimits || [],
          spendingReductions: prevScenario.spendingReductions || [],
          horizonEnd: prevScenario.horizonEnd || getEndOfMonth(input.today),
          estimateSpending: prevScenario.estimateSpending,
          assumptions: prevScenario.assumptions || [],
        }];
      } else if (parsedExpr.detectedAmount !== null) {
        const amount = parsedExpr.detectedAmount;
        const isDaily = parsedExpr.isDaily;
        const horizonEnd = prevScenario.horizonEnd || getEndOfMonth(input.today);
        rawScenarios = [{
          name: lang === "vi" ? (isDaily ? `Giới hạn chi ${amount.toLocaleString("en-US")} ₫/ngày` : `Khoản chi ${amount.toLocaleString("en-US")} ₫`) : (isDaily ? `Spend ${amount}/day` : `Expense ${amount}`),
          actions: [{
            kind: isDaily ? "daily_limit" : "change",
            amount,
            direction: "expense",
            startDate: parsedExpr.isTomorrow ? addDays(input.today, 1) : input.today,
            endDate: horizonEnd,
            date: parsedExpr.isTomorrow ? addDays(input.today, 1) : input.today,
            walletId: prevLimit?.walletId || prevChange?.walletId || defaultWallet?.id || null,
            currency: prevLimit?.currency || prevChange?.currency || defaultWallet?.currency || "VND",
          }],
          horizonEnd,
          estimateSpending: false,
          assumptions: [],
        }];
      }
    } else if (parsedExpr.detectedAmount !== null || parsedExpr.isDaily) {
      const amount = parsedExpr.detectedAmount || 0;
      const isDaily = parsedExpr.isDaily;
      const horizonEnd = getEndOfMonth(input.today);
      rawScenarios = [{
        name: lang === "vi" ? (isDaily ? `Giới hạn chi ${amount.toLocaleString("en-US")} ₫/ngày` : `Khoản chi ${amount.toLocaleString("en-US")} ₫`) : (isDaily ? `Spend ${amount}/day` : `Expense ${amount}`),
        actions: [{
          kind: isDaily ? "daily_limit" : "change",
          amount,
          direction: "expense",
          startDate: parsedExpr.isTomorrow ? addDays(input.today, 1) : input.today,
          endDate: horizonEnd,
          date: parsedExpr.isTomorrow ? addDays(input.today, 1) : input.today,
        }],
        horizonEnd,
        estimateSpending: false,
        assumptions: [],
      }];
    }
  }

  let incompleteScenario = false;
  const scenarios: FinancialScenario[] = [];

  for (let i = 0; i < rawScenarios.length; i++) {
    const rawSc = (rawScenarios[i] && typeof rawScenarios[i] === "object" ? rawScenarios[i] : {}) as Record<string, unknown>;
    const name = typeof rawSc.name === "string" && rawSc.name.trim() ? rawSc.name.trim().slice(0, 100) : (lang === "vi" ? "Kịch bản tài chính" : "Financial scenario");
    const rawActions = Array.isArray(rawSc.actions) ? rawSc.actions : [];

    const changes: ScenarioChange[] = [];
    const spendingReductions: SpendingReduction[] = [];
    const dailySpendingLimits: DailySpendingLimit[] = [];

    const candidateActions = rawActions.length ? rawActions : [
      ...(Array.isArray(rawSc.changes) ? rawSc.changes.map((c) => ({ ...c, kind: "change" })) : []),
      ...(Array.isArray(rawSc.dailySpendingLimits) ? rawSc.dailySpendingLimits.map((d) => ({ ...d, kind: "daily_limit" })) : []),
      ...(Array.isArray(rawSc.spendingReductions) ? rawSc.spendingReductions.map((r) => ({ ...r, kind: "spending_reduction" })) : []),
    ];

    if (!candidateActions.length && !Array.isArray(rawSc.actions) && parsedExpr.detectedAmount !== null) {
      candidateActions.push({
        kind: parsedExpr.isDaily ? "daily_limit" : "change",
        amount: parsedExpr.detectedAmount,
        direction: "expense",
        startDate: parsedExpr.isTomorrow ? addDays(input.today, 1) : input.today,
        endDate: getEndOfMonth(input.today),
        date: parsedExpr.isTomorrow ? addDays(input.today, 1) : input.today,
      });
    }

    for (const act of candidateActions) {
      const a = (act && typeof act === "object" ? act : {}) as Record<string, unknown>;
      const kind = a.kind === "daily_limit" || a.kind === "spending_reduction" || a.kind === "change" ? a.kind : (parsedExpr.isDaily ? "daily_limit" : "change");

      let amountNum: number | null = null;
      if (typeof a.amount === "number" && Number.isFinite(a.amount) && a.amount >= 0) amountNum = a.amount;
      else if (typeof a.amount === "string") {
        const clean = Number(a.amount.replace(/[^\d.]/g, ""));
        if (Number.isFinite(clean) && clean >= 0) amountNum = clean;
      }
      if (amountNum === null && parsedExpr.detectedAmount !== null) amountNum = parsedExpr.detectedAmount;

      let actWalletId = typeof a.walletId === "string" && walletIds.has(a.walletId) ? a.walletId : null;
      if (!actWalletId && prevScenario) {
        const prevWalletId = prevScenario.dailySpendingLimits?.[0]?.walletId || prevScenario.changes?.[0]?.walletId;
        if (prevWalletId && walletIds.has(prevWalletId)) {
          actWalletId = prevWalletId;
        }
      }
      if (!actWalletId) actWalletId = defaultWallet?.id || null;

      if (!actWalletId && activeWallets.length > 1) {
        incompleteScenario = true;
        continue;
      }
      const wallet = activeWallets.find((w) => w.id === actWalletId) || defaultWallet;
      const currency = wallet?.currency || (typeof a.currency === "string" ? a.currency.toUpperCase() : "VND");

      if (kind === "daily_limit") {
        const startDate = validDateKey(a.startDate as string) && (a.startDate as string) >= input.today
          ? (a.startDate as string)
          : addDays(input.today, 1);
        const endDate = validDateKey(a.endDate as string) && (a.endDate as string) >= startDate
          ? (a.endDate as string)
          : (validDateKey(rawSc.horizonEnd as string) ? (rawSc.horizonEnd as string) : getEndOfMonth(input.today));
        const category = typeof a.category === "string" && input.context.categories.includes(a.category.trim()) ? a.category.trim() : null;
        dailySpendingLimits.push({
          amount: amountNum,
          walletId: wallet?.id || null,
          currency,
          category,
          startDate,
          endDate,
        });
      } else if (kind === "spending_reduction") {
        const percent = typeof a.percent === "number" && Number.isFinite(a.percent) && a.percent >= 1 && a.percent <= 100 ? a.percent : 10;
        const startDate = validDateKey(a.startDate as string) && (a.startDate as string) >= input.today ? (a.startDate as string) : input.today;
        const endDate = validDateKey(a.endDate as string) && (a.endDate as string) >= startDate ? (a.endDate as string) : getEndOfMonth(input.today);
        const category = typeof a.category === "string" ? a.category.trim() : parsedExpr.inferredCategory;
        spendingReductions.push({
          category,
          percent,
          walletId: wallet?.id || null,
          currency,
          startDate,
          endDate,
        });
      } else {
        const direction = a.direction === "income" || a.direction === "expense" ? a.direction : "expense";
        const date = validDateKey(a.date as string) && (a.date as string) >= input.today ? (a.date as string) : (parsedExpr.isTomorrow ? addDays(input.today, 1) : input.today);
        const title = typeof a.title === "string" && a.title.trim() ? a.title.trim().slice(0, 160) : name;
        const category = typeof a.category === "string" ? a.category.trim() : parsedExpr.inferredCategory;
        changes.push({
          title,
          amount: amountNum,
          direction,
          walletId: wallet?.id || null,
          currency,
          date,
          category,
        });
      }
    }

    const horizonEndCandidate = validDateKey(rawSc.horizonEnd as string) ? (rawSc.horizonEnd as string) : null;
    const allEndDates = [
      ...changes.map((c) => c.date),
      ...dailySpendingLimits.map((d) => d.endDate),
      ...spendingReductions.map((s) => s.endDate),
    ].filter(Boolean) as string[];
    const horizonEnd = horizonEndCandidate && horizonEndCandidate >= input.today
      ? horizonEndCandidate
      : allEndDates.reduce((max, d) => d > max ? d : max, prevScenario?.horizonEnd || getEndOfMonth(input.today));

    const estimateSpending = typeof rawSc.estimateSpending === "boolean" ? rawSc.estimateSpending : false;
    const assumptions = Array.isArray(rawSc.assumptions)
      ? rawSc.assumptions.filter((item): item is string => typeof item === "string").map((s) => s.slice(0, 250))
      : [];

    scenarios.push({
      id: `scenario-${Date.now()}-${i}`,
      name,
      changes,
      spendingReductions,
      dailySpendingLimits,
      horizonEnd,
      estimateSpending,
      assumptions,
    });
  }

  if (incompleteScenario) {
    const choices = activeWallets.map((w) => `${w.name} (${w.currency})`).join(", ");
    clarification = lang === "vi"
      ? `Mình cần bạn chọn ví để tính chính xác: ${choices}.`
      : lang === "zh"
      ? `请选择钱包以进行精确模拟：${choices}。`
      : `Please choose a wallet for an accurate simulation: ${choices}.`;
    return {
      intent: "clarification",
      reply: clarification,
      clarification,
      query: null,
      scenarios: [],
      walletChoices: activeWallets.map((w) => ({ id: w.id, name: w.name, currency: w.currency })),
    };
  }

  if (!reply) {
    reply = lang === "vi"
      ? (scenarios.length ? "Dưới đây là kết quả mô phỏng kịch bản tài chính của bạn:" : "Mình chưa xác định được kịch bản cần tính. Bạn nói rõ thêm nhé.")
      : lang === "zh"
      ? (scenarios.length ? "以下是您的财务情景模拟结果：" : "未能识别情景，请补充更多详情。")
      : (scenarios.length ? "Here is the projection for your financial scenario:" : "I could not identify the scenario to calculate. Please provide more details.");
  }

  return { intent: "scenario", reply, clarification, query: null, scenarios };
}
