"use client";

import { useState } from "react";
import { ChevronRight, MoreVertical, Plus, Pencil, Trash2, Check } from "lucide-react";
import { EmptyState, Modal, PageHeader } from "./Ui";
import { updateState, useAppState } from "./store";

export const iconGroups: [string, string[]][] = [
  ["Nhà & Hóa đơn", ["🧊", "🧾", "🧴", "💡", "🛋️", "🏠", "🔌", "🧹", "🚿", "🧺", "🔑"]],
  ["Đồ ăn & Đồ uống", ["🍔", "☕", "🍕", "🍜", "🍣", "🍺", "🥤", "🍰", "🥐", "🍎", "🥗"]],
  ["Giao thông vận tải & Du lịch", ["🚗", "⛽", "🚕", "🚌", "🚆", "✈️", "🏨", "🧳", "🛵", "🚲", "🚢", "🌍"]],
  ["Sức khỏe & Chăm sóc cá nhân", ["💊", "🏥", "🩺", "🦷", "🧼", "💇", "💅", "🧘", "🏋️", "🧴", "👓", "🧑‍⚕️", "❤️"]],
  ["Điện tử & Công nghệ", ["📱", "💻", "🎧", "📷", "⌚", "🖨️"]],
  ["Tiền bạc và công việc", ["💰", "💵", "💳", "🏦", "🪙", "📈", "💼", "🧑‍💼", "🧾", "🎁", "📉", "🛠️", "📦", "🔒", "🤝"]],
  ["Vui chơi & Giải trí", ["🎮", "🎬", "🎵", "🎤", "🎨", "🎟️", "⚽", "🎯", "🎳", "🎸", "🎲", "🏕️"]],
  ["Gia đình & Giáo dục", ["📚", "🎓", "🏫", "✏️", "🧸", "👶", "🐕", "🐈", "👨‍👩‍👧", "🎒", "📝", "🖍️", "🏡"]],
  ["Khác", ["❓", "🛍️", "👕", "👟", "🌸", "⭐", "🎉", "📌", "🧩", "☂️", "🪴"]],
];
export function categoryIcon(name: string, metadata: Record<string, { icon: string }>) {
  return metadata[name]?.icon || ({ "Chưa được phân loại": "❓", "Thức ăn & Đồ uống": "🍔", "Nhà": "🏠", "Mua sắm": "🛍️", "Lương": "💵", "Quà tặng": "🎁", "Thu nhập": "💰" } as Record<string, string>)[name] || "❓";
}
export function Categories({ detail = false, name = "", wallet = "default", navigate }: { detail?: boolean; name?: string; wallet?: string; navigate: (screen: string) => void }) {
  const state = useAppState();
  const [type, setType] = useState("expense");
  const [modal, setModal] = useState("");
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("❓");
  const [picking, setPicking] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [child, setChild] = useState("");
  const [error, setError] = useState("");
  const children = state.categoryMeta[name]?.children || [];
  const items = type === "expense" ? state.categories.filter((item) => state.categoryMeta[item]?.type !== "income") : state.categories.filter((item) => state.categoryMeta[item]?.type === "income");
  const open = (edit = false) => { setTitle(edit ? name : ""); setIcon(edit ? categoryIcon(name, state.categoryMeta) : "❓"); setModal(edit ? "edit" : "add"); setError(""); };
  function save() {
    const value = title.trim();
    if (!value) return;
    if (state.categories.includes(value) && value !== name) { setError("Tên danh mục đã tồn tại."); return; }
    updateState((s) => {
      const metadata = { ...s.categoryMeta };
      if (modal === "edit") delete metadata[name];
      metadata[value] = { type: modal === "edit" ? s.categoryMeta[name]?.type || "expense" : type, icon, children: modal === "edit" ? children : [] };
      const rename = <T extends { category: string }>(row: T) => modal === "edit" && row.category === name ? { ...row, category: value } : row;
      const walletCategories = Object.fromEntries(s.wallets.map(w => [w.id, modal === "edit" ? (s.walletCategories?.[w.id] || s.categories).map(n => n === name ? value : n) : [...new Set([...(s.walletCategories?.[w.id] || s.categories), ...(w.id === wallet ? [value] : [])])]]));
      return { ...s, walletCategories, goals: s.goals.map(rename), fixedExpenses: s.fixedExpenses?.map(rename), recurring: s.recurring.map(rename), categories: modal === "edit" ? s.categories.map((item) => item === name ? value : item) : [...s.categories, value], categoryMeta: metadata, transactions: s.transactions.map(rename) };
    });
    setModal("");
    if (detail) navigate("categoryDetail?name=" + encodeURIComponent(value) + "&wallet=" + wallet);
  }
  return <div className="r-category-page">
    <PageHeader title={detail ? categoryIcon(name, state.categoryMeta) + "  " + name : "Loại"} onBack={() => navigate(detail ? "category?wallet=" + wallet : "walletSettings?wallet=" + wallet)}>{detail && <button className="r-icon-button" aria-label="Menu danh mục" onClick={() => setModal("menu")}><MoreVertical size={20} /></button>}</PageHeader>
    {detail ? <div className="r-category-details"><h3>Danh mục phụ</h3>{children.length === 0 && !addingChild ? <EmptyState title="Hiện tại không có danh mục con nào trong danh mục này." /> : <div className="r-category-list">{children.map((item) => <div className="r-setting-row" key={item}><span>{item}</span><button className="r-icon-button" aria-label={"Xóa danh mục phụ " + item} onClick={() => { setChild(item); setModal("deleteChild"); }}><Trash2 size={16} /></button></div>)}</div>}{addingChild && <form className="r-rule-input" onSubmit={(event) => { event.preventDefault(); if (!child.trim()) return; updateState((s) => ({ ...s, categoryMeta: { ...s.categoryMeta, [name]: { type: s.categoryMeta[name]?.type || "expense", icon: categoryIcon(name, s.categoryMeta), children: [...children, child.trim()] } } })); setChild(""); setAddingChild(false); }}><input placeholder="Thêm danh mục phụ mới..." aria-label="Danh mục phụ mới" value={child} onChange={(event) => setChild(event.target.value)} required /><button className="r-primary" aria-label="Lưu danh mục phụ"><Check /></button></form>}<button className="r-secondary" onClick={() => setAddingChild(!addingChild)}><Plus size={16} />Thêm danh mục phụ</button></div> : <><div className="r-category-tabs">{[["expense", "Chi phí"], ["income", "Thu nhập"]].map(([id, label]) => <button key={id} className={type === id ? "active" : ""} onClick={() => setType(id)}>{label}</button>)}</div><div className="r-category-list">{items.map((item) => <button key={item} onClick={() => navigate("categoryDetail?name=" + encodeURIComponent(item) + "&wallet=" + wallet)}><span>{categoryIcon(item, state.categoryMeta)}</span>{item}<ChevronRight /></button>)}</div><button className="r-fab r-fab-wide r-fab-no-nav" onClick={() => open()}><Plus size={20} />Thêm danh mục</button></>}
    {modal === "menu" && <Modal onClose={() => setModal("")}><div className="r-menu-options"><button onClick={() => open(true)}><Pencil size={18} />Chỉnh sửa danh mục</button><button className="r-expense" onClick={() => setModal("delete")}><Trash2 size={18} />Xóa danh mục</button></div></Modal>}
    {["add", "edit"].includes(modal) && <Modal title={modal === "edit" ? "Chỉnh sửa tên danh mục và biểu tượng của bạn" : "Tạo tên danh mục và biểu tượng của bạn"} sheet onClose={() => setModal("")}><form className="r-form" onSubmit={(event) => { event.preventDefault(); save(); }}><div className="r-category-name-input"><button type="button" aria-label="Chọn biểu tượng" onClick={() => setPicking(true)}>{icon}</button><input placeholder="Tiêu đề" aria-label="Tiêu đề danh mục" required value={title} onChange={(event) => setTitle(event.target.value)} /></div>{error && <p role="alert">{error}</p>}<button className="r-primary">{modal === "edit" ? "Lưu" : "Tạo danh mục"}</button></form></Modal>}
    {picking && <Modal sheet onClose={() => setPicking(false)}><div className="r-icon-picker">{iconGroups.map(([group, symbols]) => <section key={group}><h3>{group}</h3><div>{symbols.map((symbol, index) => <button key={symbol + index} aria-label={"Biểu tượng " + symbol} onClick={() => { setIcon(symbol); setPicking(false); }}>{symbol}</button>)}</div></section>)}</div></Modal>}
    {["delete", "deleteChild"].includes(modal) && <Modal title="Xóa danh mục?" onClose={() => setModal("")}><p>Thao tác chỉ áp dụng cho dữ liệu trong trình duyệt này.</p><button className="r-danger" onClick={() => { updateState((s) => modal === "deleteChild" ? { ...s, categoryMeta: { ...s.categoryMeta, [name]: { ...s.categoryMeta[name], children: children.filter((item) => item !== child) } } } : { ...s, categories: s.categories.filter((item) => item !== name), transactions: s.transactions.map((t) => t.category === name ? { ...t, category: "Chưa được phân loại" } : t) }); setModal(""); if (modal === "delete") navigate("category?wallet=" + wallet); }}>Xóa</button></Modal>}
  </div>;
}
