import { z } from "zod";
import { expenseWallet, unpaidOccurrences } from "../fixed-expense-payments";
import type { AiBusinessTool, ToolExecutionContext } from "./types";

export const checkUpcomingObligationsInputSchema = z.object({
  walletId: z.string().max(100).nullable().optional(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  daysAhead: z.number().int().min(1).max(365).default(30),
}).strict();

export const checkObligationsInputSchema = checkUpcomingObligationsInputSchema;

export type CheckUpcomingObligationsInput = z.infer<typeof checkUpcomingObligationsInputSchema>;
export type CheckObligationsInput = CheckUpcomingObligationsInput;

export interface ObligationItem {
  id: string;
  title: string;
  amount: number;
  currency: string;
  walletId: string;
  walletName: string;
  category: string;
  dueDate: string;
  isOverdue: boolean;
}

export interface CheckUpcomingObligationsResult {
  period: { start: string; end: string };
  walletId: string | null;
  bills: ObligationItem[];
  totalUnpaidByCurrency: Record<string, number>;
  totalBillsCount: number;
  overdueCount: number;
}

export type CheckObligationsOutput = CheckUpcomingObligationsResult;

function addDaysToIso(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const checkUpcomingObligationsTool: AiBusinessTool<
  CheckUpcomingObligationsInput,
  CheckUpcomingObligationsResult
> = {
  name: "check_upcoming_obligations",
  description:
    "Kiểm tra các hóa đơn và chi phí cố định định kỳ sắp đến hạn hoặc quá hạn chưa thanh toán, phân rã theo từng ví và tiền tệ cách ly.",
  inputSchema: checkUpcomingObligationsInputSchema,
  parameters: checkUpcomingObligationsInputSchema,
  execute: (
    input: CheckUpcomingObligationsInput,
    context: ToolExecutionContext
  ): CheckUpcomingObligationsResult => {
    const activeWallets = context.state.wallets.filter((w) => !w.archived);
    if (input.walletId && !activeWallets.some((w) => w.id === input.walletId)) {
      throw new Error(`WALLET_NOT_FOUND: Ví "${input.walletId}" không tồn tại hoặc đã lưu trữ.`);
    }

    const start = input.periodStart || context.today;
    const end = input.periodEnd || addDaysToIso(context.today, input.daysAhead);

    if (start > end) {
      throw new Error("INVALID_DATE_RANGE: Ngày bắt đầu không thể sau ngày kết thúc.");
    }

    const expenses = (context.state.fixedExpenses || []).filter((e) => e.active);
    const bills: ObligationItem[] = [];
    const totalUnpaidByCurrency: Record<string, number> = {};

    for (const expense of expenses) {
      const wallet = expenseWallet(context.state, expense);
      if (!wallet || wallet.archived) continue;
      if (input.walletId && wallet.id !== input.walletId) continue;

      const unpaidDates = unpaidOccurrences(context.state, expense, start, end);
      for (const dueDate of unpaidDates) {
        bills.push({
          id: expense.id,
          title: expense.title,
          amount: expense.amount,
          currency: wallet.currency,
          walletId: wallet.id,
          walletName: wallet.name,
          category: expense.category,
          dueDate,
          isOverdue: dueDate < context.today,
        });

        // Sum currencies strictly isolated
        const curr = wallet.currency.toUpperCase();
        totalUnpaidByCurrency[curr] = (totalUnpaidByCurrency[curr] || 0) + expense.amount;
      }
    }

    // Sort bills by due date ascending
    bills.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    return {
      period: { start, end },
      walletId: input.walletId || null,
      bills,
      totalUnpaidByCurrency,
      totalBillsCount: bills.length,
      overdueCount: bills.filter((b) => b.isOverdue).length,
    };
  },
};

export const checkObligationsTool = checkUpcomingObligationsTool;
