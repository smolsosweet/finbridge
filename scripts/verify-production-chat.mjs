import assert from "node:assert/strict";
import test from "node:test";
import { workspaceFixture } from "./workspace-fixtures.mjs";
import { workspaceSchema } from "../src/lib/workspace-model.ts";
import { createWorkspaceWriter } from "../src/lib/workspace-writer.ts";
import { writeFinanceTables } from "../src/lib/finance-tables.ts";
import { workspaceWireSnapshot, workspaceRequest, WorkspaceRequestError, definitelyRejectedWorkspace } from "../src/lib/workspace-payload.ts";
import { handleWorkspace } from "../src/lib/workspace-handler.ts";
import { gzipSync, gunzipSync } from "node:zlib";
import { randomUUID } from "node:crypto";
import { pendingDraftReminder, rollbackRejectedDrafts, shouldBlockNewDraft } from "../src/lib/pending-draft-policy.ts";
import { validateAndCommitDrafts, validateDraftForState, removeDraftById } from "../src/lib/transaction-drafts.ts";
import { receiptImageDimensions, prepareReceiptImage } from "../src/lib/receipt-image.ts";

test("receipt accepted by OCR's 5 MB limit can fail the existing workspace image limit", () => {
  const s = workspaceFixture(); s.transactions[0].image = "data:image/jpeg;base64," + "A".repeat(3200000);
  assert.equal(workspaceSchema.safeParse(s).success, false);
});
test("duplicating a permitted receipt in chat can exceed a production function body limit", () => {
  const s = workspaceFixture(); s.transactions[0].image = "data:image/jpeg;base64," + "A".repeat(2800000);
  s.transactionChat = { messages: [{ role: "assistant", text: "Saved", transaction: s.transactions[0] }], drafts: [], clarifyingDraftId: null };
  assert.equal(workspaceSchema.safeParse(s).success, true);
  assert.ok(Buffer.byteLength(JSON.stringify(s)) > 4500000);
});
test("a definitive rejected snapshot must not poison all later corrected saves", async () => {
  let state = workspaceFixture(); const calls = [];
  const w = createWorkspaceWriter({ revision: 0, initial: structuredClone(state), getState: () => state, onStatus: () => {}, save: async input => {
    calls.push(structuredClone(input)); if (calls.length === 1) throw Object.assign(new Error("INVALID_WORKSPACE"), { status: 400 });
    return { revision: input.revision + 1, data: input.data, updatedAt: null };
  } });
  state.settings.name = "Invalid"; await assert.rejects(w.flush()); state.settings.name = "Corrected"; await w.flush();
  assert.equal(calls[1].data.settings.name, "Corrected"); assert.notEqual(calls[0].mutationId, calls[1].mutationId);
});

test("a chat-only change must not rewrite all unrelated financial tables", async () => {
  const previous = workspaceFixture(), next = structuredClone(previous), calls = [];
  next.transactionChat.messages.push({ role: "user", text: "hello" });
  await writeFinanceTables({ query: async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; } }, "synthetic", next, previous);
  assert.equal(calls.length, 2); assert.ok(calls.every(call => call.sql.includes("finbridge_chat_messages")));
});

test("wire snapshot removes only redundant chat images; the canonical receipt and all facts are preserved", async () => {
  const s = workspaceFixture(); const image = "data:image/jpeg;base64," + "A".repeat(2800000); s.transactions[0].image = image;
  s.transactionChat.messages.push({ role: "assistant", text: "Saved", transaction: structuredClone(s.transactions[0]) });
  const normalized = workspaceWireSnapshot(s); assert.equal(normalized.transactions[0].image, image); assert.equal(normalized.transactionChat.messages.at(-1).transaction.image, undefined);
  assert.equal(s.transactionChat.messages.at(-1).transaction.image, image); assert.ok(Buffer.byteLength(JSON.stringify(normalized)) < 4500000);
  let calls = 0, state = structuredClone(s);
  const writer = createWorkspaceWriter({ revision: 0, initial: structuredClone(s), getState: () => state, onStatus: () => {}, save: async input => { calls++; assert.equal(input.data.transactionChat.messages.at(-1).transaction.image, undefined); return { revision: 1, data: input.data, updatedAt: null }; } });
  state.settings.name = "Changed"; await writer.flush(); assert.equal(writer.dirty(), false); assert.equal(calls, 1);
});

