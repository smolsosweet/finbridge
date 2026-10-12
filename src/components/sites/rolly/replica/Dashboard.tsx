"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, ChevronDown, Info, Pencil, Plus, ReceiptText, Search, Trophy, Wallet, X } from "lucide-react";
import { EmptyState, Icon, Modal } from "./Ui";
import { currencySymbol, money, useAppState, type Transaction } from "./store";
import { calendarWeek, localDateKey, shiftCalendarWeek } from "./chartWeek";

type DashboardSample = {
  id: string;
  date: string;
  type: "expense" | "income" | "transfer";
  amount: number;
  category: string;
  currency: string;
  title?: string;
  wallet?: string;
  targetWallet?: string;
  note?: string;
};

const DASHBOARD_SAMPLE: DashboardSample[] = [
  // Tháng 7 (15/07 - 31/07)
  { id: "sample-01", date: "2026-07-16", type: "expense", amount: 700000, category: "Hóa đơn & Tiện ích", currency: "VND", title: "Phí thường niên thẻ thanh toán" },
  { id: "sample-02", date: "2026-07-18", type: "expense", amount: 920000, category: "Ăn uống", currency: "VND", title: "Siêu thị thực phẩm tuần" },
  { id: "sample-03", date: "2026-07-24", type: "expense", amount: 165000, category: "Di chuyển", currency: "VND", title: "Grab Car di chuyển công tác" },
  { id: "sample-04", date: "2026-07-28", type: "expense", amount: 450000, category: "Ăn uống", currency: "VND", title: "Ăn tối họp mặt bạn bè" },

  // Tháng 8 (01/08 - 31/08)
  { id: "sample-05", date: "2026-08-02", type: "expense", amount: 65000, category: "Ăn uống", currency: "VND", title: "Cà phê sáng Highlands" },
  { id: "sample-06", date: "2026-08-05", type: "income", amount: 20000000, category: "Lương", currency: "VND", title: "Lương tháng 7 - Công ty FinBridge" },
  { id: "sample-07", date: "2026-08-08", type: "expense", amount: 380000, category: "Di chuyển", currency: "VND", title: "Bảo dưỡng & thay dầu xe máy" },
  { id: "sample-08", date: "2026-08-10", type: "expense", amount: 7500000, category: "Nhà ở", currency: "VND", title: "Tiền thuê căn hộ tháng 8" },
  { id: "sample-09", date: "2026-08-15", type: "expense", amount: 1650000, category: "Hóa đơn & Tiện ích", currency: "VND", title: "Điện nước & Internet FPT T8" },
  { id: "sample-10", date: "2026-08-18", type: "expense", amount: 780000, category: "Ăn uống", currency: "VND", title: "Ăn tối nhà hàng Pizza 4P's" },
  { id: "sample-11", date: "2026-08-20", type: "income", amount: 2500000, category: "Thu nhập", currency: "VND", title: "Thưởng hoàn thành dự án Q2" },
  { id: "sample-12", date: "2026-08-22", type: "expense", amount: 1450000, category: "Mua sắm", currency: "VND", title: "Giày chạy bộ rèn luyện sức khỏe" },
  { id: "sample-13", date: "2026-08-25", type: "transfer", amount: 5000000, category: "Chuyển khoản nội bộ", currency: "VND", title: "Trích tiết kiệm tích lũy sang ví phụ" },
  { id: "sample-14", date: "2026-08-28", type: "expense", amount: 960000, category: "Ăn uống", currency: "VND", title: "Siêu thị Co.opmart thực phẩm" },

  // Tháng 9 (01/09 - 30/09)
  { id: "sample-15", date: "2026-09-02", type: "expense", amount: 280000, category: "Giải trí", currency: "VND", title: "Vé xem phim CGV cuối tuần" },
  { id: "sample-16", date: "2026-09-04", type: "expense", amount: 4500000, category: "Mua sắm", currency: "VND", title: "Khóa học phân tích dữ liệu nâng cao" },
  { id: "sample-17", date: "2026-09-05", type: "income", amount: 20000000, category: "Lương", currency: "VND", title: "Lương tháng 8 - Công ty FinBridge" },
  { id: "sample-18", date: "2026-09-08", type: "expense", amount: 120000, category: "Di chuyển", currency: "VND", title: "Đổ xăng xe máy Petrolimex" },
  { id: "sample-19", date: "2026-09-10", type: "expense", amount: 7500000, category: "Nhà ở", currency: "VND", title: "Tiền thuê căn hộ tháng 9" },
  { id: "sample-20", date: "2026-09-15", type: "expense", amount: 1720000, category: "Hóa đơn & Tiện ích", currency: "VND", title: "Điện nước & Internet FPT T9" },
  { id: "sample-21", date: "2026-09-18", type: "expense", amount: 3200000, category: "Mua sắm", currency: "VND", title: "Bàn làm việc công thái học" },
  { id: "sample-22", date: "2026-09-19", type: "expense", amount: 880000, category: "Ăn uống", currency: "VND", title: "Siêu thị WinMart thực phẩm tươi" },
  { id: "sample-23", date: "2026-09-22", type: "expense", amount: 1850000, category: "Mua sắm", currency: "VND", title: "Nồi cơm điện tử cao cấp" },
  { id: "sample-24", date: "2026-09-24", type: "expense", amount: -480000, category: "Mua sắm", currency: "VND", title: "Hoàn tiền đơn hàng Shopee bị hủy" },
  { id: "sample-25", date: "2026-09-27", type: "expense", amount: 320000, category: "Mua sắm", currency: "VND", title: "Sách tài chính & đầu tư" },
  { id: "sample-26", date: "2026-09-29", type: "expense", amount: 95000, category: "Ăn uống", currency: "VND", title: "Cơm trưa văn phòng" },

  // Tháng 10 (01/10 - 12/10)
  { id: "sample-27", date: "2026-10-02", type: "expense", amount: 145000, category: "Ăn uống", currency: "VND", title: "Cà phê trao đổi đối tác" },
  { id: "sample-28", date: "2026-10-05", type: "income", amount: 20000000, category: "Lương", currency: "VND", title: "Lương tháng 9 - Công ty FinBridge" },
  { id: "sample-29", date: "2026-10-08", type: "expense", amount: 1050000, category: "Ăn uống", currency: "VND", title: "Siêu thị Tops Market cuối tuần" },
  { id: "sample-30", date: "2026-10-10", type: "expense", amount: 7500000, category: "Nhà ở", currency: "VND", title: "Tiền thuê căn hộ tháng 10" },
  { id: "sample-31", date: "2026-10-11", type: "expense", amount: 250000, category: "Hóa đơn & Tiện ích", currency: "VND", title: "Gói cước di động 4G Viettel" },
];

