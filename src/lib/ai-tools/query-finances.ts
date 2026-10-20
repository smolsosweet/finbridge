import { z } from "zod";
import { answerFinancialQuery, type FinancialAction, type FinancialQuery } from "../financial-chat";
import type { AiBusinessTool, ToolExecutionContext } from "./types";

export const queryFinancesInputSchema = z.object({
  action: z.enum([
    "balance",
    "balance_after_obligation",
    "spending_summary",
    "category_breakdown",
    "top_category",
    "category_savings",
    "transactions",
    "largest_transaction",
    "budget_status",
    "safe_daily_allowance",
    "upcoming_obligations",
    "goals",
    "spending_trend",
    "anomalies",
    "explain",
    "unknown",
  ]),
  walletId: z.string().max(100).nullable().optional(),
  scope: z.enum(["selected", "all"]).default("selected"),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  searchTerm: z.string().max(160).nullable().optional(),
  transactionType: z.enum(["expense", "income"]).nullable().optional(),
  percentage: z.number().finite().min(0).max(100).nullable().optional(),
}).strict();

export type QueryFinancesInput = z.infer<typeof queryFinancesInputSchema>;

export interface QueryFinancesOutput {
  action: FinancialAction;
  walletId: string | null;
  scope: "selected" | "all";
  period: { start: string | null; end: string | null };
  category: string | null;
  answerText: string;
}

export type QueryFinancesResult = QueryFinancesOutput;

export const queryFinancesTool: AiBusinessTool<QueryFinancesInput, QueryFinancesResult> = {
  name: "query_finances",
  description: "Tra cứu số dư, thu chi, danh mục, ngân sách và các chỉ số tài chính từ sổ kế toán thực tế bằng động cơ tính toán xác thực.",
  inputSchema: queryFinancesInputSchema,
  parameters: queryFinancesInputSchema,
  execute: (input: QueryFinancesInput, context: ToolExecutionContext): QueryFinancesResult => {
    const activeWallets = context.state.wallets.filter(w => !w.archived);
    
    // Ownership check: Requested wallet must belong to the user's active wallets
    let verifiedWalletId: string | null = null;
    if (input.walletId) {
      const match = activeWallets.find(w => w.id === input.walletId);
      if (!match) {
        throw new Error(`WALLET_NOT_FOUND: Ví "${input.walletId}" không tồn tại hoặc đã bị lưu trữ.`);
      }
      verifiedWalletId = match.id;
    } else if (input.scope === "selected") {
      verifiedWalletId = activeWallets.length === 1 ? activeWallets[0].id : null;
    }

    // Category check: Must exist in user categories if provided
    let verifiedCategory: string | null = null;
    if (input.category) {
      if (context.state.categories.includes(input.category)) {
        verifiedCategory = input.category;
      }
    }

    // Date range validation
    const start = input.periodStart || null;
    const end = input.periodEnd || null;
    if (start && end && start > end) {
      throw new Error("INVALID_DATE_RANGE: Ngày bắt đầu không thể sau ngày kết thúc.");
    }

    const query: FinancialQuery = {
      action: input.action,
      actions: [input.action],
      walletId: verifiedWalletId,
      scope: input.scope,
      periodStart: start,
      periodEnd: end,
      category: verifiedCategory,
      searchTerm: input.searchTerm || null,
      transactionType: input.transactionType || null,
      percentage: input.percentage ?? null,
    };

    const answerText = answerFinancialQuery(
      query,
      context.state,
      verifiedWalletId || "",
      context.today
    );

    return {
      action: input.action,
      walletId: verifiedWalletId,
      scope: input.scope,
      period: { start, end },
      category: verifiedCategory,
      answerText,
    };
  },
};
