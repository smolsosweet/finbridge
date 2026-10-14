import assert from "node:assert/strict";
import test from "node:test";
import { calculateScenario, scenarioContext } from "../src/lib/scenario-planner.ts";

const state = () => ({
  wallets: [
    { id: "vnd", name: "Cash", currency: "VND", initial: 2_000_000, type: "cash" },
    { id: "usd", name: "USD", currency: "USD", initial: 100, type: "cash" },
  ],
  transactions: [
    { id: "pay", title: "Tuition", amount: 100_000, type: "expense", category: "Education", date: "2026-10-10", wallet: "vnd", note: "" },
    { id: "income", title: "Salary", amount: 500, type: "income", category: "Salary", date: "2026-10-10", wallet: "usd", note: "" },
    { id: "transfer-in", title: "Transfer", amount: 25, type: "transfer", category: "Transfer", date: "2026-10-11", wallet: "vnd", targetWallet: "usd", note: "" },
  ],
  goals: [
    { id: "budget", kind: "budget", title: "Food budget", amount: 500_000, saved: 0, currency: "VND", date: "2026-10-01", cycle: "monthly", category: "Food", wallet: "vnd", direction: "", person: "" },
  ],
  fixedExpenses: [
    { id: "rent", budgetId: "budget", title: "Rent", amount: 200_000, category: "Food", dueDate: "2026-10-15", recurrence: "once", active: true },
  ],
  categories: ["Food", "Education", "Transport"],
});

const scenario = (overrides = {}) => ({
  id: "scenario-1", name: "Pay 50k food", changes: [{ title: "Lunch", amount: 50_000, direction: "expense", walletId: "vnd", currency: "VND", date: "2026-10-14", category: "Food" }],
  horizonEnd: "2026-10-16", estimateSpending: false, assumptions: [], ...overrides,
});

test("projects balances and budget deterministically without mutating source data", () => {
  const app = state();
  const before = structuredClone(app);
  const result = calculateScenario(app, scenario(), "2026-10-14");
  assert.equal(result.wallets.find((wallet) => wallet.walletId === "vnd").balanceNow, 1_899_975);
  assert.equal(result.wallets.find((wallet) => wallet.walletId === "vnd").projectedBalance, 1_649_975); // 50k lunch + 200k planned rent
  assert.equal(result.budgets[0].actualRemaining, 500_000);
  assert.equal(result.budgets[0].afterScenario, 450_000);
  assert.equal(result.plannedBills.length, 1);
  assert.deepEqual(app, before);
});

test("keeps currencies separate and includes transfer-in in the destination wallet", () => {
  const result = calculateScenario(state(), scenario({ changes: [{ title: "Purchase", amount: 10, direction: "expense", walletId: "usd", currency: "USD", date: "2026-10-14", category: null }], horizonEnd: "2026-10-14" }), "2026-10-14");
  assert.deepEqual(result.wallets.map(({ walletId, currency, projectedBalance }) => ({ walletId, currency, projectedBalance })), [{ walletId: "usd", currency: "USD", projectedBalance: 615 }]);
});

test("limits planner context to the wallet selected by the user", () => {
  const context = scenarioContext(state(), "2026-10-14", "usd");
  assert.equal(context.defaultWalletId, "usd");
  assert.deepEqual(context.wallets.map((wallet) => wallet.id), ["usd"]);
  assert.equal(context.budgets.length, 0);
  assert.deepEqual(context.fixedExpenses, []);
  assert.ok(context.recentTransactions.every((transaction) => transaction.wallet === "usd" || transaction.targetWallet === "usd"));
});

test("refuses to project a change whose stated currency does not match its wallet", () => {
  const result = calculateScenario(state(), scenario({ changes: [{ title: "USD tuition", amount: 10, direction: "expense", walletId: "vnd", currency: "USD", date: "2026-10-14", category: "Education" }], horizonEnd: "2026-10-14" }), "2026-10-14");
  assert.deepEqual(result.wallets, []);
  assert.equal(result.budgets[0].afterScenario, 500_000);
});

test("does not apply future changes without a confirmed wallet, amount or date", () => {
  const result = calculateScenario(state(), scenario({ changes: [{ title: "Unclear", amount: null, direction: "expense", walletId: null, currency: null, date: null, category: null }], horizonEnd: null }), "2026-10-14");
  assert.deepEqual(result.wallets, []);
  assert.equal(result.budgets[0].afterScenario, 500_000);
});

test("only applies expenses to matching category budgets and does not guess unknown categories", () => {
  const result = calculateScenario(state(), scenario({ changes: [{ title: "Unknown category", amount: 75_000, direction: "expense", walletId: "vnd", currency: "VND", date: "2026-10-14", category: null }], horizonEnd: "2026-10-14" }), "2026-10-14");
  assert.equal(result.budgets[0].afterScenario, 500_000);
});

