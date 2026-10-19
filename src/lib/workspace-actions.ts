import { z } from "zod";
import type { AppState, FixedExpense, Goal, Wallet } from "../components/sites/rolly/replica/store";
import { currencyScale, validBudget, validFixedExpense } from "../components/sites/rolly/replica/planningModel";
import { workspaceSchema } from "./workspace-model";

export type ActionLanguage = "en" | "vi" | "zh";
const nullableName = z.string().trim().min(1).max(100).nullable();
export const workspaceActionSchema = z.object({
  id: z.string().uuid(), kind: z.enum(["wallet", "budget", "fixed_expense"]),
  name: nullableName, currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  walletType: z.enum(["cash", "credit"]).nullable(),
  initialBalance: z.number().finite().min(-1e12).max(1e12).nullable(),
  creditLimit: z.number().finite().positive().max(1e12).nullable(),
  amount: z.number().finite().positive().max(1e12).nullable(),
  walletId: z.string().max(100).nullable(), budgetId: z.string().max(100).nullable(),
  category: z.string().max(100).nullable(), date: z.string().max(10).nullable(),
  cycle: z.enum(["weekly", "monthly", "yearly"]).nullable(),
  recurrence: z.enum(["once", "weekly", "monthly", "yearly"]).nullable(),
  intervalMonths: z.number().int().min(1).max(12).nullable(),
  monthPosition: z.enum(["start", "end", "date"]).nullable(),
  reminderDays: z.number().int().min(0).max(30).nullable(),
}).strict();
export type WorkspaceAction = z.infer<typeof workspaceActionSchema>;
export const workspaceProposalSchema = z.object({
  id: z.string().uuid(), actions: z.array(workspaceActionSchema).min(1).max(6),
  status: z.enum(["collecting", "review", "saving", "confirmed", "cancelled", "failed"]),
  applied: z.boolean().optional(), error: z.string().max(500).optional(),
}).strict().refine(proposal => new Set(proposal.actions.map(action => action.id)).size === proposal.actions.length, "Duplicate action IDs");
export type WorkspaceProposal = z.infer<typeof workspaceProposalSchema>;
export type ActionField = Exclude<keyof WorkspaceAction, "id" | "kind">;
export interface ActionQuestion { operationId: string; field: ActionField; text: string; choices: Array<{ label: string; value: string | number }> }
const normalized = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/đ/g, "d");
export function isWorkspaceCreationRequest(message: string) {
  const text = normalized(message);
  return /\b(tao|lap|mo|them|create|open|set up|add)\b|创建|新建|添加/.test(text)
    && /\b(vi|ngan sach|chi phi co dinh|khoan chi co dinh|wallet|budget|fixed expense|recurring bill)\b|钱包|预算|固定支出/.test(text)
    && !/\b(neu|gia su|gia dinh|what if|simulate)\b|如果|假设/.test(text);
}
export function emptyWorkspaceAction(kind: WorkspaceAction["kind"], id: string): WorkspaceAction {
  return { id, kind, name: null, currency: null, walletType: null, initialBalance: null, creditLimit: null, amount: null, walletId: null, budgetId: null, category: null, date: null, cycle: null, recurrence: null, intervalMonths: null, monthPosition: null, reminderDays: null };
}
export const workspaceActionCopy = {
  vi: { intervalMonths: "Chu kỳ (tháng)", monthPosition: "Thời điểm trong tháng", reminderDays: "Nhắc trước (ngày)", start: "Đầu tháng", end: "Cuối tháng", onDate: "Ngày cụ thể", wallet: "Ví mới", budget: "Ngân sách mới", fixed_expense: "Chi phí cố định mới", confirm: "Xác nhận tạo", cancel: "Hủy", collecting: "Finn cần thêm thông tin", review: "Kiểm tra trước khi tạo", saving: "Đang lưu…", confirmed: "Đã tạo và lưu", cancelled: "Đã hủy", failed: "Chưa xác nhận lưu thành công", edit: "Nhắn trong chat nếu muốn chỉnh sửa.", ready: "Đã đủ thông tin. Bạn kiểm tra bên dưới rồi xác nhận để Finn tạo nhé.", saved: "Finn đã tạo và lưu các mục bạn xác nhận.", name: "Tên", currency: "Tiền tệ", walletType: "Loại ví", initialBalance: "Số dư ban đầu", creditLimit: "Hạn mức tín dụng", amount: "Số tiền", walletId: "Ví", budgetId: "Ngân sách", category: "Danh mục", date: "Ngày bắt đầu", cycle: "Kỳ ngân sách", recurrence: "Lặp lại", all: "Tất cả danh mục chi", standalone: "Không gắn ngân sách", cash: "Ví thường", credit: "Ví tín dụng", weekly: "Hàng tuần", monthly: "Hàng tháng", yearly: "Hàng năm", once: "Một lần", unavailable: "Chưa xử lý được yêu cầu. Tin nhắn vẫn được giữ; bạn thử lại nhé.", invalid: "Thông tin chưa hợp lệ hoặc dữ liệu đã thay đổi. Hãy bổ sung hoặc chỉnh lại trong chat.", duplicate: "Đã có mục cùng tên hoặc trùng nội dung. Bạn hãy dùng mục hiện có hoặc chọn tên khác.", noWallet: "Chưa có ví phù hợp. Bạn có thể yêu cầu Finn tạo ví trước.", noCategory: "Chưa có danh mục chi phù hợp. Bạn có thể yêu cầu tạo danh mục trước.", retry: "Thử lưu lại", addCategory: "+ Thêm danh mục", newCategoryName: "Tên danh mục mới", createAndSelect: "Tạo và chọn", enterCategoryName: "Nhập tên danh mục…" },
  en: { intervalMonths: "Interval (months)", monthPosition: "Position in month", reminderDays: "Reminder (days before)", start: "Start of month", end: "End of month", onDate: "Specific day", wallet: "New wallet", budget: "New budget", fixed_expense: "New fixed expense", confirm: "Confirm creation", cancel: "Cancel", collecting: "Finn needs more details", review: "Review before creating", saving: "Saving…", confirmed: "Created and saved", cancelled: "Cancelled", failed: "Saving not confirmed", edit: "Send a message to change the details.", ready: "Everything is ready. Review the details and confirm to create.", saved: "Finn created and saved the items you confirmed.", name: "Name", currency: "Currency", walletType: "Wallet type", initialBalance: "Opening balance", creditLimit: "Credit limit", amount: "Amount", walletId: "Wallet", budgetId: "Budget", category: "Category", date: "Start date", cycle: "Budget period", recurrence: "Recurrence", all: "All expense categories", standalone: "No linked budget", cash: "Regular wallet", credit: "Credit wallet", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly", once: "Once", unavailable: "The request could not be processed. Your message is kept; please try again.", invalid: "Details are invalid or data has changed. Please update the details in chat.", duplicate: "An item with this name or these details already exists. Use it or choose another name.", noWallet: "No matching wallet exists. You can ask Finn to create one first.", noCategory: "No matching expense category exists. You can request a category first.", retry: "Retry saving", addCategory: "+ Add category", newCategoryName: "New category name", createAndSelect: "Create and select", enterCategoryName: "Enter category name…" },
  zh: { intervalMonths: "间隔（月）", monthPosition: "月内时间", reminderDays: "提前提醒（天）", start: "月初", end: "月末", onDate: "指定日期", wallet: "新钱包", budget: "新预算", fixed_expense: "新固定支出", confirm: "确认创建", cancel: "取消", collecting: "Finn 需要更多信息", review: "创建前请检查", saving: "正在保存…", confirmed: "已创建并保存", cancelled: "已取消", failed: "尚未确认保存成功", edit: "如需修改，请在聊天中说明。", ready: "信息已完整，请检查后确认创建。", saved: "Finn 已创建并保存你确认的项目。", name: "名称", currency: "币种", walletType: "钱包类型", initialBalance: "初始余额", creditLimit: "信用额度", amount: "金额", walletId: "钱包", budgetId: "预算", category: "类别", date: "开始日期", cycle: "预算周期", recurrence: "重复周期", all: "全部支出类别", standalone: "不关联预算", cash: "普通钱包", credit: "信用钱包", weekly: "每周", monthly: "每月", yearly: "每年", once: "一次", unavailable: "暂时无法处理，消息已保留，请重试。", invalid: "信息无效或数据已变化，请在聊天中修改。", duplicate: "已有同名或相同内容的项目，请使用已有项目或更换名称。", noWallet: "没有匹配的钱包，可以先请 Finn 创建。", noCategory: "没有匹配的支出类别，可以先创建类别。", retry: "重试保存", addCategory: "+ 添加类别", newCategoryName: "新类别名称", createAndSelect: "创建并选择", enterCategoryName: "输入类别名称…" },
} as const;

function isDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Resolve a date-only follow-up against the active question, never an arbitrary
 * date mentioned in a longer request. UTC arithmetic preserves the client's
 * local calendar day across server time zones and daylight-saving changes. */
export function resolveWorkspaceDateReply(message: string, today: string): { date: string | null; candidates?: string[] } | null {
  if (!isDate(today)) return null;
  const text = normalized(message).replace(/[.!。！]+$/u, "").trim()
    .replace(/^(?:(?:ngay\s+)?(?:bat dau|den han|thanh toan)|start(?:ing)?\s+date|due\s+date|payment\s+date|开始日期|到期日|付款日期)\s*(?:la|vao|is|on|:|：|是)?\s*/u, "")
    .replace(/^(?:la|vao|on|is|:|：|是)\s+/u, "")
    .replace(/\s+(?:nhe|a|please)$/u, "");
  const relativeDays: Record<string, number> = { "hom nay": 0, "ngay hom nay": 0, today: 0, "ngay mai": 1, mai: 1, tomorrow: 1, "ngay kia": 2, "ngay mot": 2, "the day after tomorrow": 2, "day after tomorrow": 2, "tuan sau": 7, "ngay nay tuan sau": 7, "next week": 7, 今天: 0, 明天: 1, 后天: 2, 下周: 7 };
  if (Object.hasOwn(relativeDays, text)) {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + relativeDays[text]);
    return { date: date.toISOString().slice(0, 10) };
  }
  const explicit = text.replace(/^(?:ngay|date)\s+/u, "");
  const iso = explicit.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const local = explicit.match(/^(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{4}))?$/);
  const vietnamese = text.match(/^(?:ngay\s+)?(\d{1,2})\s+thang\s+(\d{1,2})(?:\s+nam\s+(\d{4}))?$/);
  const chinese = explicit.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日?$/u);
  const key = (year: string, month: string, day: string) => `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const yearFirst = iso || chinese;
  if (yearFirst) {
    const date = key(yearFirst[1], yearFirst[2], yearFirst[3]);
    return { date: isDate(date) ? date : null };
  }
  if (vietnamese) {
    const date = key(vietnamese[3] || today.slice(0, 4), vietnamese[2], vietnamese[1]);
    return { date: isDate(date) ? date : null };
  }
  if (!local) return null;
  const year = local[3] || today.slice(0, 4);
  // Accept either day/month or month/day only when the calendar uniquely
  // determines the order. Never infer it from the UI language alone.
  const candidates = [...new Set([key(year, local[2], local[1]), key(year, local[1], local[2])])].filter(isDate);
  return { date: candidates.length === 1 ? candidates[0] : null, ...(candidates.length > 1 ? { candidates } : {}) };
}

function preciseMoney(value: number, currency: string) {
  const scale = currencyScale(currency);
  return Math.abs(value * scale - Math.round(value * scale)) < 0.0001;
}
function matchesRecord(existing: object, record: object) {
  return Object.entries(record).every(([key, value]) => Reflect.get(existing, key) === value);
}
export function inspectWorkspaceProposal(state: AppState, proposal: WorkspaceProposal, language: ActionLanguage): { proposal: WorkspaceProposal; question: ActionQuestion | null; error: string | null } {
  const t = workspaceActionCopy[language];
  const actions = proposal.actions.map(action => workspaceActionSchema.parse(action));
  const preview = { ...state, wallets: [...state.wallets], goals: [...state.goals], fixedExpenses: [...(state.fixedExpenses || [])] };
  const ordered = [...actions].sort((a, b) => ["wallet", "budget", "fixed_expense"].indexOf(a.kind) - ["wallet", "budget", "fixed_expense"].indexOf(b.kind));
  for (const action of ordered) {
    const ask = (field: ActionField, choices: ActionQuestion["choices"] = [], extra = "") => ({ proposal: { ...proposal, actions, status: "collecting" as const }, question: { operationId: action.id, field, text: language === "vi" ? `${t[action.kind]}${action.name ? ` “${action.name}”` : ""}: bạn cho Finn biết ${t[field].toLowerCase()} nhé.${extra ? ` ${extra}` : ""}` : language === "zh" ? `${t[action.kind]}${action.name ? `「${action.name}」` : ""}：请提供${t[field]}。${extra}` : `${t[action.kind]}${action.name ? ` “${action.name}”` : ""}: what ${t[field].toLowerCase()} should Finn use? ${extra}`.trim(), choices }, error: null });
    const fail = (duplicate = false) => ({ ...ask("name"), error: duplicate ? t.duplicate : t.invalid });
    if (!action.name) return ask("name");
    if (action.kind === "wallet") {
      if (!action.currency) return ask("currency", ["VND", "USD", "CNY", "EUR", "GBP", "AUD", "SGD", "JPY"].map(value => ({ label: value, value })));
      if (!Intl.supportedValuesOf("currency").includes(action.currency)) return { ...ask("currency"), error: t.invalid };
      if (!action.walletType) return ask("walletType", ["cash", "credit"].map(value => ({ label: t[value as "cash" | "credit"], value })));
      if (action.initialBalance === null || !preciseMoney(action.initialBalance, action.currency)) return ask("initialBalance");
      if (action.walletType === "credit" && (action.creditLimit === null || !preciseMoney(action.creditLimit, action.currency))) return ask("creditLimit");
      const record: Wallet = { id: action.id, name: action.name, currency: action.currency, initial: action.initialBalance, type: action.walletType, ...(action.walletType === "credit" && action.creditLimit !== null ? { limit: action.creditLimit } : {}) };
      const existing = preview.wallets.find(wallet => wallet.id === action.id);
      if (existing) { if (existing.archived || !matchesRecord(existing, record)) return fail(); }
      else {
        if (preview.wallets.some(wallet => normalized(wallet.name) === normalized(action.name!))) return fail(true);
        preview.wallets.push(record);
      }
      continue;
    }
    const budgets = preview.goals.filter(goal => goal.kind === "budget" && preview.wallets.some(wallet => wallet.id === goal.wallet && !wallet.archived));
    if (action.kind === "fixed_expense" && action.budgetId === null) return ask("budgetId", [{ label: t.standalone, value: "" }, ...budgets.map(budget => ({ label: budget.title, value: budget.id }))]);
    const parent = action.kind === "fixed_expense" && action.budgetId ? budgets.find(budget => budget.id === action.budgetId) : null;
    if (action.kind === "fixed_expense" && action.budgetId && !parent) return { ...ask("budgetId", [{ label: t.standalone, value: "" }, ...budgets.map(budget => ({ label: budget.title, value: budget.id }))]), error: t.invalid };
    if (parent) { action.walletId = parent.wallet; if (parent.category) action.category = parent.category; }
    const wallets = preview.wallets.filter(wallet => !wallet.archived && (!action.currency || wallet.currency === action.currency));
    const wallet = wallets.find(wallet => wallet.id === action.walletId);
    if (!wallet) return ask("walletId", wallets.map(wallet => ({ label: `${wallet.name} · ${wallet.currency}`, value: wallet.id })), !wallets.length ? t.noWallet : "");
    action.currency = wallet.currency;
    if (action.amount === null || !preciseMoney(action.amount, wallet.currency)) return ask("amount");
    if (!isDate(action.date)) return { ...ask("date"), error: action.date ? (language === "vi" ? "Ngày chưa hợp lệ. Bạn có thể nhập “ngày mai” hoặc ngày/tháng/năm, ví dụ 20/10/2026." : language === "zh" ? "日期无效。请输入“明天”或 YYYY-MM-DD 格式的日期。" : "Invalid date. Enter “tomorrow” or a date in YYYY-MM-DD format.") : null };
    if (parent && action.date < parent.date) return { ...ask("date"), error: language === "vi" ? `Ngày đến hạn phải từ ngày bắt đầu ngân sách (${parent.date}) trở đi.` : language === "zh" ? `到期日不能早于预算开始日期（${parent.date}）。` : `The due date must be on or after the budget start (${parent.date}).` };
    if (action.kind === "budget" && !action.cycle) return ask("cycle", ["weekly", "monthly", "yearly"].map(value => ({ label: t[value as "weekly" | "monthly" | "yearly"], value })));
    if (action.kind === "fixed_expense" && !action.recurrence) return ask("recurrence", ["once", "weekly", "monthly", "yearly"].map(value => ({ label: t[value as "once" | "weekly" | "monthly" | "yearly"], value })));
    if (action.kind === "fixed_expense" && action.monthPosition && action.monthPosition !== "date") {
      const [year, month] = action.date.split("-").map(Number);
      action.date = `${year}-${String(month).padStart(2, "0")}-${String(action.monthPosition === "start" ? 1 : new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
      if (parent && action.date < parent.date) return ask("date");
    }
    const categories = state.categories.filter(name => !state.categoryMeta[name]?.archived && (state.categoryMeta[name]?.type || "expense") === "expense" && (!state.walletCategories?.[wallet.id] || state.walletCategories[wallet.id].includes(name)));
    if (action.category === null || (action.kind === "fixed_expense" && !action.category) || (action.category && !categories.includes(action.category))) return ask("category", [...(action.kind === "budget" ? [{ label: t.all, value: "" }] : []), ...categories.map(name => ({ label: name, value: name }))], !categories.length ? t.noCategory : "");
    if (action.kind === "budget") {
      const record: Goal = { id: action.id, kind: "budget", title: action.name, amount: action.amount, saved: 0, currency: wallet.currency, date: action.date, cycle: action.cycle!, category: action.category, wallet: wallet.id, direction: "", person: "" };
      if (!validBudget(preview, record)) return fail();
      const existing = preview.goals.find(goal => goal.id === action.id);
      if (existing) { if (!matchesRecord(existing, record)) return fail(); }
      else {
        if (preview.goals.some(goal => goal.kind === "budget" && goal.wallet === wallet.id && normalized(goal.title) === normalized(action.name!))) return fail(true);
        preview.goals.push(record);
      }
    } else {
      const record: FixedExpense = { id: action.id, title: action.name, amount: action.amount, budgetId: parent?.id || "", walletId: wallet.id, category: action.category, dueDate: action.date, recurrence: action.recurrence!, active: true, ...(action.intervalMonths !== null ? { intervalMonths: action.intervalMonths } : {}), ...(action.monthPosition ? { monthPosition: action.monthPosition } : {}), ...(action.reminderDays !== null ? { reminderDays: action.reminderDays } : {}) };
      if (!validFixedExpense(preview, record)) return fail();
      const existing = preview.fixedExpenses.find(expense => expense.id === action.id);
      if (existing) { if (!matchesRecord(existing, record)) return fail(); }
      else {
        if (preview.fixedExpenses.some(expense => expense.walletId === wallet.id && normalized(expense.title) === normalized(action.name!) && expense.dueDate === action.date && expense.amount === action.amount)) return fail(true);
        preview.fixedExpenses.push(record);
      }
    }
  }
  // Validate only affected collections while asking questions. Validating every
  // transaction on every chat render would grow with the entire ledger.
  if (!workspaceSchema.shape.wallets.safeParse(preview.wallets).success || !workspaceSchema.shape.goals.safeParse(preview.goals).success || !workspaceSchema.shape.fixedExpenses.safeParse(preview.fixedExpenses).success) return { proposal: { ...proposal, actions, status: "collecting" }, question: null, error: t.invalid };
  return { proposal: { ...proposal, actions, status: "review" }, question: null, error: null };
}

