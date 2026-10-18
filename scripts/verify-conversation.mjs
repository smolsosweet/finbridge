import assert from "node:assert/strict";
import test from "node:test";
import { applyCategoryOperation, prepareCategoryOperation } from "../src/lib/category-operations.ts";
import { draftPatchSchema, isCategoryManagementMessage, isClearlyNewTransaction, localCategoryCommand, resolvePendingDraft } from "../src/lib/conversation-intent.ts";
import { createTimeoutTransactionDraft, editDraftById, matchDraftCategoryAnswer, removeDraftById, resolveDraftCategory, validateAndCommitDrafts } from "../src/lib/transaction-drafts.ts";
import { createWorkspaceWriter } from "../src/lib/workspace-writer.ts";
import { parseWorkspace } from "../src/lib/workspace-model.ts";
import { handleWorkspace } from "../src/lib/workspace-handler.ts";

const state = () => ({
  wallets: [{ id: "vnd", name: "Ví thử nghiệm", currency: "VND", initial: 1_000_000, type: "cash" }],
  categories: ["Chưa được phân loại", "Thức ăn & Đồ uống", "Học phí", "Mua sắm", "ăn uông", "trong danh mục ăn uống luôn", "Lương"],
  categoryMeta: Object.fromEntries(["Chưa được phân loại", "Thức ăn & Đồ uống", "Học phí", "Mua sắm", "ăn uông", "trong danh mục ăn uống luôn", "Lương"].map(name => [name, { type: name === "Lương" ? "income" : "expense", icon: "❓", children: [] }])),
  transactions: [], goals: [], fixedExpenses: [], recurring: [], rules: [], settings: { language: "Tiếng Việt" },
});
const makeDraft = (message, id, app = state()) => ({ ...createTimeoutTransactionDraft(message, id, "2026-10-18", app), id, wallet: "vnd", currency: "VND" });
const command = (operation, sources, target = null, type = null) => ({ operation, sources, target, type });

test("education shorthand produces an expense and only matches a real education category", () => {
  const app = state();
  const draft = makeDraft("học thêm 100k", "education", app);
  assert.equal(draft.type, "expense"); assert.equal(draft.amount, 100_000); assert.equal(draft.category, "Học phí");
  assert.equal(draft.currency, "VND"); assert.equal(app.transactions.length, 0);
  app.categories = app.categories.filter(name => name !== "Học phí");
  assert.equal(makeDraft("đi học thêm 100 nghìn", "other", app).category, null);
});

test("semantic matching reports ambiguity and unknown categories instead of a first-match default", () => {
  const app = state();
  app.categories.push("Giáo dục"); app.categoryMeta["Giáo dục"] = { type: "expense", icon: "📚", children: [] };
  assert.equal(resolveDraftCategory("tutoring 100k", "expense", app).confidence, "ambiguous");
  assert.deepEqual(resolveDraftCategory("đi học thêm", "expense", app).candidates, ["Học phí", "Giáo dục"]);
  assert.equal(resolveDraftCategory("mua phụ kiện chưa rõ", "expense", app).category, null);
  const pending = makeDraft("mua nước 20k", "pending", app);
  assert.equal(matchDraftCategoryAnswer("chọn Ăn uống", pending, app), "ăn uông", "a uniquely normalized explicit name remains selectable");
  assert.equal(matchDraftCategoryAnswer("chọn ăn uông", pending, app), "ăn uông", "explicit exact names remain selectable");
});

test("bread and water are independent food drafts; edit/cancel/confirm use stable IDs", () => {
  const app = state();
  const bread = makeDraft("tôi mua bánh mì 10k", "bread", app), water = makeDraft("tôi mua nước 20k", "water", app);
  assert.equal(bread.category, "Thức ăn & Đồ uống"); assert.equal(water.category, "Thức ăn & Đồ uống");
  let drafts = [bread, water];
  assert.equal(isClearlyNewTransaction("tôi mua nước 20k"), true);
  const edited = editDraftById(drafts, "bread", { amount: 12_000 }, app);
  assert.equal(edited[1].amount, 20_000); assert.equal(edited[0].amount, 12_000);
  assert.deepEqual(removeDraftById(edited, "water").map(d => d.id), ["bread"]);
  const first = validateAndCommitDrafts(app, [edited[0]]), both = validateAndCommitDrafts(first.state, edited);
  assert.deepEqual(both.state.transactions.map(t => [t.id, t.amount, t.category]), [["bread", 12_000, "Thức ăn & Đồ uống"], ["water", 20_000, "Thức ăn & Đồ uống"]]);
  assert.equal(validateAndCommitDrafts(both.state, edited).state.transactions.length, 2);
});

