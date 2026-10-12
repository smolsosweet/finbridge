"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Ban, CalendarDays, Check, ChevronDown, FolderTree, Info, Lock, Pencil, Plus, ReceiptText, RotateCcw, Search, Settings, SlidersHorizontal, Trash2, Wallet, X } from "lucide-react";
import { EmptyState, Icon, Modal } from "./Ui";
import { money, updateState, useAppState, type Transaction, type Wallet as WalletType } from "./store";
import { categoryIcon, iconGroups } from "./Categories";
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

export const DASHBOARD_SAMPLE: DashboardSample[] = [
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

export function formatHomeMoney(amount: number, currency = "VND", withSign = false) {
  const isNeg = amount < 0;
  const absVal = Math.abs(amount);
  const formatted = absVal.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const curr = (currency || "VND").toUpperCase();
  if (withSign) {
    const sign = amount > 0 ? "+" : isNeg ? "−" : "";
    return `${sign}${formatted} ${curr}`;
  }
  return `${isNeg ? "−" : ""}${formatted} ${curr}`;
}

function formatCompactMoney(amount: number, currency: string, lang: "vi" | "en" | "zh") {
  const curr = (currency || "VND").toUpperCase();
  if (amount === 0) return `0 ${curr}`;
  if (curr === "VND") {
    if (amount >= 1_000_000_000) {
      const v = (amount / 1_000_000_000).toLocaleString(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 1 });
      return lang === "vi" ? `${v} tỷ VND` : lang === "zh" ? `${v}0亿 VND` : `${v}B VND`;
    }
    if (amount >= 1_000_000) {
      const v = (amount / 1_000_000).toLocaleString(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 1 });
      return lang === "vi" ? `${v} tr VND` : lang === "zh" ? `${Math.round(amount / 10000)}万 VND` : `${v}M VND`;
    }
    if (amount >= 1_000) {
      const v = (amount / 1_000).toLocaleString(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 0 });
      return lang === "vi" ? `${v} k VND` : lang === "zh" ? `${(amount / 10000).toFixed(1)}万 VND` : `${v}K VND`;
    }
    return `${amount.toLocaleString(lang === "vi" ? "vi-VN" : "en-US")} VND`;
  }
  if (amount >= 1_000_000) {
    const v = (amount / 1_000_000).toLocaleString(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 1 });
    return `${v}M ${curr}`;
  }
  if (amount >= 1_000) {
    const v = (amount / 1_000).toLocaleString(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 1 });
    return `${v}K ${curr}`;
  }
  return `${amount.toLocaleString("en-US")} ${curr}`;
}

const INCOME_COLORS = ["#0d9488", "#10b981", "#0284c7", "#6366f1", "#f59e0b", "#8b5cf6", "#ec4899"];
const EXPENSE_COLORS = ["#e11d48", "#f97316", "#7c3aed", "#2563eb", "#059669", "#d97706", "#db2777", "#0891b2"];

function getCategoryBreakdown(records: Transaction[], fallbackCurrency: string, colors: string[]) {
  const map = new Map<string, number>();
  let total = 0;
  for (const r of records) {
    const prev = map.get(r.category) || 0;
    map.set(r.category, prev + r.amount);
    total += r.amount;
  }
  const items = Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount], idx) => ({
      category,
      amount,
      percent: total > 0 ? (amount / total) * 100 : 0,
      color: colors[idx % colors.length],
      currency: fallbackCurrency,
    }));
  return { total, items };
}