export const DASHBOARD_I18N = {
  vi: {
    cardTitle: "Xu hướng chi tiêu",
    cardSubtitle: "Theo dõi thu, chi và dòng tiền theo thời gian",
    viewTransactions: "Xem giao dịch",
    periodLabel: "Khoảng thời gian",
    selectWeek: "Chọn ngày trong tuần",
    previousWeek: "Tuần trước",
    nextWeek: "Tuần sau",
    currentWeek: "Tuần hiện tại",
    period7d: "7 ngày",
    period30d: "30 ngày",
    period90d: "90 ngày",
    periodAll: "Toàn bộ dữ liệu",
    periodCustom: "Phạm vi tùy chỉnh",
    fromDate: "Từ ngày",
    toDate: "Đến ngày",
    typeFilter: "Lọc loại giao dịch",
    typeAll: "Tất cả",
    typeExpense: "Chi",
    typeIncome: "Thu",
    categoryFilter: "Lọc danh mục",
    allCategories: "Tất cả danh mục",
    accountFilter: "Chọn tài khoản",
    allAccounts: "Tất cả ví",
    currencyFilter: "Chọn tiền tệ",
    simulated: "Mô phỏng",
    emptyText: "Chưa có dữ liệu phù hợp với bộ lọc này.",
    resetFilters: "Đặt lại bộ lọc",
    summaryIncome: "Thu",
    summaryExpense: "Chi",
    summaryNet: "Ròng",
    summaryTransactions: "giao dịch",
    tooltipPeriod: "Kỳ",
    tooltipCount: "Số GD",
    tableCaption: "Bảng dữ liệu dòng tiền theo thời gian",
    tableColPeriod: "Kỳ",
    tableColIncome: "Thu nhập",
    tableColExpense: "Chi phí",
    tableColNet: "Ròng",
    tableColCount: "Giao dịch",
  },
  en: {
    cardTitle: "Spending trend",
    cardSubtitle: "Track income, expenses, and cash flow over time",
    viewTransactions: "View transactions",
    periodLabel: "Time period",
    selectWeek: "Choose a date in the week",
    previousWeek: "Previous week",
    nextWeek: "Next week",
    currentWeek: "This week",
    period7d: "7 days",
    period30d: "30 days",
    period90d: "90 days",
    periodAll: "All data",
    periodCustom: "Custom range",
    fromDate: "From date",
    toDate: "To date",
    typeFilter: "Filter transaction type",
    typeAll: "All",
    typeExpense: "Expense",
    typeIncome: "Income",
    categoryFilter: "Filter category",
    allCategories: "All categories",
    accountFilter: "Select account",
    allAccounts: "All accounts",
    currencyFilter: "Select currency",
    simulated: "Simulated",
    emptyText: "No transactions match these filters.",
    resetFilters: "Reset filters",
    summaryIncome: "Income",
    summaryExpense: "Expense",
    summaryNet: "Net",
    summaryTransactions: "transactions",
    tooltipPeriod: "Period",
    tooltipCount: "Count",
    tableCaption: "Cash flow summary table over time",
    tableColPeriod: "Period",
    tableColIncome: "Income",
    tableColExpense: "Expense",
    tableColNet: "Net",
    tableColCount: "Count",
  },
  zh: {
    cardTitle: "支出趋势",
    cardSubtitle: "追踪各时期的收入、支出与现金流",
    viewTransactions: "查看交易",
    periodLabel: "时间范围",
    selectWeek: "选择周内日期",
    previousWeek: "上一周",
    nextWeek: "下一周",
    currentWeek: "本周",
    period7d: "7天",
    period30d: "30天",
    period90d: "90天",
    periodAll: "全部数据",
    periodCustom: "自定义范围",
    fromDate: "起始日期",
    toDate: "结束日期",
    typeFilter: "筛选交易类型",
    typeAll: "全部",
    typeExpense: "支出",
    typeIncome: "收入",
    categoryFilter: "筛选分类",
    allCategories: "全部分类",
    accountFilter: "选择账户",
    allAccounts: "全部账户",
    currencyFilter: "选择货币",
    simulated: "模拟",
    emptyText: "没有符合此筛选条件的交易。",
    resetFilters: "重置筛选",
    summaryIncome: "收入",
    summaryExpense: "支出",
    summaryNet: "净额",
    summaryTransactions: "笔交易",
    tooltipPeriod: "期间",
    tooltipCount: "笔数",
    tableCaption: "各期现金流汇总数据表",
    tableColPeriod: "期间",
    tableColIncome: "收入",
    tableColExpense: "支出",
    tableColNet: "净额",
    tableColCount: "笔数",
  },
};

function getLanguage(langSetting: unknown): "vi" | "en" | "zh" {
  const str = String(langSetting || "").toLowerCase();
  if (str.includes("zh") || str.includes("chinese") || str.includes("trung") || str.includes("中文")) return "zh";
  if (str.includes("en") || str.includes("english") || str.includes("anh")) return "en";
  return "vi";
}

function getNiceScale(maxValue: number, tickCount = 4) {
  if (maxValue <= 0) return { max: 100, step: 25, ticks: [0, 25, 50, 75, 100] };
  const rawStep = maxValue / tickCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  let niceStep = magnitude;
  if (normalized <= 1) niceStep = 1 * magnitude;
  else if (normalized <= 2) niceStep = 2 * magnitude;
  else if (normalized <= 2.5) niceStep = 2.5 * magnitude;
  else if (normalized <= 5) niceStep = 5 * magnitude;
  else niceStep = 10 * magnitude;
  const niceMax = niceStep * tickCount >= maxValue ? niceStep * tickCount : niceStep * (tickCount + 1);
  const ticks: number[] = [];
  for (let t = 0; t <= niceMax + 1e-6; t += niceStep) {
    ticks.push(Number(t.toPrecision(12)));
  }
  return { max: ticks[ticks.length - 1], step: niceStep, ticks };
}