test("clear food labels outrank overlapping typo and conversational names without modifying data", () => {
  const app = state(), before = structuredClone(app);
  for (const message of ["ăn cơm 25k", "tôi mua bánh mì 10k", "tôi mua nước 20k", "uống trà sữa 35k", "breakfast 10 USD", "吃饭25元"]) {
    const match = resolveDraftCategory(message, "expense", app);
    assert.equal(match.category, "Thức ăn & Đồ uống", message);
    assert.equal(match.confidence, "confident", message);
  }
  const meal = makeDraft("ăn cơm 25k", "meal", app);
  assert.equal(meal.amount, 25_000); assert.equal(meal.currency, "VND");
  assert.equal(meal.date, "2026-10-18"); assert.equal(meal.category, "Thức ăn & Đồ uống");
  assert.deepEqual(app, before);
  app.categories.push("Food & Drinks"); app.categoryMeta["Food & Drinks"] = { type: "expense" };
  assert.equal(resolveDraftCategory("ăn cơm 25k", "expense", app).confidence, "ambiguous", "equally strong categories still require a choice");
  app.categoryMeta["Food & Drinks"].archived = true;
  assert.equal(resolveDraftCategory("ăn cơm 25k", "expense", app).category, "Thức ăn & Đồ uống");
  assert.equal(resolveDraftCategory("ăn cơm 25k", "income", app).category, null);
});

test("category deletion routes exact source names and never becomes transaction deletion", () => {
  const app = state(), before = structuredClone(app);
  const message = "xóa 2 danh mục này ❓ ăn uông ❓ trong danh mục ăn uống luôn";
  assert.equal(isCategoryManagementMessage(message), true);
  const resolved = localCategoryCommand(message, app.categories);
  assert.deepEqual(resolved.sources, ["ăn uông", "trong danh mục ăn uống luôn"]);
  const preview = prepareCategoryOperation(app, resolved, "confirm-1");
  assert.equal(preview.status, "pending"); assert.deepEqual(app, before);
  assert.equal(app.categories.length, 7);
  assert.equal(isCategoryManagementMessage("xóa giao dịch trong danh mục Mua sắm"), false);
  assert.equal(localCategoryCommand("xóa 2 danh mục này Mua sắm và tên không có", app.categories), null);
});

test("deleting a referenced category archives it and preserves historical amounts and references", () => {
  const app = state(); app.transactions = [{ id: "t1", title: "old", type: "expense", amount: 50_000, wallet: "vnd", category: "ăn uông", date: "2026-10-17", note: "" }];
  const next = applyCategoryOperation(app, prepareCategoryOperation(app, command("delete_category", ["ăn uông", "trong danh mục ăn uống luôn"]), "c"));
  assert.equal(next.categoryMeta["ăn uông"].archived, true);
  assert.equal(next.categories.includes("trong danh mục ăn uống luôn"), false);
  assert.deepEqual(next.transactions, app.transactions); assert.equal(app.categoryMeta["ăn uông"].archived, undefined);
  parseWorkspace(next);
});

test("rename and merge migrate every reference without changing financial facts", () => {
  const app = state(), draft = makeDraft("học thêm 100k", "pending", app);
  app.transactions = [{ id: "t", title: "course", type: "expense", amount: 100_000, category: "Học phí", date: "2026-10-17", wallet: "vnd", note: "" }];
  app.goals = [{ id: "b", kind: "budget", title: "Study", amount: 500_000, saved: 0, currency: "VND", date: "2026-10-01", cycle: "month", category: "Học phí", wallet: "vnd", direction: "", person: "" }];
  app.fixedExpenses = [{ id: "f", budgetId: "b", title: "Course", category: "Học phí", amount: 100_000, dueDate: "2026-10-20", recurrence: "once", active: true }];
  app.recurring = [{ ...app.transactions[0], id: "r" }];
  app.transactionChat = { messages: [{ role: "assistant", text: "Prior result", transaction: app.transactions[0], financialContext: { action: "transactions", category: "Học phí" } }], drafts: [draft], clarifyingDraftId: draft.id, activeDraftId: draft.id, referencedCategories: ["Học phí"] };
  app.walletCategories = { vnd: [...app.categories] };
  const renamed = applyCategoryOperation(app, prepareCategoryOperation(app, command("rename_category", ["Học phí"], "Giáo dục"), "rename"));
  for (const rows of [renamed.transactions, renamed.goals, renamed.fixedExpenses, renamed.recurring, renamed.transactionChat.drafts]) assert.equal(rows[0].category, "Giáo dục");
  assert.equal(renamed.transactions[0].amount, 100_000); assert.equal(renamed.transactions[0].date, "2026-10-17");
  assert.equal(renamed.walletCategories.vnd.includes("Học phí"), false);
  assert.equal(renamed.transactionChat.messages[0].financialContext.category, "Giáo dục");
  assert.equal(renamed.transactionChat.messages[0].transaction.category, "Giáo dục");
  assert.deepEqual(renamed.transactionChat.referencedCategories, ["Giáo dục"]);
  assert.equal(renamed.transactionChat.activeDraftId, draft.id);
  const merged = applyCategoryOperation(renamed, prepareCategoryOperation(renamed, command("merge_categories", ["Giáo dục"], "Mua sắm"), "merge"));
  assert.equal(merged.transactions[0].category, "Mua sắm"); assert.equal(merged.categories.includes("Giáo dục"), false);
  parseWorkspace(merged);
});

