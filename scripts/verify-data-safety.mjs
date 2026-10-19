import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createInMemoryReferenceRepository } from "../src/lib/transfer-reference-repository.ts";
import { createInMemoryTransferRepository } from "../src/lib/international-transfer-repository.ts";
import { createInMemorySafetyRepository } from "../src/lib/safety-repository.ts";
import { isLocalDemoRequest } from "../src/lib/local-demo.ts";
const initial = new Date("2026-10-17T06:00:00Z");
const bill = { schoolId: "shenzhen", title: "Synthetic tuition", reference: "SYNTHETIC", amount: "100", dueDate: "2026-10-31" };
function transfer() {
  let now = new Date(initial);
  const repo = createInMemoryTransferRepository(() => now, { sandboxEnabled: true });
  const act = (action, rest = {}, owner = "a") => repo.mutate(owner, { action, mutationId: randomUUID(), ...rest });
  async function draft(input = {}) {
    const saved = await act("saveBill", { bill: { ...bill, ...input } });
    const quoted = await act("quote", { id: saved.resultId, version: 1 });
    const quote = quoted.quotes.find(q => q.provider === "ALIPAY");
    const created = await act("draft", { quoteId: quote.id });
    return { id: created.resultId, billId: saved.resultId, quote };
  }
  return { repo, act, draft, advance: ms => { now = new Date(+now + ms); } };
}

test("demo APIs require explicit development, localhost host and a matching mutation origin", () => {
  const env = { NODE_ENV: "development", FINBRIDGE_DEMO_MODE: "true" };
  const req = (host = "localhost:3000", origin, method = "GET") => new Request("http://localhost:3000/api/safety", { method, headers: { host, ...(origin ? { origin } : {}) } });
  assert.equal(isLocalDemoRequest(req(), env), true);
  assert.equal(isLocalDemoRequest(req(), { ...env, NODE_ENV: "production" }), false);
  assert.equal(isLocalDemoRequest(req(), { ...env, FINBRIDGE_DEMO_MODE: "false" }), false);
  assert.equal(isLocalDemoRequest(req("evil.invalid"), env), false);
  assert.equal(isLocalDemoRequest(req("localhost:3000", "http://evil.invalid"), env), false);
  assert.equal(isLocalDemoRequest(req("localhost:3000", undefined, "POST"), env), false);
  assert.equal(isLocalDemoRequest(req("localhost:3000", "http://localhost:3000", "POST"), env), true);
});

test("memory reference failure has no fabricated rate, source or date and unknown IDs never substitute another rate", async () => {
  const repo = createInMemoryReferenceRepository({ clock: () => initial, loadRate: async () => { throw new Error("upstream down"); } });
  const doc = await repo.read("a");
  for (const item of doc.rates) { assert.equal(item.reference, null); assert.equal(item.usable, false); }
  await assert.rejects(repo.estimate("a", { mutationId: randomUUID(), referenceId: randomUUID(), amount: "100" }), /RATE_UNAVAILABLE/);
});

test("memory reference keeps exact provider observations, stale fallback metadata, owner isolation and idempotency", async () => {
  let now = new Date(initial), offline = false;
  const repo = createInMemoryReferenceRepository({ clock: () => now, loadRate: async currency => {
    if (offline) throw new Error("offline");
    return { base: currency, quote: "VND", source: "Frankfurter", rate: currency === "USD" ? "25827" : "3864.07", date: "2026-10-16", fetchedAt: now.toISOString() };
  } });
  const doc = await repo.read("a"), ref = doc.rates.find(r => r.currency === "USD").reference;
  const command = { mutationId: randomUUID(), referenceId: ref.id, amount: "2" };
  const result = await repo.estimate("a", command); assert.equal(result.convertedVnd, "51654");
  result.reference.rate = "1";
  assert.equal((await repo.estimate("a", command)).reference.rate, "25827");
  await assert.rejects(repo.estimate("a", { ...command, amount: "3" }), /MUTATION_MISMATCH/);
  assert.equal((await repo.read("b")).estimates.length, 0);
  await assert.rejects(repo.estimate("a", { ...command, mutationId: randomUUID(), referenceId: randomUUID() }), /RATE_UNAVAILABLE/);
  offline = true; now = new Date(+now + 7 * 3600000);
  const fallback = (await repo.read("a")).rates.find(r => r.currency === "USD");
  assert.equal(fallback.cached, true); assert.equal(fallback.usable, true); assert.equal(fallback.reference.fetchedAt, ref.fetchedAt);
  now = new Date(+initial + 86400000);
  assert.equal((await repo.read("a")).rates.find(r => r.currency === "USD").usable, false);
  await assert.rejects(repo.estimate("a", { ...command, mutationId: randomUUID() }), /RATE_STALE/);
});

