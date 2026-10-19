import { z } from "zod";
import type { AppState, FixedExpense, Goal } from "../components/sites/rolly/replica/store";
import { expenseWallet, fixedExpensePayment, nextExpenseDue, recordFixedExpensePayment, unpaidOccurrences } from "./fixed-expense-payments";
import { validBudget, validFixedExpense, plannedOccurrences } from "../components/sites/rolly/replica/planningModel";
import { parseTransactionAmounts } from "./transaction-drafts";

// 1. Bill Payment Proposal Schema & Types
export const fixedExpensePaymentProposalSchema = z.object({
  id: z.string().uuid(),
  expenseId: z.string().min(1).max(100),
  expenseTitle: z.string().max(1000),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().finite().positive().max(1e12),
  currency: z.string().max(8),
  walletId: z.string().max(100),
  walletName: z.string().max(100),
  category: z.string().max(100),
  status: z.enum(["pending", "saving", "confirmed", "cancelled", "failed"]),
  applied: z.boolean().optional(),
  alreadyPaid: z.boolean().optional(),
  error: z.string().max(500).optional(),
  transactionId: z.string().max(100).optional(),
}).strict();
export type FixedExpensePaymentProposal = z.infer<typeof fixedExpensePaymentProposalSchema>;

// 2. Fixed Expense Status (Pause / Resume) Schema & Types
export const fixedExpenseStatusProposalSchema = z.object({
  id: z.string().uuid(),
  expenseId: z.string().min(1).max(100),
  expenseTitle: z.string().max(1000),
  action: z.enum(["pause", "resume"]),
  currentActive: z.boolean(),
  targetActive: z.boolean(),
  wallet: z.string().max(100),
  amount: z.number().finite().positive(),
  currency: z.string().max(8),
  status: z.enum(["pending", "saving", "confirmed", "cancelled", "failed"]),
  applied: z.boolean().optional(),
  error: z.string().max(500).optional(),
}).strict();
export type FixedExpenseStatusProposal = z.infer<typeof fixedExpenseStatusProposalSchema>;

// 3. Planning Edit Schema & Types
export const planningEditProposalSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["budget", "fixed_expense"]),
  targetId: z.string().min(1).max(100),
  title: z.string().max(1000),
  changes: z.object({
    title: z.object({ from: z.string(), to: z.string() }).optional(),
    amount: z.object({ from: z.number(), to: z.number() }).optional(),
  }).strict(),
  currency: z.string().max(8),
  wallet: z.string().max(100),
  status: z.enum(["pending", "saving", "confirmed", "cancelled", "failed"]),
  applied: z.boolean().optional(),
  error: z.string().max(500).optional(),
}).strict();
export type PlanningEditProposal = z.infer<typeof planningEditProposalSchema>;

// Copy dictionaries for i18n
export const fixedExpensePaymentCopy = {
  vi: {
    title: "Xác nhận thanh toán khoản chi cố định",
    expense: "Khoản chi",
    dueDate: "Kỳ thanh toán",
    wallet: "Ví thanh toán",
    amount: "Số tiền",
    category: "Danh mục",
    note: "Ghi nhận 1 giao dịch chi tiêu và đánh dấu kỳ này đã hoàn thành.",
    alreadyPaid: "Kỳ này đã được thanh toán trước đó. Xác nhận lại sẽ không ghi nhận trùng.",
    confirm: "Xác nhận thanh toán",
    cancel: "Hủy",
    saving: "Đang lưu…",
    saved: "Đã ghi nhận thanh toán thành công!",
    cancelled: "Đã hủy yêu cầu thanh toán.",
    failed: "Chưa ghi nhận được thanh toán. Vui lòng thử lại.",
  },
  en: {
    title: "Confirm Fixed Expense Payment",
    expense: "Expense",
    dueDate: "Due date",
    wallet: "Payment wallet",
    amount: "Amount",
    category: "Category",
    note: "Record an expense transaction and mark this period as paid.",
    alreadyPaid: "This period has already been paid. Re-confirming will not record duplicate transactions.",
    confirm: "Confirm Payment",
    cancel: "Cancel",
    saving: "Saving…",
    saved: "Payment recorded successfully!",
    cancelled: "Payment request cancelled.",
    failed: "Failed to record payment. Please try again.",
  },
  zh: {
    title: "确认支付固定支出",
    expense: "支出项目",
    dueDate: "应付日期",
    wallet: "支付钱包",
    amount: "金额",
    category: "分类",
    note: "记录一笔支出交易并将此周期标记为已支付。",
    alreadyPaid: "该周期之前已支付。再次确认不会重复记录交易。",
    confirm: "确认支付",
    cancel: "取消",
    saving: "正在保存…",
    saved: "已成功记录支付！",
    cancelled: "已取消支付请求。",
    failed: "无法记录支付，请重试。",
  },
} as const;

