import assert from "node:assert/strict";
import { test, after } from "node:test";
import nextEnv from "@next/env";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { safetyFixture, ruleFixture } from "./safety-fixtures.mjs";
import { safetyRepository, SAFETY_SQL } from "../src/lib/safety-repository.ts";
import { handleSafety } from "../src/lib/safety-handler.ts";
import { runSafetyWorker } from "../src/lib/safety-worker.ts";
import { initializeAccountLifecycle, deactivateAccountLifecycle } from "../src/lib/account-lifecycle.ts";

nextEnv.loadEnvConfig(process.cwd());
const connectionString = process.env.AUTH_TEST_DATABASE_URL;
if (!connectionString) throw new Error("AUTH_TEST_DATABASE_URL required");
const url = new URL(connectionString);
if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/finbridge_auth_test") throw new Error("Only the dedicated local test database is allowed");
const pool = new Pool({ connectionString, max: 4 });
await initializeAccountLifecycle(pool); await pool.query(SAFETY_SQL);
const owner = "safety-test-" + randomUUID(), other = "safety-test-" + randomUUID(), sourceId = randomUUID();
for (const id of [owner, other]) await pool.query('INSERT INTO "user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$2,$3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)', [id, "Synthetic Safety User", id + "@example.invalid"]);
const repo = safetyRepository(pool), origin = "https://finbridge.invalid";
const snapshot = safetyFixture(), now = new Date();
const date = now.toISOString().slice(0, 10), month = date.slice(0, 7) + "-01";
snapshot.budgets[0].date = month; snapshot.transactions[0].date = date; snapshot.transactions[0].amount = 850;
async function request(body, { id = owner, trusted = true, emailAvailable = true } = {}) {
  const revision = (await repo.read(id)).revision;
  return handleSafety(new Request(origin + "/api/safety", { method: "POST", headers: { "content-type": "application/json", origin: trusted ? origin : "https://foreign.invalid" }, body: JSON.stringify({ revision, ...body }) }), id, origin, repo, emailAvailable);
}
const saved = async () => repo.read(owner);
after(async () => {
  for (const table of ["finbridge_safety_events", "finbridge_safety_changes", "finbridge_safety_limits", "finbridge_safety", "finbridge_account_lifecycle"]) await pool.query(`DELETE FROM ${table} WHERE user_id=ANY($1::text[])`, [[owner, other]]);
  await pool.query('DELETE FROM "user" WHERE id=ANY($1::text[])', [[owner, other]]); await pool.end();
});
test("schema migration is idempotent and does not reset rows", async () => { await pool.query(SAFETY_SQL); assert.equal((await saved()).revision, 0); });
test("foreign origins and missing sessions perform zero writes", async () => {
  assert.equal((await request({ action: "source", sourceId, snapshot }, { trusted: false })).status, 403);
  const res = await handleSafety(new Request(origin + "/api/safety"), null, origin, repo, true); assert.equal(res.status, 401); assert.equal((await saved()).revision, 0);
});
test("explicit source consent stores a redacted snapshot and returns no financial snapshot", async () => {
  const res = await request({ action: "source", sourceId, snapshot }); assert.equal(res.status, 200);
  const data = await res.json(); assert.equal(data.sourceId, sourceId); assert.equal("snapshot" in data, false); assert.equal(data.revision, 1);
});
test("saving a reached threshold produces one persisted alert, and replay/sync never duplicates it", async () => {
  const rule = { ...ruleFixture(), email: true };
  assert.equal((await request({ action: "save", rule })).status, 200);
  assert.equal((await saved()).events.length, 1);
  assert.equal((await request({ action: "sync", sourceId, snapshot })).status, 200);
  assert.equal((await saved()).events.length, 1);
});
test("another account cannot read alerts or reuse a foreign source", async () => {
  assert.deepEqual((await repo.read(other)).rules, []);
  assert.equal((await request({ action: "sync", sourceId, snapshot }, { id: other })).status, 409);
  assert.equal((await repo.read(other)).revision, 0);
});
test("forged owners, invalid target, unsupported money precision and disabled email are rejected", async () => {
  const before = (await saved()).revision;
  assert.equal((await request({ action: "read", userId: other })).status, 400);
  assert.equal((await request({ action: "save", rule: { ...ruleFixture(), id: "bad", targetId: "foreign-budget" } })).status, 400);
  assert.equal((await request({ action: "save", rule: { ...ruleFixture(), id: "precision", unit: "amount", threshold: 1.001 } })).status, 400);
  assert.equal((await request({ action: "save", rule: { ...ruleFixture(), email: true } }, { emailAvailable: false })).status, 400);
  assert.equal((await saved()).revision, before);
});
test("concurrent updates use optimistic locking: one succeeds and one conflicts", async () => {
  const revision = (await saved()).revision;
  const responses = await Promise.all([request({ action: "save", revision, rule: { ...ruleFixture(), name: "Name A", email: true } }), request({ action: "save", revision, rule: { ...ruleFixture(), name: "Name B", email: true } })]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
});
test("a stale source cannot replace a newer device's data", async () => {
  const nextSource = randomUUID(); assert.equal((await request({ action: "source", sourceId: nextSource, snapshot })).status, 200);
  const before = (await saved()).revision;
  assert.equal((await request({ action: "sync", sourceId, snapshot })).status, 409); assert.equal((await saved()).revision, before);
});
test("GET has no writes and marking read preserves the financial snapshot", async () => {
  const before = await saved();
  const get = await handleSafety(new Request(origin + "/api/safety"), owner, origin, repo, true); assert.equal(get.status, 200); assert.equal((await saved()).revision, before.revision);
  assert.equal((await request({ action: "read" })).status, 200);
  const after = await saved(); assert.ok(after.events.every(e => e.read)); assert.deepEqual(after.snapshot, before.snapshot);
});
test("the worker claims an email once, revalidates its rule and reports provider acceptance", async () => {
  let calls = 0;
  const result = await runSafetyWorker(pool, async (to, language) => { calls++; assert.equal(to, owner + "@example.invalid"); assert.equal(language, "en"); return "accepted"; });
  assert.equal(calls, 1); assert.equal(result.accepted, 1); assert.equal((await saved()).events[0].emailStatus, "accepted");
  await runSafetyWorker(pool, async () => { calls++; return "accepted"; }); assert.equal(calls, 1);
});
test("pausing cancels queued mail without deleting the rule or alert history", async () => {
  await request({ action: "save", rule: { ...ruleFixture(), id: "pause-rule", unit: "amount", threshold: 750, email: true } });
  const before = (await saved()).events.length;
  await request({ action: "save", rule: { ...ruleFixture(), id: "pause-rule", unit: "amount", threshold: 750, email: true, active: false } });
  const after = await saved(); assert.equal(after.events.length, before); assert.equal(after.events.find(e => e.ruleId === "pause-rule").emailStatus, "cancelled");
});
test("email timeout becomes unknown and is never automatically resent", async () => {
  await request({ action: "save", rule: { ...ruleFixture(), id: "unknown-rule", unit: "amount", threshold: 760, email: true } });
  let calls = 0; await runSafetyWorker(pool, async () => { calls++; return "unknown"; });
  await runSafetyWorker(pool, async () => { calls++; return "accepted"; }); assert.equal(calls, 1); assert.equal((await saved()).events.find(e => e.ruleId === "unknown-rule").emailStatus, "unknown");
});
test("stale snapshots pause background alerts and cancel unsent stale mail", async () => {
  await request({ action: "save", rule: { ...ruleFixture(), id: "stale-rule", unit: "amount", threshold: 770, email: true } });
  await pool.query("UPDATE finbridge_safety SET document=jsonb_set(document,'{syncedAt}',to_jsonb($2::text)) WHERE user_id=$1", [owner, new Date(now.getTime() - 26 * 3600000).toISOString()]);
  let calls = 0; await runSafetyWorker(pool, async () => { calls++; return "accepted"; }); assert.equal(calls, 0);
  assert.equal((await saved()).events.find(e => e.ruleId === "stale-rule").emailStatus, "cancelled");
});
test("request limits are enforced in PostgreSQL without changing rules", async () => {
  await pool.query("UPDATE finbridge_safety_limits SET requests=60,window_at=CURRENT_TIMESTAMP WHERE user_id=$1", [owner]);
  const before = (await saved()).revision; const res = await request({ action: "read" }); assert.equal(res.status, 429); assert.equal((await saved()).revision, before);
  await pool.query("UPDATE finbridge_safety_limits SET requests=0 WHERE user_id=$1", [owner]);
});
test("closing an account keeps its rules and history but blocks writes and queued email", async () => {
  const before = (await saved()).rules.length;
  await deactivateAccountLifecycle(pool, { userId: owner, secret: "synthetic-only-lifecycle-secret-".repeat(2) });
  await assert.rejects(repo.read(owner), /UNAUTHENTICATED/);
  const res = await handleSafety(new Request(origin + "/api/safety"), owner, origin, repo, true); assert.equal(res.status, 401);
  let calls = 0; await runSafetyWorker(pool, async () => { calls++; return "accepted"; }); assert.equal(calls, 0);
  const retained = await pool.query("SELECT document FROM finbridge_safety WHERE user_id=$1", [owner]); assert.equal(retained.rows[0].document.rules.length, before);
});