test("sandbox execution requires approval and can debit only once, with immutable receipt and owner isolation", async () => {
  const t = transfer(), p = await t.draft();
  await assert.rejects(t.act("execute", { id: p.id }), /APPROVAL_REQUIRED/);
  await assert.rejects(t.act("approve", { id: p.id, acknowledge: true }, "b"), /NOT_FOUND/);
  await t.act("approve", { id: p.id, acknowledge: true });
  const command = { action: "execute", mutationId: randomUUID(), id: p.id };
  const done = await t.repo.mutate("a", command), receipt = done.receipts[0];
  assert.equal(done.accounts.find(a => a.id === "ALIPAY").balance, 100000000 - p.quote.total);
  assert.equal((await t.repo.mutate("a", command)).receipts[0].receiptId, receipt.receiptId);
  const again = await t.act("execute", { id: p.id }); assert.equal(again.audit.length, done.audit.length);
  await assert.rejects(t.act("saveBill", { id: p.billId, version: 1, bill: { ...bill, amount: "1" } }), /ALREADY_COMPLETED/);
  await assert.rejects(t.act("archiveBill", { id: p.billId, version: 1, archived: true }), /ALREADY_COMPLETED/);
  receipt.balanceAfter = 0; assert.notEqual((await t.repo.read("a")).receipts[0].balanceAfter, 0);
  assert.equal((await t.repo.read("b")).bills.length, 0);
});

test("pause, quote/approval expiry, bill edits, reserve and duplicate checks roll back failed mutations", async () => {
  const t = transfer(), p = await t.draft();
  await t.act("approve", { id: p.id, acknowledge: true });
  await t.act("pause", { paused: true });
  assert.equal((await t.repo.read("a")).plans[0].approvedAt, undefined);
  await assert.rejects(t.act("execute", { id: p.id }), /PAUSED/);
  await t.act("pause", { paused: false });
  await assert.rejects(t.act("execute", { id: p.id }), /APPROVAL_REQUIRED/);
  await t.act("approve", { id: p.id, acknowledge: true });
  t.advance(120000); await assert.rejects(t.act("execute", { id: p.id }), /APPROVAL_REQUIRED/);
  t.advance(180000); await assert.rejects(t.act("approve", { id: p.id, acknowledge: true }), /QUOTE_EXPIRED/);
  const before = await t.repo.read("a");
  await assert.rejects(t.act("saveBill", { bill }), /DUPLICATE_REFERENCE/);
  await assert.rejects(t.act("saveBill", { id: p.billId, version: 9, bill }), /BILL_CHANGED/);
  assert.deepEqual((await t.repo.read("a")).bills, before.bills);
  await t.act("saveBill", { id: p.billId, version: 1, bill: { ...bill, title: "Updated" } });
  await assert.rejects(t.act("execute", { id: p.id }), /BILL_CHANGED/);
  await assert.rejects(transfer().draft({ amount: "30000" }), /INSUFFICIENT_RESERVE/);
});

test("sandbox flag and mutation payload hashes cannot be bypassed in memory", async () => {
  const disabled = createInMemoryTransferRepository(() => initial, { sandboxEnabled: false });
  assert.equal((await disabled.read("a")).accounts.length, 0);
  await assert.rejects(disabled.mutate("a", { action: "quote", mutationId: randomUUID(), id: randomUUID(), version: 1 }), /SANDBOX_DISABLED/);
  const t = transfer(), command = { action: "saveBill", mutationId: randomUUID(), bill };
  await t.repo.mutate("a", command); assert.equal((await t.repo.mutate("a", command)).bills.length, 1);
  await assert.rejects(t.repo.mutate("a", { ...command, bill: { ...bill, amount: "2" } }), /MUTATION_MISMATCH/);
});

test("memory safety returns isolated copies and failed callbacks do not persist partial writes", async () => {
  const repo = createInMemorySafetyRepository(), doc = await repo.read("a");
  doc.paused = true; assert.notEqual((await repo.read("a")).paused, true);
  await assert.rejects(repo.mutate("a", doc.revision, "save", current => { current.paused = true; throw new Error("invalid rule"); }), /invalid rule/);
  assert.notEqual((await repo.read("a")).paused, true);
});
test("memory request limits count new accepted actions, allow exact retries and reset their windows", async () => {
  let now = new Date(initial);
  const references = createInMemoryReferenceRepository({ clock: () => now, loadRate: async base => ({ base, quote: "VND", rate: "25827", date: "2026-10-16", fetchedAt: now.toISOString(), source: "Frankfurter" }) });
  const referenceId = (await references.read("a")).rates[0].reference.id;
  const estimate = { mutationId: randomUUID(), referenceId, amount: "1" };
  await references.estimate("a", estimate);
  for (let i = 0; i < 9; i++) await references.estimate("a", { ...estimate, mutationId: randomUUID() });
  await references.estimate("a", estimate);
  await assert.rejects(references.estimate("a", { ...estimate, mutationId: randomUUID() }), /RATE_LIMITED/);
  await references.estimate("b", { ...estimate, mutationId: randomUUID() });
  now = new Date(+now + 60000); await references.estimate("a", { ...estimate, mutationId: randomUUID() });
  const transfers = createInMemoryTransferRepository(() => now, { sandboxEnabled: true });
  const command = { action: "pause", mutationId: randomUUID(), paused: true };
  await transfers.mutate("a", command);
  for (let i = 0; i < 29; i++) await transfers.mutate("a", { ...command, mutationId: randomUUID() });
  await transfers.mutate("a", command);
  await assert.rejects(transfers.mutate("a", { ...command, mutationId: randomUUID() }), /RATE_LIMITED/);
  now = new Date(+now + 60000); await transfers.mutate("a", { ...command, mutationId: randomUUID() });
});