export const fixedExpenseStatusCopy = {
  vi: {
    pauseTitle: "Tạm dừng khoản chi cố định",
    resumeTitle: "Tiếp tục khoản chi cố định",
    expense: "Khoản chi",
    wallet: "Ví",
    amount: "Số tiền",
    pauseNote: "Tạm dừng lịch thanh toán định kỳ. Lịch sử các kỳ đã thanh toán vẫn được giữ nguyên.",
    resumeNote: "Kích hoạt lại lịch thanh toán định kỳ cho khoản chi này.",
    confirm: "Xác nhận",
    cancel: "Hủy",
    saving: "Đang lưu…",
    saved: "Đã cập nhật trạng thái thành công!",
    cancelled: "Đã hủy thay đổi.",
    failed: "Chưa cập nhật được trạng thái. Vui lòng thử lại.",
  },
  en: {
    pauseTitle: "Pause Fixed Expense",
    resumeTitle: "Resume Fixed Expense",
    expense: "Expense",
    wallet: "Wallet",
    amount: "Amount",
    pauseNote: "Pause recurring schedule. History of paid periods remains intact.",
    resumeNote: "Reactivate recurring schedule for this expense.",
    confirm: "Confirm",
    cancel: "Cancel",
    saving: "Saving…",
    saved: "Status updated successfully!",
    cancelled: "Change cancelled.",
    failed: "Failed to update status. Please try again.",
  },
  zh: {
    pauseTitle: "暂停固定支出",
    resumeTitle: "恢复固定支出",
    expense: "支出项目",
    wallet: "钱包",
    amount: "金额",
    pauseNote: "暂停定期支付计划。已支付周期的历史记录将予以保留。",
    resumeNote: "重新激活此支出的定期支付计划。",
    confirm: "确认",
    cancel: "取消",
    saving: "正在保存…",
    saved: "状态更新成功！",
    cancelled: "已取消更改。",
    failed: "无法更新状态，请重试。",
  },
} as const;

export const planningEditCopy = {
  vi: {
    budgetTitle: "Cập nhật ngân sách",
    expenseTitle: "Cập nhật khoản chi cố định",
    target: "Tên mới",
    wallet: "Ví",
    currentAmount: "Hạn mức/Số tiền hiện tại",
    newAmount: "Hạn mức/Số tiền mới",
    note: "Cập nhật thông tin và kiểm tra tính hợp lệ trước khi lưu.",
    confirm: "Xác nhận cập nhật",
    cancel: "Hủy",
    saving: "Đang lưu…",
    saved: "Đã cập nhật thành công!",
    cancelled: "Đã hủy cập nhật.",
    failed: "Chưa cập nhật được thông tin. Vui lòng thử lại.",
  },
  en: {
    budgetTitle: "Update Budget",
    expenseTitle: "Update Fixed Expense",
    target: "New name",
    wallet: "Wallet",
    currentAmount: "Current amount",
    newAmount: "New amount",
    note: "Update details and validate before saving.",
    confirm: "Confirm Update",
    cancel: "Cancel",
    saving: "Saving…",
    saved: "Updated successfully!",
    cancelled: "Update cancelled.",
    failed: "Failed to update. Please try again.",
  },
  zh: {
    budgetTitle: "更新预算",
    expenseTitle: "更新固定支出",
    target: "新名称",
    wallet: "钱包",
    currentAmount: "当前金额",
    newAmount: "新金额",
    note: "更新详细信息并在保存前进行验证。",
    confirm: "确认更新",
    cancel: "取消",
    saving: "正在保存…",
    saved: "更新成功！",
    cancelled: "已取消更新。",
    failed: "更新失败，请重试。",
  },
} as const;

