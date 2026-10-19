import { z } from "zod";
import type { AppState } from "../components/sites/rolly/replica/store";

export type PlanningKind = "budget" | "fixed_expense";
export const planningReferencesSchema = z.array(z.object({ kind: z.enum(["budget", "fixed_expense"]), id: z.string().min(1).max(100), title: z.string().max(10000) }).strict()).max(500);
export const planningDeleteRequestSchema = z.object({ kind: z.enum(["budget", "fixed_expense"]), ids: z.array(z.string().min(1).max(100)).max(500), searchTerm: z.string().max(160).nullable(), scope: z.enum(["matching", "all"]) }).strict();
export const planningDeletionSchema = z.object({
  id: z.string().uuid(), kind: z.enum(["budget", "fixed_expense"]),
  targets: z.array(z.object({ id: z.string().min(1).max(100), title: z.string().max(10000), amount: z.number().finite(), currency: z.string().max(8), wallet: z.string().max(100), linked: z.number().int().nonnegative(), signature: z.string().max(20000) }).strict()).max(500),
  selectedIds: z.array(z.string().min(1).max(100)).max(500),
  status: z.enum(["pending", "saving", "confirmed", "cancelled", "failed"]),
  applied: z.boolean().optional(), error: z.string().max(500).optional(),
}).strict().refine(p => new Set(p.targets.map(t => t.id)).size === p.targets.length && new Set(p.selectedIds).size === p.selectedIds.length && p.selectedIds.every(id => p.targets.some(t => t.id === id)), "Invalid selection");
export type PlanningDeletion = z.infer<typeof planningDeletionSchema>;
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[.!?]+$/g, "").trim();

export function planningEntities(state: Pick<AppState, "goals" | "fixedExpenses" | "wallets">, kind: PlanningKind) {
  return (kind === "budget" ? state.goals.filter(g => g.kind === "budget") : state.fixedExpenses || []).map(record => {
    const budget = kind === "fixed_expense" ? state.goals.find(g => g.kind === "budget" && g.id === (record as NonNullable<AppState["fixedExpenses"]>[number]).budgetId) : record as AppState["goals"][number];
    const walletId = kind === "budget" ? (record as AppState["goals"][number]).wallet : budget?.wallet || (record as NonNullable<AppState["fixedExpenses"]>[number]).walletId;
    const wallet = state.wallets.find(w => w.id === walletId);
    // Include schedule/limit changes and parent changes in the review boundary.
    const snapshot = { ...record };
    if ("paymentRecipient" in snapshot) delete snapshot.paymentRecipient;
    const linkedIds = kind === "budget" ? (state.fixedExpenses || []).filter(e => e.budgetId === record.id).map(e => e.id).sort() : [];
    return { id: record.id, title: record.title, amount: record.amount, currency: budget?.currency || wallet?.currency || "", wallet: wallet?.name || "", linked: linkedIds.length, signature: JSON.stringify({ record: snapshot, walletId, currency: wallet?.currency, linkedIds }) };
  });
}

/** Boundary repair only: explicit planning nouns must never become transaction
 * deletion. Other intent understanding remains the structured model's job. */
export function explicitPlanningDeletion(message: string, state?: Pick<AppState, "fixedExpenses">): PlanningKind | null {
  const text = normalize(message);
  if (!/\b(?:xoa|bo|huy|delete|remove|cancel)\b|删除|移除/.test(text) || /\b(?:giao dich|transaction)\b|交易/.test(text)) return null;
  if (/\b(?:ngan sach|budgets?)\b|预算/.test(text)) return "budget";
  if (/\b(?:chi phi co dinh|khoan chi co dinh|fixed expenses?|recurring (?:bills?|expenses?)|fixed bills?)\b|固定支出|定期账单/.test(text)) return "fixed_expense";
  if (/\b(?:chi phi|hoa don)\b|账单/.test(text) && state?.fixedExpenses?.some(e => normalize(e.title).length >= 3 && text.includes(normalize(e.title)))) return "fixed_expense";
  return null;
}

export function preparePlanningDeletion(state: AppState, request: z.infer<typeof planningDeleteRequestSchema>, id: string): PlanningDeletion {
  const all = planningEntities(state, request.kind), known = new Set(all.map(t => t.id));
  if (request.ids.some(id => !known.has(id))) throw new Error("PLANNING_TARGET_UNAVAILABLE");
  let selected = request.ids;
  const term = normalize(request.searchTerm || "");
  if (!selected.length && term) {
    const exact = all.filter(t => normalize(t.title) === term);
    const candidates = exact.length ? exact : all.filter(t => normalize(t.title).includes(term));
    if (candidates.length === 1) selected = [candidates[0].id];
  }
  if (request.scope === "all") selected = all.map(t => t.id);
  // A missing name still requires review. Never select all by default.
  if (!selected.length && all.length === 1 && !term) selected = [all[0].id];
  return planningDeletionSchema.parse({ id, kind: request.kind, targets: selected.length ? all.filter(t => selected.includes(t.id)) : all, selectedIds: selected, status: "pending" });
}

/** Shared with Planning CRUD: deleting a budget detaches schedules, never
 * deletes recorded payments or changes the wallet's money. */