test("compressed save round-trips through the actual authenticated handler with a small acknowledgement", async () => {
  const s = workspaceFixture(); s.transactions[0].image = "data:image/jpeg;base64," + "A".repeat(100000); let writes = 0;
  const repo = { read: async () => ({ revision: 1, data: s, updatedAt: null }), save: async (owner, value) => { assert.equal(owner, "owner"); writes++; assert.deepEqual(value.data, s); return { revision: 2, data: value.data, updatedAt: null }; } };
  const result = await workspaceRequest({ revision: 1, mutationId: randomUUID(), data: s }, "owner", async (_, init) => {
    assert.equal(init.headers["content-encoding"], "gzip"); assert.ok(init.body.byteLength < 32000);
    return handleWorkspace(new Request("https://finbridge.invalid/api/workspace", { ...init, headers: { ...init.headers, origin: "https://finbridge.invalid" } }), "owner", "https://finbridge.invalid", repo);
  });
  assert.equal(writes, 1); assert.equal(result.revision, 2); assert.equal(result.data, null);
  const response = await handleWorkspace(new Request("https://finbridge.invalid/api/workspace", { headers: { "x-finbridge-workspace-owner": "owner", "x-finbridge-compression": "gzip" } }), "owner", "https://finbridge.invalid", repo);
  assert.equal(response.headers.get("content-encoding"), "gzip"); assert.match(response.headers.get("server-timing"), /workspace;dur=/);
  assert.deepEqual(JSON.parse(gunzipSync(Buffer.from(await response.arrayBuffer())).toString()).data, s);
});

test("compressed payloads retain origin/owner guards and bound decompression", async () => {
  let writes = 0; const repo = { read: async () => { throw Error("unexpected read"); }, save: async () => { writes++; throw Error("unexpected save"); } };
  const request = (body, headers = {}) => new Request("https://finbridge.invalid/api/workspace", { method: "POST", headers: { origin: "https://finbridge.invalid", "content-type": "application/json", "content-encoding": "gzip", "x-finbridge-workspace-owner": "owner", ...headers }, body });
  assert.equal((await handleWorkspace(request(gzipSync("{}"), { origin: "https://attacker.invalid" }), "owner", "https://finbridge.invalid", repo)).status, 403);
  assert.equal((await handleWorkspace(request(gzipSync("{}"), { "x-finbridge-workspace-owner": "other" }), "owner", "https://finbridge.invalid", repo)).status, 409);
  assert.equal((await handleWorkspace(request(gzipSync("A".repeat(12000001))), "owner", "https://finbridge.invalid", repo)).status, 413);
  assert.equal((await handleWorkspace(request("not gzip"), "owner", "https://finbridge.invalid", repo)).status, 400); assert.equal(writes, 0);
});

test("non-JSON platform errors stay actionable and malformed success never counts as a save", async () => {
  const input = { revision: 0, mutationId: randomUUID(), data: workspaceFixture() };
  await assert.rejects(workspaceRequest(input, "owner", async () => new Response("FUNCTION_PAYLOAD_TOO_LARGE", { status: 413 })), error => error instanceof WorkspaceRequestError && error.status === 413 && definitelyRejectedWorkspace(error));
  await assert.rejects(workspaceRequest(input, "owner", async () => Response.json({})), /INVALID_SAVE_ACK/);
  assert.equal(definitelyRejectedWorkspace(new Error("NETWORK")), false);
});

test("financial analysis does not wait for chat-only writes, but does wait for real money edits", async () => {
  let s = workspaceFixture(), release; const calls = [];
  const writer = createWorkspaceWriter({ revision: 0, initial: structuredClone(s), getState: () => s, onStatus: () => {}, save: async input => { calls.push(input); if (calls.length === 1) await new Promise(resolve => { release = resolve; }); return { revision: input.revision + 1, data: input.data, updatedAt: null }; } });
  s.transactionChat.messages.push({ role: "user", text: "hello" }); const pending = writer.flush();
  await writer.flushFinancial(); assert.equal(calls.length, 1);
  s.wallets[0].initial += 100; const financial = writer.flushFinancial(); assert.equal(financial, pending); release(); await financial;
  assert.equal(calls.length, 2); assert.equal(writer.dirty(), false);
});

const draft = () => ({ id: "new-draft", title: "Lunch", amount: 25, type: "expense", category: "Dining", date: "2026-10-19", wallet: "bank", currency: "USD", needsReview: [] });
test("new transactions are blocked while corrections, questions and confirmation remain available", () => {
  for (const text of ["ăn sáng 25k", "mua áo 350k", "paid lunch 10 USD", "买午餐花了10元"]) assert.equal(shouldBlockNewDraft(text, [draft()]), true, text);
  for (const text of ["sửa số tiền thành 30 USD", "danh mục Dining", "tôi đã chi bao nhiêu?", "nếu mai tôi chi 25k thì sao", "xác nhận", "hủy"]) assert.equal(shouldBlockNewDraft(text, [draft()]), false, text);
  assert.equal(shouldBlockNewDraft("a provider-recognized expense", [draft()], "transaction"), true);
  assert.equal(shouldBlockNewDraft("ăn sáng 25k", []), false);
  for (const lang of ["vi", "en", "zh"]) assert.match(pendingDraftReminder(lang, 2), /2/);
});

