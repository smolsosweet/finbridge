import assert from "node:assert/strict";
import test from "node:test";
import { betterAuth } from "better-auth";
import { buildAuthOptions } from "../src/lib/auth-options.ts";
import { DEMO_ACCOUNTS_SQL, demoIdentity, demoWorkspace, manageDemoAccount } from "../src/lib/demo-accounts.ts";
import { INTERNATIONAL_TRANSFER_SQL, internationalTransferRepository } from "../src/lib/international-transfer-repository.ts";
import { ONBOARDING_SQL } from "../src/lib/onboarding-repository.ts";
import { AI_QUOTA_SQL, aiQuotaRepository } from "../src/lib/ai-quota-repository.ts";
import { workspaceRepository } from "../src/lib/workspace-repository.ts";
import { populatedDemoSafety, demoDateRange } from "../src/lib/demo-profile-data.ts";
import { testPool, syntheticUser, cleanupFinance } from "./workspace-fixtures.mjs";

const pool = await testPool(); // Rejects every remote URL and DB other than local finbridge_auth_test.
await pool.query(INTERNATIONAL_TRANSFER_SQL); await pool.query(ONBOARDING_SQL); await pool.query(AI_QUOTA_SQL); await pool.query(DEMO_ACCOUNTS_SQL);
const ids = [demoIdentity(1).id, demoIdentity(2).id], password = "Synthetic-only-demo-password-2026";
const auth = betterAuth(buildAuthOptions({ baseURL: "http://localhost:3011", secret: "synthetic-demo-test-secret-".repeat(3), databaseURL: process.env.AUTH_TEST_DATABASE_URL, clientId: "synthetic", clientSecret: "synthetic" }, pool));
test.after(async () => {
  for (const table of ["finbridge_ai_reservations", "finbridge_demo_accounts", "finbridge_onboarding", "finbridge_transfer_mutations", "finbridge_transfer_audit", "finbridge_transfer_plans", "finbridge_transfer_quotes", "finbridge_transfer_bills", "finbridge_transfer_accounts", "finbridge_transfer_controls"]) await pool.query("DELETE FROM " + table + " WHERE user_id=ANY($1::text[])", [ids]);
  for (const table of ["session", "account"]) await pool.query('DELETE FROM "' + table + '" WHERE "userId"=ANY($1::text[])', [ids]);
  await pool.query("DELETE FROM finbridge_ai_quota_buckets WHERE owner=ANY($1::text[])", [ids]);
  await cleanupFinance(pool, ids); await pool.end();
});
test("empty and populated demo identities are verified and can sign in through real Better Auth", async () => {
  for (const slot of [1, 2]) {
    const identity = await manageDemoAccount(pool, { action: "create", slot, password });
    assert.equal((await auth.api.signInEmail({ body: { email: identity.email, password }, asResponse: true })).status, 200);
    const state = await workspaceRepository(pool).read(identity.id);
    assert.equal((await pool.query('SELECT "emailVerified" FROM "user" WHERE id=$1', [identity.id])).rows[0].emailVerified, true);
    if (slot === 1) {
      assert.equal(identity.name, "demo_no_data"); assert.equal(state.data, null);
      for (const table of ["finbridge_wallets", "finbridge_transactions", "finbridge_categories", "finbridge_safety", "finbridge_safety_events", "finbridge_onboarding"]) assert.equal((await pool.query("SELECT 1 FROM " + table + " WHERE user_id=$1", [identity.id])).rowCount, 0);
    } else {
      assert.equal(identity.name, "demo_with_data"); assert.equal(state.data.wallets.length, 5);
      assert.equal(state.data.transactions.length, demoWorkspace().transactions.length);
      assert.equal(state.data.categories.length, 13); assert.equal(state.data.fixedExpenses.length, 4);
      assert.ok(state.data.settings.onboardingCompleted);
      const safety = (await pool.query("SELECT document->'rules' AS rules FROM finbridge_safety WHERE user_id=$1", [identity.id])).rows[0];
      assert.equal(safety.rules.length, 6); assert.ok(safety.rules.every(r => r.email === false));
      assert.ok((await pool.query("SELECT 1 FROM finbridge_safety_events WHERE user_id=$1", [identity.id])).rowCount > 0);
    }
  }
  await assert.rejects(manageDemoAccount(pool, { action: "create", slot: 1, password }), /DEMO_ALREADY_EXISTS/);
});
test("reset restores only the registered owner, resets sandbox and preserves charged AI quota", async () => {
  const other = await workspaceRepository(pool).read(ids[0]);
  const initial = await workspaceRepository(pool).read(ids[1]), edited = structuredClone(initial.data);
  edited.settings.name = "Modified by judge";
  await workspaceRepository(pool).save(ids[1], { revision: initial.revision, mutationId: crypto.randomUUID(), data: edited });
  await internationalTransferRepository(pool, undefined, { sandboxEnabled: true }).read(ids[1]);
  await pool.query("UPDATE finbridge_transfer_accounts SET balance=balance-1000 WHERE user_id=$1", [ids[1]]);
  const limits = { userDailyPoints: 1000, userMinutePoints: 1000, serverDailyPoints: 10000, serverDailyRequests: 10000, serverMinuteRequests: 10000, cooldownSeconds: 60 };
  await aiQuotaRepository(pool).reserve(ids[1], "assistant", limits);
  const quota = (await pool.query("SELECT * FROM finbridge_ai_quota_buckets ORDER BY scope,owner,window_key")).rows;
  await manageDemoAccount(pool, { action: "reset", slot: 2 });
  const reset = await workspaceRepository(pool).read(ids[1]);
  assert.ok(reset.revision > initial.revision); assert.equal(reset.data.settings.name, "demo_with_data");
  assert.deepEqual((await workspaceRepository(pool).read(ids[0])).data, other.data);
  assert.equal((await pool.query("SELECT * FROM finbridge_transfer_accounts WHERE user_id=$1", [ids[1]])).rowCount, 0);
  assert.deepEqual((await pool.query("SELECT * FROM finbridge_ai_quota_buckets ORDER BY scope,owner,window_key")).rows, quota);
});
test("empty reset removes demo onboarding and finances without touching the populated account or quota", async () => {
  const other = await workspaceRepository(pool).read(ids[1]);
  const entered = demoWorkspace();
  entered.transactions = entered.transactions.map(({ fixedExpenseId, fixedExpenseDueDate, paymentConfirmation, ...t }) => t);
  await workspaceRepository(pool).save(ids[0], { revision: 0, mutationId: crypto.randomUUID(), data: entered });
  assert.ok((await workspaceRepository(pool).read(ids[0])).data);
  const quota = (await pool.query("SELECT * FROM finbridge_ai_quota_buckets ORDER BY scope,owner,window_key")).rows;
  await manageDemoAccount(pool, { action: "reset", slot: 1 });
  assert.equal((await workspaceRepository(pool).read(ids[0])).data, null);
  assert.deepEqual((await workspaceRepository(pool).read(ids[1])).data, other.data);
  assert.deepEqual((await pool.query("SELECT * FROM finbridge_ai_quota_buckets ORDER BY scope,owner,window_key")).rows, quota);
});
test("two-month demo history has valid balances, linked bill payments and historical in-app alerts", () => {
  const now = new Date("2026-10-20T07:00:00Z"), data = demoWorkspace(now);
  assert.deepEqual(demoDateRange(now), { start: "2026-09-01", end: "2026-10-20" });
  assert.deepEqual(demoDateRange(new Date("2026-01-01T00:00:00Z")), { start: "2025-12-01", end: "2026-01-01" });
  assert.deepEqual(demoDateRange(new Date("2026-10-31T23:00:00Z")), { start: "2026-10-01", end: "2026-11-01" });
  assert.deepEqual([...new Set(data.transactions.map(t => t.date.slice(0, 7)))].sort(), ["2026-09", "2026-10"]);
  assert.ok(data.transactions.every(t => t.date >= "2026-09-01" && t.date <= "2026-10-20"));
  assert.equal(data.transactions.filter(t => t.fixedExpenseId).length, 8);
  for (const wallet of data.wallets) {
    const balance = data.transactions.reduce((sum, t) => sum + (t.wallet === wallet.id ? (t.type === "income" ? t.amount : -t.amount) : t.type === "transfer" && t.targetWallet === wallet.id ? t.amount : 0), wallet.initial);
    assert.ok(balance >= 0, wallet.id + " must not be overdrawn");
  }
  const safety = populatedDemoSafety(data, now);
  assert.ok(safety.events.some(e => e.createdAt.startsWith("2026-09")));
  assert.ok(safety.events.some(e => e.createdAt.startsWith("2026-10")));
  assert.ok(safety.events.every(e => e.emailStatus === "off"));
  assert.equal(safety.evaluated["demo-cash-floor"].state, "alarm");
  assert.equal(safety.evaluated["demo-bank-floor"].state, "ok");
});
test("unregistered or tampered identities cannot be reset; real accounts are never adopted", async () => {
  await pool.query("DELETE FROM finbridge_demo_accounts WHERE user_id=$1", [ids[1]]);
  await assert.rejects(manageDemoAccount(pool, { action: "reset", slot: 2 }), /NOT_A_REGISTERED_DEMO_ACCOUNT/);
  await assert.rejects(manageDemoAccount(pool, { action: "create", slot: 2, password }), /DEMO_ALREADY_EXISTS/);
  await pool.query("INSERT INTO finbridge_demo_accounts(user_id) VALUES($1)", [ids[1]]);
  await pool.query('UPDATE "user" SET email=$2 WHERE id=$1', [ids[1], "tampered@example.invalid"]);
  await assert.rejects(manageDemoAccount(pool, { action: "reset", slot: 2 }), /NOT_A_REGISTERED_DEMO_ACCOUNT/);
  await pool.query('UPDATE "user" SET email=$2 WHERE id=$1', [ids[1], demoIdentity(2).email]);
  assert.throws(() => demoIdentity(3), /DEMO_SLOT/);
});
test("rotate expires sessions and old passwords; lock removes demo password access", async () => {
  const updated = password + "-new";
  await manageDemoAccount(pool, { action: "rotate", slot: 1, password: updated });
  assert.ok((await auth.api.signInEmail({ body: { email: demoIdentity(1).email, password }, asResponse: true })).status >= 400);
  assert.equal((await auth.api.signInEmail({ body: { email: demoIdentity(1).email, password: updated }, asResponse: true })).status, 200);
  await manageDemoAccount(pool, { action: "lock", slot: 1 });
  assert.ok((await auth.api.signInEmail({ body: { email: demoIdentity(1).email, password: updated }, asResponse: true })).status >= 400);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM "session" WHERE "userId"=$1 AND "expiresAt">CURRENT_TIMESTAMP', [ids[0]])).rows[0].n, 0);
});
test("quota migration is repeatable and leaves existing users, workspaces and counters untouched", async () => {
  const user = await syntheticUser(pool); ids.push(user);
  const before = (await workspaceRepository(pool).read(ids[1])).data;
  const quota = (await pool.query("SELECT * FROM finbridge_ai_quota_buckets ORDER BY scope,owner,window_key")).rows;
  await pool.query(AI_QUOTA_SQL); await pool.query(AI_QUOTA_SQL);
  assert.equal((await pool.query('SELECT id FROM "user" WHERE id=$1', [user])).rowCount, 1);
  assert.deepEqual((await workspaceRepository(pool).read(ids[1])).data, before);
  assert.deepEqual((await pool.query("SELECT * FROM finbridge_ai_quota_buckets ORDER BY scope,owner,window_key")).rows, quota);
  assert.ok(demoWorkspace(new Date("2026-10-31T23:00:00Z")).fixedExpenses[0].dueDate.startsWith("2026-11"));
});
