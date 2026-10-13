const normalizeVietnameseMessage = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi").replace(/đ/g, "d").trim();
const symbols: Record<string, string> = { USD: "$", VND: "₫", EUR: "€", GBP: "£", AUD: "A$", SGD: "S$", JPY: "¥" };
const money = (amount: number, currency: string) => `${symbols[currency] || `${currency} `}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount)}`;

type Wallet = { id: string; name: string; currency: string; initial: number; archived?: boolean };
type FinancialTransaction = { id: string; title: string; amount: number; type: "expense" | "income" | "transfer"; category: string; date: string; wallet: string; targetWallet?: string; note?: string };
type BudgetGoal = { id: string; kind: string; title: string; amount: number; saved: number; currency: string; date: string; cycle: string; category: string; wallet: string };
export type FinancialState = { wallets: Wallet[]; transactions: FinancialTransaction[]; goals?: BudgetGoal[] };
export type FinancialAction = "balance" | "spending_summary" | "top_category" | "transactions" | "budget_status" | "explain" | "unknown";
export interface FinancialQuery { action: FinancialAction; walletId: string | null; scope: "selected" | "all"; periodStart: string | null; periodEnd: string | null; category: string | null; searchTerm: string | null; transactionType: "expense" | "income" | null; }

function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + amount);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function periodLabel(start: string, end: string) {
  return start === end ? start : `${start} đến ${end}`;
}