const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[.!?]+$/g, "").trim();

// ----------------------------------------------------
// Intent Recognition Helpers
// ----------------------------------------------------

export function isFixedExpensePaymentMessage(message: string, state?: Pick<AppState, "fixedExpenses">): boolean {
  const text = normalize(message);
  const paymentKeywords = /\b(?:da|vua|toi vua|minh vua)\s+(?:dong|tra|thanh toan|nop)\b|\b(?:dong|tra|thanh toan|nop)\s+(?:roi|xong)\b|\b(?:danh dau|mark)\b.*(?:da|paid|done|hoan thanh)|\b(?:paid|pay)\s+(?:the\s+)?(?:bill|rent|expense)\b|\b(?:pay|paid)\s+(?:for\s+)?(?:internet|tuition|electric|water)\b|已支付|付完|交完|交了|付了|交过|付过/;
  if (!paymentKeywords.test(text)) return false;

  const billContext = /\b(?:tien nha|tien dien|tien nuoc|tien mang|tien internet|hoc phi|phi chung cu|tien phong|bill|rent|hoa don|chi phi co dinh|khoan co dinh|khoan chi co dinh|recurring)\b|账单|房租|电费|水费|网费|学费/;
  if (billContext.test(text)) return true;

  if (state?.fixedExpenses?.some(e => normalize(e.title).length >= 3 && text.includes(normalize(e.title)))) {
    return true;
  }
  return false;
}

export function isFixedExpenseStatusMessage(message: string, state?: Pick<AppState, "fixedExpenses">): "pause" | "resume" | null {
  const text = normalize(message);
  const pauseKeywords = /\b(?:tam dung|dung|ngung|pause|stop)\b|暂停|停止|停用/;
  const resumeKeywords = /\b(?:tiep tuc|bat lai|kich hoat lai|chay lai|resume|continue|unpause)\b|恢复|继续/;

  const isPause = pauseKeywords.test(text);
  const isResume = resumeKeywords.test(text);
  if (!isPause && !isResume) return null;

  const billContext = /\b(?:tien nha|tien dien|tien nuoc|tien mang|tien internet|hoc phi|phi chung cu|tien phong|bill|rent|hoa don|chi phi co dinh|khoan co dinh|khoan chi co dinh|recurring)\b|账单|房租|电费|水费|网费|学费/;
  const matchesNamedExpense = state?.fixedExpenses?.some(e => normalize(e.title).length >= 3 && text.includes(normalize(e.title)));

  if (!billContext.test(text) && !matchesNamedExpense) return null;
  return isPause ? "pause" : "resume";
}

export function isPlanningEditMessage(message: string, state?: Pick<AppState, "goals" | "fixedExpenses">): "budget" | "fixed_expense" | null {
  const text = normalize(message);
  const editKeywords = /\b(?:sua|doi|cap nhat|thay doi|tang|giam|edit|update|change|modify|set|chinh sua)\b|修改|更改|调整|改/;
  if (!editKeywords.test(text)) return null;

  if (/\b(?:ngan sach|han muc|budget|budgets)\b|预算|限额/.test(text)) {
    return "budget";
  }

  const fixedContext = /\b(?:chi phi co dinh|khoan chi co dinh|fixed expenses?|fixed bills?)\b|固定支出|定期账单/;
  if (fixedContext.test(text)) return "fixed_expense";

  const matchesExpense = state?.fixedExpenses?.some(e => normalize(e.title).length >= 3 && text.includes(normalize(e.title)));
  const matchesBudget = state?.goals?.filter(g => g.kind === "budget").some(g => normalize(g.title).length >= 3 && text.includes(normalize(g.title)));

  if (matchesBudget && !matchesExpense) return "budget";
  if (matchesExpense && !matchesBudget) return "fixed_expense";
  if (matchesExpense) return "fixed_expense";
  return null;
}

export function planningActionConfirmationReply(message: string): "confirm" | "cancel" | null {
  const text = normalize(message).replace(/\s+(?:nhe|nha|please|di)$/u, "");
  if (/^(?:xac nhan(?: thanh toan| cap nhat| luu)?|dong y|dung roi|ok|yes|confirm(?: payment)?|luu|co|确认(?:支付)?|同意|是的)$/.test(text)) return "confirm";
  if (/^(?:huy(?: yeu cau| bo)?|cancel|no|khong(?: thanh toan| sua)?|thoi|bo qua|取消|不用)$/.test(text)) return "cancel";
  return null;
}