test("confirm once/retry/cancel preserve transaction identity and rollback only a definite rejection", () => {
  const before = workspaceFixture(), first = validateAndCommitDrafts(before, [draft()]); assert.deepEqual(first.committed, ["new-draft"]);
  assert.deepEqual(validateAndCommitDrafts(first.state, [draft()]).committed, []); assert.equal(first.state.transactions.filter(t => t.id === "new-draft").length, 1);
  const edited = { ...first.state, settings: { ...first.state.settings, name: "Concurrent setting" }, categories: [...first.state.categories, "Unrelated category"] };
  const rolledBack = rollbackRejectedDrafts(edited, before, ["new-draft"]); assert.deepEqual(rolledBack.transactions, before.transactions); assert.equal(rolledBack.settings.name, "Concurrent setting"); assert.ok(rolledBack.categories.includes("Unrelated category"));
  const drafts = removeDraftById([draft()], "new-draft"); assert.equal(shouldBlockNewDraft("ăn sáng 25k", drafts), false); assert.deepEqual(before.transactions, rolledBack.transactions);
});

test("draft amount precision is identical in demo and production and does not persist orphan categories", () => {
  const s = workspaceFixture(); s.wallets[0].currency = "VND";
  const raw = { ...draft(), amount: 58.622, currency: "VND", category: null, newCategory: { name: "New Medical", type: "expense" } };
  assert.ok(validateDraftForState(raw, s).needsReview.includes("amount")); assert.deepEqual(validateAndCommitDrafts(s, [raw]).committed, []); assert.ok(!validateAndCommitDrafts(s, [raw]).state.categories.includes("New Medical"));
});

test("bounded receipt preparation preserves small originals and aspect ratio of large images", async () => {
  assert.deepEqual(receiptImageDimensions(4000, 6000), { width: 1707, height: 2560 }); assert.deepEqual(receiptImageDimensions(800, 600), { width: 800, height: 600 });
  assert.throws(() => receiptImageDimensions(0, 5));
  const OriginalReader = globalThis.FileReader, OriginalBitmap = globalThis.createImageBitmap, originalDocument = globalThis.document;
  globalThis.FileReader = class { readAsDataURL() { this.result = "data:image/jpeg;base64,ORIGINAL"; this.onload(); } };
  try {
    assert.equal(await prepareReceiptImage(new File(["small"], "small.jpg", { type: "image/jpeg" })), "data:image/jpeg;base64,ORIGINAL");
    let closed = false; globalThis.createImageBitmap = async () => ({ width: 4000, height: 6000, close: () => { closed = true; } });
    globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: () => "data:image/jpeg;base64,ENCODED" }) };
    assert.equal(await prepareReceiptImage(new File([new Uint8Array(2000000)], "large.jpg", { type: "image/jpeg" })), "data:image/jpeg;base64,ENCODED"); assert.equal(closed, true);
  } finally { globalThis.FileReader = OriginalReader; globalThis.createImageBitmap = OriginalBitmap; globalThis.document = originalDocument; }
});

test("unchanged finance tables are untouched; actual monetary edits still write their authoritative table", async () => {
  const before = workspaceFixture(), next = structuredClone(before), calls = [];
  const client = { query: async sql => { calls.push(sql); return { rows: [] }; } };
  await writeFinanceTables(client, "owner", next, before); assert.equal(calls.length, 0);
  next.transactions[0].amount += 1; await writeFinanceTables(client, "owner", next, before);
  assert.equal(calls.length, 2); assert.ok(calls.every(sql => sql.includes("finbridge_transactions")));
});

test("optional undefined fields from SQL hydration do not turn a chat edit into a financial rewrite", async () => {
  const previous = workspaceFixture(); previous.fixedExpenses[0].paymentRecipient = undefined;
  const next = JSON.parse(JSON.stringify(previous)), calls = []; next.transactionChat.messages.push({ role: "user", text: "Hi" });
  await writeFinanceTables({ query: async sql => { calls.push(sql); return { rows: [] }; } }, "owner", next, previous);
  assert.equal(calls.length, 2); assert.ok(calls.every(sql => sql.includes("finbridge_chat_messages")));
});

test("a later rejection cannot erase uncertainty about a previous timed-out commit", async () => {
  let s = workspaceFixture(); const calls = [];
  const writer = createWorkspaceWriter({ revision: 0, initial: structuredClone(s), getState: () => s, onStatus: () => {}, save: async input => {
    calls.push(structuredClone(input)); if (calls.length === 1) throw new Error("NETWORK"); if (calls.length === 2) throw new WorkspaceRequestError("INVALID_WORKSPACE", 400);
    return { revision: input.revision + 1, data: input.data, updatedAt: null };
  } });
  s.settings.name = "Pending"; await assert.rejects(writer.flush()); s.settings.name = "Later";
  await assert.rejects(writer.flush(), error => error.message === "SAVE_OUTCOME_UNKNOWN" && !definitelyRejectedWorkspace(error));
  await writer.flush(); assert.deepEqual(calls[0], calls[1]); assert.deepEqual(calls[1], calls[2]); assert.equal(calls[3].data.settings.name, "Later");
});
