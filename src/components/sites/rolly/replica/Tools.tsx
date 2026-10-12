"use client";

import { useState, type FormEvent } from "react";
import { ChevronRight, Plus, Check, Trash2 } from "lucide-react";
import { EmptyState, Field, Icon, Mascot, Modal, PageHeader, Toggle } from "./Ui";
import { money, updateState, useAppState, type Goal } from "./store";

export const tools = [
  { path: "budget", name: "Ngân sách", code: "f200", description: "Đặt ngân sách hàng ngày, hàng tuần hoặc hàng tháng để theo dõi chi tiêu của bạn", empty: "Hiện tại chưa có ngân sách nào được tạo.", prompt: "Bắt đầu thêm ngân sách của bạn ngay bây giờ!", add: "Thêm Ngân sách", create: "createBudget" },
  { path: "savings", name: "Tiết kiệm", code: "m:e553", description: "Theo dõi mục tiêu tiết kiệm của bạn.", empty: "Hiện tại chưa có khoản tiết kiệm nào được tạo.", prompt: "Bắt đầu thêm mục tiêu tiết kiệm của bạn ngay bây giờ!", add: "Thêm Tiết kiệm", create: "createSavingsGoal" },
  { path: "debt", name: "Món nợ", code: "m:e1a0", description: "Theo dõi và thanh toán các khoản nợ.", empty: "Hiện tại vẫn chưa có lệnh xóa nợ nào được tạo.", prompt: "Hãy bắt đầu xóa nợ ngay bây giờ!", add: "Thêm nợ", create: "createDebtClerance" },
  { path: "loanList", name: "Cho vay/Vay mượn", code: "m:f06be", description: "Theo dõi tiền bạn đã cho vay hoặc đi vay.", empty: "Chưa có bản ghi vay/cho vay", prompt: "Bắt đầu theo dõi tiền bạn đã cho vay hoặc đi vay.", add: "Thêm vay/cho vay", create: "createLoan" },
  { path: "challenge", name: "Thử thách", code: "f091", description: "Cạnh tranh với bạn bè để tiết kiệm nhiều hơn, theo dõi tiến trình và leo lên bảng xếp hạng.", empty: "Hiện tại vẫn chưa có thử thách nào được tạo ra.", prompt: "Bắt đầu thêm thử thách và mời bạn bè của bạn ngay!", add: "Thêm thử thách", create: "createChallenge" },
];
export function CurrencySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <Field label="Tiền tệ"><select value={value} onChange={(e) => onChange(e.target.value)}>{["USD", "VND", "AUD", "EUR", "GBP", "SGD", "JPY", "CAD", "CNY", "THB", "KRW", "INR", "IDR", "MYR", "PHP", "NZD", "CHF", "HKD", "TWD"].map((code) => <option key={code} value={code}>{code} ({({ USD: "$", VND: "₫", EUR: "€", GBP: "£", JPY: "¥" } as Record<string, string>)[code] || "$"})</option>)}</select></Field>;
}
export function ToolMenu({ navigate }: { navigate: (screen: string) => void }) {
  return <div className="r-tool-menu"><h1>Công cụ tiền tệ</h1><p>Chọn một công cụ để quản lý tài chính của bạn</p><div>{tools.map((tool) => <button key={tool.path} type="button" onClick={() => navigate(tool.path)} className="r-tool-row"><span className="r-tool-icon"><Icon code={tool.code} /></span><span><b>{tool.name}</b><small>{tool.description}</small></span><ChevronRight size={28} /></button>)}</div></div>;
}
export function ToolPage({ screen, navigate }: { screen: string; navigate: (screen: string) => void }) {
  const tool = tools.find((t) => t.path === screen) || tools[0];
  const state = useAppState();
  const [hide, setHide] = useState(false);
  const [mode, setMode] = useState("Một lần");
  const [allWallets, setAllWallets] = useState(false);
  const [walletId, setWalletId] = useState(state.wallets[0].id);
  const [aiMenu, setAiMenu] = useState(false);
  const records = state.goals.filter((g) => g.kind === screen && (!hide || g.saved < g.amount) && (screen !== "savings" || (mode === "Một lần" ? g.cycle === "Một lần" : g.cycle !== "Một lần")) && (screen !== "loanList" || mode === "Một lần" || mode === "Tất cả" || (mode === "Tôi nợ" ? g.direction === "Tôi vay" : g.direction === "Tôi cho vay")) && (screen !== "budget" || allWallets || g.wallet === walletId));
  return <div className="r-tool-page"><PageHeader onBack={() => navigate("?tab=tools")} /><div className="r-tool-tabs">{tools.map((t) => <button key={t.path} type="button" className={t.path === screen ? "active" : ""} onClick={() => navigate(t.path)}><Icon code={t.code} />{t.name}</button>)}</div>
    {screen !== "challenge" && <div className="r-tool-filter">{screen === "budget" && <select className="r-wallet-chip" aria-label="Chọn ví" value={walletId} onChange={(e) => setWalletId(e.target.value)}>{state.wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>}<label><Toggle label={screen === "budget" ? "Hiển thị tất cả ví" : "Ẩn đã hoàn thành"} checked={screen === "budget" ? allWallets : hide} onChange={screen === "budget" ? setAllWallets : setHide} />{screen === "budget" ? "Hiển thị tất cả ví" : "Ẩn đã hoàn thành"}</label></div>}
    {screen === "savings" && <div className="r-type-pills">{["Một lần", "Định kỳ"].map((label) => <button key={label} type="button" className={mode === label ? "active" : ""} onClick={() => setMode(label)}>{label}</button>)}</div>}
    {screen === "loanList" && <div className="r-type-pills">{["Tất cả", "Tôi nợ", "Người khác nợ tôi"].map((label) => <button key={label} type="button" className={mode === label || (label === "Tất cả" && mode === "Một lần") ? "active" : ""} onClick={() => setMode(label)}>{label}</button>)}</div>}
    {records.length === 0 ? <EmptyState title={tool.empty} text={tool.prompt} className="r-tool-empty" /> : <div className="r-goal-list">{records.map((g) => <button type="button" key={g.id} onClick={() => navigate("goalDetails?id=" + g.id)} className="r-goal-card"><Icon code={tool.code} /><div><b>{g.title}</b><small>{g.person || g.category || g.cycle}</small><progress value={Math.min(g.saved, g.amount)} max={g.amount} /><span>{money(g.saved, g.currency)} / {money(g.amount, g.currency)} · {g.date}</span></div><ChevronRight /></button>)}</div>}
    <button type="button" className="r-fab r-fab-wide r-fab-no-nav" onClick={() => screen === "budget" ? setAiMenu(!aiMenu) : navigate(tool.create + (screen === "savings" ? "?initialType=" + (mode === "Định kỳ" ? "recurring" : "one-off") : ""))}><Plus size={22} />{tool.add}</button>
    {aiMenu && <Modal onClose={() => setAiMenu(false)}><div className="r-menu-options"><button type="button" onClick={() => navigate("budgetwithAIEntry")}><Icon code="f544" />Ngân sách với AI</button><button type="button" onClick={() => navigate(tool.create)}><Icon code="f304" />Thêm thủ công</button></div></Modal>}
  </div>;
}
export function GoalForm({ screen, initialType, navigate }: { screen: string; initialType?: string; navigate: (screen: string) => void }) {
  const state = useAppState();
  const tool = tools.find((t) => t.create === screen) || tools[0];
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [date, setDate] = useState("2026-10-12");
  const [cycle, setCycle] = useState(initialType === "recurring" ? "Hàng tháng" : "Một lần");
  const [type, setType] = useState("Chi phí");
  const [direction, setDirection] = useState("Tôi cho vay");
  const [person, setPerson] = useState("");
  const [include, setInclude] = useState(true);
  const [wallet, setWallet] = useState(state.wallets[0].id);
  const [category, setCategory] = useState("");
  const [categoryModal, setCategoryModal] = useState(false);
  const headings: Record<string, [string, string, string]> = {
    budget: ["Tạo Ngân sách", "Tạo ngân sách cho danh mục Chi phí của bạn bên dưới.", "Số tiền ngân sách"],
    savings: ["Tạo mục tiêu tiết kiệm", "Đặt mục tiêu một lần hoặc kế hoạch tiết kiệm định kỳ (hàng tuần hoặc hàng tháng).", "Số tiền tiết kiệm"],
    debt: ["Tạo thanh toán nợ", "Theo dõi và quản lý tiến trình thanh toán nợ của bạn", "Số tiền nợ"],
    loanList: ["Vay/Cho vay mới", "Theo dõi tiền bạn đã cho ai vay hoặc vay từ ai.", "Số tiền"],
    challenge: ["Tạo thử thách", "Đặt thử thách mà bạn muốn thực hiện với bạn bè.", "Số tiền tiết kiệm"],
  };
  const [heading, description, amountLabel] = headings[tool.path];
  function save(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || Number(amount) <= 0) return;
    const goal: Goal = { id: crypto.randomUUID(), kind: tool.path, title: title.trim(), amount: Number(amount), saved: 0, currency, date, cycle: tool.path === "budget" && cycle === "Một lần" ? "Hàng tháng" : cycle, category, wallet, direction, person };
    updateState((s) => ({ ...s, goals: [...s.goals, goal], transactions: tool.path === "loanList" && include ? [...s.transactions, { id: crypto.randomUUID(), title, amount: Number(amount), type: direction === "Tôi vay" ? "income" : "expense", category: "Cho vay/Vay mượn", date, wallet, note: person }] : s.transactions }));
    navigate(tool.path);
  }
  return <div className="r-form-page"><PageHeader title={heading} subtitle={description} close onBack={() => navigate(tool.path)} /><form className="r-form" onSubmit={save}>
    {tool.path === "budget" && <div className="r-type-pills r-align-left">{["Chi phí", "Thu nhập"].map((t) => <button key={t} type="button" className={t === type ? "active" : ""} onClick={() => setType(t)}>{t}</button>)}</div>}
    {tool.path === "savings" && <div className="r-two-options">{["Một lần", "Định kỳ"].map((t) => <button key={t} type="button" className={(cycle === "Một lần") === (t === "Một lần") ? "active" : ""} onClick={() => setCycle(t === "Một lần" ? t : "Hàng tháng")}>{t}</button>)}</div>}
    {tool.path === "loanList" && <div className="r-two-options">{["Tôi cho vay", "Tôi vay"].map((t) => <button key={t} type="button" className={direction === t ? "active" : ""} onClick={() => setDirection(t)}>{t}</button>)}</div>}
    {tool.path === "challenge" && <span className="r-selected-label">Tiết kiệm</span>}
    <input aria-label="Tiêu đề" placeholder="Tiêu đề" required value={title} onChange={(e) => setTitle(e.target.value)} />
    {tool.path === "loanList" && <input aria-label={direction === "Tôi vay" ? "Người cho vay" : "Người vay"} placeholder={direction === "Tôi vay" ? "Người cho vay" : "Người vay"} required value={person} onChange={(e) => setPerson(e.target.value)} />}
    {tool.path !== "budget" && <CurrencySelect value={currency} onChange={(value) => setCurrency(value.split(" ")[0])} />}
    <input aria-label={amountLabel} placeholder={amountLabel} type="number" min="0.01" step="any" required value={amount} onChange={(e) => setAmount(e.target.value)} />
    <div className={tool.path === "budget" ? "r-date-cycle" : ""}><Field label={tool.path === "budget" ? "Ngày bắt đầu" : tool.path === "loanList" ? "Ngày đến hạn (tùy chọn)" : "Ngày mục tiêu"}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>{(tool.path === "budget" || (tool.path === "savings" && cycle !== "Một lần")) && <select aria-label="Chu kỳ lặp" value={cycle === "Một lần" ? "Hàng tháng" : cycle} onChange={(e) => setCycle(e.target.value)}>{["Hàng ngày", "Hàng tuần", "Hai tuần", "Hàng tháng"].map((t) => <option key={t}>{t}</option>)}</select>}</div>
    {tool.path === "budget" && <><small>Loại</small><button type="button" className="r-secondary r-fit" onClick={() => setCategoryModal(true)}><Plus size={16} />{category || "Thêm danh mục"}</button></>}
    {tool.path === "loanList" && <><small>{direction === "Tôi cho vay" ? "Bạn vừa cho vay tiền từ ví đúng không?" : "Bạn vừa nhận tiền vào ví đúng không?"}</small><div className="r-type-pills r-align-left"><button type="button" className={include ? "active" : ""} onClick={() => setInclude(true)}>Có</button><button type="button" className={!include ? "active" : ""} onClick={() => setInclude(false)}>Không</button></div></>}
    {(tool.path === "budget" || (tool.path === "loanList" && include)) && <><small>{tool.path === "budget" ? "Chọn Ví" : "Từ ví"}</small><div className="r-type-pills r-align-left">{state.wallets.map((w) => <button key={w.id} type="button" className={wallet === w.id ? "r-wallet-selected" : ""} onClick={() => setWallet(w.id)}>{w.name}{wallet === w.id && <Check size={18} />}</button>)}</div></>}
    <button type="submit" className="r-primary r-save-goal">Lưu</button>
  </form>{categoryModal && <Modal title="Chọn danh mục" onClose={() => setCategoryModal(false)} sheet><div className="r-wallet-options">{state.categories.map((c) => <button key={c} onClick={() => { setCategory(c); setCategoryModal(false); }}>{c}</button>)}</div></Modal>}</div>;
}
export function BudgetAI({ navigate }: { navigate: (screen: string) => void }) {
  const state = useAppState();
  const [income, setIncome] = useState("");
  const [frequency, setFrequency] = useState("Hàng tháng");
  const [cycle, setCycle] = useState("Hàng tháng");
  const [description, setDescription] = useState("");
  const [review, setReview] = useState(false);
  const wallet = state.wallets[0];
  const annualFactors: Record<string, number> = { "Hàng tuần": 52, "Hai tuần": 26, "Hàng tháng": 12, "Hàng năm": 1 };
  const amount = Number(income) * annualFactors[frequency] / annualFactors[cycle];
  const portions: [string, number][] = [["Nhu cầu", 0.5], ["Mong muốn", 0.3], ["Tiết kiệm", 0.2]];
  return <div className="r-budget-ai"><button type="button" className="r-icon-button" aria-label="Đóng" onClick={() => navigate("budget")}><Plus className="r-rotate-close" size={20} /></button><Mascot greeting="Hãy để tôi tùy chỉnh ngân sách của bạn!" /><p><Icon code="m:e041" /> {wallet.name}</p><p>Chúng tôi sẽ giúp bạn xây dựng một kế hoạch thông minh bằng cách sử dụng quy tắc 50/30/20 — 50% cho nhu cầu, 30% cho mong muốn và 20% cho tiết kiệm.</p><p>Hãy cho FinBridge biết thu nhập và lối sống của bạn, chúng tôi sẽ cá nhân hóa kế hoạch cho bạn.</p><form className="r-form" onSubmit={(event) => { event.preventDefault(); setReview(true); }}><label>Thu nhập (sau thuế)<div className="r-two-options"><input aria-label="Thu nhập (sau thuế)" placeholder={money(0, wallet.currency).replace("0", "")} type="number" min="0.01" step="any" required value={income} onChange={(event) => setIncome(event.target.value)} /><select aria-label="Chu kỳ thu nhập" value={frequency} onChange={(event) => setFrequency(event.target.value)}>{Object.keys(annualFactors).map((value) => <option key={value}>{value}</option>)}</select></div></label><label>Mô tả lối sống của bạn để có kế hoạch ngân sách cá nhân hóa hơn<textarea aria-label="Mô tả lối sống" maxLength={500} placeholder="Tôi sống ở Hà Nội, trả khoảng 10 triệu đồng tiền thuê nhà mỗi tháng, và thường đi ăn ngoài 2 lần mỗi tuần." value={description} onChange={(event) => setDescription(event.target.value)} /><small>{description.length}/500</small></label><label>Ngân sách này nên được thiết lập lại bao lâu một lần?<select aria-label="Chu kỳ ngân sách" value={cycle} onChange={(event) => setCycle(event.target.value)}>{Object.keys(annualFactors).map((value) => <option key={value}>{value}</option>)}</select></label><button type="submit" className="r-primary">Tạo ngân sách của tôi</button></form>{review && <Modal title="Kế hoạch 50/30/20" onClose={() => setReview(false)}><p className="r-dialog-note">Bản cục bộ tính theo tỷ lệ cố định, chưa kết nối AI để phân tích mô tả lối sống.</p><div className="r-breakdown">{portions.map(([title, ratio]) => <p key={title}><span>{title} · {ratio * 100}%</span><b>{money(amount * ratio, wallet.currency)}</b></p>)}</div><button className="r-primary" onClick={() => { updateState((s) => ({ ...s, goals: [...s.goals, ...portions.map(([title, ratio]) => ({ id: crypto.randomUUID(), kind: title === "Tiết kiệm" ? "savings" : "budget", title, amount: amount * ratio, saved: 0, currency: wallet.currency, date: "2026-10-12", cycle, category: "", wallet: wallet.id, direction: "", person: "" }))] })); navigate("budget"); }}>Lưu kế hoạch</button></Modal>}</div>;
}
export function GoalDetails({ id, navigate }: { id: string; navigate: (screen: string) => void }) {
  const state = useAppState();
  const goal = state.goals.find((g) => g.id === id);
  const [amount, setAmount] = useState("");
  const [action, setAction] = useState("");
  if (!goal) return <div><PageHeader title="Chi tiết" onBack={() => navigate("?tab=tools")} /><EmptyState title="Không tìm thấy bản ghi." /></div>;
  return <div className="r-detail-page"><PageHeader title={goal.title} onBack={() => navigate(goal.kind)} /><div className="r-goal-detail-summary"><h2>{money(goal.saved, goal.currency)} / {money(goal.amount, goal.currency)}</h2><progress max={goal.amount} value={goal.saved} /><p>{goal.person || goal.category} · {goal.date}</p></div><div className="r-two-options"><button type="button" className="r-primary" onClick={() => setAction("fund")}><Plus size={18} />{goal.kind === "debt" ? "Thanh toán nợ" : "Thêm tiền"}</button><button type="button" className="r-secondary" onClick={() => setAction("delete")}><Trash2 size={18} />Xóa</button></div>{goal.kind === "challenge" && <div className="r-form"><h2>Bảng xếp hạng</h2><p>1. Bạn · {money(goal.saved, goal.currency)}</p><button className="r-secondary" onClick={() => setAction("invite")}>Mời bạn bè</button></div>}{action && <Modal title={action === "fund" ? "Di chuyển Quỹ" : action === "delete" ? "Xóa bản ghi?" : "Mời bạn bè"} onClose={() => setAction("")}><div className="r-form">{action === "fund" ? <form onSubmit={(e) => { e.preventDefault(); if (Number(amount) <= 0) return; updateState((s) => ({ ...s, goals: s.goals.map((g) => g.id === id ? { ...g, saved: g.saved + Number(amount) } : g) })); setAction(""); }}><input type="number" placeholder="Số tiền" aria-label="Số tiền" value={amount} required min="0.01" step="any" onChange={(e) => setAmount(e.target.value)} /><button className="r-primary">Lưu</button></form> : action === "delete" ? <><p>Bạn có chắc chắn muốn xóa bản ghi này không?</p><button className="r-danger" onClick={() => { updateState((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) })); navigate(goal.kind); }}>Xóa</button></> : <><p>Chia sẻ thử thách của bạn với bạn bè.</p><input readOnly aria-label="Liên kết mời" value={"/app/goalDetails?id=" + id} /><button className="r-primary" onClick={() => { navigator.clipboard.writeText(window.location.href); setAction(""); }}>Sao chép liên kết</button></>}</div></Modal>}</div>;
}
