import { z } from "zod";
import type { AppState } from "../components/finbridge/workspace/store";
import { onboardingDraftSchema } from "./onboarding";
import { bankRecipientSchema } from "./bank-transfer";

const id = z.string().min(1).max(100), text = z.string().max(10000);
const money = z.number().finite().min(-1e12).max(1e12);
const json = z.json();
const date = z.string().max(50).refine(value => { const key = value.slice(0, 10), d = new Date(key + "T12:00:00Z"); return /^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === key; });
const currency = z.string().regex(/^[A-Z]{3}$/).refine(c => Intl.supportedValuesOf("currency").includes(c));
const tx = z.object({ id, title: text, amount: money.nonnegative(), type: z.enum(["expense", "income", "transfer"]), category: z.string().max(100), date, wallet: id, note: text.default(""), targetWallet: id.optional(), subcategory: z.string().max(100).optional(), image: z.string().max(3_000_000).optional(), interval: z.number().finite().optional(), unit: z.string().max(100).optional(), fixedExpenseId: id.optional(), fixedExpenseDueDate: date.optional(), paymentConfirmation: z.literal("user").optional() }).catchall(json);
const key = z.string().max(100).refine(k => !["__proto__", "constructor", "prototype"].includes(k));
export const workspaceSchema = z.object({
  wallets: z.array(z.object({ id, name: z.string().min(1).max(100), currency, initial: money, type: z.string().max(50), limit: money.optional(), archived: z.boolean().optional() }).catchall(json)).max(50),
  transactions: z.array(tx).max(20000),
  goals: z.array(z.object({ id, kind: z.string().max(50), title: text, amount: money, saved: money.default(0), currency, date, cycle: z.string().max(100), category: z.string().max(100), wallet: z.string().max(100), direction: z.string().max(50).default(""), person: text.default("") }).catchall(json)).max(500),
  fixedExpenses: z.array(z.object({ id, budgetId: z.string().max(100), walletId: id.optional(), title: text, amount: money.positive(), category: z.string().max(100), dueDate: date, recurrence: z.enum(["once", "weekly", "monthly", "yearly"]), intervalMonths: z.number().int().min(1).max(12).optional(), monthPosition: z.enum(["start", "end", "date"]).optional(), reminderDays: z.number().int().min(0).max(30).optional(), active: z.boolean(), paymentRecipient: bankRecipientSchema.optional() }).catchall(json)).max(500).default([]),
  recurring: z.array(tx).max(500).default([]), rules: z.array(text).max(500).default([]),
  categories: z.array(key).max(500), categoryMeta: z.record(key, z.object({ type: z.string().max(30), icon: z.string().max(100), children: z.array(z.string().max(100)).max(100), archived: z.boolean().optional() }).catchall(json)),
  settings: z.record(key, z.union([z.string().max(20000), z.boolean()])),
  walletCategories: z.record(id, z.array(key).max(500)).optional(),
  receiptDraft: z.string().max(3_000_000).optional(),
  transactionChat: z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(50000) }).catchall(json)).max(1000), drafts: z.array(z.record(z.string(), json)).max(500), clarifyingDraftId: z.string().nullable(), activeDraftId: z.string().max(100).nullable().optional(), referencedCategories: z.array(z.string().max(100)).max(20).optional() }).optional(),
  planningChat: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(50000) }).catchall(json)).max(100).optional(),
  onboardingDraft: onboardingDraftSchema.optional(),
}).strict().superRefine((s, ctx) => {
  for (const rows of [s.wallets, s.transactions, s.goals, s.fixedExpenses, s.recurring]) if (new Set(rows.map(row => row.id)).size !== rows.length) ctx.addIssue({ code: "custom", message: "Duplicate record id." });
  if (s.transactions.some(t => !s.wallets.some(w => w.id === t.wallet) || (t.type === "transfer" && (!t.targetWallet || t.targetWallet === t.wallet || !s.wallets.some(w => w.id === t.targetWallet))))) ctx.addIssue({ code: "custom", message: "Invalid transaction wallet." });
  if (s.recurring.some(t => !s.wallets.some(w => w.id === t.wallet)) || s.goals.some(g => g.kind === "budget" && !s.wallets.some(w => w.id === g.wallet))) ctx.addIssue({ code: "custom", message: "Invalid wallet reference." });
  if (s.fixedExpenses.some(e => e.budgetId ? !s.goals.some(g => g.id === e.budgetId && g.kind === "budget") : !s.wallets.some(w => w.id === e.walletId))) ctx.addIssue({ code: "custom", message: "Invalid fixed expense parent." });
  if (new Set(s.categories).size !== s.categories.length || Object.entries(s.walletCategories || {}).some(([wallet, names]) => !s.wallets.some(w => w.id === wallet) || new Set(names).size !== names.length || names.some(n => !s.categories.includes(n)))) ctx.addIssue({ code: "custom", message: "Invalid category assignment." });
  const drafts = s.transactionChat?.drafts || [];
  const payments = s.transactions.filter(t => t.fixedExpenseId || t.fixedExpenseDueDate || t.paymentConfirmation);
  if (payments.some(t => !t.fixedExpenseId || !t.fixedExpenseDueDate || t.fixedExpenseDueDate.length !== 10 || t.type !== "expense" || t.paymentConfirmation !== "user") || new Set(payments.map(t => t.fixedExpenseId + ":" + t.fixedExpenseDueDate)).size !== payments.length) ctx.addIssue({ code: "custom", message: "Invalid or duplicate bill payment." });
  if (drafts.some(d => typeof d.id !== "string" || !d.id || d.id.length > 100) || new Set(drafts.map(d => d.id)).size !== drafts.length) ctx.addIssue({ code: "custom", message: "Invalid chat draft id." });
  // Reject excess precision instead of silently rounding financial records in SQL.
  const precision = (n: number) => Math.abs(n * 10000 - Math.round(n * 10000)) <= Math.max(1e-6, Math.abs(n * 10000) * Number.EPSILON);
  if ([...s.wallets.map(w => w.initial), ...s.transactions.map(t => t.amount), ...s.recurring.map(t => t.amount), ...s.goals.flatMap(g => [g.amount, g.saved]), ...s.fixedExpenses.map(e => e.amount)].some(n => !precision(n))) ctx.addIssue({ code: "custom", message: "Money supports at most four decimal places." });
});
export function parseWorkspace(value: unknown): AppState { return workspaceSchema.parse(value) as unknown as AppState; }
export type WorkspaceRecord = { revision: number; data: AppState | null; updatedAt: string | null };
export const emptyWorkspaceRecord = (): WorkspaceRecord => ({ revision: 0, data: null, updatedAt: null });
