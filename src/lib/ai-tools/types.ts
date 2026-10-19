import { z } from "zod";
import type { AppState } from "../../components/finbridge/workspace/store";

export interface ToolExecutionContext {
  userId: string;
  state: AppState;
  today: string;
  timeZone: string;
  language?: "vi" | "en" | "zh";
}

export interface AiBusinessTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  parameters?: z.ZodType<TInput>;
  execute: (input: TInput, context: ToolExecutionContext) => Promise<TOutput> | TOutput;
}

export interface AnyAiBusinessTool {
  name: string;
  description: string;
  inputSchema?: unknown;
  parameters?: unknown;
  execute: (input: unknown, context: ToolExecutionContext) => Promise<unknown> | unknown;
}
