import type { AppState, FixedExpense, Wallet } from "../components/sites/rolly/replica/store";
import { budgetSummary, currencyScale } from "../components/sites/rolly/replica/planningModel";
import { unpaidOccurrences } from "./fixed-expense-payments";
import { budgetPace, trackedBalance } from "./financial-outlook";

export type FinancialAlertPriority = "high" | "medium" | "low";
export type FinancialAlertKind = "budget-exceeded" | "budget-risk" | "cash-shortfall" | "fixed-due" | "negative-balance";
export interface FinancialAlert {
  id: string;
  kind: FinancialAlertKind;
  problem: string;
  figures: string;
  when: string;
  cause: string;
  priority: FinancialAlertPriority;
  suggestedAction: string;
  assumptions: string;
  walletId: string;
  currency: string;
  amount: number;
  projected: boolean;
  targetType: "budget" | "fixed-expense" | "wallet";
  targetId: string;
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86_400_000);
const addDays = (value: string, count: number) => {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + count);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
function formatMoney(amount: number, currency: string, _language?: string) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: new Intl.NumberFormat("en-US", { style: "currency", currency }).resolvedOptions().maximumFractionDigits }).format(amount)} ${currency}`;
}
function validAmount(amount: number) { return Number.isFinite(amount) && amount >= 0; }
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` === value;
}
function walletName(wallet: Wallet, language: string) { return wallet.name === "." ? (/中文|zh/i.test(language) ? "主钱包" : /Tiếng Việt|vi/i.test(language) ? "Ví chính" : "Main wallet") : wallet.name; }
function expenseWallet(state: AppState, expense: FixedExpense) {
  const budget = state.goals.find((goal) => goal.kind === "budget" && goal.id === expense.budgetId);
  const wallet = state.wallets.find((item) => item.id === (budget?.wallet || expense.walletId) && !item.archived);
  if (!wallet || (expense.budgetId && !budget) || (budget && budget.currency !== wallet.currency)) return null;
  return { budget, wallet };
}
/** Create evidence-based feed items. All comparisons and amounts are computed locally. */
export function detectProactiveAlerts(state: AppState, asOf: string, dismissedIds: readonly string[] = [], includeHandled = false): FinancialAlert[] {
  const dismissed = new Set(dismissedIds), alerts: FinancialAlert[] = [];
  const activeWallets = state.wallets.filter((wallet) => !wallet.archived);
  const language = String(state.settings.language || "English");
  const locale = /中文|zh/i.test(language) ? "zh-CN" : /English|en/i.test(language) ? "en-US" : "vi-VN";
  const add = (alert: FinancialAlert) => {
    const zh = /中文|zh/i.test(language), vi = /Tiếng Việt|vi/i.test(language);
    if (!vi) alert = localizeAlert(alert, state, asOf, zh ? "zh" : "en");
    if (includeHandled || !dismissed.has(alert.id)) alerts.push(alert);
  };

  for (const budget of state.goals.filter((goal) => goal.kind === "budget")) {
    const wallet = activeWallets.find((item) => item.id === budget.wallet);
    if (!wallet || wallet.currency !== budget.currency || !Number.isFinite(budget.amount) || budget.amount <= 0) continue;
    const summary = budgetSummary(state, budget, asOf);
    const invalidRecordedAmount = state.transactions.some((item) => item.type === "expense" && item.wallet === wallet.id
      && (!budget.category || item.category === budget.category)
      && (!validDate(item.date.slice(0, 10)) || (item.date.slice(0, 10) >= summary.start && item.date.slice(0, 10) <= asOf && !validAmount(item.amount))));
    if (invalidRecordedAmount) continue;
    const spent = state.transactions.filter((item) => item.type === "expense" && item.wallet === wallet.id
      && (!budget.category || item.category === budget.category) && item.date.slice(0, 10) >= summary.start
      && item.date.slice(0, 10) <= asOf && item.date.slice(0, 10) <= summary.end && validAmount(item.amount))
      .reduce((sum, item) => sum + Math.round(item.amount * currencyScale(wallet.currency)), 0) / currencyScale(wallet.currency);
    const window = `${summary.start}:${summary.end}`;
    const base = { walletId: wallet.id, currency: wallet.currency, walletName: walletName(wallet, language), amount: spent - budget.amount };
    if (spent > budget.amount) {
      add({ id: `budget-exceeded:${budget.id}:${window}`, kind: "budget-exceeded", problem: `Ngân sách “${budget.title}” đã vượt hạn mức.`,
        figures: `Đã chi ${formatMoney(spent, wallet.currency, language)} / ${formatMoney(budget.amount, wallet.currency, language)} · vượt ${formatMoney(spent - budget.amount, wallet.currency, language)}.`,
        when: `Chu kỳ ${summary.start} – ${summary.end}`, cause: `Giao dịch đã ghi nhận trong danh mục ${budget.category || "mọi danh mục"}.`, priority: "high",
        suggestedAction: "Rà soát các khoản chi còn lại trong kỳ và điều chỉnh ngân sách nếu hạn mức đã thay đổi.", assumptions: "Chi tiêu đã ghi nhận; không phải dự báo.", walletId: base.walletId, currency: base.currency, amount: base.amount, projected: false, targetType: "budget", targetId: budget.id });
      continue;
    }
    const pace = budgetPace(state, budget, asOf);
    const validExpenses = state.transactions.filter((item) => item.type === "expense" && item.wallet === wallet.id
      && (!budget.category || item.category === budget.category) && item.date.slice(0, 10) >= pace.start && item.date.slice(0, 10) <= asOf
      && validAmount(item.amount));
    if (daysBetween(pace.start, asOf) >= 2 && validExpenses.length && pace.remainingDays > 0 && pace.projected > budget.amount) {
      const projectedExcess = pace.projected - budget.amount;
      add({ id: `budget-risk:${budget.id}:${window}`, kind: "budget-risk", problem: `Ngân sách “${budget.title}” có nguy cơ vượt hạn mức.`,
        figures: `Đã chi ${formatMoney(spent, wallet.currency, language)} / ${formatMoney(budget.amount, wallet.currency, language)} · dự báo cuối kỳ ${formatMoney(pace.projected, wallet.currency, language)}.`,
        when: `Dự báo đến ${summary.end}`, cause: `Nếu tiếp tục giữ nhịp chi hiện tại, có thể vượt khoảng ${formatMoney(projectedExcess, wallet.currency, language)}.`,
        priority: projectedExcess >= budget.amount * 0.2 ? "high" : "medium", suggestedAction: "Giảm chi linh hoạt trong danh mục này hoặc xem lại hạn mức.",
        assumptions: "Dự báo tuyến tính từ chi tiêu hợp lệ đã ghi nhận trong chu kỳ; không gồm thu nhập hay khoản chi chưa lưu.",
        walletId: base.walletId, currency: base.currency, amount: projectedExcess, projected: true, targetType: "budget", targetId: budget.id });
    }
  }

  const horizon = addDays(asOf, 30);
  const dueByWallet = new Map<string, Array<{ expense: FixedExpense; wallet: Wallet; due: string }>>();
  for (const expense of (state.fixedExpenses || []).filter((item) => item.active && validAmount(item.amount))) {
    const resolved = expenseWallet(state, expense);
    if (!resolved) continue;
    const occurrences = unpaidOccurrences(state, expense, expense.dueDate, horizon);
    for (const due of occurrences) {
      const entries = dueByWallet.get(resolved.wallet.id) || [];
      entries.push({ expense, wallet: resolved.wallet, due });
      dueByWallet.set(resolved.wallet.id, entries);
    }
  }

  const shortfallDueIds = new Set<string>();
  for (const wallet of activeWallets) {
    const balance = trackedBalance(state, wallet.id, asOf);
    if (!balance.complete) continue;
    if (balance.amount < 0) {
      add({ id: `negative-balance:${wallet.id}:${asOf}`, kind: "negative-balance", problem: `Số dư ví ${walletName(wallet, language)} đang âm.`,
        figures: `Số dư tính đến ${asOf}: ${formatMoney(balance.amount, wallet.currency, language)}.`, when: asOf,
        cause: "Số dư ban đầu và các giao dịch đã lưu đến ngày này cho kết quả âm.", priority: "high",
        suggestedAction: "Rà soát giao dịch gần đây và các khoản cần thanh toán; cập nhật giao dịch nếu có sai sót.",
        assumptions: "Số dư thực tính từ dữ liệu đã lưu; không gồm giao dịch tương lai.", walletId: wallet.id, currency: wallet.currency, amount: Math.abs(balance.amount), projected: false, targetType: "wallet", targetId: wallet.id });
      continue;
    }
    const due = (dueByWallet.get(wallet.id) || []).sort((a, b) => a.due.localeCompare(b.due));
    const scale = currencyScale(wallet.currency);
    let remaining = Math.round(balance.amount * scale), shortfall = 0;
    const crossing: typeof due = [];
    for (const item of due) {
      remaining -= Math.round(item.expense.amount * scale);
      crossing.push(item);
      if (remaining < 0) { shortfall = -remaining / scale; break; }
    }
    if (shortfall > 0 && crossing.length) {
      crossing.forEach((item) => shortfallDueIds.add(`${item.expense.id}:${item.due}`));
      add({ id: `cash-shortfall:${wallet.id}:${crossing.at(-1)?.due}:${crossing.map((item) => item.expense.id).join(",")}`,
        kind: "cash-shortfall", problem: `Số dư ví ${walletName(wallet, language)} có thể không đủ cho các khoản cố định sắp tới.`,
        figures: `Số dư hiện tại ${formatMoney(balance.amount, wallet.currency, language)} · thiếu dự kiến ${formatMoney(shortfall, wallet.currency, language)} sau khoản đến hạn ${crossing.at(-1)?.due}.`,
        when: crossing.at(-1)?.due || asOf, cause: crossing.map((item) => {
          const date = new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(new Date(item.due + "T12:00:00Z"));
          const status = item.due < asOf ? (locale === "en-US" ? "overdue, not recorded as paid" : locale === "zh-CN" ? "已逾期，尚未记录付款" : "quá hạn, chưa ghi nhận đã trả") : (locale === "en-US" ? "upcoming, not recorded as paid" : locale === "zh-CN" ? "即将到期，尚未记录付款" : "sắp đến hạn, chưa ghi nhận đã trả");
          return `${item.expense.title} · ${date} · ${formatMoney(item.expense.amount, wallet.currency, language)} · ${status}`;
        }).join("\n"),
        priority: "high", suggestedAction: "Kiểm tra các khoản đến hạn, cân nhắc dời khoản chưa bắt buộc hoặc bổ sung tiền vào ví.",
        assumptions: "Dự báo gồm khoản quá hạn chưa trả và các chi phí cố định trong 30 ngày tới; giả định không có thu nhập hoặc giao dịch khác.",
        walletId: wallet.id, currency: wallet.currency, amount: shortfall, projected: true, targetType: "fixed-expense", targetId: crossing.at(-1)?.expense.id || "" });
    }
  }

  for (const items of dueByWallet.values()) {
    for (const { expense, wallet, due } of items) {
      const days = daysBetween(asOf, due), reminderDays = expense.reminderDays ?? 3;
      if (days > reminderDays || shortfallDueIds.has(`${expense.id}:${due}`)) continue;
      add({ id: `fixed-due:${expense.id}:${due}`, kind: "fixed-due", problem: days < 0 ? `Khoản cố định “${expense.title}” đã quá hạn.` : `Khoản cố định “${expense.title}” sắp đến hạn.`,
        figures: `${formatMoney(expense.amount, wallet.currency, language)} · ví ${walletName(wallet, language)} · ${days < 0 ? `quá hạn ${-days} ngày` : `còn ${days} ngày`}.`, when: due,
        cause: `Lịch ${expense.recurrence} đã lưu cho khoản này.`, priority: days <= 1 ? "high" : "medium",
        suggestedAction: "Kiểm tra số dư ví và đánh dấu khoản này đã thanh toán trong dữ liệu sau khi trả.",
        assumptions: "Đây là lịch dự kiến, chưa xác nhận thanh toán.", walletId: wallet.id, currency: wallet.currency, amount: expense.amount, projected: false, targetType: "fixed-expense", targetId: expense.id });
    }
  }
  const unique = new Map<string, FinancialAlert>();
  for (const alert of alerts) unique.set(alert.id, alert);
  const rank: Record<FinancialAlertPriority, number> = { high: 0, medium: 1, low: 2 };
  return [...unique.values()].sort((a, b) => rank[a.priority] - rank[b.priority] || a.when.localeCompare(b.when));
}

