"use client";

import { useState, useRef, type FormEvent } from "react";
import { Camera, Mic, Send, Settings, Plus, ArrowRightLeft, X } from "lucide-react";
import { EmptyState, Field, Mascot, Modal, PageHeader, Toggle } from "./Ui";
import { currencySymbol, money, updateState, useAppState, type Transaction } from "./store";
import { tools } from "./Tools";

type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognition = { lang: string; continuous: boolean; interimResults: boolean; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<SpeechResult> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null };
type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition };

export function TransactionForm({ navigate, id = "", recurring = false, onClose }: { navigate: (screen: string) => void; id?: string; recurring?: boolean; onClose?: () => void }) {
  const state = useAppState();
  const existing = state.transactions.find((t) => t.id === id);
  const [type, setType] = useState<"expense" | "income">(existing?.type === "income" ? "income" : "expense");
  const [title, setTitle] = useState(existing?.title || "");
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [date, setDate] = useState(existing?.date || "2026-10-12");
  const [category, setCategory] = useState(existing?.category || state.categories[0]);
  const [wallet, setWallet] = useState(existing?.wallet || state.wallets[0].id);
  const [note, setNote] = useState(existing?.note || "");
  const [image, setImage] = useState(existing?.image || "");
  const [subcategory, setSubcategory] = useState(existing?.subcategory || "");
  const [interval, setInterval] = useState(existing?.interval || 1);
  const [unit, setUnit] = useState(existing?.unit || "Tháng");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const back = () => onClose ? onClose() : navigate("?tab=transactions");
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (Number(amount) <= 0) return;
    const item: Transaction = { id: existing?.id || crypto.randomUUID(), type, title, amount: Number(amount), date, category, subcategory, wallet, note, image: image || (!id ? state.receiptDraft : "") || "", ...(recurring ? { interval, unit } : {}) };
    updateState((s) => recurring ? { ...s, recurring: [...s.recurring, item] } : { ...s, receiptDraft: "", transactions: existing ? s.transactions.map((t) => t.id === existing.id ? item : t) : [...s.transactions, item] });
    back();
  };
  const content = <form className="r-form" onSubmit={save}>
    <div className="r-type-pills r-align-left"><button type="button" className={type === "expense" ? "active" : ""} onClick={() => setType("expense")}>Chi phí</button><button type="button" className={type === "income" ? "active" : ""} onClick={() => setType("income")}>Thu nhập</button></div>
    <input aria-label="Mục" placeholder="Mục" required value={title} onChange={(e) => setTitle(e.target.value)} />
    <input aria-label="Số tiền" placeholder="Số tiền" required min="0.01" step="any" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
    <Field label="Loại"><select value={category} onChange={(e) => { setCategory(e.target.value); setSubcategory(""); }}>{state.categories.filter((c) => (state.categoryMeta[c]?.type || "expense") === type).map((c) => <option key={c}>{c}</option>)}</select></Field>
    <Field label="Danh mục phụ (tùy chọn)"><select value={subcategory} onChange={(event) => setSubcategory(event.target.value)}><option value="">-</option>{(state.categoryMeta[category]?.children || []).map((child) => <option key={child}>{child}</option>)}</select></Field>
    <Field label="Chọn Ví"><select value={wallet} onChange={(e) => setWallet(e.target.value)}>{state.wallets.map((w) => <option value={w.id} key={w.id}>{w.name}</option>)}</select></Field>
    <Field label={recurring ? "Lịch trình tiếp theo Ngày" : "Ngày"}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
    {recurring && <div className="r-date-cycle"><Field label="Khoảng thời gian định kỳ"><input type="number" min="1" value={interval} onChange={(event) => setInterval(Number(event.target.value))} required /></Field><select aria-label="Đơn vị thời gian" value={unit} onChange={(event) => setUnit(event.target.value)}>{["Ngày", "Tuần", "Tháng", "Năm"].map((c) => <option key={c}>{c}</option>)}</select></div>}
    <textarea aria-label="Ghi chú" placeholder="Ghi chú" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
    {!recurring && <label className="r-attachment">Hình ảnh đính kèm<input aria-label="Đính kèm" type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setImage(String(reader.result)); reader.readAsDataURL(file); }} />{(image || (!id && state.receiptDraft)) && <span>✓ Đã đính kèm</span>}</label>}
    <div className="r-two-options">{recurring && <button type="button" className="r-secondary" onClick={back}>Hủy bỏ</button>}<button type="submit" className="r-primary">{recurring ? "Xác nhận" : "Lưu"}</button></div>
    {existing && <button type="button" className="r-danger" onClick={() => setConfirmDelete(true)}>Xóa giao dịch</button>}
  </form>;
  if (recurring) return content;
  return <div className="r-form-page"><PageHeader title={existing ? "Chỉnh sửa giao dịch" : "Thêm giao dịch"} subtitle={existing ? "Chỉnh sửa giao dịch của bạn bên dưới." : "Thêm giao dịch của bạn bên dưới."} close onBack={back} />{content}{confirmDelete && <Modal title="Xóa giao dịch?" onClose={() => setConfirmDelete(false)}><p>Bạn có chắc chắn muốn xóa giao dịch này không?</p><button className="r-danger" onClick={() => { updateState((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) })); back(); }}>Xóa giao dịch</button></Modal>}</div>;
}

