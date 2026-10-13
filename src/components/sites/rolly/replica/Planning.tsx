"use client";

import { useState, type FormEvent } from "react";
import { ArrowDownRight, ArrowRight, CalendarDays, ChevronDown, ChevronLeft, Plus, ReceiptText, Wallet } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { FinBridgeHeader } from "./FinBridgeHeader";
import { CalendarLedgerModal } from "./CalendarLedgerModal";
import { Modal } from "./Ui";
import { localDateKey } from "./chartWeek";
import { budgetSummary, plannedOccurrences, validBudget, validFixedExpense } from "./planningModel";
import { updateState, useAppState, type FixedExpense, type Goal } from "./store";

const COPY = {
  vi: {
    title: "Kế hoạch chi tiêu", intro: "Đặt hạn mức ngân sách, rồi phân bổ các khoản chi cố định bên trong.",
    budget: "Ngân sách", fixed: "Khoản chi cố định", addBudget: "Tạo ngân sách", addFixed: "Thêm khoản chi cố định",
    budgetHint: "Hạn mức theo ví, danh mục và kỳ.", fixedHint: "Tiền nhà, học phí và các khoản dự kiến phải trả.",
    flow: "Ngân sách → Khoản chi cố định → Giao dịch thực tế",
    flowHint: "Khoản chi cố định là kế hoạch trong ngân sách. Khi phát sinh, ghi giao dịch qua chat; lịch sử sẽ cập nhật chi thực tế.",
    wallet: "Ví nguồn", allWallets: "Tất cả ví", allBudgets: "Tất cả ngân sách", parent: "Thuộc ngân sách",
    limit: "Hạn mức", actual: "Đã chi thực tế", remaining: "Hạn mức còn lại", planned: "Chi cố định dự kiến trong kỳ",
    flexible: "Hạn mức chưa phân bổ cố định", noPayment: "Lập kế hoạch chưa trừ tiền và chưa tạo giao dịch.",
    noDouble: "Chi thực tế và kế hoạch được hiển thị riêng; không cộng hai số này thành tổng chi.",
    emptyBudget: "Chưa có ngân sách", emptyBudgetHint: "Tạo ngân sách cho một ví trước, rồi thêm các khoản chi cố định vào đó.",
    emptyFixed: "Chưa có khoản chi cố định phù hợp", emptyFixedHint: "Mỗi khoản cần một ngân sách, số tiền và ngày dự kiến trả.",
    emptyWallet: "Chưa có ví đang hoạt động", name: "Tên", amount: "Số tiền", start: "Ngày bắt đầu", category: "Danh mục",
    allCategories: "Tất cả danh mục chi", chooseCategory: "Chọn danh mục chi", cycle: "Kỳ ngân sách", due: "Ngày dự kiến trả đầu tiên",
    recurrence: "Lặp lại", once: "Một lần", weekly: "Hàng tuần", monthly: "Hàng tháng", yearly: "Hàng năm",
    save: "Lưu kế hoạch", cancel: "Hủy", close: "Đóng", edit: "Chỉnh sửa", pause: "Tạm dừng", resume: "Tiếp tục",
    active: "Đang áp dụng", paused: "Đã tạm dừng", parentContext: "Ví và tiền tệ được lấy từ ngân sách đã chọn.",
    overActual: "Chi thực tế đã vượt hạn mức.", overPlanned: "Kế hoạch chi cố định vượt hạn mức. Hãy xem lại phân bổ.",
    invalid: "Kiểm tra tên, số tiền, ngày, ngân sách và danh mục trước khi lưu.",
    mismatch: "Ví không còn hoạt động hoặc tiền tệ không khớp ngân sách; cần kiểm tra lại.",
    oldSavings: "Các mục tiêu tiết kiệm cũ vẫn được giữ trong dữ liệu; chưa chuyển thành khoản chi cố định.",
    viewHistory: "Xem giao dịch thực tế", countBudget: "ngân sách", countFixed: "khoản đang áp dụng", mainWallet: "Ví chính",
    noParent: "Ngân sách không còn trong danh sách", allocations: "Xem khoản chi cố định", budgetPlaceholder: "Ví dụ: Sinh hoạt tháng", fixedPlaceholder: "Ví dụ: Tiền thuê nhà",
  },
  en: {
    title: "Spending plan", intro: "Set a budget limit, then allocate fixed expenses within it.",
    budget: "Budgets", fixed: "Fixed expenses", addBudget: "Create budget", addFixed: "Add fixed expense",
    budgetHint: "A limit by wallet, category and period.", fixedHint: "Rent, tuition and other planned bills.",
    flow: "Budget → Fixed expenses → Recorded transactions",
    flowHint: "Fixed expenses are budget plans. When spending happens, record it in chat; history updates actual spending.",
    wallet: "Source wallet", allWallets: "All wallets", allBudgets: "All budgets", parent: "Parent budget",
    limit: "Limit", actual: "Actual spending", remaining: "Remaining limit", planned: "Planned fixed expenses this period",
    flexible: "Limit not allocated to fixed expenses", noPayment: "Planning does not debit money or create a transaction.",
    noDouble: "Actual spending and plans are shown separately; they are not added into total spending.",
    emptyBudget: "No budgets yet", emptyBudgetHint: "Create a budget for a wallet first, then add its fixed expenses.",
    emptyFixed: "No matching fixed expenses", emptyFixedHint: "Each expense needs a budget, an amount and a planned payment date.",
    emptyWallet: "No active wallets", name: "Name", amount: "Amount", start: "Start date", category: "Category",
    allCategories: "All expense categories", chooseCategory: "Choose an expense category", cycle: "Budget period", due: "First planned payment date",
    recurrence: "Repeat", once: "Once", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly",
    save: "Save plan", cancel: "Cancel", close: "Close", edit: "Edit", pause: "Pause", resume: "Resume",
    active: "Active", paused: "Paused", parentContext: "Wallet and currency come from the selected budget.",
    overActual: "Actual spending exceeds the limit.", overPlanned: "Planned fixed expenses exceed the limit. Review your allocation.",
    invalid: "Check the name, amount, dates, budget and category before saving.",
    mismatch: "The wallet is inactive or its currency differs from this budget. Review the setup.",
    oldSavings: "Existing savings goals are retained in storage and have not been converted to fixed expenses.",
    viewHistory: "View actual transactions", countBudget: "budgets", countFixed: "active expenses", mainWallet: "Main wallet",
    noParent: "Budget no longer listed", allocations: "View fixed expenses", budgetPlaceholder: "For example: Monthly living costs", fixedPlaceholder: "For example: Rent",
  },
  zh: {
    title: "支出计划", intro: "先设定预算限额，再在预算内安排固定支出。",
    budget: "预算", fixed: "固定支出", addBudget: "创建预算", addFixed: "添加固定支出",
    budgetHint: "按钱包、类别和周期设置限额。", fixedHint: "房租、学费及其他计划账单。",
    flow: "预算 → 固定支出 → 实际交易",
    flowHint: "固定支出属于预算计划。实际付款后，通过聊天记录交易，历史记录将更新实际支出。",
    wallet: "来源钱包", allWallets: "全部钱包", allBudgets: "全部预算", parent: "所属预算",
    limit: "限额", actual: "实际支出", remaining: "剩余限额", planned: "本期计划固定支出",
    flexible: "尚未分配给固定支出的限额", noPayment: "制定计划不会扣款，也不会创建交易。",
    noDouble: "实际支出与计划分别显示，不相加为总支出。",
    emptyBudget: "尚无预算", emptyBudgetHint: "请先为钱包创建预算，再添加固定支出。",
    emptyFixed: "没有符合条件的固定支出", emptyFixedHint: "每笔支出需要所属预算、金额和预计付款日期。",
    emptyWallet: "没有可用钱包", name: "名称", amount: "金额", start: "开始日期", category: "类别",
    allCategories: "全部支出类别", chooseCategory: "选择支出类别", cycle: "预算周期", due: "首次预计付款日期",
    recurrence: "重复", once: "一次", weekly: "每周", monthly: "每月", yearly: "每年",
    save: "保存计划", cancel: "取消", close: "关闭", edit: "编辑", pause: "暂停", resume: "继续",
    active: "启用中", paused: "已暂停", parentContext: "钱包和币种由所选预算决定。",
    overActual: "实际支出已超过限额。", overPlanned: "计划固定支出超过预算限额，请检查分配。",
    invalid: "保存前请检查名称、金额、日期、预算和类别。",
    mismatch: "钱包已停用，或币种与预算不一致，请检查设置。",
    oldSavings: "原有储蓄目标仍保留在数据中，未转换为固定支出。",
    viewHistory: "查看实际交易", countBudget: "项预算", countFixed: "项启用支出", mainWallet: "主钱包",
    noParent: "预算已不在列表中", allocations: "查看固定支出", budgetPlaceholder: "例如：每月生活费", fixedPlaceholder: "例如：房租",
  },
};