function localizeAlert(alert: FinancialAlert, state: AppState, asOf: string, lang: "en" | "zh"): FinancialAlert {
  const say = (en: string, zh: string) => lang === "zh" ? zh : en;
  const money = (value: number) => formatMoney(value, alert.currency, lang);
  const wallet = state.wallets.find(w => w.id === alert.walletId);
  const name = !wallet || wallet.name === "." ? say("Main wallet", "主钱包") : wallet.name;
  const budget = state.goals.find(g => g.id === alert.targetId);
  const bill = state.fixedExpenses?.find(e => e.id === alert.targetId);
  const common = { ...alert };
  if ((alert.kind === "budget-exceeded" || alert.kind === "budget-risk") && budget) {
    const summary = budgetSummary(state, budget, asOf), pace = budgetPace(state, budget, asOf);
    const over = alert.kind === "budget-exceeded";
    return { ...common,
      problem: over ? say(`Budget “${budget.title}” is over its limit.`, `预算“${budget.title}”已超出限额。`) : say(`Budget “${budget.title}” may exceed its limit.`, `预算“${budget.title}”可能超出限额。`),
      figures: say(`Spent ${money(summary.actual)} / ${money(budget.amount)}`, `已支出 ${money(summary.actual)} / ${money(budget.amount)}`) + (over ? say(` · over by ${money(alert.amount)}.`, ` · 超出 ${money(alert.amount)}。`) : say(` · estimated period total ${money(pace.projected)}.`, ` · 预计期末支出 ${money(pace.projected)}。`)),
      when: say(`Period ${summary.start} – ${summary.end}`, `周期 ${summary.start} – ${summary.end}`),
      cause: over ? say(`Recorded expenses in ${budget.category || "all categories"}.`, `${budget.category || "所有类别"}的已记录支出。`) : say(`At the current spending pace, the limit may be exceeded by ${money(alert.amount)}.`, `按当前支出速度，可能超出 ${money(alert.amount)}。`),
      suggestedAction: say("Review remaining expenses and the budget limit; reduce optional spending if needed.", "检查剩余支出及预算限额，必要时减少非必要支出。"),
      assumptions: over ? say("Based on recorded expenses; this is not a forecast.", "根据已记录支出计算，并非预测。") : say("Linear estimate after at least three days in this period; excludes income and unrecorded bills.", "周期开始至少三天后，按已记录支出线性估算；不含收入或未记录账单。"),
    };
  }
  if (alert.kind === "negative-balance") return { ...common,
    problem: say(`Wallet ${name} has a negative balance.`, `钱包 ${name} 余额为负。`),
    figures: say(`Balance as of ${asOf}: ${money(-alert.amount)}.`, `截至 ${asOf} 的余额：${money(-alert.amount)}。`),
    cause: say("The opening balance and recorded transactions result in a negative balance.", "初始余额与已记录交易的计算结果为负。"),
    suggestedAction: say("Review recent transactions and upcoming payments; correct recording errors.", "检查近期交易和待付款项，如记录有误请修正。"),
    assumptions: say("Calculated from recorded data; excludes future transactions.", "根据已记录数据计算，不含未来交易。"),
  };
  if (alert.kind === "cash-shortfall") return { ...common,
    problem: say(`Wallet ${name} may not cover its unpaid fixed expenses.`, `钱包 ${name} 余额可能不足以支付未付固定支出。`),
    figures: say(`Current balance ${money(trackedBalance(state, alert.walletId, asOf).amount)} · estimated shortfall ${money(alert.amount)} after the bill due ${alert.when}.`, `当前余额 ${money(trackedBalance(state, alert.walletId, asOf).amount)} · 支付 ${alert.when} 到期账单后预计短缺 ${money(alert.amount)}。`),
    suggestedAction: say("Review due bills, defer optional spending or add funds to the wallet.", "查看到期账单，考虑延后非必要支出或补充钱包余额。"),
    assumptions: say("Includes unpaid overdue bills and scheduled bills in the next 30 days; assumes no other income or transactions.", "包含未付逾期账单及未来30天的固定支出，假设没有其他收入或交易。"),
  };
  if (alert.kind === "fixed-due" && bill) {
    const days = daysBetween(asOf, alert.when);
    return { ...common,
      problem: days < 0 ? say(`Fixed expense “${bill.title}” is overdue.`, `固定支出“${bill.title}”已逾期。`) : say(`Fixed expense “${bill.title}” is due ${alert.when}.`, `固定支出“${bill.title}”于 ${alert.when} 到期。`),
      figures: `${money(alert.amount)} · ${name} · ${days < 0 ? say(`${-days} days overdue`, `已逾期 ${-days} 天`) : say(`${days} days remaining`, `剩余 ${days} 天`)}`,
      cause: say("This bill has an unpaid occurrence in its saved schedule.", "此账单的已保存计划中有一笔未付费用。"),
      suggestedAction: say("After paying, use Mark as paid or link the recorded expense.", "付款后使用“已支付”或关联已有支出。"),
      assumptions: say("This is a planned bill; payment has not been confirmed.", "这是计划账单，付款尚未确认。"),
    };
  }
  return common;
}

export function readDismissedAlertIds(value: unknown): string[] {
  try {
    const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(-300) : [];
  } catch { return []; }
}
