import { z } from "zod";
import type { AppState, ChatMessage } from "../components/finbridge/workspace/store";
import { isValidDraftCategoryName, normalizeVietnameseMessage } from "./transaction-drafts";

export const categoryCommandSchema = z.object({
  operation: z.enum(["create_category", "rename_category", "merge_categories", "delete_category"]),
  sources: z.array(z.string().min(1).max(100)).max(20),
  target: z.string().trim().min(1).max(100).nullable(),
  type: z.enum(["expense", "income"]).nullable(),
}).strict();
export type CategoryCommand = z.infer<typeof categoryCommandSchema>;
export interface CategoryConfirmation {
  id: string;
  command: CategoryCommand;
  fingerprint: string;
  impact: { transactions: number; budgets: number; fixedExpenses: number; recurring: number; drafts: number };
  status: "pending" | "saving" | "confirmed" | "cancelled" | "failed";
  applied?: boolean;
}

export function renameCategoryMessageReferences(message: ChatMessage, sources: string[], target: string): ChatMessage {
  const rename = (name: string) => sources.includes(name) ? target : name;
  return { ...message,
    ...(message.transaction ? { transaction: { ...message.transaction, category: rename(message.transaction.category) } } : {}),
    ...(message.financialContext?.category ? { financialContext: { ...message.financialContext, category: rename(message.financialContext.category) } } : {}),
    ...(message.categoryList ? { categoryList: [...new Set(message.categoryList.map(rename))] } : {}),
    ...(message.pendingScenario ? { pendingScenario: { ...message.pendingScenario, actions: message.pendingScenario.actions.map(action => ({ ...action, category: action.category ? rename(action.category) : null })) } } : {}),
    ...(message.scenarios ? { scenarios: message.scenarios.map(s => ({ ...s, changes: s.changes.map(c => ({ ...c, category: c.category ? rename(c.category) : null })), spendingReductions: s.spendingReductions?.map(r => ({ ...r, category: r.category ? rename(r.category) : null })) })) } : {}),
  };
}

function categoryFingerprint(state: AppState, command: CategoryCommand) {
  const names = [...command.sources, ...(command.target ? [command.target] : [])];
  const relevant = (name: string) => names.includes(name);
  const snapshot = JSON.stringify({
    categories: state.categories.filter(relevant).map(name => [name, state.categoryMeta[name]]),
    wallets: Object.entries(state.walletCategories || {}).map(([id, values]) => [id, values.filter(relevant)]),
    transactions: state.transactions.filter(t => relevant(t.category)).map(t => [t.id, t.category, t.wallet, t.type, t.amount, t.date]),
    goals: state.goals.filter(g => relevant(g.category)).map(g => [g.id, g.category, g.kind, g.wallet, g.currency, g.amount]),
    expenses: state.fixedExpenses?.filter(e => relevant(e.category)).map(e => [e.id, e.category, e.budgetId, e.amount, e.dueDate, e.active]),
    recurring: state.recurring.filter(t => relevant(t.category)).map(t => [t.id, t.category, t.wallet, t.type, t.amount, t.date]),
    drafts: state.transactionChat?.drafts.filter(d => !!d.category && relevant(d.category)),
  });
  // A staleness token, not an authorization token. Exclude receipt images and notes.
  let left = 2166136261, right = 5381;
  for (let index = 0; index < snapshot.length; index++) {
    const character = snapshot.charCodeAt(index);
    left = Math.imul(left ^ character, 16777619); right = Math.imul(right, 33) ^ character;
  }
  return `${(left >>> 0).toString(16)}:${(right >>> 0).toString(16)}`;
}

