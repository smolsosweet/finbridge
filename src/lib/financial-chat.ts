import type { AppState } from "../components/sites/rolly/replica/store";
import { budgetSummary, plannedOccurrences } from "../components/sites/rolly/replica/planningModel";
import { trackedBalance } from "./financial-outlook";

const normalizeVietnameseMessage = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi").replace(/đ/g, "d").trim();
const symbols: Record<string, string> = { USD: "$", VND: "₫", EUR: "€", GBP: "£", AUD: "A$", SGD: "S$", JPY: "¥" };
const money = (amount: number, currency: string) => `${symbols[currency] || `${currency} `}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount)}`;
type Language = "vi" | "en" | "zh";
const copy: Record<Language, { conclusion: string; figures: string; analysis: string; suggestions: string; limits: string; noWallet: string; noTransactions: string; noBudgets: string; assumptions: string; balanceConclusion: string; income: string; expense: string; transferOut: string; transferIn: string; incomplete: string; malformed: string; period: string; wallet: string; summary: (range: string) => string; totalIncome: string; totalExpense: string; noBudgetSuggestion: string; budgetConclusion: string; budgetLimit: string; spent: string; fixed: string; afterFixed: string; over: string; upcoming: string; extraFixed: string; budgetAnalysis: string }> = {
  vi: { conclusion: "Kết luận", figures: "Số liệu liên quan", analysis: "Phân tích", suggestions: "Đề xuất", limits: "Giả định/giới hạn", noWallet: "Chưa có ví đang hoạt động để tính.", noTransactions: "Chưa có giao dịch phù hợp trong khoảng thời gian này.", noBudgets: "Chưa thấy ngân sách phù hợp trong ví đã chọn.", assumptions: "Tính từ dữ liệu đã lưu trong FinBridge; các ví được tính riêng theo tiền tệ, không quy đổi.", balanceConclusion: "Số dư được tính từ số dư ban đầu và giao dịch đã lưu.", income: "Thu", expense: "Chi", transferOut: "Chuyển đi", transferIn: "Chuyển đến", incomplete: "Chuyển khoản khác tiền tệ thiếu số tiền nhận; số dư chưa đầy đủ", malformed: "Bỏ qua giao dịch sai số tiền", period: "Kỳ", wallet: "Ví", summary: (range) => `Tổng hợp thu chi ${range} theo dữ liệu đã ghi nhận.`, totalIncome: "thu", totalExpense: "chi", noBudgetSuggestion: "Tạo ngân sách trong trang Kế hoạch để theo dõi hạn mức và khoản cố định.", budgetConclusion: "Tình hình ngân sách và khoản cố định theo chu kỳ hiện tại.", budgetLimit: "Hạn mức", spent: "Đã chi", fixed: "Chi cố định dự kiến", afterFixed: "Còn sau khoản cố định", over: "Có thể vượt hạn mức", upcoming: "Sắp đến hạn", extraFixed: "Khoản cố định 30 ngày tới chưa gắn ngân sách", budgetAnalysis: "Hạn mức ngân sách không phải số dư ví. Chi cố định được trình bày riêng với khoản đã chi." },
  en: { conclusion: "Conclusion", figures: "Relevant figures", analysis: "Analysis", suggestions: "Suggestions", limits: "Assumptions/limits", noWallet: "There is no active wallet to calculate.", noTransactions: "There are no matching transactions in this period.", noBudgets: "No matching budget was found for the selected wallet.", assumptions: "Calculated from saved FinBridge data. Wallets stay separate by currency; no conversion is applied.", balanceConclusion: "Balance uses the wallet's opening balance and saved transactions.", income: "Income", expense: "Spending", transferOut: "Transferred out", transferIn: "Transferred in", incomplete: "A cross-currency transfer has no destination amount; this balance is incomplete", malformed: "Skipped invalid-amount transactions", period: "Period", wallet: "Wallet", summary: (range) => `Recorded income and spending for ${range}.`, totalIncome: "income", totalExpense: "spending", noBudgetSuggestion: "Create a budget in Planning to track limits and fixed expenses.", budgetConclusion: "Current-cycle budget and fixed-expense status.", budgetLimit: "Limit", spent: "Spent", fixed: "Planned fixed expenses", afterFixed: "Remaining after fixed expenses", over: "May exceed the limit", upcoming: "Due soon", extraFixed: "Fixed expenses due in the next 30 days without a budget", budgetAnalysis: "A budget limit is not a wallet balance. Fixed expenses are shown separately from recorded spending." },
  zh: { conclusion: "结论", figures: "相关数据", analysis: "分析", suggestions: "建议", limits: "假设/限制", noWallet: "没有可用于计算的活跃钱包。", noTransactions: "此时间段没有符合条件的交易。", noBudgets: "所选钱包没有符合条件的预算。", assumptions: "根据 FinBridge 已保存的数据计算；不同币种的钱包分别计算，不进行换算。", balanceConclusion: "余额根据钱包初始余额和已保存交易计算。", income: "收入", expense: "支出", transferOut: "转出", transferIn: "转入", incomplete: "跨币种转账缺少收款金额；此余额不完整", malformed: "已跳过金额无效的交易", period: "期间", wallet: "钱包", summary: (range) => `${range}的已记录收入与支出。`, totalIncome: "收入", totalExpense: "支出", noBudgetSuggestion: "请在计划页面创建预算以跟踪限额和固定支出。", budgetConclusion: "当前周期的预算和固定支出情况。", budgetLimit: "限额", spent: "已支出", fixed: "预计固定支出", afterFixed: "扣除固定支出后剩余", over: "可能超出限额", upcoming: "即将到期", extraFixed: "未来30天内未关联预算的固定支出", budgetAnalysis: "预算限额不等于钱包余额。固定支出与已记录支出分开显示。" },
};
export type FinancialState = Pick<AppState, "wallets" | "transactions" | "goals" | "fixedExpenses" | "settings">;
export type FinancialAction = "balance" | "spending_summary" | "top_category" | "transactions" | "budget_status" | "explain" | "unknown";
export interface FinancialQuery { action: FinancialAction; walletId: string | null; scope: "selected" | "all"; periodStart: string | null; periodEnd: string | null; category: string | null; searchTerm: string | null; transactionType: "expense" | "income" | null; }

