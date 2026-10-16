import type { AppState } from "../components/sites/rolly/replica/store";
const normalize = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase();
export function expenseCategoriesForWallet(state: AppState, walletId: string) {
  return [...new Set([...(state.walletCategories?.[walletId] || state.categories), ...state.transactions.filter(t => t.wallet === walletId && t.type === "expense").map(t => t.category)])].filter(name => name && state.categoryMeta[name]?.type !== "income" && !state.categoryMeta[name]?.archived);
}
export function addBudgetCategory(state: AppState, walletId: string, raw: string) {
  const name = raw.normalize("NFKC").trim();
  if (!name || name.length > 80 || ["__proto__", "constructor", "prototype"].includes(name) || !state.wallets.some(w => w.id === walletId && !w.archived)) throw new Error("INVALID_CATEGORY");
  const existing = [...new Set([...state.categories, ...Object.keys(state.categoryMeta)])].find(n => normalize(n) === normalize(name));
  if (existing && state.categoryMeta[existing]?.type === "income") throw new Error("CATEGORY_IS_INCOME");
  const selected = existing || name;
  const scopes = Object.fromEntries(state.wallets.map(w => [w.id, [...(state.walletCategories?.[w.id] || state.categories)]]));
  scopes[walletId] = [...new Set([...scopes[walletId], selected])];
  return { name: selected, state: { ...state, categories: [...new Set([...state.categories, selected])], categoryMeta: { ...state.categoryMeta, [selected]: { type: "expense", icon: state.categoryMeta[selected]?.icon || "❓", children: state.categoryMeta[selected]?.children || [], archived: false } }, walletCategories: scopes } };
}
