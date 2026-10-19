import assert from "node:assert/strict";
import test from "node:test";
import { availableTransactionFunds, draftFundingIssues, fundingDate, fundingIssueMessage, validateNewExpenseFunding } from "../src/lib/transaction-funding.ts";
import { validateAndCommitDrafts, editDraftById } from "../src/lib/transaction-drafts.ts";
import { definitelyRejectedWorkspace, workspaceSaveErrorMessage, WorkspaceRequestError } from "../src/lib/workspace-payload.ts";

const today = fundingDate({ settings: { timeZone: "Asia/Ho_Chi_Minh" } });
const state = () => ({ wallets: [{ id: "vnd", name: "Vietinbank", initial: 10_000_000, currency: "VND", type: "cash" }, { id: "cny", name: "Alipay", initial: 100, currency: "CNY", type: "cash" }], transactions: [{ id: "spent", title: "Recorded expenses", type: "expense", amount: 930_622, wallet: "vnd", category: "Food", date: today, note: "" }], goals: [], fixedExpenses: [], recurring: [], rules: [], categories: ["Food", "Salary"], categoryMeta: { Food: { type: "expense", icon: "", children: [] }, Salary: { type: "income", icon: "", children: [] } }, settings: { timeZone: "Asia/Ho_Chi_Minh" } });
const draft = (patch = {}) => ({ id: "new", title: "Ăn sáng", amount: 100_000_000, type: "expense", wallet: "vnd", currency: "VND", category: "Food", date: today, needsReview: [], ...patch });
const recorded = d => ({ id: d.id, title: d.title, amount: d.amount, type: d.type, wallet: d.wallet, category: d.category, date: d.date, note: "" });

test("100 million breakfast is blocked with the exact available funds and shortfall, without mutation", () => {
  const s = state(), before = structuredClone(s), d = draft();
  const issue = draftFundingIssues([d], s, today)[0].issue;
  assert.equal(issue.available, 9_069_378); assert.equal(issue.shortfall, 90_930_622);
  assert.match(fundingIssueMessage(issue, "vi"), /90\.930\.622 VND/);
  assert.deepEqual(validateAndCommitDrafts(s, [d]), { state: s, committed: [] }); assert.deepEqual(s, before);
});

test("exact balance can be spent; confirmation retry never subtracts it twice", () => {
  const s = state(), d = draft({ amount: 9_069_378 });
  assert.deepEqual(draftFundingIssues([d], s, today), []);
  const result = validateAndCommitDrafts(s, [d]);
  assert.deepEqual(result.committed, [d.id]); assert.equal(availableTransactionFunds(result.state, "vnd", today), 0);
  assert.deepEqual(validateAndCommitDrafts(result.state, [d]).committed, []);
});

test("funding is cumulative across a batch; an overdrawn batch creates neither transactions nor orphan categories", () => {
  const s = state(), before = structuredClone(s);
  const a = draft({ id: "a", amount: 6_000_000, category: null, newCategory: { name: "New category", type: "expense" } });
  const b = draft({ id: "b", amount: 4_000_000 });
  assert.equal(draftFundingIssues([a, b], s, today)[0].issue.shortfall, 930_622);
  assert.deepEqual(validateAndCommitDrafts(s, [a,b]), { state: s, committed: [] }); assert.deepEqual(s, before);
});

test("editing amount/wallet recomputes funding and preserves category/currency; an actual recorded income unblocks the draft", () => {
  const s = state(), d = draft();
  const edited = editDraftById([d], d.id, { amount: 25_000 }, s)[0];
  assert.deepEqual(draftFundingIssues([edited], s, today), []); assert.equal(edited.category, "Food");
  const cny = editDraftById([d], d.id, { amount: 50, currency: "CNY" }, s)[0];
  assert.equal(cny.wallet, "cny"); assert.deepEqual(draftFundingIssues([cny], s, today), []);
  const income = draft({ id: "income", type: "income", category: "Salary", amount: 100_000_000 });
  assert.ok(draftFundingIssues([income,d], s, today).length, "pending income is not recorded money");
  const paid = validateAndCommitDrafts(s, [income]);
  assert.equal(validateAndCommitDrafts(paid.state, [d]).committed.length, 1);
});

test("same-currency transfer and refunds count once; foreign currency cannot fund the VND wallet", () => {
  const s = state();
  s.wallets.push({ id: "vnd2", initial: 500, currency: "VND", type: "cash", name: "Other" });
  s.transactions.push({ id: "transfer", title: "Transfer", amount: 500, type: "transfer", wallet: "vnd2", targetWallet: "vnd", category: "", date: today, note: "" });
  s.transactions.push({ id: "refund", title: "Refund", amount: 100, type: "income", wallet: "vnd", category: "Salary", date: today, note: "" });
  assert.equal(availableTransactionFunds(s, "vnd", today), 9_069_978);
  s.transactions.push({ ...s.transactions.at(-1), id: "fx", type: "transfer", wallet: "cny", targetWallet: "vnd" });
  assert.equal(availableTransactionFunds(s, "vnd", today), null);
  assert.equal(draftFundingIssues([draft({ amount: 1 })], s, today)[0].issue.kind, "BALANCE_UNAVAILABLE");
});

