import { z } from "zod";
import type { AiBusinessTool, ToolExecutionContext } from "./types";
import {
  emptyWorkspaceAction,
  inspectWorkspaceProposal,
  type ActionLanguage,
  type ActionQuestion,
  type WorkspaceAction,
  type WorkspaceProposal,
} from "../workspace-actions";

export const proposeWorkspaceEntityInputSchema = z.object({
  kind: z.enum(["wallet", "budget", "fixed_expense"]),
  name: z.string().trim().min(1).max(100).nullable().optional().default(null),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable().optional().default(null),
  walletType: z.enum(["cash", "credit"]).nullable().optional().default(null),
  initialBalance: z.number().finite().min(-1e12).max(1e12).nullable().optional().default(null),
  creditLimit: z.number().finite().positive().max(1e12).nullable().optional().default(null),
  amount: z.number().finite().positive().max(1e12).nullable().optional().default(null),
  walletId: z.string().max(100).nullable().optional().default(null),
  budgetId: z.string().max(100).nullable().optional().default(null),
  category: z.string().max(100).nullable().optional().default(null),
  date: z.string().max(10).nullable().optional().default(null),
  cycle: z.enum(["weekly", "monthly", "yearly"]).nullable().optional().default(null),
  recurrence: z.enum(["once", "weekly", "monthly", "yearly"]).nullable().optional().default(null),
  intervalMonths: z.number().int().min(1).max(12).nullable().optional().default(null),
  monthPosition: z.enum(["start", "end", "date"]).nullable().optional().default(null),
  reminderDays: z.number().int().min(0).max(30).nullable().optional().default(null),
  language: z.enum(["en", "vi", "zh"]).optional().default("en"),
}).strict();

export type ProposeWorkspaceEntityInput = z.infer<typeof proposeWorkspaceEntityInputSchema>;

export interface ProposeWorkspaceEntityResult {
  proposalId: string;
  actionId: string;
  kind: WorkspaceAction["kind"];
  status: "collecting" | "review";
  isCommittedToDatabase: false;
  requiresUserConfirmation: boolean;
  question: ActionQuestion | null;
  error: string | null;
  currentAction: WorkspaceAction;
  summary: string;
}

export const proposeWorkspaceEntityTool: AiBusinessTool<
  ProposeWorkspaceEntityInput,
  ProposeWorkspaceEntityResult
> = {
  name: "propose_workspace_entity",
  description:
    "Prepare a new workspace entity proposal (wallet, budget, or fixed expense). Validates business rules, enforces wallet ownership, identifies missing required fields, and stages a proposal for user review. Does NOT write to the database.",
  inputSchema: proposeWorkspaceEntityInputSchema,
  execute: async (input: ProposeWorkspaceEntityInput, context: ToolExecutionContext) => {
    const parsed = proposeWorkspaceEntityInputSchema.parse(input);

    // Validate resource ownership if walletId or budgetId is provided
    if (parsed.walletId) {
      const ownedWallet = context.state.wallets.find(
        (w) => w.id === parsed.walletId && !w.archived
      );
      if (!ownedWallet) {
        throw new Error(
          `Unauthorized: Wallet with id "${parsed.walletId}" does not exist or is not accessible.`
        );
      }
    }

    if (parsed.budgetId) {
      const ownedBudget = context.state.goals.find(
        (g) => g.id === parsed.budgetId && g.kind === "budget"
      );
      if (!ownedBudget) {
        throw new Error(
          `Unauthorized: Budget with id "${parsed.budgetId}" does not exist or is not accessible.`
        );
      }
    }

    // Generate unique UUIDs for the proposal and action
    const actionId = `00000000-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padStart(12, "0")}`;
    const proposalId = `00000000-0000-4000-9000-${Math.random().toString(16).slice(2, 14).padStart(12, "0")}`;

    const baseAction = emptyWorkspaceAction(parsed.kind, actionId);
    const action: WorkspaceAction = {
      ...baseAction,
      name: parsed.name,
      currency: parsed.currency,
      walletType: parsed.walletType,
      initialBalance: parsed.initialBalance,
      creditLimit: parsed.creditLimit,
      amount: parsed.amount,
      walletId: parsed.walletId,
      budgetId: parsed.budgetId,
      category: parsed.category,
      date: parsed.date,
      cycle: parsed.cycle,
      recurrence: parsed.recurrence,
      intervalMonths: parsed.intervalMonths,
      monthPosition: parsed.monthPosition,
      reminderDays: parsed.reminderDays,
    };

    const initialProposal: WorkspaceProposal = {
      id: proposalId,
      actions: [action],
      status: "collecting",
    };

    const language: ActionLanguage = parsed.language || "en";
    const inspection = inspectWorkspaceProposal(context.state, initialProposal, language);

    const isReadyForReview = inspection.proposal.status === "review";
    const status = isReadyForReview ? "review" : "collecting";

    let summary = "";
    if (status === "review") {
      summary = `Proposal for ${parsed.kind} "${parsed.name || ""}" is complete and ready for user review. Requires explicit user confirmation before creation.`;
    } else if (inspection.question) {
      summary = `Proposal for ${parsed.kind} is collecting information: ${inspection.question.text}`;
    } else if (inspection.error) {
      summary = `Proposal validation error: ${inspection.error}`;
    } else {
      summary = `Proposal for ${parsed.kind} is in progress.`;
    }

    return {
      proposalId: inspection.proposal.id,
      actionId,
      kind: parsed.kind,
      status,
      isCommittedToDatabase: false,
      requiresUserConfirmation: isReadyForReview,
      question: inspection.question,
      error: inspection.error,
      currentAction: inspection.proposal.actions[0] || action,
      summary,
    };
  },
};
