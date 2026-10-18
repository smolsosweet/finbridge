const assert = require("node:assert/strict");
const { test, after } = require("node:test");
const fs = require("node:fs"), ts = require("typescript"), { Pool } = require("pg");
require("@next/env").loadEnvConfig(process.cwd());
function compile(file, dependencies = {}) {
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", output)(name => dependencies[name] || require(name), module, module.exports);
  return module.exports;
}
const onboarding = compile("src/lib/onboarding.ts");
const dates = compile("src/components/sites/rolly/replica/chartWeek.ts");
const planning = compile("src/components/sites/rolly/replica/planningModel.ts", { "./chartWeek": dates });
const payments = compile("src/lib/fixed-expense-payments.ts", { "../components/sites/rolly/replica/planningModel": planning });
const outlook = compile("src/lib/financial-outlook.ts", { "../components/sites/rolly/replica/planningModel": planning, "./fixed-expense-payments": payments });
const chat = compile("src/lib/chat-local-plan.ts", { "./financial-outlook": outlook });
const repository = compile("src/lib/onboarding-repository.ts", { "./onboarding": onboarding });
const handler = compile("src/lib/onboarding-handler.ts", { "./onboarding": onboarding });
const payload = { version: 1, displayName: "Synthetic Finn user", occupation: "student", language: "en",
  wallets: [{ id: "bank", name: "Techcombank", currency: "VND", initial: 50000000 }, { id: "ali", name: "Alipay", currency: "CNY", initial: 2000 }],
  expenseCategories: ["Education", "Dining"], incomeCategories: ["Salary"],
  commitments: [{ id: "tuition", walletId: "bank", title: "Tuition", amount: 30000000, category: "Education", dueDate: "2026-10-31", intervalMonths: 3, monthPosition: "end", reminderDays: 7 }],
  reserves: [{ walletId: "bank", amount: 25000000 }, { walletId: "ali", amount: 500 }] };
