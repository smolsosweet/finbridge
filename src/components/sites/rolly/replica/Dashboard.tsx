"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown, Info, Pencil, Plus, Search, X } from "lucide-react";
import { Animation } from "./Animation";
import { EmptyState, Icon, Mascot, Modal } from "./Ui";
import { money, useAppState, type Transaction } from "./store";

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
  const list = transactionsTab ? records : records.filter((t) => t.type === type);
  const close = () => setModal("");
  return <div className={"r-dashboard " + (transactionsTab ? "r-transactions" : "r-home")}>
    {transactionsTab ? <div className="r-transactions-heading"><h1>Giao dịch</h1><div><button type="button" className="r-icon-button" onClick={() => setModal("search")} aria-label="Tìm kiếm giao dịch"><Search size={22} /></button><button type="button" className="r-icon-button" onClick={() => navigate("calendar")} aria-label="Lịch giao dịch"><CalendarDays size={22} /></button></div></div> : <><button type="button" className="r-milestone-pill" onClick={() => navigate("milestones")}><Animation name="Trophy" className="r-trophy-animation" />Những cột mốc</button><Mascot greeting={"Chào " + state.settings.name + " 👋"} className="r-home-mascot" /></>}
    {!transactionsTab ? <div className="r-wallets">{state.wallets.map((w) => <div key={w.id} className={"r-wallet-card " + (w.id === wallet.id ? "is-selected" : "")}><button type="button" onClick={() => setWalletId(w.id)} className="r-wallet-content" aria-label={"Chọn ví " + w.name}><Icon code="f555" /><span>{w.name}</span><b>{money(w.initial + state.transactions.reduce((a, t) => a + (t.wallet === w.id ? (t.type === "income" ? t.amount : -t.amount) : t.targetWallet === w.id ? t.amount : 0), 0), w.currency)}</b></button><button type="button" className="r-wallet-edit" aria-label={"Sửa ví " + w.name} onClick={() => navigate("walletSettings?wallet=" + w.id)}><Pencil size={16} /></button></div>)}<button type="button" className="r-new-wallet" onClick={() => navigate("createWallet1")}><Plus size={27} /><span>Ví mới</span></button></div> : <button type="button" className="r-wallet-chip" onClick={() => setModal("wallet")}><Icon code="f555" />{wallet.name}<ChevronDown size={13} /></button>}
    <div className="r-period-controls"><button type="button" onClick={() => setModal("period")} className="r-period">{period}<CalendarDays size={17} /><ChevronDown size={17} /></button>{period !== "Mọi thời gian" && <button type="button" onClick={() => setModal(period === "Tháng" ? "month" : "range")} className="r-period-date">{period === "Tháng" ? "tháng " + (month + 1) + " năm " + year : period === "Năm" ? year : period === "Ngày" ? day : from + " – " + to}<ChevronDown size={15} /></button>}</div>
    {transactionsTab ? <button type="button" className="r-totals-strip" onClick={() => setModal("totals")}><span className="r-expense">▼ {money(expense, wallet.currency)}</span><span className="r-income">▲ {money(income, wallet.currency)}</span><span>☰ {money(income - expense, wallet.currency)}</span></button> : <><button type="button" className="r-summary" onClick={() => setModal("totals")}><div className="r-summary-top"><span>Thay đổi ròng<b>{money(income - expense, wallet.currency)}</b></span><Info size={21} /></div><div className="r-summary-cards"><div className="r-expense">Chi phí<small>▼ {money(expense, wallet.currency)}</small></div><div className="r-income">Thu nhập<small>▲ {money(income, wallet.currency)}</small></div></div></button><div className="r-type-pills"><button className={type === "expense" ? "active" : ""} onClick={() => setType("expense")}>Chi phí</button><button className={type === "income" ? "active" : ""} onClick={() => setType("income")}>Thu nhập</button></div></>}
    {list.length === 0 ? <EmptyState title="Chưa có giao dịch trong kỳ này." text="Nhấn + để thêm giao dịch." className="r-dashboard-empty" /> : <div className="r-record-list">{list.map((t) => <button key={t.id} type="button" className="r-record" onClick={() => navigate("editTransaction?id=" + t.id)}><span className="r-category-symbol"> {t.category === "Thức ăn & Đồ uống" ? "🍔" : t.type === "income" ? "💰" : "💳"} </span><span><b>{t.category}</b><small>{t.title} · {t.date}</small></span><b className={t.type === "income" ? "r-income" : "r-expense"}>{t.type === "income" ? "+" : "−"}{money(t.amount, wallet.currency)}</b></button>)}</div>}
    {!transactionsTab && state.transactions.length > 0 && state.settings.totalBalance && <div className="r-balance-total">Tổng số dư <b>{money(allBalance, wallet.currency)}</b></div>}
    <button type="button" className="r-fab" aria-label="Thêm giao dịch" onClick={() => navigate(state.settings.manual ? "addTransaction" : "addTransactionChatMode")}><Plus size={32} /></button>
    {modal && <Modal title={modal === "period" ? "Chọn khoảng thời gian" : modal === "search" ? "Tìm kiếm giao dịch" : modal === "wallet" ? "Chọn ví" : undefined} onClose={close} sheet={["period", "search", "wallet"].includes(modal)}>
      {modal === "period" && <div className="r-period-options">{["Ngày", "Tuần", "Tháng", "Năm", "Mọi thời gian", "Phạm vi tùy chỉnh"].map((p) => <button key={p} type="button" className={p === period ? "is-selected" : ""} onClick={() => { setPeriod(p); setModal(p === "Phạm vi tùy chỉnh" ? "range" : ""); }}><CalendarDays size={22} />{p}</button>)}</div>}
      {modal === "month" && <div className="r-month-picker"><aside><span>Thg {month + 1} {year}</span><button type="button" onClick={() => setYear(year - 1)}>⌃</button><b>{year}</b><button type="button" onClick={() => setYear(year + 1)}>⌄</button></aside><div><div className="r-month-grid">{Array.from({ length: 12 }, (_, i) => <button key={i} type="button" className={i === month ? "active" : ""} onClick={() => setMonth(i)}>Thg {i + 1}</button>)}</div><footer><button type="button" onClick={close}>Huỷ</button><button type="button" onClick={close}>OK</button></footer></div></div>}
      {modal === "range" && <div className="r-form"><label>Ngày<input aria-label="Ngày" type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label><label>Từ ngày<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label>Đến ngày<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label><input aria-label="Năm" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /><button type="button" className="r-primary" onClick={close}>Xác nhận</button></div>}
      {modal === "search" && <div className="r-form"><input aria-label="Tìm kiếm giao dịch" placeholder="Tìm kiếm giao dịch..." value={search} onChange={(e) => setSearch(e.target.value)} /><button type="button" className="r-primary" onClick={close}>Tìm kiếm</button>{search && <button type="button" className="r-secondary" onClick={() => { setSearch(""); close(); }}><X size={16} />Xóa tìm kiếm</button>}</div>}
      {modal === "wallet" && <div className="r-wallet-options">{state.wallets.map((w) => <button key={w.id} type="button" onClick={() => { setWalletId(w.id); close(); }} className={w.id === wallet.id ? "active" : ""}><Icon code="f555" />{w.name}<span>{money(w.initial, w.currency)}</span></button>)}</div>}
      {modal === "totals" && <div className="r-breakdown"><p className="r-expense"><span>Chi phí</span>{money(expense, wallet.currency)}</p><p className="r-income"><span>Thu nhập</span>{money(income, wallet.currency)}</p><p><span>Chuyển khoản</span>{money(records.filter((r) => r.type === "transfer").reduce((a, r) => a + r.amount, 0), wallet.currency)}</p><p className="r-breakdown-total"><span>Tổng cộng</span>{money(income - expense, wallet.currency)}</p></div>}
    </Modal>}
  </div>;
}