export function Planning({ navigate, initialTab = "budget", initialForm = "" }: { navigate: (screen: string) => void; initialTab?: "budget" | "fixed"; initialForm?: "budget" | "fixed" | "" }) {
  const state = useAppState();
  const params = useSearchParams();
  const language = String(state.settings.language || "").toLowerCase();
  const lang = /zh|chinese|trung|中文/.test(language) ? "zh" : /en|english|anh/.test(language) ? "en" : "vi";
  const t = COPY[lang], today = localDateKey(new Date());
  const budgets = state.goals.filter((item) => item.kind === "budget");
  const fixed = state.fixedExpenses || [];
  const activeWallets = state.wallets.filter((item) => !item.archived);
  const expenseCategories = Array.from(new Set([...state.categories.filter((name) => state.categoryMeta[name]?.type !== "income" && !state.categoryMeta[name]?.archived), ...state.transactions.filter((item) => item.type === "expense").map((item) => item.category)])).filter(Boolean);
  const [calendarLedgerOpen, setCalendarLedgerOpen] = useState(false);
  const [tab, setTab] = useState(initialTab);
  const [walletFilter, setWalletFilter] = useState("all");
  const [parentFilter, setParentFilter] = useState(params.get("budget") || "all");
  const [form, setForm] = useState<"budget" | "fixed" | "">(initialForm === "fixed" && !budgets.length ? "budget" : initialForm);
  const [editingId, setEditingId] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState(activeWallets[0]?.id || "");
  const [category, setCategory] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [cycle, setCycle] = useState("monthly");
  const [parentId, setParentId] = useState(params.get("budget") || budgets[0]?.id || "");
  const [dueDate, setDueDate] = useState(today);
  const [recurrence, setRecurrence] = useState<FixedExpense["recurrence"]>("monthly");
  const [error, setError] = useState("");
  const selectedParent = budgets.find((item) => item.id === parentId);
  const selectedWallet = activeWallets.find((item) => item.id === walletId);
  const walletName = (id: string) => { const item = state.wallets.find((wallet) => wallet.id === id); return item?.name === "." ? t.mainWallet : item?.name || t.emptyWallet; };
  const format = (value: number, currency: string) => new Intl.NumberFormat(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-GB", { maximumFractionDigits: 2 }).format(value) + " " + currency;
  const formatDate = (key: string) => new Intl.DateTimeFormat(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-GB", { dateStyle: "medium" }).format(new Date(key + "T12:00:00"));
  const open = (type: "budget" | "fixed", parent?: string, expense?: FixedExpense) => {
    setError(""); setEditingId(expense?.id || ""); setTitle(expense?.title || ""); setAmount(expense ? String(expense.amount) : "");
    setWalletId(activeWallets[0]?.id || ""); setStartDate(today); setCycle("monthly");
    const budget = budgets.find((item) => item.id === (parent || expense?.budgetId)) || budgets[0];
    setParentId(budget?.id || ""); setCategory(expense?.category || (type === "fixed" ? budget?.category || "" : ""));
    setDueDate(expense?.dueDate || (budget && budget.date > today ? budget.date : today)); setRecurrence(expense?.recurrence || "monthly");
    setForm(type === "fixed" && !budgets.length ? "budget" : type);
  };
  const selectParent = (id: string) => {
    const parent = budgets.find((item) => item.id === id);
    if (parent?.currency !== selectedParent?.currency) setAmount("");
    setParentId(id); setCategory(parent?.category || "");
    if (parent && parent.date > dueDate) setDueDate(parent.date);
  };
  const save = (event: FormEvent) => {
    event.preventDefault(); setError("");
    if (form === "budget") {
      if (!selectedWallet || !title.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || !startDate || !["monthly", "weekly", "yearly"].includes(cycle)) { setError(t.invalid); return; }
      const goal: Goal = { id: crypto.randomUUID(), kind: "budget", title: title.trim(), amount: Number(amount), saved: 0, currency: selectedWallet.currency, date: startDate, cycle, category, wallet: selectedWallet.id, direction: "", person: "" };
      if (!validBudget(state, goal)) { setError(t.invalid); return; }
      let saved = false;
      updateState((current) => {
        if (!validBudget(current, goal)) return current;
        saved = true;
        return { ...current, goals: [...current.goals, goal] };
      });
      if (!saved) { setError(t.invalid); return; }
      setForm(""); setTab("budget"); return;
    }
    const expense: FixedExpense = { id: editingId || crypto.randomUUID(), budgetId: parentId, title: title.trim(), amount: Number(amount), category: selectedParent?.category || category, dueDate, recurrence, active: editingId ? fixed.find((item) => item.id === editingId)?.active ?? true : true };
    if (!validFixedExpense(state, expense)) { setError(t.invalid); return; }
    let saved = false;
    updateState((current) => {
      if (!validFixedExpense(current, expense) || (editingId && !(current.fixedExpenses || []).some((item) => item.id === editingId))) return current;
      saved = true;
      return { ...current, fixedExpenses: editingId ? (current.fixedExpenses || []).map((item) => item.id === editingId ? expense : item) : [...(current.fixedExpenses || []), expense] };
    });
    if (!saved) { setError(t.invalid); return; }
    setForm(""); setTab("fixed");
  };
  const filteredBudgets = budgets.filter((item) => walletFilter === "all" || item.wallet === walletFilter);
  const filteredFixed = fixed.filter((item) => { const parent = budgets.find((budget) => budget.id === item.budgetId); return (parentFilter === "all" || item.budgetId === parentFilter) && (walletFilter === "all" || parent?.wallet === walletFilter); });

  return <main className="r-dashboard fb-home fb-planning">
    <FinBridgeHeader
      lang={lang}
      theme={String(state.settings?.theme || "light")}
      currentLanguage={String(state.settings?.language || "Tiếng Việt")}
      onOpenCalendar={() => setCalendarLedgerOpen(true)}
      onToggleTheme={() => updateState((s) => ({ ...s, settings: { ...s?.settings, theme: s?.settings?.theme === "dark" ? "light" : "dark" } }))}
      onSelectLanguage={(val) => updateState((s) => ({ ...s, settings: { ...s?.settings, language: val } }))}
    />

    <div className="fb-home-intro fb-planning-header">
      <div>
        <p className="fb-eyebrow">{lang === "vi" ? "KẾ HOẠCH CHI TIÊU" : lang === "zh" ? "支出计划" : "SPENDING PLAN"}</p>
        <h1>{t.title}</h1>
        <p>{t.intro}</p>
      </div>
      <button type="button" className="fb-add-button" disabled={!activeWallets.length} onClick={() => open(tab)}>
        <Plus size={18} />
        <span>{tab === "budget" ? t.addBudget : budgets.length ? t.addFixed : t.addBudget}</span>
      </button>
    </div>

    <div className="fb-planning-toolbar">
      <div className="fb-planning-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "budget"} onClick={() => setTab("budget")}>
          <b>{t.budget}</b>
          <small>{t.budgetHint}</small>
          <span>{budgets.length} {t.countBudget}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === "fixed"} onClick={() => setTab("fixed")}>
          <b>{t.fixed}</b>
          <small>{t.fixedHint}</small>
          <span>{fixed.filter((item) => item.active).length} {t.countFixed}</span>
        </button>
      </div>
      <div className="fb-planning-filters">
        <label>
          <span>{t.wallet}</span>
          <div className="fb-select-wrap">
            <select value={walletFilter} onChange={(event) => { setWalletFilter(event.target.value); setParentFilter("all"); }}>
              <option value="all">{t.allWallets}</option>
              {state.wallets.map((item) => <option key={item.id} value={item.id}>{walletName(item.id)} · {item.currency}</option>)}
            </select>
            <ChevronDown size={14} className="fb-select-chevron" aria-hidden="true" />
          </div>
        </label>
        {tab === "fixed" && (
          <label>
            <span>{t.parent}</span>
            <div className="fb-select-wrap">
              <select value={parentFilter} onChange={(event) => setParentFilter(event.target.value)}>
                <option value="all">{t.allBudgets}</option>
                {filteredBudgets.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
              <ChevronDown size={14} className="fb-select-chevron" aria-hidden="true" />
            </div>
          </label>
        )}
      </div>
    </div>

    {tab === "budget" ? <div className="fb-planning-cards">{!filteredBudgets.length ? <div className="fb-planning-empty"><Wallet size={30} /><h2>{t.emptyBudget}</h2><p>{t.emptyBudgetHint}</p><button type="button" className="fb-add-button" disabled={!activeWallets.length} onClick={() => open("budget")}><Plus size={17} />{t.addBudget}</button></div> : filteredBudgets.map((budget) => {
      const summary = budgetSummary(state, budget, today);
      return <article key={budget.id} className="fb-budget-card"><div className="fb-planning-card-heading"><span className="fb-planning-icon"><Wallet size={20} /></span><div><h2>{budget.title}</h2><p>{walletName(budget.wallet)} · {budget.currency} · {budget.category || t.allCategories}</p></div></div><p className="fb-planning-period"><CalendarDays size={15} />{formatDate(summary.start)} – {formatDate(summary.end)}</p><div className="fb-budget-limit"><span>{t.limit}</span><b>{format(budget.amount, budget.currency)}</b></div><progress aria-label={t.actual} value={Math.max(0, Math.min(summary.actual, budget.amount))} max={budget.amount} /><dl className="fb-planning-numbers"><div><dt>{t.actual}</dt><dd>{format(summary.actual, budget.currency)}</dd></div><div><dt>{t.remaining}</dt><dd>{format(summary.remaining, budget.currency)}</dd></div><div><dt>{t.planned}</dt><dd>{format(summary.planned, budget.currency)}</dd></div><div><dt>{t.flexible}</dt><dd>{format(summary.allocationRemaining, budget.currency)}</dd></div></dl>{(!summary.matchingCurrency || state.wallets.find((item) => item.id === budget.wallet)?.archived) && <p className="fb-planning-warning">{t.mismatch}</p>}{summary.actual > budget.amount && <p className="fb-planning-warning">{t.overActual}</p>}{summary.planned > budget.amount && <p className="fb-planning-warning">{t.overPlanned}</p>}<p className="fb-planning-note">{t.noDouble}</p><div className="fb-planning-card-actions"><button type="button" onClick={() => { setParentFilter(budget.id); setTab("fixed"); }}>{t.allocations}<ArrowRight size={15} /></button><button type="button" disabled={!summary.matchingCurrency || !!state.wallets.find((item) => item.id === budget.wallet)?.archived} onClick={() => open("fixed", budget.id)}><Plus size={16} />{t.addFixed}</button></div><button type="button" className="fb-planning-history" onClick={() => navigate("?tab=transactions&wallet=" + encodeURIComponent(budget.wallet) + "&type=expense&from=" + summary.start + "&to=" + summary.end + (budget.category ? "&category=" + encodeURIComponent(budget.category) : ""))}>{t.viewHistory}<ArrowRight size={14} /></button></article>;
    })}</div> : <div className="fb-fixed-list">{!filteredFixed.length ? <div className="fb-planning-empty"><ReceiptText size={30} /><h2>{t.emptyFixed}</h2><p>{budgets.length ? t.emptyFixedHint : t.emptyBudgetHint}</p><button type="button" className="fb-add-button" disabled={!activeWallets.length} onClick={() => open("fixed", parentFilter === "all" ? undefined : parentFilter)}><Plus size={17} />{budgets.length ? t.addFixed : t.addBudget}</button></div> : filteredFixed.map((expense) => {
      const parent = budgets.find((item) => item.id === expense.budgetId);
      const window = parent ? budgetSummary(state, parent, today) : undefined;
      const due = window ? plannedOccurrences(expense, window.start, window.end) : [];
      return <article className="fb-fixed-card" key={expense.id}><div className="fb-planning-card-heading"><span className="fb-planning-icon"><ArrowDownRight size={20} /></span><div><h2>{expense.title}</h2><p>{t.parent} · {parent?.title || t.noParent}</p><p>{parent ? walletName(parent.wallet) + " · " + parent.currency : ""} · {expense.category}</p></div><b>{parent ? format(expense.amount, parent.currency) : expense.amount}</b></div><div className="fb-fixed-meta"><span className={expense.active ? "is-active" : ""}>{expense.active ? t.active : t.paused}</span><span>{t[expense.recurrence]}</span><span>{formatDate(expense.dueDate)}</span>{due.length > 0 && <span>{due.map(formatDate).join(" · ")}</span>}</div><div className="fb-planning-card-actions"><button type="button" disabled={!parent} onClick={() => open("fixed", parent?.id, expense)}>{t.edit}</button><button type="button" onClick={() => updateState((current) => ({ ...current, fixedExpenses: (current.fixedExpenses || []).map((item) => item.id === expense.id ? { ...item, active: !item.active } : item) }))}>{expense.active ? t.pause : t.resume}</button></div></article>;
    })}<p className="fb-planning-note">{t.noPayment}</p></div>}
    {state.goals.some((item) => item.kind === "savings") && <details className="fb-planning-legacy"><summary>{t.oldSavings}</summary><ul>{state.goals.filter((item) => item.kind === "savings").map((item) => <li key={item.id}>{item.title} · {format(item.saved, item.currency)} / {format(item.amount, item.currency)}</li>)}</ul></details>}
    {form && <Modal title={form === "budget" ? t.addBudget : editingId ? t.edit + " · " + t.fixed : t.addFixed} onClose={() => setForm("")}><form className="r-form fb-planning-form" onSubmit={save}>
      {form === "fixed" && <><label>{t.parent}<select value={parentId} required onChange={(event) => selectParent(event.target.value)}><option value="">{t.allBudgets}</option>{budgets.filter((item) => activeWallets.some((wallet) => wallet.id === item.wallet && wallet.currency === item.currency)).map((item) => <option key={item.id} value={item.id}>{item.title} · {item.currency}</option>)}</select></label><p className="fb-planning-note">{t.parentContext}{selectedParent ? " " + walletName(selectedParent.wallet) + " · " + selectedParent.currency : ""}</p></>}
      <label>{t.name}<input aria-label={t.name} placeholder={form === "budget" ? t.budgetPlaceholder : t.fixedPlaceholder} required maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      {form === "budget" && <label>{t.wallet}<select value={walletId} required onChange={(event) => setWalletId(event.target.value)}>{activeWallets.map((item) => <option key={item.id} value={item.id}>{walletName(item.id)} · {item.currency}</option>)}</select></label>}
      <label>{t.amount} · {form === "budget" ? selectedWallet?.currency : selectedParent?.currency}<input aria-label={t.amount} type="number" min="0.01" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      <label>{t.category}<select value={form === "fixed" && selectedParent?.category ? selectedParent.category : category} disabled={form === "fixed" && !!selectedParent?.category} required={form === "fixed"} onChange={(event) => setCategory(event.target.value)}><option value="">{form === "budget" ? t.allCategories : t.chooseCategory}</option>{Array.from(new Set([...expenseCategories, ...(selectedParent?.category ? [selectedParent.category] : [])])).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      {form === "budget" ? <><label>{t.start}<input type="date" required value={startDate} onInput={(event) => setStartDate(event.currentTarget.value)} /></label><label>{t.cycle}<select value={cycle} onChange={(event) => setCycle(event.target.value)}>{(["weekly", "monthly", "yearly"] as const).map((item) => <option value={item} key={item}>{t[item]}</option>)}</select></label></> : <><label>{t.due}<input type="date" required min={selectedParent?.date} value={dueDate} onInput={(event) => setDueDate(event.currentTarget.value)} /></label><label>{t.recurrence}<select value={recurrence} onChange={(event) => setRecurrence(event.target.value as FixedExpense["recurrence"])}>{(["once", "weekly", "monthly", "yearly"] as const).map((item) => <option value={item} key={item}>{t[item]}</option>)}</select></label></>}
      <p className="fb-planning-note">{t.noPayment}</p>{error && <p role="alert" className="fb-planning-warning">{error}</p>}<div className="fb-modal-actions"><button type="button" className="r-secondary" onClick={() => setForm("")}>{t.cancel}</button><button type="submit" className="r-primary">{t.save}</button></div>
    </form></Modal>}
    {initialTab === "fixed" && <button type="button" className="fb-planning-back" onClick={() => navigate("?tab=tools")}><ChevronLeft size={16} />{t.budget}</button>}
    {calendarLedgerOpen && (
      <CalendarLedgerModal
        onClose={() => setCalendarLedgerOpen(false)}
        navigate={navigate}
      />
    )}
  </main>;
}