// ----------------------------------------------------
// Preparation / Staging Helpers
// ----------------------------------------------------

export function prepareFixedExpensePayment(
  state: AppState,
  message: string,
  asOf: string,
  id: string
): { proposal?: FixedExpensePaymentProposal; clarification?: string; disambiguation?: FixedExpense[] } {
  const expenses = state.fixedExpenses || [];
  if (!expenses.length) {
    return { clarification: "Hiện chưa có khoản chi cố định nào trong hệ thống." };
  }

  const text = normalize(message);

  // Match target fixed expense
  const exactMatches = expenses.filter(e => text.includes(normalize(e.title)));
  let targetExpense: FixedExpense | null = null;

  if (exactMatches.length === 1) {
    targetExpense = exactMatches[0];
  } else if (exactMatches.length > 1) {
    return {
      clarification: "Tìm thấy nhiều khoản chi khớp yêu cầu. Vui lòng chọn khoản chi cần thanh toán:",
      disambiguation: exactMatches,
    };
  } else {
    // Keyword heuristic
    const keywordMap: Array<[RegExp, string]> = [
      [/\b(?:nha|phong|rent)\b|房租/, "nhà"],
      [/\b(?:dien|electric)\b|电费/, "điện"],
      [/\b(?:nuoc|water)\b|水费/, "nước"],
      [/\b(?:mang|internet|wifi)\b|网费/, "mạng"],
      [/\b(?:hoc phi|tuition)\b|学费/, "học phí"],
    ];
    for (const [re] of keywordMap) {
      if (re.test(text)) {
        const matches = expenses.filter(e => re.test(normalize(e.title)));
        if (matches.length === 1) {
          targetExpense = matches[0];
          break;
        } else if (matches.length > 1) {
          return {
            clarification: "Có nhiều khoản chi tương tự. Bạn muốn thanh toán khoản nào?",
            disambiguation: matches,
          };
        }
      }
    }
  }

  if (!targetExpense) {
    if (expenses.length === 1) {
      targetExpense = expenses[0];
    } else {
      return {
        clarification: "Bạn muốn thanh toán khoản chi nào? Hãy nêu tên khoản chi (ví dụ: tiền nhà, tiền mạng).",
        disambiguation: expenses,
      };
    }
  }

  if (!targetExpense.active) {
    return {
      clarification: `Khoản chi “${targetExpense.title}” đang tạm dừng. Bạn cần tiếp tục (kích hoạt lại) khoản chi trước khi thanh toán.`,
    };
  }

  const wallet = expenseWallet(state, targetExpense);
  if (!wallet || wallet.archived) {
    return { clarification: "Ví liên kết với khoản chi này không còn khả dụng hoặc đã bị lưu trữ." };
  }

  // Determine the occurrence due date
  // Check if a specific date was mentioned in the message
  const dateMatch = message.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  let dueDate: string | null = null;
  if (dateMatch && /^\d{4}-\d{2}-\d{2}$/.test(dateMatch[1])) {
    const specified = dateMatch[1];
    if (plannedOccurrences(targetExpense, specified, specified).length > 0) {
      dueDate = specified;
    }
  }

  // Check month/period reference like "tháng này", "kỳ này", or "tháng 10"
  if (!dueDate) {
    if (/\b(?:thang nay|ky nay|this month|current period)\b|本月|本期/.test(text)) {
      const currentYear = asOf.slice(0, 4);
      const currentMonth = asOf.slice(5, 7);
      const startMonth = `${currentYear}-${currentMonth}-01`;
      const endMonth = `${currentYear}-${currentMonth}-31`;
      const monthOccurrences = plannedOccurrences(targetExpense, startMonth, endMonth);
      if (monthOccurrences.length > 0) {
        dueDate = monthOccurrences[0];
      }
    } else {
      const monthMatch = text.match(/\bthang\s+(\d{1,2})\b/);
      if (monthMatch) {
        const monthNum = Number(monthMatch[1]);
        const currentYear = asOf.slice(0, 4);
        const startMonth = `${currentYear}-${String(monthNum).padStart(2, "0")}-01`;
        const endMonth = `${currentYear}-${String(monthNum).padStart(2, "0")}-31`;
        const monthOccurrences = plannedOccurrences(targetExpense, startMonth, endMonth);
        if (monthOccurrences.length > 0) {
          dueDate = monthOccurrences[0];
        }
      }
    }
  }

  // Fallback to earliest unpaid occurrence (overdue or due-today or next due)
  if (!dueDate) {
    const unpaid = unpaidOccurrences(state, targetExpense, targetExpense.dueDate, asOf);
    if (unpaid.length > 0) {
      dueDate = unpaid[0];
    } else {
      dueDate = nextExpenseDue(state, targetExpense, asOf);
    }
  }

  if (!dueDate) {
    dueDate = targetExpense.dueDate;
  }

  // Check if already paid
  const isAlreadyPaid = !!fixedExpensePayment(state, targetExpense.id, dueDate);

  // Check explicit amount in message, or use targetExpense.amount
  const statedAmounts = parseTransactionAmounts(message);
  let paymentAmount = targetExpense.amount;
  if (statedAmounts.length === 1 && statedAmounts[0].amount > 0) {
    paymentAmount = statedAmounts[0].amount;
  }

  return {
    proposal: {
      id,
      expenseId: targetExpense.id,
      expenseTitle: targetExpense.title,
      dueDate,
      paidOn: asOf,
      amount: paymentAmount,
      currency: wallet.currency,
      walletId: wallet.id,
      walletName: wallet.name === "." ? "Ví chính" : wallet.name,
      category: targetExpense.category,
      status: "pending",
      alreadyPaid: isAlreadyPaid,
      transactionId: crypto.randomUUID(),
    },
  };
}

