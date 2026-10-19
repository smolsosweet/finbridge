import { z } from "zod";
import {
  hasCompatibleDraftWallet,
  normalizeCurrency,
  parseTransactionAmounts,
  resolveDraftCategory,
  validateDraftForState,
  type DraftType,
  type TransactionDraft,
} from "../transaction-drafts";
import type { AiBusinessTool, ToolExecutionContext } from "./types";

export const stageTransactionDraftsInputSchema = z.object({
  items: z.array(z.object({
    title: z.string().trim().min(1).max(160),
    amount: z.number().finite().positive().max(1e12).nullable().optional(),
    currency: z.string().regex(/^[A-Z]{3}$/).nullable().optional(),
    type: z.enum(["expense", "income"]).default("expense"),
    category: z.string().trim().max(100).nullable().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    walletId: z.string().max(100).nullable().optional(),
  })).min(1).max(20),
}).strict();

export const stageDraftsInputSchema = stageTransactionDraftsInputSchema;

export type StageTransactionDraftsInput = z.infer<typeof stageTransactionDraftsInputSchema>;
export type StageDraftsInput = StageTransactionDraftsInput;

export interface StageTransactionDraftsResult {
  batchId: string;
  drafts: TransactionDraft[];
  totalDrafts: number;
  readyCount: number;
  needsReviewCount: number;
  unassignedWalletCount: number;
  /** Explicit safety guarantee: Staged drafts are strictly in-memory and require user approval. */
  isCommittedToDatabase: false;
}

export type StageDraftsOutput = StageTransactionDraftsResult;

export const stageTransactionDraftsTool: AiBusinessTool<
  StageTransactionDraftsInput,
  StageTransactionDraftsResult
> = {
  name: "stage_transaction_drafts",
  description:
    "Chuẩn bị và thẩm định các bản nháp giao dịch (Two-Phase Commit Staging) vào bộ nhớ tạm để người dùng xem lại và xác nhận; tuyệt đối KHÔNG tự ý ghi vào sổ cái kế toán.",
  inputSchema: stageTransactionDraftsInputSchema,
  parameters: stageTransactionDraftsInputSchema,
  execute: (
    input: StageTransactionDraftsInput,
    context: ToolExecutionContext
  ): StageTransactionDraftsResult => {
    const activeWallets = context.state.wallets.filter((w) => !w.archived);
    const allowedCategories = context.state.categories.filter(
      (c) => !context.state.categoryMeta[c]?.archived
    );
    const draftState = {
      wallets: activeWallets,
      categories: context.state.categories,
      categoryMeta: context.state.categoryMeta,
      transactions: context.state.transactions,
    };

    const batchId = crypto.randomUUID();
    const drafts: TransactionDraft[] = input.items.map((item, index) => {
      const needsReview = new Set<string>();
      const draftType: DraftType = item.type;

      // Currency resolution
      let requiredCurrency = normalizeCurrency(item.currency)
        || item.currency
        || parseTransactionAmounts(item.title)[0]?.currency
        || null;

      // Wallet resolution and ownership check
      let targetWallet = item.walletId ? activeWallets.find((w) => w.id === item.walletId) : null;
      if (item.walletId && !targetWallet) {
        // Requested wallet does not exist or is archived
        needsReview.add("wallet");
      } else if (
        targetWallet &&
        requiredCurrency &&
        targetWallet.currency.toUpperCase() !== requiredCurrency.toUpperCase()
      ) {
        // Stated currency conflicts with wallet currency; do not force overwrite
        targetWallet = null;
        needsReview.add("wallet");
      } else if (targetWallet) {
        requiredCurrency = targetWallet.currency;
      } else if (requiredCurrency) {
        // Auto-assign only if exactly one active wallet matches the required currency
        const matchingWallets = activeWallets.filter(
          (w) => w.currency.toUpperCase() === requiredCurrency!.toUpperCase()
        );
        if (matchingWallets.length === 1) {
          targetWallet = matchingWallets[0];
        } else {
          needsReview.add("wallet");
        }
      } else if (activeWallets.length === 1) {
        targetWallet = activeWallets[0];
        requiredCurrency = targetWallet.currency;
      } else {
        needsReview.add("wallet");
      }

      // Category resolution
      let candidateCategory: string | null = null;
      if (
        item.category &&
        allowedCategories.includes(item.category) &&
        (context.state.categoryMeta[item.category]?.type || "expense") === draftType
      ) {
        candidateCategory = item.category;
      } else {
        // Attempt semantic category resolution from item title
        const semantic = resolveDraftCategory(item.title, draftType, draftState);
        if (semantic.confidence === "confident" && semantic.category) {
          candidateCategory = semantic.category;
        } else {
          candidateCategory = null;
          needsReview.add("category");
        }
      }

      const date = item.date || context.today;
      const amount = item.amount ?? null;
      if (!amount) needsReview.add("amount");

      const rawDraft: TransactionDraft = {
        id: `${batchId}:${index}`,
        title: item.title,
        amount,
        type: draftType,
        category: candidateCategory,
        date,
        wallet: targetWallet?.id || null,
        currency: targetWallet?.currency || requiredCurrency,
        needsReview: [...needsReview],
      };

      // Validate against authoritative state rules
      const validated = validateDraftForState(rawDraft, draftState);

      // Ensure compatible wallet exists for the stated currency
      if (!hasCompatibleDraftWallet(validated, activeWallets)) {
        validated.wallet = null;
        if (!validated.needsReview.includes("wallet")) {
          validated.needsReview.push("wallet");
        }
      }

      return validated;
    });

    const readyCount = drafts.filter((d) => d.needsReview.length === 0).length;
    const unassignedWalletCount = drafts.filter((d) => !d.wallet).length;

    return {
      batchId,
      drafts,
      totalDrafts: drafts.length,
      readyCount,
      needsReviewCount: drafts.length - readyCount,
      unassignedWalletCount,
      isCommittedToDatabase: false,
    };
  },
};

export const stageDraftsTool = stageTransactionDraftsTool;
