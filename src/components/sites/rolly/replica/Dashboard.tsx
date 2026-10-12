"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, ChevronDown, Info, Pencil, Plus, ReceiptText, Search, Trophy, Wallet, X } from "lucide-react";
import { EmptyState, Icon, Modal } from "./Ui";
import { money, useAppState, type Transaction } from "./store";

type DashboardSample = { id: string; date: string; type: "expense" | "income"; amount: number; category: string; currency: string };

const DASHBOARD_SAMPLE: DashboardSample[] = [
  { id: "sample-01", date: "2025-11-06", type: "income", amount: 2200, category: "Thu nhập", currency: "USD" },
  { id: "sample-02", date: "2025-11-18", type: "expense", amount: 145, category: "Ăn uống", currency: "USD" },
  { id: "sample-03", date: "2025-12-04", type: "expense", amount: 320, category: "Mua sắm", currency: "USD" },
  { id: "sample-04", date: "2025-12-22", type: "income", amount: 180, category: "Quà tặng", currency: "USD" },
  { id: "sample-05", date: "2026-01-11", type: "expense", amount: 410, category: "Nhà ở", currency: "USD" },
  { id: "sample-06", date: "2026-01-28", type: "expense", amount: 96, category: "Di chuyển", currency: "USD" },
  { id: "sample-07", date: "2026-02-14", type: "income", amount: 2400, category: "Thu nhập", currency: "USD" },
  { id: "sample-08", date: "2026-02-26", type: "expense", amount: 210, category: "Ăn uống", currency: "USD" },
  { id: "sample-09", date: "2026-03-10", type: "expense", amount: 278, category: "Mua sắm", currency: "USD" },
  { id: "sample-10", date: "2026-03-29", type: "expense", amount: 158, category: "Giải trí", currency: "USD" },
  { id: "sample-11", date: "2026-04-09", type: "income", amount: 2300, category: "Thu nhập", currency: "USD" },
  { id: "sample-12", date: "2026-04-23", type: "expense", amount: 365, category: "Nhà ở", currency: "USD" },
  { id: "sample-13", date: "2026-05-17", type: "expense", amount: 132, category: "Ăn uống", currency: "USD" },
  { id: "sample-14", date: "2026-05-30", type: "expense", amount: 88, category: "Di chuyển", currency: "USD" },
  { id: "sample-15", date: "2026-06-12", type: "income", amount: 2450, category: "Thu nhập", currency: "USD" },
  { id: "sample-16", date: "2026-07-05", type: "expense", amount: 440, category: "Mua sắm", currency: "USD" },
  { id: "sample-17", date: "2026-07-24", type: "expense", amount: 174, category: "Ăn uống", currency: "USD" },
  { id: "sample-18", date: "2026-08-19", type: "expense", amount: 312, category: "Nhà ở", currency: "USD" },
  { id: "sample-19", date: "2026-09-14", type: "income", amount: 2380, category: "Thu nhập", currency: "USD" },
  { id: "sample-20", date: "2026-10-12", type: "expense", amount: 260, category: "Ăn uống", currency: "USD" },
];

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
  const [walletId, setWalletId] = useState(state.wallets[0].id);
  const wallet = state.wallets.find((w) => w.id === walletId) || state.wallets[0];
  const [period, setPeriod] = useState("Tháng");
  const [month, setMonth] = useState(9);
  const [year, setYear] = useState(2026);
  const [day, setDay] = useState("2026-10-12");
  const [from, setFrom] = useState("2026-10-01");
  const [to, setTo] = useState("2026-10-31");
  const [type, setType] = useState("expense");
  const [dashboardType, setDashboardType] = useState<"all" | "expense" | "income">("all");
  const [dashboardCategory, setDashboardCategory] = useState("all");
  const [dashboardCurrency, setDashboardCurrency] = useState(wallet.currency);
  const [dashboardSource, setDashboardSource] = useState<"sample" | "live">("sample");
  const [dashboardWindow, setDashboardWindow] = useState("12");
  const [dashboardFrom, setDashboardFrom] = useState("2025-11-01");
  const [dashboardTo, setDashboardTo] = useState("2026-10-31");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState("");
  const records = state.transactions.filter((t) => {
    if (t.wallet !== wallet.id && t.targetWallet !== wallet.id) return false;
    if (period === "Tháng" && !t.date.startsWith(year + "-" + String(month + 1).padStart(2, "0"))) return false;
    if (period === "Năm" && !t.date.startsWith(String(year))) return false;
    if (period === "Ngày" && t.date !== day) return false;
    if ((period === "Phạm vi tùy chỉnh" || period === "Tuần") && (t.date < from || t.date > to)) return false;
    return (t.title + t.category + t.note).toLowerCase().includes(search.toLowerCase());
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
    return Array.from(groups, ([currency, amount]) => ({ currency, amount }));
  };
  const formatTotals = (field: "expense" | "income" | "net") => totalsByCurrency(field).map((total) => money(total.amount, total.currency)).join(" · ");
  const currencies = Array.from(new Set(state.wallets.map((item) => item.currency)));
  const walletBalanceTotals = currencies.map((currency) => {
    const amount = state.wallets.filter((item) => item.currency === currency).reduce((sum, item) => sum + item.initial + state.transactions.reduce((balance, transaction) => balance + (transaction.wallet === item.id ? (transaction.type === "income" ? transaction.amount : -transaction.amount) : transaction.targetWallet === item.id ? transaction.amount : 0), 0), 0);
    return money(amount, currency);
  }).join(" · ");
  const dashboardWalletIds = new Set(state.wallets.filter((item) => item.currency === dashboardCurrency).map((item) => item.id));
  const dashboardData = dashboardSource === "sample" ? DASHBOARD_SAMPLE : state.transactions.filter((transaction) => transaction.type !== "transfer" && dashboardWalletIds.has(transaction.wallet));
  const startDate = new Date(2026, 10 - Number(dashboardWindow), 1);
  const chartStart = dashboardWindow === "custom" ? dashboardFrom : dashboardWindow === "all" ? "" : startDate.getFullYear() + "-" + String(startDate.getMonth() + 1).padStart(2, "0") + "-01";
  const selectedChartStart = dashboardWindow === "week" || dashboardWindow === "day" ? "2026-10-12" : chartStart;
  const chartEnd = dashboardWindow === "custom" ? dashboardTo : dashboardWindow === "week" ? "2026-10-18" : dashboardWindow === "day" ? "2026-10-12" : "2026-10-31";
  const dashboardCategories = Array.from(new Set(dashboardData.map((transaction) => transaction.category))).sort();
  const dashboardRecords = dashboardData.filter((transaction) => transaction.date >= selectedChartStart && transaction.date <= chartEnd && (dashboardCategory === "all" || transaction.category === dashboardCategory));
  const dashboardBucket = (date: string) => ["1", "custom", "week", "day"].includes(dashboardWindow) ? date : date.slice(0, 7);
  const dashboardSeries = new Map<string, { expense: number; income: number }>();
  if (["3", "6", "12"].includes(dashboardWindow)) {
    for (let offset = Number(dashboardWindow) - 1; offset >= 0; offset--) {
      const date = new Date(2026, 9 - offset, 15);
      dashboardSeries.set(date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0"), { expense: 0, income: 0 });
    }
  }
  dashboardRecords.forEach((transaction) => {
    const key = dashboardBucket(transaction.date);
    const value = dashboardSeries.get(key) || { expense: 0, income: 0 };
    value[transaction.type === "expense" ? "expense" : "income"] += transaction.amount;
    dashboardSeries.set(key, value);
  });
  const dashboardPoints = Array.from(dashboardSeries, ([key, values]) => ({ key, ...values })).sort((a, b) => a.key.localeCompare(b.key));
  const dashboardMax = Math.max(1, ...dashboardPoints.flatMap((point) => [point.expense, point.income]));
  const chartLine = (values: number[]) => {
    if (values.length === 1) {
      const y = 170 - (values[0] / dashboardMax) * 132;
      return `300,${y} 300.01,${y}`;
    }
    return values.map((value, index) => {
    const x = values.length === 1 ? 300 : 20 + (index / (values.length - 1)) * 560;
    return `${x},${170 - (value / dashboardMax) * 132}`;
    }).join(" ");
  };
  const list = transactionsTab ? records : records.filter((t) => t.type === type);
  const close = () => setModal("");
  const addTransaction = () => navigate(state.settings.manual ? "addTransaction" : "addTransactionChatMode");
  const walletName = (name: string) => name === "." ? "Ví chính" : name;
  const periodControls = <div className="r-period-controls"><button type="button" onClick={() => setModal("period")} className="r-period">{period}<CalendarDays size={17} /><ChevronDown size={17} /></button>{period !== "Mọi thời gian" && <button type="button" onClick={() => setModal(period === "Tháng" ? "month" : "range")} className="r-period-date">{period === "Tháng" ? "tháng " + (month + 1) + " năm " + year : period === "Năm" ? year : period === "Ngày" ? day : from + " – " + to}<ChevronDown size={15} /></button>}</div>;
  const transactionRows = <div className="r-record-list">{list.map((t) => <button key={t.id} type="button" className="r-record" onClick={() => navigate("editTransaction?id=" + t.id)}><span className="r-category-symbol">{transactionsTab ? (t.category === "Thức ăn & Đồ uống" ? "🍔" : t.type === "income" ? "💰" : "🛍️") : t.type === "income" ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}</span><span><b>{t.category}</b><small>{t.title} · {t.date}</small></span><b className={t.type === "income" ? "r-income" : "r-expense"}>{t.type === "income" ? "+" : "−"}{money(t.amount, wallet.currency)}</b></button>)}</div>;
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
        <section className="fb-activity fb-spending-dashboard"><div className="fb-section-heading"><div><h2>Xu hướng chi tiêu</h2><p className="fb-section-note">Lọc nhanh dữ liệu để xem xét dòng tiền</p></div><button type="button" className="fb-view-transactions" onClick={() => navigate("?tab=transactions")}>Xem giao dịch<ArrowRight size={15} /></button></div>
          <div className="fb-chart-controls"><label className="fb-chart-select"><select aria-label="Nguồn dữ liệu biểu đồ" value={dashboardSource} onChange={(event) => { setDashboardSource(event.target.value as "sample" | "live"); setDashboardCategory("all"); }}><option value="sample">20 giao dịch mô phỏng</option><option value="live">Giao dịch của tôi</option></select><ChevronDown size={15} /></label><label className="fb-chart-select"><select aria-label="Khoảng thời gian biểu đồ" value={dashboardWindow} onChange={(event) => setDashboardWindow(event.target.value)}><option value="12">12 tháng</option><option value="6">6 tháng</option><option value="3">3 tháng</option><option value="1">Tháng 10/2026</option><option value="week">Tuần 12–18/10/2026</option><option value="day">Ngày 12/10/2026</option><option value="all">Mọi thời gian</option><option value="custom">Phạm vi tùy chỉnh</option></select><CalendarDays size={15} /></label>{dashboardWindow === "custom" && <div className="fb-chart-range"><label>Từ ngày<input aria-label="Từ ngày biểu đồ" type="date" value={dashboardFrom} max={dashboardTo} onChange={(event) => setDashboardFrom(event.target.value)} /></label><label>Đến ngày<input aria-label="Đến ngày biểu đồ" type="date" value={dashboardTo} min={dashboardFrom} onChange={(event) => setDashboardTo(event.target.value)} /></label></div>}<div className="r-type-pills" aria-label="Lọc loại giao dịch"><button type="button" className={dashboardType === "all" ? "active" : ""} onClick={() => setDashboardType("all")}>Tất cả</button><button type="button" className={dashboardType === "expense" ? "active" : ""} onClick={() => setDashboardType("expense")}>Chi</button><button type="button" className={dashboardType === "income" ? "active" : ""} onClick={() => setDashboardType("income")}>Thu</button></div><label className="fb-chart-select"><span className="sr-only">Lọc danh mục</span><select aria-label="Lọc danh mục" value={dashboardCategory} onChange={(event) => setDashboardCategory(event.target.value)}><option value="all">Tất cả danh mục</option>{dashboardCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select><ChevronDown size={15} /></label>{dashboardSource === "live" && currencies.length > 1 && <label className="fb-chart-select"><span className="sr-only">Chọn tiền tệ</span><select aria-label="Chọn tiền tệ" value={dashboardCurrency} onChange={(event) => setDashboardCurrency(event.target.value)}>{currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select><ChevronDown size={15} /></label>}</div>
          {dashboardRecords.length === 0 ? <div className="fb-chart-empty"><ReceiptText size={24} /><p>Chưa có dữ liệu phù hợp với bộ lọc này.</p></div> : <><div className="fb-chart-legend"><span className={dashboardType === "income" ? "is-muted" : ""}><i className="fb-chart-dot expense" />Chi</span><span className={dashboardType === "expense" ? "is-muted" : ""}><i className="fb-chart-dot income" />Thu</span><span>{dashboardRecords.length} giao dịch · {dashboardSource === "sample" ? "Mô phỏng · USD" : dashboardCurrency}</span></div><div className="fb-chart" role="img" aria-label="Biểu đồ xu hướng chi và thu"><div className="fb-chart-scale"><span>{money(dashboardMax, dashboardSource === "sample" ? "USD" : dashboardCurrency)}</span><span>0</span></div><svg viewBox="0 0 600 190" preserveAspectRatio="none"><line x1="20" x2="580" y1="38" y2="38" /><line x1="20" x2="580" y1="104" y2="104" /><line x1="20" x2="580" y1="170" y2="170" />{dashboardType !== "income" && <polyline className="fb-chart-line expense" points={chartLine(dashboardPoints.map((point) => point.expense))} />}{dashboardType !== "expense" && <polyline className="fb-chart-line income" points={chartLine(dashboardPoints.map((point) => point.income))} />}</svg><div className="fb-chart-axis">{dashboardPoints.filter((_, index) => dashboardPoints.length <= 12 || index === 0 || index === dashboardPoints.length - 1).map((point) => <span key={point.key}>{point.key.length === 7 ? point.key.slice(5) + "/" + point.key.slice(2, 4) : point.key.slice(8) + "/" + point.key.slice(5, 7)}</span>)}</div></div></>}
        </section>
        <section className="fb-wallet-flow-card"><div className="fb-section-heading"><div><h2>Chi & thu theo ví</h2><p className="fb-section-note">Số liệu của từng ví đã tích hợp trong kỳ</p></div><button type="button" className="fb-view-transactions" onClick={() => navigate("createWallet1")}><Plus size={15} />Thêm ví</button></div><div className="fb-wallet-flow-list">{walletFlows.map((flow) => <button type="button" key={flow.wallet.id} className={flow.wallet.id === wallet.id ? "is-selected" : ""} onClick={() => { setWalletId(flow.wallet.id); setDashboardCurrency(flow.wallet.currency); }}><span><b>{walletName(flow.wallet.name)}</b><small>{flow.wallet.currency}</small></span><span className="fb-wallet-flow-numbers"><small className="r-expense">Chi {money(flow.expense, flow.wallet.currency)}</small><small className="r-income">Thu {money(flow.income, flow.wallet.currency)}</small></span><ArrowRight size={16} /></button>)}</div><button type="button" className="fb-manage-wallets" onClick={() => navigate("walletSettings?wallet=" + wallet.id)}>Quản lý ví<ArrowRight size={16} /></button></section>
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
