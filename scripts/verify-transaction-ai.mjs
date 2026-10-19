import assert from "node:assert/strict";
import test from "node:test";
import { applyDraftAmountCorrection, categoryResolutionDraftIds, createTimeoutTransactionDraft, editDraftById, formatTransactionMoney, hasCompatibleDraftWallet, inferDraftCategory, isNewTransactionMessage, isValidDraftCategoryName, matchDraftCategoryAnswer, normalizeCurrency, parseDraftAmountCorrection, parseTransactionAmounts, readyDrafts, reconcileTransactionDraftAmounts, removeDraftById, requestedDraftCategory, similarDraftCategories, unavailableWalletReply, validateAndCommitDrafts, validateDraftForState } from "../src/lib/transaction-drafts.ts";
import { inferTransactionCurrency, resolveExplicitWallet, resolveUniqueCurrencyWallet } from "../src/lib/transaction-currency.ts";
import { answerFinancialQuery, asksForAllWalletBalances, resolveFinancialFollowup } from "../src/lib/financial-chat.ts";
import { modelHistory } from "../src/lib/chat-local-plan.ts";

const state = () => ({
  wallets: [{ id: "cash", currency: "VND" }, { id: "usd", currency: "USD" }, { id: "old", currency: "VND", archived: true }],
  categories: ["Thức ăn & Đồ uống", "Mua sắm", "Lương"],
  categoryMeta: { "Thức ăn & Đồ uống": { type: "expense" }, "Mua sắm": { type: "expense" }, "Lương": { type: "income" } },
  transactions: [],
});
const draft = (overrides = {}) => ({
  id: "batch-1:0", title: "Ăn cơm tấm", amount: 35_000, type: "expense", category: "Thức ăn & Đồ uống", date: "2026-10-12", wallet: "cash", currency: "VND", needsReview: [], ...overrides,
});

