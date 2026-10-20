import type { AppState } from "../components/finbridge/workspace/store";
import { budgetSummary, currencyScale, occurrencePayment, plannedOccurrences } from "../components/finbridge/workspace/planningModel";
import { trackedBalance } from "./financial-outlook";
import { balanceAfterObligation } from "./financial-obligation-query";
import type { AnswerPresentation } from "./assistant-response";
import { unpaidOccurrences } from "./fixed-expense-payments";

const normalizeVietnameseMessage = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi").replace(/đ/g, "d").trim();
export function asksForAllWalletBalances(message: string): boolean {
  const text = normalizeVietnameseMessage(message);
  return /\b(?:tat ca|cac|moi) (?:vi|tai khoan)\b/.test(text)
    || /\b(?:all|every) (?:my )?(?:wallets|accounts)\b/.test(text)
    || /\bacross (?:all )?(?:wallets|accounts)\b/.test(text);
}
type Language = "vi" | "en" | "zh";
const copy: Record<Language, { conclusion: string; figures: string; analysis: string; suggestions: string; limits: string; noWallet: string; noTransactions: string; noBudgets: string; assumptions: string; balanceConclusion: string; income: string; expense: string; transferOut: string; transferIn: string; incomplete: string; malformed: string; period: string; wallet: string; summary: (range: string) => string; totalIncome: string; totalExpense: string; noBudgetSuggestion: string; budgetConclusion: string; budgetLimit: string; spent: string; fixed: string; afterFixed: string; over: string; upcoming: string; extraFixed: string; budgetAnalysis: string }> = {
  vi: { conclusion: "Kết luận", figures: "Số liệu liên quan", analysis: "Phân tích", suggestions: "Đề xuất", limits: "Giả định/giới hạn", noWallet: "Chưa có ví đang hoạt động để tính.", noTransactions: "Chưa có giao dịch phù hợp trong khoảng thời gian này.", noBudgets: "Chưa thấy ngân sách phù hợp trong ví đã chọn.", assumptions: "Tính từ dữ liệu đã lưu trong FinBridge; các ví được tính riêng theo tiền tệ, không quy đổi.", balanceConclusion: "Số dư được tính từ số dư ban đầu và giao dịch đã lưu.", income: "Thu", expense: "Chi", transferOut: "Chuyển đi", transferIn: "Chuyển đến", incomplete: "Chuyển khoản khác tiền tệ thiếu số tiền nhận; số dư chưa đầy đủ", malformed: "Bỏ qua giao dịch sai số tiền", period: "Kỳ", wallet: "Ví", summary: (range) => `Tổng hợp thu chi ${range} theo dữ liệu đã ghi nhận.`, totalIncome: "thu", totalExpense: "chi", noBudgetSuggestion: "Tạo ngân sách trong trang Kế hoạch để theo dõi hạn mức và khoản cố định.", budgetConclusion: "Tình hình ngân sách và khoản cố định theo chu kỳ hiện tại.", budgetLimit: "Hạn mức", spent: "Đã chi", fixed: "Chi cố định dự kiến", afterFixed: "Còn sau khoản cố định", over: "Có thể vượt hạn mức", upcoming: "Sắp đến hạn", extraFixed: "Khoản cố định 30 ngày tới chưa gắn ngân sách", budgetAnalysis: "Hạn mức ngân sách không phải số dư ví. Chi cố định được trình bày riêng với khoản đã chi." },
  en: { conclusion: "Conclusion", figures: "Relevant figures", analysis: "Analysis", suggestions: "Suggestions", limits: "Assumptions/limits", noWallet: "There is no active wallet to calculate.", noTransactions: "There are no matching transactions in this period.", noBudgets: "No matching budget was found for the selected wallet.", assumptions: "Calculated from saved FinBridge data. Wallets stay separate by currency; no conversion is applied.", balanceConclusion: "Balance uses the wallet's opening balance and saved transactions.", income: "Income", expense: "Spending", transferOut: "Transferred out", transferIn: "Transferred in", incomplete: "A cross-currency transfer has no destination amount; this balance is incomplete", malformed: "Skipped invalid-amount transactions", period: "Period", wallet: "Wallet", summary: (range) => `Recorded income and spending for ${range}.`, totalIncome: "income", totalExpense: "spending", noBudgetSuggestion: "Create a budget in Planning to track limits and fixed expenses.", budgetConclusion: "Current-cycle budget and fixed-expense status.", budgetLimit: "Limit", spent: "Spent", fixed: "Planned fixed expenses", afterFixed: "Remaining after fixed expenses", over: "May exceed the limit", upcoming: "Due soon", extraFixed: "Fixed expenses due in the next 30 days without a budget", budgetAnalysis: "A budget limit is not a wallet balance. Fixed expenses are shown separately from recorded spending." },
  zh: { conclusion: "结论", figures: "相关数据", analysis: "分析", suggestions: "建议", limits: "假设/限制", noWallet: "没有可用于计算的活跃钱包。", noTransactions: "此时间段没有符合条件的交易。", noBudgets: "所选钱包没有符合条件的预算。", assumptions: "根据 FinBridge 已保存的数据计算；不同币种的钱包分别计算，不进行换算。", balanceConclusion: "余额根据钱包初始余额和已保存交易计算。", income: "收入", expense: "支出", transferOut: "转出", transferIn: "转入", incomplete: "跨币种转账缺少收款金额；此余额不完整", malformed: "已跳过金额无效的交易", period: "期间", wallet: "钱包", summary: (range) => `${range}的已记录收入与支出。`, totalIncome: "收入", totalExpense: "支出", noBudgetSuggestion: "请在计划页面创建预算以跟踪限额和固定支出。", budgetConclusion: "当前周期的预算和固定支出情况。", budgetLimit: "限额", spent: "已支出", fixed: "预计固定支出", afterFixed: "扣除固定支出后剩余", over: "可能超出限额", upcoming: "即将到期", extraFixed: "未来30天内未关联预算的固定支出", budgetAnalysis: "预算限额不等于钱包余额。固定支出与已记录支出分开显示。" },
};
export type FinancialState = Pick<AppState, "wallets" | "transactions" | "goals" | "fixedExpenses" | "settings">;
export type FinancialAction = "balance" | "balance_after_obligation" | "spending_summary" | "category_breakdown" | "top_category" | "category_savings" | "transactions" | "largest_transaction" | "budget_status" | "safe_daily_allowance" | "upcoming_obligations" | "goals" | "spending_trend" | "anomalies" | "explain" | "unknown";
export interface FinancialQuery {
  action: FinancialAction;
  actions?: FinancialAction[];
  walletId: string | null;
  scope: "selected" | "all";
  periodStart: string | null;
  periodEnd: string | null;
  category: string | null;
  searchTerm: string | null;
  transactionType: "expense" | "income" | null;
  percentage?: number | null;
}
export interface FinancialHighlight { label: string; amount: number; currency: string; tone?: "positive" | "warning" | "neutral"; }

