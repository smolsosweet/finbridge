import assert from "node:assert/strict";
import test from "node:test";
import { AI_QUOTA_SQL, aiQuotaRepository } from "../src/lib/ai-quota-repository.ts";
import { AiQuotaError, createQuotaFetch } from "../src/lib/ai-quota.ts";
import { testPool, syntheticUser, cleanupFinance } from "./workspace-fixtures.mjs";
import { deactivateAccountLifecycle } from "../src/lib/account-lifecycle.ts";

// testPool rejects every cloud URL and any DB other than local finbridge_auth_test before connecting.
const pool = await testPool(), owners = [];
await pool.query(AI_QUOTA_SQL);
let now = new Date("2026-10-21T12:00:00Z");
const config = { userDailyPoints: 100, userMinutePoints: 100, serverDailyPoints: 100, serverDailyRequests: 100, serverMinuteRequests: 100, cooldownSeconds: 60 };
const user = async () => { const id = await syntheticUser(pool); owners.push(id); return id; };
const repo = () => aiQuotaRepository(pool, () => now);
async function clear() {
  // This entire DB is a guarded disposable local test DB. No production env URL is used.
  await pool.query("DELETE FROM finbridge_ai_reservations");
  await pool.query("DELETE FROM finbridge_ai_quota_buckets");
  await pool.query("UPDATE finbridge_ai_control SET blocked_until='-infinity'");
  now = new Date("2026-10-21T12:00:00Z");
}
test.beforeEach(clear);
test.after(async () => {
  await clear(); await cleanupFinance(pool, owners); await pool.end();
});
test("50 competing requests across repository instances admit exactly one; losing requests consume no other buckets", async () => {
  const a = await user(); let transportCalls = 0;
  const transport = async () => { transportCalls++; return new Response("ok"); };
  const limited = { ...config, serverDailyPoints: 1 };
  const results = await Promise.allSettled(Array.from({ length: 50 }, () => createQuotaFetch({ owner: a, route: "assistant", config: limited, repository: repo(), transport })("https://synthetic.invalid")));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(results.filter(r => r.status === "rejected" && r.reason.code === "AI_QUOTA_EXCEEDED").length, 49);
  assert.equal(transportCalls, 1);
  const buckets = (await pool.query("SELECT used FROM finbridge_ai_quota_buckets")).rows;
  assert.equal(buckets.length, 5); assert.ok(buckets.every(b => b.used === 1));
});
test("per-account quota is isolated and a rejected user request rolls back the global reservation", async () => {
  const a = await user(), b = await user(), limits = { ...config, userDailyPoints: 3 };
  await repo().reserve(a, "receipt-drafts", limits);
  await assert.rejects(repo().reserve(a, "assistant", limits), /AI_QUOTA_EXCEEDED/);
  await repo().reserve(b, "speech-transcription", limits);
  assert.equal((await pool.query("SELECT used FROM finbridge_ai_quota_buckets WHERE scope='server-day-points'")).rows[0].used, 5);
  assert.equal((await pool.query("SELECT used FROM finbridge_ai_quota_buckets WHERE scope='user-day-points' AND owner=$1", [a])).rows[0].used, 3);
  assert.equal((await pool.query("SELECT used FROM finbridge_ai_quota_buckets WHERE scope='user-day-points' AND owner=$1", [b])).rows[0].used, 2);
});
test("request-count daily and minute ceilings cannot be bypassed with a larger weighted budget", async () => {
  const a = await user();
  await repo().reserve(a, "assistant", { ...config, serverDailyRequests: 1 });
  await assert.rejects(repo().reserve(a, "assistant", { ...config, serverDailyRequests: 1 }), /AI_QUOTA_EXCEEDED/);
  await clear();
  await repo().reserve(a, "assistant", { ...config, serverMinuteRequests: 1 });
  await assert.rejects(repo().reserve(a, "assistant", { ...config, serverMinuteRequests: 1 }), /AI_QUOTA_EXCEEDED/);
});
test("minute points and daily windows reset independently at Pacific midnight", async () => {
  const a = await user(), limits = { ...config, userDailyPoints: 3, userMinutePoints: 2 };
  now = new Date("2026-10-22T06:59:20Z");
  await repo().reserve(a, "speech-transcription", limits);
  await assert.rejects(repo().reserve(a, "assistant", limits), /AI_QUOTA_EXCEEDED/);
  now = new Date("2026-10-22T07:00:00Z");
  await repo().reserve(a, "speech-transcription", limits);
  assert.equal(Number((await pool.query("SELECT count(*) n FROM finbridge_ai_quota_buckets WHERE scope='user-day-points' AND owner=$1", [a])).rows[0].n), 2);
});
test("release is owner-scoped, idempotent under concurrency, and restores weighted and request counters", async () => {
  const a = await user(), b = await user(), reserved = await repo().reserve(a, "receipt-drafts", config);
  await repo().release({ ...reserved, owner: b });
  assert.equal((await pool.query("SELECT released FROM finbridge_ai_reservations WHERE id=$1", [reserved.id])).rows[0].released, false);
  await Promise.all(Array.from({ length: 10 }, () => repo().release(reserved)));
  assert.ok((await pool.query("SELECT used FROM finbridge_ai_quota_buckets")).rows.every(row => row.used === 0));
  assert.equal((await pool.query("SELECT released FROM finbridge_ai_reservations WHERE id=$1", [reserved.id])).rows[0].released, true);
});
test("a provider pause is shared across accounts and repository instances and extends monotonically", async () => {
  const a = await user(), b = await user();
  await repo().pause(90); await repo().pause(30);
  for (const owner of [a, b]) await assert.rejects(repo().reserve(owner, "assistant", config), error => error instanceof AiQuotaError && error.retryAfter === 90);
  now = new Date(+now + 90_000); await repo().reserve(b, "assistant", config);
});
test("pre-dispatch cancellation refunds via the real DB; failure after transport invocation remains charged", async () => {
  const a = await user(), controller = new AbortController(), base = repo();
  const aborting = { ...base, async reserve(...args) { const result = await base.reserve(...args); controller.abort(); return result; } };
  let calls = 0;
  await assert.rejects(createQuotaFetch({ owner: a, route: "receipt-drafts", config, repository: aborting, transport: async () => { calls++; return new Response(); } })("https://synthetic.invalid", { signal: controller.signal }));
  assert.equal(calls, 0); assert.ok((await pool.query("SELECT used FROM finbridge_ai_quota_buckets")).rows.every(row => row.used === 0));
  await assert.rejects(createQuotaFetch({ owner: a, route: "receipt-drafts", config, repository: repo(), transport: async () => { calls++; throw new TypeError("synthetic"); } })("https://synthetic.invalid"));
  assert.equal(calls, 1); assert.equal((await pool.query("SELECT used FROM finbridge_ai_quota_buckets WHERE scope='user-day-points'")).rows[0].used, 3);
});
test("unknown, closed and unverified identities cannot reserve quota", async () => {
  const a = await user();
  await pool.query('UPDATE "user" SET "emailVerified"=false WHERE id=$1', [a]);
  for (const owner of [a, "absent-user"]) await assert.rejects(repo().reserve(owner, "assistant", config), /AI_QUOTA_UNAVAILABLE/);
  await pool.query('UPDATE "user" SET "emailVerified"=true WHERE id=$1', [a]);
  await deactivateAccountLifecycle(pool, { userId: a, secret: "synthetic-quota-test-secret-".repeat(2) });
  await assert.rejects(repo().reserve(a, "assistant", config), /AI_QUOTA_UNAVAILABLE/);
});
test("missing quota control table fails closed; Gemini spy stays untouched", async () => {
  const a = await user(); let calls = 0;
  await pool.query("ALTER TABLE finbridge_ai_control RENAME TO finbridge_ai_control_hidden");
  try {
    await assert.rejects(createQuotaFetch({ owner: a, route: "assistant", config, repository: repo(), transport: async () => { calls++; return new Response(); } })("https://synthetic.invalid"), /AI_QUOTA_UNAVAILABLE/);
    assert.equal(calls, 0);
  } finally { await pool.query("ALTER TABLE finbridge_ai_control_hidden RENAME TO finbridge_ai_control"); }
});