export function prepareFixedExpenseStatus(
  state: AppState,
  message: string,
  id: string
): { proposal?: FixedExpenseStatusProposal; clarification?: string; disambiguation?: FixedExpense[] } {
  const expenses = state.fixedExpenses || [];
  if (!expenses.length) {
    return { clarification: "Hiện chưa có khoản chi cố định nào để thay đổi trạng thái." };
  }

  const action = isFixedExpenseStatusMessage(message, state);
  if (!action) {
    return { clarification: "Bạn muốn tạm dừng hay tiếp tục khoản chi cố định nào?" };
  }

  const text = normalize(message);
  const actionPrefix = /^(?:tam dung|dung|ngung|tiep tuc|bat lai|kich hoat lai|chay lai|pause|stop|resume|unpause)\s*/u;
  const cleanedText = text.replace(actionPrefix, "").replace(/\b(?:khoan chi|chi phi|khoan chi co dinh|khoan co dinh|fixed expense|bill)\s*/u, "").trim();

  const candidateMatches = cleanedText.length >= 3
    ? expenses.filter(e => normalize(e.title).includes(cleanedText) || cleanedText.includes(normalize(e.title)))
    : expenses.filter(e => text.includes(normalize(e.title)));

  let targetExpense: FixedExpense | null = null;

  if (candidateMatches.length > 1) {
    return {
      clarification: `Tìm thấy ${candidateMatches.length} khoản chi. Bạn muốn ${action === "pause" ? "tạm dừng" : "tiếp tục"} khoản nào?`,
      disambiguation: candidateMatches,
    };
  } else if (candidateMatches.length === 1) {
    targetExpense = candidateMatches[0];
  } else if (expenses.length === 1) {
    targetExpense = expenses[0];
  } else {
    return {
      clarification: `Bạn muốn ${action === "pause" ? "tạm dừng" : "tiếp tục"} khoản chi cố định nào? Hãy nêu tên khoản chi.`,
      disambiguation: expenses,
    };
  }

  const wallet = expenseWallet(state, targetExpense);
  return {
    proposal: {
      id,
      expenseId: targetExpense.id,
      expenseTitle: targetExpense.title,
      action,
      currentActive: targetExpense.active,
      targetActive: action === "resume",
      wallet: wallet?.name === "." ? "Ví chính" : wallet?.name || "Ví",
      amount: targetExpense.amount,
      currency: wallet?.currency || "VND",
      status: "pending",
    },
  };
}

