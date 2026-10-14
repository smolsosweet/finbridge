"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDownRight, ArrowRight, CalendarDays, ChevronDown, ChevronLeft, Plus, ReceiptText, Wallet, Sparkles, Send, Trash2, RotateCcw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { FinBridgeHeader } from "./FinBridgeHeader";
import { CalendarLedgerModal } from "./CalendarLedgerModal";
import { FinancialOutlook } from "./FinancialOutlook";
import { SETUP_COPY } from "@/lib/setup-copy";
import { Modal } from "./Ui";
import { localDateKey } from "./chartWeek";
import { budgetSummary, plannedOccurrences, validBudget, validFixedExpense } from "./planningModel";
import { updateState, useAppState, workspaceOwner, type FixedExpense, type Goal } from "./store";
import { calculateScenario, scenarioContext, type FinancialScenario } from "@/lib/scenario-planner";

type PlannerWalletChoice = { id: string; name: string; currency: string };
type PlannerMessage = { role: "user" | "assistant"; text: string; scenarios?: FinancialScenario[]; clarification?: string | null; walletChoices?: PlannerWalletChoice[]; pendingScenario?: string; selectedWalletId?: string };

function persistPlannerMessages(storageKey: string, messages: PlannerMessage[]) {
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
    overActual: "Chi thực tế đã vượt hạn mức.", nearLimit: "Đã sử dụng ít nhất 80% ngân sách kỳ này.", overPlanned: "Kế hoạch chi cố định vượt hạn mức. Hãy xem lại phân bổ.",
    invalid: "Kiểm tra tên, số tiền, ngày, ngân sách và danh mục trước khi lưu.",
    mismatch: "Ví không còn hoạt động hoặc tiền tệ không khớp ngân sách; cần kiểm tra lại.",
    oldSavings: "Các mục tiêu tiết kiệm cũ vẫn được giữ trong dữ liệu; chưa chuyển thành khoản chi cố định.",
    viewHistory: "Xem giao dịch thực tế", countBudget: "ngân sách", countFixed: "khoản đang áp dụng", mainWallet: "Ví chính",
    noParent: "Ngân sách không còn trong danh sách", allocations: "Xem khoản chi cố định", budgetPlaceholder: "Ví dụ: Sinh hoạt tháng", fixedPlaceholder: "Ví dụ: Tiền thuê nhà",
    delete: "Xóa", deleteBudgetConfirm: "Xóa ngân sách này? Các khoản chi cố định thuộc ngân sách này cũng sẽ bị xóa.", deleteFixedConfirm: "Xóa khoản chi cố định này?", resetChat: "Xóa hội thoại", resetChatConfirm: "Xóa toàn bộ hội thoại mô phỏng này?",
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
    overActual: "Actual spending exceeds the limit.", nearLimit: "At least 80% of this period’s budget has been used.", overPlanned: "Planned fixed expenses exceed the limit. Review your allocation.",
    invalid: "Check the name, amount, dates, budget and category before saving.",
    mismatch: "The wallet is inactive or its currency differs from this budget. Review the setup.",
    oldSavings: "Existing savings goals are retained in storage and have not been converted to fixed expenses.",
    viewHistory: "View actual transactions", countBudget: "budgets", countFixed: "active expenses", mainWallet: "Main wallet",
    noParent: "Budget no longer listed", allocations: "View fixed expenses", budgetPlaceholder: "For example: Monthly living costs", fixedPlaceholder: "For example: Rent",
    delete: "Delete", deleteBudgetConfirm: "Delete this budget? Its fixed expenses will also be deleted.", deleteFixedConfirm: "Delete this fixed expense?", resetChat: "Reset conversation", resetChatConfirm: "Delete this scenario conversation?",
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
    overActual: "实际支出已超过限额。", nearLimit: "本期预算已使用至少 80%。", overPlanned: "计划固定支出超过预算限额，请检查分配。",
    invalid: "保存前请检查名称、金额、日期、预算和类别。",
    mismatch: "钱包已停用，或币种与预算不一致，请检查设置。",
    oldSavings: "原有储蓄目标仍保留在数据中，未转换为固定支出。",
    viewHistory: "查看实际交易", countBudget: "项预算", countFixed: "项启用支出", mainWallet: "主钱包",
    noParent: "预算已不在列表中", allocations: "查看固定支出", budgetPlaceholder: "例如：每月生活费", fixedPlaceholder: "例如：房租",
    delete: "删除", deleteBudgetConfirm: "删除此预算？其固定支出也会一并删除。", deleteFixedConfirm: "删除此固定支出？", resetChat: "清除对话", resetChatConfirm: "清除此情景对话？",
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
  const [form, setForm] = useState<"budget" | "fixed" | "">(initialForm);
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
  const [intervalMonths, setIntervalMonths] = useState(1);
  const [reminderDays, setReminderDays] = useState(3);
  const [monthPosition, setMonthPosition] = useState<"start" | "end" | "date">("date");
  const [error, setError] = useState("");
  const [plannerInput, setPlannerInput] = useState("");
  const [plannerMessages, setPlannerMessages] = useState<PlannerMessage[]>([]);
  const [plannerReadyKey, setPlannerReadyKey] = useState("");
  const [plannerLoading, setPlannerLoading] = useState(false);
  const plannerBusy = useRef(false);
  const plannerStorageKey = `finbridge-scenario-planner:${workspaceOwner() || "guest"}:v1`;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(plannerStorageKey);
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
  const unassigned = lang === "vi" ? "Chưa liên kết ngân sách" : lang === "zh" ? "尚未关联预算" : "Not linked to a budget yet";
  const repeatMonths = lang === "vi" ? "Lặp mỗi (tháng)" : lang === "zh" ? "每隔几个月重复" : "Repeat every (months)";
  const reminderLabel = lang === "vi" ? "Nhắc trước (ngày)" : lang === "zh" ? "提前几天提醒" : "Remind before (days)";
  const walletName = (id: string) => { const item = state.wallets.find((wallet) => wallet.id === id); return item?.name === "." ? t.mainWallet : item?.name || t.emptyWallet; };
  const format = (value: number, currency: string) => new Intl.NumberFormat(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-GB", { maximumFractionDigits: 2 }).format(value) + " " + currency;
  const formatDate = (key: string) => new Intl.DateTimeFormat(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-GB", { dateStyle: "medium" }).format(new Date(key + "T12:00:00"));
  const formatMoney = (amount: number, currency: string) => format(amount, currency);
  const sendToPlanner = async (message: string, selectedWalletId: string | null, priorMessages: PlannerMessage[], nextHistory: PlannerMessage[]) => {
    if (plannerBusy.current || plannerReadyKey !== plannerStorageKey) return;
    plannerBusy.current = true; setPlannerLoading(true); setError("");
    setPlannerMessages(nextHistory);
    persistPlannerMessages(plannerStorageKey, nextHistory);
    const history = priorMessages.slice(-8).map((item) => {
      const scenarioSummary = item.scenarios?.length ? JSON.stringify(item.scenarios.map((scenario) => ({ name: scenario.name, changes: scenario.changes, spendingReductions: scenario.spendingReductions || [], dailySpendingLimits: scenario.dailySpendingLimits || [], horizonEnd: scenario.horizonEnd, estimateSpending: scenario.estimateSpending }))) : "";
      const text = scenarioSummary ? `${item.text.slice(0, 420)} Previous scenario details: ${scenarioSummary.slice(0, 700)}`.slice(0, 1200) : item.text.slice(0, 1200);
      return { role: item.role, text };
    });
    try {
      const response = await fetch("/api/ai/scenario-planner", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, selectedWalletId, preferredLanguage: lang, today, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          history,
          context: scenarioContext(state, today, selectedWalletId) }),
      });
      const data = await response.json() as { reply?: string; clarification?: string | null; scenarios?: FinancialScenario[]; message?: string };
      if (!response.ok) throw new Error(data.message || (lang === "vi" ? "Không thể phân tích kịch bản lúc này." : "Could not analyze this scenario right now."));
      const completedHistory = nextHistory.map((item) => item.pendingScenario ? { ...item, walletChoices: undefined, pendingScenario: undefined } : item);
      const completedMessages = [...completedHistory, { role: "assistant" as const, text: data.reply || "", scenarios: data.scenarios || [], clarification: data.clarification, selectedWalletId: selectedWalletId || undefined }];
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
    const nextHistory = [...plannerMessages, { role: "user" as const, text: message }];
    if (!selectedWalletId && activeWallets.length > 1 && !(walletMentions.length > 1 && asksToCompareWallets)) {
      const choices = activeWallets.map(({ id, name, currency }) => ({ id, name: name === "." ? t.mainWallet : name, currency }));
      nextHistory.push({ role: "assistant", text: lang === "vi" ? "Bạn muốn mô phỏng bằng ví nào? Mình sẽ dùng số dư, giao dịch và tiền tệ của ví đó." : lang === "zh" ? "你想使用哪个钱包进行模拟？我会根据该钱包的余额、交易和币种计算。" : "Which wallet should I use? I’ll base the result on that wallet’s balance, transactions and currency.", walletChoices: choices, pendingScenario: message });
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
    void sendToPlanner(prompt.pendingScenario, walletId, priorMessages, nextHistory);
  };
  const open = (type: "budget" | "fixed", parent?: string, expense?: FixedExpense) => {
    setError(""); setEditingId(expense?.id || ""); setTitle(expense?.title || ""); setAmount(expense ? String(expense.amount) : "");
    setWalletId(expense?.walletId || activeWallets[0]?.id || ""); setStartDate(today); setCycle("monthly");
    const budget = expense && !expense.budgetId ? undefined : budgets.find((item) => item.id === (parent || expense?.budgetId)) || budgets[0];
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
    let plannedDue = dueDate;
    if (monthPosition !== "date" && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      const [year, month] = dueDate.split("-").map(Number);
      plannedDue = `${year}-${String(month).padStart(2, "0")}-${String(monthPosition === "start" ? 1 : new Date(year, month, 0).getDate()).padStart(2, "0")}`;
    }
    const expense: FixedExpense = { id: editingId || crypto.randomUUID(), budgetId: parentId, walletId: selectedParent?.wallet || walletId, title: title.trim(), amount: Number(amount), category: selectedParent?.category || category, dueDate: plannedDue, recurrence, intervalMonths, reminderDays, monthPosition, active: editingId ? fixed.find((item) => item.id === editingId)?.active ?? true : true };
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
  const deleteBudget = (budgetId: string) => {
    if (!window.confirm(t.deleteBudgetConfirm)) return;
    updateState((current) => ({ ...current, goals: current.goals.filter((item) => item.id !== budgetId), fixedExpenses: (current.fixedExpenses || []).filter((item) => item.budgetId !== budgetId) }));
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
  const renderScenarioResult = (scenario: FinancialScenario) => {
    const missing = !canCalculateScenario(scenario, state);
    const result = missing ? null : calculateScenario(state, scenario, today);
    if (!result) return <section className="fb-scenario-result" key={scenario.id}><h3>{scenario.name}</h3><p className="fb-planning-warning">{lang === "vi" ? "Mình cần làm rõ ví, tiền tệ, danh mục, số tiền hoặc ngày." : "Please clarify the wallet, currency, category, amount or date."}</p></section>;

    const explicitWalletIds = new Set([...scenario.changes.flatMap((change) => change.walletId ? [change.walletId] : []), ...(scenario.spendingReductions || []).flatMap((reduction) => reduction.walletId ? [reduction.walletId] : []), ...(scenario.dailySpendingLimits || []).flatMap((limit) => limit.walletId ? [limit.walletId] : [])]);
    const displayBudgets = result.budgets.filter((projection) => { const budget = budgets.find((item) => item.id === projection.budgetId); return !explicitWalletIds.size || (!!budget && explicitWalletIds.has(budget.wallet)); });
    const budgetWalletIds = new Set(displayBudgets.flatMap((projection) => { const budget = budgets.find((item) => item.id === projection.budgetId); return budget ? [budget.wallet] : []; }));
    const visibleWalletIds = budgetWalletIds.size ? budgetWalletIds : explicitWalletIds;
    const displayWallets = result.wallets.filter((projection) => !visibleWalletIds.size || visibleWalletIds.has(projection.walletId));
    const forecastDate = displayBudgets[0]?.forecastEnd || scenario.horizonEnd || today;
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
        <span>{tab === "budget" ? t.addBudget : t.addFixed}</span>
      </button>
    </div>

    <FinancialOutlook editable />
    <section className="fb-scenario-planner" aria-labelledby="fb-scenario-title">
      <div className="fb-scenario-heading"><span className="fb-planning-icon"><Sparkles size={19} /></span><div><h2 id="fb-scenario-title">{lang === "vi" ? "Dự báo và mô phỏng tài chính" : lang === "zh" ? "AI 财务情景规划" : "Financial forecast and scenarios"}</h2><p>{lang === "vi" ? "Hỏi: “Nếu tôi tiếp tục chi như tháng này, cuối tháng còn bao nhiêu?” FinBridge đối chiếu số dư, ngân sách và khoản cố định; mô phỏng không thay đổi dữ liệu." : lang === "zh" ? "询问本月消费速度下月底还剩多少钱。模拟不会修改数据。" : "Ask: “If I keep spending at this pace, how much will I have left at month end?” FinBridge checks balances, budgets and fixed costs without changing your data."}</p></div>{plannerMessages.length > 0 && <button type="button" className="fb-scenario-reset" onClick={resetPlanner}><RotateCcw size={15} />{t.resetChat}</button>}</div>
      {plannerMessages.length > 0 && <div className="fb-scenario-conversation" aria-live="polite">{plannerMessages.map((item, index) => <article className={`fb-scenario-message is-${item.role}`} key={`${index}-${item.text.slice(0, 20)}`}>
        {!(item.role === "assistant" && item.scenarios?.length) && <p className={item.role === "assistant" ? "fb-scenario-answer" : undefined}>{item.text}</p>}
        {item.clarification && <p className="fb-scenario-clarification">{item.clarification}</p>}
        {item.walletChoices?.length ? <div className="fb-scenario-wallet-choices" role="group" aria-label={lang === "vi" ? "Chọn ví để mô phỏng" : "Choose a wallet for the simulation"}>{item.walletChoices.map((wallet) => <button type="button" key={wallet.id} disabled={plannerLoading} onClick={() => choosePlannerWallet(index, wallet.id)}>{wallet.name} · {wallet.currency}</button>)}</div> : null}
        {item.scenarios?.length ? <div className={`fb-scenario-comparison${item.scenarios.length > 1 ? " has-alternatives" : ""}`}>{item.scenarios.map(renderScenarioResult)}</div> : null}
      </article>)}</div>}
      <form className="fb-scenario-form" onSubmit={submitScenario}><textarea aria-label={lang === "vi" ? "Mô tả kịch bản tài chính" : "Describe a financial scenario"} rows={2} maxLength={1200} value={plannerInput} onChange={(event) => setPlannerInput(event.target.value)} placeholder={lang === "vi" ? "Ví dụ: Nếu ngày mai đóng 1 triệu học phí thì tháng này tôi còn đủ tiền sinh hoạt không?" : "For example: If I pay $500 tuition tomorrow, can I cover living costs this month?"} /><button type="submit" disabled={plannerLoading || plannerReadyKey !== plannerStorageKey || !plannerInput.trim()}><Send size={16} />{plannerLoading ? (lang === "vi" ? "Đang phân tích…" : "Analyzing…") : (lang === "vi" ? "Mô phỏng" : "Simulate")}</button></form>
      {error && <p className="fb-planning-warning" role="alert">{error}</p>}
      <p className="fb-planning-note">{lang === "vi" ? "Số liệu được tính từ dữ liệu ví, giao dịch, ngân sách và khoản cố định hiện có. AI chỉ diễn giải yêu cầu; không tự tính số dư." : "Results use current wallet, transaction, budget and fixed-expense data. AI interprets the request; deterministic app code calculates projections."}</p>
    </section>

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
      return <article key={budget.id} className="fb-budget-card"><div className="fb-planning-card-heading"><span className="fb-planning-icon"><Wallet size={20} /></span><div><h2>{budget.title}</h2><p>{walletName(budget.wallet)} · {budget.currency} · {budget.category || t.allCategories}</p></div><button type="button" className="fb-planning-delete" aria-label={`${t.delete}: ${budget.title}`} title={t.delete} onClick={() => deleteBudget(budget.id)}><Trash2 size={17} /></button></div><p className="fb-planning-period"><CalendarDays size={15} />{formatDate(summary.start)} – {formatDate(summary.end)}</p><div className="fb-budget-limit"><span>{t.limit}</span><b>{format(budget.amount, budget.currency)}</b></div><progress aria-label={t.actual} value={Math.max(0, Math.min(summary.actual, budget.amount))} max={budget.amount} /><dl className="fb-planning-numbers"><div><dt>{t.actual}</dt><dd>{format(summary.actual, budget.currency)}</dd></div><div><dt>{t.remaining}</dt><dd>{format(summary.remaining, budget.currency)}</dd></div><div><dt>{t.planned}</dt><dd>{format(summary.planned, budget.currency)}</dd></div><div><dt>{t.flexible}</dt><dd>{format(summary.allocationRemaining, budget.currency)}</dd></div></dl>{(!summary.matchingCurrency || state.wallets.find((item) => item.id === budget.wallet)?.archived) && <p className="fb-planning-warning">{t.mismatch}</p>}{summary.actual > budget.amount && <p className="fb-planning-warning">{t.overActual}</p>}{summary.actual >= budget.amount * 0.8 && summary.actual <= budget.amount && <p className="fb-planning-warning">{t.nearLimit}</p>}{summary.planned > budget.amount && <p className="fb-planning-warning">{t.overPlanned}</p>}<p className="fb-planning-note">{t.noDouble}</p><div className="fb-planning-card-actions"><button type="button" onClick={() => { setParentFilter(budget.id); setTab("fixed"); }}>{t.allocations}<ArrowRight size={15} /></button><button type="button" disabled={!summary.matchingCurrency || !!state.wallets.find((item) => item.id === budget.wallet)?.archived} onClick={() => open("fixed", budget.id)}><Plus size={16} />{t.addFixed}</button></div><button type="button" className="fb-planning-history" onClick={() => navigate("?tab=transactions&wallet=" + encodeURIComponent(budget.wallet) + "&type=expense&from=" + summary.start + "&to=" + summary.end + (budget.category ? "&category=" + encodeURIComponent(budget.category) : ""))}>{t.viewHistory}<ArrowRight size={14} /></button></article>;
    })}</div> : <div className="fb-fixed-list">{!filteredFixed.length ? <div className="fb-planning-empty"><ReceiptText size={30} /><h2>{t.emptyFixed}</h2><p>{budgets.length ? t.emptyFixedHint : t.emptyBudgetHint}</p><button type="button" className="fb-add-button" disabled={!activeWallets.length} onClick={() => open("fixed", parentFilter === "all" ? undefined : parentFilter)}><Plus size={17} />{budgets.length ? t.addFixed : t.addBudget}</button></div> : filteredFixed.map((expense) => {
      const parent = budgets.find((item) => item.id === expense.budgetId);
      const window = parent ? budgetSummary(state, parent, today) : undefined;
      const due = window ? plannedOccurrences(expense, window.start, window.end) : [];
      const currency = parent?.currency || state.wallets.find(w => w.id === expense.walletId)?.currency || "";
      return <article className="fb-fixed-card" key={expense.id}><div className="fb-planning-card-heading"><span className="fb-planning-icon"><ArrowDownRight size={20} /></span><div><h2>{expense.title}</h2><p>{t.parent} · {parent?.title || (expense.budgetId ? t.noParent : unassigned)}</p><p>{walletName(parent?.wallet || expense.walletId || "")} · {currency} · {expense.category}</p></div><b>{format(expense.amount, currency)}</b><button type="button" className="fb-planning-delete" aria-label={`${t.delete}: ${expense.title}`} title={t.delete} onClick={() => deleteFixed(expense.id)}><Trash2 size={17} /></button></div><div className="fb-fixed-meta"><span className={expense.active ? "is-active" : ""}>{expense.active ? t.active : t.paused}</span><span>{expense.recurrence === "monthly" ? `${repeatMonths}: ${expense.intervalMonths || 1}` : t[expense.recurrence]}</span><span>{reminderLabel}: {expense.reminderDays ?? 3}</span><span>{formatDate(expense.dueDate)}</span>{due.length > 0 && <span>{due.map(formatDate).join(" · ")}</span>}</div><div className="fb-planning-card-actions"><button type="button" disabled={!!expense.budgetId && !parent} onClick={() => open("fixed", parent?.id, expense)}>{t.edit}</button><button type="button" onClick={() => updateState((current) => ({ ...current, fixedExpenses: (current.fixedExpenses || []).map((item) => item.id === expense.id ? { ...item, active: !item.active } : item) }))}>{expense.active ? t.pause : t.resume}</button></div></article>;
    })}<p className="fb-planning-note">{t.noPayment}</p></div>}
    {state.goals.some((item) => item.kind === "savings") && <details className="fb-planning-legacy"><summary>{t.oldSavings}</summary><ul>{state.goals.filter((item) => item.kind === "savings").map((item) => <li key={item.id}>{item.title} · {format(item.saved, item.currency)} / {format(item.amount, item.currency)}</li>)}</ul></details>}
    {form && <Modal title={form === "budget" ? t.addBudget : editingId ? t.edit + " · " + t.fixed : t.addFixed} onClose={() => setForm("")}><form className="r-form fb-planning-form" onSubmit={save}>
      {form === "fixed" && <><label>{t.parent}<select value={parentId} onChange={(event) => selectParent(event.target.value)}><option value="">{unassigned}</option>{budgets.filter((item) => activeWallets.some((wallet) => wallet.id === item.wallet && wallet.currency === item.currency)).map((item) => <option key={item.id} value={item.id}>{item.title} · {item.currency}</option>)}</select></label>{selectedParent && <p className="fb-planning-note">{t.parentContext} {walletName(selectedParent.wallet)} · {selectedParent.currency}</p>}</>}
      <label>{t.name}<input aria-label={t.name} placeholder={form === "budget" ? t.budgetPlaceholder : t.fixedPlaceholder} required maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      {(form === "budget" || !selectedParent) && <label>{t.wallet}<select value={walletId} required onChange={(event) => { setWalletId(event.target.value); setAmount(""); }}>{activeWallets.map((item) => <option key={item.id} value={item.id}>{walletName(item.id)} · {item.currency}</option>)}</select></label>}
      <label>{t.amount} · {form === "fixed" && selectedParent ? selectedParent.currency : selectedWallet?.currency}<input aria-label={t.amount} type="number" min="0.01" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      {form === "fixed" && <><label>{repeatMonths}<input type="number" min={1} max={12} step={1} value={intervalMonths} onChange={event => setIntervalMonths(Number(event.target.value))} /></label><label>{reminderLabel}<input type="number" min={0} max={30} step={1} value={reminderDays} onChange={event => setReminderDays(Number(event.target.value))} /></label><label>{SETUP_COPY[lang].monthPosition}<select value={monthPosition} onChange={event => setMonthPosition(event.target.value as typeof monthPosition)}>{(["start", "end", "date"] as const).map((p, i) => <option key={p} value={p}>{SETUP_COPY[lang].positions[i]}</option>)}</select></label></>}
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