export function deletePlanningRecords(state: AppState, kind: PlanningKind, ids: string[]): AppState {
  const selected = new Set(ids);
  if (kind === "fixed_expense") return { ...state, fixedExpenses: (state.fixedExpenses || []).filter(e => !selected.has(e.id)) };
  const budgets = new Map(state.goals.filter(g => g.kind === "budget" && selected.has(g.id)).map(g => [g.id, g]));
  return { ...state, goals: state.goals.filter(g => !budgets.has(g.id)), fixedExpenses: (state.fixedExpenses || []).map(e => budgets.has(e.budgetId) ? { ...e, walletId: budgets.get(e.budgetId)!.wallet, budgetId: "" } : e) };
}

export function applyPlanningDeletion(state: AppState, raw: PlanningDeletion): AppState {
  const proposal = planningDeletionSchema.parse(raw);
  if (proposal.applied || !["pending", "failed"].includes(proposal.status) || !proposal.selectedIds.length) throw new Error("PLANNING_CONFIRMATION_REQUIRED");
  const current = planningEntities(state, proposal.kind);
  for (const id of proposal.selectedIds) if (current.find(t => t.id === id)?.signature !== proposal.targets.find(t => t.id === id)?.signature) throw new Error("PLANNING_DATA_CHANGED");
  return deletePlanningRecords(state, proposal.kind, proposal.selectedIds);
}

export function planningSelectionReply(message: string, proposal: PlanningDeletion): string | null {
  const text = normalize(message).replace(/^(?:chon|xoa|select|delete|选择|删除)\s*/u, "");
  const matches = proposal.targets.filter(t => normalize(t.title) === text);
  return matches.length === 1 ? matches[0].id : null;
}

export function planningConfirmationReply(message: string): "confirm" | "cancel" | null {
  const text = normalize(message).replace(/\s+(?:nhe|nha|please)$/u, "");
  if (/^(?:xac nhan(?: xoa)?|dong y|confirm(?: deletion)?|yes|ok|确认(?:删除)?)$/.test(text)) return "confirm";
  if (/^(?:huy yeu cau xoa|cancel(?: the)? deletion|取消删除)(?: (?:ngan sach|chi phi co dinh|khoan co dinh|nay|this budget|this bill))?$/.test(text)) return "cancel";
  if (/^(?:huy(?: (?:xoa|yeu cau xoa))?|khong(?: xoa(?: nua)?)?|dung xoa|giu lai|thoi|cancel(?: deletion)?|no|取消(?:删除)?)$/.test(text)) return "cancel";
  return null;
}

export const planningDeletionCopy = {
  vi: { budget: "Xóa ngân sách", fixed_expense: "Xóa khoản cố định", choose: "Bạn muốn xóa mục nào? Chọn bên dưới rồi xác nhận nhé.", review: "Finn sẽ xóa các mục bạn chọn. Bạn kiểm tra rồi xác nhận nhé; hiện dữ liệu vẫn được giữ.", confirm: "Xác nhận xóa", cancel: "Hủy", saved: "Đã xóa các mục bạn xác nhận. Các giao dịch đã ghi nhận vẫn được giữ.", cancelled: "Đã hủy yêu cầu xóa. Dữ liệu vẫn được giữ.", saving: "Đang lưu…", failed: "Chưa xác nhận được việc lưu. Bạn thử lại nhé.", stale: "Thông tin đã thay đổi. Bạn yêu cầu lại để Finn hiển thị bản mới trước khi xóa nhé.", empty: "Chưa có mục nào thuộc loại này để xóa.", effectBudget: "Khoản cố định gắn với ngân sách sẽ được giữ, chuyển thành khoản không gắn ngân sách. Không thay đổi số dư hoặc lịch sử giao dịch.", effectFixed: "Xóa lịch cố định và các lần nhắc tiếp theo của lịch đó. Những giao dịch đã thanh toán vẫn được giữ.", selectRequired: "Chọn ít nhất một mục để tiếp tục.", selected: "mục được chọn", linked: "khoản cố định được giữ" },
  en: { budget: "Delete budgets", fixed_expense: "Delete fixed expenses", choose: "Which items should I delete? Select them below, then confirm.", review: "Review the selected items, then confirm deletion. Your data has not changed yet.", confirm: "Confirm deletion", cancel: "Cancel", saved: "The confirmed items were deleted. Recorded transactions are kept.", cancelled: "Deletion cancelled. Your data is kept.", saving: "Saving…", failed: "Saving has not been confirmed. Please retry.", stale: "Details changed. Ask again to review the current items before deleting.", empty: "There are no items of this type to delete.", effectBudget: "Linked fixed expenses are kept without a budget link. Wallet balances and transaction history are unchanged.", effectFixed: "Removes the schedule and its future reminders. Recorded payments are kept.", selectRequired: "Select at least one item to continue.", selected: "items selected", linked: "fixed expenses kept" },
  zh: { budget: "删除预算", fixed_expense: "删除固定支出", choose: "你想删除哪些项目？请在下方选择后确认。", review: "请检查所选项目并确认删除，目前数据尚未更改。", confirm: "确认删除", cancel: "取消", saved: "已删除确认的项目，保留已记录交易。", cancelled: "已取消删除，数据保持不变。", saving: "正在保存…", failed: "尚未确认保存成功，请重试。", stale: "信息已变化，请重新请求并检查后再删除。", empty: "没有此类项目可删除。", effectBudget: "关联固定支出将保留并取消预算关联，不改变钱包余额或交易历史。", effectFixed: "删除计划及后续提醒，已记录付款保持不变。", selectRequired: "请至少选择一项。", selected: "个项目已选择", linked: "笔固定支出将保留" },
} as const;