test("category commands reject inaccessible, stale, duplicate, incompatible and cancelled changes", () => {
  const app = state();
  assert.throws(() => prepareCategoryOperation(app, command("delete_category", ["Other account category"]), "x"), /CATEGORY_NOT_AVAILABLE/);
  assert.throws(() => prepareCategoryOperation(app, command("rename_category", ["Học phí"], "Mua sắm"), "x"), /CATEGORY_EXISTS/);
  assert.throws(() => prepareCategoryOperation(app, command("merge_categories", ["Học phí"], "Lương"), "x"), /CATEGORY_TYPE_MISMATCH/);
  const preview = prepareCategoryOperation(app, command("delete_category", ["Học phí"]), "x");
  assert.throws(() => applyCategoryOperation(app, { ...preview, status: "cancelled" }), /COMPLETED/);
  assert.throws(() => applyCategoryOperation(app, { ...preview, status: "confirmed" }), /COMPLETED/);
  const changed = structuredClone(app); changed.categoryMeta["Học phí"].children.push("New class");
  assert.throws(() => applyCategoryOperation(changed, preview), /CATEGORY_STATE_CHANGED/);
});

test("follow-up targeting never silently chooses the last of multiple drafts", () => {
  const app = state(), drafts = [makeDraft("bánh mì 10k", "bread", app), makeDraft("nước uống 20k", "water", app)];
  assert.equal(resolvePendingDraft("tôi nhầm, sửa thành 12k", drafts, null, null), null);
  assert.equal(resolvePendingDraft("tôi nhầm, sửa thành 12k", drafts, "water", null), null, "even an LLM-selected ID needs grounded context for a generic correction");
  assert.equal(resolvePendingDraft("sửa khoản bánh mì thành 12k", drafts, null, null).id, "bread");
  assert.equal(resolvePendingDraft("khoản đó", drafts, null, "water").id, "water");
  assert.equal(resolvePendingDraft("khoản đó", drafts, null, "deleted-id"), null);
  assert.equal(draftPatchSchema.safeParse({ amount: 12_000, id: "other" }).success, false);
});

test("new-entry boundaries handle paraphrases, corrections, scenarios and management separately", () => {
  for (const text of ["học thêm 100k", "tôi mua bánh mì 10k", "thêm một khoản nữa mua nước 20k", "bought bread for 10 USD"]) assert.equal(isClearlyNewTransaction(text), true, text);
  for (const text of ["tôi nhầm, bánh mì chỉ 12k", "nếu tôi mua nước 20k thì còn đủ tiền không?", "xóa danh mục Mua sắm", "chọn học phí"]) assert.equal(isClearlyNewTransaction(text), false, text);
});

test("failed persistence retries the same mutation without reapplying or reporting a saved operation", async () => {
  let current = state(), attempts = 0;
  const statuses = [], payloads = [];
  const writer = createWorkspaceWriter({ revision: 0, initial: current, getState: () => current, onStatus: s => statuses.push(s), save: async payload => {
    payloads.push(structuredClone(payload)); if (++attempts === 1) throw new Error("NETWORK_ERROR"); return { revision: 1, data: payload.data };
  } });
  const operation = prepareCategoryOperation(current, command("create_category", [], "Vật dụng cá nhân", "expense"), "new-category");
  current = applyCategoryOperation(current, operation);
  await assert.rejects(writer.flush()); assert.equal(statuses.at(-1), "error");
  await writer.flush(); assert.equal(statuses.at(-1), "saved");
  assert.equal(payloads[0].mutationId, payloads[1].mutationId);
  assert.equal(current.categories.filter(n => n === "Vật dụng cá nhân").length, 1);
});

test("existing workspace endpoint enforces session, origin and account ownership for category saves", async () => {
  let saves = 0; const repository = { save: async () => { saves++; return {}; } };
  const request = (origin = "https://finbridge.example.invalid", owner = "owner") => new Request("https://finbridge.example.invalid/api/workspace", { method: "POST", headers: { origin, "content-type": "application/json", "x-finbridge-workspace-owner": owner }, body: "{}" });
  assert.equal((await handleWorkspace(request(), null, "https://finbridge.example.invalid", repository)).status, 401);
  assert.equal((await handleWorkspace(request("https://attacker.invalid"), "owner", "https://finbridge.example.invalid", repository)).status, 403);
  assert.equal((await handleWorkspace(request(undefined, "other"), "owner", "https://finbridge.example.invalid", repository)).status, 409);
  assert.equal(saves, 0);
});
