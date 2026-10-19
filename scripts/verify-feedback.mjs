import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { handleFeedback } from "../src/lib/feedback-handler.ts";
import { FeedbackError } from "../src/lib/feedback.ts";
const origin = "https://finbridge.example.invalid";
const command = () => ({ mutationId: randomUUID(), kind: "contact", subject: "Question", message: "Synthetic feedback" });
const req = (body = command(), headers = {}, method = "POST") => new Request(origin + "/api/feedback", { method, headers: { origin, "content-type": "application/json", "x-finbridge-workspace-owner": "a", ...headers }, ...(method === "POST" ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}) });
test("feedback rejects unauthenticated, cross-origin, stale owner, forged fields and oversized requests before write", async () => {
  let calls = 0; const repository = { submit: async () => { calls++; return {}; } };
  const run = (request, owner = "a") => handleFeedback(request, owner, origin, repository);
  assert.equal((await run(req(), null)).status, 401);
  assert.equal((await run(req({}, { origin: "https://evil.invalid" }))).status, 403);
  assert.equal((await run(req({}, { "x-finbridge-workspace-owner": "b" }))).status, 409);
  assert.equal((await run(req({}, { "content-type": "text/plain" }))).status, 400);
  assert.equal((await run(req({}, {}, "GET"))).status, 405);
  for (const body of ["{", { ...command(), owner: "b" }, { ...command(), status: "resolved" }, { ...command(), message: " " }, { ...command(), message: "a".repeat(2001) }]) assert.equal((await run(req(body))).status, 400);
  assert.equal((await run(req("a".repeat(16385)))).status, 413); assert.equal(calls, 0);
});
test("feedback success returns only database receipt; storage and rate errors never return success or private detail", async () => {
  const input = command(), receipt = { id: input.mutationId, kind: "contact", status: "received", createdAt: new Date().toISOString() };
  const response = await handleFeedback(req(input), "a", origin, { submit: async (owner, data) => { assert.equal(owner, "a"); assert.deepEqual(data, input); return receipt; } });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { receipt }); assert.equal(response.headers.get("cache-control"), "no-store");
  for (const [error, status, code] of [[new Error("private PostgreSQL credential"), 503, "FEEDBACK_UNAVAILABLE"], [new FeedbackError("RATE_LIMITED", 429), 429, "RATE_LIMITED"]]) {
    const result = await handleFeedback(req(), "a", origin, { submit: async () => { throw error; } });
    assert.equal(result.status, status); assert.deepEqual(await result.json(), { error: code });
  }
});
