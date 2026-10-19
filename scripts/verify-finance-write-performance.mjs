import assert from "node:assert/strict";
import test from "node:test";
import { writeFinanceTables } from "../src/lib/finance-tables.ts";
import { legacyWriteFinanceTables } from "./fixtures/finance-writer-before-delta.mjs";
import { workspaceFixture } from "./workspace-fixtures.mjs";

// Simulate row effects of the existing static UPDATE / INSERT statements. This
// verifies payload parity, not PostgreSQL execution or constraints.
function memoryClient(initial = new Map()) {
  const tables = structuredClone(initial), calls = [];
  return { tables, calls, async query(sql, params) {
    assert.equal(params[0], "synthetic-owner");
    assert.ok(!sql.includes("synthetic-owner"));
    const table = sql.match(/(?:UPDATE|INTO) (finbridge_\w+)/)?.[1]; assert.ok(table);
    calls.push({ sql, params });
    if (!tables.has(table)) tables.set(table, new Map());
    const rows = tables.get(table);
    if (sql.startsWith("UPDATE")) {
      const ids = new Set(params[1]), inverse = sql.includes("NOT(id=ANY");
      for (const [id, entry] of rows) if (!entry.deleted && (inverse ? !ids.has(id) : ids.has(id))) entry.deleted = true;
    } else {
      for (const row of JSON.parse(params[1])) rows.set(row.id, { row, deleted: false });
    }
    return { rows: [] };
  } };
}
const canonical = tables => [...tables].sort(([a],[b]) => a.localeCompare(b)).map(([name, rows]) => [name, [...rows].sort(([a],[b]) => a.localeCompare(b))]);
async function compareChanges(initial, edits) {
  const seed = memoryClient(); await legacyWriteFinanceTables(seed, "synthetic-owner", initial);
  const old = memoryClient(seed.tables), next = memoryClient(seed.tables);
  let previous = structuredClone(initial);
  for (const edit of edits) {
    const state = structuredClone(previous); edit(state);
    await legacyWriteFinanceTables(old, "synthetic-owner", state, previous);
    await writeFinanceTables(next, "synthetic-owner", state, previous);
    assert.deepEqual(canonical(next.tables), canonical(old.tables)); previous = state;
  }
  return { old, next };
}

test("append one expense among 1000 rows writes only one row, with the original row values", async () => {
  const initial = workspaceFixture(); initial.transactions = Array.from({ length: 1000 }, (_, i) => ({ ...initial.transactions[0], id: `t${i}` }));
  const { old, next } = await compareChanges(initial, [s => s.transactions.push({ ...s.transactions[0], id: "new-expense" })]);
  assert.equal(old.calls.length, 2); assert.equal(next.calls.length, 1);
  assert.ok(next.calls[0].sql.includes("finbridge_transactions"));
  assert.equal(JSON.parse(old.calls[1].params[1]).length, 1001);
  assert.equal(JSON.parse(next.calls[0].params[1]).length, 1);
  console.info("Synthetic row-write comparison:", { beforeQueries: 2, afterQueries: 1, beforeRows: 1001, afterRows: 1 });
});

test("edit/delete/reorder/restore keep row values, ordering and soft deletion identical", async () => {
  const initial = workspaceFixture(); initial.transactions.push({ ...initial.transactions[0], id: "second", amount: 10 }, { ...initial.transactions[0], id: "third", amount: 20 });
  const saved = structuredClone(initial.transactions[1]);
  await compareChanges(initial, [
    s => { s.transactions[0].amount += 1; s.transactions[0].title = "Edited"; },
    s => { s.transactions = s.transactions.filter(t => t.id !== "second"); },
    s => { s.transactions.reverse(); },
    s => { s.transactions.push(saved); },
    s => { s.transactions = []; },
  ]);
});

test("budget, fixed expense, preferences and conversation deltas retain full data", async () => {
  const initial = workspaceFixture();
  await compareChanges(initial, [
    s => { s.goals[0].amount += 50; },
    s => { s.fixedExpenses[0].amount += 5; s.fixedExpenses[0].reminderDays = 0; },
    s => { s.transactionChat.messages.push({ role: "user", text: "Follow-up" }); },
    s => { s.transactionChat.messages[0].text = "Corrected"; s.transactionChat.drafts = [{ id: "draft", amount: null }]; },
    s => { s.transactionChat.drafts = []; s.settings.theme = "dark"; },
    s => { s.categories.push("Books"); s.categoryMeta.Books = { type: "expense", icon: "", children: ["Textbooks"] }; },
    s => { s.categories = s.categories.filter(name => name !== "Books"); delete s.categoryMeta.Books; },
  ]);
});

test("initial import still reconciles all tables; no-change revision writes no table rows", async () => {
  const initial = workspaceFixture(), old = memoryClient(), next = memoryClient();
  await legacyWriteFinanceTables(old, "synthetic-owner", initial);
  await writeFinanceTables(next, "synthetic-owner", initial);
  assert.deepEqual(canonical(old.tables), canonical(next.tables));
  next.calls.length = 0; await writeFinanceTables(next, "synthetic-owner", structuredClone(initial), initial);
  assert.deepEqual(next.calls, []);
});

test("deletion is owner-scoped and only marks the removed row", async () => {
  const initial = workspaceFixture(), { next } = await compareChanges(initial, [s => { s.transactions = []; }]);
  const deletion = next.calls.find(call => call.sql.startsWith("UPDATE finbridge_transactions"));
  assert.ok(deletion.sql.includes("user_id=$1")); assert.ok(deletion.sql.includes("deleted_at IS NULL"));
  assert.deepEqual(deletion.params, ["synthetic-owner", [initial.transactions[0].id]]);
  assert.ok(!next.calls.some(call => call.sql.startsWith("INSERT INTO finbridge_transactions")));
});
