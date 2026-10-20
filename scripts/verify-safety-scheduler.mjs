import assert from "node:assert/strict";
import test from "node:test";
import { handleSafetyCron } from "../src/lib/safety-cron.ts";
import { runSafetyWorker } from "../src/lib/safety-worker.ts";
import { advanceSafety, emptySafetyDocument } from "../src/lib/safety-model.ts";
import { ruleFixture, safetyFixture } from "./safety-fixtures.mjs";
import { invokeSafetyScheduler } from "./invoke-safety-scheduler.mjs";
const secret = "synthetic-scheduler-only-".repeat(3), url = "https://finbridge.example.invalid";
test("scheduler endpoint denies absent/wrong secret before touching DB and redacts failures", async () => {
  let calls = 0; const pool = () => { calls++; return {}; };
  const request = token => new Request(url, { method: "POST", headers: { authorization: token } });
  assert.equal((await handleSafetyCron(request(""), pool, undefined, {})).status, 503);
  assert.equal((await handleSafetyCron(request("Bearer wrong"), pool, undefined, { SAFETY_CRON_SECRET: secret })).status, 401);
  assert.equal(calls, 0);
  const failure = await handleSafetyCron(request("Bearer " + secret), pool, async () => { throw Error("private DB connection"); }, { SAFETY_CRON_SECRET: secret });
  assert.equal(failure.status, 503); assert.equal((await failure.json()).error, "WORKER_UNAVAILABLE");
});
test("external scheduler uses exact HTTPS POST and bearer authorization, never follows redirects", async () => {
  const counts = { evaluated: 1, accepted: 0, cancelled: 0, failed: 0, unknown: 0, retried: 0 };
  let calls = 0;
  const result = await invokeSafetyScheduler({ FINBRIDGE_BASE_URL: url, SAFETY_CRON_SECRET: secret }, async (target, options) => {
    calls++; assert.equal(target.href, url + "/api/internal/safety"); assert.equal(options.method, "POST"); assert.equal(options.redirect, "error");
    const response = await handleSafetyCron(new Request(target, options), () => ({}), async () => counts, { SAFETY_CRON_SECRET: secret });
    assert.equal(response.headers.get("cache-control"), "no-store"); return response;
  });
  assert.equal(calls, 1); assert.equal(result.evaluated, 1);
  for (const input of ["http://example.invalid", url + "/path", "https://user:password@example.invalid", url + "?secret=bad"]) await assert.rejects(invokeSafetyScheduler({ FINBRIDGE_BASE_URL: input, SAFETY_CRON_SECRET: secret }), /SCHEDULER_REQUIRES/);
});
test("scheduler surfaces HTTP, malformed and ambiguous delivery failures without blind retry", async () => {
  const env = { FINBRIDGE_BASE_URL: url, SAFETY_CRON_SECRET: secret };
  await assert.rejects(invokeSafetyScheduler(env, async () => new Response(null, { status: 503 })), /SCHEDULER_HTTP_503/);
  await assert.rejects(invokeSafetyScheduler(env, async () => Response.json({})), /SCHEDULER_INVALID_RESPONSE/);
  await assert.rejects(invokeSafetyScheduler(env, async () => Response.json({ evaluated: 0, accepted: 0, cancelled: 0, failed: 0, unknown: 1, retried: 0 })), /SCHEDULER_DELIVERY_REQUIRES_REVIEW/);
});

test("busy worker is accepted without making an external scheduler disable the job", async () => {
  const response = await handleSafetyCron(new Request(url, { method: "POST", headers: { authorization: "Bearer " + secret } }), () => ({}), async () => ({ evaluated: 0, accepted: 0, cancelled: 0, failed: 0, unknown: 0, retried: 0, busy: true }), { SAFETY_CRON_SECRET: secret });
  assert.equal(response.status, 202);
  assert.equal(response.headers.get("retry-after"), "60");
  assert.equal((await response.json()).error, "WORKER_BUSY");
});

function pooledWorkerHarness({ busy = false, failWork = false, failCleanup = false } = {}) {
  let held = false, connects = 0, sends = 0;
  const now = new Date("2026-10-20T04:00:00Z");
  const doc = advanceSafety({ ...emptySafetyDocument(), sourceId: "database", syncedAt: now.toISOString(), snapshot: safetyFixture(), rules: [{ ...ruleFixture(), threshold: 40, email: true }] }, now);
  const event = doc.events[0];
  assert.equal(event.emailStatus, "pending");
  let status = "pending";
  const releases = [];
  const guard = {
    async query(sql) {
      if (sql === "BEGIN" || sql.startsWith("SET LOCAL")) return { rows: [] };
      if (sql.includes("pg_try_advisory_xact_lock")) { held = !busy; return { rows: [{ locked: held }] }; }
      if (sql === "ROLLBACK") { held = false; if (failCleanup) throw Error("guard disconnected"); return { rows: [] }; }
      throw Error("Unsupported session-state operation: " + sql);
    },
    release(destroy) { releases.push({ client: "guard", destroy }); },
  };
  const work = {
    async query(sql) {
      assert.equal(held, true, "the transaction lock must cover every work query");
      if (failWork) throw Error("synthetic database failure");
      if (sql.startsWith("SELECT id,user_id")) return { rows: status === "pending" ? [{ id: event.id, user_id: "synthetic-owner" }] : [] };
      if (sql.includes("SELECT user_id FROM finbridge_safety")) throw Error("queued mail must precede a slow evaluation scan");
      if (sql.includes("RETURNING event")) { status = "sending"; return { rowCount: 1, rows: [{ event }] }; }
      if (sql.startsWith("SELECT email")) return { rows: [{ email: "synthetic@example.invalid", emailVerified: true }] };
      if (sql.includes("FROM finbridge_account_lifecycle")) return { rowCount: 0, rows: [] };
      if (sql.startsWith("SELECT document")) return { rows: [{ document: doc }] };
      if (sql.includes("to_jsonb($2::text)")) status = "accepted";
      return { rows: [], rowCount: 1 };
    },
    release(destroy) { releases.push({ client: "work", destroy }); },
  };
  const pool = { async connect() { connects++; return connects === 1 ? guard : work; } };
  return { pool, now, releases, send: async () => { assert.equal(held, true); sends++; return "accepted"; }, state: () => ({ held, connects, sends }) };
}

test("transaction-pooled worker delivers pending mail before scanning and releases both clients", async () => {
  const h = pooledWorkerHarness();
  const result = await runSafetyWorker(h.pool, h.send, h.now);
  assert.equal(result.accepted, 1);
  assert.equal(result.evaluated, 0);
  assert.deepEqual(h.state(), { held: false, connects: 2, sends: 1 });
  assert.deepEqual(h.releases, [{ client: "work", destroy: false }, { client: "guard", destroy: false }]);
});

test("worker contention skips all work and releases the guard transaction", async () => {
  const h = pooledWorkerHarness({ busy: true });
  assert.equal((await runSafetyWorker(h.pool, h.send, h.now)).busy, true);
  assert.deepEqual(h.state(), { held: false, connects: 1, sends: 0 });
  assert.deepEqual(h.releases, [{ client: "guard", destroy: false }]);
});

test("database errors release the worker lock and discard a broken connection", async () => {
  const h = pooledWorkerHarness({ failWork: true, failCleanup: true });
  await assert.rejects(runSafetyWorker(h.pool, h.send, h.now), /synthetic database failure/);
  assert.deepEqual(h.state(), { held: false, connects: 2, sends: 0 });
  assert.deepEqual(h.releases, [{ client: "work", destroy: true }, { client: "guard", destroy: true }]);
});
