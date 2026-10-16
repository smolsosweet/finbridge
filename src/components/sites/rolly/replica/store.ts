"use client";

import { useSyncExternalStore } from "react";
import { readUserWorkspace, userWorkspaceKey, importLegacyWorkspace as copyLegacyWorkspace } from "@/lib/workspace-storage";
import { readPreferredLanguage, rememberPreferredLanguage, workspaceLanguage } from "@/lib/language-preference";
import type { FinancialScenario } from "@/lib/scenario-planner";
import type { OnboardingData } from "@/lib/onboarding";
import type { BankRecipient } from "@/lib/bank-transfer";

export interface Wallet { id: string; name: string; currency: string; initial: number; type: string; limit?: number; archived?: boolean; }
export interface Transaction { id: string; title: string; amount: number; type: "expense" | "income" | "transfer"; category: string; subcategory?: string; date: string; wallet: string; targetWallet?: string; note: string; image?: string; interval?: number; unit?: string; fixedExpenseId?: string; fixedExpenseDueDate?: string; paymentConfirmation?: "user"; }
export interface Goal { id: string; kind: string; title: string; amount: number; saved: number; currency: string; date: string; cycle: string; category: string; wallet: string; direction: string; person: string; }
export interface FixedExpense { id: string; budgetId: string; walletId?: string; title: string; amount: number; category: string; dueDate: string; recurrence: "once" | "weekly" | "monthly" | "yearly"; intervalMonths?: number; monthPosition?: "start" | "end" | "date"; reminderDays?: number; active: boolean; paymentRecipient?: BankRecipient; }
export interface CategoryMetadata { type: string; icon: string; children: string[]; archived?: boolean; }
export interface ChatMessage { role: "assistant" | "user"; text: string; localOnly?: boolean; transaction?: Transaction; draftIds?: string[]; walletChoiceDraftIds?: string[]; categoryChoiceDraftIds?: string[]; retryReceipt?: boolean; }
export interface TransactionChatSession { messages: ChatMessage[]; drafts: Array<{ id: string; title: string; amount: number | null; type: "expense" | "income" | null; category: string | null; date: string | null; wallet: string | null; currency: string | null; needsReview: string[] }>; clarifyingDraftId: string | null; }
export type PlanningChatMessage = { role: "user" | "assistant"; text: string; scenarios?: FinancialScenario[]; clarification?: string | null; walletChoices?: Array<{ id: string; name: string; currency: string }>; pendingScenario?: string; selectedWalletId?: string };
export interface AppState { wallets: Wallet[]; transactions: Transaction[]; goals: Goal[]; fixedExpenses?: FixedExpense[]; recurring: Transaction[]; rules: string[]; categories: string[]; categoryMeta: Record<string, CategoryMetadata>; walletCategories?: Record<string, string[]>; receiptDraft?: string; transactionChat?: TransactionChatSession; planningChat?: PlanningChatMessage[]; onboardingDraft?: OnboardingData; settings: Record<string, string | boolean>; }
export const initialState: AppState = {
  wallets: [{ id: "default", name: ".", currency: "USD", initial: 0, type: "cash" }],
  transactions: [], goals: [], fixedExpenses: [], recurring: [], rules: [],
  categories: ["Chưa được phân loại", "Thức ăn & Đồ uống", "Nhà", "Mua sắm", "Thu nhập", "Lương", "Quà tặng"],
  categoryMeta: {
    "Chưa được phân loại": { type: "expense", icon: "❓", children: [] },
    "Thức ăn & Đồ uống": { type: "expense", icon: "🍔", children: [] },
    "Nhà": { type: "expense", icon: "🏠", children: [] },
    "Mua sắm": { type: "expense", icon: "🛍️", children: [] },
    "Thu nhập": { type: "income", icon: "💰", children: [] },
    "Lương": { type: "income", icon: "💵", children: [] },
    "Quà tặng": { type: "income", icon: "🎁", children: [] },
  },
  settings: { theme: "light", personality: "Cổ Động Viên Ủng Hộ", language: "Tiếng Việt", reply: "Tiếng Việt", monthStart: "1", manual: false, chart: true, totalBalance: true, savings: true, separator: false, symbolAfter: false, compact: false, autoMemory: false, goal: "", less: "", name: "." },
};
let current = initialState;
let initialized = false;
let activeOwner: string | null = null;
let ownerName = "";
let persistence: "browser" | "database" = "browser";
let flushDatabase: (() => Promise<void>) | null = null;
const listeners = new Set<() => void>();
function notify() { listeners.forEach((listener) => listener()); }
export function workspaceOwner() { return activeOwner; }
export function activateUserWorkspace(userId: string, name: string, options?: { persistence: "database" | "browser" }) {
  if (!userId.trim()) throw new Error("A server-authenticated user is required.");
  if (activeOwner === userId) return;
  activeOwner = userId; ownerName = name; initialized = false;
  persistence = options?.persistence || "browser";
  current = { ...structuredClone(initialState), settings: { ...initialState.settings, name, language: workspaceLanguage(readPreferredLanguage()) } };
  getSnapshot(); notify();
}
export function clearUserWorkspace(expectedOwner?: string) {
  if (expectedOwner && activeOwner !== expectedOwner) return;
  activeOwner = null; ownerName = ""; initialized = false; current = initialState; flushDatabase = null; notify();
}
export function workspacePersistence() { return persistence; }
export function getWorkspaceState() { return getSnapshot(); }
export function replaceDatabaseWorkspace(owner: string, value: AppState) {
  if (activeOwner !== owner || persistence !== "database") return;
  current = value; initialized = true; notify();
}
export function registerWorkspaceFlusher(owner: string, flush: () => Promise<void>) {
  if (activeOwner !== owner) return () => {};
  flushDatabase = flush;
  return () => { if (flushDatabase === flush) flushDatabase = null; };
}
export async function flushWorkspace() { if (persistence === "database" && flushDatabase) await flushDatabase(); }
export function importOldWorkspace(explicitlyConfirmed: boolean) {
  if (!activeOwner) throw new Error("No active user workspace.");
  if (persistence === "database") throw new Error("Use the database migration flow.");
  copyLegacyWorkspace(localStorage, activeOwner, explicitlyConfirmed);
  initialized = false; getSnapshot(); notify();
}
function getSnapshot() {
  if (!activeOwner) return initialState;
  if (persistence === "database") return current;
  if (!initialized && typeof window !== "undefined") {
    initialized = true;
    try {
      const saved = readUserWorkspace(localStorage, activeOwner);
      if (saved) current = { ...initialState, ...saved, settings: { ...initialState.settings, name: ownerName, language: "English", ...saved.settings } };
    } catch { /* User data and the unclaimed legacy record remain untouched. */ }
  }
  return current;
}
function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}
export const subscribeWorkspace = subscribe;
export function updateState(update: (value: AppState) => AppState) {
  if (!activeOwner) throw new Error("No active user workspace.");
  current = update(getSnapshot());
  if (current.walletCategories) current = { ...current, walletCategories: Object.fromEntries(current.wallets.map(w => [w.id, [...new Set(current.walletCategories?.[w.id] || current.categories)].filter(n => current.categories.includes(n))])) };
  if (persistence === "browser") { try { localStorage.setItem(userWorkspaceKey(activeOwner), JSON.stringify(current)); } catch { /* Demo data can remain in memory. */ } }
  notify();
}
export function useAppState() { return useSyncExternalStore(subscribe, getSnapshot, () => initialState); }
export function setSetting(name: string, value: string | boolean) {
  if (name === "language" && typeof value === "string") rememberPreferredLanguage(value);
  updateState((s) => ({ ...s, settings: { ...s.settings, [name]: value } }));
}
export function currencySymbol(code: string) { return ({ USD: "$", VND: "₫", EUR: "€", GBP: "£", AUD: "A$", SGD: "S$", JPY: "¥" } as Record<string, string>)[code] || code + " "; }
export function money(amount: number, currency = "USD", settings = current.settings) {
  const text = new Intl.NumberFormat(settings.separator ? "de-DE" : "en-US", { maximumFractionDigits: 2, notation: settings.compact ? "compact" : "standard" }).format(amount);
  return settings.symbolAfter ? text + currencySymbol(currency) : currencySymbol(currency) + text;
}
export function today() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}
