import assert from "node:assert/strict";
import test from "node:test";
import { handleSafetyCron } from "../src/lib/safety-cron.ts";
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