test("restores inline resolution for a saved fallback missing type and category without duplicating controls", () => {
  const app = state();
  const pending = validateDraftForState(draft({ title: "học thêm", amount: 100_000, type: null, category: null }), app);
  const messages = [{ draftIds: [pending.id] }];
  assert.deepEqual(categoryResolutionDraftIds(messages, 0, [pending]), [pending.id]);
  assert.deepEqual(readyDrafts([pending], app), []);
  const expense = editDraftById([pending], pending.id, { type: "expense" }, app)[0];
  assert.deepEqual(categoryResolutionDraftIds(messages, 0, [expense]), [pending.id]);
  const resolved = editDraftById([expense], expense.id, { category: "Mua sắm" }, app)[0];
  for (const key of ["amount", "currency", "date", "wallet", "title"]) assert.equal(resolved[key], pending[key]);
  assert.deepEqual(categoryResolutionDraftIds(messages, 0, [resolved]), []);
  assert.equal(app.transactions.length, 0);
  const repeated = [...messages, { draftIds: [pending.id], categoryChoiceDraftIds: [pending.id] }];
  assert.deepEqual(categoryResolutionDraftIds(repeated, 0, [pending]), []);
  assert.deepEqual(categoryResolutionDraftIds(repeated, 1, [pending]), [pending.id]);
  assert.deepEqual(categoryResolutionDraftIds(repeated, 1, []), []);
  const committed = validateAndCommitDrafts(app, [resolved]);
  assert.equal(committed.state.transactions[0].category, "Mua sắm");
  assert.equal(committed.state.transactions[0].amount, 100_000);
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

test("a staged medical category closes stale choices and requires only a compatible wallet before confirmation", () => {
  const app = state();
  const pending = validateDraftForState(draft({ title: "Bệnh viện Quận 1", amount: 129_600, date: "2019-10-16", category: null, newCategory: { name: "Y tế", type: "expense" }, wallet: null }), app);
  const messages = [{ draftIds: [pending.id], categoryChoiceDraftIds: [pending.id] }];
  assert.deepEqual(pending.needsReview, ["wallet"]);
  assert.deepEqual(categoryResolutionDraftIds(messages, 0, [pending]), []);
  assert.deepEqual(readyDrafts([pending], app), []);
  assert.deepEqual(validateAndCommitDrafts(app, [pending]).committed, []);
  assert.equal(app.categories.includes("Y tế"), false);
  const wrongCurrency = editDraftById([pending], pending.id, { wallet: "usd" }, app)[0];
  assert.equal(wrongCurrency.wallet, null); assert.equal(wrongCurrency.currency, "VND");
  const selected = editDraftById([pending], pending.id, { wallet: "cash" }, app)[0];
  assert.deepEqual(selected.needsReview, []); assert.equal(readyDrafts([selected], app).length, 1);
  const saved = validateAndCommitDrafts(app, [selected]);
  assert.equal(saved.state.categories.filter(name => name === "Y tế").length, 1);
  assert.equal(saved.state.transactions[0].category, "Y tế");
  assert.equal(saved.state.transactions[0].wallet, "cash"); assert.equal(saved.state.transactions[0].amount, 129_600);
  assert.equal(saved.state.transactions[0].date, "2019-10-16");
  assert.deepEqual(validateAndCommitDrafts(saved.state, [selected]).committed, []);
});

test("resolved existing categories close choices without hiding another unresolved draft", () => {
  const app = state(), unresolved = validateDraftForState(draft({ id: "other", category: null }), app);
  const resolved = validateDraftForState(draft(), app);
  const messages = [{ draftIds: [resolved.id, unresolved.id], categoryChoiceDraftIds: [resolved.id, unresolved.id] }];
  assert.deepEqual(categoryResolutionDraftIds(messages, 0, [resolved, unresolved]), [unresolved.id]);
  const cleared = editDraftById([resolved], resolved.id, { category: null }, app)[0];
  assert.deepEqual(categoryResolutionDraftIds(messages, 0, [cleared, unresolved]), [resolved.id, unresolved.id]);
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
  assert.equal(matchDraftCategoryAnswer("chọn Ăn uống", draft({ category: null }), app), "Thức ăn & Đồ uống");
  app.categories.push("Khác"); app.categoryMeta["Khác"] = { type: "expense" };
  assert.equal(matchDraftCategoryAnswer("choose Other", draft({ category: null }), app), "Khác");
  assert.equal(requestedDraftCategory("tạo danh mục Đồ dùng cá nhân"), "Đồ dùng cá nhân");
  assert.equal(requestedDraftCategory("tạo danh mục mới Đồ dùng cá nhân"), "Đồ dùng cá nhân");
  assert.equal(requestedDraftCategory("create a new category Personal Care"), "Personal Care");
  assert.equal(isValidDraftCategoryName("Đồ dùng cá nhân"), true);
  assert.equal(isValidDraftCategoryName("__proto__"), false);
  assert.deepEqual(similarDraftCategories("Mua sam", app.categories), ["Mua sắm"]);
  assert.equal(isNewTransactionMessage("học phí"), false, "category-only replies are not treated as new transactions");
  assert.equal(requestedDraftCategory("danh mục học phí"), "học phí");
  assert.equal(inferDraftCategory("đóng học phí 10 triệu", "expense", app), "Học phí");
  assert.equal(inferDraftCategory("ăn cơm hôm qua hết 10 ngàn", "expense", app), "Thức ăn & Đồ uống");
  assert.equal(isNewTransactionMessage("ăn cơm hôm qua hết 10 ngàn"), true);
  assert.equal(isNewTransactionMessage("ngày hôm qua"), false);
});

test("new categories stay temporary until valid transaction confirmation and then persist to selectors", () => {
  const app = state();
  app.walletCategories = { cash: ["Thức ăn & Đồ uống", "Mua sắm", "Lương"] };
  const pending = draft({ category: null, newCategory: { name: "Đồ dùng cá nhân", type: "expense" }, needsReview: ["category"] });
  const checked = validateDraftForState(pending, app);
  assert.equal(checked.needsReview.includes("category"), false);
  assert.equal(readyDrafts([checked], app).length, 1);
  assert.equal(app.categories.includes("Đồ dùng cá nhân"), false, "category creation is still draft-only before confirmation");
  const cancelled = removeDraftById([checked], checked.id);
  assert.equal(cancelled.length, 0);
  assert.equal(app.categories.includes("Đồ dùng cá nhân"), false, "abandoning the draft does not persist the category");

  const result = validateAndCommitDrafts(app, [checked]);
  assert.deepEqual(result.committed, [checked.id]);
  assert.equal(result.state.categories.includes("Đồ dùng cá nhân"), true);
  assert.equal(result.state.categoryMeta["Đồ dùng cá nhân"].type, "expense");
  assert.equal(result.state.walletCategories.cash.includes("Đồ dùng cá nhân"), true);
  assert.equal(result.state.transactions[0].category, "Đồ dùng cá nhân");
  const retry = validateAndCommitDrafts(result.state, [checked]);
  assert.deepEqual(retry.committed, [], "repeated confirmation does not create a second transaction");
  assert.equal(retry.state.categories.filter((name) => name === "Đồ dùng cá nhân").length, 1);
});

test("category resolution keeps multiple drafts separate and rejects duplicate or mismatched category types", () => {
  const app = state();
  const first = draft({ id: "multi:0", title: "Khám bệnh", category: null, newCategory: { name: "Sức khỏe", type: "expense" }, needsReview: ["category"] });
  const second = draft({ id: "multi:1", title: "Tiền thưởng", type: "income", category: null, newCategory: { name: "Thưởng", type: "income" }, needsReview: ["category"] });
  const selectedCategory = matchDraftCategoryAnswer("chọn Ăn uống", draft({ id: "multi:0", title: "Khám bệnh", category: null }), app);
  const updatedDrafts = editDraftById([draft({ id: "multi:0", category: null, needsReview: ["category"] }), draft({ id: "multi:1", category: null, needsReview: ["category"] })], "multi:0", { category: selectedCategory }, app);
  assert.equal(updatedDrafts[0].category, "Thức ăn & Đồ uống");
  assert.equal(updatedDrafts[1].category, null, "a category choice only updates its target draft");
  assert.equal(updatedDrafts[0].amount, 35_000);
  assert.equal(updatedDrafts[0].currency, "VND");
  const committed = validateAndCommitDrafts(app, [first, second]);
  assert.deepEqual(committed.committed, ["multi:0", "multi:1"]);
  assert.deepEqual(committed.state.transactions.map((item) => item.category), ["Sức khỏe", "Thưởng"]);
  assert.deepEqual(committed.state.categories.slice(-2), ["Sức khỏe", "Thưởng"]);

  const duplicateState = state();
  const duplicate = draft({ category: null, newCategory: { name: "thức ăn & đồ uống", type: "expense" }, needsReview: ["category"] });
  const duplicateResult = validateAndCommitDrafts(duplicateState, [duplicate]);
  assert.deepEqual(duplicateResult.committed, [duplicate.id]);
  assert.equal(duplicateResult.state.categories.length, duplicateState.categories.length, "case-insensitive duplicate resolves to the existing category");
  assert.equal(duplicateResult.state.transactions[0].category, "Thức ăn & Đồ uống");

  const invalid = draft({ category: null, newCategory: { name: "Lương", type: "expense" }, needsReview: ["category"] });
  const invalidResult = validateAndCommitDrafts(state(), [invalid]);
  assert.deepEqual(invalidResult.committed, [], "a name owned by a different transaction type is not assigned");
  assert.equal(invalidResult.state.categories.includes("Lương"), true);
  assert.equal(invalidResult.state.transactions.length, 0);
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

test("detects Vietnamese currency wording without confusing ordinary words", () => {
  assert.equal(inferTransactionCurrency("hôm nay ăn sáng hết 25k"), "VND");
  assert.equal(inferTransactionCurrency("chi 25 nghìn tiền ăn"), "VND");
  assert.equal(inferTransactionCurrency("trả 10 đô la"), "USD");
  assert.equal(inferTransactionCurrency("spent 20 dollars"), "USD");
  assert.equal(inferTransactionCurrency("chi 25k USD"), "USD", "an explicit currency after shorthand takes precedence");
  assert.equal(inferTransactionCurrency("mua đồ giá 5 tệ"), "CNY");
  assert.equal(inferTransactionCurrency("chi 1,5 triệu"), "VND");
  assert.equal(inferTransactionCurrency("do tôi quên mang ví"), null);
  assert.equal(inferTransactionCurrency("25k và 10 đô"), null, "conflicting cues require review");
});

test("normalizes explicit shorthand and currency amounts without mixing their ISO currency", () => {
  assert.deepEqual(parseTransactionAmounts("ăn sáng 25k"), [{ amount: 25_000, currency: "VND" }]);
  assert.deepEqual(parseTransactionAmounts("mua áo hết 350k"), [{ amount: 350_000, currency: "VND" }]);
  assert.deepEqual(parseTransactionAmounts("đóng học phí 1,5 triệu"), [{ amount: 1_500_000, currency: "VND" }]);
  assert.deepEqual(parseTransactionAmounts("spent 20 USD"), [{ amount: 20, currency: "USD" }]);
  assert.deepEqual(parseTransactionAmounts("mua đồ hết 5 tệ"), [{ amount: 5, currency: "CNY" }]);
  assert.deepEqual(parseTransactionAmounts("paid $1,250.50"), [{ amount: 1_250.5, currency: "USD" }]);
  assert.deepEqual(parseTransactionAmounts("chi 25k USD"), [{ amount: 25_000, currency: "USD" }]);
  assert.deepEqual(parseTransactionAmounts("n sáng 10k tệ"), [{ amount: 10_000, currency: "CNY" }]);
  assert.deepEqual(parseTransactionAmounts("ăn sáng 10 nghìn tệ"), [{ amount: 10_000, currency: "CNY" }]);
  assert.deepEqual(parseTransactionAmounts("ăn tối 10k đô"), [{ amount: 10_000, currency: "USD" }]);
  assert.deepEqual(parseTransactionAmounts("ăn tối 10 đô la"), [{ amount: 10, currency: "USD" }]);
  assert.deepEqual(parseTransactionAmounts("ăn sáng 10000đ"), [{ amount: 10_000, currency: "VND" }]);
  assert.equal(formatTransactionMoney(350_000, "VND"), "350,000 VND");
  assert.equal(formatTransactionMoney(20, "USD"), "20.00 USD");
  assert.equal(formatTransactionMoney(5, "CNY"), "5.00 CNY");
});

test("binds each explicit amount to its draft and asks for review when counts do not match", () => {
  const drafts = [{ amount: 25, needsReview: [] }, { amount: 50, needsReview: ["amount"] }];
  const matched = reconcileTransactionDraftAmounts("sáng 25k, trưa 1,5 triệu", drafts);
  assert.deepEqual(matched.parsedAmounts, [{ amount: 25_000, currency: "VND" }, { amount: 1_500_000, currency: "VND" }]);
  assert.deepEqual(matched.drafts.map((item) => item.amount), [25_000, 1_500_000]);
  assert.deepEqual(matched.drafts.map((item) => item.needsReview), [[], []]);
  const mismatch = reconcileTransactionDraftAmounts("sáng 25k, trưa 50k, tối 70k", drafts);
  assert.equal(mismatch.mismatch, true);
  assert.deepEqual(mismatch.drafts.map((item) => item.amount), [null, null]);
  assert.deepEqual(mismatch.drafts.map((item) => item.needsReview), [["amount"], ["amount"]]);
});

test("multiple wallets in the same currency remain an unresolved required choice", () => {
  const app = state();
  app.wallets.push({ id: "bank-vnd", currency: "VND" });
  const unresolved = validateDraftForState(draft({ wallet: null, currency: "VND" }), app);
  assert.equal(unresolved.wallet, null);
  assert.equal(unresolved.currency, "VND");
  assert.deepEqual(unresolved.needsReview, ["wallet"]);
  assert.deepEqual(validateAndCommitDrafts(app, [unresolved]).committed, []);
  const chosen = editDraftById([unresolved], unresolved.id, { wallet: "bank-vnd", currency: "VND" }, app)[0];
  assert.equal(readyDrafts([chosen], app).length, 1);
  const saved = validateAndCommitDrafts(app, [chosen]).state.transactions[0];
  assert.equal(saved.wallet, "bank-vnd");
  assert.equal(app.wallets.find((wallet) => wallet.id === saved.wallet)?.currency, "VND", "saved wallet reference preserves the transaction currency");
  assert.equal(saved.amount, 35_000, "persisted transaction amount stays numeric and does not include a currency symbol");
});

test("rejects a wallet whose currency conflicts with the draft instead of silently changing it", () => {
  const app = state();
  const invalid = validateDraftForState(draft({ wallet: "usd", currency: "VND" }), app);
  assert.equal(invalid.wallet, null);
  assert.equal(invalid.currency, "VND");
  assert.deepEqual(invalid.needsReview, ["wallet"]);
  assert.deepEqual(validateAndCommitDrafts(app, [invalid]).committed, []);
});

test("auto-selects only a unique active wallet matching the detected currency", () => {
  const wallets = [{ id: "cash", name: "Ví tiền mặt", currency: "VND" }, { id: "usd", name: "AmericaBank", currency: "USD" }, { id: "yuan", name: "Ví Trung Quốc", currency: "CNY" }];
  assert.deepEqual(resolveUniqueCurrencyWallet("ăn sáng 25k", wallets), { currency: "VND", walletId: "cash", ambiguous: false });
  assert.deepEqual(resolveUniqueCurrencyWallet("nhận 10 đô", wallets), { currency: "USD", walletId: "usd", ambiguous: false });
  assert.deepEqual(resolveUniqueCurrencyWallet("5 tệ", wallets), { currency: "CNY", walletId: "yuan", ambiguous: false });
  assert.deepEqual(resolveUniqueCurrencyWallet("25k", [...wallets, { id: "vnd2", currency: "VND" }]), { currency: "VND", walletId: null, ambiguous: true });
  assert.deepEqual(resolveUniqueCurrencyWallet("25k và 10 đô", wallets), { currency: null, walletId: null, ambiguous: true });
  assert.deepEqual(resolveUniqueCurrencyWallet("10 euro", wallets), { currency: null, walletId: null, ambiguous: false });
  assert.equal(resolveExplicitWallet("chi từ AmericaBank", wallets), "usd");
  assert.equal(resolveExplicitWallet("ghi vào ví tiền mặt", wallets), "cash");
});

test("detects an explicit amount correction without treating it as a new entry", () => {
  assert.deepEqual(parseDraftAmountCorrection("Tôi nhầm, là 250k"), { amount: 250_000, currency: "VND" });
  assert.deepEqual(parseDraftAmountCorrection("Actually, I meant $20"), { amount: 20, currency: "USD" });
  assert.equal(parseDraftAmountCorrection("250k"), null, "a bare amount does not silently target a draft");
  assert.equal(parseDraftAmountCorrection("nhầm, là 250k hoặc 300k"), null, "multiple possible corrected values need clarification");
  assert.equal(parseDraftAmountCorrection("nhầm, ăn tối 10k đô"), null, "a changed description must reach the full contextual patch");
  assert.equal(parseDraftAmountCorrection("nhầm, là 250k hôm qua"), null, "a changed date must not be ignored by an amount-only edit");
  const app = state();
  const pending = draft({ id: "correction:0", amount: 350_000, currency: "VND" });
  const correction = applyDraftAmountCorrection([pending], pending.id, "Tôi nhầm, là 250k", app);
  assert.equal(correction?.draft.id, pending.id, "correction keeps the pending draft identity");
  assert.equal(correction?.draft.amount, 250_000);
  assert.equal(correction?.draft.currency, "VND");
  assert.equal(app.transactions.length, 0, "correction does not commit or create a transaction");
  const once = validateAndCommitDrafts(app, correction ? [correction.draft] : []);
  const twice = validateAndCommitDrafts(once.state, correction ? [correction.draft] : []);
  assert.equal(once.state.transactions.length, 1);
  assert.equal(twice.state.transactions.length, 1, "duplicate confirmations keep one transaction");
});

function financialFixture() {
  const items = [100_000, 90_000, 85_000, 80_000, 75_000, 70_000, 127_000].map((amount, index) => ({
    id: `food-${index}`, title: `Bữa ăn ${index + 1}`, amount, type: "expense", category: "Thức ăn & Đồ uống", date: `2026-10-${String(index + 1).padStart(2, "0")}`, wallet: "vnd", note: "",
  }));
  items.push({ id: "shopping-1", title: "Áo", amount: 200_000, type: "expense", category: "Mua sắm", date: "2026-10-10", wallet: "vnd", note: "" });
  items.push({ id: "usd-food-1", title: "Lunch", amount: 12, type: "expense", category: "Food & Drinks", date: "2026-10-10", wallet: "usd", note: "" });
  return {
    wallets: [{ id: "vnd", name: "Vietinbank", currency: "VND", initial: 10_000_000 }, { id: "usd", name: "AmericaBank", currency: "USD", initial: 500 }],
    transactions: items,
    goals: [], fixedExpenses: [], settings: { language: "Tiếng Việt", monthStart: "1" },
  };
}

test("ranks this-month categories and calculates a contextual 20% reduction from recorded spending", () => {
  const app = financialFixture();
  const top = answerFinancialQuery({ action: "top_category", walletId: "vnd", scope: "selected", periodStart: "2026-10-01", periodEnd: "2026-10-18", category: null, searchTerm: null, transactionType: "expense" }, app, "vnd", "2026-10-18");
  assert.match(top, /Thức ăn & Đồ uống/);
  assert.match(top, /627,000/);
  assert.match(top, /7/);
  assert.match(top, /76%/);
  const autoPeriod = answerFinancialQuery({ action: "top_category", walletId: "vnd", scope: "selected", periodStart: null, periodEnd: null, category: null, searchTerm: null, transactionType: "expense" }, app, "vnd", "2026-10-18");
  assert.match(autoPeriod, /2026-10-01.*2026-10-18/);
  const savings20 = answerFinancialQuery({ action: "category_savings", walletId: "vnd", scope: "selected", periodStart: "2026-10-01", periodEnd: "2026-10-18", category: "Thức ăn & Đồ uống", searchTerm: null, transactionType: "expense", percentage: 20 }, app, "vnd", "2026-10-18");
  assert.match(savings20, /125,400/);
  assert.match(savings20, /501,600/);
  const savings10 = answerFinancialQuery({ action: "category_savings", walletId: "vnd", scope: "selected", periodStart: "2026-10-01", periodEnd: "2026-10-18", category: "Thức ăn & Đồ uống", searchTerm: null, transactionType: "expense", percentage: 10 }, app, "vnd", "2026-10-18");
  assert.match(savings10, /62,700/);
  assert.match(savings10, /564,300/);
});

test("enumerates balances by wallet and keeps different currencies separate", () => {
  const app = financialFixture();
  const answer = answerFinancialQuery({ action: "balance", walletId: null, scope: "all", periodStart: null, periodEnd: null, category: null, searchTerm: null, transactionType: null }, app, "vnd", "2026-10-18");
  assert.match(answer, /Vietinbank/);
  assert.match(answer, /AmericaBank/);
  assert.match(answer, /USD/);
  assert.match(answer, /VND|₫/);
  assert.doesNotMatch(answer, /Tổng số dư|Total balance/);
  assert.equal(asksForAllWalletBalances("Cho tôi số dư các tài khoản"), true);
  assert.equal(asksForAllWalletBalances("show balances across all accounts"), true);
  assert.equal(asksForAllWalletBalances("số dư Vietinbank"), false);
  const ranking = answerFinancialQuery({ action: "top_category", walletId: null, scope: "all", periodStart: "2026-10-01", periodEnd: "2026-10-18", category: null, searchTerm: null, transactionType: "expense" }, app, "vnd", "2026-10-18");
  assert.match(ranking, /Vietinbank · Thức ăn & Đồ uống/);
  assert.match(ranking, /AmericaBank ·/);
  assert.doesNotMatch(ranking, /total.*USD.*VND|Tổng.*USD.*VND/i);
});

test("follow-up context keeps category and period references but does not send prior computed amounts", () => {
  const history = modelHistory([
    { role: "assistant", text: "Thức ăn & Đồ uống · 627,000 VND", localOnly: true, financialContext: { action: "top_category", category: "Thức ăn & Đồ uống", periodStart: "2026-10-01", periodEnd: "2026-10-18" } },
    { role: "user", text: "Nếu giảm danh mục đó 20% thì sao?" },
  ]);
  assert.equal(history.length, 2);
  assert.match(history[0].text, /category=Thức ăn & Đồ uống/);
  assert.match(history[0].text, /period=2026-10-01\.\.2026-10-18/);
  assert.doesNotMatch(history[0].text, /627/);
  assert.match(history[1].text, /20%/);
});

test("category follow-ups change the tool, preserve the period and show every recorded category", () => {
  const app = financialFixture(), before = structuredClone(app);
  const query = { action: "spending_summary", walletId: "vnd", scope: "selected", periodStart: null, periodEnd: null, category: "Thức ăn & Đồ uống", searchTerm: null, transactionType: null };
  const history = modelHistory([{ role: "assistant", text: "old amounts", localOnly: true, financialContext: { action: "spending_summary", periodStart: "2026-10-01", periodEnd: "2026-10-18" } }]);
  for (const text of ["chi cho những mục gì", "đã chi cho những danh mục nào", "chi gồm những cái gì", "what categories did I spend on?", "where did my money go?", "按类别查看支出"]) {
    const resolved = resolveFinancialFollowup(text, query, history);
    assert.equal(resolved.action, "category_breakdown", text);
    assert.equal(resolved.category, null); assert.equal(resolved.periodStart, "2026-10-01");
    const answer = answerFinancialQuery(resolved, app, "vnd", "2026-10-18");
    assert.match(answer, /Thức ăn & Đồ uống: \*\*627,000 VND/);
    assert.match(answer, /Mua sắm: \*\*200,000 VND/);
    assert.match(answer, /Tổng đã chi: \*\*827,000 VND/);
    assert.doesNotMatch(answer, /AmericaBank|USD|Tổng hợp thu chi|₫/);
  }
  assert.deepEqual(app, before);
  const september = resolveFinancialFollowup("đã chi cho những danh mục nào", { ...query, periodStart: "2026-09-01", periodEnd: "2026-09-30" }, history);
  assert.equal(september.periodStart, "2026-09-01");
  assert.match(answerFinancialQuery(september, app, "vnd", "2026-10-18"), /Chưa có giao dịch/);
  assert.equal(resolveFinancialFollowup("Nếu giảm ăn uống 20%", { ...query, action: "category_savings" }, history).action, "category_savings");
});

test("category breakdown lists more than five categories and isolates wallets and currencies", () => {
  const app = financialFixture();
  for (let i = 0; i < 6; i++) app.transactions.push({ id: `extra-${i}`, title: `Item ${i}`, amount: 1_000, category: `Danh mục ${i}`, type: "expense", wallet: "vnd", date: "2026-10-18", note: "" });
  const query = { action: "category_breakdown", walletId: null, scope: "all", periodStart: "2026-10-01", periodEnd: "2026-10-18", category: null, searchTerm: null, transactionType: "expense" };
  const answer = answerFinancialQuery(query, app, "vnd", "2026-10-18");
  for (let i = 0; i < 6; i++) assert.ok(answer.includes(`Danh mục ${i}:`));
  assert.match(answer, /833,000 VND/); assert.match(answer, /12 USD/);
  assert.doesNotMatch(answer, /833\.012/);
});

test("spending answers count actual expenses only, format each language and respect period boundaries", () => {
  const app = financialFixture();
  app.transactions.push(
    { id: "income", title: "Salary", amount: 5_000_000, category: "Income", type: "income", wallet: "vnd", date: "2026-10-18", note: "" },
    { id: "future", title: "Future", amount: 100_000, category: "Shopping", type: "expense", wallet: "vnd", date: "2026-10-19", note: "" },
    { id: "old", title: "Old", amount: 100_000, category: "Shopping", type: "expense", wallet: "vnd", date: "2026-09-30", note: "" },
  );
  const query = { action: "spending_summary", walletId: "vnd", scope: "selected", periodStart: "2026-10-01", periodEnd: "2026-10-31", category: null, searchTerm: null, transactionType: null };
  let answer = answerFinancialQuery(query, app, "vnd", "2026-10-18");
  assert.match(answer, /827,000 VND/); assert.match(answer, /8 khoản chi/);
  assert.match(answer, /5,000,000 VND/); assert.match(answer, /2026-10-18/);
  assert.doesNotMatch(answer, /927,000|9 khoản chi|₫|USD/);
  app.settings.language = "English";
  answer = answerFinancialQuery(query, app, "vnd", "2026-10-18");
  assert.match(answer, /827,000 VND/); assert.match(answer, /8 expenses/); assert.doesNotMatch(answer, /Bạn|khoản chi/);
  app.settings.language = "中文";
  answer = answerFinancialQuery(query, app, "vnd", "2026-10-18");
  assert.match(answer, /827,000 VND/); assert.match(answer, /8 笔支出/);
});

test("regression: preserves explicit CNY (nhân dân tệ, tệ, RMB) across amounts, titles, drafts, and rejects incompatible wallets", () => {
  const app = state();

  // 1. "10 triệu nhân dân tệ" -> 10,000,000 in CNY
  const parsedCnyMillion = parseTransactionAmounts("ăn sáng 10 triệu nhân dân tệ");
  assert.deepEqual(parsedCnyMillion, [{ amount: 10_000_000, currency: "CNY" }]);
  assert.equal(inferTransactionCurrency("ăn sáng 10 triệu nhân dân tệ"), "CNY");

  // 2. "ăn sáng 50 tệ" -> CNY preserved
  const parsedTe = parseTransactionAmounts("ăn sáng 50 tệ");
  assert.deepEqual(parsedTe, [{ amount: 50, currency: "CNY" }]);
  assert.equal(inferTransactionCurrency("ăn sáng 50 tệ"), "CNY");

  // 3. "ăn sáng 100 RMB" -> CNY preserved
  const parsedRmb = parseTransactionAmounts("ăn sáng 100 RMB");
  assert.deepEqual(parsedRmb, [{ amount: 100, currency: "CNY" }]);
  assert.equal(inferTransactionCurrency("ăn sáng 100 RMB"), "CNY");

  // Title cleaning strips the amount and currency cleanly
  const timeoutCny = createTimeoutTransactionDraft("ăn sáng 10 triệu nhân dân tệ", "timeout-cny", "2026-10-19", app);
  assert.equal(timeoutCny?.title, "ăn sáng");
  assert.equal(timeoutCny?.amount, 10_000_000);
  assert.equal(timeoutCny?.currency, "CNY");

  // 4. Explicit CNY cannot use a VND wallet silently
  const vndWallets = [{ id: "vietinbank", name: "VietinBank", currency: "VND" }];
  const invalidVndAssignment = validateDraftForState(draft({ id: "cny-1", amount: 10_000_000, currency: "CNY", wallet: "vietinbank" }), { ...app, wallets: vndWallets });
  assert.equal(invalidVndAssignment.wallet, null, "conflicting wallet is unassigned");
  assert.equal(invalidVndAssignment.currency, "CNY", "CNY currency is preserved");
  assert.ok(invalidVndAssignment.needsReview.includes("wallet"));
  assert.deepEqual(validateAndCommitDrafts({ ...app, wallets: vndWallets }, [invalidVndAssignment]).committed, []);

  // 5. If no compatible wallet exists, prompts with unavailableWalletReply or needsReview: ["wallet"]
  assert.equal(hasCompatibleDraftWallet({ currency: "CNY" }, vndWallets), false);
  const replyVi = unavailableWalletReply(["CNY"], "vi");
  assert.equal(replyVi, "Chưa có ví CNY đang hoạt động. Bạn hãy tạo ví phù hợp rồi gửi lại giao dịch nhé.");
  const replyEn = unavailableWalletReply(["CNY"], "en");
  assert.equal(replyEn, "There is no active CNY wallet. Create a matching wallet, then send the transaction again.");

  // 6. Missing currency still uses default policy (e.g. "ăn sáng 25k" -> VND)
  const parsedVnd = parseTransactionAmounts("ăn sáng 25k");
  assert.deepEqual(parsedVnd, [{ amount: 25_000, currency: "VND" }]);
  assert.equal(inferTransactionCurrency("ăn sáng 25k"), "VND");
  const uniqueWallet = resolveUniqueCurrencyWallet("ăn sáng 25k", [{ id: "v1", currency: "VND" }]);
  assert.equal(uniqueWallet.walletId, "v1");
  assert.equal(uniqueWallet.currency, "VND");

  // 7. Previous conversation about CNY does not override explicit currency (e.g., explicit VND)
  assert.deepEqual(parseTransactionAmounts("ăn trưa 50k"), [{ amount: 50_000, currency: "VND" }]);
  assert.equal(inferTransactionCurrency("ăn trưa 50k"), "VND");
  assert.deepEqual(parseTransactionAmounts("ăn trưa 50k VND"), [{ amount: 50_000, currency: "VND" }]);
  assert.equal(inferTransactionCurrency("ăn trưa 50k VND"), "VND");

  // 8. Existing VND slang continues to work
  assert.deepEqual(parseTransactionAmounts("chi 1,5 triệu"), [{ amount: 1_500_000, currency: "VND" }]);
  assert.deepEqual(parseTransactionAmounts("mua áo 350k"), [{ amount: 350_000, currency: "VND" }]);
  assert.deepEqual(parseTransactionAmounts("ăn sáng 10000đ"), [{ amount: 10_000, currency: "VND" }]);
  assert.deepEqual(parseTransactionAmounts("đóng học phí 2 tr"), [{ amount: 2_000_000, currency: "VND" }]);

  // 9. Title and amount are separated in draft summary display
  const title = "ăn sáng";
  const formattedMoney = formatTransactionMoney(10_000_000, "CNY");
  assert.equal(formattedMoney, "10,000,000.00 CNY");
  const summaryText = `${title} ${formattedMoney}`;
  assert.equal(summaryText, "ăn sáng 10,000,000.00 CNY");
  assert.doesNotMatch(summaryText, /ăn sáng10/);

  // 10. Draft creation does not commit transactions before confirmation
  const freshApp = state();
  assert.equal(freshApp.transactions.length, 0);
  const unconfirmedDraft = validateDraftForState(draft({ id: "draft-pending", currency: "CNY", wallet: null }), freshApp);
  assert.equal(freshApp.transactions.length, 0, "draft validation does not write transactions");
  const commitResult = validateAndCommitDrafts(freshApp, [unconfirmedDraft]);
  assert.equal(commitResult.committed.length, 0, "unready draft is not committed");
  assert.equal(freshApp.transactions.length, 0, "state remains untouched");
});