const record = { data: payload, completedAt: "2026-10-14T00:00:00Z" };
test("category capitalization is normalized at the server boundary with matching references", () => {
  assert.equal(onboarding.formatCategoryName("  dI  chuYển "), "Di Chuyển");
  assert.equal(onboarding.formatCategoryName("di chuyển"), "Di Chuyển");
  const parsed = onboarding.onboardingSchema.parse({ ...payload, expenseCategories: ["dI chuYển"], commitments: [{ ...payload.commitments[0], category: "DI CHUYỂN" }] });
  assert.deepEqual(parsed.expenseCategories, ["Di Chuyển"]);
  assert.equal(parsed.commitments[0].category, "Di Chuyển");
});
const fresh = { wallets: [{ id: "default", name: ".", currency: "USD", initial: 0, type: "cash" }], transactions: [], goals: [], fixedExpenses: [], recurring: [], rules: [], categories: [], categoryMeta: {}, settings: {} };
const state = onboarding.applyOnboarding(fresh, record);
test("valid setup supports separate VND/CNY wallets, reserves and quarterly tuition", () => assert.equal(onboarding.onboardingSchema.safeParse(payload).success, true));
test("unknown user/role fields, duplicate names and invalid data are rejected", () => {
  for (const change of [{ userId: "foreign" }, { role: "admin" }, { expenseCategories: ["Salary"] }, { incomeCategories: ["salary", "Salary"] }, { occupation: "admin" }, { wallets: [] }, { wallets: [{ ...payload.wallets[0], initial: -1e13 }] }, { wallets: [{ ...payload.wallets[0], currency: "ZZZ" }] }, { commitments: [{ ...payload.commitments[0], amount: 0.001 }] }, { commitments: [{ ...payload.commitments[0], amount: 50000001 }] }, { commitments: [{ ...payload.commitments[0] }, { ...payload.commitments[0], id: "tuition-two", amount: 30000000 }] }, { reserves: [{ walletId: "foreign", amount: 100 }] }, { commitments: [{ ...payload.commitments[0], dueDate: "2026-02-30" }] }, { commitments: [{ ...payload.commitments[0], category: "Missing" }] }])
    assert.equal(onboarding.onboardingSchema.safeParse({ ...payload, ...change }).success, false, JSON.stringify(change));
});
test("incomplete local drafts are validated without being accepted as completed setup", () => {
  const draft = { ...payload, displayName: "", expenseCategories: [], incomeCategories: [], commitments: [], reserves: [], wallets: [{ ...payload.wallets[0], name: "" }] };
  assert.equal(onboarding.onboardingDraftSchema.safeParse(draft).success, true);
  assert.equal(onboarding.onboardingSchema.safeParse(draft).success, false);
  assert.equal(onboarding.onboardingDraftSchema.safeParse({ ...draft, displayName: {} }).success, false);
});
test("setup creates wallets/plans but zero expense transactions; repeated hydration is idempotent", () => {
  assert.equal(state.wallets.length, 2); assert.equal(state.fixedExpenses.length, 1); assert.equal(state.transactions.length, 0);
  assert.deepEqual(onboarding.applyOnboarding(state, record), state);
  assert.equal(state.settings.name, payload.displayName);
});
test("existing transactions, budgets and unselected wallets survive initial setup", () => {
  const old = { ...fresh, wallets: [{ id: "old", name: "Old", currency: "USD", initial: 20, type: "cash" }], transactions: [{ id: "old-tx", type: "income", amount: 10 }], goals: [{ id: "old-budget" }] };
  const merged = onboarding.applyOnboarding(old, record);
  assert.deepEqual(merged.transactions, old.transactions); assert.deepEqual(merged.goals, old.goals);
  assert.ok(merged.wallets.some(w => w.id === "old"));
});
test("quarterly month-end recurrence keeps actual month ends, including leap years", () => {
  const bill = { ...state.fixedExpenses[0], dueDate: "2024-01-31", intervalMonths: 1 };
  assert.deepEqual(planning.plannedOccurrences(bill, "2024-02-01", "2024-03-31"), ["2024-02-29", "2024-03-31"]);
  assert.deepEqual(planning.plannedOccurrences({ ...bill, intervalMonths: 3 }, "2024-01-01", "2024-07-31"), ["2024-01-31", "2024-04-30", "2024-07-31"]);
});
test("standalone fixed costs are valid; foreign budgets, archived wallets and income categories are not", () => {
  assert.equal(planning.validFixedExpense(state, state.fixedExpenses[0]), true);
  assert.equal(planning.validFixedExpense(state, { ...state.fixedExpenses[0], budgetId: "foreign" }), false);
  assert.equal(planning.validFixedExpense(state, { ...state.fixedExpenses[0], category: "Salary" }), false);
});
test("tuition projection warns below reserve and reminders start at the configured boundary", () => {
  const early = outlook.financialOutlook(state, "2026-10-23").expenses[0], due = outlook.financialOutlook(state, "2026-10-24").expenses[0];
  assert.equal(early.remind, false); assert.equal(due.remind, true);
  assert.equal(due.after, 20000000); assert.equal(due.reserve, 25000000); assert.equal(due.belowReserve, true);
  assert.equal(outlook.trackedBalance(state, "ali").amount, 2000); assert.equal(state.transactions.length, 0);
});
test("a missing cross-currency destination amount disables forecasts instead of inventing FX", () => {
  const uncertain = { ...state, transactions: [{ id: "move", type: "transfer", wallet: "bank", targetWallet: "ali", amount: 500, date: "2026-10-10" }] };
  assert.deepEqual(outlook.trackedBalance(uncertain, "ali"), { amount: 2000, complete: false });
});
test("50 percent spent by day 10 generates a daily ceiling and labeled pace extrapolation", () => {
  const budget = { id: "food", kind: "budget", title: "Dining budget", amount: 1000000, currency: "VND", wallet: "bank", category: "Dining", date: "2026-10-01", cycle: "monthly" };
  const paced = { ...state, goals: [budget], transactions: [{ id: "food", type: "expense", wallet: "bank", category: "Dining", amount: 500000, date: "2026-10-10" }] };
  const result = outlook.budgetPace(paced, budget, "2026-10-10");
  assert.equal(result.aheadOfPace, true); assert.equal(result.remainingDays, 21); assert.equal(result.dailyAllowance, 23809); assert.equal(result.projected, 1550000);
  assert.equal(outlook.budgetPace(paced, budget, "2026-10-31").dailyAllowance, 0);
});
test("local personalization/planning facts never enter model history, including restored history", () => {
  const messages = [{ role: "assistant", text: "Private preferred name", localOnly: true }, { role: "assistant", text: chat.localPlanReply(state, "2026-10-24"), localOnly: true }, { role: "user", text: "Lunch 50k" }];
  assert.deepEqual(chat.modelHistory(JSON.parse(JSON.stringify(messages))), [{ role: "user", text: "Lunch 50k" }]);
  assert.ok(fs.readFileSync("src/components/sites/rolly/replica/Transactions.tsx", "utf8").includes("history: modelHistory("));
});
const dbURL = process.env.AUTH_TEST_DATABASE_URL;
if (!dbURL) throw new Error("AUTH_TEST_DATABASE_URL required; no silently skipped database tests.");
const db = new URL(dbURL);
if (!["localhost", "127.0.0.1"].includes(db.hostname) || db.pathname !== "/finbridge_auth_test") throw new Error("Only the dedicated local test database is allowed.");
const pool = new Pool({ connectionString: dbURL, max: 5 });
const a = "setup-test-" + crypto.randomUUID(), b = "setup-test-" + crypto.randomUUID();
let initialized;
async function ready() { return initialized ??= (async () => { await pool.query(repository.ONBOARDING_SQL); for (const id of [a, b]) await pool.query('INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", role) VALUES ($1,$2,$3,true,NOW(),NOW(),$4)', [id, "Synthetic", id + "@example.invalid", "user"]); })(); }
const repo = { read: id => repository.readOnboarding(pool, id), complete: (id, data) => repository.completeOnboarding(pool, id, data) };
function req(body = payload, origin = "http://localhost:3000") { return new Request("http://localhost:3000/api/onboarding", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
test("setup endpoint rejects missing sessions and foreign origins with zero database writes", async () => {
  await ready(); assert.equal((await handler.handleOnboarding(req(), null, "http://localhost:3000", repo)).status, 401);
  assert.equal((await handler.handleOnboarding(req(payload, "https://foreign.invalid"), a, "http://localhost:3000", repo)).status, 403);
  assert.equal(await repo.read(a), null);
});
test("client user ID and malformed payload cannot write an onboarding record", async () => {
  await ready(); assert.equal((await handler.handleOnboarding(req({ ...payload, userId: b }), a, "http://localhost:3000", repo)).status, 400); assert.equal(await repo.read(a), null);
});
test("simultaneous completions and replay store exactly one record for the server user", async () => {
  await ready(); const results = await Promise.all(Array.from({ length: 8 }, (_, i) => repo.complete(a, { ...payload, displayName: "Synthetic " + i })));
  assert.equal(new Set(results.map(r => r.completedAt)).size, 1); assert.equal(new Set(results.map(r => r.data.displayName)).size, 1);
  assert.equal(Number((await pool.query("SELECT COUNT(*) n FROM finbridge_onboarding WHERE user_id=$1", [a])).rows[0].n), 1);
  assert.equal(await repo.read(b), null); assert.deepEqual(await repo.complete(a, payload), results[0]);
});
test("returning users read completed setup; another account sees no profile", async () => {
  const response = await handler.handleOnboarding(new Request("http://localhost:3000/api/onboarding"), a, "http://localhost:3000", repo);
  assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "no-store"); assert.ok((await response.json()).profile);
  assert.equal(await repo.read(b), null);
});
test("database outage fails closed with a retryable error", async () => {
  const response = await handler.handleOnboarding(new Request("http://localhost:3000/api/onboarding"), a, "http://localhost:3000", { read: async () => { throw new Error("OFFLINE"); }, complete: repo.complete });
  assert.equal(response.status, 503);
});
after(async () => { await pool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [[a, b]]); await pool.end(); });
