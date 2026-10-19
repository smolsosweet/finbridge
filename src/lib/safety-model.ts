import { z } from "zod";
import type { AppState, Goal } from "../components/finbridge/workspace/store";
import { budgetWindow } from "../components/finbridge/workspace/planningModel";

const id = z.string().min(1).max(100);
const name = z.string().trim().min(1).max(100);
const amount = z.number().finite().min(0).max(1e12);
const date = z.string().refine(value => { const d = new Date(value + "T12:00:00Z"); return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value; });
const currency = z.string().regex(/^[A-Z]{3}$/).refine(value => Intl.supportedValuesOf("currency").includes(value));
export const safetyRuleSchema = z.object({
  id, name, kind: z.enum(["budget", "reserve"]), targetId: id,
  groupId: z.string().uuid().optional(), archived: z.boolean().optional(),
  basis: z.enum(["actual", "forecast"]), unit: z.enum(["percent", "amount"]),
  threshold: amount.refine(n => n > 0), email: z.boolean(), active: z.boolean(),
}).strict().superRefine((r, ctx) => {
  if (r.unit === "percent" && r.threshold > 1000) ctx.addIssue({ code: "custom", message: "Percentage must be at most 1000." });
  if (r.kind === "reserve" && (r.unit !== "amount" || r.basis !== "actual")) ctx.addIssue({ code: "custom", message: "Reserves use an actual balance and an absolute floor." });
});
export type SafetyRule = z.infer<typeof safetyRuleSchema>;
export const safetySnapshotSchema = z.object({
  wallets: z.array(z.object({ id, name, currency, initial: z.number().finite().min(-1e12).max(1e12), archived: z.boolean() }).strict()).max(50),
  transactions: z.array(z.object({ id, amount, type: z.enum(["income", "expense", "transfer"]), wallet: id, targetWallet: id.optional(), category: z.string().max(100), date }).strict()).max(20000),
  budgets: z.array(z.object({ id, title: name, amount: amount.refine(n => n > 0), currency, wallet: id, category: z.string().max(100), date, cycle: z.string().max(40) }).strict()).max(200),
  language: z.enum(["en", "vi", "zh"]),
  timeZone: z.string().max(80).refine(value => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }),
}).strict().superRefine((s, ctx) => {
  for (const list of [s.wallets, s.transactions, s.budgets]) if (new Set(list.map(item => item.id)).size !== list.length) ctx.addIssue({ code: "custom", message: "Duplicate identifiers." });
  if (s.transactions.some(t => !s.wallets.some(w => w.id === t.wallet) || (t.type === "transfer" && (!t.targetWallet || t.targetWallet === t.wallet || !s.wallets.some(w => w.id === t.targetWallet))))) ctx.addIssue({ code: "custom", message: "Unknown transaction wallet." });
});
export type SafetySnapshot = z.infer<typeof safetySnapshotSchema>;
export type SafetyEvaluation = {
  state: "ok" | "alarm" | "unavailable"; reason: "missing" | "currency" | "transfer" | "history" | "period" | "overflow" | "stale" | null;
  actual: number | null; value: number | null; limit: number; currency: string; start: string; end: string;
  remainingDays: number; dailyAllowance: number | null; computedAt: string;
};
export function safetyLanguage(value: unknown): "en" | "vi" | "zh" {
  const v = String(value).toLowerCase(); return /中文|chinese|zh|trung/.test(v) ? "zh" : /việt|vi/.test(v) ? "vi" : "en";
}
export function safetySnapshot(state: AppState, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone): SafetySnapshot {
  return safetySnapshotSchema.parse({
    wallets: state.wallets.map(w => ({ id: w.id, name: w.name, currency: w.currency, initial: w.initial, archived: !!w.archived })),
    transactions: state.transactions.map(t => ({ id: t.id, amount: t.amount, type: t.type, wallet: t.wallet, ...(t.targetWallet ? { targetWallet: t.targetWallet } : {}), category: t.category, date: t.date.slice(0, 10) })),
    budgets: state.goals.filter(g => g.kind === "budget").map(g => ({ id: g.id, title: g.title, amount: g.amount, currency: g.currency, wallet: g.wallet, category: g.category, date: g.date, cycle: g.cycle })),
    language: safetyLanguage(state.settings.language), timeZone,
  });
}
export function safetyDate(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return ["year", "month", "day"].map(k => parts.find(p => p.type === k)!.value).join("-");
}
const distance = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000);
export function evaluateSafety(rule: SafetyRule, snapshot: SafetySnapshot, now = new Date()): SafetyEvaluation {
  const asOf = safetyDate(now, snapshot.timeZone);
  const budget = rule.kind === "budget" ? snapshot.budgets.find(b => b.id === rule.targetId) : undefined;
  const wallet = snapshot.wallets.find(w => w.id === (budget?.wallet || rule.targetId) && !w.archived);
  const result: SafetyEvaluation = { state: "unavailable", reason: "missing", actual: null, value: null, limit: rule.unit === "percent" ? (budget?.amount || 0) * rule.threshold / 100 : rule.threshold, currency: wallet?.currency || "", start: asOf, end: asOf, remainingDays: 0, dailyAllowance: null, computedAt: now.toISOString() };
  if (!wallet || (rule.kind === "budget" && !budget)) return result;
  const digits = new Intl.NumberFormat("en", { style: "currency", currency: wallet.currency }).resolvedOptions().maximumFractionDigits ?? 2;
  const scale = 10 ** digits, minor = (n: number) => Math.round(n * scale);
  result.limit = Math.ceil(result.limit * scale - 1e-8) / scale;
  if (budget) {
    if (budget.currency !== wallet.currency) return { ...result, reason: "currency" };
    if (!["daily", "weekly", "monthly", "yearly", "Hằng ngày", "Hằng tuần", "Hai tuần", "Hằng tháng", "Hằng năm", "Hàng tháng", "Hàng năm"].includes(budget.cycle)) return { ...result, reason: "period" };
    const window = budgetWindow(budget as Goal, asOf);
    Object.assign(result, window);
    if (asOf < window.start) return { ...result, reason: "period" };
    const rows = snapshot.transactions.filter(t => t.type === "expense" && t.wallet === wallet.id && (!budget.category || t.category === budget.category) && t.date >= window.start && t.date <= asOf && t.date <= window.end);
    const total = rows.reduce((s, t) => s + minor(t.amount), 0);
    if (!Number.isSafeInteger(total)) return { ...result, reason: "overflow" };
    result.actual = total / scale;
    const elapsed = Math.min(distance(window.start, window.end) + 1, distance(window.start, asOf) + 1);
    result.remainingDays = Math.max(0, distance(asOf, window.end));
    result.dailyAllowance = result.remainingDays ? Math.floor(Math.max(0, minor(budget.amount) - total) / result.remainingDays) / scale : 0;
    if (rule.basis === "forecast" && result.remainingDays > 0 && (elapsed < 3 || !rows.length)) return { ...result, reason: "history" };
    // Total recorded spending pace. Fixed bills are already part of that pace;
    // do not add unconfirmed scheduled bills and count them a second time.
    const projected = Math.round(total * (distance(window.start, window.end) + 1) / elapsed);
    if (!Number.isSafeInteger(projected)) return { ...result, reason: "overflow" };
    result.value = rule.basis === "actual" ? result.actual : projected / scale;
  } else {
    let total = minor(wallet.initial);
    for (const t of snapshot.transactions.filter(t => t.date <= asOf)) {
      if (t.wallet === wallet.id) total += (t.type === "income" ? 1 : -1) * minor(t.amount);
      if (t.type === "transfer" && t.targetWallet === wallet.id) {
        if (snapshot.wallets.find(w => w.id === t.wallet)?.currency !== wallet.currency) return { ...result, reason: "transfer" };
        total += minor(t.amount);
      }
    }
    if (!Number.isSafeInteger(total)) return { ...result, reason: "overflow" };
    result.actual = result.value = total / scale;
    result.start = result.end = "reserve";
  }
  return { ...result, reason: null, state: (rule.kind === "reserve" ? result.value! < result.limit : result.value! >= result.limit) ? "alarm" : "ok" };
}