export function preparePlanningEdit(
  state: AppState,
  message: string,
  id: string
): { proposal?: PlanningEditProposal; clarification?: string; disambiguation?: (Goal | FixedExpense)[] } {
  const kind = isPlanningEditMessage(message, state);
  if (!kind) {
    return { clarification: "Bạn muốn sửa ngân sách hay khoản chi cố định nào?" };
  }

  const text = normalize(message);
  const statedAmounts = parseTransactionAmounts(message);
  let newAmount = statedAmounts.length === 1 && statedAmounts[0].amount > 0 ? statedAmounts[0].amount : null;
  if (!newAmount) {
    const rawNumberMatch = message.match(/(?:thành|thanh|sang|to|len|xuong|thanh\s+muc)\s+(\d[\d.,]*)\s*(?:vnd|d|dong)?(?:\s|$|[.,!?])/i);
    if (rawNumberMatch) {
      const parsed = parseFloat(rawNumberMatch[1].replace(/,/g, ""));
      if (Number.isFinite(parsed) && parsed > 0) {
        newAmount = parsed;
      }
    }
  }

  // Title rename candidate
  let newTitle: string | null = null;
  const renameMatch = message.match(/(?:thành|thanh|sang|to|成)\s+["'“]?([^"'”\d.,]+?)["'”]?(?:\s*$|\s+(?:nhe|nha|nhé|please))/i);
  if (renameMatch && renameMatch[1].trim().length >= 2) {
    const candidate = renameMatch[1].trim();
    if (!/^\d+$/.test(candidate) && !/\b(?:ngan sach|chi phi|trieu|nghin|k)\b/i.test(candidate)) {
      newTitle = candidate;
    }
  }

  if (kind === "budget") {
    const budgets = state.goals.filter(g => g.kind === "budget");
    if (!budgets.length) return { clarification: "Chưa có ngân sách nào để chỉnh sửa." };

    const matches = budgets.filter(b => text.includes(normalize(b.title)));
    let targetBudget: Goal | null = null;
    if (matches.length === 1) targetBudget = matches[0];
    else if (matches.length > 1) {
      return { clarification: "Có nhiều ngân sách tương tự. Bạn muốn sửa ngân sách nào?", disambiguation: matches };
    } else if (budgets.length === 1) targetBudget = budgets[0];
    else {
      return { clarification: "Bạn muốn sửa ngân sách nào? Hãy nêu rõ tên ngân sách và hạn mức mới.", disambiguation: budgets };
    }

    if (!newAmount && !newTitle) {
      return { clarification: `Bạn muốn đặt hạn mức mới cho ngân sách “${targetBudget.title}” là bao nhiêu? (Hiện tại: ${targetBudget.amount.toLocaleString("en-US")} ${targetBudget.currency})` };
    }

    const wallet = state.wallets.find(w => w.id === targetBudget!.wallet);
    return {
      proposal: {
        id,
        kind: "budget",
        targetId: targetBudget.id,
        title: targetBudget.title,
        changes: {
          ...(newAmount ? { amount: { from: targetBudget.amount, to: newAmount } } : {}),
          ...(newTitle ? { title: { from: targetBudget.title, to: newTitle } } : {}),
        },
        currency: targetBudget.currency,
        wallet: wallet?.name === "." ? "Ví chính" : wallet?.name || "Ví",
        status: "pending",
      },
    };
  }

  // Fixed Expense Edit
  const expenses = state.fixedExpenses || [];
  if (!expenses.length) return { clarification: "Chưa có khoản chi cố định nào để chỉnh sửa." };

  const matches = expenses.filter(e => text.includes(normalize(e.title)));
  let targetExpense: FixedExpense | null = null;
  if (matches.length === 1) targetExpense = matches[0];
  else if (matches.length > 1) {
    return { clarification: "Có nhiều khoản chi tương tự. Bạn muốn sửa khoản nào?", disambiguation: matches };
  } else if (expenses.length === 1) targetExpense = expenses[0];
  else {
    return { clarification: "Bạn muốn sửa khoản chi cố định nào? Hãy nêu rõ tên và số tiền mới.", disambiguation: expenses };
  }

  if (!newAmount && !newTitle) {
    return { clarification: `Bạn muốn đặt số tiền mới cho khoản “${targetExpense.title}” là bao nhiêu? (Hiện tại: ${targetExpense.amount.toLocaleString("en-US")})` };
  }

  const wallet = expenseWallet(state, targetExpense);
  return {
    proposal: {
      id,
      kind: "fixed_expense",
      targetId: targetExpense.id,
      title: targetExpense.title,
      changes: {
        ...(newAmount ? { amount: { from: targetExpense.amount, to: newAmount } } : {}),
        ...(newTitle ? { title: { from: targetExpense.title, to: newTitle } } : {}),
      },
      currency: wallet?.currency || "VND",
      wallet: wallet?.name === "." ? "Ví chính" : wallet?.name || "Ví",
      status: "pending",
    },
  };
}

