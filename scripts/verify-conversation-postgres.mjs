import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { testPool, syntheticUser, cleanupFinance, workspaceFixture } from "./workspace-fixtures.mjs";
import { workspaceRepository } from "../src/lib/workspace-repository.ts";
import { applyCategoryOperation, prepareCategoryOperation } from "../src/lib/category-operations.ts";

// testPool refuses every database except local finbridge_auth_test.
const pool = await testPool(), owner = await syntheticUser(pool), other = await syntheticUser(pool), repository = workspaceRepository(pool);
after(async () => { await cleanupFinance(pool, [owner, other]); await pool.end(); });
const save = async data => repository.save(owner, { revision: (await repository.read(owner)).revision, mutationId: randomUUID(), data });
const modify = async command => {
  const current = (await repository.read(owner)).data;
  const preview = prepareCategoryOperation(current, command, randomUUID());
  await save(applyCategoryOperation(current, preview));
  return (await repository.read(owner)).data;
};

test("conversation identity and category references survive relational storage without a browser", async () => {
  const data = workspaceFixture();
  data.categories.push("Groceries", "Unused category");
  data.categoryMeta.Groceries = { type: "expense", icon: "", children: [] };
  data.categoryMeta["Unused category"] = { type: "expense", icon: "", children: [] };
  data.transactionChat = { messages: [{ role: "assistant", text: "Synthetic result", financialContext: { action: "transactions", category: "Dining" } }], drafts: [{ id: "pending-expense", title: "Synthetic draft", amount: 10, type: "expense", category: "Dining", date: data.transactions[0].date.slice(0, 10), wallet: "bank", currency: "USD", needsReview: [] }], clarifyingDraftId: "pending-expense", activeDraftId: "pending-expense", referencedCategories: ["Dining"] };
  await save(data);
  await repository.save(other, { revision: 0, mutationId: randomUUID(), data: workspaceFixture() });
  const restored = (await repository.read(owner)).data;
  assert.equal(restored.transactionChat.activeDraftId, "pending-expense");
  assert.deepEqual(restored.transactionChat.referencedCategories, ["Dining"]);
  assert.equal(restored.transactions.length, 1, "pending draft did not create a transaction");
});

test("confirmed rename migrates relational transactions, plans, draft and conversation context together", async () => {
  const next = await modify({ operation: "rename_category", sources: ["Dining"], target: "Meals", type: null });
  assert.equal(next.transactions[0].category, "Meals"); assert.equal(next.transactions[0].amount, 850);
  assert.equal(next.goals[0].category, "Meals"); assert.equal(next.fixedExpenses[0].category, "Meals");
  assert.equal(next.transactionChat.drafts[0].category, "Meals");
  assert.equal(next.transactionChat.messages[0].financialContext.category, "Meals");
  assert.deepEqual(next.transactionChat.referencedCategories, ["Meals"]);
  assert.equal((await repository.read(other)).data.transactions[0].category, "Dining");
});

test("confirmed merge retains one category assignment and never duplicates financial records", async () => {
  const next = await modify({ operation: "merge_categories", sources: ["Meals"], target: "Groceries", type: null });
  assert.equal(next.categories.includes("Meals"), false);
  assert.equal(next.transactions.length, 1); assert.equal(next.transactions[0].category, "Groceries");
  assert.equal(next.walletCategories.bank.filter(n => n === "Groceries").length, 1);
  assert.equal(next.transactionChat.drafts[0].id, "pending-expense");
});

test("deleting categories archives the referenced one and removes only the unused one", async () => {
  const next = await modify({ operation: "delete_category", sources: ["Groceries", "Unused category"], target: null, type: null });
  assert.equal(next.categoryMeta.Groceries.archived, true);
  assert.equal(next.categories.includes("Unused category"), false);
  assert.equal(next.transactions.length, 1); assert.equal(next.transactions[0].amount, 850);
  assert.equal(next.transactions[0].category, "Groceries"); assert.equal(next.goals.length, 1);
  assert.equal(next.walletCategories.bank.includes("Groceries"), false);
});