test("credit limits are never added to a recorded balance, whether present, absent or invalid", () => {
  const s = state(); s.wallets[1] = { ...s.wallets[1], initial: 100, type: "credit", limit: 100 };
  assert.equal(availableTransactionFunds(s, "cny", today), 100);
  assert.deepEqual(draftFundingIssues([draft({ amount: 100, currency: "CNY", wallet: "cny" })], s, today), []);
  assert.equal(draftFundingIssues([draft({ amount: 100.01, currency: "CNY", wallet: "cny" })], s, today)[0].issue.shortfall, .01);
  delete s.wallets[1].limit; assert.equal(availableTransactionFunds(s, "cny", today), 100);
  s.wallets[1].limit = NaN; assert.equal(availableTransactionFunds(s, "cny", today), 100);
  s.wallets[1].initial = -20; s.wallets[1].limit = 100;
  assert.equal(availableTransactionFunds(s, "cny", today), -20);
});

test("reported regression: 9,069,378 VND plus a 10m limit must remain 9,069,378 VND", () => {
  const s = state(); s.wallets[0].type = "credit"; s.wallets[0].limit = 10_000_000;
  const before = structuredClone(s), issue = draftFundingIssues([draft()], s, today)[0].issue;
  assert.equal(issue.available, 9_069_378); assert.equal(issue.shortfall, 90_930_622);
  assert.match(fundingIssueMessage(issue, "vi"), /9\.069\.378 VND/);
  assert.doesNotMatch(fundingIssueMessage(issue, "vi"), /19\.069\.378|hạn mức còn có thể dùng/);
  assert.deepEqual(validateAndCommitDrafts(s, [draft()]).committed, []);
  assert.throws(() => validateNewExpenseFunding(s, { ...s, transactions: [...s.transactions, recorded(draft())] }), /INSUFFICIENT_FUNDS/);
  assert.deepEqual(s, before);
});

test("future income is excluded, invalid/duplicate records block verification, negative funds are not fabricated as zero", () => {
  const s = state(); s.transactions.push({ ...s.transactions[0], id: "future", type: "income", amount: 100_000_000, date: "2999-01-01" });
  assert.equal(availableTransactionFunds(s, "vnd", today), 9_069_378);
  s.transactions.push({ ...s.transactions[0] }); assert.equal(availableTransactionFunds(s, "vnd", today), null);
  const negative = state(); negative.wallets[1].initial = -20;
  assert.equal(draftFundingIssues([draft({ amount: 10, wallet: "cny", currency: "CNY" })], negative, today)[0].issue.shortfall, 30);
  const missing = state(); delete missing.wallets[0].initial;
  assert.equal(draftFundingIssues([draft()], missing, today)[0].issue.kind, "BALANCE_UNAVAILABLE");
});

test("server boundary rejects new overdrawn expenses and cumulative batches, while preserving unchanged legacy history", () => {
  const s = state(), next = { ...s, transactions: [...s.transactions, recorded(draft())] }, before = structuredClone(s);
  assert.throws(() => validateNewExpenseFunding(s, next), /INSUFFICIENT_FUNDS/); assert.deepEqual(s, before);
  const batch = { ...s, transactions: [...s.transactions, recorded(draft({ id: "a", amount: 6_000_000 })), recorded(draft({ id: "b", amount: 4_000_000 }))] };
  assert.throws(() => validateNewExpenseFunding(s, batch), /INSUFFICIENT_FUNDS/);
  const valid = { ...s, transactions: [...s.transactions, recorded(draft({ amount: 25_000 }))] };
  assert.doesNotThrow(() => validateNewExpenseFunding(s, valid));
  assert.doesNotThrow(() => validateNewExpenseFunding(next, { ...next, settings: { ...next.settings, theme: "dark" } }));
  assert.doesNotThrow(() => validateNewExpenseFunding(null, next), "initial historical import remains a separate existing flow");
});

test("server insufficient-funds errors are definite rejections so draft rollback/retry is safe", () => {
  for (const code of ["INSUFFICIENT_FUNDS", "BALANCE_UNAVAILABLE"]) {
    const error = new WorkspaceRequestError(code, 422);
    assert.equal(definitelyRejectedWorkspace(error), true);
    for (const lang of ["vi", "en", "zh"]) assert.doesNotMatch(workspaceSaveErrorMessage(error, lang), /Gemini|API key/);
  }
});

test("business date follows workspace timezone across midnight", () => {
  const instant = new Date("2026-10-19T18:00:00Z");
  assert.equal(fundingDate({ settings: { timeZone: "Asia/Ho_Chi_Minh" } }, instant), "2026-10-20");
  assert.equal(fundingDate({ settings: { timeZone: "UTC" } }, instant), "2026-10-19");
});