function formatCompactMoney(amount: number, currency: string, lang: "vi" | "en" | "zh") {
  if (amount === 0) return currency === "VND" ? "0 ₫" : currencySymbol(currency) + "0";
  if (currency === "VND") {
    if (amount >= 1_000_000_000) {
      const v = (amount / 1_000_000_000).toLocaleString(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 1 });
      return lang === "vi" ? `${v} tỷ ₫` : lang === "zh" ? `${v}0亿 ₫` : `${v}B ₫`;
    }
    if (amount >= 1_000_000) {
      const v = (amount / 1_000_000).toLocaleString(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 1 });
      return lang === "vi" ? `${v} tr ₫` : lang === "zh" ? `${Math.round(amount / 10000)}万 ₫` : `${v}M ₫`;
    }
    if (amount >= 1_000) {
      const v = (amount / 1_000).toLocaleString(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 0 });
      return lang === "vi" ? `${v} k ₫` : lang === "zh" ? `${(amount / 10000).toFixed(1)}万 ₫` : `${v}K ₫`;
    }
    return `${amount.toLocaleString(lang === "vi" ? "vi-VN" : "en-US")} ₫`;
  }
  const sym = currencySymbol(currency);
  if (amount >= 1_000_000) {
    const v = (amount / 1_000_000).toLocaleString(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 1 });
    return `${sym}${v}M`;
  }
  if (amount >= 1_000) {
    const v = (amount / 1_000).toLocaleString(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 1 });
    return `${sym}${v}K`;
  }
  return `${sym}${amount.toLocaleString("en-US")}`;
}


export function MonthCalendar({ month, year, transactions = [], onPick }: { month: number; year: number; transactions?: Transaction[]; onPick?: (date: string) => void }) {
  const start = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  return <div className="r-calendar"><div className="r-calendar-week">{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => <span key={day}>{day}</span>)}</div><div className="r-calendar-days">{Array.from({ length: Math.ceil((start + count) / 7) * 7 }, (_, i) => {
    const date = new Date(year, month, i - start + 1);
    const value = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
    const records = transactions.filter((t) => t.date === value);
    return <button key={value} type="button" className={date.getMonth() !== month ? "r-other-month" : ""} onClick={() => onPick?.(value)}><span>{date.getDate()}</span>{records.length > 0 && <small className={records.reduce((a, t) => a + (t.type === "income" ? t.amount : -t.amount), 0) < 0 ? "r-expense" : "r-income"}>{money(records.reduce((a, t) => a + (t.type === "income" ? t.amount : -t.amount), 0))}</small>}</button>;
  })}</div></div>;
}

