import { z } from "zod";
import type { AppState } from "@/components/sites/rolly/replica/store";
export const SETUP_CURRENCIES = ["VND", "CNY", "USD", "EUR", "GBP", "AUD", "SGD", "JPY"] as const;
export const OCCUPATIONS = ["student", "freelancer", "employee", "business_owner", "retired", "not_specified"] as const;
const amount = z.number().finite().min(0).max(1_000_000_000_000).multipleOf(0.01);
const openingBalance = z.number().finite().min(-1_000_000_000_000).max(1_000_000_000_000).multipleOf(0.01);
const name = z.string().trim().min(1).max(80);
export function formatCategoryName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase()
    .replace(/(^|[^\p{L}\p{M}\p{N}])(\p{L})/gu, (_, separator: string, letter: string) => separator + letter.toUpperCase());
}
const categoryName = name.transform(formatCategoryName);
const identifier = z.string().min(1).max(100);
export function validSetupDate(value: string) {
  const date = new Date(value + "T12:00:00Z");
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export const onboardingSchema = z.object({
  version: z.literal(1), displayName: name, occupation: z.enum(OCCUPATIONS), language: z.enum(["en", "vi", "zh"]),
  wallets: z.array(z.object({ id: identifier, name, currency: z.string().regex(/^[A-Z]{3}$/).refine(c => Intl.supportedValuesOf("currency").includes(c)), initial: openingBalance }).strict()).min(1).max(30),
  expenseCategories: z.array(categoryName).min(1).max(50), incomeCategories: z.array(categoryName).min(1).max(50),
  commitments: z.array(z.object({ id: identifier, walletId: identifier, title: name, amount: amount.refine(n => n > 0), category: categoryName,
    dueDate: z.string().refine(validSetupDate), intervalMonths: z.number().int().min(1).max(12),
    monthPosition: z.enum(["start", "end", "date"]), reminderDays: z.number().int().min(0).max(30),
  }).strict()).max(50),
  reserves: z.array(z.object({ walletId: identifier, amount }).strict()).min(1).max(30),
}).strict().superRefine((data, ctx) => {
  const ids = new Set(data.wallets.map(w => w.id));
  const wallets = new Map(data.wallets.map(wallet => [wallet.id, wallet]));
  const normalize = (s: string) => s.normalize("NFKC").toLocaleLowerCase();
  const categories = [...data.expenseCategories, ...data.incomeCategories].map(normalize);
  if (ids.size !== data.wallets.length || new Set(data.commitments.map(c => c.id)).size !== data.commitments.length
    || new Set(categories).size !== categories.length || new Set(data.wallets.map(w => normalize(w.name))).size !== data.wallets.length)
    ctx.addIssue({ code: "custom", message: "Duplicate wallet, category or commitment." });
  if (data.reserves.length !== ids.size || new Set(data.reserves.map(r => r.walletId)).size !== ids.size || data.reserves.some(r => !ids.has(r.walletId)))
    ctx.addIssue({ code: "custom", message: "One reserve per wallet is required." });
  const commitmentCents = new Map<string, number>();
  for (const c of data.commitments) {
    if (!ids.has(c.walletId) || !data.expenseCategories.includes(c.category)) ctx.addIssue({ code: "custom", message: "Commitment references a missing wallet/category." });
    const date = new Date(c.dueDate + "T12:00:00Z");
    if ((c.monthPosition === "start" && date.getUTCDate() !== 1) || (c.monthPosition === "end" && date.getUTCDate() !== new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()))
      ctx.addIssue({ code: "custom", message: "Payment date does not match month position." });
    commitmentCents.set(c.walletId, (commitmentCents.get(c.walletId) || 0) + Math.round(c.amount * 100));
  }
  for (const [walletId, total] of commitmentCents) {
    const wallet = wallets.get(walletId);
    if (wallet && total > Math.round(wallet.initial * 100)) {
      ctx.addIssue({ code: "custom", message: "Fixed expenses exceed the wallet opening balance.", path: ["commitments"] });
    }
  }
});
export type OnboardingData = z.infer<typeof onboardingSchema>;
export const onboardingDraftSchema = z.object({ ...onboardingSchema.shape,
  displayName: z.string().max(80),
  wallets: z.array(onboardingSchema.shape.wallets.element.extend({ name: z.string().max(80) })).min(1).max(30),
  expenseCategories: z.array(categoryName).max(50), incomeCategories: z.array(categoryName).max(50),
  reserves: z.array(onboardingSchema.shape.reserves.element).max(30),
}).strict();
export type OnboardingRecord = { data: OnboardingData; completedAt: string };
export function isStarterWorkspace(state: AppState) {
  return !state.transactions.length && !state.goals.length && !(state.fixedExpenses || []).length
    && state.wallets.length === 1 && state.wallets[0].id === "default" && state.wallets[0].name === "." && state.wallets[0].initial === 0;
}
export function applyOnboarding(state: AppState, record: OnboardingRecord): AppState {
  if (state.settings.onboardingCompleted) return state;
  const data = onboardingSchema.parse(record.data), fresh = isStarterWorkspace(state);
  const categoryMeta: AppState["categoryMeta"] = fresh ? {} : { ...state.categoryMeta };
  data.expenseCategories.forEach(n => { categoryMeta[n] = { type: "expense", icon: "🧾", children: categoryMeta[n]?.children || [] }; });
  data.incomeCategories.forEach(n => { categoryMeta[n] = { type: "income", icon: "💰", children: categoryMeta[n]?.children || [] }; });
  const suppliedIds = new Set(data.wallets.map(w => w.id));
  return { ...state,
    wallets: [...(fresh ? [] : state.wallets.filter(w => !suppliedIds.has(w.id))), ...data.wallets.map(w => ({ ...state.wallets.find(old => old.id === w.id), ...w,
      currency: state.transactions.some(t => t.wallet === w.id || t.targetWallet === w.id) ? state.wallets.find(old => old.id === w.id)?.currency || w.currency : w.currency,
      type: state.wallets.find(old => old.id === w.id)?.type || "cash" }))],
    categories: Array.from(new Set([...(fresh ? [] : state.categories), ...data.expenseCategories, ...data.incomeCategories])), categoryMeta,
    fixedExpenses: [...(state.fixedExpenses || []), ...data.commitments.filter(c => !(state.fixedExpenses || []).some(old => old.id === c.id)).map(c => ({
      id: c.id, budgetId: "", walletId: c.walletId, title: c.title, amount: c.amount, category: c.category, dueDate: c.dueDate,
      recurrence: "monthly" as const, intervalMonths: c.intervalMonths, monthPosition: c.monthPosition, reminderDays: c.reminderDays, active: true,
    }))],
    settings: { ...state.settings, name: data.displayName, occupation: data.occupation,
      language: data.language === "vi" ? "Tiếng Việt" : data.language === "zh" ? "中文" : "English",
      reserveByWallet: JSON.stringify(Object.fromEntries(data.reserves.map(r => [r.walletId, r.amount]))), onboardingCompleted: record.completedAt },
  };
}
