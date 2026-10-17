"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDownRight, ArrowRight, CalendarDays, Check, ChevronDown, ChevronLeft, Plus, ReceiptText, Wallet, Sparkles, Send, Trash2, RotateCcw, TrendingUp } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { FinBridgeHeader } from "./FinBridgeHeader";
import { CalendarLedgerModal } from "./CalendarLedgerModal";
import { SETUP_COPY } from "@/lib/setup-copy";
import { Modal, FinBridgeDropdown } from "./Ui";
import { localDateKey } from "./chartWeek";
import { budgetSummary, currencyScale, plannedOccurrences, validBudget, validFixedExpense } from "./planningModel";
import { flushWorkspace, updateState, useAppState, workspaceOwner, workspacePersistence, getWorkspaceState, type FixedExpense, type Goal } from "./store";
import { calculateScenario, scenarioContext, type FinancialScenario } from "@/lib/scenario-planner";
import { SAFETY_COPY } from "@/components/safety/safety-copy";
import { addBudgetCategory, expenseCategoriesForWallet } from "@/lib/budget-categories";
import { nextExpenseDue } from "@/lib/fixed-expense-payments";
import { FixedExpenseActions } from "@/components/payments/FixedExpenseActions";
import { budgetWindow, weeklyPeriodStatus, weeklySpendingRows } from "./planningModel";
import { type ScenarioChange } from "@/lib/scenario-planner";

type PlannerWalletChoice = { id: string; name: string; currency: string };
type PlannerMessage = { role: "user" | "assistant"; text: string; scenarios?: FinancialScenario[]; clarification?: string | null; walletChoices?: PlannerWalletChoice[]; pendingScenario?: string; selectedWalletId?: string; sandboxChanges?: ScenarioChange[]; excludedTransactionIds?: string[]; pendingSandboxChanges?: ScenarioChange[]; pendingExcludedTransactionIds?: string[] };

function persistPlannerMessages(storageKey: string, messages: PlannerMessage[]) {
  if (workspacePersistence() === "database") {
    const planningChat = messages.slice(-100);
    if (JSON.stringify(getWorkspaceState().planningChat || []) !== JSON.stringify(planningChat)) updateState(current => ({ ...current, planningChat }));
    return;
  }
  try {
    if (messages.length) localStorage.setItem(storageKey, JSON.stringify(messages.slice(-100)));
    else localStorage.removeItem(storageKey);
  } catch { /* Storage may be disabled or full. */ }
}

function canCalculateScenario(scenario: FinancialScenario, state: ReturnType<typeof useAppState>) {
  const hasInputs = scenario.changes.length + (scenario.spendingReductions?.length || 0) + (scenario.dailySpendingLimits?.length || 0) > 0 || scenario.estimateSpending;
  const changesValid = scenario.changes.every((change) => !!change.walletId && !!change.amount && !!change.date && !!change.currency && state.wallets.some((wallet) => wallet.id === change.walletId && wallet.currency === change.currency));
  const reductionsValid = (scenario.spendingReductions || []).every((reduction) => !!reduction.walletId && !!reduction.category && !!reduction.startDate && !!reduction.endDate && !!reduction.currency && state.wallets.some((wallet) => wallet.id === reduction.walletId && wallet.currency === reduction.currency));
  const dailyLimitsValid = (scenario.dailySpendingLimits || []).every((limit) => Number.isFinite(limit.amount) && limit.amount !== null && limit.amount > 0 && !!limit.walletId && !!limit.startDate && !!limit.endDate && limit.startDate <= limit.endDate && !!limit.currency && state.wallets.some((wallet) => wallet.id === limit.walletId && wallet.currency === limit.currency));
  return hasInputs && changesValid && reductionsValid && dailyLimitsValid;
}

