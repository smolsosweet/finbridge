"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDownRight, ArrowRight, CalendarDays, Plus, ReceiptText, Wallet, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { FinBridgeHeader } from "./FinBridgeHeader";
import { CalendarLedgerModal } from "./CalendarLedgerModal";
import { SETUP_COPY } from "@/lib/setup-copy";
import { Modal, FinBridgeDropdown } from "./Ui";
import { localDateKey } from "./chartWeek";
import { budgetSummary, currencyScale, plannedOccurrences, validBudget, validFixedExpense } from "./planningModel";
import { flushWorkspace, updateState, useAppState, type FixedExpense, type Goal } from "./store";
import { addBudgetCategory, expenseCategoriesForWallet } from "@/lib/budget-categories";
import { nextExpenseDue, unpaidOccurrences } from "@/lib/fixed-expense-payments";
import { FixedExpenseActions } from "@/components/payments/FixedExpenseActions";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/currency-format";


const COPY = {
  vi: {
    title: "Kế hoạch chi tiêu", intro: "Theo dõi hạn mức ngân sách và khoản chi cố định sắp đến hạn.",
    budget: "Ngân sách", fixed: "Khoản chi cố định", addBudget: "Tạo ngân sách", addFixed: "Tạo chi phí cố định",
    budgetHint: "Hạn mức theo ví, danh mục và kỳ.", fixedHint: "Tiền nhà, học phí và các khoản dự kiến phải trả.",
    flow: "Ngân sách → Khoản chi cố định → Giao dịch thực tế",
    flowHint: "Khoản chi cố định là kế hoạch trong ngân sách. Khi phát sinh, ghi giao dịch qua chat; lịch sử sẽ cập nhật chi thực tế.",
    wallet: "Ví nguồn", allWallets: "Tất cả ví", allBudgets: "Tất cả ngân sách", parent: "Liên kết ngân sách (tùy chọn)",
    limit: "Hạn mức", actual: "Đã chi thực tế", remaining: "Hạn mức còn lại", planned: "Khoản cố định chưa thanh toán trong kỳ",
    flexible: "Còn lại sau các khoản cố định", noPayment: "Lập kế hoạch chưa trừ tiền và chưa tạo giao dịch.",
    noDouble: "Còn lại sau các khoản cố định = hạn mức − đã chi − khoản cố định chưa thanh toán. Khi ghi nhận đã chi, khoản đó không bị trừ thêm lần nữa.",
    emptyBudget: "Chưa có ngân sách", emptyBudgetHint: "Đặt hạn mức chi theo ví và danh mục. Khoản cố định có thể tạo độc lập.",
    emptyFixed: "Chưa có khoản chi cố định phù hợp", emptyFixedHint: "Mỗi khoản có ví chi, số tiền và lịch đến hạn; có thể liên kết ngân sách.",
    emptyWallet: "Chưa có ví đang hoạt động", name: "Tên", amount: "Số tiền", start: "Ngày bắt đầu", category: "Danh mục",
    allCategories: "Tất cả danh mục chi", chooseCategory: "Chọn danh mục chi", cycle: "Kỳ ngân sách", due: "Ngày dự kiến trả đầu tiên",
    recurrence: "Lặp lại", once: "Một lần", weekly: "Hàng tuần", monthly: "Hàng tháng", yearly: "Hàng năm",
    save: "Lưu kế hoạch", cancel: "Hủy", close: "Đóng", edit: "Chỉnh sửa", pause: "Tạm dừng", resume: "Tiếp tục",
    active: "Đang áp dụng", paused: "Đã tạm dừng", parentContext: "Ví và tiền tệ được lấy từ ngân sách đã chọn.",
    overActual: "Chi thực tế đã vượt hạn mức.", nearLimit: "Đã sử dụng ít nhất 80% ngân sách kỳ này.", overPlanned: "Hạn mức còn lại không đủ cho các khoản cố định chưa thanh toán trong kỳ.",
    invalid: "Kiểm tra tên, số tiền, ngày, ngân sách và danh mục trước khi lưu.",
    mismatch: "Ví không còn hoạt động hoặc tiền tệ không khớp ngân sách; cần kiểm tra lại.",
    oldSavings: "Các mục tiêu tiết kiệm cũ vẫn được giữ trong dữ liệu; chưa chuyển thành khoản chi cố định.",
    viewHistory: "Xem giao dịch thực tế", countBudget: "ngân sách", countFixed: "khoản đang áp dụng", mainWallet: "Ví chính",
    noParent: "Ngân sách không còn trong danh sách", allocations: "Xem khoản chi cố định", budgetPlaceholder: "Ví dụ: Sinh hoạt tháng", fixedPlaceholder: "Ví dụ: Tiền thuê nhà",
    delete: "Xóa", deleteBudgetConfirm: "Xóa ngân sách này? Các khoản chi cố định vẫn được giữ và sẽ bỏ liên kết ngân sách.", deleteFixedConfirm: "Xóa khoản chi cố định này?", resetChat: "Xóa hội thoại", resetChatConfirm: "Xóa toàn bộ hội thoại mô phỏng này?",
    dueThisPeriod: "Đến hạn kỳ này", firstDue: "Ngày bắt đầu",
    details: "Chi tiết", budgetDetails: "Chi tiết ngân sách", fixedDetails: "Chi tiết khoản chi cố định",
  },
  en: {
    title: "Budget & Expense", intro: "Track budget limits and upcoming fixed expenses.",
    budget: "Budgets", fixed: "Fixed expenses", addBudget: "Create budget", addFixed: "Create fixed expense",
    budgetHint: "A limit by wallet, category and period.", fixedHint: "Rent, tuition and other planned bills.",
    flow: "Budget → Fixed expenses → Recorded transactions",
    flowHint: "Fixed expenses are budget plans. When spending happens, record it in chat; history updates actual spending.",
    wallet: "Source wallet", allWallets: "All wallets", allBudgets: "All budgets", parent: "Linked budget (optional)",
    limit: "Limit", actual: "Actual spending", remaining: "Remaining limit", planned: "Unpaid fixed expenses this period",
    flexible: "Remaining after fixed expenses", noPayment: "Planning does not debit money or create a transaction.",
    noDouble: "Remaining after fixed expenses = limit − actual spending − unpaid fixed expenses. Recorded payments are not deducted twice.",
    emptyBudget: "No budgets yet", emptyBudgetHint: "Create a spending limit for a wallet and category. Fixed expenses can be set up independently.",
    emptyFixed: "No matching fixed expenses", emptyFixedHint: "Each bill has a wallet, amount and due schedule. Linking a budget is optional.",
    emptyWallet: "No active wallets", name: "Name", amount: "Amount", start: "Start date", category: "Category",
    allCategories: "All expense categories", chooseCategory: "Choose an expense category", cycle: "Budget period", due: "First planned payment date",
    recurrence: "Repeat", once: "Once", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly",
    save: "Save plan", cancel: "Cancel", close: "Close", edit: "Edit", pause: "Pause", resume: "Resume",
    active: "Active", paused: "Paused", parentContext: "Wallet and currency come from the selected budget.",
    overActual: "Actual spending exceeds the limit.", nearLimit: "At least 80% of this period’s budget has been used.", overPlanned: "The remaining limit does not cover unpaid fixed expenses this period.",
    invalid: "Check the name, amount, dates, budget and category before saving.",
    mismatch: "The wallet is inactive or its currency differs from this budget. Review the setup.",
    oldSavings: "Existing savings goals are retained in storage and have not been converted to fixed expenses.",
    viewHistory: "View actual transactions", countBudget: "budgets", countFixed: "active expenses", mainWallet: "Main wallet",
    noParent: "Budget no longer listed", allocations: "View fixed expenses", budgetPlaceholder: "For example: Monthly living costs", fixedPlaceholder: "For example: Rent",
    delete: "Delete", deleteBudgetConfirm: "Delete this budget? Linked fixed expenses will be kept without a budget link.", deleteFixedConfirm: "Delete this fixed expense?", resetChat: "Reset conversation", resetChatConfirm: "Delete this scenario conversation?",
    dueThisPeriod: "Due this period", firstDue: "Starts",
    details: "Details", budgetDetails: "Budget details", fixedDetails: "Fixed expense details",
  },
  zh: {
    title: "支出计划", intro: "跟踪预算限额和即将到期的固定支出。",
    budget: "预算", fixed: "固定支出", addBudget: "创建预算", addFixed: "创建固定支出",
    budgetHint: "按钱包、类别和周期设置限额。", fixedHint: "房租、学费及其他计划账单。",
    flow: "预算 → 固定支出 → 实际交易",
    flowHint: "固定支出属于预算计划。实际付款后，通过聊天记录交易，历史记录将更新实际支出。",
    wallet: "来源钱包", allWallets: "全部钱包", allBudgets: "全部预算", parent: "关联预算（选填）",
    limit: "限额", actual: "实际支出", remaining: "剩余限额", planned: "本期未支付固定支出",
    flexible: "预留固定支出后的剩余额度", noPayment: "制定计划不会扣款，也不会创建交易。",
    noDouble: "预留后剩余额度 = 预算限额 − 实际支出 − 未支付固定支出。已记录的付款不会重复扣除。",
    emptyBudget: "尚无预算", emptyBudgetHint: "为钱包和类别设置支出限额。固定支出也可单独创建。",
    emptyFixed: "没有符合条件的固定支出", emptyFixedHint: "每笔账单有付款钱包、金额和到期规则，可选关联预算。",
    emptyWallet: "没有可用钱包", name: "名称", amount: "金额", start: "开始日期", category: "类别",
    allCategories: "全部支出类别", chooseCategory: "选择支出类别", cycle: "预算周期", due: "首次预计付款日期",
    recurrence: "重复", once: "一次", weekly: "每周", monthly: "每月", yearly: "每年",
    save: "保存计划", cancel: "取消", close: "关闭", edit: "编辑", pause: "暂停", resume: "继续",
    active: "启用中", paused: "已暂停", parentContext: "钱包和币种由所选预算决定。",
    overActual: "实际支出已超过限额。", nearLimit: "本期预算已使用至少 80%。", overPlanned: "本期剩余额度不足以支付未付固定支出。",
    invalid: "保存前请检查名称、金额、日期、预算和类别。",
    mismatch: "钱包已停用，或币种与预算不一致，请检查设置。",
    oldSavings: "原有储蓄目标仍保留在数据中，未转换为固定支出。",
    viewHistory: "查看实际交易", countBudget: "项预算", countFixed: "项启用支出", mainWallet: "主钱包",
    noParent: "预算已不在列表中", allocations: "查看固定支出", budgetPlaceholder: "例如：每月生活费", fixedPlaceholder: "例如：房租",
    delete: "删除", deleteBudgetConfirm: "删除此预算？关联的固定支出将保留并取消预算关联。", deleteFixedConfirm: "删除此固定支出？", resetChat: "清除对话", resetChatConfirm: "清除此情景对话？",
    dueThisPeriod: "本期到期", firstDue: "开始日期",
    details: "详情", budgetDetails: "预算详情", fixedDetails: "固定支出详情",
  },
};