function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + amount);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
function periodLabel(start: string, end: string, lang: Language) { return start === end ? start : `${start} ${lang === "vi" ? "đến" : lang === "zh" ? "至" : "to"} ${end}`; }
function render(lang: Language, sections: Partial<Record<"conclusion" | "figures" | "analysis" | "suggestions" | "limits", string>>) {
  const labels = copy[lang];
  return (["conclusion", "figures", "analysis", "suggestions", "limits"] as const)
    .filter((key) => sections[key])
    .map((key) => `${labels[key].toLocaleUpperCase()}\n${sections[key]}`)
    .join("\n\n");
}
function getLanguage(state: FinancialState): Language {
  const value = String(state.settings?.language || "");
  return /中文|zh/i.test(value) ? "zh" : /English|en/i.test(value) ? "en" : "vi";
}
function localized(lang: Language, vi: string, en: string, zh: string) { return lang === "vi" ? vi : lang === "zh" ? zh : en; }
function validAmount(amount: number) { return Number.isFinite(amount) && amount >= 0; }
function total(items: Array<{ amount: number }>) { return items.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100; }
function walletName(name: string, lang: Language) { return name === "." ? ({ vi: "Ví chính", en: "Main wallet", zh: "主钱包" }[lang]) : name; }

export function answerFinancialQuery(query: FinancialQuery, state: FinancialState, selectedWalletId: string, today: string): string {
  const lang = getLanguage(state), labels = copy[lang];
  const activeWallets = state.wallets.filter((wallet) => !wallet.archived);
  const selectedWallet = activeWallets.find((wallet) => wallet.id === (query.walletId || selectedWalletId));
  const wallets = query.scope === "all" ? activeWallets : selectedWallet ? [selectedWallet] : [];
  if (!wallets.length) return render(lang, { conclusion: labels.noWallet });

  if (query.action === "balance") {
    const figures = wallets.map((wallet) => {
      const malformed = state.transactions.filter((item) => item.wallet === wallet.id && !validAmount(item.amount)).length;
      const income = total(state.transactions.filter((item) => item.wallet === wallet.id && item.type === "income" && validAmount(item.amount)));
      const expense = total(state.transactions.filter((item) => item.wallet === wallet.id && item.type === "expense" && validAmount(item.amount)));
      const transferOut = total(state.transactions.filter((item) => item.wallet === wallet.id && item.type === "transfer" && validAmount(item.amount)));
      const transferIn = total(state.transactions.filter((item) => item.targetWallet === wallet.id && item.type === "transfer" && validAmount(item.amount)
        && state.wallets.find((source) => source.id === item.wallet)?.currency === wallet.currency));
      const balance = trackedBalance(state, wallet.id, today);
      return { wallet, balance: balance.amount, income, expense, transferOut, transferIn, malformed, incomplete: !balance.complete };
    });
    const figuresText = figures.map(({ wallet, balance, income, expense, transferOut, transferIn, malformed, incomplete }) =>
      !Number.isFinite(wallet.initial)
        ? `• ${walletName(wallet.name, lang)} · ${wallet.currency}: ${localized(lang, "Số dư ban đầu không hợp lệ; chưa thể tính số dư.", "The opening balance is invalid; a balance cannot be calculated.", "初始余额无效，无法计算余额。")}`
        : `• ${walletName(wallet.name, lang)} · ${wallet.currency}: ${money(balance, wallet.currency)}\n  ${labels.income} ${money(income, wallet.currency)} · ${labels.expense} ${money(expense, wallet.currency)} · ${labels.transferOut} ${money(transferOut, wallet.currency)} · ${labels.transferIn} ${money(transferIn, wallet.currency)}${malformed ? ` · ${labels.malformed}: ${malformed}` : ""}${incomplete ? ` · ${labels.incomplete}` : ""}`).join("\n");
    return render(lang, { conclusion: labels.balanceConclusion, figures: figuresText, limits: labels.assumptions });
  }
  if (query.action === "unknown") return render(lang, { conclusion: localized(lang, "Mình chưa xác định được bạn muốn xem số dư, tổng thu chi, danh mục, ngân sách hay giao dịch nào. Bạn nói rõ thêm một chút nhé.", "Please clarify whether you want a balance, spending total, category, budget or transaction list.", "请说明你想查看余额、收支总额、类别、预算还是交易列表。") });

  const start = query.periodStart && /^\d{4}-\d{2}-\d{2}$/.test(query.periodStart) ? query.periodStart : `${today.slice(0, 7)}-01`;
  const end = query.periodEnd && /^\d{4}-\d{2}-\d{2}$/.test(query.periodEnd) ? query.periodEnd : today;
  if (start > end || end > today || addDays(start, 3660) < end) return render(lang, { conclusion: localized(lang, "Khoảng ngày chưa hợp lệ. Bạn cho mình biết ngày bắt đầu và kết thúc nhé.", "The date range is invalid. Please provide a valid start and end date.", "日期范围无效，请提供有效的开始和结束日期。") });
  const walletIds = new Set(wallets.map((wallet) => wallet.id));
  const records = state.transactions.filter((item) => item.date.slice(0, 10) >= start && item.date.slice(0, 10) <= end && walletIds.has(item.wallet) && item.type !== "transfer" && validAmount(item.amount));
  const range = periodLabel(start, end, lang);
  const walletLabel = query.scope === "all" ? labels.wallet.toLocaleLowerCase() : `${labels.wallet.toLocaleLowerCase()} ${walletName(wallets[0].name, lang)}`;

  if (query.action === "spending_summary") {
    const perWallet = wallets.map((wallet) => {
      const own = records.filter((item) => item.wallet === wallet.id);
      const income = total(own.filter((item) => item.type === "income"));
      const expense = total(own.filter((item) => item.type === "expense"));
      return { wallet, own, income, expense };
    });
    if (!records.length) return render(lang, { conclusion: labels.noTransactions, figures: `• ${labels.period}: ${range}`, limits: labels.assumptions });
    const figures = perWallet.filter(({ own }) => own.length).map(({ wallet, own, income, expense }) =>
      `• ${walletName(wallet.name, lang)} · ${wallet.currency}: ${labels.totalIncome} ${money(income, wallet.currency)}, ${labels.totalExpense} ${money(expense, wallet.currency)} (${own.length}).`).join("\n");
    return render(lang, { conclusion: labels.summary(range), figures, limits: labels.assumptions });
  }

  if (query.action === "explain" || query.action === "top_category") {
    const type = query.action === "explain" ? "expense" : query.transactionType || "expense";
    const relevant = records.filter((item) => item.type === type && (!query.category || normalizeVietnameseMessage(item.category).includes(normalizeVietnameseMessage(query.category))));
    if (!relevant.length) return render(lang, { conclusion: query.category ? localized(lang, `Chưa tìm thấy giao dịch phù hợp với danh mục “${query.category}”.`, `No matching transactions were found for category “${query.category}”.`, `没有找到类别“${query.category}”的匹配交易。`) : labels.noTransactions, figures: `• ${labels.period}: ${range}\n• ${labels.wallet}: ${walletLabel}`, limits: labels.assumptions });
    const groups = new Map<string, { walletId: string; category: string; amount: number; count: number }>();
    for (const item of relevant) {
      const key = `${item.wallet}\0${item.category}`;
      const group = groups.get(key) || { walletId: item.wallet, category: item.category || localized(lang, "Chưa phân loại", "Uncategorized", "未分类"), amount: 0, count: 0 };
      group.amount = Math.round((group.amount + item.amount) * 100) / 100;
      group.count++;
      groups.set(key, group);
    }
    const byWallet = wallets.flatMap((wallet) => {
      const ranked = [...groups.values()].filter((item) => item.walletId === wallet.id).sort((a, b) => b.amount - a.amount);
      return ranked.length ? [{ wallet, ranked, sum: total(relevant.filter((item) => item.wallet === wallet.id)) }] : [];
    });
    const figures = byWallet.flatMap(({ wallet, ranked, sum }) => ranked.slice(0, query.action === "explain" ? 1 : 5).map((item, index) =>
      `• ${walletName(wallet.name, lang)} · ${item.category}: ${money(item.amount, wallet.currency)}${query.action === "top_category" ? ` (${item.count})` : ` (${sum ? Math.round(item.amount / sum * 100) : 0}%)`}${query.action === "top_category" ? ` · #${index + 1}` : ""}`)).join("\n");
    return render(lang, { conclusion: query.action === "explain" ? localized(lang, "Danh mục có tổng chi cao nhất trong số giao dịch đã lưu.", "This category has the highest recorded spending.", "此类别的已记录支出最高。") : localized(lang, `Danh mục ${type === "expense" ? "chi" : "thu"} được xếp riêng theo từng ví trong ${range}.`, `${type === "expense" ? "Spending" : "Income"} categories are ranked separately per wallet for ${range}.`, `${range}的${type === "expense" ? "支出" : "收入"}类别按钱包分别排序。`), figures, limits: labels.assumptions });
  }

  if (query.action === "transactions") {
    const term = normalizeVietnameseMessage(query.searchTerm || query.category || "");
    const matches = records.filter((item) => (!query.transactionType || item.type === query.transactionType) && (!term || normalizeVietnameseMessage(`${item.title} ${item.category} ${item.note || ""}`).includes(term)));
    if (!matches.length) return render(lang, { conclusion: labels.noTransactions, figures: `• ${labels.period}: ${range}${term ? `\n• ${query.searchTerm || query.category}` : ""}`, limits: labels.assumptions });
    const lines = matches.slice(0, 10).map((item) => {
      const currency = state.wallets.find((wallet) => wallet.id === item.wallet)?.currency || "";
      return `• ${item.date.slice(0, 10)} · ${item.title}\n  ${item.category || localized(lang, "Chưa phân loại", "Uncategorized", "未分类")} · ${money(item.amount, currency)}`;
    });
    return render(lang, { conclusion: localized(lang, `Tìm thấy ${matches.length} giao dịch trong ${range}.`, `Found ${matches.length} transactions for ${range}.`, `在${range}找到${matches.length}笔交易。`), figures: lines.join("\n") + (matches.length > 10 ? `\n• ${localized(lang, "Chỉ hiển thị 10 giao dịch đầu.", "Showing the first 10.", "仅显示前10笔。")}` : ""), limits: labels.assumptions });
  }

  if (query.action === "budget_status") {
    const budgets = state.goals.filter((goal) => goal.kind === "budget" && walletIds.has(goal.wallet) && (!query.category || normalizeVietnameseMessage(goal.category || goal.title).includes(normalizeVietnameseMessage(query.category))));
    const summaries = budgets.map((budget) => {
      const summary = budgetSummary(state, budget, today);
      const window = { start: summary.start, end: summary.end };
      const wallet = state.wallets.find((item) => item.id === budget.wallet);
      const matchingCurrency = !!wallet && wallet.currency === budget.currency;
      const actual = matchingCurrency ? summary.actual : 0;
      const expenses = (state.fixedExpenses || []).filter((item) => item.active && item.budgetId === budget.id);
      const planned = matchingCurrency ? summary.planned : 0;
      const due = expenses.flatMap((expense) => plannedOccurrences(expense, today, window.end).map((date) => ({ title: expense.title, amount: expense.amount, date }))).sort((a, b) => a.date.localeCompare(b.date));
      return { budget, window, wallet, matchingCurrency, actual, planned, due };
    });
    const figures = summaries.map(({ budget, window, wallet, matchingCurrency, actual, planned, due }) => {
      if (!matchingCurrency || !wallet) return `• ${budget.title}: ${localized(lang, "ví không tồn tại hoặc tiền tệ ngân sách không khớp; chưa tính số đã chi.", "wallet missing or budget currency mismatch; spending was not calculated.", "钱包不存在或预算币种不一致；未计算支出。")}`;
      const remainder = budget.amount - actual - planned;
      return `• ${budget.title} · ${walletName(wallet.name, lang)} · ${wallet.currency} (${window.start}–${window.end})\n  ${labels.budgetLimit} ${money(budget.amount, budget.currency)} · ${labels.spent} ${money(actual, budget.currency)} · ${labels.fixed} ${money(planned, budget.currency)} · ${labels.afterFixed} ${money(remainder, budget.currency)}${remainder < 0 ? ` · ${labels.over}` : ""}${due.length ? `\n  ${labels.upcoming}: ${due.slice(0, 5).map((item) => `${item.date} ${item.title} ${money(item.amount, budget.currency)}`).join("; ")}` : ""}`;
    }).join("\n");
    const walletFixed = (state.fixedExpenses || []).filter((expense) => expense.active && !expense.budgetId && wallets.some((wallet) => wallet.id === (expense.walletId || "")));
    const extraFixed = walletFixed.flatMap((expense) => {
      const wallet = wallets.find((item) => item.id === expense.walletId);
      if (!wallet || !validAmount(expense.amount)) return [];
      return plannedOccurrences(expense, today, addDays(today, 30)).map((date) => `• ${date} · ${expense.title} · ${money(expense.amount, wallet.currency)} · ${walletName(wallet.name, lang)}`);
    });
    if (!figures && !extraFixed.length) return render(lang, { conclusion: labels.noBudgets, figures: query.category ? `• ${query.category}` : undefined, suggestions: labels.noBudgetSuggestion, limits: labels.assumptions });
    return render(lang, { conclusion: labels.budgetConclusion, figures: [figures, extraFixed.length ? `${labels.extraFixed}:\n${extraFixed.join("\n")}` : ""].filter(Boolean).join("\n"), analysis: labels.budgetAnalysis, limits: labels.assumptions });
  }
  return render(lang, { conclusion: localized(lang, "Mình chưa xử lý được câu hỏi này.", "I couldn't process this question.", "暂时无法处理这个问题。") });
}