export function Dashboard({ transactionsTab = false, navigate }: { transactionsTab?: boolean; navigate: (screen: string) => void }) {
  const state = useAppState();
  const searchParams = useSearchParams();
  const lang = getLanguage(state.settings.language);
  const t = DASHBOARD_I18N[lang];

  const queryType = searchParams.get("type");
  const queryCategory = searchParams.get("category");
  const queryFrom = searchParams.get("from");
  const queryTo = searchParams.get("to");
  const queryWallet = searchParams.get("wallet");
  const querySource = searchParams.get("source");

  const [walletId, setWalletId] = useState(queryWallet || state.wallets[0].id);
  const wallet = state.wallets.find((w) => w.id === walletId) || state.wallets[0];
  const [period, setPeriod] = useState("Tháng");
  const [month, setMonth] = useState(9);
  const [year, setYear] = useState(2026);
  const [day, setDay] = useState("2026-10-12");
  const [from, setFrom] = useState("2026-10-01");
  const [to, setTo] = useState("2026-10-31");
  const [type, setType] = useState<"expense" | "income">("expense");

  // Spending trend chart filter state
  const [dashboardSource] = useState<"sample" | "live">(querySource === "live" ? "live" : "sample");
  const [dashboardType, setDashboardType] = useState<"all" | "expense" | "income">((queryType as "all" | "expense" | "income") || "all");
  const [dashboardCategory, setDashboardCategory] = useState(queryCategory || "all");
  const dashboardCurrency = wallet.currency;
  const [dashboardWeek, setDashboardWeek] = useState(() => calendarWeek(localDateKey(new Date())).start);
  const [focusedBucketKey, setFocusedBucketKey] = useState<string | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [modal, setModal] = useState("");

  const currencies = Array.from(new Set(state.wallets.map((item) => item.currency)));
  // Sample rows without a wallet ID belong to the first wallet with their currency.
  const rawDashboardData = dashboardSource === "sample"
    ? DASHBOARD_SAMPLE.filter((tx) => tx.type !== "transfer" && tx.currency === wallet.currency && (tx.wallet || state.wallets.find((item) => item.currency === tx.currency)?.id) === wallet.id)
    : state.transactions.filter((tx) => tx.type !== "transfer" && tx.wallet === wallet.id);

  const week = calendarWeek(dashboardWeek);
  const chartStart = week.start;
  const chartEnd = week.end;
  const weekdayNames = {
    vi: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
    en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    zh: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
  };
  const weekRangeLabel = new Intl.DateTimeFormat(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  const formattedWeekRange = weekRangeLabel.format(new Date(chartStart + "T12:00:00")) + " – " + weekRangeLabel.format(new Date(chartEnd + "T12:00:00"));

  const dashboardCategories = Array.from(new Set(rawDashboardData.map((tx) => tx.category))).sort();

  // Filter transactions according to selected filters
  const dashboardRecords = rawDashboardData.filter((tx) => {
    if (tx.date < chartStart || tx.date > chartEnd) return false;
    if (dashboardCategory !== "all" && tx.category !== dashboardCategory) return false;
    if (dashboardType !== "all" && tx.type !== dashboardType) return false;
    return true;
  });

  // Calculate totals without floating point precision issues (in integer minor units / cents)
  const totalIncomeMinor = dashboardRecords.filter((t) => t.type === "income").reduce((acc, t) => acc + Math.round(t.amount * 100), 0);
  const totalExpenseMinor = dashboardRecords.filter((t) => t.type === "expense").reduce((acc, t) => acc + Math.round(t.amount * 100), 0);
  const totalIncome = totalIncomeMinor / 100;
  const totalExpense = totalExpenseMinor / 100;
  const totalNet = (totalIncomeMinor - totalExpenseMinor) / 100;
  const totalCount = dashboardRecords.length;

  const buckets = week.days.map((key, index) => {
    const txs = dashboardRecords.filter((tx) => tx.date === key);
    return {
      key,
      label: weekdayNames[lang][index],
      fullDateLabel: key,
      income: txs.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + Math.round(tx.amount * 100), 0) / 100,
      expense: txs.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + Math.round(tx.amount * 100), 0) / 100,
      count: txs.length,
    };
  });

  // Calculate chart scale
  const maxBucketVal = Math.max(1, ...buckets.flatMap((b) => [b.income, b.expense]));
  const scale = getNiceScale(maxBucketVal, 4);
  const niceMax = scale.max;

  // SVG Geometry
  const chartWidth = 960;
  const chartHeight = 240;
  const marginLeft = 65;
  const marginRight = 20;
  const marginTop = 20;
  const baselineY = 195;
  const plotWidth = chartWidth - marginLeft - marginRight;
  const plotHeight = baselineY - marginTop;

  // View transactions handler to open Transactions tab with identical filters
  const openTransactionsWithFilters = () => {
    const query = new URLSearchParams();
    query.set("tab", "transactions");
    query.set("source", dashboardSource);
    query.set("type", dashboardType);
    query.set("category", dashboardCategory);
    query.set("from", chartStart);
    query.set("to", chartEnd);
    query.set("currency", dashboardCurrency);
    query.set("wallet", wallet.id);
    navigate("?" + query.toString());
  };

  // Transactions list for Transactions tab (or bottom list)
  const isFilteredFromDashboard = transactionsTab && (queryFrom || queryTo || queryType || queryCategory || querySource === "sample");
  const rawTxList = (transactionsTab && querySource === "sample")
    ? DASHBOARD_SAMPLE
    : state.transactions;

  const records = rawTxList.filter((t) => {
    if (!transactionsTab && t.wallet !== wallet.id && t.targetWallet !== wallet.id) return false;
    if (transactionsTab && queryWallet) {
      const sourceWallet = t.wallet || ("currency" in t ? state.wallets.find((item) => item.currency === t.currency)?.id : undefined);
      if (sourceWallet !== queryWallet && t.targetWallet !== queryWallet) return false;
    }
    if (isFilteredFromDashboard) {
      if (queryFrom && t.date < queryFrom) return false;
      if (queryTo && t.date > queryTo) return false;
      if (queryType && queryType !== "all" && t.type !== queryType) return false;
      if (queryCategory && queryCategory !== "all" && t.category !== queryCategory) return false;
      return (t.title || t.category || "").toLowerCase().includes(search.toLowerCase());
    }
    if (period === "Tháng" && !t.date.startsWith(year + "-" + String(month + 1).padStart(2, "0"))) return false;
    if (period === "Năm" && !t.date.startsWith(String(year))) return false;
    if (period === "Ngày" && t.date !== day) return false;
    if ((period === "Phạm vi tùy chỉnh" || period === "Tuần") && (t.date < from || t.date > to)) return false;
    return ((t.title || "") + t.category + (t.note || "")).toLowerCase().includes(search.toLowerCase());
  });

  const expense = records.filter((t) => t.type === "expense").reduce((a, t) => a + t.amount, 0);
  const income = records.filter((t) => t.type === "income").reduce((a, t) => a + t.amount, 0);
  const allBalance = wallet.initial + state.transactions.reduce((a, t) => a + (t.wallet === wallet.id ? (t.type === "income" ? t.amount : -t.amount) : t.targetWallet === wallet.id ? t.amount : 0), 0);

  const isInSelectedPeriod = (date: string) => {
    if (period === "Tháng" && !date.startsWith(year + "-" + String(month + 1).padStart(2, "0"))) return false;
    if (period === "Năm" && !date.startsWith(String(year))) return false;
    if (period === "Ngày" && date !== day) return false;
    if ((period === "Phạm vi tùy chỉnh" || period === "Tuần") && (date < from || date > to)) return false;
    return true;
  };
  const overviewRecords = state.transactions.filter((transaction) => isInSelectedPeriod(transaction.date));
  const walletFlows = state.wallets.map((item) => {
    const walletRecords = overviewRecords.filter((transaction) => transaction.wallet === item.id);
    return {
      wallet: item,
      expense: walletRecords.filter((transaction) => transaction.type === "expense").reduce((total, transaction) => total + transaction.amount, 0),
      income: walletRecords.filter((transaction) => transaction.type === "income").reduce((total, transaction) => total + transaction.amount, 0),
    };
  });
  const totalsByCurrency = (field: "expense" | "income" | "net") => {
    const groups = new Map<string, number>();
    walletFlows.forEach((flow) => {
      const value = field === "net" ? flow.income - flow.expense : flow[field];
      groups.set(flow.wallet.currency, (groups.get(flow.wallet.currency) || 0) + value);
    });
    return Array.from(groups, ([curr, amount]) => ({ currency: curr, amount }));
  };
  const formatTotals = (field: "expense" | "income" | "net") => totalsByCurrency(field).map((total) => money(total.amount, total.currency)).join(" · ");

  const walletBalanceTotals = currencies.map((curr) => {
    const amount = state.wallets.filter((item) => item.currency === curr).reduce((sum, item) => sum + item.initial + state.transactions.reduce((balance, transaction) => balance + (transaction.wallet === item.id ? (transaction.type === "income" ? transaction.amount : -transaction.amount) : transaction.targetWallet === item.id ? transaction.amount : 0), 0), 0);
    return money(amount, curr);
  }).join(" · ");

  const list = transactionsTab ? records : records.filter((t) => t.type === type);
  const close = () => setModal("");
  const addTransaction = () => navigate(state.settings.manual ? "addTransaction" : "addTransactionChatMode");
  const walletName = (name: string) => name === "." ? "Ví chính" : name;
  const periodControls = <div className="r-period-controls"><button type="button" onClick={() => setModal("period")} className="r-period">{period}<CalendarDays size={17} /><ChevronDown size={17} /></button>{period !== "Mọi thời gian" && <button type="button" onClick={() => setModal(period === "Tháng" ? "month" : "range")} className="r-period-date">{period === "Tháng" ? "tháng " + (month + 1) + " năm " + year : period === "Năm" ? year : period === "Ngày" ? day : from + " – " + to}<ChevronDown size={15} /></button>}</div>;
  const transactionRows = <div className="r-record-list">{list.map((t) => <button key={t.id} type="button" className="r-record" onClick={() => navigate("editTransaction?id=" + t.id)}><span className="r-category-symbol">{transactionsTab ? (t.category === "Thức ăn & Đồ uống" ? "🍔" : t.type === "income" ? "💰" : "🛍️") : t.type === "income" ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}</span><span><b>{t.category}</b><small>{t.title} · {t.date}</small></span><b className={t.type === "income" ? "r-income" : "r-expense"}>{t.type === "income" ? "+" : "−"}{money(t.amount, wallet.currency)}</b></button>)}</div>;

  const focusedBucket = buckets.find((b) => b.key === focusedBucketKey);

  return <div className={"r-dashboard " + (transactionsTab ? "r-transactions" : "r-home fb-home")}>
    {transactionsTab ? <>
      <div className="r-transactions-heading"><h1>Giao dịch</h1><div><button type="button" className="r-icon-button" onClick={() => setModal("search")} aria-label="Tìm kiếm giao dịch"><Search size={22} /></button><button type="button" className="r-icon-button" onClick={() => navigate("calendar")} aria-label="Lịch giao dịch"><CalendarDays size={22} /></button></div></div>
      <button type="button" className="r-wallet-chip" onClick={() => setModal("wallet")}><Icon code="f555" />{wallet.name}<ChevronDown size={13} /></button>
      {periodControls}
      <button type="button" className="r-totals-strip" onClick={() => setModal("totals")}><span className="r-expense">▼ {money(expense, wallet.currency)}</span><span className="r-income">▲ {money(income, wallet.currency)}</span><span>∑ {money(income - expense, wallet.currency)}</span></button>
      {list.length === 0 ? <EmptyState title="Chưa có giao dịch trong kỳ này." text="Nhấn + để thêm giao dịch." className="r-dashboard-empty" /> : transactionRows}
      <button type="button" className="r-fab" aria-label="Thêm giao dịch" onClick={addTransaction}><Plus size={32} /></button>
    </> : <>
      <header className="fb-home-header">
        <div className="fb-brand"><span className="fb-brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M5 24V13M27 24V13M5 17C11 5 21 5 27 17M5 20H27M11 20V24M16 20V24M21 20V24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg></span><span>FinBridge<small>Không gian tài chính của bạn</small></span></div>
        <button type="button" className="fb-milestones" onClick={() => navigate("milestones")}><Trophy size={17} />Những cột mốc<ArrowRight size={15} /></button>
      </header>
      <div className="fb-home-intro"><div><p className="fb-eyebrow">TỔNG QUAN</p><h1>{state.settings.name && state.settings.name !== "." ? `Chào ${state.settings.name}` : "Tiền của bạn, trong tầm tay."}</h1><p>Theo dõi dòng tiền. Chủ động cho những kế hoạch tiếp theo.</p></div><button type="button" className="fb-add-button" onClick={addTransaction}><Plus size={18} />Thêm giao dịch</button></div>
      <section className="fb-wallet-section" aria-label="Ví của bạn"><div className="fb-section-heading"><h2>Ví của bạn</h2><span>{state.wallets.length} ví</span></div>
        <div className="r-wallets">{state.wallets.map((w) => <div key={w.id} className={"r-wallet-card " + (w.id === wallet.id ? "is-selected" : "")}><button type="button" onClick={() => setWalletId(w.id)} className="r-wallet-content" aria-label={"Chọn ví " + w.name} aria-pressed={w.id === wallet.id}><Wallet size={19} /><span>{walletName(w.name)}</span><b>{money(w.initial + state.transactions.reduce((a, t) => a + (t.wallet === w.id ? (t.type === "income" ? t.amount : -t.amount) : t.targetWallet === w.id ? t.amount : 0), 0), w.currency)}</b></button><button type="button" className="r-wallet-edit" aria-label={"Sửa ví " + w.name} onClick={() => navigate("walletSettings?wallet=" + w.id)}><Pencil size={14} /></button></div>)}<button type="button" className="r-new-wallet" onClick={() => navigate("createWallet1")}><Plus size={20} /><span>Thêm ví</span></button></div>
      </section>
      <section className="fb-finance-dashboard" aria-label="Dashboard dòng tiền">
        <section className="fb-overview fb-finance-overview"><div className="fb-section-heading"><div><h2>Dòng tiền trong kỳ</h2><p className="fb-section-note">Tổng hợp từ tất cả ví đã tích hợp</p></div>{periodControls}</div>
          <button type="button" className="r-summary" onClick={() => setModal("homeTotals")} aria-label="Xem chi tiết tổng dòng tiền"><div className="r-summary-top"><span><small>Tổng số dư tất cả ví</small><b>{walletBalanceTotals}</b><small>{state.wallets.length} ví · Số dư hiện tại</small></span><span className="fb-detail-label">Chi tiết<Info size={16} /></span></div><div className="r-summary-cards"><div className="r-expense"><span><ArrowDownRight size={18} />Tổng chi</span><b>{formatTotals("expense")}</b><small>Từ mọi ví trong kỳ</small></div><div className="r-income"><span><ArrowUpRight size={18} />Tổng thu</span><b>{formatTotals("income")}</b><small>Từ mọi ví trong kỳ</small></div></div><p className="fb-currency-note">Tiền tệ được hiển thị riêng, không quy đổi tỷ giá.</p></button>
        </section>

        {/* Production-grade Spending Trend card */}
        <section className="fb-activity fb-spending-dashboard" aria-labelledby="fb-spending-trend-heading">
          <div className="fb-section-heading">
            <div>
              <h2 id="fb-spending-trend-heading">{t.cardTitle}</h2>
              <p className="fb-section-note">{t.cardSubtitle}</p>
            </div>
            <button type="button" className="fb-view-transactions" onClick={openTransactionsWithFilters}>
              {t.viewTransactions}<ArrowRight size={15} />
            </button>
          </div>

          <div className="fb-chart-controls">
            <div className="fb-chart-date-bar">
              <div className="fb-chart-nav-cluster">
                <button
                  type="button"
                  className="fb-nav-btn prev"
                  aria-label={t.previousWeek}
                  onClick={() => { setDashboardWeek(shiftCalendarWeek(chartStart, -1)); setFocusedBucketKey(null); }}
                >
                  ‹
                </button>
                <div
                  className="fb-chart-range-pill"
                  role="button"
                  tabIndex={0}
                  title={t.selectWeek}
                  onClick={() => {
                    const input = dateInputRef.current;
                    if (input) {
                      if ("showPicker" in input && typeof input.showPicker === "function") {
                        try { input.showPicker(); return; } catch {}
                      }
                      input.focus();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      const input = dateInputRef.current;
                      if (input) {
                        if ("showPicker" in input && typeof input.showPicker === "function") {
                          try { input.showPicker(); return; } catch {}
                        }
                        input.focus();
                      }
                    }
                  }}
                >
                  <CalendarDays size={15} />
                  <span>{formattedWeekRange}</span>
                  <input
                    ref={dateInputRef}
                    type="date"
                    aria-label={t.selectWeek}
                    value={dashboardWeek}
                    tabIndex={-1}
                    className="fb-hidden-date-input"
                    onChange={(event) => {
                      if (event.currentTarget.validity.valid && event.currentTarget.value) {
                        setDashboardWeek(calendarWeek(event.currentTarget.value).start);
                        setFocusedBucketKey(null);
                      }
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="fb-nav-btn next"
                  aria-label={t.nextWeek}
                  onClick={() => { setDashboardWeek(shiftCalendarWeek(chartStart, 1)); setFocusedBucketKey(null); }}
                >
                  ›
                </button>
                <button
                  type="button"
                  className="fb-chart-this-week-btn"
                  onClick={() => { setDashboardWeek(calendarWeek(localDateKey(new Date())).start); setFocusedBucketKey(null); }}
                >
                  {t.currentWeek}
                </button>
              </div>
            </div>

            <div className="fb-chart-filter-bar">
              {/* Type filter */}
              <div className="r-type-pills" role="radiogroup" aria-label={t.typeFilter}>
                <button type="button" role="radio" aria-checked={dashboardType === "all"} className={dashboardType === "all" ? "active" : ""} onClick={() => setDashboardType("all")}>{t.typeAll}</button>
                <button type="button" role="radio" aria-checked={dashboardType === "expense"} className={dashboardType === "expense" ? "active" : ""} onClick={() => setDashboardType("expense")}>{t.typeExpense}</button>
                <button type="button" role="radio" aria-checked={dashboardType === "income"} className={dashboardType === "income" ? "active" : ""} onClick={() => setDashboardType("income")}>{t.typeIncome}</button>
              </div>

              {/* Category filter */}
              <label className="fb-chart-select">
                <span className="sr-only">{t.categoryFilter}</span>
                <select aria-label={t.categoryFilter} value={dashboardCategory} onChange={(e) => setDashboardCategory(e.target.value)}>
                  <option value="all">{t.allCategories}</option>
                  {dashboardCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <ChevronDown size={15} />
              </label>

              <label className="fb-chart-select">
                <span className="sr-only">{t.accountFilter}</span>
                <select aria-label={t.accountFilter} value={wallet.id} onChange={(event) => { setWalletId(event.target.value); setDashboardCategory("all"); setFocusedBucketKey(null); }}>
                  {state.wallets.map((item) => <option key={item.id} value={item.id}>{walletName(item.name)} · {item.currency}</option>)}
                </select>
                <ChevronDown size={15} />
              </label>
            </div>
          </div>

          {dashboardRecords.length === 0 && <p className="fb-week-empty-note" role="status">{t.emptyText}</p>}
          {(
            <>
              {/* Legend */}
              <div className="fb-chart-legend" aria-hidden="true">
                <span className={dashboardType === "expense" ? "is-muted" : ""}>
                  <i className="fb-chart-dot income" />{t.typeIncome}
                </span>
                <span className={dashboardType === "income" ? "is-muted" : ""}>
                  <i className="fb-chart-dot expense" />{t.typeExpense}
                </span>
              </div>

              {/* Grouped Columns Chart */}
              <div className="fb-chart" role="region" aria-label={t.cardTitle}>
                {focusedBucket && (
                  <div className="fb-chart-tooltip" role="tooltip">
                    <span className="fb-chart-tooltip-period">{focusedBucket.fullDateLabel}</span>
                    {dashboardType !== "expense" && <span>{t.summaryIncome}: {money(focusedBucket.income, dashboardCurrency)}</span>}
                    {dashboardType !== "income" && <span>{t.summaryExpense}: {money(focusedBucket.expense, dashboardCurrency)}</span>}
                    {dashboardType === "all" && <span>{t.summaryNet}: {focusedBucket.income >= focusedBucket.expense ? "+" : "−"}{money(Math.abs(focusedBucket.income - focusedBucket.expense), dashboardCurrency)}</span>}
                    <span>{t.tooltipCount}: {focusedBucket.count}</span>
                  </div>
                )}

                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
                  <defs>
                    <pattern id="fb-income-stripes" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                      <line x1="0" y1="0" x2="0" y2="6" stroke="#0d9488" strokeWidth="2.5" />
                      <line x1="3" y1="0" x2="3" y2="6" stroke="#ccfbf1" strokeWidth="3.5" />
                    </pattern>
                  </defs>

                  {/* Horizontal gridlines and left Y-axis ticks */}
                  {scale.ticks.map((tickVal) => {
                    const y = baselineY - (tickVal / niceMax) * plotHeight;
                    return (
                      <g key={tickVal}>
                        <line x1={marginLeft} x2={chartWidth - marginRight} y1={y} y2={y} className="fb-chart-gridline" />
                        <text x={marginLeft - 8} y={y + 3.5} textAnchor="end" className="fb-chart-tick">
                          {formatCompactMoney(tickVal, dashboardCurrency, lang)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Zero Baseline */}
                  <line x1={marginLeft} x2={chartWidth - marginRight} y1={baselineY} y2={baselineY} stroke="#94a3b8" strokeWidth="1.5" />

                  {/* Grouped Columns */}
                  {buckets.map((b, i) => {
                    const countB = buckets.length;
                    const bW = plotWidth / countB;
                    const centerX = marginLeft + (i + 0.5) * bW;

                    const both = dashboardType === "all";
                    const maxBarW = both ? Math.min(Math.max(6, (bW * 0.65 - 6) / 2), 34) : Math.min(Math.max(10, bW * 0.55), 54);
                    const gap = Math.min(6, maxBarW * 0.25);

                    const incH = b.income > 0 ? Math.max(3, (b.income / niceMax) * plotHeight) : 0;
                    const expH = b.expense > 0 ? Math.max(3, (b.expense / niceMax) * plotHeight) : 0;

                    const incX = both ? centerX - maxBarW - gap / 2 : centerX - maxBarW / 2;
                    const expX = both ? centerX + gap / 2 : centerX - maxBarW / 2;

                    const incY = baselineY - incH;
                    const expY = baselineY - expH;

                    const showLabel = countB <= 12 || i === 0 || i === countB - 1 || (countB <= 24 ? i % 2 === 0 : i % Math.ceil(countB / 8) === 0);

                    return (
                      <g
                        key={b.key}
                        tabIndex={0}
                        role="button"
                        aria-label={`${b.fullDateLabel}: ${t.summaryIncome} ${money(b.income, dashboardCurrency)}, ${t.summaryExpense} ${money(b.expense, dashboardCurrency)}`}
                        className="fb-bar-group"
                        onMouseEnter={() => setFocusedBucketKey(b.key)}
                        onMouseLeave={() => setFocusedBucketKey((k) => k === b.key ? null : k)}
                        onFocus={() => setFocusedBucketKey(b.key)}
                        onBlur={() => setFocusedBucketKey((k) => k === b.key ? null : k)}
                      >
                        {/* Income Bar */}
                        {dashboardType !== "expense" && incH > 0 && (
                          <rect x={incX} y={incY} width={maxBarW} height={incH} className="fb-chart-bar-income" />
                        )}

                        {/* Expense Bar */}
                        {dashboardType !== "income" && expH > 0 && (
                          <rect x={expX} y={expY} width={maxBarW} height={expH} className="fb-chart-bar-expense" />
                        )}

                        {/* X-axis label */}
                        {showLabel && (
                          <text x={centerX} y={baselineY + 16} textAnchor="middle" className="fb-chart-x-label">
                            {b.label}
                          </text>
                        )}
                        <text x={centerX} y={baselineY + 29} textAnchor="middle" className="fb-chart-x-label">
                          {b.key.slice(8)}/{b.key.slice(5, 7)}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Visually hidden accessible data table */}
                <table className="sr-only">
                  <caption>{t.tableCaption}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t.tableColPeriod}</th>
                      <th scope="col">{t.tableColIncome}</th>
                      <th scope="col">{t.tableColExpense}</th>
                      <th scope="col">{t.tableColNet}</th>
                      <th scope="col">{t.tableColCount}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buckets.map((b) => (
                      <tr key={b.key}>
                        <td>{b.fullDateLabel}</td>
                        <td>{money(b.income, dashboardCurrency)}</td>
                        <td>{money(b.expense, dashboardCurrency)}</td>
                        <td>{money(b.income - b.expense, dashboardCurrency)}</td>
                        <td>{b.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary line */}
              <div className="fb-chart-summary">
                <div className="fb-chart-summary-data">
                  <span>{t.summaryIncome} {money(totalIncome, dashboardCurrency)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t.summaryExpense} {money(totalExpense, dashboardCurrency)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t.summaryNet} {totalNet >= 0 ? "+" : "−"}{money(Math.abs(totalNet), dashboardCurrency)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{totalCount} {t.summaryTransactions}</span>
                </div>
                {dashboardSource === "sample" && <span className="fb-env-badge">{t.simulated}</span>}
              </div>
            </>
          )}
        </section>
        <section className="fb-wallet-flow-card"><div className="fb-section-heading"><div><h2>Chi & thu theo ví</h2><p className="fb-section-note">Số liệu của từng ví đã tích hợp trong kỳ</p></div><button type="button" className="fb-view-transactions" onClick={() => navigate("createWallet1")}><Plus size={15} />Thêm ví</button></div><div className="fb-wallet-flow-list">{walletFlows.map((flow) => <button type="button" key={flow.wallet.id} className={flow.wallet.id === wallet.id ? "is-selected" : ""} onClick={() => { setWalletId(flow.wallet.id); setDashboardCategory("all"); setFocusedBucketKey(null); }}><span><b>{walletName(flow.wallet.name)}</b><small>{flow.wallet.currency}</small></span><span className="fb-wallet-flow-numbers"><small className="r-expense">Chi {money(flow.expense, flow.wallet.currency)}</small><small className="r-income">Thu {money(flow.income, flow.wallet.currency)}</small></span><ArrowRight size={16} /></button>)}</div><button type="button" className="fb-manage-wallets" onClick={() => navigate("walletSettings?wallet=" + wallet.id)}>Quản lý ví<ArrowRight size={16} /></button></section>
      </section>
      <div className="fb-workspace"><div className="fb-main-column">
        <section className="fb-overview"><div className="fb-section-heading"><h2>Dòng tiền trong kỳ</h2>{periodControls}</div>
          <button type="button" className="r-summary" onClick={() => setModal("totals")} aria-label="Xem chi tiết dòng tiền"><div className="r-summary-top"><span><small>Thay đổi ròng</small><b>{money(income - expense, wallet.currency)}</b></span><span className="fb-detail-label">Chi tiết<Info size={16} /></span></div><div className="r-summary-cards"><div className="r-expense"><span><ArrowDownRight size={18} />Chi phí</span><b>{money(expense, wallet.currency)}</b></div><div className="r-income"><span><ArrowUpRight size={18} />Thu nhập</span><b>{money(income, wallet.currency)}</b></div></div></button>
        </section>
        <section className="fb-activity"><div className="fb-section-heading"><h2>Giao dịch trong kỳ</h2><div className="r-type-pills"><button type="button" className={type === "expense" ? "active" : ""} onClick={() => setType("expense")}>Chi phí</button><button type="button" className={type === "income" ? "active" : ""} onClick={() => setType("income")}>Thu nhập</button></div></div>
          {list.length === 0 ? <div className="fb-empty"><span className="fb-empty-icon"><ReceiptText size={26} /></span><h3>Chưa có {type === "expense" ? "khoản chi" : "khoản thu"} trong kỳ này</h3><p>Ghi lại một giao dịch để bắt đầu theo dõi dòng tiền.</p><button type="button" className="fb-empty-action" onClick={addTransaction}><Plus size={16} />Thêm giao dịch</button></div> : transactionRows}
        </section>
      </div><aside className="fb-side-column">{state.settings.totalBalance && <section className="fb-balance-card"><span className="fb-balance-icon"><Wallet size={20} /></span><p>Số dư ví đã chọn</p><h2>{money(allBalance, wallet.currency)}</h2><small>{walletName(wallet.name)} · {wallet.currency}</small><div className="fb-balance-decor" aria-hidden="true"><span /><span /><span /><span /><span /></div><button type="button" onClick={() => navigate("walletSettings?wallet=" + wallet.id)}>Quản lý ví<ArrowRight size={16} /></button></section>}
        <section className="fb-habit-card"><p className="fb-eyebrow">MỖI NGÀY MỘT CHÚT</p><h3>Hiểu tiền của mình hơn.</h3><p>Ghi lại các khoản thu và chi để có một bức tranh rõ ràng hơn.</p><button type="button" onClick={() => navigate("?tab=transactions")}>Xem giao dịch<ArrowRight size={16} /></button></section>
      </aside></div>
      <button type="button" className="r-fab fb-mobile-add" aria-label="Thêm giao dịch" onClick={addTransaction}><Plus size={26} /></button>
    </>}
    {modal && <Modal title={modal === "period" ? "Chọn khoảng thời gian" : modal === "search" ? "Tìm kiếm giao dịch" : modal === "wallet" ? "Chọn ví" : modal === "homeTotals" ? "Tổng dòng tiền" : undefined} onClose={close} sheet={["period", "search", "wallet"].includes(modal)}>
      {modal === "period" && <div className="r-period-options">{["Ngày", "Tuần", "Tháng", "Năm", "Mọi thời gian", "Phạm vi tùy chỉnh"].map((p) => <button key={p} type="button" className={p === period ? "is-selected" : ""} onClick={() => { setPeriod(p); if (p === "Tuần") { const date = new Date(day + "T12:00:00"); date.setDate(date.getDate() - (date.getDay() + 6) % 7); const start = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-"); date.setDate(date.getDate() + 6); setFrom(start); setTo([date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-")); } setModal(p === "Phạm vi tùy chỉnh" ? "range" : ""); }}><CalendarDays size={22} />{p}</button>)}</div>}
      {modal === "month" && <div className="r-month-picker"><aside><span>Thg {month + 1} {year}</span><button type="button" onClick={() => setYear(year - 1)}>⌃</button><b>{year}</b><button type="button" onClick={() => setYear(year + 1)}>⌄</button></aside><div><div className="r-month-grid">{Array.from({ length: 12 }, (_, i) => <button key={i} type="button" className={i === month ? "active" : ""} onClick={() => setMonth(i)}>Thg {i + 1}</button>)}</div><footer><button type="button" onClick={close}>Huỷ</button><button type="button" onClick={close}>OK</button></footer></div></div>}
      {modal === "range" && <div className="r-form"><label>Ngày<input aria-label="Ngày" type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label><label>Từ ngày<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label>Đến ngày<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label><input aria-label="Năm" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /><button type="button" className="r-primary" onClick={close}>Xác nhận</button></div>}
      {modal === "search" && <div className="r-form"><input aria-label="Tìm kiếm giao dịch" placeholder="Tìm kiếm giao dịch..." value={search} onChange={(e) => setSearch(e.target.value)} /><button type="button" className="r-primary" onClick={close}>Tìm kiếm</button>{search && <button type="button" className="r-secondary" onClick={() => { setSearch(""); close(); }}><X size={16} />Xóa tìm kiếm</button>}</div>}
      {modal === "wallet" && <div className="r-wallet-options">{state.wallets.map((w) => <button key={w.id} type="button" onClick={() => { setWalletId(w.id); close(); }} className={w.id === wallet.id ? "active" : ""}><Icon code="f555" />{w.name}<span>{money(w.initial, w.currency)}</span></button>)}</div>}
      {modal === "homeTotals" && <div className="r-breakdown"><p><span>Tổng số dư tất cả ví</span>{walletBalanceTotals}</p><p className="r-expense"><span>Tổng chi từ các ví</span>{formatTotals("expense")}</p><p className="r-income"><span>Tổng thu từ các ví</span>{formatTotals("income")}</p><p className="r-breakdown-total"><span>Thay đổi ròng</span>{formatTotals("net")}</p><small className="fb-modal-note">Các tiền tệ được tách riêng, không quy đổi tỷ giá.</small></div>}
      {modal === "totals" && <div className="r-breakdown"><p className="r-expense"><span>Chi phí</span>{money(expense, wallet.currency)}</p><p className="r-income"><span>Thu nhập</span>{money(income, wallet.currency)}</p><p><span>Chuyển khoản</span>{money(records.filter((r) => r.type === "transfer").reduce((a, r) => a + r.amount, 0), wallet.currency)}</p><p className="r-breakdown-total"><span>Tổng cộng</span>{money(income - expense, wallet.currency)}</p></div>}
    </Modal>}
  </div>;
}