test("uses this month's spending pace for the end-of-period estimate", () => {
  const app = state();
  app.transactions.push(
    { id: "july", title: "Transport", amount: 30_000, type: "expense", category: "Transport", date: "2026-07-20", wallet: "vnd", note: "" },
    { id: "aug", title: "Transport", amount: 60_000, type: "expense", category: "Transport", date: "2026-08-20", wallet: "vnd", note: "" },
  );
  const result = calculateScenario(app, scenario({ horizonEnd: "2026-10-24", estimateSpending: true, changes: [] }), "2026-10-14");
  assert.equal(result.estimatedSpending.length, 1);
  assert.equal(result.estimatedSpending[0].amount, 71_428.57); // 100,000 month-to-date divided by 14 elapsed days, projected for 10 days
  assert.equal(result.estimatedSpending[0].basis, "current-month-pace");
});

test("projects budget use from month-to-date spending plus upcoming fixed costs", () => {
  const app = state();
  app.goals[0].category = "";
  const result = calculateScenario(app, scenario({ changes: [], horizonEnd: "2026-10-31", estimateSpending: true }), "2026-10-14");
  assert.equal(result.budgets[0].plannedAmount, 200_000);
  assert.equal(result.budgets[0].paceAmount, 121_428.57);
  assert.equal(result.budgets[0].projectedSpend, 421_428.57);
  assert.equal(result.budgets[0].projectedRemaining, 78_571.43);
  assert.equal(result.budgets[0].forecastAvailable, true);
  assert.ok(result.budgets[0].dailyFlexibleLimit > 0);
});

test("applies a user-defined daily spending cap to wallet and budget projections", () => {
  const app = state();
  app.goals[0].category = "";
  const result = calculateScenario(app, scenario({
    changes: [], horizonEnd: "2026-10-17", estimateSpending: false,
    dailySpendingLimits: [{ amount: 10_000, walletId: "vnd", currency: "VND", category: null, startDate: "2026-10-15", endDate: "2026-10-17" }],
  }), "2026-10-14");
  assert.equal(result.wallets.find((wallet) => wallet.walletId === "vnd").projectedBalance, 1_669_975); // 3 days × 10k plus planned rent
  assert.equal(result.budgets[0].paceAmount, 30_000);
  assert.equal(result.budgets[0].projectedSpend, 330_000); // 100k recorded + 200k rent + daily cap
  assert.equal(result.budgets[0].projectedRemaining, 170_000);
  assert.equal(result.confidence, "user-defined");
  assert.equal(result.includesPaceForecast, true);
});

test("calculates a category spending reduction from the previous three complete months", () => {
  const app = state();
  app.fixedExpenses = [];
  app.goals[0].category = "Dining";
  app.transactions.push(
    { id: "july-dining", title: "Dining", amount: 30_000, type: "expense", category: "Dining", date: "2026-07-20", wallet: "vnd", note: "" },
    { id: "aug-dining", title: "Dining", amount: 60_000, type: "expense", category: "Dining", date: "2026-08-20", wallet: "vnd", note: "" },
    { id: "sep-dining", title: "Dining", amount: 90_000, type: "expense", category: "Dining", date: "2026-09-20", wallet: "vnd", note: "" },
  );
  const result = calculateScenario(app, scenario({
    changes: [], horizonEnd: "2026-10-31", estimateSpending: false,
    spendingReductions: [{ category: "Dining", percent: 20, walletId: "vnd", currency: "VND", startDate: "2026-10-14", endDate: "2026-10-31" }],
  }), "2026-10-14");
  assert.equal(result.savings[0].baselineAmount, 35_217.39);
  assert.equal(result.savings[0].savedAmount, 7_043.48);
  assert.equal(result.wallets.find((wallet) => wallet.walletId === "vnd").projectedBalance, 1_691_801.09);
  assert.equal(result.budgets[0].afterScenario, 471_826.09);
  assert.equal(result.confidence, "historical-estimate");
});

test("does not claim percentage savings when category history is sparse", () => {
  const app = state();
  app.fixedExpenses = [];
  app.transactions.push({ id: "one-month", title: "Dining", amount: 30_000, type: "expense", category: "Dining", date: "2026-08-20", wallet: "vnd", note: "" });
  const result = calculateScenario(app, scenario({ changes: [], spendingReductions: [{ category: "Dining", percent: 20, walletId: "vnd", currency: "VND", startDate: "2026-10-14", endDate: "2026-10-31" }] }), "2026-10-14");
  assert.equal(result.savings.length, 0);
  assert.equal(result.unavailableEstimates.length, 1);
});
