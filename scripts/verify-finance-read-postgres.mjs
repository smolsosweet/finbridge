// Run only against the named isolated local database enforced by testPool().
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFinanceTables } from "../src/lib/finance-tables.ts";
import { writeFinanceTables } from "../src/lib/finance-tables.ts";
import { legacyWriteFinanceTables } from "./fixtures/finance-writer-before-delta.mjs";
import { legacyReadFinanceTables } from "./fixtures/finance-reader-before-batching.mjs";
import { workspaceRepository } from "../src/lib/workspace-repository.ts";
import { testPool, syntheticUser, cleanupFinance, workspaceFixture } from "./workspace-fixtures.mjs";

test("real PostgreSQL: batched hydration equals the original reader and isolates accounts", async () => {
  const pool = await testPool(), owners = [];
  try {
    owners.push(await syntheticUser(pool), await syntheticUser(pool));
    const state = workspaceFixture(), repo = workspaceRepository(pool);
    await repo.save(owners[0], { revision: 0, mutationId: randomUUID(), data: state });
    const client = await pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      const expected = await legacyReadFinanceTables(client, owners[0], state);
      let calls = 0;
      const measured = { query(...args) { calls++; return client.query(...args); } };
      const actual = await readFinanceTables(measured, owners[0], state);
      assert.deepEqual(actual, expected); assert.equal(calls, 1);
      const foreign = await readFinanceTables(client, owners[1], state);
      assert.deepEqual(foreign.wallets, []); assert.deepEqual(foreign.transactions, []);
      assert.deepEqual(foreign.transactionChat?.messages || [], []);
      await client.query("COMMIT");
    } finally { await client.query("ROLLBACK"); client.release(); }
  } finally { await cleanupFinance(pool, owners); await pool.end(); }
});

test("real PostgreSQL: delta writes preserve insert/edit/delete/reorder and conversation contents", async () => {
  const pool = await testPool(), owners = [];
  try {
    owners.push(await syntheticUser(pool), await syntheticUser(pool));
    let previous = workspaceFixture();
    const repo = workspaceRepository(pool);
    for (const owner of owners) await repo.save(owner, { revision: 0, mutationId: randomUUID(), data: previous });
    const changes = [
      s => { s.transactions.push({ ...s.transactions[0], id: "second", amount: 20 }); },
      s => { s.transactions[0].amount -= 5; s.transactions[0].title = "Edited"; },
      s => { s.transactions.reverse(); s.transactionChat.messages.push({ role: "user", text: "Follow-up" }); },
      s => { s.transactions = s.transactions.filter(t => t.id !== "second"); },
    ];
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const change of changes) {
        const next = structuredClone(previous); change(next);
        await legacyWriteFinanceTables(client, owners[0], next, previous);
        await writeFinanceTables(client, owners[1], next, previous);
        const expected = await legacyReadFinanceTables(client, owners[0], next);
        const actual = await readFinanceTables(client, owners[1], next);
        assert.deepEqual(actual, expected); previous = next;
      }
      await client.query("COMMIT");
    } finally { await client.query("ROLLBACK"); client.release(); }
  } finally { await cleanupFinance(pool, owners); await pool.end(); }
});
