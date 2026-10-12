"use client";

import { useSyncExternalStore } from "react";

export interface Wallet { id: string; name: string; currency: string; initial: number; type: string; limit?: number; archived?: boolean; }
export interface Transaction { id: string; title: string; amount: number; type: "expense" | "income" | "transfer"; category: string; subcategory?: string; date: string; wallet: string; targetWallet?: string; note: string; image?: string; interval?: number; unit?: string; }
export interface Goal { id: string; kind: string; title: string; amount: number; saved: number; currency: string; date: string; cycle: string; category: string; wallet: string; direction: string; person: string; }
export interface CategoryMetadata { type: string; icon: string; children: string[]; }
export interface AppState { wallets: Wallet[]; transactions: Transaction[]; goals: Goal[]; recurring: Transaction[]; rules: string[]; categories: string[]; categoryMeta: Record<string, CategoryMetadata>; receiptDraft?: string; settings: Record<string, string | boolean>; }
export const initialState: AppState = {
  wallets: [{ id: "default", name: ".", currency: "USD", initial: 0, type: "cash" }],
  transactions: [], goals: [], recurring: [], rules: [],
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
const listeners = new Set<() => void>();
function getSnapshot() {
  if (!initialized && typeof window !== "undefined") {
    initialized = true;
    try {
      const saved = JSON.parse(localStorage.getItem("rolly-replica-v2") || "null") as AppState | null;
      if (saved?.wallets && saved?.settings) current = { ...initialState, ...saved, settings: { ...initialState.settings, ...saved.settings } };
    } catch { /* Invalid saved data starts with the observed empty state. */ }
  }
  return current;
}
function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}
export function updateState(update: (value: AppState) => AppState) {
  current = update(getSnapshot());
  try { localStorage.setItem("rolly-replica-v2", JSON.stringify(current)); } catch { /* In-memory editing remains available. */ }
  listeners.forEach((listener) => listener());
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
