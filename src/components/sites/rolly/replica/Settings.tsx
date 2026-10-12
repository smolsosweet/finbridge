"use client";

import { useState, type FormEvent } from "react";
import { Check, ChevronRight, Pencil, Sun, Moon, Trash2 } from "lucide-react";
import { Animation } from "./Animation";
import { Field, Icon, Mascot, Modal, PageHeader, Toggle } from "./Ui";
import { CurrencySelect } from "./Tools";
import { setSetting, money, updateState, useAppState, type Transaction, type Wallet } from "./store";

export const settingRows = [
  { name: "Cài đặt ví và danh mục", sub: "Thể loại, Tiền tệ, Số dư ban đầu", code: "f555", path: "walletSettings" },
  { name: "Cài đặt tài khoản", sub: "Ngôn ngữ, Cài đặt FinBridge, Xuất/Nhập CSV", code: "f013", path: "accountSettings" },
  { name: "Tận hưởng FinBridge Premium", code: "f521", path: "paywall7dTrial" },
  { name: "Yêu cầu tính năng", code: "f022", path: "featureRequest" },
  { name: "Liên hệ với chúng tôi", code: "f059", path: "support" },
  { name: "Điều khoản dịch vụ", code: "f002", path: "terms" },
  { name: "Chính sách bảo mật", code: "f3ed", path: "privacy" },
];
export function SettingsMenu({ navigate }: { navigate: (screen: string) => void }) {
  const state = useAppState();
  return <div className="r-settings-menu"><button type="button" className="r-theme-button" aria-label="Chọn chủ đề" onClick={() => navigate("accountSettings?option=theme")}>{state.settings.theme === "dark" ? <Moon /> : <Sun />}</button><Mascot className="r-settings-mascot" /><div className="r-setting-rows">{settingRows.map((item, index) => <div key={item.path}>{index === 2 && <hr />}<button type="button" className={"r-setting-row " + (item.sub ? "r-setting-large" : "")} onClick={() => navigate(item.path)}><Icon code={item.code} className={item.path === "paywall7dTrial" ? "r-gold" : ""} /><span>{item.name}{item.sub && <small>{item.sub}</small>}</span></button></div>)}</div></div>;
}
const accountOptions = [
  ["Tính cách của FinBridge", "f118", "personality"],
  ["Ngôn ngữ phản hồi của FinBridge", "f075", "reply"],
  ["Mục tiêu tài chính", "f024", "goals"],
  ["Chủ đề màu sắc", "f53f", "theme"],
  ["Cấu hình trang chủ", "f009", "homepageConfiguration"],
  ["Định dạng số tiền", "f031", "format"],
  ["Đặt tháng bắt đầu", "f073", "monthStart"],
  ["Nhắc nhở thông báo", "f0f3", "notification"],
  ["Xuất CSV", "f019", "export"],
  ["Nhập CSV", "f56f", "import"],
  ["Chế độ thêm giao dịch thủ công", "f304", "manual"],
] as const;
export function AccountSettings({ navigate, initialOption = "" }: { navigate: (screen: string) => void; initialOption?: string }) {
  const state = useAppState();
  const [option, setOption] = useState(initialOption);
  const [selection, setSelection] = useState(String(state.settings.personality));
  const [value, setValue] = useState("");
  const [extra, setExtra] = useState("");
  const [exportRange, setExportRange] = useState(false);
  const [rangeFrom, setRangeFrom] = useState("2026-10-01");
  const [rangeTo, setRangeTo] = useState("2026-10-31");
  const [csvError, setCsvError] = useState("");
  const close = () => setOption("");
  function open(name: string) {
    if (name === "homepageConfiguration") { navigate(name); return; }
    setOption(name);
    setSelection(String(state.settings.personality));
    setValue(name === "goals" ? String(state.settings.goal) : name === "profile" ? String(state.settings.name) : String(state.settings[name] || ""));
    setExtra(String(state.settings.less));
  }
  function exportCsv(template = false) {
    const quote = (v: string | number) => '"' + String(v).replaceAll('"', '""') + '"';
    const rows = template ? [["2026-10-12", "expense", "Ăn trưa", 50000, "Thức ăn & Đồ uống", state.wallets[0].name, ""]] : state.transactions.filter((t) => !exportRange || (t.date >= rangeFrom && t.date <= rangeTo)).map((t) => [t.date, t.type, t.title, t.amount, t.category, state.wallets.find((w) => w.id === t.wallet)?.name || ".", t.note]);
    const csv = "\uFEFF" + [["date", "type", "title", "amount", "category", "wallet", "note"], ...rows].map((row) => row.map(quote).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = template ? "rolly-template.csv" : "rolly-transactions.csv"; a.click();
    URL.revokeObjectURL(url);
  }
  async function importCsv(file: File) {
    const text = (await file.text()).replace(/^\uFEFF/, "");
    const rows: string[][] = [];
    let row: string[] = [], field = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"' && text[i + 1] === '"' && quoted) { field += '"'; i++; }
      else if (c === '"') quoted = !quoted;
      else if (c === "," && !quoted) { row.push(field); field = ""; }
      else if (c === "\n" && !quoted) { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
      else field += c;
    }
    if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
    if (rows.length > 1001) { setCsvError("Có thể nhập tối đa 1000 hàng dữ liệu giao dịch cùng một lúc."); return; }
    if (rows[0]?.slice(0, 4).join(",") !== "date,type,title,amount") { setCsvError("Vui lòng sử dụng mẫu CSV đã tải xuống."); return; }
    const items: Transaction[] = [];
    for (const r of rows.slice(1).filter((r) => r.some(Boolean))) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r[0]) || !Number.isFinite(Number(r[3])) || Number(r[3]) <= 0) { setCsvError("Một hàng có ngày hoặc số tiền không hợp lệ."); return; }
      items.push({ id: crypto.randomUUID(), date: r[0], type: r[1] === "income" ? "income" : "expense", title: r[2], amount: Number(r[3]), category: r[4] || state.categories[0], wallet: state.wallets.find((w) => w.name === r[5])?.id || state.wallets[0].id, note: r[6] || "" });
    }
    updateState((s) => ({ ...s, transactions: [...s.transactions, ...items] }));
    setCsvError(items.length + " giao dịch được nhập."); 
  }
  return <div className="r-account-page"><PageHeader onBack={() => navigate("?tab=settings")}><select aria-label="Ngôn ngữ hiển thị" className="r-language" value={String(state.settings.language)} onChange={(e) => setSetting("language", e.target.value)}>{["Tiếng Việt", "English", "Bahasa Indonesia", "Español", "Français"].map((l) => <option key={l}>{l}</option>)}</select></PageHeader><button type="button" className="r-profile-row" onClick={() => open("profile")}><span className="r-profile-avatar">{String(state.settings.name).slice(0, 1)}</span><span><b>{String(state.settings.name)}</b><small>Hồ sơ</small></span><Pencil size={16} /></button><div className="r-account-options">{accountOptions.map(([name, code, id]) => <button key={id} type="button" className="r-setting-row" onClick={() => open(id)}><Icon code={code} /><span>{name}</span></button>)}<hr /><button type="button" className="r-setting-row" onClick={() => setOption("logout")}><Icon code="f2f5" />Đăng xuất</button><button type="button" className="r-setting-row r-expense" onClick={() => setOption("delete")}><Trash2 size={18} />Xóa tài khoản</button></div>
    {option && <Modal title={option === "theme" ? "Chọn chủ đề" : option === "format" ? "Định dạng số tiền" : option === "import" ? "Nhập tệp CSV" : option === "export" ? "Xuất tệp CSV" : undefined} onClose={close} sheet={["import", "export"].includes(option)} wide={option === "format"}>
      {option === "personality" && <><p>Bạn muốn FinBridge có tính cách như thế nào?</p><div className="r-personalities">{["Cổ Động Viên Ủng Hộ", "Mẹ giận dữ", "Người Cố Vấn Thông Thái", "7 Chuỗi để mở khóa", "30 Chuỗi để mở khóa", "Tùy chỉnh"].map((name, i) => <button key={name} type="button" className={selection === name ? "active" : ""} onClick={() => i === 3 || i === 4 ? setSelection(name) : setSelection(name)}>{i < 3 ? <Animation name={i === 1 ? "nagging-mom" : "cheerleader"} className={"r-personality-image " + (i === 2 ? "r-blue-mascot" : "")} /> : <Icon code={i === 5 ? "f544" : "f023"} />}<span>{name}</span></button>)}</div><p className="r-dialog-note">Chọn Cổ Động Viên Ủng Hộ nếu cần một người đồng hành tràn đầy năng lượng, sẵn sàng ăn mừng mọi bước trong hành trình tài chính.</p><button type="button" className="r-primary" onClick={() => { if (!selection.includes("Chuỗi")) { setSetting("personality", selection); close(); } }}>Xác nhận</button></>}
      {["reply", "goals", "monthStart", "profile"].includes(option) && <form className="r-form" onSubmit={(e) => { e.preventDefault(); setSetting(option === "goals" ? "goal" : option === "profile" ? "name" : option, value); if (option === "goals") setSetting("less", extra); close(); }}>{option !== "monthStart" && <Mascot greeting={option === "reply" ? "Tôi có thể nói bất kỳ ngôn ngữ nào!" : "Tôi sẽ là đối tác đáng tin cậy của bạn!"} />}<label>{option === "reply" ? "Bạn muốn FinBridge trả lời bạn bằng ngôn ngữ nào?" : option === "goals" ? "Bạn muốn đạt được điều gì với ứng dụng theo dõi chi tiêu? Hãy để FinBridge truyền cảm hứng cho bạn!" : option === "monthStart" ? "Đặt ngày bắt đầu tháng." : "Tên"}<input aria-label={option === "profile" ? "Tên" : "Giá trị"} value={value} type={option === "monthStart" ? "number" : "text"} min={1} max={28} onChange={(e) => setValue(e.target.value)} /></label>{option === "goals" && <label>Có điều gì bạn muốn FinBridge nhắc bạn nên chi tiêu ít hơn không?<input value={extra} onChange={(e) => setExtra(e.target.value)} /></label>}<button className="r-primary">Xác nhận</button></form>}
      {option === "theme" && <div className="r-menu-options">{[["system", "Chế độ hệ thống"], ["light", "Chế độ sáng"], ["dark", "Chế độ tối"]].map(([value, label]) => <button key={value} type="button" className={state.settings.theme === value ? "active" : ""} onClick={() => { setSetting("theme", value); close(); }}>{value === "dark" ? <Moon /> : <Sun />}{label}</button>)}</div>}
      {option === "format" && <><div className="r-format-options">{[["separator", "Kiểu phân tách", 'Sử dụng dấu "." làm dấu phân cách hàng nghìn (ví dụ: 1.000).'], ["symbolAfter", "Vị trí ký hiệu tiền tệ", "Hiển thị loại tiền tệ sau số tiền (ví dụ: 100$)."], ["compact", "Định dạng nhỏ gọn", "Hiển thị số theo kiểu rút gọn (K, M, B)."]].map(([key, title, desc]) => <div key={key}><span>{title}<small>{desc}</small></span><Toggle label={title} checked={Boolean(state.settings[key])} onChange={(v) => setSetting(key, v)} /></div>)}</div><p>Xem trước:</p><h2 className="r-center">{money(1234567.89)}</h2></>}
      {option === "notification" && <div className="r-form"><Mascot greeting="Tôi sẽ nhắc nhở bạn hằng ngày để chúng ta cùng xây dựng thói quen 💪" /><h2>Cho phép FinBridge gửi thông báo cho bạn</h2><label>Thời gian nhắc nhở<input aria-label="Thời gian nhắc nhở" type="time" defaultValue="20:00" onChange={(e) => setSetting("reminderTime", e.target.value)} /></label><button className="r-primary" onClick={() => { setSetting("notification", true); close(); }}>Cho phép</button><button className="r-secondary" onClick={() => { setSetting("notification", false); close(); }}>Không cho phép</button></div>}
      {option === "manual" && <><h2>Chế độ thêm giao dịch thủ công</h2><div className="r-toggle-row"><p>Chế độ giao dịch đơn giản</p><Toggle label="Chế độ thêm giao dịch thủ công" checked={Boolean(state.settings.manual)} onChange={(v) => setSetting("manual", v)} /></div><p className="r-dialog-note">Khi bật, nút + sẽ mở biểu mẫu nhập giao dịch thủ công.</p></>}
      {option === "export" && <div className="r-form"><p>Tải giao dịch của bạn về dưới dạng tệp bảng tính.</p><small>Ví cần xuất</small><div className="r-type-pills r-align-left">{state.wallets.map((w) => <span key={w.id} className="r-wallet-selected">{w.name}<Check size={18} /></span>)}</div><small>Khoảng thời gian</small><div className="r-two-options"><button type="button" className={!exportRange ? "active" : ""} onClick={() => setExportRange(false)}>Mọi thời gian</button><button type="button" className={exportRange ? "active" : ""} onClick={() => setExportRange(true)}>Phạm vi ngày</button></div>{exportRange && <div className="r-date-cycle"><input aria-label="Từ ngày" type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} /><input aria-label="Đến ngày" type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} /></div>}<button type="button" className="r-primary" onClick={() => exportCsv()}>Xác nhận</button></div>}
      {option === "import" && <div className="r-form"><p>Vui lòng tải xuống mẫu tệp CSV để sử dụng khi nhập dữ liệu của bạn.</p><button type="button" className="r-setting-row" onClick={() => exportCsv(true)}>Tải xuống mẫu<ChevronRight /></button><p className="r-dialog-note">Lưu ý: Vui lòng đảm bảo rằng bạn đã tạo danh mục mong muốn của mình trong FinBridge trước khi nhập. Có thể nhập tối đa 1000 hàng dữ liệu giao dịch cùng một lúc.</p><small>Chọn ví bạn muốn nhập tệp CSV.</small><select aria-label="Ví nhập CSV">{state.wallets.map((w) => <option key={w.id}>{w.name}</option>)}</select><input aria-label="Nhập CSV" type="file" accept=".csv,text/csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) void importCsv(file); }} />{csvError && <p role="status">{csvError}</p>}</div>}
      {option === "logout" && <><h2>Đăng xuất?</h2><button className="r-primary" onClick={() => navigate("welcome")}>Đăng xuất</button></>}
      {option === "delete" && <><h2>Xóa tài khoản</h2><p className="r-dialog-note">Bản này lưu dữ liệu trên trình duyệt. Xóa dữ liệu cục bộ?</p><button className="r-danger" onClick={() => { updateState((s) => ({ ...s, transactions: [], goals: [], recurring: [], rules: [] })); close(); }}>Xóa dữ liệu cục bộ</button></>}
    </Modal>}
  </div>;
}
export function HomepageConfiguration({ navigate }: { navigate: (screen: string) => void }) {
  const state = useAppState();
  return <div className="r-account-page"><PageHeader onBack={() => navigate("accountSettings")} /><div className="r-account-options">{[["chart", "Hiển thị biểu đồ đường", "Hiển thị biểu đồ đường trên trang chủ"], ["totalBalance", "Hiển thị tổng số dư", "Hiển thị tổng số dư của tất cả ví trên trang chủ"], ["savings", "Hiển thị tiết kiệm", "Hiển thị tổng tiết kiệm trên trang chủ"]].map(([id, name, sub]) => <div key={id} className="r-setting-row r-toggle-row"><span>{name}<small>{sub}</small></span><Toggle label={name} checked={Boolean(state.settings[id])} onChange={(v) => setSetting(id, v)} /></div>)}</div></div>;
}
export function WalletScreen({ screen, walletId, navigate }: { screen: string; walletId?: string; navigate: (screen: string) => void }) {
  const state = useAppState();
  const wallet = state.wallets.find((w) => w.id === walletId) || state.wallets[0];
  const [name, setName] = useState(screen === "createWallet1" ? "" : wallet.name);
  const [amount, setAmount] = useState(screen === "createWallet1" ? "" : String(wallet.initial));
  const [currency, setCurrency] = useState(wallet.currency);
  const [type, setType] = useState(screen === "createWallet1" ? "cash" : wallet.type);
  const [shared, setShared] = useState(false);
  const [limit, setLimit] = useState("");
  const [modal, setModal] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categoryType, setCategoryType] = useState("Chi phí");
  const [categoryName, setCategoryName] = useState("");
  function save(event: FormEvent) {
    event.preventDefault();
    const next: Wallet = { id: screen === "createWallet1" ? crypto.randomUUID() : wallet.id, name, initial: Number(amount || 0), currency, type, limit: Number(limit) || undefined };
    updateState((s) => ({ ...s, wallets: screen === "createWallet1" ? [...s.wallets, next] : s.wallets.map((w) => w.id === wallet.id ? next : w) }));
    navigate(screen === "createWallet1" ? "" : "walletSettings?wallet=" + wallet.id);
  }
  if (screen === "category") return <div className="r-category-page"><PageHeader title="Loại" onBack={() => navigate("walletSettings?wallet=" + wallet.id)} /><div className="r-category-tabs">{["Chi phí", "Thu nhập"].map((t) => <button key={t} type="button" className={categoryType === t ? "active" : ""} onClick={() => setCategoryType(t)}>{t}</button>)}</div><div className="r-category-list">{(categoryType === "Chi phí" ? state.categories : ["Thu nhập", "Lương", "Quà tặng"]).map((c, i) => <button key={c} type="button" onClick={() => { setSelectedCategory(c); setModal("categoryDetail"); }}><span>{["❓", "🍔", "🏠", "🛍️"][i % 4]}</span>{c}<ChevronRight /></button>)}</div><button type="button" className="r-fab r-fab-wide r-fab-no-nav" onClick={() => { setCategoryName(""); setModal("addCategory"); }}><PlusIcon />Thêm danh mục</button>{modal && <Modal title={modal === "addCategory" ? "Tạo tên danh mục và biểu tượng của bạn" : selectedCategory} sheet onClose={() => setModal("")}><form className="r-form" onSubmit={(e) => { e.preventDefault(); if (!categoryName.trim()) return; updateState((s) => ({ ...s, categories: [...s.categories, categoryName] })); setModal(""); }}><input aria-label="Tiêu đề danh mục" placeholder="Tiêu đề" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} />{modal === "addCategory" ? <button className="r-primary">Tạo danh mục</button> : <><p>Danh mục phụ</p><button type="button" className="r-secondary" onClick={() => { setCategoryName(""); setModal("addCategory"); }}>Thêm danh mục phụ</button><button type="button" className="r-danger" onClick={() => { updateState((s) => ({ ...s, categories: s.categories.filter((c) => c !== selectedCategory) })); setModal(""); }}>Xóa danh mục</button></>}</form></Modal>}</div>;
  if (screen === "walletSettings") return <div className="r-account-page"><PageHeader title={wallet.name} onBack={() => navigate("?tab=settings")} /><div className="r-account-options"><button className="r-setting-row r-setting-large" onClick={() => navigate("walletDetailsEdit?wallet=" + wallet.id)}><span>Chi tiết ví<small>Tên, tiền tệ và số dư</small></span></button><button className="r-setting-row" onClick={() => navigate("category?wallet=" + wallet.id)}><Icon code="f61f" />Quản lý danh mục</button><button className="r-setting-row" onClick={() => setModal("share")}><Icon code="f234" />Chia sẻ ví và mời thành viên</button><div className="r-setting-row r-toggle-row"><span>Ví yêu cầu mở khóa sinh trắc học</span><Toggle checked={false} label="Ví yêu cầu mở khóa sinh trắc học" onChange={() => setModal("biometric")} /></div><button className="r-setting-row r-setting-large" onClick={() => setModal("email")}><span>Thêm giao dịch qua email<small>Chuyển tiếp hóa đơn, FinBridge sẽ thêm vào ví này</small></span></button></div>{modal && <Modal title={modal === "share" ? "Chia sẻ ví và mời thành viên" : modal === "email" ? "Thêm giao dịch qua email" : "Ví yêu cầu mở khóa sinh trắc học"} onClose={() => setModal("")}><div className="r-form">{modal === "share" ? <><p>Thành viên · Bạn (Chủ sở hữu)</p><input aria-label="Địa chỉ email mời" placeholder="Địa chỉ email" /><p className="r-dialog-note">Mời thành viên cần máy chủ đồng bộ ví. Bạn có thể sao chép đường dẫn xem ví cục bộ.</p><button className="r-primary" onClick={() => { navigator.clipboard.writeText(window.location.origin + "/app/walletSettings?wallet=" + wallet.id); setModal(""); }}>Sao chép liên kết</button></> : <><p>{modal === "email" ? "Nhận hóa đơn qua email cần kết nối máy chủ FinBridge." : "Mở khóa sinh trắc học chưa được kết nối trong bản cục bộ."}</p><button className="r-primary" onClick={() => setModal("")}>Đóng</button></>}</div></Modal>}</div>;
  return <div className="r-form-page"><PageHeader title={screen === "createWallet1" ? "Thiết lập ví" : "Chi tiết ví"} onBack={() => navigate(screen === "createWallet1" ? "" : "walletSettings?wallet=" + wallet.id)} />{screen === "createWallet1" && <Mascot greeting="Hãy thiết lập ví của bạn!" />}<form className="r-form" onSubmit={save}>{screen === "createWallet1" && <><small>Loại ví<br />Chọn đây là ví tiền mặt hay thẻ tín dụng</small><div className="r-two-options"><button type="button" className={type === "cash" ? "active" : ""} onClick={() => setType("cash")}>Tiền mặt</button><button type="button" className={type === "credit" ? "active" : ""} onClick={() => setType("credit")}>Thẻ tín dụng</button></div></>}<Field label="Tên ví"><input aria-label="Tên ví" required value={name} onChange={(e) => setName(e.target.value)} /></Field><CurrencySelect value={currency} onChange={(v) => setCurrency(v.split(" ")[0])} />{type === "credit" && <input aria-label="Hạn mức tín dụng" placeholder="Hạn mức tín dụng" type="number" required min="1" value={limit} onChange={(e) => setLimit(e.target.value)} />}<Field label={type === "credit" ? "Nhập số dư chưa thanh toán" : "Số dư ban đầu"}><input aria-label="Số dư ban đầu" type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>{type === "credit" && <Field label="Ngày đến hạn"><input type="date" /></Field>}{screen === "createWallet1" && <div className="r-setting-row r-toggle-row"><span>Mời người khác cùng quản lý ví</span><Toggle label="Mời người khác cùng quản lý ví" checked={shared} onChange={setShared} /></div>}<button className="r-primary">{screen === "createWallet1" ? "Tiếp tục" : "Lưu"}</button></form></div>;
}
function PlusIcon() { return <span aria-hidden="true">＋</span>; }