function SvgDonut({
  type,
  items,
  total,
  currency,
}: {
  type: "income" | "expense";
  items: { category: string; amount: number; percent: number; color: string }[];
  total: number;
  currency: string;
}) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  return (
    <div className="fb-donut-card">
      <div className="fb-donut-header">
        <span className={"fb-donut-badge " + (type === "income" ? "r-income" : "r-expense")}>
          {type === "income" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          <span>{type === "income" ? "Cơ cấu Thu nhập" : "Cơ cấu Chi tiêu"}</span>
        </span>
      </div>

      <div className="fb-donut-visual-container">
        <svg viewBox="0 0 160 160" className="fb-donut-svg">
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke={type === "income" ? "#ecfdf5" : "#fff1f2"}
            strokeWidth="22"
          />
          {total === 0 || items.length === 0 ? (
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="20"
              strokeDasharray="6 6"
            />
          ) : (
            items.map((item) => {
              const sliceLength = (item.percent / 100) * circumference;
              const offset = -accumulated;
              accumulated += sliceLength;
              return (
                <circle
                  key={item.category}
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="22"
                  strokeDasharray={`${Math.max(1, sliceLength - (items.length > 1 ? 1.5 : 0))} ${circumference}`}
                  strokeDashoffset={offset}
                  transform="rotate(-90 80 80)"
                  strokeLinecap="round"
                />
              );
            })
          )}
        </svg>
        <div className="fb-donut-center-info">
          <span className="fb-donut-center-label">{type === "income" ? "Tổng thu" : "Tổng chi"}</span>
          <b className={"fb-donut-center-value " + (type === "income" ? "r-income" : "r-expense")}>
            {total === 0 ? `0 ${currency}` : (type === "income" ? "+" : "−") + formatHomeMoney(total, currency)}
          </b>
        </div>
      </div>

      <div className="fb-donut-legend">
        {items.length === 0 ? (
          <p className="fb-donut-empty-text">Chưa có giao dịch {type === "income" ? "thu" : "chi"} trong kỳ này</p>
        ) : (
          items.map((item) => (
            <div key={item.category} className="fb-donut-legend-item">
              <div className="fb-donut-legend-left">
                <i className="fb-donut-dot" style={{ backgroundColor: item.color }} />
                <span className="fb-donut-cat-name" title={item.category}>{item.category}</span>
              </div>
              <div className="fb-donut-legend-right">
                <span className="fb-donut-pct">{item.percent.toFixed(1)}%</span>
                <b className="fb-donut-val">{formatHomeMoney(item.amount, currency)}</b>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
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

  const activeWallets = state.wallets.filter((w) => !w.archived);
  const archivedWallets = state.wallets.filter((w) => w.archived);
  const [walletId, setWalletId] = useState(queryWallet || activeWallets[0]?.id || state.wallets[0].id);
  const wallet = activeWallets.find((w) => w.id === walletId) || activeWallets[0] || state.wallets[0];
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

  // Add wallet modal state
  const [newWalletName, setNewWalletName] = useState("");
  const [newWalletAmount, setNewWalletAmount] = useState("");
  const [newWalletCurrency, setNewWalletCurrency] = useState("VND");
  const [newWalletType, setNewWalletType] = useState<"cash" | "credit">("cash");
  const [newWalletLimit, setNewWalletLimit] = useState("");

  const openAddWalletModal = () => {
    setNewWalletName("");
    setNewWalletAmount("");
    setNewWalletCurrency(wallet.currency || "VND");
    setNewWalletType("cash");
    setNewWalletLimit("");
    setModal("addWallet");
  };

  const handleCreateWallet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletName.trim()) return;
    const newId = crypto.randomUUID();
    const nextWallet: WalletType = {
      id: newId,
      name: newWalletName.trim(),
      initial: Number(newWalletAmount || 0),
      currency: newWalletCurrency,
      type: newWalletType,
      limit: newWalletType === "credit" ? Number(newWalletLimit) || undefined : undefined,
    };
    updateState((s) => ({ ...s, wallets: [...s.wallets, nextWallet] }));
    setWalletId(newId);
    setModal("");
  };

  // Manage wallet modal state
  const [editingWalletId, setEditingWalletId] = useState("");
  const [manageWalletTab, setManageWalletTab] = useState<"details" | "categories">("details");
  const [editWalletName, setEditWalletName] = useState("");
  const [editWalletType, setEditWalletType] = useState<"cash" | "credit">("cash");
  const [editWalletCurrency, setEditWalletCurrency] = useState("VND");
  const [editWalletInitial, setEditWalletInitial] = useState("");
  const [editWalletLimit, setEditWalletLimit] = useState("");
  const [isReconciling, setIsReconciling] = useState(false);
  const [newActualBalance, setNewActualBalance] = useState("");
  const [catType, setCatType] = useState<"expense" | "income">("expense");
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("🏷️");
  const [isPickingIcon, setIsPickingIcon] = useState(false);
  const [iconPickerTarget, setIconPickerTarget] = useState<"new" | "edit">("new");
  const [editingCatName, setEditingCatName] = useState<string | null>(null);
  const [editCatTitle, setEditCatTitle] = useState("");
  const [editCatIcon, setEditCatIcon] = useState("");

  const openManageWalletModal = (targetWalletId: string) => {
    const target = state.wallets.find((w) => w.id === targetWalletId) || wallet;
    setEditingWalletId(target.id);
    setEditWalletName(target.name === "." ? "Ví chính" : target.name);
    setEditWalletType(target.type === "credit" ? "credit" : "cash");
    setEditWalletCurrency(target.currency || "VND");
    setEditWalletInitial(String(target.initial || 0));
    setEditWalletLimit(target.limit ? String(target.limit) : "");
    setManageWalletTab("details");
    setIsReconciling(false);
    setNewActualBalance("");
    setNewCatName("");
    setNewCatIcon("🏷️");
    setIsPickingIcon(false);
    setEditingCatName(null);
    setModal("manageWallet");
  };

  const handleSaveWalletInfo = (e: React.FormEvent) => {
    e.preventDefault();
    const target = state.wallets.find((w) => w.id === editingWalletId);
    if (!target) return;
    const txCount = state.transactions.filter((t) => t.wallet === target.id || t.targetWallet === target.id).length;
    const hasTxs = txCount > 0;
    const updated: WalletType = {
      ...target,
      name: editWalletName.trim() || target.name,
      type: editWalletType,
      limit: editWalletType === "credit" ? Number(editWalletLimit) || undefined : undefined,
      currency: hasTxs ? target.currency : editWalletCurrency,
      initial: hasTxs ? target.initial : Number(editWalletInitial || 0),
    };
    updateState((s) => ({
      ...s,
      wallets: s.wallets.map((w) => (w.id === target.id ? updated : w)),
    }));
    close();
  };

  const handleConfirmAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    const target = state.wallets.find((w) => w.id === editingWalletId);
    if (!target) return;
    const currentBal = target.initial + state.transactions.reduce((a, t) => a + (t.wallet === target.id ? (t.type === "income" ? t.amount : -t.amount) : t.targetWallet === target.id ? t.amount : 0), 0);
    const targetBal = Number(newActualBalance);
    if (isNaN(targetBal)) return;
    const diff = targetBal - currentBal;
    if (Math.abs(diff) > 0.0001) {
      const adjTx: Transaction = {
        id: crypto.randomUUID(),
        date: localDateKey(new Date()),
        title: diff > 0 ? "Điều chỉnh tăng số dư thực tế" : "Điều chỉnh giảm số dư thực tế",
        amount: Math.abs(diff),
        type: diff > 0 ? "income" : "expense",
        category: "Điều chỉnh số dư",
        wallet: target.id,
        note: `Khớp số dư thực tế từ ${formatHomeMoney(currentBal, target.currency)} sang ${formatHomeMoney(targetBal, target.currency)}`,
      };
      updateState((s) => ({
        ...s,
        transactions: [adjTx, ...s.transactions],
      }));
    }
    setIsReconciling(false);
    setNewActualBalance("");
  };

  const handleArchiveOrDeleteWallet = () => {
    const target = state.wallets.find((w) => w.id === editingWalletId);
    if (!target) return;
    const txCount = state.transactions.filter((t) => t.wallet === target.id || t.targetWallet === target.id).length;
    const activeCount = state.wallets.filter((w) => !w.archived).length;

    if (activeCount <= 1 && !target.archived) {
      alert("Hệ thống cần ít nhất 1 ví hoạt động. Bạn không thể hủy liên kết ví duy nhất này.");
      return;
    }

    if (target.archived) {
      updateState((s) => ({
        ...s,
        wallets: s.wallets.map((w) => (w.id === target.id ? { ...w, archived: false } : w)),
      }));
      close();
      return;
    }

    if (txCount === 0) {
      if (confirm(`Ví "${walletName(target.name)}" chưa có giao dịch nào. Bạn có chắc chắn muốn xóa vĩnh viễn ví này?`)) {
        updateState((s) => ({
          ...s,
          wallets: s.wallets.filter((w) => w.id !== target.id),
        }));
        if (walletId === target.id) {
          const remaining = state.wallets.filter((w) => w.id !== target.id && !w.archived);
          if (remaining[0]) setWalletId(remaining[0].id);
        }
        close();
      }
    } else {
      if (confirm(`Ví "${walletName(target.name)}" đã có ${txCount} giao dịch. Ví sẽ được chuyển sang trạng thái "Đã hủy liên kết" và ẩn khỏi màn hình thêm giao dịch. Tất cả ${txCount} giao dịch trước đây vẫn được lưu trữ an toàn. Bạn có muốn tiếp tục?`)) {
        updateState((s) => ({
          ...s,
          wallets: s.wallets.map((w) => (w.id === target.id ? { ...w, archived: true } : w)),
        }));
        if (walletId === target.id) {
          const remaining = state.wallets.filter((w) => w.id !== target.id && !w.archived);
          if (remaining[0]) setWalletId(remaining[0].id);
        }
        close();
      }
    }
  };

  const handleSwitchCatType = (type: "expense" | "income") => {
    setCatType(type);
    if (type === "income" && (newCatIcon === "🏷️" || newCatIcon === "🍔")) {
      setNewCatIcon("💰");
    } else if (type === "expense" && newCatIcon === "💰") {
      setNewCatIcon("🏷️");
    }
    setIsPickingIcon(false);
    setEditingCatName(null);
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed || state.categories.includes(trimmed)) return;
    updateState((s) => ({
      ...s,
      categories: [...s.categories, trimmed],
      categoryMeta: {
        ...s.categoryMeta,
        [trimmed]: {
          type: catType,
          icon: newCatIcon || (catType === "income" ? "💰" : "🏷️"),
          children: [],
        },
      },
    }));
    setNewCatName("");
    setIsPickingIcon(false);
  };

  const handleStartEditCat = (cat: string) => {
    setEditingCatName(cat);
    setEditCatTitle(cat);
    setEditCatIcon(categoryIcon(cat, state.categoryMeta));
    setIconPickerTarget("edit");
    setIsPickingIcon(false);
  };

  const handleSaveEditCat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCatName) return;
    const oldName = editingCatName;
    const newName = editCatTitle.trim();
    if (!newName) return;
    if (newName !== oldName && state.categories.includes(newName)) {
      alert("Tên danh mục này đã tồn tại.");
      return;
    }
    const currentMeta = state.categoryMeta[oldName] || { type: catType, icon: editCatIcon, children: [] };
    updateState((s) => {
      const nextMeta = { ...s.categoryMeta };
      if (newName !== oldName) {
        delete nextMeta[oldName];
      }
      nextMeta[newName] = {
        ...currentMeta,
        icon: editCatIcon,
      };
      return {
        ...s,
        categories: s.categories.map((c) => (c === oldName ? newName : c)),
        categoryMeta: nextMeta,
        transactions: newName !== oldName
          ? s.transactions.map((t) => (t.category === oldName ? { ...t, category: newName } : t))
          : s.transactions,
      };
    });
    setEditingCatName(null);
    setIsPickingIcon(false);
  };

  const handleCancelEditCat = () => {
    setEditingCatName(null);
    setIsPickingIcon(false);
  };

  const handleDeleteCategory = (cat: string) => {
    if (cat === "Chưa được phân loại") {
      alert("Không thể xóa danh mục mặc định của hệ thống.");
      return;
    }

    const txCount = state.transactions.filter((t) => t.category === cat).length;
    const meta = state.categoryMeta[cat];

    if (meta?.archived) {
      if (confirm(`Bạn muốn kích hoạt lại danh mục "${cat}"?`)) {
        updateState((s) => ({
          ...s,
          categoryMeta: {
            ...s.categoryMeta,
            [cat]: { ...meta, archived: false },
          },
        }));
      }
      return;
    }

    if (txCount === 0) {
      if (confirm(`Danh mục "${cat}" chưa có giao dịch nào. Bạn có chắc chắn muốn xóa vĩnh viễn?`)) {
        updateState((s) => {
          const nextMeta = { ...s.categoryMeta };
          delete nextMeta[cat];
          return {
            ...s,
            categories: s.categories.filter((c) => c !== cat),
            categoryMeta: nextMeta,
          };
        });
      }
    } else {
      const choice = confirm(
        `Danh mục "${cat}" đang được ghi nhận trong ${txCount} giao dịch.\n\n` +
        `• Chọn [OK]: Ẩn danh mục (Xóa mềm - ẩn khỏi danh sách chọn khi tạo giao dịch mới nhưng bảo toàn 100% dữ liệu lịch sử).\n` +
        `• Chọn [Cancel]: Giữ nguyên danh mục.`
      );
      if (choice) {
        updateState((s) => ({
          ...s,
          categoryMeta: {
            ...s.categoryMeta,
            [cat]: { ...(meta || { type: catType, icon: "🏷️", children: [] }), archived: true },
          },
        }));
      }
    }
  };

  const handleReassignAndDelete = (cat: string) => {
    const txCount = state.transactions.filter((t) => t.category === cat).length;
    if (confirm(`Chuyển tất cả ${txCount} giao dịch của danh mục "${cat}" về danh mục "Chưa được phân loại" và xóa vĩnh viễn "${cat}" khỏi hệ thống?`)) {
      updateState((s) => {
        const nextMeta = { ...s.categoryMeta };
        delete nextMeta[cat];
        return {
          ...s,
          categories: s.categories.filter((c) => c !== cat),
          categoryMeta: nextMeta,
          transactions: s.transactions.map((t) => (t.category === cat ? { ...t, category: "Chưa được phân loại" } : t)),
        };
      });
    }
  };

  const overviewCardRef = useRef<HTMLDivElement>(null);
  const [overviewHeight, setOverviewHeight] = useState<number | undefined>(undefined);
  const [selectedDonutCurrency, setSelectedDonutCurrency] = useState(wallet.currency || "VND");

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
  const incomeList = overviewRecords.filter((t) => t.type === "income");
  const expenseList = overviewRecords.filter((t) => t.type === "expense");

  const walletFlows = activeWallets.map((item) => {
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
  const formatTotals = (field: "expense" | "income" | "net") => totalsByCurrency(field).map((total) => formatHomeMoney(total.amount, total.currency)).join(" · ");

  const walletBalanceTotals = currencies.map((curr) => {
    const amount = activeWallets.filter((item) => item.currency === curr).reduce((sum, item) => sum + item.initial + state.transactions.reduce((balance, transaction) => balance + (transaction.wallet === item.id ? (transaction.type === "income" ? transaction.amount : -transaction.amount) : transaction.targetWallet === item.id ? transaction.amount : 0), 0), 0);
    return formatHomeMoney(amount, curr);
  }).join(" · ");

  const incomeTotals = totalsByCurrency("income");
  const expenseTotals = totalsByCurrency("expense");

  const activeDonutCurrency = currencies.includes(selectedDonutCurrency) ? selectedDonutCurrency : (currencies[0] || wallet.currency || "VND");
  const currencyIncomeList = incomeList.filter((t) => (state.wallets.find((w) => w.id === t.wallet)?.currency || wallet.currency) === activeDonutCurrency);
  const currencyExpenseList = expenseList.filter((t) => (state.wallets.find((w) => w.id === t.wallet)?.currency || wallet.currency) === activeDonutCurrency);
  const donutIncomeBreakdown = getCategoryBreakdown(currencyIncomeList, activeDonutCurrency, INCOME_COLORS);
  const donutExpenseBreakdown = getCategoryBreakdown(currencyExpenseList, activeDonutCurrency, EXPENSE_COLORS);
  const donutIncomeTotal = currencyIncomeList.reduce((sum, t) => sum + t.amount, 0);
  const donutExpenseTotal = currencyExpenseList.reduce((sum, t) => sum + t.amount, 0);

  const formatVnDate = (isoDate: string) => {
    if (!isoDate || !isoDate.includes("-")) return isoDate;
    const parts = isoDate.split("-");
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const selectedPeriodText = period === "Tháng"
    ? `tháng ${month + 1} năm ${year}`
    : period === "Năm"
      ? `năm ${year}`
      : period === "Ngày"
        ? `ngày ${formatVnDate(day)}`
        : period === "Tuần"
          ? `tuần ${formatVnDate(from)} – ${formatVnDate(to)}`
          : period === "Mọi thời gian"
            ? "toàn thời gian"
            : `${formatVnDate(from)} – ${formatVnDate(to)}`;

  const periodDateLabel = period === "Tháng"
    ? `tháng ${month + 1} năm ${year}`
    : period === "Năm"
      ? `Năm ${year}`
      : period === "Ngày"
        ? formatVnDate(day)
        : period === "Tuần"
          ? `${formatVnDate(from)} – ${formatVnDate(to)}`
          : period === "Phạm vi tùy chỉnh"
            ? `${formatVnDate(from)} – ${formatVnDate(to)}`
            : "";

  const setWeekFromDate = (dateStr: string) => {
    try {
      const { start, end } = calendarWeek(dateStr);
      setFrom(start);
      setTo(end);
    } catch {
      const d = new Date(dateStr + "T12:00:00");
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() - (d.getDay() + 6) % 7);
        const s = localDateKey(d);
        d.setDate(d.getDate() + 6);
        const e = localDateKey(d);
        setFrom(s);
        setTo(e);
      }
    }
  };

  const shiftWeek = (delta: number) => {
    try {
      const newStart = shiftCalendarWeek(from, delta);
      const { start, end } = calendarWeek(newStart);
      setFrom(start);
      setTo(end);
    } catch {}
  };

  const openPeriodDateModal = () => {
    if (period === "Tháng") setModal("pickMonth");
    else if (period === "Năm") setModal("pickYear");
    else if (period === "Ngày") setModal("pickDay");
    else if (period === "Tuần") setModal("pickWeek");
    else if (period === "Phạm vi tùy chỉnh") setModal("pickCustomRange");
  };

  useEffect(() => {
    if (!overviewCardRef.current) return;
    const updateH = () => {
      if (overviewCardRef.current && window.innerWidth > 640) {
        setOverviewHeight(Math.round(overviewCardRef.current.offsetHeight));
      } else {
        setOverviewHeight(undefined);
      }
    };
    updateH();
    const ro = new ResizeObserver(() => updateH());
    ro.observe(overviewCardRef.current);
    window.addEventListener("resize", updateH);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateH);
    };
  }, [period, month, year, day, from, to, incomeTotals.length, expenseTotals.length]);

  const list = transactionsTab ? records : records.filter((t) => t.type === type);
  const close = useCallback(() => setModal(""), []);
  const addTransaction = () => navigate(state.settings.manual ? "addTransaction" : "addTransactionChatMode");
  const walletName = (name: string) => name === "." ? "Ví chính" : name;
  const periodControls = (
    <div className="r-period-controls">
      <button type="button" onClick={() => setModal("period")} className="r-period">
        {period}
        <CalendarDays size={17} />
        <ChevronDown size={17} />
      </button>
      {period !== "Mọi thời gian" && (
        <button
          type="button"
          onClick={openPeriodDateModal}
          className="r-period-date"
          aria-label="Chọn thời gian chi tiết"
        >
          {periodDateLabel}
          <ChevronDown size={15} />
        </button>
      )}
    </div>
  );
  const transactionRows = (
    <div className="r-record-list">
      {list.map((t) => {
        const txW = state.wallets.find((item) => item.id === t.wallet);
        return (
          <button key={t.id} type="button" className="r-record" onClick={() => navigate("editTransaction?id=" + t.id)}>
            <span className="r-category-symbol">
              {transactionsTab ? (t.category === "Thức ăn & Đồ uống" ? "🍔" : t.type === "income" ? "💰" : "🛍️") : t.type === "income" ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
            </span>
            <span>
              <b>{t.category}</b>
              <small>{t.title}{txW?.archived ? " (Đã hủy liên kết)" : ""} · {t.date}</small>
            </span>
            <b className={t.type === "income" ? "r-income" : "r-expense"}>
              {t.type === "income" ? "+" : "−"}{money(t.amount, wallet.currency)}
            </b>
          </button>
        );
      })}
    </div>
  );

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
      </header>
      <div className="fb-home-intro"><div><p className="fb-eyebrow">TỔNG QUAN</p><h1>{state.settings.name && state.settings.name !== "." ? `Chào ${state.settings.name}` : "Tiền của bạn, trong tầm tay."}</h1><p>Theo dõi dòng tiền. Chủ động cho những kế hoạch tiếp theo.</p></div><button type="button" className="fb-add-button" onClick={addTransaction}><Plus size={18} />Thêm giao dịch</button></div>
      <section className="fb-wallet-section" aria-label="Ví của bạn">
        <div className="fb-section-heading">
          <div>
            <h2>Ví của bạn</h2>
            <span>{activeWallets.length} ví hoạt động{archivedWallets.length > 0 ? ` · ${archivedWallets.length} đã hủy liên kết` : ""}</span>
          </div>
          {archivedWallets.length > 0 && (
            <button
              type="button"
              className="fb-archived-wallets-chip"
              onClick={() => openManageWalletModal(archivedWallets[0].id)}
              title="Xem danh sách ví đã hủy liên kết"
            >
              <Ban size={13} />
              <span>Đã hủy ({archivedWallets.length})</span>
            </button>
          )}
        </div>
        <div className="r-wallets">
          {activeWallets.map((w) => (
            <div key={w.id} className={"r-wallet-card " + (w.id === wallet.id ? "is-selected" : "")}>
              <button type="button" onClick={() => setWalletId(w.id)} className="r-wallet-content" aria-label={"Chọn ví " + w.name} aria-pressed={w.id === wallet.id}>
                <Wallet size={19} />
                <span>{walletName(w.name)}</span>
                <b>{formatHomeMoney(w.initial + state.transactions.reduce((a, t) => a + (t.wallet === w.id ? (t.type === "income" ? t.amount : -t.amount) : t.targetWallet === w.id ? t.amount : 0), 0), w.currency)}</b>
              </button>
              <button type="button" className="r-wallet-edit" aria-label={"Quản lý ví " + w.name} onClick={() => openManageWalletModal(w.id)}>
                <Pencil size={14} />
              </button>
            </div>
          ))}
          <button type="button" className="r-new-wallet" onClick={openAddWalletModal}>
            <Plus size={20} />
            <span>Thêm ví</span>
          </button>
        </div>
      </section>
      <section className="fb-finance-dashboard" aria-label="Dashboard dòng tiền">
        <section ref={overviewCardRef} className="fb-overview fb-finance-overview"><div className="fb-section-heading"><div><h2>Dòng tiền trong kỳ</h2><p className="fb-section-note">Tổng hợp từ tất cả ví đã tích hợp</p></div>{periodControls}</div>
          <div className="r-summary fb-flow-summary-container">
            <div className="fb-flow-vertical-stack">
              <div className="fb-flow-row r-income" onClick={() => setModal("flowIncomeDetails")} role="button" tabIndex={0}>
                <div className="fb-flow-row-header">
                  <span className="fb-flow-row-label">
                    <ArrowUpRight size={18} />
                    <span>Tổng thu</span>
                  </span>
                  <small>Từ mọi ví trong kỳ</small>
                </div>
                <div className="fb-flow-row-amounts">
                  {incomeTotals.map((item) => (
                    <div key={item.currency} className="fb-flow-amount-line">
                      <b>+{formatHomeMoney(item.amount, item.currency)}</b>
                    </div>
                  ))}
                </div>
              </div>

              <div className="fb-flow-row r-expense" onClick={() => setModal("flowExpenseDetails")} role="button" tabIndex={0}>
                <div className="fb-flow-row-header">
                  <span className="fb-flow-row-label">
                    <ArrowDownRight size={18} />
                    <span>Tổng chi</span>
                  </span>
                  <small>Từ mọi ví trong kỳ</small>
                </div>
                <div className="fb-flow-row-amounts">
                  {expenseTotals.map((item) => (
                    <div key={item.currency} className="fb-flow-amount-line">
                      <b>−{formatHomeMoney(item.amount, item.currency)}</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="fb-flow-footer-row">
              <p className="fb-currency-note">Tiền tệ được hiển thị riêng, không quy đổi tỷ giá.</p>
              <button type="button" className="fb-flow-detail-link" onClick={() => setModal("flowComparisonChart")}>
                <span>Chi tiết</span>
                <Info size={13} />
              </button>
            </div>
          </div>
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
                    {dashboardType !== "expense" && <span>{t.summaryIncome}: {formatHomeMoney(focusedBucket.income, dashboardCurrency)}</span>}
                    {dashboardType !== "income" && <span>{t.summaryExpense}: {formatHomeMoney(focusedBucket.expense, dashboardCurrency)}</span>}
                    {dashboardType === "all" && <span>{t.summaryNet}: {formatHomeMoney(focusedBucket.income - focusedBucket.expense, dashboardCurrency, true)}</span>}
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
                        aria-label={`${b.fullDateLabel}: ${t.summaryIncome} ${formatHomeMoney(b.income, dashboardCurrency)}, ${t.summaryExpense} ${formatHomeMoney(b.expense, dashboardCurrency)}`}
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
                        <td>{formatHomeMoney(b.income, dashboardCurrency)}</td>
                        <td>{formatHomeMoney(b.expense, dashboardCurrency)}</td>
                        <td>{formatHomeMoney(b.income - b.expense, dashboardCurrency, true)}</td>
                        <td>{b.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary line */}
              <div className="fb-chart-summary">
                <div className="fb-chart-summary-data">
                  <span>{t.summaryIncome} {formatHomeMoney(totalIncome, dashboardCurrency)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t.summaryExpense} {formatHomeMoney(totalExpense, dashboardCurrency)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t.summaryNet} {formatHomeMoney(totalNet, dashboardCurrency, true)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{totalCount} {t.summaryTransactions}</span>
                </div>
                {dashboardSource === "sample" && <span className="fb-env-badge">{t.simulated}</span>}
              </div>
            </>
          )}
        </section>
        <section className="fb-wallet-flow-card" style={overviewHeight ? { height: `${overviewHeight}px`, maxHeight: `${overviewHeight}px` } : undefined}><div className="fb-section-heading"><div><h2>Chi & thu theo ví</h2><p className="fb-section-note">Số liệu của từng ví đã tích hợp trong kỳ</p></div><button type="button" className="fb-view-transactions" onClick={openAddWalletModal}><Plus size={15} />Thêm ví</button></div><div className="fb-wallet-flow-list">{walletFlows.map((flow) => <button type="button" key={flow.wallet.id} className={flow.wallet.id === wallet.id ? "is-selected" : ""} onClick={() => { setWalletId(flow.wallet.id); setDashboardCategory("all"); setFocusedBucketKey(null); }}><span><b>{walletName(flow.wallet.name)}</b><small>{flow.wallet.currency}</small></span><span className="fb-wallet-flow-numbers"><small className="r-expense">Chi {formatHomeMoney(flow.expense, flow.wallet.currency)}</small><small className="r-income">Thu {formatHomeMoney(flow.income, flow.wallet.currency)}</small></span><ArrowRight size={16} /></button>)}</div><button type="button" className="fb-manage-wallets" onClick={() => openManageWalletModal(wallet.id)}>Quản lý ví<ArrowRight size={16} /></button></section>
      </section>
      <div className="fb-workspace"><div className="fb-main-column">
        <section className="fb-overview"><div className="fb-section-heading"><h2>Dòng tiền trong kỳ</h2>{periodControls}</div>
          <button type="button" className="r-summary" onClick={() => setModal("totals")} aria-label="Xem chi tiết dòng tiền"><div className="r-summary-top"><span><small>Thay đổi ròng</small><b>{formatHomeMoney(income - expense, wallet.currency, true)}</b></span><span className="fb-detail-label">Chi tiết<Info size={16} /></span></div><div className="r-summary-cards"><div className="r-expense"><span><ArrowDownRight size={18} />Chi phí</span><b>{formatHomeMoney(expense, wallet.currency)}</b></div><div className="r-income"><span><ArrowUpRight size={18} />Thu nhập</span><b>{formatHomeMoney(income, wallet.currency)}</b></div></div></button>
        </section>
        <section className="fb-activity"><div className="fb-section-heading"><h2>Giao dịch trong kỳ</h2><div className="r-type-pills"><button type="button" className={type === "expense" ? "active" : ""} onClick={() => setType("expense")}>Chi phí</button><button type="button" className={type === "income" ? "active" : ""} onClick={() => setType("income")}>Thu nhập</button></div></div>
          {list.length === 0 ? <div className="fb-empty"><span className="fb-empty-icon"><ReceiptText size={26} /></span><h3>Chưa có {type === "expense" ? "khoản chi" : "khoản thu"} trong kỳ này</h3><p>Ghi lại một giao dịch để bắt đầu theo dõi dòng tiền.</p><button type="button" className="fb-empty-action" onClick={addTransaction}><Plus size={16} />Thêm giao dịch</button></div> : transactionRows}
        </section>
      </div><aside className="fb-side-column">{state.settings.totalBalance && <section className="fb-balance-card"><span className="fb-balance-icon"><Wallet size={20} /></span><p>Số dư ví đã chọn</p><h2>{formatHomeMoney(allBalance, wallet.currency)}</h2><small>{walletName(wallet.name)} · {wallet.currency}</small><div className="fb-balance-decor" aria-hidden="true"><span /><span /><span /><span /><span /></div><button type="button" onClick={() => openManageWalletModal(wallet.id)}>Quản lý ví<ArrowRight size={16} /></button></section>}
        <section className="fb-habit-card"><p className="fb-eyebrow">MỖI NGÀY MỘT CHÚT</p><h3>Hiểu tiền của mình hơn.</h3><p>Ghi lại các khoản thu và chi để có một bức tranh rõ ràng hơn.</p><button type="button" onClick={() => navigate("?tab=transactions")}>Xem giao dịch<ArrowRight size={16} /></button></section>
      </aside></div>
      <button type="button" className="r-fab fb-mobile-add" aria-label="Thêm giao dịch" onClick={addTransaction}><Plus size={26} /></button>
    </>}
    {modal && <Modal
      title={modal === "period" ? "Chọn khoảng thời gian"
        : modal === "search" ? "Tìm kiếm giao dịch"
        : modal === "wallet" ? "Chọn ví"
        : modal === "homeTotals" ? "Tổng dòng tiền"
        : modal === "addWallet" ? "Thêm ví mới"
        : modal === "flowIncomeDetails" ? "Chi tiết các khoản thu"
        : modal === "flowExpenseDetails" ? "Chi tiết các khoản chi"
        : modal === "flowComparisonChart" ? "Phân tích Thu & Chi trong kỳ"
        : modal === "manageWallet" ? `Quản lý ví: ${walletName(state.wallets.find((w) => w.id === editingWalletId)?.name || wallet.name)}`
        : modal === "pickDay" ? "Chọn ngày"
        : modal === "pickWeek" ? "Chọn tuần"
        : modal === "pickMonth" ? "Chọn tháng"
        : modal === "pickYear" ? "Chọn năm"
        : modal === "pickCustomRange" ? "Chọn khoảng thời gian"
        : undefined}
      onClose={close}
      sheet={["period", "search", "wallet"].includes(modal)}
      wide={["flowComparisonChart", "manageWallet"].includes(modal)}
    >
      {modal === "period" && (
        <div className="r-period-options">
          {["Ngày", "Tuần", "Tháng", "Năm", "Mọi thời gian", "Phạm vi tùy chỉnh"].map((p) => (
            <button
              key={p}
              type="button"
              className={p === period ? "is-selected" : ""}
              onClick={() => {
                setPeriod(p);
                if (p === "Tuần") {
                  setWeekFromDate(day);
                }
                if (p === "Phạm vi tùy chỉnh") setModal("pickCustomRange");
                else if (p === "Ngày") setModal("pickDay");
                else if (p === "Tuần") setModal("pickWeek");
                else if (p === "Tháng") setModal("pickMonth");
                else if (p === "Năm") setModal("pickYear");
                else setModal("");
              }}
            >
              <CalendarDays size={22} />
              {p}
            </button>
          ))}
        </div>
      )}

      {modal === "pickDay" && (
        <div className="fb-date-picker-modal">
          <p className="fb-picker-subheading">Chọn ngày để theo dõi thu chi trong ngày cụ thể.</p>
          <div className="fb-picker-field">
            <label className="fb-picker-label" htmlFor="pick-day-input">Chọn ngày</label>
            <input
              id="pick-day-input"
              type="date"
              className="fb-input"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </div>
          <div className="fb-quick-date-row">
            <button
              type="button"
              className={"fb-quick-date-btn " + (day === "2026-10-12" ? "active" : "")}
              onClick={() => setDay("2026-10-12")}
            >
              Hôm nay
            </button>
            <button
              type="button"
              className={"fb-quick-date-btn " + (day === "2026-10-11" ? "active" : "")}
              onClick={() => setDay("2026-10-11")}
            >
              Hôm qua
            </button>
          </div>
          <div className="fb-picker-selected-preview">
            <span>Ngày được chọn:</span>
            <b>{formatVnDate(day)}</b>
          </div>
          <div className="fb-modal-actions">
            <button type="button" className="r-secondary" onClick={close}>Đóng</button>
            <button type="button" className="r-primary" onClick={close}>Xác nhận</button>
          </div>
        </div>
      )}

      {modal === "pickWeek" && (
        <div className="fb-date-picker-modal">
          <p className="fb-picker-subheading">Chọn tuần để theo dõi dòng tiền trong chu kỳ 7 ngày (Thứ 2 – Chủ nhật).</p>
          <div className="fb-week-stepper">
            <button
              type="button"
              className="fb-stepper-btn"
              onClick={() => shiftWeek(-1)}
              aria-label="Tuần trước"
            >
              ‹
            </button>
            <div className="fb-week-stepper-display">
              <span className="fb-week-stepper-label">Tuần hiện tại</span>
              <b>{formatVnDate(from)} – {formatVnDate(to)}</b>
            </div>
            <button
              type="button"
              className="fb-stepper-btn"
              onClick={() => shiftWeek(1)}
              aria-label="Tuần sau"
            >
              ›
            </button>
          </div>
          <div className="fb-picker-field">
            <label className="fb-picker-label" htmlFor="pick-week-date">Hoặc chọn một ngày bất kỳ trong tuần</label>
            <input
              id="pick-week-date"
              type="date"
              className="fb-input"
              value={day}
              onChange={(e) => {
                setDay(e.target.value);
                setWeekFromDate(e.target.value);
              }}
            />
          </div>
          <div className="fb-quick-date-row">
            <button
              type="button"
              className="fb-quick-date-btn"
              onClick={() => {
                setDay("2026-10-12");
                setWeekFromDate("2026-10-12");
              }}
            >
              Tuần này
            </button>
            <button
              type="button"
              className="fb-quick-date-btn"
              onClick={() => {
                setDay("2026-10-05");
                setWeekFromDate("2026-10-05");
              }}
            >
              Tuần trước
            </button>
          </div>
          <div className="fb-modal-actions">
            <button type="button" className="r-secondary" onClick={close}>Đóng</button>
            <button type="button" className="r-primary" onClick={close}>Xác nhận</button>
          </div>
        </div>
      )}

      {modal === "pickMonth" && (
        <div className="fb-date-picker-modal">
          <div className="fb-month-year-header">
            <button
              type="button"
              className="fb-stepper-btn"
              onClick={() => setYear(year - 1)}
              aria-label="Năm trước"
            >
              ‹
            </button>
            <span className="fb-year-display">Năm {year}</span>
            <button
              type="button"
              className="fb-stepper-btn"
              onClick={() => setYear(year + 1)}
              aria-label="Năm sau"
            >
              ›
            </button>
          </div>
          <div className="fb-month-grid">
            {Array.from({ length: 12 }, (_, i) => (
              <button
                key={i}
                type="button"
                className={"fb-month-cell " + (i === month ? "active" : "")}
                onClick={() => setMonth(i)}
              >
                Tháng {i + 1}
              </button>
            ))}
          </div>
          <div className="fb-picker-selected-preview">
            <span>Tháng đã chọn:</span>
            <b>Tháng {month + 1} năm {year}</b>
          </div>
          <div className="fb-modal-actions">
            <button type="button" className="r-secondary" onClick={close}>Đóng</button>
            <button type="button" className="r-primary" onClick={close}>Xác nhận</button>
          </div>
        </div>
      )}

      {modal === "pickYear" && (
        <div className="fb-date-picker-modal">
          <p className="fb-picker-subheading">Chọn năm để xem tổng kết tài chính cả năm.</p>
          <div className="fb-year-stepper">
            <button
              type="button"
              className="fb-stepper-btn"
              onClick={() => setYear(year - 1)}
              aria-label="Năm trước"
            >
              ‹
            </button>
            <span className="fb-big-year">{year}</span>
            <button
              type="button"
              className="fb-stepper-btn"
              onClick={() => setYear(year + 1)}
              aria-label="Năm sau"
            >
              ›
            </button>
          </div>
          <div className="fb-year-grid">
            {[2023, 2024, 2025, 2026, 2027, 2028].map((y) => (
              <button
                key={y}
                type="button"
                className={"fb-year-cell " + (y === year ? "active" : "")}
                onClick={() => setYear(y)}
              >
                {y}
              </button>
            ))}
          </div>
          <div className="fb-modal-actions">
            <button type="button" className="r-secondary" onClick={close}>Đóng</button>
            <button type="button" className="r-primary" onClick={close}>Xác nhận</button>
          </div>
        </div>
      )}

      {modal === "pickCustomRange" && (
        <div className="fb-date-picker-modal">
          <p className="fb-picker-subheading">Tùy chọn khoảng thời gian từ ngày đến ngày.</p>
          <div className="fb-range-inputs">
            <div className="fb-picker-field">
              <label className="fb-picker-label" htmlFor="custom-from-date">Từ ngày</label>
              <input
                id="custom-from-date"
                type="date"
                className="fb-input"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="fb-picker-field">
              <label className="fb-picker-label" htmlFor="custom-to-date">Đến ngày</label>
              <input
                id="custom-to-date"
                type="date"
                className="fb-input"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
          <div className="fb-quick-date-row">
            <button
              type="button"
              className="fb-quick-date-btn"
              onClick={() => {
                setFrom("2026-10-05");
                setTo("2026-10-12");
              }}
            >
              7 ngày qua
            </button>
            <button
              type="button"
              className="fb-quick-date-btn"
              onClick={() => {
                setFrom("2026-09-12");
                setTo("2026-10-12");
              }}
            >
              30 ngày qua
            </button>
            <button
              type="button"
              className="fb-quick-date-btn"
              onClick={() => {
                setFrom("2026-10-01");
                setTo("2026-10-31");
              }}
            >
              Tháng này
            </button>
          </div>
          <div className="fb-picker-selected-preview">
            <span>Khoảng thời gian:</span>
            <b>{formatVnDate(from)} – {formatVnDate(to)}</b>
          </div>
          <div className="fb-modal-actions">
            <button type="button" className="r-secondary" onClick={close}>Hủy</button>
            <button type="button" className="r-primary" onClick={close}>Áp dụng</button>
          </div>
        </div>
      )}

      {modal === "search" && <div className="r-form"><input aria-label="Tìm kiếm giao dịch" placeholder="Tìm kiếm giao dịch..." value={search} onChange={(e) => setSearch(e.target.value)} /><button type="button" className="r-primary" onClick={close}>Tìm kiếm</button>{search && <button type="button" className="r-secondary" onClick={() => { setSearch(""); close(); }}><X size={16} />Xóa tìm kiếm</button>}</div>}
      {modal === "wallet" && <div className="r-wallet-options">{state.wallets.map((w) => <button key={w.id} type="button" onClick={() => { setWalletId(w.id); close(); }} className={w.id === wallet.id ? "active" : ""}><Icon code="f555" />{w.name}<span>{formatHomeMoney(w.initial, w.currency)}</span></button>)}</div>}
      {modal === "homeTotals" && <div className="r-breakdown"><p><span>Tổng số dư tất cả ví</span>{walletBalanceTotals}</p><p className="r-expense"><span>Tổng chi từ các ví</span>{formatTotals("expense")}</p><p className="r-income"><span>Tổng thu từ các ví</span>{formatTotals("income")}</p><p className="r-breakdown-total"><span>Thay đổi ròng</span>{formatTotals("net")}</p><small className="fb-modal-note">Các tiền tệ được tách riêng, không quy đổi tỷ giá.</small></div>}
      {modal === "totals" && <div className="r-breakdown"><p className="r-expense"><span>Chi phí</span>{formatHomeMoney(expense, wallet.currency)}</p><p className="r-income"><span>Thu nhập</span>{formatHomeMoney(income, wallet.currency)}</p><p><span>Chuyển khoản</span>{formatHomeMoney(records.filter((r) => r.type === "transfer").reduce((a, r) => a + r.amount, 0), wallet.currency)}</p><p className="r-breakdown-total"><span>Tổng cộng</span>{formatHomeMoney(income - expense, wallet.currency, true)}</p></div>}

      {modal === "addWallet" && (
        <form className="fb-add-wallet-form" onSubmit={handleCreateWallet}>
          <p className="fb-modal-subheading">Tạo ví để phân bổ tài chính và quản lý dòng tiền chi tiết.</p>

          <div className="fb-form-group">
            <label className="fb-form-label">Loại ví</label>
            <div className="r-two-options">
              <button
                type="button"
                className={newWalletType === "cash" ? "active" : ""}
                onClick={() => setNewWalletType("cash")}
              >
                <Wallet size={16} />
                <span>Tiền mặt</span>
              </button>
              <button
                type="button"
                className={newWalletType === "credit" ? "active" : ""}
                onClick={() => setNewWalletType("credit")}
              >
                <ReceiptText size={16} />
                <span>Thẻ tín dụng</span>
              </button>
            </div>
          </div>

          <div className="fb-form-group">
            <label className="fb-form-label" htmlFor="new-wallet-name">Tên ví</label>
            <input
              id="new-wallet-name"
              type="text"
              required
              placeholder="Ví dụ: Ví tiêu dùng, Techcombank, VIB..."
              value={newWalletName}
              onChange={(e) => setNewWalletName(e.target.value)}
              className="fb-input"
            />
          </div>

          <div className="fb-form-group">
            <label className="fb-form-label" htmlFor="new-wallet-currency">Đơn vị tiền tệ</label>
            <select
              id="new-wallet-currency"
              value={newWalletCurrency}
              onChange={(e) => setNewWalletCurrency(e.target.value)}
              className="fb-select"
            >
              <option value="VND">VND (Việt Nam Đồng)</option>
              <option value="USD">USD (Đô la Mỹ)</option>
              <option value="EUR">EUR (Euro)</option>
              <option value="JPY">JPY (Yên Nhật)</option>
              <option value="SGD">SGD (Đô la Singapore)</option>
              <option value="GBP">GBP (Bảng Anh)</option>
              <option value="AUD">AUD (Đô la Úc)</option>
            </select>
          </div>

          <div className="fb-form-group">
            <label className="fb-form-label" htmlFor="new-wallet-initial">
              {newWalletType === "credit" ? "Số dư chưa thanh toán" : "Số dư ban đầu"}
            </label>
            <input
              id="new-wallet-initial"
              type="number"
              step="any"
              placeholder="0"
              value={newWalletAmount}
              onChange={(e) => setNewWalletAmount(e.target.value)}
              className="fb-input"
            />
          </div>

          {newWalletType === "credit" && (
            <div className="fb-form-group">
              <label className="fb-form-label" htmlFor="new-wallet-limit">Hạn mức tín dụng</label>
              <input
                id="new-wallet-limit"
                type="number"
                step="any"
                required
                placeholder="Ví dụ: 50,000,000"
                value={newWalletLimit}
                onChange={(e) => setNewWalletLimit(e.target.value)}
                className="fb-input"
              />
            </div>
          )}

          <div className="fb-modal-actions">
            <button type="button" className="r-secondary" onClick={close}>Hủy</button>
            <button type="submit" className="r-primary">Lưu ví</button>
          </div>
        </form>
      )}

      {modal === "flowIncomeDetails" && (
        <div className="fb-flow-details-modal">
          <div className="fb-tx-modal-summary-pill">
            <span>Kỳ: <b>{selectedPeriodText}</b></span>
            <div className="fb-tx-modal-totals">
              {incomeTotals.length === 0 ? (
                <b className="r-income">+0 {wallet.currency || "VND"}</b>
              ) : (
                incomeTotals.map((item) => (
                  <b key={item.currency} className="r-income">
                    +{formatHomeMoney(item.amount, item.currency)}
                  </b>
                ))
              )}
            </div>
          </div>
          {incomeList.length === 0 ? (
            <div className="fb-modal-empty-state">
              <ReceiptText size={38} />
              <h4>Chưa có khoản thu nào trong kỳ này</h4>
              <p>Các giao dịch thu nhập trong {selectedPeriodText} sẽ hiển thị tại đây.</p>
              <button type="button" className="r-primary fb-modal-cta" onClick={addTransaction}>
                <Plus size={16} />Thêm giao dịch thu
              </button>
            </div>
          ) : (
            <div className="fb-tx-modal-list">
              {incomeList.map((t) => {
                const w = state.wallets.find((item) => item.id === t.wallet);
                const curr = w?.currency || wallet.currency || "VND";
                return (
                  <button
                    key={t.id}
                    type="button"
                    className="fb-tx-modal-item"
                    onClick={() => navigate("editTransaction?id=" + t.id)}
                  >
                    <span className="fb-tx-modal-icon r-income">
                      <ArrowUpRight size={18} />
                    </span>
                    <div className="fb-tx-modal-info">
                      <b>{t.title || t.category}</b>
                      <small>{t.category} · {w ? walletName(w.name) : ""}{w?.archived ? " (Đã hủy liên kết)" : ""} · {t.date}</small>
                    </div>
                    <b className="fb-tx-modal-amount r-income">
                      +{formatHomeMoney(t.amount, curr)}
                    </b>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {modal === "flowExpenseDetails" && (
        <div className="fb-flow-details-modal">
          <div className="fb-tx-modal-summary-pill">
            <span>Kỳ: <b>{selectedPeriodText}</b></span>
            <div className="fb-tx-modal-totals">
              {expenseTotals.length === 0 ? (
                <b className="r-expense">−0 {wallet.currency || "VND"}</b>
              ) : (
                expenseTotals.map((item) => (
                  <b key={item.currency} className="r-expense">
                    −{formatHomeMoney(item.amount, item.currency)}
                  </b>
                ))
              )}
            </div>
          </div>
          {expenseList.length === 0 ? (
            <div className="fb-modal-empty-state">
              <ReceiptText size={38} />
              <h4>Chưa có khoản chi nào trong kỳ này</h4>
              <p>Các giao dịch chi tiêu trong {selectedPeriodText} sẽ hiển thị tại đây.</p>
              <button type="button" className="r-primary fb-modal-cta" onClick={addTransaction}>
                <Plus size={16} />Thêm giao dịch chi
              </button>
            </div>
          ) : (
            <div className="fb-tx-modal-list">
              {expenseList.map((t) => {
                const w = state.wallets.find((item) => item.id === t.wallet);
                const curr = w?.currency || wallet.currency || "VND";
                return (
                  <button
                    key={t.id}
                    type="button"
                    className="fb-tx-modal-item"
                    onClick={() => navigate("editTransaction?id=" + t.id)}
                  >
                    <span className="fb-tx-modal-icon r-expense">
                      <ArrowDownRight size={18} />
                    </span>
                    <div className="fb-tx-modal-info">
                      <b>{t.title || t.category}</b>
                      <small>{t.category} · {w ? walletName(w.name) : ""}{w?.archived ? " (Đã hủy liên kết)" : ""} · {t.date}</small>
                    </div>
                    <b className="fb-tx-modal-amount r-expense">
                      −{formatHomeMoney(t.amount, curr)}
                    </b>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {modal === "flowComparisonChart" && (
        <div className="fb-flow-chart-modal">
          <div className="fb-donut-summary-bar">
            <div>
              <span>Tổng thu ({selectedPeriodText})</span>
              <div className="fb-flow-amounts-wrap">
                {incomeTotals.length === 0 ? (
                  <b className="r-income">+0 {wallet.currency || "VND"}</b>
                ) : (
                  incomeTotals.map((it) => (
                    <b key={it.currency} className="r-income">+{formatHomeMoney(it.amount, it.currency)}</b>
                  ))
                )}
              </div>
            </div>
            <div>
              <span>Tổng chi ({selectedPeriodText})</span>
              <div className="fb-flow-amounts-wrap">
                {expenseTotals.length === 0 ? (
                  <b className="r-expense">−0 {wallet.currency || "VND"}</b>
                ) : (
                  expenseTotals.map((et) => (
                    <b key={et.currency} className="r-expense">−{formatHomeMoney(et.amount, et.currency)}</b>
                  ))
                )}
              </div>
            </div>
          </div>

          {currencies.length > 1 && (
            <div className="fb-donut-currency-switcher">
              <span>Đơn vị tiền tệ hiển thị biểu đồ:</span>
              <div className="r-type-pills">
                {currencies.map((curr) => (
                  <button
                    key={curr}
                    type="button"
                    className={activeDonutCurrency === curr ? "active" : ""}
                    onClick={() => setSelectedDonutCurrency(curr)}
                  >
                    {curr}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="fb-donut-grid">
            <SvgDonut
              type="income"
              items={donutIncomeBreakdown.items}
              total={donutIncomeTotal}
              currency={activeDonutCurrency}
            />
            <SvgDonut
              type="expense"
              items={donutExpenseBreakdown.items}
              total={donutExpenseTotal}
              currency={activeDonutCurrency}
            />
          </div>
        </div>
      )}

      {modal === "manageWallet" && (() => {
        const targetWallet = state.wallets.find((w) => w.id === editingWalletId) || wallet;
        const targetTxs = state.transactions.filter((t) => t.wallet === targetWallet.id || t.targetWallet === targetWallet.id);
        const hasTxs = targetTxs.length > 0;
        const currentBal = targetWallet.initial + state.transactions.reduce((a, t) => a + (t.wallet === targetWallet.id ? (t.type === "income" ? t.amount : -t.amount) : t.targetWallet === targetWallet.id ? t.amount : 0), 0);

        return (
          <div className="fb-manage-wallet-modal">
            <div className="fb-modal-tab-bar">
              <button
                type="button"
                className={`fb-tab-btn ${manageWalletTab === "details" ? "active" : ""}`}
                onClick={() => setManageWalletTab("details")}
              >
                <Settings size={15} />
                <span>Thông tin ví</span>
              </button>
              <button
                type="button"
                className={`fb-tab-btn ${manageWalletTab === "categories" ? "active" : ""}`}
                onClick={() => setManageWalletTab("categories")}
              >
                <FolderTree size={15} />
                <span>Quản lý danh mục</span>
              </button>
            </div>

            {targetWallet.archived && (
              <div className="fb-wallet-archived-banner">
                <Ban size={16} />
                <div>
                  <b>Ví đang ở trạng thái hủy liên kết (đã lưu trữ)</b>
                  <p>Ví này bị ẩn khỏi mục chọn khi tạo giao dịch mới, nhưng tất cả lịch sử giao dịch vẫn được giữ nguyên.</p>
                </div>
              </div>
            )}

            {manageWalletTab === "details" && (
              <form className="fb-wallet-edit-form" onSubmit={handleSaveWalletInfo}>
                <div className="fb-form-group">
                  <label className="fb-form-label" htmlFor="edit-wallet-name">Tên ví</label>
                  <input
                    id="edit-wallet-name"
                    type="text"
                    required
                    className="fb-input"
                    value={editWalletName}
                    onChange={(e) => setEditWalletName(e.target.value)}
                  />
                </div>

                <div className="fb-form-group">
                  <label className="fb-form-label">Loại ví</label>
                  <div className="r-two-options">
                    <button
                      type="button"
                      className={editWalletType === "cash" ? "active" : ""}
                      onClick={() => setEditWalletType("cash")}
                    >
                      <Wallet size={16} />
                      <span>Tiền mặt</span>
                    </button>
                    <button
                      type="button"
                      className={editWalletType === "credit" ? "active" : ""}
                      onClick={() => setEditWalletType("credit")}
                    >
                      <ReceiptText size={16} />
                      <span>Thẻ tín dụng</span>
                    </button>
                  </div>
                </div>

                {editWalletType === "credit" && (
                  <div className="fb-form-group">
                    <label className="fb-form-label" htmlFor="edit-wallet-limit">Hạn mức tín dụng</label>
                    <input
                      id="edit-wallet-limit"
                      type="number"
                      step="any"
                      required
                      placeholder="Ví dụ: 50,000,000"
                      className="fb-input"
                      value={editWalletLimit}
                      onChange={(e) => setEditWalletLimit(e.target.value)}
                    />
                  </div>
                )}

                <div className="fb-form-group">
                  <div className="fb-form-label-row">
                    <label className="fb-form-label" htmlFor="edit-wallet-currency">Đơn vị tiền tệ</label>
                    {hasTxs && (
                      <span className="fb-locked-badge">
                        <Lock size={12} /> Đã khóa (đã phát sinh giao dịch)
                      </span>
                    )}
                  </div>
                  {hasTxs ? (
                    <input
                      id="edit-wallet-currency"
                      type="text"
                      disabled
                      className="fb-input fb-input-locked"
                      value={`${editWalletCurrency} (${targetWallet.currency})`}
                    />
                  ) : (
                    <select
                      id="edit-wallet-currency"
                      value={editWalletCurrency}
                      onChange={(e) => setEditWalletCurrency(e.target.value)}
                      className="fb-select"
                    >
                      <option value="VND">VND (Việt Nam Đồng)</option>
                      <option value="USD">USD (Đô la Mỹ)</option>
                      <option value="EUR">EUR (Euro)</option>
                      <option value="JPY">JPY (Yên Nhật)</option>
                      <option value="SGD">SGD (Đô la Singapore)</option>
                      <option value="GBP">GBP (Bảng Anh)</option>
                      <option value="AUD">AUD (Đô la Úc)</option>
                    </select>
                  )}
                  {hasTxs && (
                    <p className="fb-helper-text">
                      Không thể đổi tiền tệ khi đã có giao dịch để tránh xung đột tỷ giá và dữ liệu lịch sử.
                    </p>
                  )}
                </div>

                <div className="fb-form-group">
                  <div className="fb-form-label-row">
                    <label className="fb-form-label" htmlFor="edit-wallet-initial">
                      {editWalletType === "credit" ? "Số dư chưa thanh toán ban đầu" : "Số dư ban đầu"}
                    </label>
                    {hasTxs && (
                      <span className="fb-locked-badge">
                        <Lock size={12} /> Đã khóa (đã phát sinh giao dịch)
                      </span>
                    )}
                  </div>
                  <input
                    id="edit-wallet-initial"
                    type="number"
                    step="any"
                    disabled={hasTxs}
                    className={`fb-input ${hasTxs ? "fb-input-locked" : ""}`}
                    value={editWalletInitial}
                    onChange={(e) => setEditWalletInitial(e.target.value)}
                  />
                  {hasTxs ? (
                    <p className="fb-helper-text">
                      Số dư ban đầu được cố định để bảo toàn tính toàn vẹn của sổ sách. Để cập nhật số dư theo tài khoản ngân hàng thực tế, vui lòng sử dụng tính năng <b>Điều chỉnh số dư thực tế</b> bên dưới.
                    </p>
                  ) : (
                    <p className="fb-helper-text">Ví chưa có giao dịch nào, bạn có thể tự do điều chỉnh số dư ban đầu.</p>
                  )}
                </div>

                {hasTxs && (
                  <div className="fb-balance-reconcile-card">
                    <div className="fb-reconcile-info">
                      <div className="fb-reconcile-header">
                        <SlidersHorizontal size={16} />
                        <b>Khớp số dư thực tế</b>
                      </div>
                      <p>
                        Số dư sổ sách hiện tại: <strong>{formatHomeMoney(currentBal, targetWallet.currency)}</strong>. Nếu không khớp với thực tế ngoài đời, hãy nhập số dư thực tế để hệ thống tự động bù trừ.
                      </p>
                    </div>

                    {!isReconciling ? (
                      <button
                        type="button"
                        className="fb-reconcile-btn"
                        onClick={() => {
                          setIsReconciling(true);
                          setNewActualBalance(currentBal.toString());
                        }}
                      >
                        <SlidersHorizontal size={14} />
                        <span>Điều chỉnh số dư thực tế</span>
                      </button>
                    ) : (
                      <div className="fb-reconcile-form-box">
                        <div className="fb-form-group">
                          <label className="fb-form-label" htmlFor="actual-balance-input">
                            Số dư thực tế trong ví / tài khoản ngân hàng ({targetWallet.currency})
                          </label>
                          <input
                            id="actual-balance-input"
                            type="number"
                            step="any"
                            required
                            className="fb-input"
                            value={newActualBalance}
                            onChange={(e) => setNewActualBalance(e.target.value)}
                            placeholder="Nhập số dư thực tế hiện tại"
                          />
                        </div>
                        <div className="fb-reconcile-actions">
                          <button
                            type="button"
                            className="r-secondary"
                            onClick={() => {
                              setIsReconciling(false);
                              setNewActualBalance("");
                            }}
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            className="r-primary"
                            onClick={handleConfirmAdjustment}
                          >
                            Xác nhận điều chỉnh
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="fb-modal-actions">
                  <button type="button" className="r-secondary" onClick={close}>Đóng</button>
                  <button type="submit" className="r-primary">Lưu thay đổi</button>
                </div>

                <div className="fb-wallet-danger-zone">
                  <div className="fb-danger-zone-header">
                    <AlertTriangle size={15} />
                    <span>Thao tác bảo mật ví</span>
                  </div>
                  <p className="fb-danger-zone-desc">
                    {hasTxs
                      ? targetWallet.archived
                        ? "Ví này hiện đang bị hủy liên kết. Bạn có thể khôi phục để tiếp tục ghi chép giao dịch."
                        : `Ví này đã ghi nhận ${targetTxs.length} giao dịch. Hệ thống sẽ áp dụng chính sách xóa mềm (Hủy liên kết): ví sẽ bị ẩn nhưng ${targetTxs.length} giao dịch lịch sử vẫn được bảo toàn nguyên vẹn.`
                      : "Ví này chưa có giao dịch nào. Bạn có thể xóa vĩnh viễn ví khỏi hệ thống."}
                  </p>
                  <button
                    type="button"
                    className={targetWallet.archived ? "fb-restore-wallet-btn" : "fb-archive-wallet-btn"}
                    onClick={handleArchiveOrDeleteWallet}
                  >
                    {targetWallet.archived ? (
                      <>
                        <RotateCcw size={15} />
                        <span>Kích hoạt lại ví này</span>
                      </>
                    ) : hasTxs ? (
                      <>
                        <Ban size={15} />
                        <span>Hủy liên kết ví (Lưu trữ)</span>
                      </>
                    ) : (
                      <>
                        <Trash2 size={15} />
                        <span>Xóa vĩnh viễn ví này</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {manageWalletTab === "categories" && (
              <div className="fb-cat-manage-box">
                <div className="fb-cat-type-toggle">
                  <button
                    type="button"
                    className={`fb-cat-toggle-btn ${catType === "expense" ? "active" : ""}`}
                    onClick={() => handleSwitchCatType("expense")}
                  >
                    <ArrowDownRight size={14} />
                    <span>Danh mục Chi phí</span>
                  </button>
                  <button
                    type="button"
                    className={`fb-cat-toggle-btn ${catType === "income" ? "active" : ""}`}
                    onClick={() => handleSwitchCatType("income")}
                  >
                    <ArrowUpRight size={14} />
                    <span>Danh mục Thu nhập</span>
                  </button>
                </div>

                <form className="fb-cat-add-form" onSubmit={handleAddCategory}>
                  <button
                    type="button"
                    className="fb-cat-icon-select-btn"
                    title="Bấm để chọn biểu tượng cho danh mục"
                    onClick={() => {
                      setIconPickerTarget("new");
                      setIsPickingIcon(isPickingIcon && iconPickerTarget === "new" ? false : true);
                    }}
                  >
                    <span>{newCatIcon}</span>
                  </button>
                  <input
                    type="text"
                    required
                    placeholder={`Nhập tên danh mục ${catType === "income" ? "thu nhập" : "chi tiêu"} mới...`}
                    className="fb-input fb-cat-add-input"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                  />
                  <button type="submit" className="r-primary fb-cat-add-btn">
                    <Plus size={15} />
                    <span>Thêm</span>
                  </button>
                </form>

                {isPickingIcon && (
                  <div className="fb-emoji-picker-box">
                    <div className="fb-emoji-picker-header">
                      <span>Chọn biểu tượng cho {iconPickerTarget === "new" ? (newCatName ? `"${newCatName}"` : "danh mục mới") : `"${editCatTitle || editingCatName}"`}</span>
                      <button type="button" className="fb-emoji-close-btn" onClick={() => setIsPickingIcon(false)} aria-label="Đóng bảng icon">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="fb-emoji-groups-scroll">
                      {iconGroups.map(([groupName, emojis]) => (
                        <div key={groupName} className="fb-emoji-group">
                          <span className="fb-emoji-group-title">{groupName}</span>
                          <div className="fb-emoji-grid">
                            {emojis.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                className={`fb-emoji-btn ${((iconPickerTarget === "new" ? newCatIcon : editCatIcon) === emoji) ? "active" : ""}`}
                                onClick={() => {
                                  if (iconPickerTarget === "new") {
                                    setNewCatIcon(emoji);
                                  } else {
                                    setEditCatIcon(emoji);
                                  }
                                  setIsPickingIcon(false);
                                }}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="fb-cat-list">
                  {state.categories
                    .filter((c) => {
                      const meta = state.categoryMeta?.[c];
                      return !meta || meta.type === catType;
                    })
                    .map((cat) => {
                      const meta = state.categoryMeta?.[cat];
                      const isArchived = meta?.archived;
                      const isEditing = editingCatName === cat;
                      const txCount = state.transactions.filter((t) => t.category === cat).length;

                      if (isEditing) {
                        return (
                          <form key={cat} className="fb-cat-edit-inline-form" onSubmit={handleSaveEditCat}>
                            <button
                              type="button"
                              className="fb-cat-icon-select-btn"
                              title="Chọn biểu tượng"
                              onClick={() => {
                                setIconPickerTarget("edit");
                                setIsPickingIcon(isPickingIcon && iconPickerTarget === "edit" ? false : true);
                              }}
                            >
                              <span>{editCatIcon}</span>
                            </button>
                            <input
                              type="text"
                              required
                              className="fb-input fb-cat-add-input"
                              value={editCatTitle}
                              onChange={(e) => setEditCatTitle(e.target.value)}
                            />
                            <button type="submit" className="fb-cat-action-btn fb-cat-save-btn" title="Lưu thay đổi">
                              <Check size={15} />
                            </button>
                            <button type="button" className="fb-cat-action-btn fb-cat-cancel-btn" title="Hủy" onClick={handleCancelEditCat}>
                              <X size={15} />
                            </button>
                          </form>
                        );
                      }

                      return (
                        <div key={cat} className={`fb-cat-item ${isArchived ? "is-archived" : ""}`}>
                          <div className="fb-cat-item-left">
                            <span className="fb-cat-icon-badge">
                              {categoryIcon(cat, state.categoryMeta)}
                            </span>
                            <div className="fb-cat-name-wrap">
                              <span className="fb-cat-name">{cat}</span>
                              {txCount > 0 && <small className="fb-cat-tx-badge">{txCount} giao dịch</small>}
                              {isArchived && <span className="fb-cat-archived-tag">Đã ẩn</span>}
                            </div>
                          </div>
                          <div className="fb-cat-item-actions">
                            {!isArchived ? (
                              <>
                                <button
                                  type="button"
                                  className="fb-cat-edit-btn"
                                  title={`Sửa danh mục ${cat}`}
                                  onClick={() => handleStartEditCat(cat)}
                                >
                                  <Pencil size={14} />
                                </button>
                                {cat !== "Chưa được phân loại" && (
                                  <button
                                    type="button"
                                    className="fb-cat-delete-btn"
                                    title={`Xóa hoặc ẩn danh mục ${cat}`}
                                    onClick={() => handleDeleteCategory(cat)}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="fb-cat-restore-btn"
                                  title={`Khôi phục danh mục ${cat}`}
                                  onClick={() => handleDeleteCategory(cat)}
                                >
                                  <RotateCcw size={14} />
                                  <span>Khôi phục</span>
                                </button>
                                <button
                                  type="button"
                                  className="fb-cat-delete-btn"
                                  title={`Chuyển ${txCount} giao dịch về "Chưa được phân loại" và xóa vĩnh viễn`}
                                  onClick={() => handleReassignAndDelete(cat)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </Modal>}
  </div>;
}