/** Repair a specific, explicit breakdown request without copying the previous
 * action. Other financial intents remain the structured model's responsibility. */
export function resolveFinancialFollowup(message: string, query: FinancialQuery, history: Array<{ role: string; text: string }> = []): FinancialQuery {
  const text = normalizeVietnameseMessage(message);
  const latestContext = [...history].reverse().find(item => item.role === "assistant" && item.text.startsWith("Previous financial result context"));
  const priorWallet = latestContext?.text.match(/; walletId=("(?:[^"\\]|\\.)*"); scope=selected/);
  if (!query.walletId && !asksForAllWalletBalances(message) && priorWallet) {
    try {
      const walletId: unknown = JSON.parse(priorWallet[1]);
      if (typeof walletId === "string") query = { ...query, walletId, scope: "selected" };
    } catch { /* Older/incomplete history: retain the model's explicit scope. */ }
  }
  // Conditional payments must not return an unchanged actual balance.
  const afterPayment = /(?:sau khi|neu|after|if|付完|如果).*(?:dong|tra|thanh toan|pay|paid|payment|支付|付)|(?:支付|付).*(?:后|以后)/.test(text);
  if (afterPayment && query.action === "balance" && (!query.actions?.length || query.actions.every(action => action === "balance"))) {
    return { ...query, action: "balance_after_obligation", actions: ["balance_after_obligation"] };
  }
  const breakdown = /\b(?:chi(?: tieu)? (?:cho|vao|theo) (?:nhung |cac )?(?:danh )?muc (?:gi|nao)|chi (?:cho )?(?:nhung |cac )?danh muc nao|chi gom (?:nhung |cac )?(?:cai|muc) gi|danh muc (?:da chi|chi tieu)|spending (?:by|breakdown)|(?:which|what) categories|where did my money go)\b|支出类别|按类别/.test(text);
  if (!breakdown || !["spending_summary", "category_breakdown", "top_category", "explain", "unknown"].includes(query.action)) return query;
  if (query.actions && new Set(query.actions).size > 1) return query;
  // Only inherit an omitted period on a contextual question, never replace an
  // explicit model-parsed date range or use prior calculated monetary values.
  const context = [...history].reverse().find(item => item.role === "assistant" && item.text.startsWith("Previous financial result context"));
  const changesPeriod = /\b(?:thang|tuan|hom|ngay|month|week|today|yesterday|between|since)\b|\d{1,4}[/-]\d{1,2}|本月|上月|今天|本周/.test(text);
  const period = !changesPeriod ? context?.text.match(/period=(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})/) : null;
  return { ...query, action: "category_breakdown", actions: ["category_breakdown"], category: null, searchTerm: null, transactionType: "expense",
    periodStart: query.periodStart || period?.[1] || null, periodEnd: query.periodEnd || period?.[2] || null };
}

interface QuerySectionResult {
  conclusion: string;
  figures?: string;
  analysis?: string;
  suggestions?: string;
  limits?: string;
}

