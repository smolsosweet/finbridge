import { z } from "zod";
import { calculateScenario, type FinancialScenario, type ScenarioResult } from "../scenario-planner";
import type { AiBusinessTool, ToolExecutionContext } from "./types";

export const simulateScenarioInputSchema = z.object({
  name: z.string().trim().min(1).max(100).default("Kịch bản giả định"),
  changes: z.array(z.object({
    title: z.string().trim().min(1).max(100),
    amount: z.number().finite().positive().max(1e12),
    direction: z.enum(["income", "expense"]),
    walletId: z.string().max(100),
    category: z.string().max(100).nullable().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  })).max(20).default([]),
  spendingReductions: z.array(z.object({
    category: z.string().trim().min(1).max(100),
    percent: z.number().finite().min(0).max(100),
    walletId: z.string().max(100).nullable().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  })).max(10).optional(),
  dailySpendingLimits: z.array(z.object({
    amount: z.number().finite().positive().max(1e12),
    walletId: z.string().max(100),
    category: z.string().max(100).nullable().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  })).max(5).optional(),
  horizonEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  estimateSpending: z.boolean().default(true),
}).strict();

export type SimulateScenarioInput = z.infer<typeof simulateScenarioInputSchema>;

export interface SimulateScenarioOutput {
  scenarioId: string;
  name: string;
  wallets: Array<{
    walletId: string;
    currency: string;
    balanceNow: number;
    projectedBalance: number;
    shortfall: number;
  }>;
  hasShortfall: boolean;
  plannedBills: Array<{
    title: string;
    amount: number;
    currency: string;
    date: string;
  }>;
  dailyFlexibleLimit: number | null;
  assumptions: string[];
  suggestions: string[];
}

export type SimulateScenarioResult = SimulateScenarioOutput;

export const simulateScenarioTool: AiBusinessTool<SimulateScenarioInput, SimulateScenarioResult> = {
  name: "simulate_scenario",
  description: "Mô phỏng kịch bản tài chính giả định (What-If), tính toán số dư tương lai, cảnh báo thâm hụt tiền mặt và xác định trần chi tiêu an toàn hàng ngày.",
  inputSchema: simulateScenarioInputSchema,
  parameters: simulateScenarioInputSchema,
  execute: (input: SimulateScenarioInput, context: ToolExecutionContext): SimulateScenarioResult => {
    const activeWallets = context.state.wallets.filter(w => !w.archived);
    const walletMap = new Map(activeWallets.map(w => [w.id, w]));

    // Ownership & Currency verification:
    // Derive currency strictly from the authoritative wallet. Never invent or mix currencies.
    const scenarioChanges = input.changes.map(change => {
      const wallet = walletMap.get(change.walletId);
      if (!wallet) {
        throw new Error(`WALLET_NOT_FOUND: Ví "${change.walletId}" trong kịch bản không tồn tại hoặc đã lưu trữ.`);
      }
      return {
        title: change.title,
        amount: change.amount,
        direction: change.direction,
        walletId: wallet.id,
        currency: wallet.currency,
        date: change.date || context.today,
        category: change.category || null,
      };
    });

    const reductions = input.spendingReductions?.map(red => {
      if (red.walletId && !walletMap.has(red.walletId)) {
        throw new Error(`WALLET_NOT_FOUND: Ví "${red.walletId}" không tồn tại.`);
      }
      const wallet = red.walletId ? walletMap.get(red.walletId) : undefined;
      return {
        category: red.category,
        percent: red.percent,
        walletId: wallet ? wallet.id : null,
        currency: wallet ? wallet.currency : null,
        startDate: red.startDate || null,
        endDate: red.endDate || null,
      };
    });

    const limits = input.dailySpendingLimits?.map(limit => {
      const wallet = walletMap.get(limit.walletId);
      if (!wallet) {
        throw new Error(`WALLET_NOT_FOUND: Ví "${limit.walletId}" không tồn tại.`);
      }
      return {
        amount: limit.amount,
        walletId: wallet.id,
        currency: wallet.currency,
        category: limit.category || null,
        startDate: limit.startDate || null,
        endDate: limit.endDate || null,
      };
    });

    const scenarioId = crypto.randomUUID();
    const scenario: FinancialScenario = {
      id: scenarioId,
      name: input.name,
      changes: scenarioChanges,
      spendingReductions: reductions,
      dailySpendingLimits: limits,
      horizonEnd: input.horizonEnd || null,
      estimateSpending: input.estimateSpending,
      assumptions: [],
    };

    const result: ScenarioResult = calculateScenario(context.state, scenario, context.today);

    return {
      scenarioId,
      name: input.name,
      wallets: result.wallets,
      hasShortfall: result.wallets.some(w => w.shortfall > 0),
      plannedBills: result.plannedBills,
      dailyFlexibleLimit: result.budgets[0]?.dailyFlexibleLimit ?? null,
      assumptions: result.assumptions,
      suggestions: result.suggestions,
    };
  },
};