const PlanningDropdown = FinBridgeDropdown;

export function Planning({ navigate, initialTab = "budget", initialForm = "" }: { navigate: (screen: string) => void; initialTab?: "budget" | "fixed"; initialForm?: "budget" | "fixed" | "" }) {
  const state = useAppState();
  const params = useSearchParams();
  const language = String(state.settings.language || "").toLowerCase();
  const lang = /zh|chinese|trung|中文/.test(language) ? "zh" : /en|english|anh/.test(language) ? "en" : "vi";
  const t = COPY[lang], today = localDateKey(new Date());
  const horizon = new Date(today + "T12:00:00Z"); horizon.setUTCDate(horizon.getUTCDate() + 30);
  const unpaidHorizon = horizon.toISOString().slice(0, 10);
  const budgets = state.goals.filter((item) => item.kind === "budget");
  const fixed = state.fixedExpenses || [];
  const activeWallets = state.wallets.filter((item) => !item.archived);
  const [calendarLedgerOpen, setCalendarLedgerOpen] = useState(false);
  const [tab, setTab] = useState(initialTab);
  const [walletFilter, setWalletFilter] = useState("all");
  const [parentFilter, setParentFilter] = useState(params.get("budget") || "all");
  const [detailsBudget, setDetailsBudget] = useState<Goal | null>(null);
  const [detailsExpense, setDetailsExpense] = useState<FixedExpense | null>(null);
  const [form, setForm] = useState<"budget" | "fixed" | "">(initialForm);
  const [editingId, setEditingId] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState(activeWallets[0]?.id || "");
  const [category, setCategory] = useState("");
  const [addingCategory, setAddingCategory] = useState(false), [newCategory, setNewCategory] = useState(""), [categoryError, setCategoryError] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [cycle, setCycle] = useState("monthly");
  const [parentId, setParentId] = useState(params.get("budget") || "");
  const [dueDate, setDueDate] = useState(today);
  const [recurrence, setRecurrence] = useState<FixedExpense["recurrence"]>("monthly");
  const [intervalMonths, setIntervalMonths] = useState(1);
  const [reminderDays, setReminderDays] = useState(3);
  const [monthPosition, setMonthPosition] = useState<"start" | "end" | "date">("date");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const finishSave = async (id: string, nextTab: "budget" | "fixed") => {
    saveLock.current = true; setSaving(true); setEditingId(id);
    try { await flushWorkspace(); setForm(""); setTab(nextTab); }
    catch { setError(lang === "vi" ? "Chưa lưu được lên máy chủ. Hãy thử lưu lại; dữ liệu đang chờ sẽ không bị tạo trùng." : lang === "zh" ? "尚未保存到服务器。请重试，待保存内容不会重复创建。" : "Not saved to the server yet. Retry saving; pending changes will not be duplicated."); }
    finally { saveLock.current = false; setSaving(false); }
  };
  const [visibleBudgetCount, setVisibleBudgetCount] = useState(5);
  const [visibleFixedCount, setVisibleFixedCount] = useState(5);
  useEffect(() => {
    let timer = 0;
    const scrollToTarget = () => {
      let targetId = "";
      try { targetId = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      if (!targetId) return;
      setTab(targetId.startsWith("fixed-") ? "fixed" : "budget");
      setWalletFilter("all");
      setParentFilter("all");
      if (targetId.startsWith("budget-")) setVisibleBudgetCount(prev => Math.max(prev, 999));
      if (targetId.startsWith("fixed-")) setVisibleFixedCount(prev => Math.max(prev, 999));
      window.clearTimeout(timer);
      timer = window.setTimeout(() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "center" }), 220);
    };
    scrollToTarget();
    window.addEventListener("hashchange", scrollToTarget);
    return () => { window.clearTimeout(timer); window.removeEventListener("hashchange", scrollToTarget); };
  }, [initialTab]);
  const selectedParent = budgets.find((item) => item.id === parentId);
  const selectedWallet = activeWallets.find((item) => item.id === walletId);
  const expenseCategories = expenseCategoriesForWallet(state, form === "fixed" && selectedParent ? selectedParent.wallet : walletId);
  const categoryCopy = lang === "vi" ? { add: "Thêm danh mục", name: "Tên danh mục mới", save: "Thêm và chọn", hint: "Danh mục chi được lưu trong database và gắn với ví đã chọn.", invalid: "Nhập tên danh mục chi hợp lệ, tối đa 80 ký tự. Tên không được trùng danh mục thu nhập." } : lang === "zh" ? { add: "添加类别", name: "新类别名称", save: "添加并选择", hint: "支出类别存入数据库并关联所选钱包。", invalid: "请输入不超过80个字符的有效支出类别名称，不能与收入类别重名。" } : { add: "Add category", name: "New category name", save: "Add and select", hint: "The expense category is stored in the database and linked to the selected wallet.", invalid: "Use a valid expense category name, up to 80 characters. It cannot match an income category." };
  function createBudgetCategory() {
    try {
      let selected = "";
      updateState(current => { const result = addBudgetCategory(current, selectedParent && form === "fixed" ? selectedParent.wallet : walletId, newCategory); selected = result.name; return result.state; });
      setCategory(selected); setNewCategory(""); setAddingCategory(false); setCategoryError("");
    } catch { setCategoryError(categoryCopy.invalid); }
  }
  const unassigned = lang === "vi" ? "Chưa liên kết ngân sách" : lang === "zh" ? "尚未关联预算" : "Not linked to a budget yet";
  const repeatMonths = lang === "vi" ? "Lặp mỗi (tháng)" : lang === "zh" ? "每隔几个月重复" : "Repeat every (months)";
  const reminderLabel = lang === "vi" ? "Nhắc trước (ngày)" : lang === "zh" ? "提前几天提醒" : "Remind before (days)";
  const walletName = (id: string) => { const item = state.wallets.find((wallet) => wallet.id === id); return item?.name === "." ? t.mainWallet : item?.name || t.emptyWallet; };
  const format = (value: number, currency: string) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value) + " " + currency;
  const formatDate = (key: string) => new Intl.DateTimeFormat(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-GB", { dateStyle: "medium" }).format(new Date(key + "T12:00:00"));
  const open = (type: "budget" | "fixed", parent?: string, expense?: FixedExpense, targetBudget?: Goal) => {
    setAddingCategory(false); setNewCategory(""); setCategoryError("");
    setError("");
    if (type === "budget" && targetBudget) {
      setEditingId(targetBudget.id);
      setTitle(targetBudget.title);
      setAmount(formatCurrencyInput(targetBudget.amount));
      setWalletId(targetBudget.wallet);
      setStartDate(targetBudget.date);
      setCycle(targetBudget.cycle);
      setCategory(targetBudget.category || "");
      setForm(type);
      return;
    }
    setEditingId(expense?.id || ""); setTitle(expense?.title || ""); setAmount(expense ? formatCurrencyInput(expense.amount) : "");
    setWalletId(expense?.walletId || activeWallets[0]?.id || ""); setStartDate(today); setCycle("monthly");
    const budget = budgets.find((item) => item.id === (parent || expense?.budgetId));
    setParentId(budget?.id || ""); setCategory(expense?.category || (type === "fixed" ? budget?.category || "" : ""));
    setDueDate(expense?.dueDate || (budget && budget.date > today ? budget.date : today)); setRecurrence(expense?.recurrence || "monthly");
    setIntervalMonths(expense?.intervalMonths || 1); setReminderDays(expense?.reminderDays ?? 3); setMonthPosition(expense?.monthPosition || "date");
    setForm(type);
  };
  const selectParent = (id: string) => {
    const parent = budgets.find((item) => item.id === id);
    if (parent?.currency !== selectedParent?.currency) setAmount("");
    setParentId(id); setCategory(parent?.category || "");
    if (parent && parent.date > dueDate) setDueDate(parent.date);
  };
  const save = (event: FormEvent) => {
    event.preventDefault(); if (saveLock.current) return; setError("");
    if (form === "budget") {
      const numericAmount = parseCurrencyInput(amount);
      if (!selectedWallet || !title.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0 || !startDate || !["monthly", "weekly", "yearly"].includes(cycle)) { setError(t.invalid); return; }
      if (editingId) {
        const existing = budgets.find((b) => b.id === editingId);
        if (!existing || (existing.currency !== selectedWallet.currency && fixed.some(f => f.budgetId === existing.id))) { setError(t.invalid); return; }
        const updatedGoal: Goal = { ...existing, title: title.trim(), amount: numericAmount, currency: selectedWallet.currency, date: startDate, cycle, category, wallet: selectedWallet.id };
        if (!validBudget(state, updatedGoal)) { setError(t.invalid); return; }
        let saved = false;
        updateState((current) => {
          if (!validBudget(current, updatedGoal)) return current;
          saved = true;
          return {
            ...current,
            goals: current.goals.map((g) => g.id === editingId ? updatedGoal : g),
            fixedExpenses: (current.fixedExpenses || []).map((f) => f.budgetId === editingId ? { ...f, walletId: selectedWallet.id, category: category || f.category } : f),
          };
        });
        if (!saved) { setError(t.invalid); return; }
        return finishSave(updatedGoal.id, "budget");
      }
      const goal: Goal = { id: crypto.randomUUID(), kind: "budget", title: title.trim(), amount: numericAmount, saved: 0, currency: selectedWallet.currency, date: startDate, cycle, category, wallet: selectedWallet.id, direction: "", person: "" };
      if (!validBudget(state, goal)) { setError(t.invalid); return; }
      let saved = false;
      updateState((current) => {
        if (!validBudget(current, goal)) return current;
        saved = true;
        return { ...current, goals: [...current.goals, goal] };
      });
      if (!saved) { setError(t.invalid); return; }
      return finishSave(goal.id, "budget");
    }
    let plannedDue = dueDate;
    if (monthPosition !== "date" && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      const [year, month] = dueDate.split("-").map(Number);
      plannedDue = `${year}-${String(month).padStart(2, "0")}-${String(monthPosition === "start" ? 1 : new Date(year, month, 0).getDate()).padStart(2, "0")}`;
    }
    const parsedExpenseAmount = parseCurrencyInput(amount);
    const expense: FixedExpense = { ...fixed.find(item => item.id === editingId), id: editingId || crypto.randomUUID(), budgetId: parentId, walletId: selectedParent?.wallet || walletId, title: title.trim(), amount: parsedExpenseAmount, category: selectedParent?.category || category, dueDate: plannedDue, recurrence, intervalMonths, reminderDays, monthPosition, active: editingId ? fixed.find((item) => item.id === editingId)?.active ?? true : true };
    if (!validFixedExpense(state, expense)) { setError(t.invalid); return; }
    let saved = false;
    updateState((current) => {
      if (!validFixedExpense(current, expense) || (editingId && !(current.fixedExpenses || []).some((item) => item.id === editingId))) return current;
      saved = true;
      return { ...current, fixedExpenses: editingId ? (current.fixedExpenses || []).map((item) => item.id === editingId ? expense : item) : [...(current.fixedExpenses || []), expense] };
    });
    if (!saved) { setError(t.invalid); return; }
    return finishSave(expense.id, "fixed");
  };
  const deleteBudget = (budgetId: string) => {
    if (!window.confirm(t.deleteBudgetConfirm)) return;
    updateState((current) => ({ ...current, goals: current.goals.filter((item) => item.id !== budgetId), fixedExpenses: (current.fixedExpenses || []).map(item => item.budgetId === budgetId ? { ...item, walletId: current.goals.find(g => g.id === budgetId)?.wallet || item.walletId, budgetId: "" } : item) }));
  };
  const deleteFixed = (expenseId: string) => {
    if (!window.confirm(t.deleteFixedConfirm)) return;
    updateState((current) => ({ ...current, fixedExpenses: (current.fixedExpenses || []).filter((item) => item.id !== expenseId) }));
  };
  const filteredBudgets = budgets.filter((item) => walletFilter === "all" || item.wallet === walletFilter);
  const filteredFixed = fixed.filter((item) => { const parent = budgets.find((budget) => budget.id === item.budgetId); return (parentFilter === "all" || item.budgetId === parentFilter) && (walletFilter === "all" || (parent?.wallet || item.walletId) === walletFilter); });
  const nextDueDate = (expense: FixedExpense) => expense.active ? nextExpenseDue(state, expense, today) || "9999-12-31" : "9999-12-31";
  const sortedFixed = [...filteredFixed].sort((a, b) => nextDueDate(a).localeCompare(nextDueDate(b)));
  const setPlanningTab = (nextTab: "budget" | "fixed") => setTab(nextTab);
  const primaryForm = tab;

  // Next router navigation to a hash in this same view does not always fire
  // hashchange. Reveal the target before routing so it exists for scrolling.
  const navigateFromHeader = (path: string) => {
    let targetId = "";
    try { targetId = decodeURIComponent(path.split("#")[1] || ""); } catch { /* No target to reveal. */ }
    if (targetId.startsWith("budget-") || targetId.startsWith("fixed-")) {
      setTab(targetId.startsWith("fixed-") ? "fixed" : "budget");
      setWalletFilter("all");
      setParentFilter("all");
      window.requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    }
    navigate(path);
  };

  return <main className="r-dashboard fb-home fb-planning">
    <FinBridgeHeader
      lang={lang}
      navigate={navigateFromHeader}
      eyebrow={lang === "vi" ? "KẾ HOẠCH CHI TIÊU" : lang === "zh" ? "支出计划" : "SPENDING PLAN"}
      title={t.title}
      subtitle={lang === "vi" ? "Theo dõi ngân sách và các khoản chi cố định sắp đến hạn." : lang === "zh" ? "跟踪预算及即将到期的固定支出。" : "Track budgets and upcoming fixed expenses."}
      theme={String(state.settings?.theme || "light")}
      currentLanguage={String(state.settings?.language || "Tiếng Việt")}
      onOpenCalendar={() => setCalendarLedgerOpen(true)}
      onToggleTheme={() => updateState((s) => ({ ...s, settings: { ...s?.settings, theme: s?.settings?.theme === "dark" ? "light" : "dark" } }))}
      onSelectLanguage={(val) => updateState((s) => ({ ...s, settings: { ...s?.settings, language: val } }))}
      primaryAction={<button type="button" className="fb-add-button fb-header-primary-action" disabled={!activeWallets.length} onClick={() => primaryForm === "fixed" ? open("fixed", parentFilter === "all" ? undefined : parentFilter) : open("budget")}><Plus size={18}/><span>{primaryForm === "fixed" ? t.addFixed : t.addBudget}</span></button>}
    />


    <section className="fb-planning-management" aria-label={lang === "vi" ? "Ngân sách & Chi cố định" : lang === "zh" ? "预算与固定支出" : "Budgets & Fixed costs"}>
      <div className="fb-planning-toolbar">
        <div className="fb-planning-switcher">
          <div className="fb-planning-tabs fb-planning-tabs-compact" role="tablist" aria-label={lang === "vi" ? "Chọn danh sách quản lý" : lang === "zh" ? "选择管理列表" : "Choose a management list"}>
            <button type="button" role="tab" id="planning-tab-budget" aria-controls="fb-budget-section" aria-selected={tab === "budget"} title={t.budgetHint} onClick={() => setPlanningTab("budget")}><small>{lang === "vi" ? "Hạn mức" : lang === "zh" ? "限额" : "Limits"}</small><span className="fb-planning-tab-title"><b>{t.budget}</b><span className="fb-planning-tab-count">{budgets.length}</span></span></button>
            <button type="button" role="tab" id="planning-tab-fixed" aria-controls="fb-fixed-section" aria-selected={tab === "fixed"} title={t.fixedHint} onClick={() => setPlanningTab("fixed")}><small>{lang === "vi" ? "Lịch thanh toán" : lang === "zh" ? "付款日程" : "Payment schedule"}</small><span className="fb-planning-tab-title"><b>{t.fixed}</b><span className="fb-planning-tab-count">{fixed.filter((item) => item.active).length}</span></span></button>
          </div>
          <label className="fb-planning-wallet-select"><span>{t.wallet}</span><PlanningDropdown value={walletFilter} onChange={(val) => { setWalletFilter(val); setParentFilter("all"); setVisibleBudgetCount(5); setVisibleFixedCount(5); }} options={[{ value: "all", label: t.allWallets }, ...state.wallets.map((item) => ({ value: item.id, label: `${walletName(item.id)} · ${item.currency}` }))]} ariaLabel={t.wallet} /></label>
        </div>
        <div className="fb-planning-filters">
          {tab === "fixed" && <label><span>{t.parent}</span><PlanningDropdown value={parentFilter} onChange={(val) => { setParentFilter(val); setVisibleFixedCount(5); }} options={[{ value: "all", label: t.allBudgets }, ...filteredBudgets.map((item) => ({ value: item.id, label: item.title }))]} ariaLabel={t.parent} /></label>}
        </div>
      </div>

      {tab === "budget" && <section className="fb-planning-list-section" id="fb-budget-section" role="tabpanel" aria-labelledby="planning-tab-budget">
        <header className="fb-planning-section-heading"><div><p className="fb-eyebrow">{lang === "vi" ? "HẠN MỨC" : "LIMITS"}</p><h2 id="fb-budget-list-title">{t.budget}</h2></div><span>{filteredBudgets.length} {t.countBudget}</span></header>
        <div className="fb-planning-cards">
          {!filteredBudgets.length ? <div className="fb-planning-empty"><Wallet size={30} /><h2>{t.emptyBudget}</h2><p>{t.emptyBudgetHint}</p><button type="button" className="fb-add-button" disabled={!activeWallets.length} onClick={() => open("budget")}><Plus size={17} />{t.addBudget}</button></div> : filteredBudgets.slice(0, visibleBudgetCount).map((budget) => {
            const summary = budgetSummary(state, budget, today);
            const walletArchived = !!state.wallets.find((item) => item.id === budget.wallet)?.archived;
            const status = !summary.matchingCurrency || walletArchived ? "needs-review" : summary.actual > budget.amount ? "over" : summary.afterCommitments < 0 ? "planned-over" : summary.actual >= budget.amount * 0.8 ? "near" : "on-track";
            const statusLabel = lang === "vi" ? (status === "over" ? "Đã vượt hạn mức" : status === "planned-over" ? "Kế hoạch vượt" : status === "near" ? "Sắp chạm hạn mức" : status === "needs-review" ? "Cần kiểm tra" : "Trong hạn mức") : lang === "zh" ? (status === "over" ? "已超出预算" : status === "planned-over" ? "未付账单超出剩余额度" : status === "near" ? "接近限额" : status === "needs-review" ? "需要检查" : "限额内") : (status === "over" ? "Over budget" : status === "planned-over" ? "Plan exceeds limit" : status === "near" ? "Near limit" : status === "needs-review" ? "Review needed" : "On track");
            return <article id={`budget-${budget.id}`} key={budget.id} className="fb-budget-card"><div className="fb-planning-card-heading"><span className="fb-planning-icon"><Wallet size={20} /></span><div className="fb-card-heading-body"><h2>{budget.title}</h2><div className="fb-card-tags"><span className="fb-card-tag">{walletName(budget.wallet)} · {budget.currency}</span><span className="fb-card-tag">{budget.category || t.allCategories}</span></div></div><span className={`fb-budget-status is-${status}`}>{statusLabel}</span><button type="button" className="fb-planning-delete" aria-label={`${t.delete}: ${budget.title}`} title={t.delete} onClick={() => deleteBudget(budget.id)}><Trash2 size={16} /></button></div>
              <p className="fb-planning-period"><CalendarDays size={14} />{formatDate(summary.start)} – {formatDate(summary.end)}</p><div className="fb-budget-meter-wrap"><div className="fb-budget-limit"><span>{t.limit}</span><b>{format(budget.amount, budget.currency)}</b></div><progress aria-label={t.actual} value={Math.max(0, Math.min(summary.actual, budget.amount))} max={budget.amount} /><div className="fb-budget-percent-row"><span>{Math.round(Math.min(100, Math.max(0, budget.amount > 0 ? (summary.actual / budget.amount) * 100 : 0)))}% {lang === "vi" ? "đã dùng" : lang === "zh" ? "已使用" : "used"}</span><span>{format(summary.remaining, budget.currency)} {lang === "vi" ? "còn lại" : lang === "zh" ? "剩余" : "left"}</span></div></div>
              <div className="fb-planning-numbers"><div className="fb-stat-tile"><dt>{t.actual}</dt><dd>{format(summary.actual, budget.currency)}</dd></div><div className="fb-stat-tile"><dt>{t.remaining}</dt><dd className="is-remaining">{format(summary.remaining, budget.currency)}</dd></div></div>
              {(!summary.matchingCurrency || walletArchived) && <p className="fb-planning-warning">{t.mismatch}</p>}{summary.actual > budget.amount && <p className="fb-planning-warning">{t.overActual}</p>}{summary.actual >= budget.amount * 0.8 && summary.actual <= budget.amount && <p className="fb-planning-warning">{t.nearLimit}</p>}
              <div className="fb-planning-card-actions"><button type="button" onClick={() => open("budget", undefined, undefined, budget)}>{t.edit}</button><button type="button" onClick={() => setDetailsBudget(budget)}>{t.details}</button><button type="button" onClick={() => { setParentFilter(budget.id); setPlanningTab("fixed"); }}>{t.allocations}{summary.children.length ? ` (${summary.children.length})` : ""}<ArrowRight size={14} /></button><button type="button" disabled={!summary.matchingCurrency || walletArchived} onClick={() => open("fixed", budget.id)}><Plus size={15} />{t.addFixed}</button></div>
            </article>;
          })}
        </div>
        {filteredBudgets.length > visibleBudgetCount && (
          <div className="fb-load-more-wrap">
            <button
              type="button"
              className="fb-load-more-btn"
              onClick={() => setVisibleBudgetCount((prev) => prev + 5)}
            >
              {lang === "vi"
                ? `Xem thêm (${filteredBudgets.length - visibleBudgetCount} ngân sách)`
                : lang === "zh"
                ? `查看更多 (${filteredBudgets.length - visibleBudgetCount})`
                : `Show more (${filteredBudgets.length - visibleBudgetCount})`}
            </button>
          </div>
        )}
      </section>}

      {tab === "fixed" && <section className="fb-planning-list-section" id="fb-fixed-section" role="tabpanel" aria-labelledby="planning-tab-fixed">
        <header className="fb-planning-section-heading"><div><p className="fb-eyebrow">{lang === "vi" ? "LỊCH THANH TOÁN" : "PAYMENT SCHEDULE"}</p><h2 id="fb-fixed-list-title">{t.fixed}</h2></div><span>{filteredFixed.filter((item) => item.active).length} {t.countFixed}</span></header>
        <div className="fb-fixed-list">
          {!filteredFixed.length ? <div className="fb-planning-empty"><ReceiptText size={30} /><h2>{t.emptyFixed}</h2><p>{t.emptyFixedHint}</p><button type="button" className="fb-add-button" disabled={!activeWallets.length} onClick={() => open("fixed", parentFilter === "all" ? undefined : parentFilter)}><Plus size={17} />{t.addFixed}</button></div> : sortedFixed.slice(0, visibleFixedCount).map((expense) => {
            const parent = budgets.find((item) => item.id === expense.budgetId);
            const window = parent ? budgetSummary(state, parent, today) : undefined;
            const due = window ? plannedOccurrences(expense, window.start, window.end) : [];
            const currency = parent?.currency || state.wallets.find((wallet) => wallet.id === expense.walletId)?.currency || "";
            const unpaid = expense.active ? unpaidOccurrences(state, expense, expense.dueDate, unpaidHorizon) : [];
            return <article id={`fixed-${expense.id}`} className="fb-fixed-card" key={expense.id}>
              <div className="fb-planning-card-heading">
                <span className="fb-planning-icon"><ArrowDownRight size={18} /></span>
                <div className="fb-card-heading-body">
                  <h2>{expense.title}</h2>
                  <div className="fb-card-tags">
                    <span className="fb-card-tag">{parent ? `${t.parent}: ${parent.title}` : (expense.budgetId ? t.noParent : unassigned)}</span>
                    <span className="fb-card-tag">{walletName(parent?.wallet || expense.walletId || "")} · {currency}</span>
                    <span className="fb-card-tag">{parent?.category || expense.category}</span>
                  </div>
                </div>
                <span className={`fb-status-pill ${expense.active ? "is-active" : ""}`}>{expense.active ? t.active : t.paused}</span>
                <button type="button" className="fb-planning-delete" aria-label={`${t.delete}: ${expense.title}`} title={t.delete} onClick={() => deleteFixed(expense.id)}><Trash2 size={16} /></button>
              </div>
              <div className="fb-fixed-compact-row">
                <div className="fb-fixed-compact-amount">
                  <span>{lang === "vi" ? "Số tiền mỗi kỳ" : lang === "zh" ? "每期金额" : "Amount per period"}:</span>
                  <b>{format(expense.amount, currency)}</b>
                </div>
                <div className="fb-fixed-compact-meta">
                  <span>{expense.recurrence === "monthly" ? `${repeatMonths}: ${expense.intervalMonths || 1}` : t[expense.recurrence]}</span>
                  <span><CalendarDays size={12} />{due.length > 0 ? `${t.dueThisPeriod}: ${due.map(formatDate).join(" · ")}` : `${t.firstDue}: ${formatDate(expense.dueDate)}`}</span>
                </div>
              </div>
              {unpaid.length > 0 && <p className="fb-fixed-unpaid-summary">
                {lang === "vi" ? `${unpaid.length} kỳ chưa ghi nhận đã trả đến ${formatDate(unpaidHorizon)}` : lang === "zh" ? `截至${formatDate(unpaidHorizon)}有${unpaid.length}期尚未记录付款` : `${unpaid.length} unpaid periods through ${formatDate(unpaidHorizon)}`}
                {` · ${unpaid.slice(0, 3).map(formatDate).join(" / ")}${unpaid.length > 3 ? " …" : ""} · ${format(expense.amount * unpaid.length, currency)}`}
              </p>}
              <div className="fb-planning-card-actions">
                <button type="button" onClick={() => setDetailsExpense(expense)}>{t.details}</button>
                <button type="button" disabled={!!expense.budgetId && !parent} onClick={() => open("fixed", parent?.id, expense)}>{t.edit}</button>
                <button type="button" onClick={() => updateState((current) => ({ ...current, fixedExpenses: (current.fixedExpenses || []).map((item) => item.id === expense.id ? { ...item, active: !item.active } : item) }))}>{expense.active ? t.pause : t.resume}</button>
              </div>
            </article>;
          })}
        </div>
        {sortedFixed.length > visibleFixedCount && (
          <div className="fb-load-more-wrap">
            <button
              type="button"
              className="fb-load-more-btn"
              onClick={() => setVisibleFixedCount((prev) => prev + 5)}
            >
              {lang === "vi"
                ? `Xem thêm (${sortedFixed.length - visibleFixedCount} khoản cố định)`
                : lang === "zh"
                ? `查看更多 (${sortedFixed.length - visibleFixedCount})`
                : `Show more (${sortedFixed.length - visibleFixedCount})`}
            </button>
          </div>
        )}
      </section>}

    </section>
      {state.goals.some((item) => item.kind === "savings") && <details className="fb-planning-legacy"><summary>{t.oldSavings}</summary><ul>{state.goals.filter((item) => item.kind === "savings").map((item) => <li key={item.id}>{item.title} · {format(item.saved, item.currency)} / {format(item.amount, item.currency)}</li>)}</ul></details>}
    {form && <Modal title={form === "budget" ? (editingId ? t.edit + " · " + t.budget : t.addBudget) : editingId ? t.edit + " · " + t.fixed : t.addFixed} onClose={() => { if (!saveLock.current) setForm(""); }}><form className="r-form fb-planning-form" onSubmit={save}>
      {form === "fixed" && <><label>{t.parent}<select value={parentId} onChange={(event) => selectParent(event.target.value)}><option value="">{unassigned}</option>{budgets.filter((item) => activeWallets.some((wallet) => wallet.id === item.wallet && wallet.currency === item.currency)).map((item) => <option key={item.id} value={item.id}>{item.title} · {item.currency}</option>)}</select></label>{selectedParent && <p className="fb-planning-note">{t.parentContext} {walletName(selectedParent.wallet)} · {selectedParent.currency}</p>}</>}
      <label>{t.name}<input aria-label={t.name} placeholder={form === "budget" ? t.budgetPlaceholder : t.fixedPlaceholder} required maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      {(form === "budget" || !selectedParent) && <label>{t.wallet}<select value={walletId} required onChange={(event) => { setWalletId(event.target.value); setCategory(""); setAmount(""); }}>{activeWallets.map((item) => <option key={item.id} value={item.id}>{walletName(item.id)} · {item.currency}</option>)}</select></label>}
      <label>{t.amount} · {form === "fixed" && selectedParent ? selectedParent.currency : selectedWallet?.currency}<input aria-label={t.amount} type="text" inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} onBlur={() => setAmount(formatCurrencyInput(amount))} /></label>
      {form === "fixed" && <><label>{repeatMonths}<input type="number" min={1} max={12} step={1} value={intervalMonths} onChange={event => setIntervalMonths(Number(event.target.value))} /></label><label>{reminderLabel}<input type="number" min={0} max={30} step={1} value={reminderDays} onChange={event => setReminderDays(Number(event.target.value))} /></label><label>{SETUP_COPY[lang].monthPosition}<select value={monthPosition} onChange={event => setMonthPosition(event.target.value as typeof monthPosition)}>{(["start", "end", "date"] as const).map((p, i) => <option key={p} value={p}>{SETUP_COPY[lang].positions[i]}</option>)}</select></label></>}
      <label>{t.category}<select aria-label={t.category} value={form === "fixed" && selectedParent?.category ? selectedParent.category : category} disabled={form === "fixed" && !!selectedParent?.category} required={form === "fixed"} onChange={(event) => setCategory(event.target.value)}><option value="">{form === "budget" ? t.allCategories : t.chooseCategory}</option>{Array.from(new Set([...expenseCategories, ...(selectedParent?.category ? [selectedParent.category] : [])])).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      {!(form === "fixed" && selectedParent?.category) && <div className="fb-budget-new-category"><button type="button" onClick={() => setAddingCategory(!addingCategory)}><Plus size={15}/>{categoryCopy.add}</button>{addingCategory && <div><label>{categoryCopy.name}<input aria-label={categoryCopy.name} value={newCategory} maxLength={80} onChange={e => setNewCategory(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); createBudgetCategory(); } }}/></label><button type="button" onClick={createBudgetCategory}>{categoryCopy.save}</button><small>{categoryCopy.hint}</small>{categoryError && <p role="alert">{categoryError}</p>}</div>}</div>}
      {form === "budget" ? <><label>{t.start}<input type="date" required value={startDate} onInput={(event) => setStartDate(event.currentTarget.value)} /></label><label>{t.cycle}<select value={cycle} onChange={(event) => setCycle(event.target.value)}>{(["weekly", "monthly", "yearly"] as const).map((item) => <option value={item} key={item}>{t[item]}</option>)}</select></label></> : <><label>{t.due}<input type="date" required min={selectedParent?.date} value={dueDate} onInput={(event) => setDueDate(event.currentTarget.value)} /></label><label>{t.recurrence}<select value={recurrence} onChange={(event) => setRecurrence(event.target.value as FixedExpense["recurrence"])}>{(["once", "weekly", "monthly", "yearly"] as const).map((item) => <option value={item} key={item}>{t[item]}</option>)}</select></label></>}
      <p className="fb-planning-note">{t.noPayment}</p>{error && <p role="alert" className="fb-planning-warning">{error}</p>}<div className="fb-modal-actions"><button type="button" className="r-secondary" disabled={saving} onClick={() => setForm("")}>{t.cancel}</button><button type="submit" className="r-primary" disabled={saving}>{t.save}</button></div>
    </form></Modal>}
    {detailsBudget && (() => {
      const summary = budgetSummary(state, detailsBudget, today);
      const walletArchived = !!state.wallets.find((item) => item.id === detailsBudget.wallet)?.archived;
      const status = !summary.matchingCurrency || walletArchived ? "needs-review" : summary.actual > detailsBudget.amount ? "over" : summary.afterCommitments < 0 ? "planned-over" : summary.actual >= detailsBudget.amount * 0.8 ? "near" : "on-track";
      const statusLabel = lang === "vi" ? (status === "over" ? "Đã vượt hạn mức" : status === "planned-over" ? "Kế hoạch vượt" : status === "near" ? "Sắp chạm hạn mức" : status === "needs-review" ? "Cần kiểm tra" : "Trong hạn mức") : lang === "zh" ? (status === "over" ? "已超出预算" : status === "planned-over" ? "未付账单超出剩余额度" : status === "near" ? "接近限额" : status === "needs-review" ? "需要检查" : "限额内") : (status === "over" ? "Over budget" : status === "planned-over" ? "Plan exceeds limit" : status === "near" ? "Near limit" : status === "needs-review" ? "Review needed" : "On track");
      return (
        <Modal title={`${detailsBudget.title} · ${t.budgetDetails}`} onClose={() => setDetailsBudget(null)}>
          <div className="fb-details-modal-content">
            <div className="fb-details-modal-header">
              <div className="fb-details-modal-badges">
                <span className={`fb-budget-status is-${status}`}>{statusLabel}</span>
                <span className="fb-badge fb-badge-currency">{detailsBudget.currency}</span>
                <span className="fb-badge fb-badge-type">{walletName(detailsBudget.wallet)}</span>
                <span className="fb-badge">{detailsBudget.category || t.allCategories}</span>
              </div>
              <p className="fb-planning-period"><CalendarDays size={14} />{formatDate(summary.start)} – {formatDate(summary.end)}</p>
            </div>

            <div className="fb-budget-meter-wrap">
              <div className="fb-budget-limit"><span>{t.limit}</span><b>{format(detailsBudget.amount, detailsBudget.currency)}</b></div>
              <progress aria-label={t.actual} value={Math.max(0, Math.min(summary.actual, detailsBudget.amount))} max={detailsBudget.amount} />
              <div className="fb-budget-percent-row">
                <span>{Math.round(Math.min(100, Math.max(0, detailsBudget.amount > 0 ? (summary.actual / detailsBudget.amount) * 100 : 0)))}% {lang === "vi" ? "đã sử dụng" : lang === "zh" ? "已使用" : "used"}</span>
                <span>{format(summary.remaining, detailsBudget.currency)} {lang === "vi" ? "còn lại" : lang === "zh" ? "剩余" : "left"}</span>
              </div>
            </div>

            <div className="fb-details-stats-grid">
              <div className="fb-stat-tile"><dt>{t.actual}</dt><dd>{format(summary.actual, detailsBudget.currency)}</dd></div>
              <div className="fb-stat-tile"><dt>{t.remaining}</dt><dd className="is-remaining">{format(summary.remaining, detailsBudget.currency)}</dd></div>
              <div className="fb-stat-tile"><dt>{t.planned}</dt><dd>{format(summary.unpaidPlanned, detailsBudget.currency)}</dd></div>
              <div className="fb-stat-tile"><dt>{t.flexible}</dt><dd>{format(summary.afterCommitments, detailsBudget.currency)}</dd></div>
            </div>

            {(!summary.matchingCurrency || walletArchived) && <p className="fb-planning-warning">{t.mismatch}</p>}
            {summary.actual > detailsBudget.amount && <p className="fb-planning-warning">{t.overActual}</p>}
            {summary.actual >= detailsBudget.amount * 0.8 && summary.actual <= detailsBudget.amount && <p className="fb-planning-warning">{t.nearLimit}</p>}
            {summary.afterCommitments < 0 && <p className="fb-planning-warning">{t.overPlanned}</p>}

            <div className="fb-details-formula-box">
              <p className="fb-planning-note">{t.noDouble}</p>
            </div>

            {summary.children.length > 0 && (
              <div className="fb-details-allocations-section">
                <h4>{t.allocations} ({summary.children.length})</h4>
                <div className="fb-details-children-list">
                  {summary.children.map(child => (
                    <div key={child.id} className="fb-details-child-row">
                      <div>
                        <b>{child.title}</b>
                        <small>{child.category} · {child.dueDate}</small>
                      </div>
                      <strong>{format(child.amount, detailsBudget.currency)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="fb-details-modal-actions">
              <button type="button" className="fb-planning-history" onClick={() => { setDetailsBudget(null); navigate("?tab=transactions&wallet=" + encodeURIComponent(detailsBudget.wallet) + "&type=expense&from=" + summary.start + "&to=" + summary.end + (detailsBudget.category ? "&category=" + encodeURIComponent(detailsBudget.category) : "")); }}>
                {t.viewHistory}
                <ArrowRight size={14} />
              </button>
              <button type="button" className="r-secondary" onClick={() => setDetailsBudget(null)}>{t.close}</button>
            </div>
          </div>
        </Modal>
      );
    })()}

    {detailsExpense && (() => {
      const parent = budgets.find((item) => item.id === detailsExpense.budgetId);
      const window = parent ? budgetSummary(state, parent, today) : undefined;
      const due = window ? plannedOccurrences(detailsExpense, window.start, window.end) : [];
      const currency = parent?.currency || state.wallets.find((wallet) => wallet.id === detailsExpense.walletId)?.currency || "";
      return (
        <Modal title={`${detailsExpense.title} · ${t.fixedDetails}`} onClose={() => setDetailsExpense(null)}>
          <div className="fb-details-modal-content">
            <div className="fb-details-modal-header">
              <div className="fb-details-modal-badges">
                <span className={`fb-status-pill ${detailsExpense.active ? "is-active" : ""}`}>{detailsExpense.active ? t.active : t.paused}</span>
                <span className="fb-badge fb-badge-currency">{currency}</span>
                <span className="fb-badge fb-badge-type">{walletName(parent?.wallet || detailsExpense.walletId || "")}</span>
                <span className="fb-badge">{parent ? parent.category : detailsExpense.category}</span>
              </div>
            </div>

            <div className="fb-fixed-amount-strip">
              <div className="fb-fixed-amount-main">
                <span className="fb-fixed-amount-label">{t.amount}</span>
                <b>{format(detailsExpense.amount, currency)}</b>
              </div>
            </div>

            <div className="fb-details-stats-grid">
              <div className="fb-stat-tile"><dt>{t.parent}</dt><dd>{parent ? parent.title : (detailsExpense.budgetId ? t.noParent : unassigned)}</dd></div>
              <div className="fb-stat-tile"><dt>{t.recurrence}</dt><dd>{detailsExpense.recurrence === "monthly" ? `${repeatMonths}: ${detailsExpense.intervalMonths || 1}` : t[detailsExpense.recurrence]}</dd></div>
              <div className="fb-stat-tile"><dt>{reminderLabel}</dt><dd>{detailsExpense.reminderDays ?? 3} {lang === "vi" ? "ngày" : lang === "zh" ? "天" : "days"}</dd></div>
              <div className="fb-stat-tile"><dt>{t.firstDue}</dt><dd>{formatDate(detailsExpense.dueDate)}</dd></div>
            </div>

            {due.length > 0 && (
              <div className="fb-details-allocations-section">
                <h4>{t.dueThisPeriod}</h4>
                <div className="fb-details-dates-list">
                  {due.map(d => (
                    <span key={d} className="fb-card-tag"><CalendarDays size={12}/>{formatDate(d)}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="fb-details-payment-section">
              <FixedExpenseActions expense={detailsExpense} lang={lang} navigate={navigate} />
            </div>

            <p className="fb-planning-note">{t.noPayment}</p>

            <div className="fb-details-modal-actions">
              <button type="button" className="r-secondary" onClick={() => setDetailsExpense(null)}>{t.close}</button>
            </div>
          </div>
        </Modal>
      );
    })()}

    {calendarLedgerOpen && (
      <CalendarLedgerModal
        onClose={() => setCalendarLedgerOpen(false)}
        navigate={navigate}
      />
    )}
  </main>;
}