/** Category names are the public identifiers used by the existing workspace model. */
export function prepareCategoryOperation(state: AppState, raw: CategoryCommand, id: string): CategoryConfirmation {
  const command = categoryCommandSchema.parse(raw);
  command.sources = [...new Set(command.sources)];
  if (command.sources.some(name => !state.categories.includes(name) || state.categoryMeta[name]?.archived)) throw new Error("CATEGORY_NOT_AVAILABLE");
  if (command.operation !== "create_category" && !command.sources.length) throw new Error("CATEGORY_TARGET_REQUIRED");
  if (command.operation === "create_category" || command.operation === "rename_category") {
    if (!command.target || !isValidDraftCategoryName(command.target)) throw new Error("INVALID_CATEGORY_NAME");
    if (state.categories.some(name => normalizeVietnameseMessage(name) === normalizeVietnameseMessage(command.target!))) throw new Error("CATEGORY_EXISTS");
    if (command.operation === "create_category" && (!command.type || command.sources.length)) throw new Error("CATEGORY_TYPE_REQUIRED");
    if (command.operation === "rename_category" && command.sources.length !== 1) throw new Error("CATEGORY_TARGET_REQUIRED");
  }
  if (command.operation === "merge_categories") {
    if (!command.target || !state.categories.includes(command.target) || state.categoryMeta[command.target]?.archived || command.sources.includes(command.target)) throw new Error("CATEGORY_TARGET_REQUIRED");
    if (command.sources.some(name => (state.categoryMeta[name]?.type || "expense") !== (state.categoryMeta[command.target!]?.type || "expense"))) throw new Error("CATEGORY_TYPE_MISMATCH");
  }
  if (command.sources.includes("Chưa được phân loại")) throw new Error("PROTECTED_CATEGORY");
  const source = (name: string | null) => !!name && command.sources.includes(name);
  return { id, command, fingerprint: categoryFingerprint(state, command), status: "pending", impact: {
    transactions: state.transactions.filter(t => source(t.category)).length,
    budgets: state.goals.filter(g => source(g.category)).length,
    fixedExpenses: (state.fixedExpenses || []).filter(e => source(e.category)).length,
    recurring: state.recurring.filter(t => source(t.category)).length,
    drafts: (state.transactionChat?.drafts || []).filter(d => source(d.category)).length,
  } };
}

/** Called only after explicit confirmation, through updateState + the existing workspace writer. */
export function applyCategoryOperation(state: AppState, confirmation: CategoryConfirmation): AppState {
  if (confirmation.status !== "pending" && confirmation.status !== "saving") throw new Error("CATEGORY_OPERATION_COMPLETED");
  const checked = prepareCategoryOperation(state, confirmation.command, confirmation.id);
  if (checked.fingerprint !== confirmation.fingerprint) throw new Error("CATEGORY_STATE_CHANGED");
  const { operation, sources, target, type } = checked.command;
  const isSource = (name: string) => sources.includes(name);
  const categoryMeta = { ...state.categoryMeta };
  if (operation === "create_category") {
    if (state.categories.length >= 500) throw new Error("CATEGORY_LIMIT");
    categoryMeta[target!] = { type: type!, icon: "❓", children: [] };
    return { ...state, categories: [...state.categories, target!], categoryMeta,
      walletCategories: state.walletCategories && Object.fromEntries(state.wallets.map(w => [w.id, [...new Set([...(state.walletCategories?.[w.id] || state.categories), target!])]])) };
  }
  if (operation === "delete_category") {
    // Archive referenced categories: retain all history and financial links, hide future choices.
    const referenced = (name: string) => state.transactions.some(t => t.category === name) || state.recurring.some(t => t.category === name)
      || state.goals.some(g => g.category === name) || state.fixedExpenses?.some(e => e.category === name)
      || state.transactionChat?.drafts.some(d => d.category === name);
    for (const name of sources) {
      if (referenced(name)) categoryMeta[name] = { ...state.categoryMeta[name], archived: true };
      else delete categoryMeta[name];
    }
    return { ...state, categories: state.categories.filter(name => !isSource(name) || referenced(name)), categoryMeta,
      walletCategories: state.walletCategories && Object.fromEntries(Object.entries(state.walletCategories).map(([id, names]) => [id, names.filter(name => !isSource(name))])) };
  }
  const sourceMetadata = state.categoryMeta[sources[0]];
  categoryMeta[target!] = operation === "rename_category" ? { ...sourceMetadata } : {
    ...categoryMeta[target!], children: [...new Set([...(categoryMeta[target!]?.children || []), ...sources.flatMap(name => state.categoryMeta[name]?.children || [])])],
  };
  for (const name of sources) delete categoryMeta[name];
  const rename = <T extends { category: string }>(row: T): T => isSource(row.category) ? { ...row, category: target! } : row;
  return { ...state, categories: [...new Set(state.categories.map(name => isSource(name) ? target! : name))], categoryMeta,
    walletCategories: state.walletCategories && Object.fromEntries(Object.entries(state.walletCategories).map(([id, names]) => [id, [...new Set(names.map(name => isSource(name) ? target! : name))]])),
    transactions: state.transactions.map(rename), goals: state.goals.map(rename), fixedExpenses: state.fixedExpenses?.map(rename), recurring: state.recurring.map(rename),
    transactionChat: state.transactionChat && { ...state.transactionChat, messages: state.transactionChat.messages.map(m => renameCategoryMessageReferences(m, sources, target!)), referencedCategories: state.transactionChat.referencedCategories?.map(name => isSource(name) ? target! : name), drafts: state.transactionChat.drafts.map(d => d.category && isSource(d.category) ? { ...d, category: target! } : d) },
  };
}
