import assert from "node:assert/strict";
import test from "node:test";
import { createTimeoutTransactionDraft, editDraftById, inferDraftCategory, isNewTransactionMessage, matchDraftCategoryAnswer, readyDrafts, removeDraftById, requestedDraftCategory, validateAndCommitDrafts, validateDraftForState } from "../src/lib/transaction-drafts.ts";

const state = () => ({
  wallets: [{ id: "cash", currency: "VND" }, { id: "usd", currency: "USD" }, { id: "old", currency: "VND", archived: true }],
  categories: ["Thức ăn & Đồ uống", "Mua sắm", "Lương"],
  categoryMeta: { "Thức ăn & Đồ uống": { type: "expense" }, "Mua sắm": { type: "expense" }, "Lương": { type: "income" } },
  transactions: [],
});
const draft = (overrides = {}) => ({
  id: "batch-1:0", title: "Ăn cơm tấm", amount: 35_000, type: "expense", category: "Thức ăn & Đồ uống", date: "2026-10-12", wallet: "cash", currency: "VND", needsReview: [], ...overrides,
});

test("validates multiple normalized VND drafts and relative-date result before commit", () => {
  const app = state();
  const drafts = [draft(), draft({ id: "batch-1:1", title: "Trà sữa", amount: 45_000, date: "2026-10-13" })];
  const checked = drafts.map((item) => validateDraftForState(item, app));
  assert.equal(checked[0].amount, 35_000); // 35k is represented as 35,000 by the parser.
  assert.equal(checked[1].date, "2026-10-13");
  assert.equal(app.transactions.length, 0, "reviewing drafts must not mutate persisted state");
  const result = validateAndCommitDrafts(app, checked);
  assert.deepEqual(result.committed, ["batch-1:0", "batch-1:1"]);
  assert.equal(result.state.transactions.length, 2);
  assert.equal(result.state.transactions[1].amount, 45_000);
});

test("allows approving one draft, then all remaining valid drafts", () => {
  const app = state();
  const drafts = [draft(), draft({ id: "batch-2:1", title: "Lương tháng", amount: 8_000_000, type: "income", category: "Lương" })];
  const first = validateAndCommitDrafts(app, [drafts[0]]);
  const rest = validateAndCommitDrafts(first.state, drafts);
  assert.deepEqual(first.committed, ["batch-1:0"]);
  assert.deepEqual(rest.committed, ["batch-2:1"]);
  assert.equal(rest.state.transactions.length, 2);
});

test("marks missing or invalid values for review, including archived wallets and invalid dates", () => {
  const checked = validateDraftForState(draft({ amount: null, category: "Fake", date: "2026-02-30", wallet: "old" }), state());
  assert.equal(checked.amount, null);
  assert.equal(checked.category, null);
  assert.equal(checked.date, null);
  assert.equal(checked.wallet, null);
  assert.deepEqual(new Set(checked.needsReview), new Set(["amount", "category", "date", "wallet"]));
  assert.deepEqual(validateAndCommitDrafts(state(), [checked]).committed, []);
});

test("confirmation is idempotent for a stable draft ID", () => {
  const once = validateAndCommitDrafts(state(), [draft()]);
  const twice = validateAndCommitDrafts(once.state, [draft()]);
  assert.deepEqual(twice.committed, []);
  assert.equal(twice.state.transactions.length, 1);
});

test("removing or editing a draft stays local until an explicit commit", () => {
  const app = state();
  const visible = removeDraftById([draft(), draft({ id: "batch-3:1", title: "Bữa trưa", amount: 50_000 })], "batch-1:0");
  const edited = editDraftById(visible, "batch-3:1", { title: "Ăn trưa", amount: 55_000 }, app);
  assert.equal(app.transactions.length, 0);
  assert.equal(edited.length, 1);
  assert.equal(edited[0].title, "Ăn trưa");
  assert.equal(edited[0].amount, 55_000);
  assert.deepEqual(readyDrafts(edited, app).map((item) => item.id), ["batch-3:1"]);
});

test("clarifications match categories and a new transaction is not attached to the old draft", () => {
  const app = state();
  app.categories.push("Học phí");
  app.categoryMeta["Học phí"] = { type: "expense" };
  const pending = draft({ category: null, needsReview: ["category"] });
  assert.equal(matchDraftCategoryAnswer("danh mục học phí", pending, app), "Học phí");
  assert.equal(isNewTransactionMessage("học phí"), false, "category-only replies are not treated as new transactions");
  assert.equal(requestedDraftCategory("danh mục học phí"), "học phí");
  assert.equal(inferDraftCategory("đóng học phí 10 triệu", "expense", app), "Học phí");
  assert.equal(inferDraftCategory("ăn cơm hôm qua hết 10 ngàn", "expense", app), "Thức ăn & Đồ uống");
  assert.equal(isNewTransactionMessage("ăn cơm hôm qua hết 10 ngàn"), true);
  assert.equal(isNewTransactionMessage("ngày hôm qua"), false);
});

test("timeout fallback drafts preserve explicit amount and date, and request missing category and wallet", () => {
  const app = state();
  const health = createTimeoutTransactionDraft("hôm qua khám bệnh hết 100k", "timeout-batch", "2026-10-13", app);
  assert.equal(health?.amount, 100_000);
  assert.equal(health?.type, "expense");
  assert.equal(health?.date, "2026-10-12");
  assert.equal(health?.category, null, "unknown categories are never invented");
  assert.deepEqual(new Set(health?.needsReview), new Set(["wallet", "category"]));

  const transport = createTimeoutTransactionDraft("đi xe bus hết 25k", "timeout-batch-2", "2026-10-13", app);
  assert.equal(transport?.amount, 25_000);
  assert.equal(transport?.title, "đi xe bus");
  assert.equal(transport?.category, null);
  assert.equal(createTimeoutTransactionDraft("hôm qua ăn trưa", "timeout-batch-3", "2026-10-13", app), null, "fallback requires a stated amount");
});
