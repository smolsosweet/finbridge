import assert from "node:assert/strict";
import test from "node:test";
import { readFinanceTables } from "../src/lib/finance-tables.ts";
import { legacyReadFinanceTables } from "./fixtures/finance-reader-before-batching.mjs";
import { workspaceFixture } from "./workspace-fixtures.mjs";
import { AiRequestTiming, traceAiRequest } from "../src/lib/ai-request-timing.ts";

const normalize = sql => sql.replace(/\s+/g, " ").trim();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function fakeDatabase(state, delay = 0) {
  const queries = [], sections = {
    finbridge_wallets: state.wallets.map(data => ({ data })),
    finbridge_categories: state.categories.map(name => ({ id: name, name, listed: true, data: state.categoryMeta[name], category_type: state.categoryMeta[name]?.type || "expense", icon: "", archived: false })),
    finbridge_wallet_categories: state.wallets.flatMap(w => state.categories.map(name => ({ wallet_id: w.id, name }))),
    finbridge_category_children: [{ category_id: state.categories[0], name: "Child category" }],
    finbridge_transactions: state.transactions.map(data => ({ data })),
    finbridge_budgets: state.goals.map(data => ({ data })),
    finbridge_fixed_expenses: (state.fixedExpenses || []).map(data => ({ data })),
    finbridge_preferences: Object.entries(state.settings).map(([preference_key, value]) => ({ preference_key, value })),
    finbridge_fixed_expense_recipients: [{ expense_id: state.fixedExpenses?.[0]?.id, data: { bankBin: "970415", accountNumber: "synthetic", accountName: "Synthetic", reference: "Test" } }],
    finbridge_chat_messages: [{ conversation_id: "transactions", data: { role: "user", text: "Synthetic user message" } }, { conversation_id: "planning", data: { role: "assistant", text: "Synthetic context" } }],
    finbridge_transaction_drafts: [{ data: { id: "draft", amount: 25_000 } }],
    finbridge_conversations: [{ id: "transactions", data: { clarifyingDraftId: "draft", activeDraftId: "draft", referencedCategories: [state.categories[0]] } }],
    finbridge_onboarding_drafts: [{ data: { step: 1 } }],
    finbridge_recurring_transactions: state.recurring.map(data => ({ data })),
    finbridge_categorization_rules: state.rules.map(data => ({ data })),
  };
  const lookup = sql => {
    const table = sql.match(/FROM (finbridge_\w+)/)?.[1];
    assert.ok(table in sections, table);
    return structuredClone(sections[table]);
  };
  return { queries, async query(sql, params) {
    assert.deepEqual(params, ["synthetic-owner"]);
    queries.push(normalize(sql)); if (delay) await sleep(delay);
    if (!sql.startsWith("SELECT jsonb_build_object(")) return { rows: lookup(sql) };
    const batch = {}, parts = [...sql.matchAll(/'([a-zA-Z]+)', COALESCE\(\(SELECT jsonb_agg\(to_jsonb\(finance_rows\)\) FROM \((.*?)\) finance_rows\), '\[\]'::jsonb\)/gs)];
    assert.equal(parts.length, 15);
    for (const [, name, query] of parts) batch[name] = lookup(query);
    return { rows: [{ sections: batch }] };
  } };
}

test("one batched read is equivalent to the original fifteen reads, including full conversation state", async () => {
  const state = workspaceFixture(), before = structuredClone(state), legacyDb = fakeDatabase(state), batchedDb = fakeDatabase(state);
  const legacy = await legacyReadFinanceTables(legacyDb, "synthetic-owner", state);
  const batched = await readFinanceTables(batchedDb, "synthetic-owner", state);
  assert.deepEqual(batched, legacy); assert.deepEqual(state, before);
  assert.equal(legacyDb.queries.length, 15); assert.equal(batchedDb.queries.length, 1);
  for (const sql of legacyDb.queries) assert.ok(batchedDb.queries[0].includes(sql), "Original SQL including owner, soft-delete filters, authoritative columns and ordering must be retained");
  assert.equal(batched.transactionChat.activeDraftId, "draft");
  assert.equal(batched.planningChat[0].text, "Synthetic context");
});

test("SQL values stay bound and the batched reader does not silently accept an absent result", async () => {
  const owner = "synthetic-owner' OR true --";
  await assert.rejects(readFinanceTables({ async query(sql, values) {
    assert.deepEqual(values, [owner]); assert.ok(!sql.includes(owner)); return { rows: [] };
  } }, owner, workspaceFixture()), /FINANCE_READ_UNAVAILABLE/);
});

test("synthetic network benchmark uses the same reader/data and explicitly reports round-trip simulation", async () => {
  const state = workspaceFixture(), results = {};
  for (const [name, reader] of [["before", legacyReadFinanceTables], ["after", readFinanceTables]]) {
    const samples = [];
    for (let i = 0; i < 5; i++) {
      const db = fakeDatabase(state, 8), started = performance.now();
      await reader(db, "synthetic-owner", state); samples.push(performance.now() - started);
      assert.equal(db.queries.length, name === "before" ? 15 : 1);
    }
    results[name] = Math.round(samples.sort((a,b) => a-b)[2]);
  }
  console.info("Synthetic DB read benchmark (8ms artificial latency/query; NOT Vercel):", results);
});

test("timing logs expose durations/counts only, with correlation headers on success and errors", async () => {
  const info = console.info, logs = []; console.info = (...args) => logs.push(args);
  try {
    for (const status of [200, 401, 403, 409, 429, 502, 504]) {
      const response = await traceAiRequest("assistant", async timing => {
        await timing.measure("auth", async () => ({ id: "private-owner" }));
        await timing.measure("workspace", async () => ({ balance: 123456 }));
        await assert.rejects(timing.measure("model", async () => { throw new Error("private prompt/key"); }));
        timing.measureSync("calculation", () => 123456);
        return Response.json({ private: "body" }, { status });
      });
      assert.equal(response.status, status);
      assert.match(response.headers.get("x-finbridge-request-id"), /^[a-f0-9-]{36}$/);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.match(response.headers.get("server-timing"), /auth;dur=.*workspace;dur=.*model;dur=.*calculation;dur=/);
      assert.equal((await response.json()).private, "body");
    }
    assert.equal(logs.length, 7);
    for (const [, log] of logs) { assert.equal(log.modelCalls, 1); assert.ok(log.durationMs >= 0); }
    assert.doesNotMatch(JSON.stringify(logs), /private-owner|123456|private prompt|body/);
    await assert.rejects(traceAiRequest("assistant", async () => { throw new Error("private failure"); }), /private failure/);
    assert.equal(logs.at(-1)[1].status, 500); assert.doesNotMatch(JSON.stringify(logs), /private failure/);
  } finally { console.info = info; }
});

test("deterministic-only requests record zero model calls", async () => {
  const timing = new AiRequestTiming(); await timing.measure("workspace", async () => null);
  assert.equal(timing.snapshot().modelCalls, 0);
});