/** Revalidate the entire preview against the current workspace. Stable object
 * IDs make retries idempotent; records are appended only after confirmation. */
export function applyWorkspaceProposal(state: AppState, proposal: WorkspaceProposal, language: ActionLanguage): AppState {
  if (!["review", "failed"].includes(proposal.status)) throw new Error(workspaceActionCopy[language].invalid);
  const inspection = inspectWorkspaceProposal(state, proposal, language);
  if (inspection.error || inspection.question) throw new Error(inspection.error || workspaceActionCopy[language].invalid);
  if (JSON.stringify(inspection.proposal.actions) !== JSON.stringify(proposal.actions)) throw new Error(workspaceActionCopy[language].invalid);
  let next = { ...state, wallets: [...state.wallets], goals: [...state.goals], fixedExpenses: [...(state.fixedExpenses || [])] };
  for (const action of inspection.proposal.actions.filter(action => action.kind === "wallet")) {
    if (!next.wallets.some(item => item.id === action.id)) next.wallets.push({ id: action.id, name: action.name!, currency: action.currency!, initial: action.initialBalance!, type: action.walletType!, ...(action.walletType === "credit" ? { limit: action.creditLimit! } : {}) });
  }
  for (const action of inspection.proposal.actions.filter(action => action.kind === "budget")) {
    if (!next.goals.some(item => item.id === action.id)) next.goals.push({ id: action.id, kind: "budget", title: action.name!, amount: action.amount!, saved: 0, currency: action.currency!, date: action.date!, cycle: action.cycle!, category: action.category!, wallet: action.walletId!, direction: "", person: "" });
  }
  for (const action of inspection.proposal.actions.filter(action => action.kind === "fixed_expense")) {
    if (!next.fixedExpenses.some(item => item.id === action.id)) next.fixedExpenses.push({ id: action.id, title: action.name!, amount: action.amount!, budgetId: action.budgetId || "", walletId: action.walletId!, category: action.category!, dueDate: action.date!, recurrence: action.recurrence!, active: true, ...(action.intervalMonths !== null ? { intervalMonths: action.intervalMonths } : {}), ...(action.monthPosition ? { monthPosition: action.monthPosition } : {}), ...(action.reminderDays !== null ? { reminderDays: action.reminderDays } : {}) });
  }
  if (next.walletCategories) next = { ...next, walletCategories: Object.fromEntries(next.wallets.map(wallet => [wallet.id, next.walletCategories?.[wallet.id] || [...state.categories]])) };
  if (!workspaceSchema.safeParse(JSON.parse(JSON.stringify(next))).success) throw new Error(workspaceActionCopy[language].invalid);
  return next;
}
