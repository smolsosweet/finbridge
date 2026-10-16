import { test } from "node:test";
import assert from "node:assert/strict";
import { safetyFixture, ruleFixture } from "./safety-fixtures.mjs";
import { safetySnapshotSchema, safetyRuleSchema, safetySnapshot, evaluateSafety, advanceSafety, emptySafetyDocument, safetyDate } from "../src/lib/safety-model.ts";
import { handleSafety } from "../src/lib/safety-handler.ts";
import { renderSafetyEmail, sendSafetyEmail, safetyEmailAvailable } from "../src/lib/safety-mail.ts";
const now = new Date("2026-10-15T12:00:00Z");
const evaluate = (r = {}, s = safetyFixture()) => evaluateSafety({ ...ruleFixture(), ...r }, s, now);
const doc = (snapshot = safetyFixture(), rule = ruleFixture()) => ({ ...emptySafetyDocument(), snapshot, rules: [rule], syncedAt: now.toISOString() });
test("budget actual thresholds include equality and exclude future income, transfers and other currencies", () => {
  const s = safetyFixture(); s.transactions.push({ id: "future", amount: 9000, type: "expense", wallet: "bank", category: "Dining", date: "2026-10-20" }, { id: "income", amount: 9000, type: "income", wallet: "bank", category: "Dining", date: "2026-10-10" }, { id: "foreign", amount: 1000, type: "expense", wallet: "ali", category: "Dining", date: "2026-10-10" });
  assert.equal(evaluate({}, s).actual, 500); assert.equal(evaluate({ threshold: 50 }, s).state, "alarm"); assert.equal(evaluate().state, "ok");
});
test("forecast shares the recorded pace, has a daily allowance and does not add scheduled bills twice", () => {
  const e = evaluate({ basis: "forecast" }); assert.equal(e.value, 1033.33); assert.equal(e.actual, 500); assert.equal(e.dailyAllowance, 31.25); assert.equal(e.state, "alarm");
});
test("forecast waits for three elapsed days and non-empty history", () => {
  const s = safetyFixture(); s.transactions[0].date = "2026-10-01";
  assert.equal(evaluateSafety({ ...ruleFixture(), basis: "forecast" }, s, new Date("2026-10-02T12:00:00Z")).reason, "history");
  s.transactions = []; assert.equal(evaluate({ basis: "forecast" }, s).reason, "history");
});
test("reserve uses a strict below-floor comparison and ignores future dated expenses", () => {
  const r = { kind: "reserve", targetId: "bank", unit: "amount", threshold: 1500 };
  assert.equal(evaluate(r).state, "ok"); assert.equal(evaluate({ ...r, threshold: 1500.01 }).state, "alarm"); assert.equal(evaluate(r).value, 1500);
});
test("cross-currency incoming transfers disable a reserve conclusion", () => {
  const s = safetyFixture(); s.transactions.push({ id: "fx", type: "transfer", amount: 100, wallet: "ali", targetWallet: "bank", category: "", date: "2026-10-12" });
  assert.equal(evaluate({ kind: "reserve", targetId: "bank", unit: "amount" }, s).reason, "transfer");
});
test("missing and archived scopes, incompatible currencies and unsupported cycles fail closed", () => {
  const s = safetyFixture(); s.wallets[0].archived = true; assert.equal(evaluate({}, s).reason, "missing");
  s.wallets[0].archived = false; s.budgets[0].currency = "CNY"; assert.equal(evaluate({}, s).reason, "currency");
  s.budgets[0].currency = "USD"; s.budgets[0].cycle = "unknown"; assert.equal(evaluate({}, s).reason, "period");
});
test("weekly and monthly rollover reset actual alerts exactly once per new period", () => {
  let d = doc(safetyFixture(), { ...ruleFixture(), threshold: 50 });
  d = advanceSafety(d, now); assert.equal(d.events.length, 1); d = advanceSafety(d, now); assert.equal(d.events.length, 1);
  d.snapshot.transactions.push({ ...d.snapshot.transactions[0], id: "next", date: "2026-11-05" }); d.syncedAt = "2026-11-15T12:00:00Z";
  d = advanceSafety(d, new Date(d.syncedAt)); assert.equal(d.events.length, 2);
  const s = safetyFixture(); s.budgets[0].cycle = "weekly"; const e = evaluate({}, s); assert.equal(e.start, "2026-10-15"); assert.equal(e.end, "2026-10-21");
});
test("forecast recovery and another breach respect a 24 hour cooldown", () => {
  let d = doc(safetyFixture(), { ...ruleFixture(), basis: "forecast", threshold: 50 }); d = advanceSafety(d, now); assert.equal(d.events.length, 1);
  d.snapshot.transactions = []; d = advanceSafety(d, now); // unavailable is not evidence of recovery
  assert.equal(d.episodes["rule-1"].alarm, true);
  d.snapshot.transactions = [{ ...safetyFixture().transactions[0], amount: 1 }]; d = advanceSafety(d, now);
  d.snapshot.transactions[0].amount = 500; d = advanceSafety(d, new Date(now.getTime() + 3600000)); assert.equal(d.events.length, 1);
  d.syncedAt = "2026-10-16T13:00:00Z"; d = advanceSafety(d, new Date(d.syncedAt)); assert.equal(d.events.length, 2);
});
test("a jump across several actual thresholds produces only the highest alert", () => {
  let d = doc(safetyFixture(), { ...ruleFixture(), threshold: 80 });
  d.rules.push({ ...ruleFixture(), id: "rule-100", threshold: 100 });
  d.snapshot.transactions[0].amount = 1100; d = advanceSafety(d, now);
  assert.equal(d.events.length, 1); assert.equal(d.events[0].ruleId, "rule-100"); assert.equal(d.episodes["rule-1"].notified, true);
});
test("stale snapshots cannot create alerts and paused rules retain history", () => {
  let d = doc(safetyFixture(), { ...ruleFixture(), threshold: 50 }); d.syncedAt = "2026-10-13T00:00:00Z"; d = advanceSafety(d, now); assert.equal(d.events.length, 0); assert.equal(d.evaluated["rule-1"].reason, "stale");
  d.syncedAt = now.toISOString(); d = advanceSafety(d, now); d.rules[0].active = false; d = advanceSafety(d, now); assert.equal(d.events.length, 1);
});
test("currency precision, inclusive end dates and time zones remain deterministic", () => {
  assert.equal(safetyDate(new Date("2026-10-31T18:00:00Z"), "Asia/Bangkok"), "2026-11-01");
  const s = safetyFixture(); s.wallets[0].currency = s.budgets[0].currency = "JPY"; s.transactions[0].amount = 801; assert.equal(evaluate({}, s).value, 801);
  s.timeZone = "America/New_York"; assert.equal(evaluateSafety(ruleFixture(), s, new Date("2026-11-01T01:00:00Z")).end, "2026-10-31");
});
test("schemas reject unknown owner/role fields, duplicates, impossible dates and forged reserve forecasts", () => {
  assert.equal(safetySnapshotSchema.safeParse({ ...safetyFixture(), userId: "other" }).success, false);
  for (const date of ["not-a-date", "2026-02-30", "2026-99-99"]) { const s = safetyFixture(); s.transactions[0].date = date; assert.equal(safetySnapshotSchema.safeParse(s).success, false); }
  const s = safetyFixture(); s.wallets.push(s.wallets[0]); assert.equal(safetySnapshotSchema.safeParse(s).success, false);
  assert.equal(safetyRuleSchema.safeParse({ ...ruleFixture(), kind: "reserve", basis: "forecast" }).success, false);
});
test("the snapshot redacts notes, receipt images, chat and unrelated personal settings", () => {
  const s = safetyFixture();
  const snapshot = safetySnapshot({ wallets: s.wallets, transactions: s.transactions.map(t => ({ ...t, note: "SECRET_NOTE", image: "SECRET_IMAGE" })), goals: s.budgets.map(b => ({ ...b, kind: "budget" })), settings: { language: "English", email: "SECRET_EMAIL" }, categories: [], categoryMeta: {}, transactionChat: "SECRET_CHAT" });
  assert.doesNotMatch(JSON.stringify(snapshot), /SECRET/);
});
test("no session or foreign origin causes zero repository calls", async () => {
  let calls = 0; const repo = { read: async () => { calls++; }, mutate: async () => { calls++; } };
  const request = () => new Request("https://finbridge.invalid/api/safety", { method: "POST", headers: { origin: "https://other.invalid", "content-type": "application/json" }, body: "{}" });
  assert.equal((await handleSafety(request(), null, "https://finbridge.invalid", repo, false)).status, 401);
  assert.equal((await handleSafety(request(), "user", "https://finbridge.invalid", repo, false)).status, 403); assert.equal(calls, 0);
});
test("email is opt-in, requires configuration and contains no financial details", () => {
  assert.equal(safetyEmailAvailable({}), false);
  for (const lang of ["en", "vi", "zh"]) { const mail = renderSafetyEmail(lang, "https://finbridge.invalid"); assert.match(mail.html, /\/app\/safetyAlerts/); assert.doesNotMatch(mail.html + mail.text, /500|1000|Synthetic|Monthly dining/); }
});
test("ambiguous email timeout is not a retry; only definite throttling can be retried", async () => {
  const env = { SAFETY_EMAIL_ENABLED: "true", SAFETY_CRON_SECRET: "x".repeat(40), AUTH_EMAIL_MODE: "brevo", BREVO_API_KEY: "synthetic", AUTH_EMAIL_FROM: "sender@example.invalid", BETTER_AUTH_URL: "https://finbridge.invalid" };
  const original = globalThis.fetch;
  try {
    for (const [status, expected] of [[201, "accepted"], [429, "retry"], [400, "failed"], [503, "unknown"]]) { globalThis.fetch = async () => new Response("", { status }); assert.equal(await sendSafetyEmail("synthetic@example.invalid", "en", env), expected); }
    globalThis.fetch = async () => { throw new Error("TIMEOUT"); }; assert.equal(await sendSafetyEmail("synthetic@example.invalid", "en", env), "unknown");
  } finally { globalThis.fetch = original; }
});