export function ChatPage({ navigate }: { navigate: (screen: string) => void }) {
  const state = useAppState();
  const [text, setText] = useState("");
  const [wallet, setWallet] = useState(state.wallets[0].id);
  const [messages, setMessages] = useState<{ role: string; text: string; transaction?: Transaction }[]>([{ role: "assistant", text: "Xin chào!👋 Hãy bắt đầu thêm giao dịch của bạn tại đây nhé!" }]);
  const [modal, setModal] = useState("");
  const [rule, setRule] = useState("");
  const [voiceText, setVoiceText] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [receipt, setReceipt] = useState("");
  const recognition = useRef<SpeechRecognition | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const close = () => { recognition.current?.stop(); setListening(false); setModal(""); };
  function send(value: string) {
    if (!value.trim()) return;
    const items: Transaction[] = [];
    for (const part of value.split(/[,;\n]\s*(?=[^\d\s])/u).map((text) => text.trim()).filter(Boolean)) {
      const number = part.match(/(\d+(?:[.,]\d+)?)\s*(k|nghìn|ngàn|tr|triệu)?/i);
      const amount = number ? Number(number[1].replace(",", ".")) * (number[2] && /tr|triệu/i.test(number[2]) ? 1000000 : number[2] ? 1000 : 1) : 0;
      if (amount <= 0) continue;
      const income = /lương|thu nhập|salary|income|nhận tiền/i.test(part);
      let category = income ? "Thu nhập" : /ăn|bữa|cà phê|cafe|coffee|dinner|lunch|food/i.test(part) ? "Thức ăn & Đồ uống" : /mua|shopping/i.test(part) ? "Mua sắm" : /nhà|rent|điện|nước/i.test(part) ? "Nhà" : "Chưa được phân loại";
      for (const rule of state.rules) {
        const match = rule.match(/^(.+?)\s+(?:được phân loại là|được xếp vào danh mục|luôn được xếp vào danh mục)\s+(.+)$/i);
        if (match && part.toLowerCase().includes(match[1].toLowerCase().trim())) category = match[2].trim();
      }
      items.push({ id: crypto.randomUUID(), type: income ? "income" : "expense", title: part, amount, category, wallet, date: "2026-10-12", note: "" });
    }
    if (items.length) updateState((s) => ({ ...s, transactions: [...s.transactions, ...items] }));
    const currency = state.wallets.find((w) => w.id === wallet)?.currency;
    setMessages((messages) => [...messages, { role: "user", text: value }, ...(items.length ? items.map((transaction) => ({ role: "assistant", text: "Đã ghi nhận " + money(transaction.amount, currency) + " vào " + transaction.category + ".", transaction })) : [{ role: "assistant", text: "Bạn hãy nhập mô tả và số tiền, ví dụ: bữa tối 100k, mua sắm 400k." }])]);
    setText("");
  }
  function startVoice() {
    const Speech = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!Speech) { setVoiceError("Trình duyệt này chưa hỗ trợ nhận dạng giọng nói. Bạn có thể nhập nội dung bên dưới."); return; }
    const r = new Speech(); recognition.current = r; r.lang = "vi-VN"; r.continuous = false; r.interimResults = true;
    r.onresult = (event) => setVoiceText(Array.from(event.results).map((result) => result[0].transcript).join(" "));
    r.onerror = () => { setListening(false); setVoiceError("Không truy cập được micro. Hãy kiểm tra quyền micro của trình duyệt."); };
    r.onend = () => setListening(false);
    setListening(true); setVoiceError(""); r.start();
  }
  return <div className="r-chat-page"><PageHeader onBack={() => navigate("?tab=transactions")}><button type="button" className="r-icon-button" aria-label="Cài đặt chat" onClick={() => navigate("accountSettings")}><Settings size={20} /></button></PageHeader><Mascot greeting="Hôm nay bạn đã chi tiêu gì?" className="r-chat-mascot" /><select aria-label="Ví ghi giao dịch" className="r-wallet-chip r-chat-wallet" value={wallet} onChange={(e) => setWallet(e.target.value)}>{state.wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select><div className="r-chat-messages"><span className="r-chat-date">Hôm nay</span>{messages.map((m, i) => <div key={i} className={"r-message " + m.role}><p>{m.text}</p>{m.transaction && <button type="button" className="r-chat-record" onClick={() => navigate("editTransaction?id=" + m.transaction?.id)}><small>Đã ghi: {m.transaction.type === "income" ? "Thu nhập" : "Chi phí"}</small><b>{m.transaction.category}</b><span>{money(m.transaction.amount, state.wallets.find((w) => w.id === wallet)?.currency)}</span><small>{m.transaction.title}</small></button>}</div>)}</div><div className="r-chat-bottom"><div className="r-chat-actions"><button type="button" onClick={() => setModal("transfer")}><ArrowRightLeft size={14} />Di chuyển quỹ</button><button type="button" onClick={() => navigate("recurringTransaction")}><IconRepeat />Giao dịch định kỳ</button></div><form className="r-chat-input" onSubmit={(e) => { e.preventDefault(); send(text); }}><input aria-label="Nhập giao dịch" placeholder="bữa tối 100k, mua sắm 400k" value={text} onChange={(e) => setText(e.target.value)} />{text.trim() ? <button aria-label="Gửi giao dịch"><Send size={22} /></button> : <><button type="button" aria-label="Ghi bằng giọng nói" onClick={() => { setVoiceText(""); setModal("voice"); }}><Mic size={22} /></button><button type="button" aria-label="Thêm ảnh hóa đơn" onClick={() => setModal("receipt")}><Camera size={22} /></button></>}</form><button type="button" className="r-memory-button" onClick={() => setModal("memory")}>Bộ nhớ của FinBridge</button></div>
    {modal === "memory" && <Modal title="Bộ nhớ của FinBridge" sheet onClose={close}><p>Hãy dạy FinBridge quy tắc của bạn để FinBridge sắp xếp giao dịch theo cách bạn muốn.</p><form className="r-rule-input" onSubmit={(e) => { e.preventDefault(); if (rule.trim()) updateState((s) => ({ ...s, rules: [...s.rules, rule.trim()] })); setRule(""); }}><input placeholder="Nhập quy tắc của bạn vào đây..." aria-label="Quy tắc" value={rule} onChange={(e) => setRule(e.target.value)} /><button className="r-primary" aria-label="Thêm quy tắc"><Plus /></button></form><small>Ví dụ:<br />- ăn tối với bạn bè được phân loại là giải trí<br />- thể thao luôn được xếp vào danh mục sức khỏe<br />- cho thuê được xếp vào danh mục nhà ở</small>{state.rules.length ? state.rules.map((r, i) => <div key={i} className="r-toggle-row"><span>{r}</span><button className="r-icon-button" aria-label="Xóa quy tắc" onClick={() => updateState((s) => ({ ...s, rules: s.rules.filter((_, index) => i !== index) }))}><X size={18} /></button></div>) : <div className="r-no-rules"><b>Chưa có quy tắc nào</b><p>Thêm một quy tắc ở trên để dạy FinBridge cách phân loại giao dịch của bạn.</p></div>}<div className="r-toggle-row"><span>Tự động cập nhật bộ nhớ<small>FinBridge lưu quy tắc khi bạn sửa danh mục.</small></span><Toggle checked={Boolean(state.settings.autoMemory)} label="Tự động cập nhật bộ nhớ" onChange={(v) => updateState((s) => ({ ...s, settings: { ...s.settings, autoMemory: v } }))} /></div></Modal>}
    {modal === "transfer" && <TransferForm onClose={close} />}
    {modal === "voice" && <Modal title="Ghi lại giao dịch bằng giọng nói của bạn" onClose={close}><div className="r-form"><Mascot /><button type="button" className={"r-record-mic " + (listening ? "is-listening" : "")} onClick={() => listening ? recognition.current?.stop() : startVoice()} aria-label={listening ? "Dừng ghi" : "Bắt đầu ghi"}><Mic size={36} /></button>{voiceError && <p role="status">{voiceError}</p>}<textarea aria-label="Nội dung giọng nói" placeholder="Nội dung ghi nhận..." value={voiceText} onChange={(e) => setVoiceText(e.target.value)} /><button type="button" disabled={!voiceText.trim()} className="r-primary" onClick={() => { close(); send(voiceText); }}>Xác nhận</button></div></Modal>}
    {modal === "receipt" && <Modal title="Thêm hình ảnh hóa đơn" onClose={close}><div className="r-form">{receipt && <div className="r-receipt-preview" style={{ backgroundImage: "url(" + receipt + ")" }} />}<input ref={fileInput} type="file" aria-label="Chọn ảnh hóa đơn" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setReceipt(String(reader.result)); reader.readAsDataURL(file); }} /><p>Chọn ảnh để đính kèm vào giao dịch. Tự động đọc hóa đơn cần kết nối dịch vụ AI.</p><button type="button" className="r-primary" onClick={() => { updateState((s) => ({ ...s, receiptDraft: receipt })); navigate("addTransaction"); }}>Nhập thông tin hóa đơn</button></div></Modal>}
  </div>;
}
function IconRepeat() { return <span aria-hidden="true">⟳</span>; }
export function RecurringPage({ navigate }: { navigate: (screen: string) => void }) {
  const state = useAppState();
  const [adding, setAdding] = useState(false);
  return <div className="r-tool-page"><PageHeader title="Giao dịch định kỳ theo lịch trình" close onBack={() => navigate("addTransactionChatMode")} />{state.recurring.length === 0 ? <EmptyState title="Chưa có giao dịch định kỳ nào được lên lịch." text="Bắt đầu thêm các giao dịch định kỳ của bạn ngay bây giờ!" className="r-tool-empty" /> : state.recurring.map((t) => <div className="r-setting-row" key={t.id}><span>{t.title}<small>{t.date} · {t.category}</small></span><b>{money(t.amount)}</b><button aria-label="Xóa lịch" className="r-icon-button" onClick={() => updateState((s) => ({ ...s, recurring: s.recurring.filter((r) => r.id !== t.id) }))}><X /></button></div>)}<button className="r-fab r-fab-wide r-fab-no-nav" onClick={() => setAdding(true)}><Plus size={20} />Thêm Định Kỳ</button>{adding && <Modal title="Thêm Giao Dịch Định Kỳ" onClose={() => setAdding(false)}><TransactionForm navigate={navigate} recurring onClose={() => setAdding(false)} /></Modal>}</div>;
}
function TransferForm({ onClose }: { onClose: () => void }) {
  const state = useAppState();
  const [targetType, setTargetType] = useState("Chuyển khoản");
  const [wallet, setWallet] = useState(state.wallets[0].id);
  const [target, setTarget] = useState(state.wallets[1]?.id || "");
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("2026-10-12");
  const [error, setError] = useState("");
  return <Modal title="Di chuyển Quỹ" sheet onClose={onClose}><p>Chuyển tiền đến ví khác</p><div className="r-type-pills r-align-left">{["Chuyển khoản", "Tiết kiệm", "Món nợ", "Lend/Borrow", "Thử thách"].map((type) => <button type="button" key={type} className={type === targetType ? "active" : ""} onClick={() => { setTargetType(type); setTarget(""); }}>{type}</button>)}</div><form className="r-form" onSubmit={(e) => { e.preventDefault(); if (targetType === "Chuyển khoản" && (!target || wallet === target)) { setError("Vui lòng chọn hai ví khác nhau."); return; } if (!target) { setError("Vui lòng tạo mục tiêu trước khi chuyển tiền."); return; } updateState((s) => ({ ...s, transactions: [...s.transactions, { id: crypto.randomUUID(), type: "transfer", title, amount: Number(amount), category: targetType, date, wallet, targetWallet: targetType === "Chuyển khoản" ? target : undefined, note }], goals: targetType === "Chuyển khoản" ? s.goals : s.goals.map((g) => g.id === target ? { ...g, saved: g.saved + Number(amount) } : g) })); onClose(); }}><Field label="Chọn ví"><select value={wallet} onChange={(e) => setWallet(e.target.value)}>{state.wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field><Field label="Đến ví"><select value={target} onChange={(e) => setTarget(e.target.value)} required><option value="">Chọn</option>{targetType === "Chuyển khoản" ? state.wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>) : state.goals.filter((g) => g.kind === tools.find((t) => t.name === targetType || (targetType === "Lend/Borrow" && t.path === "loanList"))?.path).map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select></Field><input aria-label="Mục" placeholder="Mục" value={title} onChange={(e) => setTitle(e.target.value)} /><input aria-label="Số tiền" placeholder={"Số tiền (" + currencySymbol(state.wallets.find((w) => w.id === wallet)?.currency || "USD") + ")"} required type="number" min="0.01" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} /><Field label="Ngày"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field><textarea aria-label="Ghi chú" placeholder="Ghi chú" value={note} onChange={(e) => setNote(e.target.value)} />{error && <p className="r-expense" role="alert">{error}</p>}<button className="r-primary">Lưu</button></form></Modal>;
}