export type SafetyEvent = { id: string; ruleId: string; name: string; createdAt: string; read: boolean; evaluation: SafetyEvaluation; emailStatus: "off" | "pending" | "sending" | "accepted" | "failed" | "unknown" | "cancelled"; };
export type SafetyDocument = { revision: number; rules: SafetyRule[]; snapshot: SafetySnapshot | null; sourceId: string | null; syncedAt: string | null; evaluated: Record<string, SafetyEvaluation>; events: SafetyEvent[]; episodes: Record<string, { period: string; alarm: boolean; notified: boolean; sentAt: string | null }> };
export const emptySafetyDocument = (): SafetyDocument => ({ revision: 0, rules: [], snapshot: null, sourceId: null, syncedAt: null, evaluated: {}, events: [], episodes: {} });
export function publicSafety(doc: SafetyDocument, emailAvailable: boolean) {
  return { revision: doc.revision, rules: doc.rules, evaluated: doc.evaluated, events: doc.events, syncedAt: doc.syncedAt, sourceId: doc.sourceId, emailAvailable, timeZone: doc.snapshot?.timeZone || null };
}
export type SafetyPublic = ReturnType<typeof publicSafety>;
export const emptySafetyPublic = () => publicSafety(emptySafetyDocument(), false);
export function advanceSafety(doc: SafetyDocument, now = new Date()): SafetyDocument {
  const next = structuredClone(doc);
  if (!next.snapshot) return next;
  const notifiedScopes = new Set<string>();
  const evaluations = new Map(next.rules.map(rule => [rule.id, evaluateSafety(rule, next.snapshot!, now)]));
  const ordered = [...next.rules].sort((a, b) => evaluations.get(b.id)!.limit - evaluations.get(a.id)!.limit);
  for (const rule of ordered) {
    const e = evaluations.get(rule.id)!;
    if (doc.sourceId !== "database" && (!doc.syncedAt || now.getTime() - Date.parse(doc.syncedAt) > 86400000)) { next.evaluated[rule.id] = { ...e, state: "unavailable", reason: "stale" }; continue; }
    next.evaluated[rule.id] = e;
    if (!rule.active || e.state === "unavailable") continue;
    const period = `${e.start}/${e.end}`, old = next.episodes[rule.id];
    const episode = old?.period === period ? old : { period, alarm: false, notified: false, sentAt: null };
    const repeatable = rule.kind === "reserve" || rule.basis === "forecast";
    const cooldown = !episode.sentAt || now.getTime() - Date.parse(episode.sentAt) >= 86400000;
    const notify = e.state === "alarm" && (repeatable ? !episode.alarm && cooldown : !episode.notified);
    if (notify) {
      const scope = `${rule.kind}/${rule.targetId}/${rule.basis}/${rule.email}`;
      if (repeatable || !notifiedScopes.has(scope)) next.events.unshift({ id: crypto.randomUUID(), ruleId: rule.id, name: rule.name, createdAt: now.toISOString(), read: false, evaluation: e, emailStatus: rule.email ? "pending" : "off" });
      notifiedScopes.add(scope);
      episode.notified = true; episode.sentAt = now.toISOString();
    }
    // Keep the crossing armed during cooldown, so a sustained breach can alert later.
    episode.alarm = e.state === "alarm" && (episode.alarm || notify);
    if (e.state === "ok") episode.alarm = false;
    next.episodes[rule.id] = episode;
  }
  return next;
}
