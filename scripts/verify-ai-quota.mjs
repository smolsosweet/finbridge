import assert from "node:assert/strict";
import test from "node:test";
import { AiQuotaError, aiQuotaWindows, aiQuotaErrorResponse, aiQuotaClientMessage, createQuotaFetch, readAiQuotaConfig, AI_ROUTE_COST } from "../src/lib/ai-quota.ts";

const config = { userDailyPoints: 40, userMinutePoints: 6, serverDailyPoints: 100, serverDailyRequests: 80, serverMinuteRequests: 10, cooldownSeconds: 60 };
function fixture(overrides = {}) {
  const events = [];
  const repository = {
    async reserve(owner, route) { events.push(["reserve", owner, route]); return { id: "reservation", owner }; },
    async release(reservation) { events.push(["release", reservation.id]); },
    async pause(seconds) { events.push(["pause", seconds]); }, ...overrides,
  };
  let calls = 0;
  const transport = async () => { calls++; return new Response("ok"); };
  const run = (options = {}) => createQuotaFetch({ owner: "A", route: "assistant", config, repository, transport, ...options })("https://provider.example.invalid", options.init);
  return { events, repository, run, calls: () => calls };
}
test("global limits require explicit positive safe integers; all AI routes have weighted costs", () => {
  assert.throws(() => readAiQuotaConfig({}), /AI_QUOTA_NOT_CONFIGURED/);
  for (const value of ["0", "-1", "1.2", "Infinity", "NaN", "10000001"]) assert.throws(() => readAiQuotaConfig({ AI_QUOTA_SERVER_DAILY_POINTS: value }), /AI_QUOTA_NOT_CONFIGURED/);
  assert.deepEqual(readAiQuotaConfig({ AI_QUOTA_SERVER_DAILY_POINTS: "100", AI_QUOTA_SERVER_DAILY_REQUESTS: "80", AI_QUOTA_SERVER_MINUTE_REQUESTS: "10" }), config);
  assert.equal(Object.keys(AI_ROUTE_COST).length, 8); assert.equal(AI_ROUTE_COST["receipt-drafts"], 3); assert.equal(AI_ROUTE_COST["speech-transcription"], 2); assert.equal(AI_ROUTE_COST["translate-conversation"], 1);
});
test("Pacific day reset follows midnight, including spring and autumn daylight changes", () => {
  for (const [timestamp, day, reset] of [
    ["2026-10-21T06:59:59Z", "2026-10-20", "2026-10-21T07:00:00.000Z"],
    ["2026-10-21T07:00:00Z", "2026-10-21", "2026-10-22T07:00:00.000Z"],
    ["2026-03-08T09:59:00Z", "2026-03-08", "2026-03-09T07:00:00.000Z"],
    ["2026-11-01T09:59:00Z", "2026-11-01", "2026-11-02T08:00:00.000Z"],
  ]) {
    const result = aiQuotaWindows(new Date(timestamp));
    assert.equal(result.day, day); assert.equal(result.nextDayAt.toISOString(), reset);
    assert.equal(+result.nextMinuteAt % 60000, 0);
  }
});
test("quota exhaustion and database failure never reach provider transport", async () => {
  for (const code of ["AI_QUOTA_EXCEEDED", "AI_QUOTA_UNAVAILABLE"]) {
    const f = fixture({ async reserve() { throw new AiQuotaError(code); } });
    await assert.rejects(f.run, new RegExp(code)); assert.equal(f.calls(), 0);
  }
});
test("cancellation before dispatch refunds all reserved points, while a pre-aborted request reserves nothing", async () => {
  const controller = new AbortController();
  const f = fixture({ async reserve(owner) { controller.abort(); return { id: "reservation", owner }; } });
  await assert.rejects(() => f.run({ init: { signal: controller.signal } }), { name: "AbortError" });
  assert.deepEqual(f.events, [["release", "reservation"]]); assert.equal(f.calls(), 0);
  const other = fixture(); await assert.rejects(() => other.run({ init: { signal: controller.signal } }));
  assert.deepEqual(other.events, []);
});
test("success, provider 500 and ambiguous network failures remain charged after dispatch", async () => {
  for (const transport of [async () => new Response("ok"), async () => new Response(null, { status: 500 }), async () => { throw new TypeError("synthetic transport failure"); }]) {
    const f = fixture(); await f.run({ transport }).catch(() => undefined);
    assert.deepEqual(f.events, [["reserve", "A", "assistant"]]);
  }
});
test("provider 429 persists a shared pause using Retry-After and is never retried", async () => {
  const f = fixture(); let calls = 0;
  await assert.rejects(() => f.run({ transport: async () => { calls++; return new Response(null, { status: 429, headers: { "Retry-After": "90" } }); } }), error => error instanceof AiQuotaError && error.retryAfter === 90);
  assert.equal(calls, 1); assert.deepEqual(f.events.at(-1), ["pause", 90]);
  assert.equal(f.events.some(e => e[0] === "release"), false);
});
test("quota errors are localized, private, no-store, and include a manual entry path and Retry-After", async () => {
  for (const language of ["en", "vi", "zh"]) {
    const request = new Request("https://app.example.invalid", { headers: { "x-finbridge-language": language } });
    for (const code of ["AI_QUOTA_EXCEEDED", "AI_RATE_LIMITED", "AI_QUOTA_UNAVAILABLE", "AI_QUOTA_NOT_CONFIGURED"]) {
      const response = aiQuotaErrorResponse(new AiQuotaError(code, 12), request), body = await response.json();
      assert.equal(response.status, code.includes("UNAVAILABLE") || code.includes("CONFIGURED") ? 503 : 429);
      assert.equal(response.headers.get("retry-after"), "12"); assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(body.manualEntryAvailable, true); assert.equal(aiQuotaClientMessage(body, language), body.message);
      assert.doesNotMatch(body.message, /Gemini|API key|postgres/i);
    }
  }
  assert.equal(aiQuotaErrorResponse(new Error("other"), new Request("https://app.example.invalid")), null);
});
