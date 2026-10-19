import type { ToolExecutionContext, AnyAiBusinessTool } from "./types";
import { queryFinancesTool } from "./query-finances";
import { simulateScenarioTool } from "./simulate-scenario";
import { checkUpcomingObligationsTool } from "./check-obligations";
import { stageTransactionDraftsTool } from "./stage-drafts";
import { manageCategoriesTool } from "./manage-categories";
import { proposeWorkspaceEntityTool } from "./propose-workspace";

export * from "./types";
export * from "./query-finances";
export * from "./simulate-scenario";
export * from "./check-obligations";
export * from "./stage-drafts";
export * from "./manage-categories";
export * from "./propose-workspace";

export interface ToolExecutionResponse<T = unknown> {
  success: boolean;
  toolName: string;
  data?: T;
  error?: string;
  isCommittedToDatabase: false;
}

// Complete registry of Phase 1 business tools
export const aiBusinessTools: Record<string, AnyAiBusinessTool> = {
  [queryFinancesTool.name]: queryFinancesTool as unknown as AnyAiBusinessTool,
  [simulateScenarioTool.name]: simulateScenarioTool as unknown as AnyAiBusinessTool,
  [checkUpcomingObligationsTool.name]: checkUpcomingObligationsTool as unknown as AnyAiBusinessTool,
  [stageTransactionDraftsTool.name]: stageTransactionDraftsTool as unknown as AnyAiBusinessTool,
  [manageCategoriesTool.name]: manageCategoriesTool as unknown as AnyAiBusinessTool,
  [proposeWorkspaceEntityTool.name]: proposeWorkspaceEntityTool as unknown as AnyAiBusinessTool,
};

/**
 * Safely dispatch an AI tool execution with input validation and execution isolation.
 * Guarantees isCommittedToDatabase: false across all tools.
 */
export async function executeAiTool(
  toolName: string,
  rawInput: unknown,
  context: ToolExecutionContext
): Promise<ToolExecutionResponse> {
  const tool = aiBusinessTools[toolName];
  if (!tool) {
    return {
      success: false,
      toolName,
      error: `Unknown AI tool: "${toolName}". Available tools: ${Object.keys(aiBusinessTools).join(", ")}`,
      isCommittedToDatabase: false,
    };
  }

  try {
    const data = await tool.execute(rawInput, context);
    return {
      success: true,
      toolName,
      data,
      isCommittedToDatabase: false,
    };
  } catch (error) {
    return {
      success: false,
      toolName,
      error: error instanceof Error ? error.message : String(error),
      isCommittedToDatabase: false,
    };
  }
}

/**
 * Returns metadata descriptors for all registered business tools.
 */
export function listAiBusinessTools(): Array<{
  name: string;
  description: string;
}> {
  return Object.values(aiBusinessTools).map((tool) => ({
    name: tool.name,
    description: tool.description,
  }));
}