// ----------------------------------------------------
// Mutation / Execution Helpers
// ----------------------------------------------------

export function applyFixedExpensePayment(
  state: AppState,
  raw: FixedExpensePaymentProposal,
  asOf: string
): AppState {
  const proposal = fixedExpensePaymentProposalSchema.parse(raw);
  if (proposal.applied || (proposal.status !== "pending" && proposal.status !== "failed")) {
    throw new Error("CONFIRMATION_REQUIRED");
  }

  // Idempotency: if already paid, return unchanged state
  if (fixedExpensePayment(state, proposal.expenseId, proposal.dueDate)) {
    return state;
  }

  return recordFixedExpensePayment(
    state,
    proposal.expenseId,
    {
      dueDate: proposal.dueDate,
      paidOn: proposal.paidOn,
      amount: proposal.amount,
      walletId: proposal.walletId,
      note: `Thanh toán ${proposal.expenseTitle} kỳ ${proposal.dueDate}`,
      transactionId: proposal.transactionId || crypto.randomUUID(),
    },
    asOf
  );
}

export function applyFixedExpenseStatus(
  state: AppState,
  raw: FixedExpenseStatusProposal
): AppState {
  const proposal = fixedExpenseStatusProposalSchema.parse(raw);
  if (proposal.applied || (proposal.status !== "pending" && proposal.status !== "failed")) {
    throw new Error("CONFIRMATION_REQUIRED");
  }

  const expenses = state.fixedExpenses || [];
  if (!expenses.some(e => e.id === proposal.expenseId)) {
    throw new Error("FIXED_EXPENSE_NOT_FOUND");
  }

  return {
    ...state,
    fixedExpenses: expenses.map(e => e.id === proposal.expenseId ? { ...e, active: proposal.targetActive } : e),
  };
}

export function applyPlanningEdit(
  state: AppState,
  raw: PlanningEditProposal
): AppState {
  const proposal = planningEditProposalSchema.parse(raw);
  if (proposal.applied || (proposal.status !== "pending" && proposal.status !== "failed")) {
    throw new Error("CONFIRMATION_REQUIRED");
  }

  if (proposal.kind === "budget") {
    const existing = state.goals.find(g => g.kind === "budget" && g.id === proposal.targetId);
    if (!existing) throw new Error("BUDGET_NOT_FOUND");

    const newAmount = proposal.changes.amount?.to ?? existing.amount;
    const newTitle = proposal.changes.title?.to ?? existing.title;
    const updatedGoal: Goal = {
      ...existing,
      title: newTitle,
      amount: newAmount,
    };

    if (!validBudget(state, updatedGoal)) {
      throw new Error("INVALID_BUDGET_UPDATE");
    }

    return {
      ...state,
      goals: state.goals.map(g => g.id === proposal.targetId ? updatedGoal : g),
    };
  }

  // Fixed Expense
  const expenses = state.fixedExpenses || [];
  const existing = expenses.find(e => e.id === proposal.targetId);
  if (!existing) throw new Error("FIXED_EXPENSE_NOT_FOUND");

  const newAmount = proposal.changes.amount?.to ?? existing.amount;
  const newTitle = proposal.changes.title?.to ?? existing.title;
  const updatedExpense: FixedExpense = {
    ...existing,
    title: newTitle,
    amount: newAmount,
  };

  if (!validFixedExpense(state, updatedExpense)) {
    throw new Error("INVALID_FIXED_EXPENSE_UPDATE");
  }

  return {
    ...state,
    fixedExpenses: expenses.map(e => e.id === proposal.targetId ? updatedExpense : e),
  };
}