function singleActionHighlights(query: FinancialQuery, state: FinancialState, selectedWalletId: string, today: string): FinancialHighlight[] {
  const activeWallets = state.wallets.filter((wallet) => !wallet.archived);
  const selected = activeWallets.find((wallet) => wallet.id === (query.walletId || selectedWalletId));
  const wallets = query.scope === "all" ? activeWallets : selected ? [selected] : [];
  if (!wallets.length) return [];
  const lang = getLanguage(state);

  if (query.action === "balance") return wallets.flatMap((wallet) => {
    const result = trackedBalance(state, wallet.id, today);
    return Number.isFinite(result.amount) ? [{ label: walletName(wallet.name, lang), amount: result.amount, currency: wallet.currency, tone: result.amount < 0 ? "warning" as const : "neutral" as const }] : [];
  });

  const start = query.periodStart && /^\d{4}-\d{2}-\d{2}$/.test(query.periodStart) ? query.periodStart : `${today.slice(0, 7)}-01`;
  const rawEnd = query.periodEnd && /^\d{4}-\d{2}-\d{2}$/.test(query.periodEnd) ? query.periodEnd : today;
  const end = query.action === "upcoming_obligations" ? rawEnd : (rawEnd > today ? today : rawEnd);

  if (query.action === "spending_summary") return wallets.flatMap((wallet) => {
    const own = state.transactions.filter((item) => item.wallet === wallet.id && item.date.slice(0, 10) >= start && item.date.slice(0, 10) <= end && item.type !== "transfer" && validAmount(item.amount));
    if (!own.length) return [];
    const sum = (type: "income" | "expense") => total(own.filter((item) => item.type === type), wallet.currency);
    return [
      { label: walletName(wallet.name, lang) + " · " + (lang === "vi" ? "Thu" : lang === "zh" ? "收入" : "Income"), amount: sum("income"), currency: wallet.currency, tone: "positive" as const },
      { label: walletName(wallet.name, lang) + " · " + (lang === "vi" ? "Chi" : lang === "zh" ? "支出" : "Spending"), amount: sum("expense"), currency: wallet.currency, tone: "warning" as const },
    ];
  });

  if (query.action === "top_category" || query.action === "explain") {
    const walletIds = new Set(wallets.map((w) => w.id));
    const relevant = state.transactions.filter((item) => item.date.slice(0, 10) >= start && item.date.slice(0, 10) <= end && walletIds.has(item.wallet) && item.type === "expense" && validAmount(item.amount));
    const catMap = new Map<string, { category: string; amount: number; currency: string }>();
    for (const item of relevant) {
      const wallet = wallets.find((w) => w.id === item.wallet);
      const curr = wallet?.currency || "VND";
      const cat = item.category || (lang === "vi" ? "Chưa phân loại" : "Uncategorized");
      const key = `${curr}:${cat}`;
      const existing = catMap.get(key) || { category: cat, amount: 0, currency: curr };
      existing.amount += item.amount;
      catMap.set(key, existing);
    }
    const top = [...catMap.values()].sort((a, b) => b.amount - a.amount)[0];
    if (top) {
      return [{
        label: (lang === "vi" ? "Khoản chi lớn nhất" : lang === "zh" ? "最大支出项" : "Top spending") + ": " + top.category,
        amount: top.amount,
        currency: top.currency,
        tone: "warning" as const,
      }];
    }
    return [];
  }

  if (query.action === "anomalies") {
    const walletIds = new Set(wallets.map((w) => w.id));
    const relevant = state.transactions.filter((item) => item.date.slice(0, 10) >= start && item.date.slice(0, 10) <= end && walletIds.has(item.wallet) && item.type === "expense" && validAmount(item.amount));
    const flagged = relevant.flatMap((item) => {
      const historyStart = addDays(start, -90);
      const prior = state.transactions.filter((other) => other.type === "expense" && other.wallet === item.wallet && other.category === item.category && validAmount(other.amount) && other.date.slice(0, 10) >= historyStart && other.date.slice(0, 10) < start).map((other) => other.amount).sort((a, b) => a - b);
      if (prior.length < 5) return [];
      const middle = Math.floor(prior.length / 2);
      const median = prior.length % 2 ? prior[middle] : (prior[middle - 1] + prior[middle]) / 2;
      const wallet = wallets.find((w) => w.id === item.wallet);
      return median > 0 && item.amount >= median * 3 && wallet ? [{ item, wallet }] : [];
    });
    return flagged.slice(0, 2).map(({ item, wallet }) => ({
      label: (lang === "vi" ? "Bất thường" : "Anomaly") + ": " + item.title,
      amount: item.amount,
      currency: wallet.currency,
      tone: "warning" as const,
    }));
  }

  if (query.action === "budget_status") return state.goals.filter((goal) => goal.kind === "budget" && wallets.some((wallet) => wallet.id === goal.wallet && wallet.currency === goal.currency)).map((budget) => {
    const summary = budgetSummary(state, budget, today);
    return { label: budget.title + " · " + (lang === "vi" ? "Còn hạn mức" : lang === "zh" ? "预算剩余" : "Budget remaining"), amount: summary.afterCommitments, currency: budget.currency, tone: summary.afterCommitments < 0 ? "warning" : "positive" };
  });

  if (query.action === "safe_daily_allowance") return state.goals.filter((goal) => goal.kind === "budget" && wallets.some((wallet) => wallet.id === goal.wallet && wallet.currency === goal.currency) && (!query.category || normalizeVietnameseMessage(goal.category || goal.title).includes(normalizeVietnameseMessage(query.category)))).flatMap((budget) => {
    const summary = budgetSummary(state, budget, today);
    const daysLeft = Math.max(0, Math.floor((Date.parse(summary.end + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 86400000) + 1);
    if (!daysLeft || !summary.matchingCurrency) return [];
    const scale = currencyScale(budget.currency);
    const allowance = Math.floor(Math.max(0, summary.afterCommitments) * scale / daysLeft) / scale;
    return [{ label: budget.title + " · " + (lang === "vi" ? "Mỗi ngày còn lại" : lang === "zh" ? "每日可用" : "Daily allowance"), amount: allowance, currency: budget.currency, tone: allowance > 0 ? "positive" as const : "warning" as const }];
  });

  return [];
}

// Compact figures shown above the prose answer. They are calculated only from
// the same local application state used by answerFinancialQuery.
export function financialQueryHighlights(query: FinancialQuery, state: FinancialState, selectedWalletId: string, today: string): FinancialHighlight[] {
  const actions = query.actions && query.actions.length > 0 ? query.actions : [query.action];
  const results: FinancialHighlight[] = [];
  for (const act of actions) {
    const items = singleActionHighlights({ ...query, action: act }, state, selectedWalletId, today);
    results.push(...items);
  }
  return results;
}

function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + amount);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
function periodLabel(start: string, end: string, lang: Language) { return start === end ? start : `${start} ${lang === "vi" ? "đến" : lang === "zh" ? "至" : "to"} ${end}`; }
function render(lang: Language, sections: Partial<Record<"conclusion" | "figures" | "analysis" | "suggestions" | "limits", string>>, presentation?: AnswerPresentation) {
  const labels = copy[lang];
  const lines = [sections.conclusion];
  const headings = presentation?.detail === "detailed" || presentation?.layout === "comparison";
  if (sections.figures) lines.push(headings ? `${labels.figures}:\n${sections.figures}` : sections.figures);
  if (sections.analysis) lines.push(headings ? `${labels.analysis}: ${sections.analysis}` : sections.analysis);
  if (sections.suggestions) lines.push(headings ? `${labels.suggestions}: ${sections.suggestions}` : sections.suggestions);
  if (sections.limits && sections.limits !== labels.assumptions) lines.push(sections.limits);
  return lines.filter(Boolean).join("\n\n");
}
function getLanguage(state: FinancialState): Language {
  const value = String(state.settings?.language || "");
  return /中文|zh/i.test(value) ? "zh" : /English|en/i.test(value) ? "en" : "vi";
}
function localized(lang: Language, vi: string, en: string, zh: string) { return lang === "vi" ? vi : lang === "zh" ? zh : en; }
function validAmount(amount: number) { return Number.isFinite(amount) && amount >= 0; }
function total(items: Array<{ amount: number }>, currency = "USD") { const scale = currencyScale(currency); return items.reduce((sum, item) => sum + Math.round(item.amount * scale), 0) / scale; }
function walletName(name: string, lang: Language) { return name === "." ? ({ vi: "Ví chính", en: "Main wallet", zh: "主钱包" }[lang]) : name; }

function answerFinancialQuerySection(
  action: FinancialAction,
  query: FinancialQuery,
  wallets: Array<{ id: string; name: string; currency: string; initial: number }>,
  state: FinancialState,
  today: string,
  lang: Language
): QuerySectionResult {
  const labels = copy[lang];
  const money = (amount: number, currency: string) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: Math.round(Math.log10(currencyScale(currency))) }).format(amount)} ${currency}`;

  if (action === "balance_after_obligation") return { conclusion: balanceAfterObligation(query, state, wallets, today, lang) };

  if (action === "balance") {
    const ledger = state.transactions.filter(item => item.date.slice(0, 10) <= today);
    const figures = wallets.map((wallet) => {
      const malformed = ledger.filter((item) => item.wallet === wallet.id && !validAmount(item.amount)).length;
      const income = total(ledger.filter((item) => item.wallet === wallet.id && item.type === "income" && validAmount(item.amount)), wallet.currency);
      const expense = total(ledger.filter((item) => item.wallet === wallet.id && item.type === "expense" && validAmount(item.amount)), wallet.currency);
      const transferOut = total(ledger.filter((item) => item.wallet === wallet.id && item.type === "transfer" && validAmount(item.amount)), wallet.currency);
      const transferIn = total(ledger.filter((item) => item.targetWallet === wallet.id && item.type === "transfer" && validAmount(item.amount)
        && state.wallets.find((source) => source.id === item.wallet)?.currency === wallet.currency), wallet.currency);
      const balance = trackedBalance(state, wallet.id, today);
      return { wallet, balance: balance.amount, income, expense, transferOut, transferIn, malformed, incomplete: !balance.complete };
    });
    const figuresText = figures.map(({ wallet, balance, income, expense, transferOut, transferIn, malformed, incomplete }) =>
      !Number.isFinite(wallet.initial)
        ? `• ${walletName(wallet.name, lang)} · ${wallet.currency}: ${localized(lang, "Số dư ban đầu không hợp lệ; chưa thể tính số dư.", "The opening balance is invalid; a balance cannot be calculated.", "初始余额无效，无法计算余额。")}`
        : `• ${walletName(wallet.name, lang)} · ${wallet.currency}: ${money(balance, wallet.currency)}\n  ${labels.income} ${money(income, wallet.currency)} · ${labels.expense} ${money(expense, wallet.currency)} · ${labels.transferOut} ${money(transferOut, wallet.currency)} · ${labels.transferIn} ${money(transferIn, wallet.currency)}${malformed ? ` · ${labels.malformed}: ${malformed}` : ""}${incomplete ? ` · ${labels.incomplete}` : ""}`).join("\n");
    return { conclusion: labels.balanceConclusion, figures: figuresText, limits: labels.assumptions };
  }

  if (action === "unknown") {
    return { conclusion: localized(lang, "Mình chưa xác định được bạn muốn xem số dư, tổng thu chi, danh mục, ngân sách hay giao dịch nào. Bạn nói rõ thêm một chút nhé.", "Please clarify whether you want a balance, spending total, category, budget or transaction list.", "请说明你想查看余额、收支总额、类别、预算还是交易列表。") };
  }

  const isFutureWindowAction = action === "upcoming_obligations";
  const earliest = action === "largest_transaction" ? state.transactions.filter(t => wallets.some(w => w.id === t.wallet) && t.date.slice(0,10) <= today).map(t => t.date.slice(0,10)).sort()[0] : null;
  const rawStart = query.periodStart && /^\d{4}-\d{2}-\d{2}$/.test(query.periodStart) ? query.periodStart : isFutureWindowAction ? today : earliest || `${today.slice(0, 7)}-01`;
  const rawEnd = query.periodEnd && /^\d{4}-\d{2}-\d{2}$/.test(query.periodEnd) ? query.periodEnd : isFutureWindowAction ? addDays(rawStart, 30) : today;

  const start = rawStart;
  // Automatically clamp future end dates to today for recorded actual spending without asking redundant questions
  const end = !isFutureWindowAction && rawEnd > today ? today : rawEnd;

  if (start > end) {
    if (start > today && !isFutureWindowAction) {
      return { conclusion: localized(lang, "Khoảng thời gian bạn chọn nằm trong tương lai; chưa có giao dịch thực tế nào được ghi nhận.", "The selected date range is in the future; no recorded transactions exist yet.", "所选时间范围在未来，尚未记录任何交易。") };
    }
    return { conclusion: localized(lang, "Khoảng ngày chưa hợp lệ. Bạn cho mình biết ngày bắt đầu và kết thúc nhé.", "The date range is invalid. Please provide a valid start and end date.", "日期范围无效，请提供有效的开始和结束日期。") };
  }

  const walletIds = new Set(wallets.map((wallet) => wallet.id));
  const records = state.transactions.filter((item) => item.date.slice(0, 10) >= start && item.date.slice(0, 10) <= end && walletIds.has(item.wallet) && item.type !== "transfer" && validAmount(item.amount));
  const range = periodLabel(start, end, lang);
  const walletLabel = query.scope === "all" ? labels.wallet.toLocaleLowerCase() : `${labels.wallet.toLocaleLowerCase()} ${walletName(wallets[0].name, lang)}`;

  if (action === "spending_summary") {
    const perWallet = wallets.map((wallet) => {
      const own = records.filter((item) => item.wallet === wallet.id);
      const income = total(own.filter((item) => item.type === "income"), wallet.currency);
      const expense = total(own.filter((item) => item.type === "expense"), wallet.currency);
      return { wallet, own, income, expense };
    });
    if (!records.length) return { conclusion: labels.noTransactions, figures: `• ${labels.period}: ${range}`, limits: labels.assumptions };
    const figures = perWallet.filter(({ own }) => own.length).map(({ wallet, own, income, expense }) =>
      `• ${walletName(wallet.name, lang)} · ${wallet.currency}: ${labels.expense} **${money(expense, wallet.currency)}** · ${own.filter(item => item.type === "expense").length} ${localized(lang, "khoản chi", "expenses", "笔支出")}\n  ${labels.income}: ${money(income, wallet.currency)}`).join("\n");
    return { conclusion: localized(lang, "Đây là số tiền bạn đã chi trong kỳ:", "Here's your recorded spending for this period:", "这是你本期已记录的支出："), figures, analysis: `${labels.period}: ${range}`, limits: wallets.length > 1 ? labels.assumptions : undefined };
  }

  if (action === "upcoming_obligations") {
    const term = normalizeVietnameseMessage(query.searchTerm || query.category || "");
    const obligations = (state.fixedExpenses || []).filter((expense) => expense.active && (!term || normalizeVietnameseMessage(expense.title + " " + expense.category).includes(term))).flatMap((expense) => {
      const budget = state.goals.find((goal) => goal.kind === "budget" && goal.id === expense.budgetId);
      const wallet = state.wallets.find((item) => item.id === (budget?.wallet || expense.walletId));
      if (!wallet || wallet.archived || !walletIds.has(wallet.id) || (budget && budget.currency !== wallet.currency) || !validAmount(expense.amount)) return [];
      return plannedOccurrences(expense, start, end).filter((date) => !occurrencePayment(state, expense.id, date)).map((date) => ({ expense, wallet, date }));
    }).sort((a, b) => a.date.localeCompare(b.date));
    if (!obligations.length) return { conclusion: localized(lang, "Không có khoản chi cố định chưa thanh toán trong kỳ đã chọn.", "No unpaid scheduled expenses were found in the selected period.", "所选期间没有未支付的固定支出。"), limits: labels.assumptions };
    const lines = obligations.slice(0, 20).map(({ expense, wallet, date }) => "• " + date + " · " + expense.title + " · " + money(expense.amount, wallet.currency) + " · " + walletName(wallet.name, lang));
    const conclusion = localized(lang, "Có " + obligations.length + " khoản cố định chưa được xác nhận thanh toán trong " + range + ".", "Found " + obligations.length + " scheduled expenses without a confirmed payment in " + range + ".", "在" + range + "找到" + obligations.length + "笔尚未确认支付的固定支出。");
    const limits = localized(lang, "Khoản chưa có liên kết xác nhận thanh toán được xem là chưa thanh toán; đây là lịch dự kiến, không phải giao dịch đã ghi nhận.", "Occurrences without a user-confirmed payment link are treated as unpaid plans, not recorded transactions.", "没有用户确认付款关联的项目视为计划支出，不是已记录交易。");
    return { conclusion, figures: lines.join("\n") + (obligations.length > 20 ? "\n• " + localized(lang, "Chỉ hiển thị 20 khoản đầu.", "Showing the first 20.", "仅显示前20笔。") : ""), limits };
  }

  if (action === "goals") {
    const term = normalizeVietnameseMessage(query.searchTerm || query.category || "");
    const goals = state.goals.filter((goal) => goal.kind !== "budget" && walletIds.has(goal.wallet) && (!term || normalizeVietnameseMessage(goal.title + " " + goal.kind).includes(term)));
    if (!goals.length) return { conclusion: localized(lang, "Chưa có mục tiêu tài chính phù hợp trong ví đã chọn.", "No financial goals were found for the selected wallet.", "所选钱包没有符合条件的财务目标。"), limits: labels.assumptions };
    const lines = goals.slice(0, 20).map((goal) => {
      const wallet = state.wallets.find((item) => item.id === goal.wallet);
      if (!wallet || wallet.currency !== goal.currency || !validAmount(goal.amount) || !validAmount(goal.saved)) return "• " + goal.title + ": " + localized(lang, "dữ liệu mục tiêu hoặc tiền tệ không nhất quán; không tính tiến độ.", "goal data or currency is inconsistent; progress not calculated.", "目标数据或币种不一致；未计算进度。");
      const remaining = Math.max(0, goal.amount - goal.saved);
      const progress = goal.amount > 0 ? Math.min(100, Math.round(goal.saved / goal.amount * 100)) : 0;
      return "• " + goal.title + " · " + walletName(wallet.name, lang) + " · " + wallet.currency + "\n  " + localized(lang, "Đã dành", "Saved", "已存") + " " + money(goal.saved, wallet.currency) + " / " + money(goal.amount, wallet.currency) + " · " + progress + "% · " + localized(lang, "Còn thiếu", "Remaining", "还差") + " " + money(remaining, wallet.currency) + (/^\d{4}-\d{2}-\d{2}$/.test(goal.date) ? " · " + localized(lang, "Mục tiêu", "Target date", "目标日期") + " " + goal.date : "");
    });
    return { conclusion: localized(lang, "Tiến độ các mục tiêu đã lưu.", "Progress for saved financial goals.", "已保存财务目标的进度。"), figures: lines.join("\n"), limits: labels.assumptions };
  }

  if (action === "spending_trend") {
    const expenses = records.filter((item) => item.type === "expense" && (!query.category || normalizeVietnameseMessage(item.category).includes(normalizeVietnameseMessage(query.category))));
    if (!expenses.length) return { conclusion: labels.noTransactions, figures: "• " + labels.period + ": " + range, limits: labels.assumptions };
    const groups = wallets.map((wallet) => {
      const weekly = new Map<string, number>();
      for (const item of expenses.filter((entry) => entry.wallet === wallet.id)) {
        const date = new Date(item.date.slice(0, 10) + "T12:00:00");
        date.setDate(date.getDate() - (date.getDay() + 6) % 7);
        const key = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
        weekly.set(key, Math.round(((weekly.get(key) || 0) + item.amount) * 100) / 100);
      }
      return weekly.size ? "• " + walletName(wallet.name, lang) + " · " + wallet.currency + "\n" + [...weekly.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, amount]) => "  " + week + ": " + money(amount, wallet.currency)).join("\n") : "";
    }).filter(Boolean);
    return { conclusion: localized(lang, "Chi tiêu đã ghi nhận theo tuần; mỗi ví và tiền tệ được tách riêng.", "Recorded weekly spending, separated by wallet and currency.", "已记录的每周支出，按钱包和币种分别显示。"), figures: groups.join("\n"), limits: labels.assumptions };
  }

  if (action === "anomalies") {
    const currentExpenses = records.filter((item) => item.type === "expense" && (!query.category || normalizeVietnameseMessage(item.category).includes(normalizeVietnameseMessage(query.category))));
    if (!currentExpenses.length) return { conclusion: localized(lang, `Chưa có khoản chi nào trong ${range} để Finn kiểm tra.`, `There are no expenses in ${range} for Finn to check.`, `${range}没有可供 Finn 检查的支出。`) };
    let comparable = 0;
    const findings = currentExpenses.flatMap((item) => {
      const historyStart = addDays(start, -90);
      const prior = state.transactions.filter((other) => other.type === "expense" && other.wallet === item.wallet && other.category === item.category && validAmount(other.amount) && other.date.slice(0, 10) >= historyStart && other.date.slice(0, 10) < start).map((other) => other.amount).sort((a, b) => a - b);
      if (prior.length < 5) return [];
      const middle = Math.floor(prior.length / 2);
      const median = prior.length % 2 ? prior[middle] : (prior[middle - 1] + prior[middle]) / 2;
      if (median > 0) comparable++;
      const wallet = state.wallets.find((itemWallet) => itemWallet.id === item.wallet);
      return median > 0 && item.amount >= median * 3 && wallet ? [{ transaction: item, wallet, median, samples: prior.length }] : [];
    });
    if (!comparable) return { conclusion: localized(lang, "Finn chưa có đủ lịch sử chi tiêu để biết khoản nào cao hơn thói quen của bạn. Chưa thể kết luận là có hay không có khoản bất thường nhé.", "Finn needs more spending history to tell which expenses differ from your usual habits. I cannot yet conclude whether there are unusual expenses.", "Finn 还需要更多支出历史，才能判断哪些项目高于你的日常习惯，目前无法确定是否存在异常支出。"), suggestions: localized(lang, "Bạn cứ tiếp tục ghi nhận chi tiêu; Finn sẽ có cơ sở so sánh rõ hơn.", "Keep recording spending so Finn has a clearer basis for comparison.", "请继续记录支出，以便 Finn 有更充分的比较依据。") };
    const partial = comparable < currentExpenses.length ? localized(lang, "Một số khoản chưa có đủ lịch sử để so sánh.", "Some expenses do not yet have enough history for comparison.", "部分支出的历史还不足以比较。") : undefined;
    if (!findings.length) return { conclusion: localized(lang, "Trong những khoản có đủ lịch sử để so sánh, Finn chưa thấy khoản nào tăng đột biến so với trước đây.", "Among expenses with enough history to compare, Finn hasn't found any sharp increases from your usual spending.", "在历史足够的支出中，Finn 暂未发现比以往明显增加的项目。"), limits: partial };
    const lines = findings.slice(0, 20).map(({ transaction, wallet, median }) => `• ${transaction.title} · **${money(transaction.amount, wallet.currency)}** · ${walletName(wallet.name, lang)} (${transaction.date.slice(0, 10)})\n  ${localized(lang, "Mức thường gặp trước đây khoảng", "Your usual recorded amount was around", "以前常见的记录金额约为")} **${money(median, wallet.currency)}**.`);
    return { conclusion: localized(lang, `Có ${findings.length} khoản cao hơn hẳn mức bạn thường chi, đáng để xem lại:`, `There are ${findings.length} expenses well above your usual spending that are worth a look:`, `有${findings.length}笔支出明显高于平时，值得查看：`), figures: lines.join("\n"), suggestions: localized(lang, "Bạn kiểm tra xem đây là khoản mua lớn có chủ đích hay giao dịch ghi nhầm nhé.", "Check whether these were planned large purchases or recording mistakes.", "请确认这是计划内的大额购买，还是记录有误。"), limits: partial };
  }

  if (action === "explain" || action === "top_category" || action === "category_breakdown") {
    const type = action === "explain" ? "expense" : query.transactionType || "expense";
    const relevant = records.filter((item) => item.type === type && (!query.category || normalizeVietnameseMessage(item.category).includes(normalizeVietnameseMessage(query.category))));
    if (!relevant.length) return { conclusion: query.category ? localized(lang, `Chưa tìm thấy giao dịch phù hợp với danh mục “${query.category}”.`, `No matching transactions were found for category “${query.category}”.`, `没有找到类别“${query.category}”的匹配交易。`) : labels.noTransactions, figures: `• ${labels.period}: ${range}\n• ${labels.wallet}: ${walletLabel}`, limits: labels.assumptions };
    const groups = new Map<string, { walletId: string; category: string; amount: number; count: number }>();
    for (const item of relevant) {
      const key = `${item.wallet}\0${item.category}`;
      const group = groups.get(key) || { walletId: item.wallet, category: item.category || localized(lang, "Chưa phân loại", "Uncategorized", "未分类"), amount: 0, count: 0 };
      const currency = state.wallets.find((wallet) => wallet.id === item.wallet)?.currency || "USD";
      const scale = currencyScale(currency);
      group.amount = Math.round((group.amount + item.amount) * scale) / scale;
      group.count++;
      groups.set(key, group);
    }
    const byWallet = wallets.flatMap((wallet) => {
      const ranked = [...groups.values()].filter((item) => item.walletId === wallet.id).sort((a, b) => b.amount - a.amount);
      return ranked.length ? [{ wallet, ranked, sum: total(relevant.filter((item) => item.wallet === wallet.id), wallet.currency) }] : [];
    });
    if (action === "category_breakdown") {
      const figures = byWallet.map(({ wallet, ranked, sum }) => [
        `${walletName(wallet.name, lang)} · ${wallet.currency}`,
        ...ranked.map(item => `• ${item.category}: **${money(item.amount, wallet.currency)}** · ${sum ? Math.round(item.amount / sum * 100) : 0}% · ${item.count} ${localized(lang, "giao dịch", "transactions", "笔交易")}`),
        `${localized(lang, "Tổng đã chi", "Total spent", "支出合计")}: **${money(sum, wallet.currency)}**`,
      ].join("\n")).join("\n\n");
      return { conclusion: localized(lang, "Bạn đã chi cho các danh mục sau:", "Here's where your spending went:", "你的支出分布如下："), figures, analysis: `${labels.period}: ${range}`, limits: wallets.length > 1 ? labels.assumptions : undefined };
    }
    const figures = byWallet.flatMap(({ wallet, ranked, sum }) => ranked.slice(0, action === "explain" ? 1 : 5).map((item, index) =>
      `• ${walletName(wallet.name, lang)} · ${item.category}: ${money(item.amount, wallet.currency)}${action === "top_category" ? ` (${item.count})` : ` (${sum ? Math.round(item.amount / sum * 100) : 0}%)`}${action === "top_category" ? ` · #${index + 1}` : ""}`)).join("\n");
    const topItem = byWallet[0]?.ranked[0];
    const topWallet = byWallet[0]?.wallet;
    const topSum = byWallet[0]?.sum || 0;
    let topConclusion = topItem && topWallet
      ? localized(lang, `Trong ${range}, danh mục ${type === "expense" ? "chi" : "thu"} nhiều nhất là “${topItem.category}” với ${money(topItem.amount, topWallet.currency)}${topSum ? ` (chiếm ${Math.round(topItem.amount / topSum * 100)}% tổng ${type === "expense" ? "chi" : "thu"})` : ""}.`, `For ${range}, the highest ${type === "expense" ? "spending" : "income"} category is “${topItem.category}” with ${money(topItem.amount, topWallet.currency)}${topSum ? ` (${Math.round(topItem.amount / topSum * 100)}% of total)` : ""}.`, `${range}期间，${type === "expense" ? "支出" : "收入"}最高的类别是“${topItem.category}”，共计 ${money(topItem.amount, topWallet.currency)}${topSum ? `（占总额的 ${Math.round(topItem.amount / topSum * 100)}%）` : ""}。`)
      : localized(lang, `Danh mục ${type === "expense" ? "chi" : "thu"} được xếp riêng theo từng ví trong ${range}.`, `${type === "expense" ? "Spending" : "Income"} categories are ranked separately per wallet for ${range}.`, `${range}的${type === "expense" ? "支出" : "收入"}类别按钱包分别排序。`);
    if (query.scope === "all" && byWallet.length > 1) {
      const perWallet = byWallet.map(({ wallet, ranked, sum }) => {
        const item = ranked[0];
        if (!item) return "";
        return `• ${walletName(wallet.name, lang)} · ${item.category}: ${money(item.amount, wallet.currency)}${sum ? ` (${Math.round(item.amount / sum * 100)}%)` : ""}`;
      }).filter(Boolean).join("\n");
      topConclusion = `${localized(lang, `Danh mục ${type === "expense" ? "chi" : "thu"} cao nhất theo từng ví trong ${range}:`, `Top ${type === "expense" ? "spending" : "income"} category per wallet for ${range}:`, `${range}各钱包${type === "expense" ? "支出" : "收入"}最高的类别：`)}\n${perWallet}`;
    }
    return { conclusion: action === "explain" ? localized(lang, "Danh mục có tổng chi cao nhất trong số giao dịch đã lưu.", "This category has the highest recorded spending.", "此类别的已记录支出最高。") : topConclusion, figures, limits: labels.assumptions };
  }

  if (action === "category_savings") {
    const percentage = query.percentage;
    if (!query.category || percentage === null || percentage === undefined || !Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      return { conclusion: localized(lang, "Bạn muốn giảm chi tiêu ở danh mục nào và bao nhiêu phần trăm?", "Which category and reduction percentage should I use?", "请说明要减少哪个类别以及减少百分之几。") };
    }
    const matching = records.filter((item) => item.type === "expense" && normalizeVietnameseMessage(item.category).includes(normalizeVietnameseMessage(query.category || "")));
    if (!matching.length) return { conclusion: localized(lang, `Chưa có khoản chi đã ghi nhận cho danh mục “${query.category}” trong ${range}.`, `No recorded spending for “${query.category}” was found in ${range}.`, `${range}没有找到类别“${query.category}”的已记录支出。`) };
    const grouped = new Map<string, { amount: number; count: number }>();
    for (const item of matching) {
      const currency = state.wallets.find((wallet) => wallet.id === item.wallet)?.currency;
      if (!currency) continue;
      const previous = grouped.get(currency) || { amount: 0, count: 0 };
      const scale = currencyScale(currency);
      previous.amount = Math.round((previous.amount + item.amount) * scale) / scale;
      previous.count++;
      grouped.set(currency, previous);
    }
    const results = [...grouped.entries()].map(([currency, baseline]) => {
      const scale = currencyScale(currency);
      const savings = Math.round(baseline.amount * percentage / 100 * scale) / scale;
      const reducedSpend = Math.round((baseline.amount - savings) * scale) / scale;
      return localized(lang,
        `• Bạn đã chi **${money(baseline.amount, currency)}** qua ${baseline.count} giao dịch. Giảm ${percentage}% tương đương **${money(savings, currency)}**, mức chi sau giảm là **${money(reducedSpend, currency)}** cho cùng kỳ.`,
        `• You've spent **${money(baseline.amount, currency)}** across ${baseline.count} transactions. A ${percentage}% reduction would save **${money(savings, currency)}**, bringing spending to **${money(reducedSpend, currency)}** for the same period.`,
        `• 你已支出 **${money(baseline.amount, currency)}**，共${baseline.count}笔交易。减少${percentage}%可节省 **${money(savings, currency)}**，同一期间的支出将降至 **${money(reducedSpend, currency)}**。`);
    });
    return {
      conclusion: localized(lang, `Được chứ, Finn cùng bạn xem cách giảm chi cho “${query.category}” nhé.`, `Let's look at reducing your spending on “${query.category}”.`, `Finn 和你一起看看如何减少“${query.category}”的支出。`),
      figures: results.join("\n"),
      analysis: localized(lang, `Tính theo khoản đã ghi nhận trong ${range}; đây là mức giảm giả định, chưa thay đổi ngân sách hay tạo kế hoạch.`, `Based on recorded spending for ${range}; this is a hypothetical reduction, not a budget change or a saved plan.`, `根据${range}的已记录支出计算；这是假设调整，尚未修改预算或创建计划。`),
      suggestions: localized(lang, "Bạn muốn thử mức giảm khác hay xem khoản nào trong danh mục này chi nhiều nhất?", "Would you like to try another percentage or see the largest expenses in this category?", "你想试试其他比例，还是看看这个类别中金额最大的支出？"),
    };
  }

  if (action === "largest_transaction") {
    const term = normalizeVietnameseMessage(query.searchTerm || query.category || "");
    const matches = records.filter(item => item.type === (query.transactionType || "expense") && (!term || normalizeVietnameseMessage(`${item.title} ${item.category} ${item.note || ""}`).includes(term)));
    if (!matches.length) return { conclusion: labels.noTransactions, analysis: `${labels.period}: ${range}` };
    const byCurrency = new Map<string, typeof matches>();
    for (const item of matches) { const currency = wallets.find(w => w.id === item.wallet)!.currency; const current = byCurrency.get(currency); if (!current || item.amount > current[0].amount) byCurrency.set(currency,[item]); else if (item.amount === current[0].amount) current.push(item); }
    return { conclusion: localized(lang,"Đây là giao dịch có số tiền cao nhất trong phạm vi bạn hỏi:","Here is the largest transaction in the requested scope:","以下是所选范围内金额最高的交易："), figures: [...byCurrency].flatMap(([currency, items]) => items.map(item => `• **${item.title} · ${money(item.amount,currency)}**\n  ${item.date.slice(0,10)} · ${item.category} · ${walletName(wallets.find(w=>w.id===item.wallet)!.name,lang)}`)).join("\n"), analysis: `${labels.period}: ${range}`, limits: byCurrency.size > 1 ? labels.assumptions : undefined };
  }

  if (action === "transactions") {
    const term = normalizeVietnameseMessage(query.searchTerm || query.category || "");
    const matches = records.filter((item) => (!query.transactionType || item.type === query.transactionType) && (!term || normalizeVietnameseMessage(`${item.title} ${item.category} ${item.note || ""}`).includes(term)));
    if (!matches.length) return { conclusion: labels.noTransactions, figures: `• ${labels.period}: ${range}${term ? `\n• ${query.searchTerm || query.category}` : ""}`, limits: labels.assumptions };
    const lines = matches.slice(0, 10).map((item) => {
      const currency = state.wallets.find((wallet) => wallet.id === item.wallet)?.currency || "";
      const timePart = item.date.length > 10 ? ` ${item.date.slice(11, 16)}` : "";
      return `• ${item.date.slice(0, 10)}${timePart} · ${item.title}\n  ${item.category || localized(lang, "Chưa phân loại", "Uncategorized", "未分类")} · ${money(item.amount, currency)}`;
    });
    return { conclusion: localized(lang, `Tìm thấy ${matches.length} giao dịch trong ${range}.`, `Found ${matches.length} transactions for ${range}.`, `在${range}找到${matches.length}笔交易。`), figures: lines.join("\n") + (matches.length > 10 ? `\n• ${localized(lang, "Chỉ hiển thị 10 giao dịch đầu.", "Showing the first 10.", "仅显示前10笔。")}` : ""), limits: labels.assumptions };
  }

  if (action === "budget_status") {
    const term = normalizeVietnameseMessage(query.searchTerm || "");
    const budgets = state.goals.filter((goal) => goal.kind === "budget" && walletIds.has(goal.wallet) && (!query.category || normalizeVietnameseMessage(goal.category || goal.title).includes(normalizeVietnameseMessage(query.category))) && (!term || normalizeVietnameseMessage(goal.title).includes(term)));
    const summaries = budgets.map((budget) => {
      const summary = budgetSummary(state, budget, today);
      const window = { start: summary.start, end: summary.end };
      const wallet = state.wallets.find((item) => item.id === budget.wallet);
      const matchingCurrency = !!wallet && wallet.currency === budget.currency;
      const actual = matchingCurrency ? summary.actual : 0;
      const expenses = (state.fixedExpenses || []).filter((item) => item.active && item.budgetId === budget.id);
      const planned = matchingCurrency ? summary.unpaidPlanned : 0;
      const due = expenses.flatMap((expense) => unpaidOccurrences(state, expense, window.start, window.end).map((date) => ({ title: expense.title, amount: expense.amount, date }))).sort((a, b) => a.date.localeCompare(b.date));
      return { budget, window, wallet, matchingCurrency, actual, planned, due };
    });
    const figures = summaries.map(({ budget, window, wallet, matchingCurrency, actual, planned, due }) => {
      if (!matchingCurrency || !wallet) return `• ${budget.title}: ${localized(lang, "ví không tồn tại hoặc tiền tệ ngân sách không khớp; chưa tính số đã chi.", "wallet missing or budget currency mismatch; spending was not calculated.", "钱包不存在或预算币种不一致；未计算支出。")}`;
      const remainder = budget.amount - actual - planned;
      return `• **${budget.title}** · ${walletName(wallet.name, lang)} · ${wallet.currency}\n  ${labels.spent}: **${money(actual, budget.currency)}** / ${labels.budgetLimit.toLowerCase()} ${money(budget.amount, budget.currency)}\n  ${localized(lang, "Khoản cố định chưa trả", "Unpaid fixed expenses", "未付固定支出")}: ${money(planned, budget.currency)}\n  ${localized(lang, "Hạn mức còn sau các khoản này", "Budget limit left after these items", "扣除这些项目后的预算余额")}: **${money(remainder, budget.currency)}**${remainder < 0 ? ` · ${labels.over}` : ""}\n  ${labels.period}: ${window.start}–${window.end}${due.length ? `\n  ${localized(lang, "Khoản cần trả gần nhất", "Next unpaid bill", "最近待付账单")}: ${due[0].title} · ${due[0].date} · ${money(due[0].amount, budget.currency)}` : ""}`;
    }).join("\n");
    const walletFixed = (state.fixedExpenses || []).filter((expense) => expense.active && !expense.budgetId && wallets.some((wallet) => wallet.id === (expense.walletId || "")));
    const extraFixed = walletFixed.flatMap((expense) => {
      const wallet = wallets.find((item) => item.id === expense.walletId);
      if (!wallet || !validAmount(expense.amount)) return [];
      return unpaidOccurrences(state, expense, expense.dueDate, addDays(today, 30)).map((date) => `• ${date} · ${expense.title} · ${money(expense.amount, wallet.currency)} · ${walletName(wallet.name, lang)}`);
    });
    if (!figures && !extraFixed.length) return { conclusion: labels.noBudgets, figures: query.category ? `• ${query.category}` : undefined, suggestions: labels.noBudgetSuggestion, limits: labels.assumptions };
    const dynamicConclusion = summaries.length ? localized(lang, `Bạn đang có ${summaries.length} ngân sách trong phạm vi đã chọn:`, `You have ${summaries.length} ${summaries.length === 1 ? "budget" : "budgets"} in the selected scope:`, `所选范围内有${summaries.length}项预算：`) : labels.budgetConclusion;
    return { conclusion: dynamicConclusion, figures: [figures, extraFixed.length ? `${labels.extraFixed}:\n${extraFixed.join("\n")}` : ""].filter(Boolean).join("\n"), limits: labels.assumptions };
  }

  if (action === "safe_daily_allowance") {
    const budgets = state.goals.filter((goal) => goal.kind === "budget" && wallets.some((wallet) => wallet.id === goal.wallet) && (!query.category || normalizeVietnameseMessage(goal.category || goal.title).includes(normalizeVietnameseMessage(query.category))));
    if (!budgets.length) return { conclusion: labels.noBudgets, suggestions: labels.noBudgetSuggestion, limits: labels.assumptions };
    const lines = budgets.map((budget) => {
      const summary = budgetSummary(state, budget, today);
      const wallet = state.wallets.find((item) => item.id === budget.wallet);
      if (!wallet || wallet.currency !== budget.currency || !summary.matchingCurrency) return "• " + budget.title + ": " + localized(lang, "ví hoặc tiền tệ ngân sách không khớp; chưa thể tính.", "wallet or budget currency mismatch; cannot calculate.", "钱包或预算币种不匹配；无法计算。");
      const daysLeft = Math.max(0, Math.floor((Date.parse(summary.end + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 86400000) + 1);
      const scale = currencyScale(budget.currency);
      const safeDaily = daysLeft ? Math.floor(Math.max(0, summary.afterCommitments) * scale / daysLeft) / scale : 0;
      return "• " + budget.title + " · " + walletName(wallet.name, lang) + " · " + wallet.currency + "\n  " + localized(lang, "Còn sau chi đã ghi nhận và khoản cố định chưa trả", "Remaining after recorded spending and unpaid fixed expenses", "扣除已记录支出和未付固定支出后") + ": " + money(summary.afterCommitments, wallet.currency) + "\n  " + localized(lang, "Số ngày còn lại", "Days left", "剩余天数") + ": " + daysLeft + " · " + localized(lang, "Hạn mức chi mỗi ngày", "Daily spending cap", "每日支出上限") + ": " + money(safeDaily, wallet.currency);
    });
    return { conclusion: localized(lang, "Hạn mức dưới đây giúp không vượt ngân sách đã lưu; không đồng nghĩa với số dư ví.", "These limits help stay within saved budgets; they are not wallet balances.", "以下限额用于控制在已保存预算内，不等于钱包余额。"), figures: lines.join("\n"), limits: localized(lang, "Tính theo hạn mức trừ chi thực tế và các khoản cố định chưa được xác nhận thanh toán, chia đều cho số ngày còn lại trong chu kỳ. Không tính các khoản chi linh hoạt khác đã dự định.", "Calculated as budget limit less actual spending and unpaid fixed commitments, divided evenly across remaining days. Other planned flexible spending is not included.", "按预算限额扣除实际支出和未确认支付的固定支出，再均分到周期剩余天数；不含其他计划的灵活支出。") };
  }

  return { conclusion: localized(lang, "Mình chưa xử lý được câu hỏi này.", "I couldn't process this question.", "暂时无法处理这个问题。") };
}

export function answerFinancialQuery(query: FinancialQuery, state: FinancialState, selectedWalletId: string, today: string, presentation?: AnswerPresentation): string {
  const lang = getLanguage(state), labels = copy[lang];
  const activeWallets = state.wallets.filter((wallet) => !wallet.archived);
  const selectedWallet = activeWallets.find((wallet) => wallet.id === (query.walletId || selectedWalletId));
  const wallets = query.scope === "all" ? activeWallets : selectedWallet ? [selectedWallet] : [];
  if (!wallets.length) return render(lang, { conclusion: labels.noWallet });

  const actions = query.actions && query.actions.length > 0 ? query.actions : [query.action];
  if (actions.length === 1) {
    const section = answerFinancialQuerySection(actions[0], query, wallets, state, today, lang);
    if (actions[0] === "balance" && presentation?.detail !== "detailed") return render(lang, { ...section, conclusion: undefined }, presentation);
    if (actions[0] === "spending_summary" || actions[0] === "category_breakdown") {
      return [section.conclusion, section.figures, section.analysis, section.limits !== labels.assumptions ? section.limits : null].filter(Boolean).join("\n\n");
    }
    return render(lang, section, presentation);
  }

  // Compound query: execute each action and combine results cleanly
  const sections = actions.map((act) => answerFinancialQuerySection(act, query, wallets, state, today, lang));
  const conclusions = sections.map((s, i) => `${i + 1}. ${s.conclusion}`).join("\n");
  const figures = sections.map((s) => s.figures).filter(Boolean).join("\n\n");
  const analysis = sections.map((s) => s.analysis).filter(Boolean).join("\n\n");
  const suggestions = sections.map((s) => s.suggestions).filter(Boolean).join("\n\n");
  const limits = [...new Set(sections.map((s) => s.limits).filter(Boolean))].join("\n");

  return render(lang, {
    conclusion: conclusions,
    figures: figures || undefined,
    analysis: analysis || undefined,
    suggestions: suggestions || undefined,
    limits: limits || labels.assumptions,
  }, presentation);
}
