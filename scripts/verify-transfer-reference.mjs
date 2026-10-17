import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { estimateInputSchema, fetchReferenceRate, parseReferencePayload, referenceConversion, referenceUsable } from "../src/lib/reference-rates.ts";
import { handleTransferReference } from "../src/lib/transfer-reference-handler.ts";
import { transferSandboxEnabled } from "../src/lib/transfer-runtime.ts";
const now = new Date("2026-10-17T06:00:00Z");
const sample = { date: "2026-10-16", base: "CNY", quote: "VND", rate: 3864.07 };
const ref = { ...parseReferencePayload(sample, "CNY", now), id: randomUUID() };
test("exact reference conversion rounds final VND once, including decimal and half-unit boundaries", () => {
  assert.equal(referenceConversion("1000", "3864.07"), "3864070");
  assert.equal(referenceConversion("0.01", "3864.0700000000"), "39");
  assert.equal(referenceConversion("0.01", "50"), "1");
  assert.equal(referenceConversion("0.01", "49"), "0");
  for (const bad of ["-1", "1e3", "0", "1.001", "1000001"]) assert.throws(() => referenceConversion(bad, ref.rate), /INVALID_COMMAND/);
});
test("pair, date, precision and implausible provider payloads fail closed", () => {
  for (const change of [{ base: "USD" }, { quote: "USD" }, { rate: 0 }, { rate: -1 }, { rate: "3864.07" }, { rate: 1e12 }, { rate: 1e-12 }, { date: "2026-02-30" }, { date: "2026-10-18" }, { date: "2026-10-01" }]) assert.throws(() => parseReferencePayload({ ...sample, ...change }, "CNY", now), /RATE_UNAVAILABLE/);
});
test("weekend reference works; fetch freshness expires at 24h and old observations cannot authorize estimates", () => {
  assert.equal(referenceUsable(ref, now), true);
  assert.equal(referenceUsable(ref, new Date(+now + 86400000 - 1)), true);
  assert.equal(referenceUsable(ref, new Date(+now + 86400000)), false);
  assert.equal(referenceUsable({ ...ref, date: "2026-10-09" }, now), false);
  assert.equal(referenceUsable({ ...ref, fetchedAt: "2026-10-18T00:00:00Z" }, now), false);
});
test("provider request uses fixed public pair only, rejects redirects/errors, bounds response size and validates payload", async () => {
  const rate = await fetchReferenceRate("CNY", now, async (url, options) => {
    assert.equal(url, "https://api.frankfurter.dev/v2/rate/cny/vnd");
    assert.equal(options.redirect, "error"); assert.equal(options.cache, "no-store");
    assert.deepEqual(Object.keys(options.headers), ["Accept"]);
    return Response.json(sample);
  });
  assert.equal(rate.rate, "3864.07");
  for (const response of [new Response("bad", { status: 503 }), new Response("{}"), Response.json({ ...sample, quote: "USD" }), new Response("x".repeat(8193), { headers: { "Content-Type": "application/json" } })]) await assert.rejects(() => fetchReferenceRate("CNY", now, async () => response), /RATE_UNAVAILABLE/);
});
test("estimate schema rejects forged prices, owners, extra payment instructions and unsafe amounts", () => {
  const input = { mutationId: randomUUID(), referenceId: ref.id, amount: "1000" };
  assert.equal(estimateInputSchema.safeParse(input).success, true);
  for (const field of [{ owner: "other" }, { convertedVnd: "1" }, { provider: "bank" }, { execute: true }, { amount: "0" }, { amount: "1000001" }]) assert.equal(estimateInputSchema.safeParse({ ...input, ...field }).success, false);
});
test("reference endpoint enforces session, origin, account owner, JSON, body bounds and sanitized failures", async () => {
  let calls = 0;
  const repo = { read: async () => { calls++; return {}; }, estimate: async () => { calls++; return {}; } };
  const req = (headers = {}, body = { mutationId: randomUUID(), referenceId: ref.id, amount: "1" }) => new Request("http://localhost/api/international-transfers/reference", { method: "POST", headers: { origin: "http://localhost", "Content-Type": "application/json", "x-finbridge-workspace-owner": "owner", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
  assert.equal((await handleTransferReference(req(), null, "http://localhost", repo)).status, 401);
  assert.equal((await handleTransferReference(req({ origin: "http://evil.invalid" }), "owner", "http://localhost", repo)).status, 403);
  assert.equal((await handleTransferReference(req({ "x-finbridge-workspace-owner": "other" }), "owner", "http://localhost", repo)).status, 409);
  assert.equal((await handleTransferReference(req({ "Content-Type": "text/plain" }), "owner", "http://localhost", repo)).status, 400);
  assert.equal((await handleTransferReference(req({}, "x".repeat(2049)), "owner", "http://localhost", repo)).status, 413);
  assert.equal((await handleTransferReference(req({}, "{"), "owner", "http://localhost", repo)).status, 400);
  assert.equal(calls, 0);
  assert.equal((await handleTransferReference(req(), "owner", "http://localhost", repo)).status, 200);
  const failed = await handleTransferReference(req(), "owner", "http://localhost", { ...repo, estimate: async () => { throw new Error("private database detail"); } });
  assert.equal(failed.status, 503); assert.deepEqual(await failed.json(), { error: "UNAVAILABLE" });
});
test("production defaults to blocked sandbox; malformed flags cannot enable simulated execution", () => {
  assert.equal(transferSandboxEnabled({ NODE_ENV: "production" }), false);
  assert.equal(transferSandboxEnabled({ NODE_ENV: "production", FINBRIDGE_ENABLE_TRANSFER_SANDBOX: "true" }), true);
  assert.equal(transferSandboxEnabled({ NODE_ENV: "production", FINBRIDGE_ENABLE_TRANSFER_SANDBOX: "TRUE" }), false);
  assert.equal(transferSandboxEnabled({ NODE_ENV: "development", FINBRIDGE_ENABLE_TRANSFER_SANDBOX: "false" }), false);
});
