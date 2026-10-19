import { z } from "zod";
import type { AiBusinessTool, ToolExecutionContext } from "./types";
import {
  prepareCategoryOperation,
  type CategoryCommand,
  type CategoryConfirmation,
} from "../category-operations";

export const manageCategoriesInputSchema = z.object({
  operation: z.enum([
    "create_category",
    "rename_category",
    "merge_categories",
    "delete_category",
  ]),
  sources: z.array(z.string().min(1).max(100)).max(20).default([]),
  target: z.string().trim().min(1).max(100).nullable().optional().default(null),
  type: z.enum(["expense", "income"]).nullable().optional().default(null),
}).strict();

export type ManageCategoriesInput = z.infer<typeof manageCategoriesInputSchema>;

export interface ManageCategoriesResult {
  operation: CategoryCommand["operation"];
  sources: string[];
  target: string | null;
  type: "expense" | "income" | null;
  impact: {
    transactions: number;
    budgets: number;
    fixedExpenses: number;
    recurring: number;
    drafts: number;
  };
  confirmationId: string;
  fingerprint: string;
  isCommittedToDatabase: false;
  requiresUserConfirmation: true;
  summary: string;
}

export const manageCategoriesTool: AiBusinessTool<
  ManageCategoriesInput,
  ManageCategoriesResult
> = {
  name: "manage_categories",
  description:
    "Prepare category operations (create, rename, merge, delete) and preview their impact across transactions, budgets, fixed expenses, recurring transactions, and drafts. Does NOT apply changes to the database; returns a confirmation preview with fingerprint for explicit user approval.",
  inputSchema: manageCategoriesInputSchema,
  execute: async (input: ManageCategoriesInput, context: ToolExecutionContext) => {
    const parsed = manageCategoriesInputSchema.parse(input);

    const command: CategoryCommand = {
      operation: parsed.operation,
      sources: parsed.sources,
      target: parsed.target,
      type: parsed.type,
    };

    // Stable or random ID for the preview operation
    const confirmationId = `cat-op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const confirmation: CategoryConfirmation = prepareCategoryOperation(
      context.state,
      command,
      confirmationId
    );

    const totalImpact =
      confirmation.impact.transactions +
      confirmation.impact.budgets +
      confirmation.impact.fixedExpenses +
      confirmation.impact.recurring +
      confirmation.impact.drafts;

    const summaryParts: string[] = [];
    if (parsed.operation === "create_category") {
      summaryParts.push(`Proposed creation of category "${parsed.target}" (${parsed.type || "expense"}).`);
    } else if (parsed.operation === "rename_category") {
      summaryParts.push(`Proposed rename of category "${parsed.sources[0]}" to "${parsed.target}".`);
    } else if (parsed.operation === "merge_categories") {
      summaryParts.push(
        `Proposed merge of categories [${parsed.sources.join(", ")}] into "${parsed.target}".`
      );
    } else if (parsed.operation === "delete_category") {
      summaryParts.push(`Proposed archiving/deletion of categories [${parsed.sources.join(", ")}].`);
    }

    summaryParts.push(
      `Impact preview: ${confirmation.impact.transactions} transactions, ${confirmation.impact.budgets} budgets, ${confirmation.impact.fixedExpenses} fixed expenses, ${confirmation.impact.recurring} recurring, ${confirmation.impact.drafts} drafts affected (${totalImpact} total items). Requires explicit user confirmation.`
    );

    return {
      operation: confirmation.command.operation,
      sources: confirmation.command.sources,
      target: confirmation.command.target,
      type: confirmation.command.type,
      impact: confirmation.impact,
      confirmationId: confirmation.id,
      fingerprint: confirmation.fingerprint,
      isCommittedToDatabase: false,
      requiresUserConfirmation: true,
      summary: summaryParts.join(" "),
    };
  },
};
