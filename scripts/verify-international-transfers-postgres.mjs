import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { testPool, syntheticUser, cleanupFinance } from "./workspace-fixtures.mjs";
import { internationalTransferRepository, INTERNATIONAL_TRANSFER_SQL } from "../src/lib/international-transfer-repository.ts";
import { deactivateAccountLifecycle } from "../src/lib/account-lifecycle.ts";
const tables = ["finbridge_transfer_mutations", "finbridge_transfer_audit", "finbridge_transfer_plans", "finbridge_transfer_quotes", "finbridge_transfer_bills", "finbridge_transfer_accounts", "finbridge_transfer_controls"];
test("PostgreSQL: owner isolation, immutable quotes, approval, receipt, replay, races and recovery", async () => {
  const pool = await testPool(); const owners = [];
  try {
    await pool.query(INTERNATIONAL_TRANSFER_SQL);
    const owner = await syntheticUser(pool), other = await syntheticUser(pool); owners.push(owner, other);
    let now = new Date("2026-10-17T06:00:00Z"); const repo = internationalTransferRepository(pool, () => now);
    const send = (action, extra = {}, who = owner) => repo.mutate(who, { action, mutationId: randomUUID(), ...extra });
    assert.equal((await repo.read(owner)).accounts.length, 2);
    const input = { schoolId: "shenzhen", title: "Synthetic tuition", reference: "TEST-1", amount: "1000.00", dueDate: "2026-10-31" };
    const saved = await send("saveBill", { bill: input }), bill = saved.bills[0];
    assert.equal((await repo.read(other)).bills.length, 0);
    await assert.rejects(() => send("quote", { id: bill.id, version: bill.version }, other), /NOT_FOUND/);
    const compared = await send("quote", { id: bill.id, version: bill.version }); assert.equal(compared.quotes.length, 3);
    const q = compared.quotes.find(q => q.provider === "BANK_A"), bad = compared.quotes.find(q => q.provider === "BANK_B");
    await assert.rejects(() => send("draft", { quoteId: bad.id }), /CHANNEL_UNAVAILABLE/);
    const drafted = await send("draft", { quoteId: q.id }), id = drafted.resultId;
    await assert.rejects(() => send("execute", { id }, other), /NOT_FOUND/);
    await assert.rejects(() => send("execute", { id }), /APPROVAL_REQUIRED/);
    await send("approve", { id, acknowledge: true });
    const command = { action: "execute", mutationId: randomUUID(), id };
    const [one, two] = await Promise.all([repo.mutate(owner, command), repo.mutate(owner, command)]);
    assert.equal(one.plans[0].receiptId, two.plans[0].receiptId);
    const complete = one.plans[0], balance = one.accounts.find(a => a.id === "BANK_A").balance;
    assert.equal(complete.status, "completed"); assert.equal(balance, 100000000 - q.total);
    const replay = await send("execute", { id }); assert.equal(replay.accounts.find(a => a.id === "BANK_A").balance, balance);
    assert.equal(replay.audit.filter(a => a.event === "completed").length, 1);
    await assert.rejects(() => repo.mutate(owner, { ...command, action: "cancel" }), /MUTATION_MISMATCH/);
    await assert.rejects(() => send("quote", { id: bill.id, version: 1 }), /ALREADY_COMPLETED/);
    await assert.rejects(() => send("saveBill", { id: bill.id, version: 1, bill: { ...input, amount: "2" } }), /ALREADY_COMPLETED/);
    assert.equal((await repo.read(other)).accounts[0].balance, 100000000);
    const b2 = (await send("saveBill", { bill: { ...input, reference: "TEST-2" } })).bills.find(b => b.reference === "TEST-2");
    const quotes2 = await send("quote", { id: b2.id, version: b2.version }), q2 = quotes2.quotes.find(q => q.billId === b2.id && q.provider === "BANK_A");
    const id2 = (await send("draft", { quoteId: q2.id })).resultId;
    await send("approve", { id: id2, acknowledge: true }); await send("pause", { paused: true });
    await assert.rejects(() => send("execute", { id: id2 }), /PAUSED/);
    await send("pause", { paused: false }); await assert.rejects(() => send("execute", { id: id2 }), /APPROVAL_REQUIRED/);
    await send("approve", { id: id2, acknowledge: true });
    await send("quote", { id: b2.id, version: b2.version });
    await assert.rejects(() => send("execute", { id: id2 }), /BILL_CHANGED/);
    await assert.rejects(() => send("draft", { quoteId: q2.id }), /QUOTE_EXPIRED/);
    const latest = (await repo.read(owner)).quotes.find(q => q.billId === b2.id && q.provider === "BANK_A");
    const id3 = (await send("draft", { quoteId: latest.id })).resultId;
    await send("saveBill", { id: b2.id, version: b2.version, bill: { ...input, reference: "TEST-2", amount: "2000" } });
    await assert.rejects(() => send("approve", { id: id3, acknowledge: true }), /BILL_CHANGED/);
    now = new Date(+now + 60000 * 2);
    const b3 = (await send("saveBill", { bill: { ...input, reference: "TEST-3", amount: "30000" } })).bills.find(b => b.reference === "TEST-3");
    const q3 = (await send("quote", { id: b3.id, version: 1 })).quotes.find(q => q.billId === b3.id && q.provider === "BANK_A");
    await assert.rejects(() => send("draft", { quoteId: q3.id }), /INSUFFICIENT_RESERVE/);
    await assert.rejects(() => send("saveBill", { bill: input }), /DUPLICATE_REFERENCE/);
    const b4 = (await send("saveBill", { bill: { ...input, reference: "TEST-4" } })).bills.find(b => b.reference === "TEST-4");
    const q4 = (await send("quote", { id: b4.id, version: 1 })).quotes.find(q => q.billId === b4.id && q.provider === "ALIPAY");
    const id4 = (await send("draft", { quoteId: q4.id })).resultId;
    await send("approve", { id: id4, acknowledge: true }); now = new Date(+now + 120000);
    await assert.rejects(() => send("execute", { id: id4 }), /APPROVAL_REQUIRED/);
    await send("approve", { id: id4, acknowledge: true }); now = new Date(+now + 180000);
    await assert.rejects(() => send("execute", { id: id4 }), /QUOTE_EXPIRED/);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM finbridge_transfer_plans WHERE user_id=$1 AND status='completed'", [owner])).rows[0].n, 1);
    // Two different bills can pass review independently, but must recheck the
    // same source balance under the per-owner transaction lock at execution.
    const concurrent = [];
    for (const reference of ["RACE-A", "RACE-B"]) {
      const b = (await send("saveBill", { bill: { ...input, reference, amount: "15000" } }, other)).bills.find(b => b.reference === reference);
      const q = (await send("quote", { id: b.id, version: 1 }, other)).quotes.find(q => q.billId === b.id && q.provider === "BANK_A");
      const id = (await send("draft", { quoteId: q.id }, other)).resultId;
      await send("approve", { id, acknowledge: true }, other); concurrent.push(id);
    }
    const race = await Promise.allSettled(concurrent.map(id => send("execute", { id }, other)));
    assert.equal(race.filter(r => r.status === "fulfilled").length, 1);
    assert.match(race.find(r => r.status === "rejected").reason.message, /INSUFFICIENT_RESERVE/);
    assert.equal((await repo.read(other)).receipts.length, 1);
    // Closing the FinBridge account also revokes access to retained transfers.
    await deactivateAccountLifecycle(pool, { userId: owner, secret: "synthetic-transfer-lifecycle-test".repeat(3) });
    await assert.rejects(() => repo.read(owner), /UNAUTHENTICATED/);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM finbridge_transfer_plans WHERE user_id=$1", [owner])).rows[0].n > 0, true);
  } finally {
    for (const table of tables) await pool.query(`DELETE FROM ${table} WHERE user_id=ANY($1::text[])`, [owners]);
    await cleanupFinance(pool, owners); await pool.end();
  }
});
