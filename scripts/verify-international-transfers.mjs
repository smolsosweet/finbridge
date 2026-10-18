import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { assertTransferReady, quoteTransfer, TRANSFER_APPROVAL_MS, TRANSFER_QUOTE_MS, TRANSFER_RESERVE, transferBillSchema, transferCommandSchema } from "../src/lib/international-transfer.ts";
import { handleInternationalTransfer } from "../src/lib/international-transfer-handler.ts";
import { completedTransfers, pendingTransferBills, transferHistoryTarget } from "../src/lib/transfer-views.ts";
const now = new Date("2026-10-17T06:00:00Z");
const bill = { id: randomUUID(), schoolId: "shenzhen", title: "Synthetic tuition", reference: "OCT-2026", amount: "20000.00", dueDate: "2026-10-31", version: 1, archived: false, createdAt: now.toISOString() };
const quote = () => quoteTransfer(bill, "BANK_A", now, randomUUID());
const plan = () => ({ id: randomUUID(), bill, quote: quote(), status: "review", createdAt: now.toISOString() });
test("completed view requires a receipt and retains older receipts beyond the recent-plan window", () => {
  const older = { ...plan(), status: "completed", receiptId: "older", completedAt: "2026-10-15T06:00:00Z" };
  const latest = { ...plan(), status: "completed", receiptId: "latest", completedAt: now.toISOString() };
  const others = ["review", "approved", "cancelled", "invalidated"].map(status => ({ ...plan(), status }));
  const document = { plans: [...others, latest, { ...plan(), status: "completed" }], receipts: [older, latest] };
  assert.deepEqual(completedTransfers(document).map(p => p.receiptId), ["latest", "older"]);
});
test("paid bill cannot reappear in pending because an earlier draft needs another quote", () => {
  const paid = { ...plan(), status: "completed", receiptId: "receipt" };
  const pending = { ...bill, id: randomUUID() }, archived = { ...bill, id: randomUUID(), archived: true };
  assert.deepEqual(pendingTransferBills([bill, pending, archived], [paid]).map(b => b.id), [pending.id]);
  assert.deepEqual(pendingTransferBills([bill, pending, archived], [paid], true).map(b => b.id), [pending.id, archived.id]);
});
test("history targets resolve the actual bill or plan without treating draft activity as completion", () => {
  const draft = plan(), receipt = { ...plan(), status: "completed", receiptId: "receipt" };
  const document = { bills: [bill], plans: [draft], receipts: [receipt] };
  assert.equal(transferHistoryTarget({ targetId: draft.id }, document).plan.status, "review");
  assert.equal(transferHistoryTarget({ targetId: receipt.id }, document).plan.receiptId, "receipt");
  assert.equal(transferHistoryTarget({ targetId: bill.id }, document).bill.id, bill.id);
  assert.deepEqual(transferHistoryTarget({ targetId: "missing" }, document), { plan: undefined, bill: undefined });
});
test("ported example preserves exact total and receiver amount without double charging fees", () => {
  const q = quote(); assert.equal(q.conversion, 70400000); assert.equal(q.fxMarkup, 140800); assert.equal(q.transferFee, 220000); assert.equal(q.total, 70760800); assert.equal(q.receiveAmount, "20000.00");
  assert.equal(q.total, q.conversion + q.fxMarkup + q.transferFee);
});
test("decimal arithmetic rounds half up to whole VND without binary floating drift", () => {
  const q = quoteTransfer({ ...bill, amount: "0.01" }, "ALIPAY", now, randomUUID());
  assert.equal(q.conversion, 35); assert.equal(q.total, 120035);
});
test("three supported corridors never enable Bank B or unsupported Alipay", () => {
  for (const schoolId of ["shenzhen", "pacific", "sydney"]) {
    const b = { ...bill, schoolId };
    assert.equal(quoteTransfer(b, "BANK_B", now, randomUUID()).eligible, false);
    assert.equal(quoteTransfer(b, "BANK_A", now, randomUUID()).eligible, true);
    assert.equal(quoteTransfer(b, "ALIPAY", now, randomUUID()).eligible, schoolId === "shenzhen");
  }
});
test("calendar arrival includes one safety day and makes late arrival explicit", () => {
  const q = quoteTransfer({ ...bill, dueDate: "2026-10-20" }, "BANK_A", now, randomUUID());
  assert.equal(q.arrivalDate, "2026-10-20"); assert.equal(q.latestSendDate, "2026-10-16"); assert.equal(q.deadlineRisk, true);
});
test("quote and approval expiry boundaries reject at equality", () => {
  assert.throws(() => assertTransferReady(plan(), bill, false, 100000000, new Date(+now + TRANSFER_QUOTE_MS)), /QUOTE_EXPIRED/);
  const p = { ...plan(), status: "approved", approvedAt: now.toISOString() };
  assertTransferReady(p, bill, false, 100000000, new Date(+now + TRANSFER_APPROVAL_MS - 1), true);
  assert.throws(() => assertTransferReady(p, bill, false, 100000000, new Date(+now + TRANSFER_APPROVAL_MS), true), /APPROVAL_REQUIRED/);
});
test("stale bill, archive, pause, cancellation and missing approval fail closed", () => {
  assert.throws(() => assertTransferReady(plan(), { ...bill, version: 2 }, false, 100000000, now), /BILL_CHANGED/);
  assert.throws(() => assertTransferReady(plan(), { ...bill, archived: true }, false, 100000000, now), /BILL_CHANGED/);
  assert.throws(() => assertTransferReady(plan(), bill, true, 100000000, now), /PAUSED/);
  assert.throws(() => assertTransferReady({ ...plan(), status: "cancelled" }, bill, false, 100000000, now), /CANCELLED/);
  assert.throws(() => assertTransferReady(plan(), bill, false, 100000000, now, true), /APPROVAL_REQUIRED/);
});
test("minimum reserve is enforced with equality allowed", () => {
  const p = plan(); assertTransferReady(p, bill, false, p.quote.total + TRANSFER_RESERVE, now);
  assert.throws(() => assertTransferReady(p, bill, false, p.quote.total + TRANSFER_RESERVE - 1, now), /INSUFFICIENT_RESERVE/);
});
test("schemas reject unknown owner, prices, recipient fields, impossible dates and unsafe amounts", () => {
  const input = { schoolId: bill.schoolId, title: bill.title, reference: bill.reference, amount: bill.amount, dueDate: bill.dueDate };
  for (const change of [{ amount: "-1" }, { amount: "1e3" }, { amount: "0" }, { amount: "1.001" }, { amount: "1000001" }, { amount: 100 }, { dueDate: "2026-02-30" }, { recipient: "external-account" }, { owner: "other" }]) assert.equal(transferBillSchema.safeParse({ ...input, ...change }).success, false);
  assert.equal(transferCommandSchema.safeParse({ action: "draft", mutationId: randomUUID(), quoteId: randomUUID(), total: 1 }).success, false);
  assert.equal(transferCommandSchema.safeParse({ action: "approve", mutationId: randomUUID(), id: randomUUID(), acknowledge: false }).success, false);
});
test("handler rejects unauthenticated, cross-origin, stale owner and forged body before repository access", async () => {
  let calls = 0; const repo = { read: async () => { calls++; return {}; }, mutate: async () => { calls++; return {}; } };
  const request = (headers, body = { action: "execute", mutationId: randomUUID(), id: randomUUID() }) => new Request("http://localhost/api/international-transfers", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  assert.equal((await handleInternationalTransfer(request({}), null, "http://localhost", repo)).status, 401);
  assert.equal((await handleInternationalTransfer(request({ origin: "http://evil.test" }), "owner", "http://localhost", repo)).status, 403);
  assert.equal((await handleInternationalTransfer(request({ origin: "http://localhost", "x-finbridge-workspace-owner": "other" }), "owner", "http://localhost", repo)).status, 409);
  assert.equal((await handleInternationalTransfer(request({ origin: "http://localhost", "x-finbridge-workspace-owner": "owner" }, { action: "execute", mutationId: randomUUID(), id: randomUUID(), total: 1 }), "owner", "http://localhost", repo)).status, 400);
  const oversized = request({ origin: "http://localhost", "x-finbridge-workspace-owner": "owner" }, { content: "x".repeat(10000) });
  assert.equal((await handleInternationalTransfer(oversized, "owner", "http://localhost", repo)).status, 413);
  assert.equal(calls, 0);
});
