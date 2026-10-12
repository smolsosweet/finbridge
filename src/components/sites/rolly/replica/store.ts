"use client";

import { useSyncExternalStore } from "react";
import { readUserWorkspace, userWorkspaceKey, importLegacyWorkspace as copyLegacyWorkspace } from "@/lib/workspace-storage";

export interface Wallet { id: string; name: string; currency: string; initial: number; type: string; limit?: number; archived?: boolean; }
export interface Transaction { id: string; title: string; amount: number; type: "expense" | "income" | "transfer"; category: string; subcategory?: string; date: string; wallet: string; targetWallet?: string; note: string; image?: string; interval?: number; unit?: string; }
export interface Goal { id: string; kind: string; title: string; amount: number; saved: number; currency: string; date: string; cycle: string; category: string; wallet: string; direction: string; person: string; }
export interface FixedExpense { id: string; budgetId: string; title: string; amount: number; category: string; dueDate: string; recurrence: "once" | "weekly" | "monthly" | "yearly"; active: boolean; }
export interface CategoryMetadata { type: string; icon: string; children: string[]; archived?: boolean; }
export interface AppState { wallets: Wallet[]; transactions: Transaction[]; goals: Goal[]; fixedExpenses?: FixedExpense[]; recurring: Transaction[]; rules: string[]; categories: string[]; categoryMeta: Record<string, CategoryMetadata>; receiptDraft?: string; settings: Record<string, string | boolean>; }
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
const listeners = new Set<() => void>();
function notify() { listeners.forEach((listener) => listener()); }
export function workspaceOwner() { return activeOwner; }
export function activateUserWorkspace(userId: string, name: string) {
  if (!userId.trim()) throw new Error("A server-authenticated user is required.");
  if (activeOwner === userId) return;
  activeOwner = userId; ownerName = name; initialized = false;
  current = { ...structuredClone(initialState), settings: { ...initialState.settings, name, language: "English" } };
  getSnapshot(); notify();
}
export function clearUserWorkspace(expectedOwner?: string) {
  if (expectedOwner && activeOwner !== expectedOwner) return;
  activeOwner = null; ownerName = ""; initialized = false; current = initialState; notify();
}
export function importOldWorkspace(explicitlyConfirmed: boolean) {
  if (!activeOwner) throw new Error("No active user workspace.");
  copyLegacyWorkspace(localStorage, activeOwner, explicitlyConfirmed);
  initialized = false; getSnapshot(); notify();
}
function getSnapshot() {
  if (!activeOwner) return initialState;
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
  try { localStorage.setItem(userWorkspaceKey(activeOwner), JSON.stringify(current)); } catch { /* In-memory editing remains available. */ }
  notify();
}
export function useAppState() { return useSyncExternalStore(subscribe, getSnapshot, () => initialState); }
export function setSetting(name: string, value: string | boolean) { updateState((s) => ({ ...s, settings: { ...s.settings, [name]: value } })); }
export function currencySymbol(code: string) { return ({ USD: "$", VND: "₫", EUR: "€", GBP: "£", AUD: "A$", SGD: "S$", JPY: "¥" } as Record<string, string>)[code] || code + " "; }
export function money(amount: number, currency = "USD", settings = current.settings) {
  const text = new Intl.NumberFormat(settings.separator ? "de-DE" : "en-US", { maximumFractionDigits: 2, notation: settings.compact ? "compact" : "standard" }).format(amount);
  return settings.symbolAfter ? text + currencySymbol(currency) : currencySymbol(currency) + text;
}
export function today() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}