export function answerFinancialQuery(query: FinancialQuery, state: FinancialState, selectedWalletId: string, today: string): string {
  const activeWallets = state.wallets.filter((wallet) => !wallet.archived);
  const selectedWallet = activeWallets.find((wallet) => wallet.id === (query.walletId || selectedWalletId));
  const wallets = query.scope === "all" ? activeWallets : selectedWallet ? [selectedWallet] : [];
  if (query.action === "balance") {
    if (!wallets.length) return "Mình chưa thấy ví đang hoạt động để tính số dư.";
    return wallets.map((wallet) => {
      const records = state.transactions;
      const income = records.filter((item) => item.wallet === wallet.id && item.type === "income").reduce((sum, item) => sum + item.amount, 0);
      const expense = records.filter((item) => item.wallet === wallet.id && item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
      const transferOut = records.filter((item) => item.wallet === wallet.id && item.type === "transfer").reduce((sum, item) => sum + item.amount, 0);
      const transferIn = records.filter((item) => item.targetWallet === wallet.id && item.type === "transfer").reduce((sum, item) => sum + item.amount, 0);
      const balance = wallet.initial + income - expense - transferOut + transferIn;
      return `${wallet.name === "." ? "Ví chính" : wallet.name} (${wallet.currency}): ${money(balance, wallet.currency)}.`;
    }).join("\n");
  }
  if (query.action === "unknown") return "Mình chưa xác định được bạn muốn xem số dư, tổng thu chi, danh mục chi tiêu, ngân sách hay giao dịch nào. Bạn nói rõ thêm một chút nhé.";

  const start = query.periodStart && /^\d{4}-\d{2}-\d{2}$/.test(query.periodStart) ? query.periodStart : `${today.slice(0, 7)}-01`;
  const end = query.periodEnd && /^\d{4}-\d{2}-\d{2}$/.test(query.periodEnd) ? query.periodEnd : today;
  if (start > end || end > today || addDays(start, 3660) < end) return "Khoảng ngày chưa hợp lệ. Bạn cho mình biết ngày bắt đầu và kết thúc nhé.";
  if (!wallets.length) return "Mình chưa thấy ví đang hoạt động phù hợp để tìm dữ liệu.";
  const walletIds = new Set(wallets.map((wallet) => wallet.id));
  const records = state.transactions.filter((item) => item.date >= start && item.date <= end && walletIds.has(item.wallet) && item.type !== "transfer");
  const range = periodLabel(start, end);
  const walletLabel = query.scope === "all" ? "các ví" : wallets[0].name === "." ? "ví chính" : `ví ${wallets[0].name}`;

  if (query.action === "explain") {
    const expenses = records.filter((item) => item.type === "expense");
    const total = expenses.reduce((sum, item) => sum + item.amount, 0);
    if (!expenses.length) return `Mình chưa thấy giao dịch chi tiêu nào của ${walletLabel} trong ${range} để giải thích.`;
    const categoryTotals = new Map<string, number>();
    for (const item of expenses) categoryTotals.set(`${item.wallet}\0${item.category}`, (categoryTotals.get(`${item.wallet}\0${item.category}`) || 0) + item.amount);
    const chosen = query.category
      ? [...categoryTotals.entries()].filter(([key]) => normalizeVietnameseMessage(key.split("\0")[1]).includes(normalizeVietnameseMessage(query.category!))).sort((a, b) => b[1] - a[1])[0]
      : [...categoryTotals.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!chosen) return `Mình chưa tìm thấy chi tiêu thuộc danh mục “${query.category}” trong ${range}.`;
    const [key, amount] = chosen;
    const [walletId, category] = key.split("\0");
    const wallet = state.wallets.find((item) => item.id === walletId)!;
    const percent = total ? Math.round(amount / total * 100) : 0;
    return `Theo giao dịch đã lưu trong ${range}, ${category} là khoản chi lớn nhất: ${money(amount, wallet.currency)} (${percent}% tổng chi ${money(total, wallet.currency)}). Dữ liệu cho biết khoản nào cao hơn; không cho biết nguyên nhân bên ngoài giao dịch.`;
  }

  if (query.action === "spending_summary") {
    if (query.scope === "all" && new Set(wallets.map((wallet) => wallet.currency)).size > 1) {
      return wallets.map((wallet) => {
        const own = records.filter((item) => item.wallet === wallet.id);
        const income = own.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
        const expense = own.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
        return `${wallet.name === "." ? "Ví chính" : wallet.name}: thu ${money(income, wallet.currency)}, chi ${money(expense, wallet.currency)}.`;
      }).join("\n");
    }
    const currency = wallets[0].currency;
    const income = records.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
    const expense = records.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
    return `Trong ${range}, ${walletLabel} có ${money(income, currency)} thu nhập và ${money(expense, currency)} chi tiêu (${records.length} giao dịch thu/chi).`;
  }

  if (query.action === "top_category") {
    const type = query.transactionType || "expense";
    const grouped = new Map<string, number>();
    for (const item of records) if (item.type === type && (!query.category || normalizeVietnameseMessage(item.category).includes(normalizeVietnameseMessage(query.category)))) grouped.set(`${item.wallet}\0${item.category}`, (grouped.get(`${item.wallet}\0${item.category}`) || 0) + item.amount);
    const ranked = [...grouped.entries()].sort((left, right) => right[1] - left[1]);
    if (!ranked.length) return `Mình chưa tìm thấy khoản ${type === "expense" ? "chi" : "thu"} nào trong ${range} để so sánh.`;
    const lines = ranked.slice(0, 5).map(([key, amount], index) => {
      const [walletId, category] = key.split("\0");
      const wallet = state.wallets.find((item) => item.id === walletId)!;
      return `${index + 1}. ${category} — ${money(amount, wallet.currency)}${query.scope === "all" ? ` (${wallet.name === "." ? "Ví chính" : wallet.name})` : ""}`;
    });
    return `Danh mục ${type === "expense" ? "chi" : "thu"} nhiều nhất trong ${range}:\n${lines.join("\n")}`;
  }

  if (query.action === "transactions") {
    const term = normalizeVietnameseMessage(query.searchTerm || query.category || "");
    const matches = records.filter((item) => (!query.transactionType || item.type === query.transactionType) && (!term || normalizeVietnameseMessage(`${item.title} ${item.category} ${item.note || ""}`).includes(term)));
    if (!matches.length) return `Mình không tìm thấy giao dịch nào khớp trong ${range}.`;
    return `Mình tìm thấy ${matches.length} giao dịch trong ${range}:\n${matches.slice(0, 5).map((item) => {
      const currency = state.wallets.find((wallet) => wallet.id === item.wallet)?.currency || "";
      return `• ${item.date} · ${item.title}\n  ${item.category} · ${money(item.amount, currency)}`;
    }).join("\n\n")}${matches.length > 5 ? "\n\nMình chỉ hiển thị 5 giao dịch gần nhất." : ""}`;
  }

  if (query.action === "budget_status") {
    const goals = (state.goals || []).filter((goal) => goal.kind === "budget" && (!goal.wallet || walletIds.has(goal.wallet)) && (!query.category || normalizeVietnameseMessage(goal.category || goal.title).includes(normalizeVietnameseMessage(query.category))));
    if (!goals.length) return "Mình chưa thấy ngân sách chi tiêu được lưu phù hợp trong ví đã chọn.";
    return goals.map((goal) => {
      const wallet = state.wallets.find((item) => item.id === goal.wallet) || wallets[0];
      const spent = goal.category ? records.filter((item) => item.wallet === wallet.id && item.type === "expense" && normalizeVietnameseMessage(item.category) === normalizeVietnameseMessage(goal.category)).reduce((sum, item) => sum + item.amount, 0) : null;
      return spent === null
        ? `${goal.title}: mục tiêu ${money(goal.amount, goal.currency)}, đã ghi nhận ${money(goal.saved, goal.currency)}.`
        : `${goal.title}: ngân sách ${money(goal.amount, goal.currency)}, đã chi ${money(spent, goal.currency)} trong ${range}.`;
    }).join("\n");
  }
  return "Mình chưa xử lý được câu hỏi này.";
}