function localizeScenarioDetail(text: string, lang: "vi" | "en" | "zh") {
  if (lang === "en") return text;
  if (text.startsWith("Each wallet is projected")) return lang === "vi" ? "Mỗi ví được dự báo riêng theo tiền tệ của ví; không tự quy đổi ngoại tệ." : "每个钱包按自身币种单独预测，不进行汇率换算。";
  if (text.startsWith("Projected balances do not include")) return lang === "vi" ? "Số dư dự báo chưa tính các khoản chi tương lai chưa được ghi nhận ngoài kịch bản này." : "预测余额不包含情景以外、尚未记录的未来支出。";
  if (text.startsWith("Active fixed expenses due")) return lang === "vi" ? "Các khoản cố định đang áp dụng và đến hạn trong kỳ đã được trừ khỏi số dư dự báo; đây vẫn là kế hoạch, chưa phải giao dịch." : "已从预测余额中扣除本期到期的固定支出计划；它们仍是计划，并非已记录交易。";
  if (text.startsWith("Flexible spending uses this month's")) return lang === "vi" ? "Chi linh hoạt được ước tính theo tốc độ chi từ đầu tháng; nếu chưa có dữ liệu tháng này thì dùng trung bình ba tháng hoàn tất gần nhất. Danh mục có khoản cố định được loại khỏi tốc độ để tránh tính trùng." : "灵活支出按本月日均速度估算；若本月暂无记录，则参考最近三个完整月份。固定支出类别会从速度估算中排除，以避免重复计算。";
  if (text.startsWith("Historical projections use")) return lang === "vi" ? "Dự báo lịch sử dùng ba tháng hoàn tất gần nhất; chi tiêu thực tế có thể khác." : "历史预测使用最近三个完整月份，实际支出可能不同。";
  if (text.startsWith("A budget has no recorded flexible spending this month")) return lang === "vi" ? "Ngân sách này chưa có chi linh hoạt trong tháng để tính tốc độ; dự báo chỉ gồm chi đã ghi nhận và khoản cố định sắp đến hạn." : "本月没有灵活支出记录可用于估算速度；预测仅包含已记录支出和即将到期的固定支出。";
  if (text.startsWith("There is not enough current-month or prior-month expense history")) return lang === "vi" ? "Ví này chưa có đủ lịch sử chi tiêu để tính nhịp; dự báo chỉ gồm số dư, khoản trong kịch bản và chi phí cố định đã lên kế hoạch." : "此钱包的支出记录不足以估算速度；预测仅包含余额、情景支出和已计划的固定费用。";
  if (text.startsWith("Not enough history to estimate savings for ")) return lang === "vi" ? "Chưa đủ dữ liệu ở các tháng trước để ước tính khoản tiết kiệm cho danh mục này." : "过往记录不足，无法估算此类别的节省金额。";
  if (text.startsWith("A spending reduction needs")) return lang === "vi" ? "Để mô phỏng giảm chi, cần có danh mục, ví, tiền tệ, tỷ lệ và thời gian hợp lệ." : "模拟减少支出需要有效的类别、钱包、币种、比例和日期范围。";
  if (text.startsWith("Review the amount or timing")) return lang === "vi" ? "Cân nhắc giảm số tiền hoặc dời thời điểm chi; chỉ so sánh các ví cùng tiền tệ." : "可以降低金额或延后支出时间；只比较币种相同的钱包。";
  if (text.startsWith("This scenario exceeds a budget limit")) return lang === "vi" ? "Kịch bản có thể vượt hạn mức; hãy giảm chi hoặc điều chỉnh kế hoạch." : "此情景可能超出预算，请减少支出或调整计划。";
  return text;
}

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
  const budgets = state.goals.filter((item) => item.kind === "budget");
  const fixed = state.fixedExpenses || [];
  const activeWallets = state.wallets.filter((item) => !item.archived);
  const [calendarLedgerOpen, setCalendarLedgerOpen] = useState(false);
  const [tab, setTab] = useState(initialTab);
  const [activeTab, setActiveTab] = useState<"manage" | "analysis" | "simulator">("manage");
  const [walletFilter, setWalletFilter] = useState("all");
  const [parentFilter, setParentFilter] = useState(params.get("budget") || "all");
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
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
    try { await flushWorkspace(); setForm(""); setTab(nextTab); setActiveTab("manage"); }
    catch { setError(lang === "vi" ? "Chưa lưu được lên máy chủ. Hãy thử lưu lại; dữ liệu đang chờ sẽ không bị tạo trùng." : lang === "zh" ? "尚未保存到服务器。请重试，待保存内容不会重复创建。" : "Not saved to the server yet. Retry saving; pending changes will not be duplicated."); }
    finally { saveLock.current = false; setSaving(false); }
  };
  const [plannerInput, setPlannerInput] = useState("");
  const [plannerMessages, setPlannerMessages] = useState<PlannerMessage[]>([]);
  const [plannerReadyKey, setPlannerReadyKey] = useState("");
  const [plannerLoading, setPlannerLoading] = useState(false);
  const plannerBusy = useRef(false);
  const [sandboxExcludedIds, setSandboxExcludedIds] = useState<string[]>([]);
  const [sandboxChanges, setSandboxChanges] = useState<ScenarioChange[]>([]);
  const [sandboxTitle, setSandboxTitle] = useState("");
  const [sandboxAmount, setSandboxAmount] = useState("");
  const [sandboxDate, setSandboxDate] = useState(today);
  const [sandboxDirection, setSandboxDirection] = useState<"income" | "expense">("expense");
  const [sandboxWalletId, setSandboxWalletId] = useState(activeWallets[0]?.id || "");
  const [sandboxCategory, setSandboxCategory] = useState("");
  const [visibleBudgetCount, setVisibleBudgetCount] = useState(5);
  const [visibleFixedCount, setVisibleFixedCount] = useState(5);
  const plannerStorageKey = `finbridge-scenario-planner:${workspaceOwner() || "guest"}:v1`;
  useEffect(() => { setTab(initialTab); setActiveTab("manage"); }, [initialTab, initialForm]);
  useEffect(() => {
    let timer = 0;
    const scrollToTarget = () => {
      let targetId = "";
      try { targetId = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      if (!targetId) return;
      setActiveTab("manage");
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
  useEffect(() => {
    try {
      const saved = workspacePersistence() === "database" ? JSON.stringify(state.planningChat || []) : localStorage.getItem(plannerStorageKey);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const safeMessages = parsed.filter((item): item is PlannerMessage => !!item && typeof item === "object" && ((item as PlannerMessage).role === "user" || (item as PlannerMessage).role === "assistant") && typeof (item as PlannerMessage).text === "string").slice(-100);
          setPlannerMessages(safeMessages);
        }
      }
    } catch { /* Ignore invalid or unavailable browser storage. */ }
    setPlannerReadyKey(plannerStorageKey);
  }, [plannerStorageKey]);
  useEffect(() => {
    if (plannerReadyKey !== plannerStorageKey) return;
    persistPlannerMessages(plannerStorageKey, plannerMessages);
  }, [plannerMessages, plannerReadyKey, plannerStorageKey]);
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
  const format = (value: number, currency: string) => new Intl.NumberFormat(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-GB", { maximumFractionDigits: 2 }).format(value) + " " + currency;
  const formatDate = (key: string) => new Intl.DateTimeFormat(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-GB", { dateStyle: "medium" }).format(new Date(key + "T12:00:00"));
  const formatMoney = (amount: number, currency: string) => format(amount, currency);
  const sendToPlanner = async (message: string, selectedWalletId: string | null, priorMessages: PlannerMessage[], nextHistory: PlannerMessage[], changesForTurn: ScenarioChange[] = sandboxChanges, excludedIdsForTurn: string[] = sandboxExcludedIds) => {
    if (plannerBusy.current || plannerReadyKey !== plannerStorageKey) return;
    plannerBusy.current = true; setPlannerLoading(true); setError("");
    setPlannerMessages(nextHistory);
    persistPlannerMessages(plannerStorageKey, nextHistory);
    const history = priorMessages.slice(-8).map((item) => {
      const scenarioSummary = item.scenarios?.length ? JSON.stringify(item.scenarios.map((scenario) => ({ name: scenario.name, changes: scenario.changes, spendingReductions: scenario.spendingReductions || [], dailySpendingLimits: scenario.dailySpendingLimits || [], horizonEnd: scenario.horizonEnd, estimateSpending: scenario.estimateSpending, sandboxChanges: item.sandboxChanges || [], excludedTransactionIds: item.excludedTransactionIds || [] }))) : "";
      const text = scenarioSummary ? `${item.text.slice(0, 420)} Previous scenario details: ${scenarioSummary.slice(0, 700)}`.slice(0, 1200) : item.text.slice(0, 1200);
      return { role: item.role, text };
    });
    try {
      const simulationState = excludedIdsForTurn.length ? { ...state, transactions: state.transactions.filter((transaction) => !excludedIdsForTurn.includes(transaction.id)) } : state;
      const response = await fetch("/api/ai/scenario-planner", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, selectedWalletId, preferredLanguage: lang, today, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          history,
          context: scenarioContext(simulationState, today, selectedWalletId) }),
      });
      const data = await response.json() as { reply?: string; clarification?: string | null; scenarios?: FinancialScenario[]; message?: string };
      if (!response.ok) throw new Error(data.message || (lang === "vi" ? "Không thể phân tích kịch bản lúc này." : "Could not analyze this scenario right now."));
      const completedHistory = nextHistory.map((item) => item.pendingScenario ? { ...item, walletChoices: undefined, pendingScenario: undefined, sandboxChanges: item.pendingSandboxChanges || item.sandboxChanges, excludedTransactionIds: item.pendingExcludedTransactionIds || item.excludedTransactionIds, pendingSandboxChanges: undefined, pendingExcludedTransactionIds: undefined } : item);
      const completedMessages = [...completedHistory, { role: "assistant" as const, text: data.reply || "", scenarios: data.scenarios || [], clarification: data.clarification, selectedWalletId: selectedWalletId || undefined, sandboxChanges: changesForTurn, excludedTransactionIds: excludedIdsForTurn }];
      setPlannerMessages(completedMessages);
      persistPlannerMessages(plannerStorageKey, completedMessages);
      setPlannerInput("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (lang === "vi" ? "Không thể kết nối với FinBridge AI." : "Could not reach FinBridge AI."));
    } finally {
      plannerBusy.current = false; setPlannerLoading(false);
    }
  };
  const submitScenario = (event: FormEvent) => {
    event.preventDefault();
    const message = plannerInput.trim();
    if (!message || plannerBusy.current || plannerReadyKey !== plannerStorageKey) return;
    const walletMentions = activeWallets.filter((wallet) => wallet.name !== "."
      ? message.toLocaleLowerCase().includes(wallet.name.toLocaleLowerCase())
      : message.toLocaleLowerCase().includes(t.mainWallet.toLocaleLowerCase()));
    const asksToCompareWallets = /so sánh|so sanh|cái nào|cai nao|khác nhau|compare|versus|\bvs\b/i.test(message);
    const previousWalletId = [...plannerMessages].reverse().find((item) => item.selectedWalletId)?.selectedWalletId;
    const selectedWalletId = walletMentions.length > 1 && asksToCompareWallets ? null : walletMentions[0]?.id || (activeWallets.length === 1 ? activeWallets[0].id : previousWalletId || null);
    const nextHistory = [...plannerMessages, { role: "user" as const, text: message, sandboxChanges: [...sandboxChanges], excludedTransactionIds: [...sandboxExcludedIds] }];
    if (!selectedWalletId && activeWallets.length > 1 && !(walletMentions.length > 1 && asksToCompareWallets)) {
      const choices = activeWallets.map(({ id, name, currency }) => ({ id, name: name === "." ? t.mainWallet : name, currency }));
      nextHistory.push({ role: "assistant", text: lang === "vi" ? "Bạn muốn mô phỏng bằng ví nào? Mình sẽ dùng số dư, giao dịch và tiền tệ của ví đó." : lang === "zh" ? "你想使用哪个钱包进行模拟？我会根据该钱包的余额、交易和币种计算。" : "Which wallet should I use? I’ll base the result on that wallet’s balance, transactions and currency.", walletChoices: choices, pendingScenario: message, pendingSandboxChanges: [...sandboxChanges], pendingExcludedTransactionIds: [...sandboxExcludedIds] });
      setPlannerMessages(nextHistory);
      setPlannerInput("");
      return;
    }
    void sendToPlanner(message, selectedWalletId, plannerMessages, nextHistory);
  };
  const choosePlannerWallet = (messageIndex: number, walletId: string) => {
    const prompt = plannerMessages[messageIndex];
    if (!prompt?.pendingScenario || plannerBusy.current) return;
    const wallet = activeWallets.find((item) => item.id === walletId);
    if (!wallet) return;
    const priorMessages = plannerMessages.slice(0, Math.max(0, messageIndex - 1));
    const nextHistory: PlannerMessage[] = [...plannerMessages, { role: "user", text: lang === "vi" ? `Chọn ví ${wallet.name === "." ? t.mainWallet : wallet.name} · ${wallet.currency}` : `Use ${wallet.name === "." ? t.mainWallet : wallet.name} · ${wallet.currency}` }];
    void sendToPlanner(prompt.pendingScenario, walletId, priorMessages, nextHistory, prompt.pendingSandboxChanges || [], prompt.pendingExcludedTransactionIds || []);
  };
  const open = (type: "budget" | "fixed", parent?: string, expense?: FixedExpense, targetBudget?: Goal) => {
    setAddingCategory(false); setNewCategory(""); setCategoryError("");
    setError("");
    if (type === "budget" && targetBudget) {
      setEditingId(targetBudget.id);
      setTitle(targetBudget.title);
      setAmount(String(targetBudget.amount));
      setWalletId(targetBudget.wallet);
      setStartDate(targetBudget.date);
      setCycle(targetBudget.cycle);
      setCategory(targetBudget.category || "");
      setForm(type);
      return;
    }
    setEditingId(expense?.id || ""); setTitle(expense?.title || ""); setAmount(expense ? String(expense.amount) : "");
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
      if (!selectedWallet || !title.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || !startDate || !["monthly", "weekly", "yearly"].includes(cycle)) { setError(t.invalid); return; }
      const numericAmount = Number(amount);
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
    const expense: FixedExpense = { ...fixed.find(item => item.id === editingId), id: editingId || crypto.randomUUID(), budgetId: parentId, walletId: selectedParent?.wallet || walletId, title: title.trim(), amount: Number(amount), category: selectedParent?.category || category, dueDate: plannedDue, recurrence, intervalMonths, reminderDays, monthPosition, active: editingId ? fixed.find((item) => item.id === editingId)?.active ?? true : true };
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
  const resetPlanner = () => {
    if (!window.confirm(t.resetChatConfirm)) return;
    setPlannerMessages([]);
    setPlannerInput("");
    setError("");
  };
  const filteredBudgets = budgets.filter((item) => walletFilter === "all" || item.wallet === walletFilter);
  const filteredFixed = fixed.filter((item) => { const parent = budgets.find((budget) => budget.id === item.budgetId); return (parentFilter === "all" || item.budgetId === parentFilter) && (walletFilter === "all" || (parent?.wallet || item.walletId) === walletFilter); });
  const monthStart = `${selectedMonth}-01`;
  const monthEnd = (() => { const [year, month] = selectedMonth.split("-").map(Number); return `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`; })();
  const actualEnd = monthEnd < today ? monthEnd : today;
  const actualThrough = actualEnd < monthStart ? "" : actualEnd;
  const monthLabel = new Intl.DateTimeFormat(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-GB", { month: "long", year: "numeric" }).format(new Date(`${monthStart}T12:00:00`));
  const monthExpenseCandidates = state.transactions.filter((transaction) => transaction.type === "expense" && transaction.amount > 0 && Number.isFinite(transaction.amount) && /^\d{4}-\d{2}-\d{2}$/.test(transaction.date) && transaction.date >= monthStart && transaction.date <= actualEnd && (walletFilter === "all" || transaction.wallet === walletFilter));
  const transactionCurrency = (walletId: string) => state.wallets.find((wallet) => wallet.id === walletId)?.currency || "";
  const unmappedExpenseCount = monthExpenseCandidates.filter((transaction) => !transactionCurrency(transaction.wallet).trim()).length;
  const selectedTransactions = monthExpenseCandidates.filter((transaction) => !!transactionCurrency(transaction.wallet).trim());
  const periodBudgetEntries = (() => {
    const entries = new Map<string, { budget: Goal; window: { start: string; end: string } }>();
    const [year, month] = selectedMonth.split("-").map(Number);
    for (let day = 1; day <= new Date(year, month, 0).getDate(); day++) {
      const date = `${selectedMonth}-${String(day).padStart(2, "0")}`;
      filteredBudgets.forEach((budget) => {
        const window = budgetWindow(budget, date);
        if (window.start > monthEnd || window.end < monthStart) return;
        entries.set(`${budget.id}:${window.start}:${window.end}`, { budget, window });
      });
    }
    return [...entries.values()];
  })();
  const actualState = { ...state, transactions: state.transactions.filter((transaction) => transaction.date.slice(0, 10) <= actualEnd) };
  const periodBudgetSummaries = periodBudgetEntries.map(({ budget, window }) => ({ budget, window, summary: budgetSummary(actualState, budget, window.end) }));
  const nextDueDate = (expense: FixedExpense) => expense.active ? nextExpenseDue(state, expense, today) || "9999-12-31" : "9999-12-31";
  const sortedFixed = [...filteredFixed].sort((a, b) => nextDueDate(a).localeCompare(nextDueDate(b)));
  const chartColors = ["#17a398", "#5596d1", "#9167d9", "#e49b45", "#d56b6b", "#6f8798"];
  const chartTransactions = selectedTransactions.filter((item) => !!transactionCurrency(item.wallet));
  const analyticsWallets = state.wallets.filter((wallet) => chartTransactions.some((item) => item.wallet === wallet.id)
    || periodBudgetSummaries.some(({ budget }) => budget.wallet === wallet.id && budget.currency === wallet.currency && !!budget.category?.trim()));
  const categoryGroups = analyticsWallets.map((wallet) => {
    const currency = wallet.currency;
    const transactions = chartTransactions.filter((item) => item.wallet === wallet.id);
    const categoryTotals = new Map<string, number>();
    transactions.forEach((item) => {
      const name = item.category?.trim() || "";
      categoryTotals.set(name, (categoryTotals.get(name) || 0) + item.amount);
    });
    // Include budgeted categories with zero actual spending so their progress is still visible.
    periodBudgetSummaries.filter(({ budget }) => budget.wallet === wallet.id && budget.currency === currency && !!budget.category?.trim())
      .forEach(({ budget }) => { const categoryName = budget.category.trim(); if (!categoryTotals.has(categoryName)) categoryTotals.set(categoryName, 0); });
    const categories = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]);
    const total = categories.reduce((sum, [, amount]) => sum + amount, 0);
    const categoryRows = categories.map(([categoryName, amount]) => {
      const uncategorized = !categoryName;
      const name = categoryName || (lang === "vi" ? "Chưa phân loại" : lang === "zh" ? "未分类" : "Uncategorized");
      const matchingBudgets = uncategorized ? [] : periodBudgetSummaries.filter(({ budget }) => budget.wallet === wallet.id && budget.currency === currency && budget.category.trim() === name);
      const cycles = new Set(matchingBudgets.map(({ budget }) => budget.cycle));
      const budgetIds = new Set(matchingBudgets.map((entry) => entry.budget.id));
      const limit = matchingBudgets.length && budgetIds.size === 1 && cycles.size === 1 ? matchingBudgets.reduce((sum, entry) => sum + entry.budget.amount, 0) : null;
      return { name, amount, percentage: total ? amount / total * 100 : 0, limit };
    });
    return { walletId: wallet.id, currency, transactions, categories: categoryRows, total };
  }).filter((group) => group.categories.length > 0);
  const weeklyRows = weeklySpendingRows(state, filteredBudgets, selectedMonth, actualEnd, walletFilter);
  const weeklyChartGroups = state.wallets.filter((wallet) => weeklyRows.some((row) => row.walletId === wallet.id && row.total > 0)).map((wallet) => ({
    wallet,
    rows: weeklyRows.filter((row) => row.walletId === wallet.id),
  }));
  const sandboxCandidates = [...selectedTransactions].sort((a, b) => b.amount - a.amount).slice(0, 5);
  const sandboxPreview = (() => {
    const deltas = new Map<string, number>();
    sandboxExcludedIds.forEach((id) => {
      const transaction = state.transactions.find((item) => item.id === id && item.type === "expense");
      if (transaction) deltas.set(transaction.wallet, (deltas.get(transaction.wallet) || 0) + transaction.amount);
    });
    sandboxChanges.forEach((change) => {
      if (!change.walletId || change.amount === null || change.date === null || change.date < today || change.date > monthEnd) return;
      const direction = change.direction === "income" ? 1 : -1;
      deltas.set(change.walletId, (deltas.get(change.walletId) || 0) + change.amount * direction);
    });
    return [...deltas.entries()].map(([walletId, delta]) => {
      const wallet = state.wallets.find((item) => item.id === walletId);
      const actualBalance = wallet ? state.transactions.reduce((sum, transaction) => transaction.wallet === walletId ? sum + (transaction.type === "income" ? transaction.amount : -transaction.amount) : transaction.type === "transfer" && transaction.targetWallet === walletId ? sum + transaction.amount : sum, wallet.initial) : 0;
      return { walletId, delta, actualBalance, projectedBalance: actualBalance + delta, currency: wallet?.currency || "" };
    });
  })();
  const addSandboxItem = (event: FormEvent) => {
    event.preventDefault();
    const wallet = activeWallets.find((item) => item.id === sandboxWalletId);
    const numericAmount = Number(sandboxAmount);
    if (!wallet || !sandboxTitle.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(sandboxDate) || sandboxDate < today) return;
    setSandboxChanges((items) => [...items, { title: sandboxTitle.trim(), amount: numericAmount, direction: sandboxDirection, walletId: wallet.id, currency: wallet.currency, date: sandboxDate, category: sandboxCategory || null }]);
    setSandboxTitle("");
    setSandboxAmount("");
  };
  const resetSandbox = () => { setSandboxExcludedIds([]); setSandboxChanges([]); };
  const setPlanningTab = (nextTab: "budget" | "fixed") => setTab(nextTab);
  const primaryForm = activeTab === "manage" && tab === "fixed" ? "fixed" : "budget";
  const renderScenarioResult = (scenario: FinancialScenario, extraChanges: ScenarioChange[] = [], excludedIds: string[] = []) => {
    const scenarioWithSandbox = extraChanges.length ? { ...scenario, changes: [...scenario.changes, ...extraChanges] } : scenario;
    const simulationState = excludedIds.length ? { ...state, transactions: state.transactions.filter((transaction) => !excludedIds.includes(transaction.id)) } : state;
    const missing = !canCalculateScenario(scenarioWithSandbox, simulationState);
    const result = missing ? null : calculateScenario(simulationState, scenarioWithSandbox, today);
    if (!result) return <section className="fb-scenario-result" key={scenario.id}><h3>{scenario.name}</h3><p className="fb-planning-warning">{lang === "vi" ? "Mình cần làm rõ ví, tiền tệ, danh mục, số tiền hoặc ngày." : "Please clarify the wallet, currency, category, amount or date."}</p></section>;

    const explicitWalletIds = new Set([...scenarioWithSandbox.changes.flatMap((change) => change.walletId ? [change.walletId] : []), ...(scenarioWithSandbox.spendingReductions || []).flatMap((reduction) => reduction.walletId ? [reduction.walletId] : []), ...(scenarioWithSandbox.dailySpendingLimits || []).flatMap((limit) => limit.walletId ? [limit.walletId] : [])]);
    const displayBudgets = result.budgets.filter((projection) => { const budget = budgets.find((item) => item.id === projection.budgetId); return !explicitWalletIds.size || (!!budget && explicitWalletIds.has(budget.wallet)); });
    const budgetWalletIds = new Set(displayBudgets.flatMap((projection) => { const budget = budgets.find((item) => item.id === projection.budgetId); return budget ? [budget.wallet] : []; }));
    const visibleWalletIds = budgetWalletIds.size ? budgetWalletIds : explicitWalletIds;
    const displayWallets = result.wallets.filter((projection) => !visibleWalletIds.size || visibleWalletIds.has(projection.walletId));
    const forecastDate = displayBudgets[0]?.forecastEnd || scenarioWithSandbox.horizonEnd || today;
    const fixedTitles = new Set(fixed.filter((expense) => { const parent = budgets.find((budget) => budget.id === expense.budgetId); return !visibleWalletIds.size || (!!parent && visibleWalletIds.has(parent.wallet)); }).map((expense) => expense.title));
    const displayBills = result.plannedBills.filter((bill) => !visibleWalletIds.size || fixedTitles.has(bill.title));
    const leadWallet = displayWallets[0];
    const leadBudgetProjection = displayBudgets[0];
    const leadBudget = leadBudgetProjection ? budgets.find((budget) => budget.id === leadBudgetProjection.budgetId) : undefined;
    const walletConclusion = leadWallet
      ? lang === "vi"
        ? `${leadWallet.projectedBalance < 0 ? "Dự kiến cuối kỳ âm" : "Dự kiến cuối kỳ còn"} ${formatMoney(Math.abs(leadWallet.projectedBalance), leadWallet.currency)} trong ví ${walletName(leadWallet.walletId)}.`
        : `${leadWallet.projectedBalance < 0 ? "Projected shortfall" : "Projected balance left"}: ${formatMoney(Math.abs(leadWallet.projectedBalance), leadWallet.currency)} in ${walletName(leadWallet.walletId)}.`
      : "";
    const budgetConclusion = leadBudgetProjection && leadBudget
      ? lang === "vi"
        ? `Ngân sách “${leadBudget.title}” ${leadBudgetProjection.projectedRemaining < 0 ? `dự kiến vượt ${formatMoney(Math.abs(leadBudgetProjection.projectedRemaining), leadBudget.currency)}` : `dự kiến còn ${formatMoney(leadBudgetProjection.projectedRemaining, leadBudget.currency)}`}.`
        : `Budget “${leadBudget.title}” ${leadBudgetProjection.projectedRemaining < 0 ? `may exceed by ${formatMoney(Math.abs(leadBudgetProjection.projectedRemaining), leadBudget.currency)}` : `may have ${formatMoney(leadBudgetProjection.projectedRemaining, leadBudget.currency)} left`}.`
      : "";

    return <section className="fb-scenario-result" key={scenario.id}>
      <h3>{scenario.name}<small className="fb-scenario-confidence">{result.confidence === "user-defined" ? (lang === "vi" ? "Theo mức bạn chọn" : lang === "zh" ? "按你设定的额度" : "User-defined limit") : result.confidence === "current-pace" ? (lang === "vi" ? "Theo nhịp tháng này" : lang === "zh" ? "按本月速度" : "Current-month pace") : result.confidence === "historical-estimate" ? (lang === "vi" ? "Theo lịch sử" : lang === "zh" ? "按历史记录估算" : "Historical estimate") : (lang === "vi" ? "Theo giả định" : lang === "zh" ? "基于假设" : "Assumption-based")}</small></h3>
      {(walletConclusion || budgetConclusion) && <p className="fb-scenario-summary"><strong>{lang === "vi" ? "Kết quả" : "Result"}</strong>{walletConclusion && <> · {walletConclusion}</>}{budgetConclusion && <> {budgetConclusion}</>}</p>}
      {!!displayWallets.length && <div className="fb-scenario-wallet-grid">{displayWallets.map((projection) => <div className="fb-scenario-wallet" key={projection.walletId}><b>{walletName(projection.walletId)} · {projection.currency}</b><span>{lang === "vi" ? "Số dư hiện tại" : "Current balance"}<strong>{formatMoney(projection.balanceNow, projection.currency)}</strong></span><span className="fb-scenario-wallet-projected">{lang === "vi" ? `Dự kiến ${formatDate(forecastDate)}` : `By ${formatDate(forecastDate)}`}<strong>{formatMoney(projection.projectedBalance, projection.currency)}</strong></span>{projection.shortfall > 0 && <small>{lang === "vi" ? "Có thể thiếu" : "Possible shortfall"}: {formatMoney(projection.shortfall, projection.currency)}</small>}</div>)}</div>}
      {displayBudgets.map((projection) => {
        const budget = budgets.find((item) => item.id === projection.budgetId);
        const actual = Math.max(0, (budget?.amount || 0) - projection.actualRemaining);
        const scale = Math.max(1, budget?.amount || 0, projection.projectedSpend);
        const limitPercent = Math.min(100, (budget?.amount || 0) / scale * 100);
        const remaining = projection.projectedRemaining;
        const overBudget = remaining < 0;
        return <div className="fb-scenario-budget" key={projection.budgetId}>
          <div className="fb-scenario-budget-heading"><b>{lang === "vi" ? "Ngân sách" : "Budget"}: {budget?.title}</b><span>{formatMoney(projection.projectedSpend, projection.currency)} / {formatMoney(budget?.amount || 0, projection.currency)}</span></div>
          <div className="fb-scenario-chart" role="img" aria-label={`${lang === "vi" ? "Đã chi" : "Spent"} ${formatMoney(actual, projection.currency)}; ${lang === "vi" ? "dự báo" : "forecast"} ${formatMoney(projection.projectedSpend, projection.currency)}; ${lang === "vi" ? "hạn mức" : "limit"} ${formatMoney(budget?.amount || 0, projection.currency)}`}>
            <div className="fb-scenario-chart-row"><span>{lang === "vi" ? "Đã chi" : "Spent"}</span><div className="fb-scenario-chart-track"><i className="is-actual" style={{ width: `${Math.min(100, actual / scale * 100)}%` }} /><i className="is-limit" style={{ left: `${limitPercent}%` }} /></div><b>{formatMoney(actual, projection.currency)}</b></div>
            <div className="fb-scenario-chart-row"><span>{lang === "vi" ? "Dự báo" : "Forecast"}</span><div className="fb-scenario-chart-track"><i className={overBudget ? "is-over" : "is-forecast"} style={{ width: `${Math.min(100, Math.max(0, projection.projectedSpend) / scale * 100)}%` }} /><i className="is-limit" style={{ left: `${limitPercent}%` }} /></div><b>{formatMoney(projection.projectedSpend, projection.currency)}</b></div>
            <div className="fb-scenario-chart-legend"><span><i className="is-actual" />{lang === "vi" ? "Đã chi" : "Spent"}</span><span><i className="is-limit-key" />{lang === "vi" ? "Hạn mức" : "Limit"}</span></div>
          </div>
          <div className="fb-scenario-budget-breakdown"><span>{lang === "vi" ? "Đã chi" : "Spent"}<b>{formatMoney(actual, projection.currency)}</b></span><span>{lang === "vi" ? "Chi cố định" : "Fixed"}<b>{formatMoney(projection.plannedAmount, projection.currency)}</b></span>{result.includesPaceForecast && <span>{lang === "vi" ? "Chi linh hoạt dự kiến" : "Flexible forecast"}<b>{formatMoney(projection.paceAmount, projection.currency)}</b></span>}</div>
          <div className={`fb-scenario-budget-outcome${overBudget ? " is-over" : ""}`}><span>{overBudget ? (lang === "vi" ? "Có thể vượt ngân sách" : "Possible budget overrun") : (lang === "vi" ? "Còn lại cuối kỳ" : "Left at period end")}</span><strong>{formatMoney(Math.abs(remaining), projection.currency)}</strong></div>
          {result.includesPaceForecast && result.confidence !== "user-defined" && <p className={`fb-scenario-plan${overBudget ? " is-warning" : ""}`}>{projection.dailyFlexibleLimit > 0 ? (lang === "vi" ? `Để không vượt, giới hạn chi linh hoạt khoảng ${formatMoney(projection.dailyFlexibleLimit, projection.currency)}/ngày.` : `To stay within budget, limit flexible spending to about ${formatMoney(projection.dailyFlexibleLimit, projection.currency)}/day.`) : (lang === "vi" ? "Hạn mức đã hết; tạm dừng chi linh hoạt để không vượt ngân sách." : "No flexible budget remains; pause flexible spending to stay within the limit.")}</p>}
          {result.includesPaceForecast && !projection.forecastAvailable && <p className="fb-planning-warning">{lang === "vi" ? "Chưa đủ dữ liệu chi trong tháng để ước tính nhịp." : "There is not enough spending history this month to estimate a pace."}</p>}
        </div>;
      })}
      {!!displayBills.length && <div className="fb-scenario-details"><b>{lang === "vi" ? "Khoản sắp đến hạn" : "Upcoming fixed costs"}</b>{displayBills.map((bill, billIndex) => <span key={`${bill.date}-${billIndex}`}>{formatDate(bill.date)} · {bill.title} · {formatMoney(bill.amount, bill.currency)}</span>)}</div>}
      {!displayBudgets.length && !!result.estimatedSpending.length && result.estimatedSpending.filter((estimate) => !visibleWalletIds.size || visibleWalletIds.has(estimate.walletId)).map((estimate) => <p className="fb-planning-note" key={estimate.walletId}>{lang === "vi" ? "Chi dự kiến" : "Projected spending"}: <strong>{formatMoney(estimate.amount, estimate.currency)}</strong> · {estimate.days} {lang === "vi" ? "ngày" : "days"}</p>)}
      {!!result.savings.length && <div className="fb-scenario-details"><b>{lang === "vi" ? "Tiết kiệm giả định" : "Estimated savings"}</b>{result.savings.map((saving, savingIndex) => <span key={`${saving.walletId}-${saving.category}-${savingIndex}`}>{saving.category}: {saving.percent}% · {formatMoney(saving.savedAmount, saving.currency)}</span>)}</div>}
      {result.unavailableEstimates.map((reason) => <p className="fb-planning-warning" key={reason}>{localizeScenarioDetail(reason, lang)}</p>)}
      {!!result.assumptions.length && <details className="fb-scenario-assumptions"><summary>{lang === "vi" ? "Xem cách tính" : lang === "zh" ? "查看计算方式" : "How this is calculated"}</summary>{result.assumptions.map((assumption) => <p className="fb-planning-note" key={assumption}>{localizeScenarioDetail(assumption, lang)}</p>)}</details>}
      {!displayBudgets.length && !!result.suggestions.length && <div className="fb-scenario-details"><b>{lang === "vi" ? "Gợi ý" : lang === "zh" ? "建议" : "Suggestion"}</b>{result.suggestions.slice(0, 1).map((suggestion) => <span key={suggestion}>{localizeScenarioDetail(suggestion, lang)}</span>)}</div>}
    </section>;
  };

  // Next router navigation to a hash in this same view does not always fire
  // hashchange. Reveal the target before routing so it exists for scrolling.
  const navigateFromHeader = (path: string) => {
    let targetId = "";
    try { targetId = decodeURIComponent(path.split("#")[1] || ""); } catch { /* No target to reveal. */ }
    if (targetId.startsWith("budget-") || targetId.startsWith("fixed-")) {
      setActiveTab("manage");
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
      subtitle={lang === "vi" ? "Theo dõi ngân sách, khoản sắp đến hạn và dự báo chi tiêu." : lang === "zh" ? "跟踪预算、即将到期的账单和支出预测。" : "Track budgets, upcoming bills and spending outlook."}
      theme={String(state.settings?.theme || "light")}
      currentLanguage={String(state.settings?.language || "Tiếng Việt")}
      onOpenCalendar={() => setCalendarLedgerOpen(true)}
      onToggleTheme={() => updateState((s) => ({ ...s, settings: { ...s?.settings, theme: s?.settings?.theme === "dark" ? "light" : "dark" } }))}
      onSelectLanguage={(val) => updateState((s) => ({ ...s, settings: { ...s?.settings, language: val } }))}
      primaryAction={<button type="button" className="fb-add-button fb-header-primary-action" disabled={!activeWallets.length || activeTab !== "manage"} onClick={() => primaryForm === "fixed" ? open("fixed", parentFilter === "all" ? undefined : parentFilter) : open("budget")}><Plus size={18}/><span>{primaryForm === "fixed" ? t.addFixed : t.addBudget}</span></button>}
    />

    <div className="fb-planning-action-row">
      <button type="button" className="fb-safety-planning-link" onClick={() => navigate("safetyAlerts")}>
        <span>{SAFETY_COPY[lang].title}<small>{SAFETY_COPY[lang].subtitle}</small></span>
        <ArrowRight size={20} />
      </button>

      <div className="fb-planning-header-actions">
        {activeTab === "simulator" && <label className="fb-period-control"><span>{lang === "vi" ? "Kỳ xem" : lang === "zh" ? "查看期间" : "Period"}</span><input type="month" value={selectedMonth} onChange={(event) => event.target.value && setSelectedMonth(event.target.value)} aria-label={lang === "vi" ? "Chọn tháng xem báo cáo" : "Select reporting month"} /></label>}
        <label className="fb-period-control fb-wallet-period-control"><span>{t.wallet}</span><PlanningDropdown value={walletFilter} onChange={(val) => { setWalletFilter(val); setParentFilter("all"); setVisibleBudgetCount(5); setVisibleFixedCount(5); }} options={[{ value: "all", label: t.allWallets }, ...state.wallets.map((item) => ({ value: item.id, label: `${walletName(item.id)} · ${item.currency}` }))]} ariaLabel={t.wallet} /></label>
      </div>
    </div>

    <nav className="fb-planning-segmented" role="tablist" aria-label={lang === "vi" ? "Các khu vực kế hoạch" : "Planning views"}>
      <button type="button" role="tab" id="planning-tab-manage" aria-controls="planning-panel-manage" aria-selected={activeTab === "manage"} onClick={() => setActiveTab("manage")}><Wallet size={16} /><span>{lang === "vi" ? "Ngân sách & Chi cố định" : lang === "zh" ? "预算与固定支出" : "Budgets & Fixed costs"}</span></button>
      <button type="button" role="tab" id="planning-tab-analysis" aria-controls="planning-panel-analysis" aria-selected={activeTab === "analysis"} onClick={() => setActiveTab("analysis")}><TrendingUp size={16}/><span>{lang === "vi" ? "Phân tích chi tiêu" : lang === "zh" ? "支出分析" : "Spending analysis"}</span></button>
      <button type="button" role="tab" id="planning-tab-simulator" aria-controls="planning-panel-simulator" aria-selected={activeTab === "simulator"} onClick={() => setActiveTab("simulator")}><Sparkles size={16} /><span>AI Simulator</span></button>
    </nav>


    {activeTab === "manage" && <section className="fb-planning-tab-panel" id="planning-panel-manage" role="tabpanel" aria-labelledby="planning-tab-manage" tabIndex={0}>
      <div className="fb-planning-toolbar">
        <div className="fb-planning-tabs" role="tablist" aria-label={lang === "vi" ? "Chọn danh sách quản lý" : "Choose a management list"}>
          <button type="button" role="tab" aria-selected={tab === "budget"} onClick={() => setPlanningTab("budget")}><b>{t.budget}</b><small>{t.budgetHint}</small><span>{budgets.length} {t.countBudget}</span></button>
          <button type="button" role="tab" aria-selected={tab === "fixed"} onClick={() => setPlanningTab("fixed")}><b>{t.fixed}</b><small>{t.fixedHint}</small><span>{fixed.filter((item) => item.active).length} {t.countFixed}</span></button>
        </div>
        <div className="fb-planning-filters">
          {tab === "fixed" && <label><span>{t.parent}</span><PlanningDropdown value={parentFilter} onChange={(val) => { setParentFilter(val); setVisibleFixedCount(5); }} options={[{ value: "all", label: t.allBudgets }, ...filteredBudgets.map((item) => ({ value: item.id, label: item.title }))]} ariaLabel={t.parent} /></label>}
        </div>
      </div>

      {tab === "budget" && <section className="fb-planning-list-section" id="fb-budget-section" aria-labelledby="fb-budget-list-title">
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

      {tab === "fixed" && <section className="fb-planning-list-section" id="fb-fixed-section" aria-labelledby="fb-fixed-list-title">
        <header className="fb-planning-section-heading"><div><p className="fb-eyebrow">{lang === "vi" ? "LỊCH THANH TOÁN" : "PAYMENT SCHEDULE"}</p><h2 id="fb-fixed-list-title">{t.fixed}</h2></div><span>{filteredFixed.filter((item) => item.active).length} {t.countFixed}</span></header>
        <div className="fb-fixed-list">
          {!filteredFixed.length ? <div className="fb-planning-empty"><ReceiptText size={30} /><h2>{t.emptyFixed}</h2><p>{t.emptyFixedHint}</p><button type="button" className="fb-add-button" disabled={!activeWallets.length} onClick={() => open("fixed", parentFilter === "all" ? undefined : parentFilter)}><Plus size={17} />{t.addFixed}</button></div> : sortedFixed.slice(0, visibleFixedCount).map((expense) => {
            const parent = budgets.find((item) => item.id === expense.budgetId);
            const window = parent ? budgetSummary(state, parent, today) : undefined;
            const due = window ? plannedOccurrences(expense, window.start, window.end) : [];
            const currency = parent?.currency || state.wallets.find((wallet) => wallet.id === expense.walletId)?.currency || "";
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
                  <span>{t.amount}:</span>
                  <b>{format(expense.amount, currency)}</b>
                </div>
                <div className="fb-fixed-compact-meta">
                  <span>{expense.recurrence === "monthly" ? `${repeatMonths}: ${expense.intervalMonths || 1}` : t[expense.recurrence]}</span>
                  <span><CalendarDays size={12} />{due.length > 0 ? `${t.dueThisPeriod}: ${due.map(formatDate).join(" · ")}` : `${t.firstDue}: ${formatDate(expense.dueDate)}`}</span>
                </div>
              </div>
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

    </section>}
    {activeTab === "analysis" && <section className="fb-planning-analysis fb-planning-tab-panel" id="planning-panel-analysis" role="tabpanel" aria-labelledby="planning-tab-analysis" tabIndex={0}>
        <summary><TrendingUp size={19}/><span><b>{lang === "vi" ? "Xem phân tích chi tiêu" : lang === "zh" ? "查看支出分析" : "View spending analysis"}</b><small>{lang === "vi" ? "Theo danh mục và theo tuần, từ giao dịch đã ghi nhận." : lang === "zh" ? "按类别和周查看已记录的支出。" : "Review recorded expenses by category and week."}</small></span><ChevronDown size={18}/></summary>
        <div className="fb-planning-analysis-body">
          {unmappedExpenseCount > 0 && <p className="fb-planning-note">{lang === "vi" ? `${unmappedExpenseCount} giao dịch thiếu ví hoặc tiền tệ đã được loại khỏi phân tích.` : lang === "zh" ? `${unmappedExpenseCount} 笔交易缺少钱包或币种，未计入分析。` : `${unmappedExpenseCount} transactions without a wallet or currency were excluded from analysis.`}</p>}
          <section className="fb-planning-analytics" aria-labelledby="fb-analytics-title">
            <header className="fb-planning-section-heading fb-analytics-heading-inline">
              <div>
                <p className="fb-eyebrow">{lang === "vi" ? "THỰC TẾ" : "ACTUALS"}</p>
                <h2 id="fb-analytics-title">{lang === "vi" ? "Phân tích chi tiêu" : lang === "zh" ? "支出分析" : "Spending analytics"}</h2>
              </div>
              <div className="fb-analytics-period-inline">
                <label className="fb-period-control">
                  <span>{lang === "vi" ? "Kỳ xem" : lang === "zh" ? "查看期间" : "Period"}</span>
                  <input type="month" value={selectedMonth} onChange={(event) => event.target.value && setSelectedMonth(event.target.value)} aria-label={lang === "vi" ? "Chọn tháng xem báo cáo" : "Select reporting month"} />
                </label>
              </div>
            </header>
      <div className="fb-overview-grid"><section className="fb-category-column" aria-label={lang === "vi" ? "Chi tiêu theo danh mục" : "Spending by category"}><h3>{lang === "vi" ? "Chi tiêu theo danh mục" : lang === "zh" ? "按类别支出" : "Category spending"}</h3>{periodBudgetSummaries.filter(({ budget }) => !budget.category?.trim()).map(({ budget, window, summary }) => {
        const ratio = budget.amount > 0 ? Math.min(100, Math.max(0, summary.actual / budget.amount * 100)) : 0;
        const isOver = summary.actual > budget.amount;
        const isNear = !isOver && ratio >= 80;
        const status = isOver ? (lang === "vi" ? "Vượt hạn mức" : "Over budget") : isNear ? (lang === "vi" ? "Gần hạn mức" : "Near limit") : (lang === "vi" ? "Trong hạn mức" : "On track");
        return <article className="fb-category-row fb-category-budget-total" key={budget.id + "-" + window.start}><div className="fb-category-row-heading"><span><b>{lang === "vi" ? "Tất cả danh mục chi" : lang === "zh" ? "所有支出类别" : "All spending categories"}</b><small>{walletName(budget.wallet)} · {budget.currency} · {formatDate(window.start)}–{formatDate(window.end)}</small></span><em className={isOver ? "is-over" : isNear ? "is-near" : ""}>{status}</em></div><progress className={isOver ? "is-over" : ""} aria-label={status} value={Math.min(100, ratio)} max={100} /><div className="fb-category-row-values"><b>{formatMoney(summary.actual, budget.currency)}</b><span>{lang === "vi" ? "trên" : lang === "zh" ? "/" : "of"} {formatMoney(budget.amount, budget.currency)}</span><span>{Math.round(ratio)}% {lang === "vi" ? "đã dùng" : lang === "zh" ? "已使用" : "used"}</span><strong>{isOver ? "+" + formatMoney(summary.actual - budget.amount, budget.currency) : formatMoney(summary.remaining, budget.currency)} {isOver ? (lang === "vi" ? "vượt" : lang === "zh" ? "超出" : "over") : (lang === "vi" ? "còn" : lang === "zh" ? "剩余" : "left")}</strong></div></article>;
      })}{categoryGroups.length ? categoryGroups.map((group) => <div className="fb-category-wallet" key={group.walletId}><div className="fb-category-wallet-heading"><b>{lang === "vi" ? "Chi tiết danh mục" : lang === "zh" ? "类别明细" : "Category details"} · {walletName(group.walletId)}</b><span>{formatMoney(group.total, group.currency)}</span></div>{group.categories.map((item, index) => {
        const matchingBudgets = item.limit === null ? [] : periodBudgetSummaries.filter(({ budget }) => budget.wallet === group.walletId && budget.currency === group.currency && budget.category.trim() === item.name);
        const actual = matchingBudgets.reduce((sum, entry) => sum + entry.summary.actual, 0);
        const ratio = item.limit && item.limit > 0 ? actual / item.limit * 100 : item.percentage;
        const isOver = ratio !== null && ratio > 100;
        return <article className="fb-category-row" key={item.name}><div className="fb-category-row-heading"><span><b><i style={{ background: chartColors[index % chartColors.length] }} />{item.name}</b><small>{formatMoney(item.amount, group.currency)} · {item.percentage.toFixed(0)}% {lang === "vi" ? "tổng chi" : lang === "zh" ? "支出占比" : "of spending"}</small></span>{item.limit !== null && <em className={isOver ? "is-over" : ""}>{isOver ? (lang === "vi" ? "Vượt hạn mức" : "Over") : (lang === "vi" ? "Trong hạn mức" : "Within limit")}</em>}</div><progress className={isOver ? "is-over" : ""} aria-label={`${item.name}: ${Math.round(ratio || 0)}%`} value={Math.min(100, Math.max(0, ratio || 0))} max={100} /><div className="fb-category-row-values">{item.limit !== null ? <><span>{lang === "vi" ? "Đã dùng" : "Used"} {formatMoney(actual, group.currency)} / {formatMoney(item.limit, group.currency)}</span><strong>{Math.round(ratio || 0)}% {isOver ? (lang === "vi" ? "đã vượt" : "over") : (lang === "vi" ? "đã dùng" : "used")}</strong></> : <><span>{lang === "vi" ? "Tỷ trọng chi tiêu" : "Share of spending"}</span><strong>{item.percentage.toFixed(0)}%</strong></>}</div></article>;
      })}</div>) : <p className="fb-analytics-empty is-compact">{lang === "vi" ? "Chưa có khoản chi hợp lệ trong kỳ để phân tích." : lang === "zh" ? "期间暂无有效支出可供分析。" : "No valid spending to analyze for this period."}</p>}</section>
      <div className="fb-overview-right">
      {weeklyChartGroups.length ? weeklyChartGroups.map(({ wallet, rows }) => {
        const max = Math.max(1, ...rows.map((row) => row.total));
        return <article className="fb-analytics-card fb-weekly-chart-card" key={`weekly-${wallet.id}`}>
          <div className="fb-analytics-title"><span className="fb-planning-icon"><CalendarDays size={18} /></span><div><h3>{lang === "vi" ? "Chi tiêu theo tuần" : lang === "zh" ? "每周支出" : "Weekly spending"}</h3><small>{walletName(wallet.id)} · {wallet.currency} · {lang === "vi" ? `Thực tế đến ${formatDate(actualEnd)}` : lang === "zh" ? `实际数据截至 ${formatDate(actualEnd)}` : `Actual through ${formatDate(actualEnd)}`}</small></div></div>
          <div className="fb-weekly-chart-layout"><div className="fb-weekly-axis" aria-hidden="true"><span>{formatMoney(max, wallet.currency)}</span><span>{formatMoney(max / 2, wallet.currency)}</span><span>{formatMoney(0, wallet.currency)}</span></div><div className="fb-weekly-bars" role="group" aria-label={`${lang === "vi" ? "Chi tiêu thực tế theo tuần" : "Actual weekly spending"} · ${walletName(wallet.id)} · ${wallet.currency}`}>
            {rows.map((row, index) => { const periodStatus = weeklyPeriodStatus(row.start, row.end, actualEnd); const future = periodStatus === "future", partial = periodStatus === "partial"; const shortLabel = `${String(index + 1).padStart(2, "0")} · ${row.start.slice(-2)}–${row.end.slice(-2)}`; const status = future ? (lang === "vi" ? "Chưa diễn ra" : "Not started") : partial ? (lang === "vi" ? "Đang diễn ra" : "Partial") : (lang === "vi" ? "Đã kết thúc" : "Complete"); return <div className={`fb-weekly-bar-column${future ? " is-future" : partial ? " is-partial" : ""}`} key={row.start} title={`${row.start}–${row.end}: ${future ? status : `${formatMoney(row.total, row.currency)} · ${status}`}`} aria-label={`${row.start}–${row.end}: ${future ? status : `${formatMoney(row.total, row.currency)}, ${status}`}`}><b>{future ? "—" : formatMoney(row.total, row.currency)}</b><div className="fb-weekly-bar-track" aria-hidden="true"><i className="is-other" style={{ height: `${row.variable / max * 100}%` }} /><i className="is-fixed" style={{ height: `${row.fixed / max * 100}%` }} /></div><small>{shortLabel}</small><em>{future || partial ? status : ""}</em></div>; })}
          </div></div>
          <div className="fb-weekly-chart-legend"><span><i className="is-fixed" />{lang === "vi" ? "Chi cố định đã ghi nhận" : lang === "zh" ? "已记录固定支出" : "Recorded fixed"}</span><span><i className="is-other" />{lang === "vi" ? "Chi khác đã ghi nhận" : lang === "zh" ? "其他已记录支出" : "Other actual spending"}</span></div>
        </article>;
      }) : <p className="fb-analytics-empty is-compact">{lang === "vi" ? `Chưa có giao dịch chi hợp lệ trong ${monthLabel} để vẽ biểu đồ tuần.` : lang === "zh" ? `${monthLabel} 尚无可用于周图表的有效支出交易。` : `No valid expense transactions to chart for ${monthLabel}.`}</p>}
      </div></div>
      <article className="fb-analytics-card fb-weekly-card fb-weekly-full-width"><div className="fb-analytics-title"><div><h3>{lang === "vi" ? "Chi tiết theo tuần" : lang === "zh" ? "每周明细" : "Weekly details"}</h3></div><details className="fb-weekly-method"><summary>{lang === "vi" ? "Cách tính" : lang === "zh" ? "计算方式" : "How calculated"}</summary><p>{lang === "vi" ? "Chỉ tính giao dịch chi hợp lệ đến ngày hiện tại. Tuần đang diễn ra là số liệu một phần; tuần tương lai không có số thực tế. Khoản cố định chỉ được nhận diện khi khớp duy nhất ví, tiền tệ, ngày đến hạn, danh mục và số tiền. Hạn mức còn là số lũy kế tại cuối tuần đã diễn ra; — khi phạm vi ngân sách chồng lấn hoặc tiền tệ không khớp." : lang === "zh" ? "仅统计截至今天的有效支出。当前周为部分数据；未来周不显示实际值。固定支出需唯一匹配钱包、币种、到期日、类别和金额。剩余预算按已结束周末累计计算；预算重叠或币种不匹配时显示 —。" : "Only valid expenses through today are included. The current week is partial; future weeks have no actuals. Fixed expenses require a unique wallet, currency, due date, category and amount match. Remaining budget is cumulative through elapsed weeks; overlapping or mismatched budgets show —."}</p></details></div><div className="fb-weekly-table-wrap"><table className="fb-weekly-table"><thead><tr><th>{lang === "vi" ? "Tuần · Ví" : lang === "zh" ? "周 · 钱包" : "Week · Wallet"}</th><th>{lang === "vi" ? "Cố định" : lang === "zh" ? "固定支出" : "Fixed"}</th><th>{lang === "vi" ? "Chi khác" : lang === "zh" ? "其他支出" : "Other spend"}</th><th>{lang === "vi" ? "Hạn mức còn" : lang === "zh" ? "剩余预算" : "Budget left"}</th><th>{lang === "vi" ? "Tổng chi" : lang === "zh" ? "总支出" : "Total"}</th></tr></thead>{weeklyChartGroups.map(({ wallet, rows }) => {
        const totals = rows.reduce((sum, row) => ({ fixed: sum.fixed + row.fixed, variable: sum.variable + row.variable, total: sum.total + row.total, count: sum.count + row.transactionCount }), { fixed: 0, variable: 0, total: 0, count: 0 });
        const endingBudget = rows.at(-1)?.unspent ?? null;
        return <tbody key={`weekly-table-${wallet.id}`}>{rows.map((row) => { const periodStatus = weeklyPeriodStatus(row.start, row.end, actualEnd); const future = periodStatus === "future", partial = periodStatus === "partial"; return <tr className={future ? "is-future" : partial ? "is-partial" : ""} key={row.start}><td><b>{row.start.slice(-2)}–{row.end.slice(-2)}</b><small>{future ? (lang === "vi" ? "Chưa diễn ra" : "Not started") : partial ? (lang === "vi" ? "Đang diễn ra" : "Partial") : `${row.transactionCount} ${lang === "vi" ? "giao dịch" : "tx"}`} · {walletName(row.walletId)} · {row.currency}</small></td><td>{future ? "—" : formatMoney(row.fixed, row.currency)}</td><td>{future ? "—" : formatMoney(row.variable, row.currency)}</td><td>{future || row.unspent === null ? "—" : formatMoney(row.unspent, row.currency)}</td><td><strong>{future ? "—" : formatMoney(row.total, row.currency)}</strong></td></tr>; })}<tr className="fb-weekly-total"><td>{lang === "vi" ? `Tổng thực tế · ${totals.count} giao dịch` : lang === "zh" ? `实际合计 · ${totals.count} 笔交易` : `Actual total · ${totals.count} tx`}<small>{walletName(wallet.id)} · {wallet.currency} · {actualThrough ? `${lang === "vi" ? "đến" : "through"} ${formatDate(actualThrough)}` : (lang === "vi" ? "chưa bắt đầu" : "not started")}</small></td><td>{formatMoney(totals.fixed, wallet.currency)}</td><td>{formatMoney(totals.variable, wallet.currency)}</td><td>{endingBudget === null ? "—" : formatMoney(endingBudget, wallet.currency)}</td><td><strong>{formatMoney(totals.total, wallet.currency)}</strong></td></tr></tbody>;
      })}</table></div></article>
    </section>
        </div>
      </section>}
      {activeTab === "manage" && state.goals.some((item) => item.kind === "savings") && <details className="fb-planning-legacy"><summary>{t.oldSavings}</summary><ul>{state.goals.filter((item) => item.kind === "savings").map((item) => <li key={item.id}>{item.title} · {format(item.saved, item.currency)} / {format(item.amount, item.currency)}</li>)}</ul></details>}
    {activeTab === "simulator" && <section className="fb-planning-tab-panel" id="planning-panel-simulator" role="tabpanel" aria-labelledby="planning-tab-simulator" tabIndex={0}>
    <section className="fb-sandbox-controls" aria-labelledby="fb-sandbox-title"><header><div><p className="fb-eyebrow">{lang === "vi" ? "CHỈ ÁP DỤNG TRONG MÔ PHỎNG" : "SIMULATION ONLY"}</p><h2 id="fb-sandbox-title">{lang === "vi" ? "Điều chỉnh kịch bản" : "Scenario controls"}</h2><p>{lang === "vi" ? "Loại trừ giao dịch hoặc thêm khoản thu/chi để xem tác động tức thời. Không thay đổi dữ liệu FinBridge." : "Exclude transactions or add simulated income/expenses. These controls never change saved FinBridge data."}</p></div><button type="button" onClick={resetSandbox} disabled={!sandboxExcludedIds.length && !sandboxChanges.length}>{lang === "vi" ? "Đặt lại điều chỉnh" : "Reset adjustments"}</button></header>
      <div className="fb-sandbox-grid"><div className="fb-sandbox-exclusions"><h3>{lang === "vi" ? "Giao dịch chi nhiều nhất" : "Largest recorded expenses"}</h3>{sandboxCandidates.length ? sandboxCandidates.map((transaction) => <label key={transaction.id}><input type="checkbox" checked={sandboxExcludedIds.includes(transaction.id)} onChange={(event) => setSandboxExcludedIds((ids) => event.target.checked ? [...new Set([...ids, transaction.id])] : ids.filter((id) => id !== transaction.id))} /><span><b>{transaction.title || transaction.category}</b><small>{transaction.date} · {transaction.category} · {walletName(transaction.wallet)}</small></span><strong>{formatMoney(transaction.amount, transactionCurrency(transaction.wallet))}</strong></label>) : <p className="fb-planning-note">{lang === "vi" ? "Không có giao dịch chi hợp lệ trong tháng này." : "No valid expenses in this month."}</p>}</div>
      <form className="fb-sandbox-add" onSubmit={addSandboxItem}><h3>{lang === "vi" ? "Thêm khoản giả định" : "Add a simulated item"}</h3><label>{lang === "vi" ? "Tên khoản" : "Description"}<input required maxLength={100} value={sandboxTitle} onChange={(event) => setSandboxTitle(event.target.value)} placeholder={lang === "vi" ? "Ví dụ: Học phí" : "e.g. Tuition"} /></label><div className="fb-sandbox-fields"><label>{lang === "vi" ? "Loại" : "Type"}<select value={sandboxDirection} onChange={(event) => setSandboxDirection(event.target.value as "income" | "expense")}><option value="expense">{lang === "vi" ? "Chi" : "Expense"}</option><option value="income">{lang === "vi" ? "Thu" : "Income"}</option></select></label><label>{t.amount}<input type="number" min="0.01" step="0.01" required value={sandboxAmount} onChange={(event) => setSandboxAmount(event.target.value)} /></label></div><div className="fb-sandbox-fields"><label>{t.wallet}<select required value={sandboxWalletId} onChange={(event) => setSandboxWalletId(event.target.value)}>{activeWallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{walletName(wallet.id)} · {wallet.currency}</option>)}</select></label><label>{t.due}<input type="date" min={today} required value={sandboxDate} onChange={(event) => setSandboxDate(event.target.value)} /></label></div><label>{t.category}<select value={sandboxCategory} onChange={(event) => setSandboxCategory(event.target.value)}><option value="">{lang === "vi" ? "Không gắn danh mục" : "No category"}</option>{expenseCategories.map((name) => <option key={name} value={name}>{name}</option>)}</select></label><button type="submit" disabled={!activeWallets.length || !sandboxTitle.trim() || !sandboxAmount}>{lang === "vi" ? "Thêm vào mô phỏng" : "Add to simulation"}</button></form></div>
      {(sandboxPreview.length > 0 || sandboxChanges.length > 0 || sandboxExcludedIds.length > 0) && <div className="fb-sandbox-preview"><b>{lang === "vi" ? "Tác động tạm tính" : "Instant sandbox impact"}</b><div>{sandboxPreview.map((item) => <span key={item.walletId}>{walletName(item.walletId)} · {item.currency}: {formatMoney(item.actualBalance, item.currency)} → <strong>{formatMoney(item.projectedBalance, item.currency)}</strong></span>)}</div><ul>{sandboxChanges.map((change, index) => <li key={change.title + "-" + index}>{change.direction === "income" ? (lang === "vi" ? "Thu" : "Income") : (lang === "vi" ? "Chi" : "Expense")} · {change.title} · {formatMoney(change.amount || 0, change.currency || "")} · {change.date}<button type="button" onClick={() => setSandboxChanges((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label={(lang === "vi" ? "Bỏ " : "Remove ") + change.title}>{lang === "vi" ? "Bỏ" : "Remove"}</button></li>)}</ul><small>{lang === "vi" ? sandboxExcludedIds.length + " giao dịch được loại trừ. Số dư dự kiến chưa tính khoản chi tương lai ngoài các mục giả định." : sandboxExcludedIds.length + " transactions excluded. The balance preview excludes future spending outside these assumptions."}</small></div>}
    </section>
    <section className="fb-scenario-planner" aria-labelledby="fb-scenario-title">
      <div className="fb-scenario-heading"><span className="fb-planning-icon"><Sparkles size={19} /></span><div><p className="fb-eyebrow">{lang === "vi" ? "MÔ PHỎNG" : "SIMULATION"}</p><h2 id="fb-scenario-title">{lang === "vi" ? "AI Financial Planner" : lang === "zh" ? "AI 财务规划" : "AI Financial Planner"}</h2><p>{lang === "vi" ? "Hỏi điều gì sẽ xảy ra với số dư và ngân sách. Kết quả dùng dữ liệu hiện có và không thay đổi giao dịch." : lang === "zh" ? "询问余额和预算会如何变化。模拟不会修改交易。" : "Ask how a change could affect your balance and budget. Simulations use current data and never change transactions."}</p></div>{plannerMessages.length > 0 && <button type="button" className="fb-scenario-reset" onClick={resetPlanner}><RotateCcw size={15} />{t.resetChat}</button>}</div>
      {plannerMessages.length > 0 && <div className="fb-scenario-conversation" aria-live="polite">{plannerMessages.map((item, index) => <article className={`fb-scenario-message is-${item.role}`} key={`${index}-${item.text.slice(0, 20)}`}>
        {!(item.role === "assistant" && item.scenarios?.length) && <p className={item.role === "assistant" ? "fb-scenario-answer" : undefined}>{item.text}</p>}
        {item.clarification && <p className="fb-scenario-clarification">{item.clarification}</p>}
        {item.walletChoices?.length ? <div className="fb-scenario-wallet-choices" role="group" aria-label={lang === "vi" ? "Chọn ví để mô phỏng" : "Choose a wallet for the simulation"}>{item.walletChoices.map((wallet) => <button type="button" key={wallet.id} disabled={plannerLoading} onClick={() => choosePlannerWallet(index, wallet.id)}>{wallet.name} · {wallet.currency}</button>)}</div> : null}
        {item.scenarios?.length ? <div className={`fb-scenario-comparison${item.scenarios.length > 1 ? " has-alternatives" : ""}`}>{item.scenarios.map((scenario) => renderScenarioResult(scenario, item.sandboxChanges || [], item.excludedTransactionIds || []))}</div> : null}
      </article>)}</div>}
      <form className="fb-scenario-form" onSubmit={submitScenario}><textarea aria-label={lang === "vi" ? "Mô tả kịch bản tài chính" : "Describe a financial scenario"} rows={2} maxLength={1200} value={plannerInput} onChange={(event) => setPlannerInput(event.target.value)} placeholder={lang === "vi" ? "Ví dụ: Nếu ngày mai đóng 1 triệu học phí thì tháng này tôi còn đủ tiền sinh hoạt không?" : "For example: If I pay $500 tuition tomorrow, can I cover living costs this month?"} /><button type="submit" disabled={plannerLoading || plannerReadyKey !== plannerStorageKey || !plannerInput.trim()}><Send size={16} />{plannerLoading ? (lang === "vi" ? "Đang phân tích…" : "Analyzing…") : (lang === "vi" ? "Mô phỏng" : "Simulate")}</button></form>
      {error && <p className="fb-planning-warning" role="alert">{error}</p>}
      <p className="fb-planning-note">{lang === "vi" ? "Số liệu được tính từ dữ liệu ví, giao dịch, ngân sách và khoản cố định hiện có. AI chỉ diễn giải yêu cầu; không tự tính số dư." : "Results use current wallet, transaction, budget and fixed-expense data. AI interprets the request; deterministic app code calculates projections."}</p>
    </section>
    </section>}
    {form && <Modal title={form === "budget" ? (editingId ? t.edit + " · " + t.budget : t.addBudget) : editingId ? t.edit + " · " + t.fixed : t.addFixed} onClose={() => { if (!saveLock.current) setForm(""); }}><form className="r-form fb-planning-form" onSubmit={save}>
      {form === "fixed" && <><label>{t.parent}<select value={parentId} onChange={(event) => selectParent(event.target.value)}><option value="">{unassigned}</option>{budgets.filter((item) => activeWallets.some((wallet) => wallet.id === item.wallet && wallet.currency === item.currency)).map((item) => <option key={item.id} value={item.id}>{item.title} · {item.currency}</option>)}</select></label>{selectedParent && <p className="fb-planning-note">{t.parentContext} {walletName(selectedParent.wallet)} · {selectedParent.currency}</p>}</>}
      <label>{t.name}<input aria-label={t.name} placeholder={form === "budget" ? t.budgetPlaceholder : t.fixedPlaceholder} required maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      {(form === "budget" || !selectedParent) && <label>{t.wallet}<select value={walletId} required onChange={(event) => { setWalletId(event.target.value); setCategory(""); setAmount(""); }}>{activeWallets.map((item) => <option key={item.id} value={item.id}>{walletName(item.id)} · {item.currency}</option>)}</select></label>}
      <label>{t.amount} · {form === "fixed" && selectedParent ? selectedParent.currency : selectedWallet?.currency}<input aria-label={t.amount} type="number" min={1 / currencyScale((form === "fixed" ? selectedParent?.currency : undefined) || selectedWallet?.currency || "USD")} step={1 / currencyScale((form === "fixed" ? selectedParent?.currency : undefined) || selectedWallet?.currency || "USD")} required value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
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
