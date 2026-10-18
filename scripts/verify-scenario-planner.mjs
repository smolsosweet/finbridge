import assert from "node:assert/strict";
import test from "node:test";
import { calculateScenario, scenarioContext } from "../src/lib/scenario-planner.ts";
import { answerFinancialQuery } from "../src/lib/financial-chat.ts";
import { weeklyPeriodStatus, weeklySpendingRows } from "../src/components/sites/rolly/replica/planningModel.ts";
import { asksForCalculationExplanation, scenarioCalculationExplanation } from "../src/lib/scenario-explanation.ts";

test("October 18 forecast reconciles 837000 spent, 13 future days and the displayed balance", () => {
  const app = state();
  app.wallets = [{ id: "vnd", name: "Vietinbank", currency: "VND", initial: 10_000_000, type: "cash" }];
  app.transactions = [627_000, 200_000, 10_000].map((amount, i) => ({ id: `actual-${i}`, title: `Recorded ${i}`, amount, type: "expense", category: ["Food", "Shopping", "Medical"][i], wallet: "vnd", date: "2026-10-18", note: "" }));
  app.fixedExpenses = []; app.goals = [];
  const before = structuredClone(app);
  const plan = scenario({ changes: [], estimateSpending: true, horizonEnd: "2026-10-31" });
  const result = calculateScenario(app, plan, "2026-10-18");
  assert.equal(result.wallets[0].balanceNow, 9_163_000);
  assert.equal(result.estimatedSpending[0].dailyAverage, 46_500);
  assert.equal(result.estimatedSpending[0].days, 13);
  assert.equal(result.estimatedSpending[0].amount, 604_500);
  assert.equal(result.wallets[0].projectedBalance, 8_558_500);
  const explanation = scenarioCalculationExplanation(result, plan, app.wallets, "2026-10-18", "vi");
  for (const number of ["9,163,000 VND", "46,500 VND", "604,500 VND", "8,558,500 VND", "13 ngày"]) assert.ok(explanation.includes(number), number);
  assert.doesNotMatch(explanation, /Giả định\/giới hạn|danh mục có tổng chi cao nhất/i);
  assert.deepEqual(app, before);
});

test("calculation follow-up resolves to the preceding result rather than category ranking", () => {
  for (const text of ["bạn tính số tiền đó như nào", "bạn tính số tiền đó như thế nào?", "cách tính", "giải thích phép tính", "how did you calculate that?", "怎么算的"]) assert.equal(asksForCalculationExplanation(text), true, text);
  for (const text of ["danh mục nào nhiều nhất", "nếu mai tôi chi 25k thì sao", "bạn tính tiền ăn tháng trước giúp tôi"]) assert.equal(asksForCalculationExplanation(text), false, text);
});

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
  settings: { language: "English" },
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

test("applies multiple hypothetical income and expense actions from the same unchanged baseline", () => {
  const app = state();
  const before = structuredClone(app);
  const result = calculateScenario(app, scenario({
    name: "Tuition and income",
    changes: [
      { title: "Tuition", amount: 100_000, direction: "expense", walletId: "vnd", currency: "VND", date: "2026-10-15", category: "Education" },
      { title: "Allowance", amount: 250_000, direction: "income", walletId: "vnd", currency: "VND", date: "2026-10-16", category: "Salary" },
    ],
    horizonEnd: "2026-10-16",
  }), "2026-10-14");
  assert.equal(result.wallets.find((wallet) => wallet.walletId === "vnd").projectedBalance, 1_849_975);
  assert.deepEqual(app, before);
});

test("does not count future-dated transactions as actual budget spending", () => {
  const app = state();
  app.transactions.push({ id: "future-food", title: "Future dinner", amount: 75_000, type: "expense", category: "Food", date: "2026-10-15", wallet: "vnd", note: "" });
  const result = calculateScenario(app, scenario({ changes: [], horizonEnd: "2026-10-31" }), "2026-10-14");
  assert.equal(result.budgets[0].actualRemaining, 500_000);
});

test("weekly actuals reconcile to the month-to-date budget and exclude later-dated expenses", () => {
  const app = state();
  const budget = app.goals[0];
  budget.amount = 7_000_000;
  budget.category = "";
  app.transactions = [
    ["w1-a", 50_000, "2026-10-02"], ["w1-b", 60_000, "2026-10-05"],
    ["w2", 70_000, "2026-10-09"], ["fixed", 92_000, "2026-10-12"], ["w3", 20_000, "2026-10-15"],
    ["future", 500_000, "2026-10-21"],
  ].map(([id, amount, date]) => ({ id, title: id, amount, type: "expense", category: id === "fixed" ? "Rent" : "Food", date, wallet: "vnd", note: "", ...(id === "fixed" ? { fixedExpenseId: "rent", fixedExpenseDueDate: "2026-10-12", paymentConfirmation: "user" } : {}) }));
  app.fixedExpenses = [{ id: "rent", budgetId: budget.id, title: "Rent", amount: 92_000, category: "Rent", dueDate: "2026-10-12", recurrence: "once", active: true }];

  const rows = weeklySpendingRows(app, [budget], "2026-10", "2026-10-15", "vnd");
  const actualRows = rows.filter((row) => row.total > 0);
  assert.equal(actualRows.reduce((sum, row) => sum + row.transactionCount, 0), 5);
  assert.equal(rows.reduce((sum, row) => sum + row.total, 0), 292_000);
  assert.equal(rows.reduce((sum, row) => sum + row.fixed, 0), 92_000);
  assert.equal(rows.reduce((sum, row) => sum + row.variable, 0), 200_000);
  assert.equal(rows.find((row) => row.start === "2026-10-15").unspent, 6_708_000);
  assert.equal(rows.at(-1).unspent, 6_708_000);
});

test("labels completed, partial and future weekly periods against the actuals cutoff", () => {
  assert.equal(weeklyPeriodStatus("2026-10-01", "2026-10-07", "2026-10-15"), "complete");
  assert.equal(weeklyPeriodStatus("2026-10-15", "2026-10-21", "2026-10-15"), "partial");
  assert.equal(weeklyPeriodStatus("2026-10-22", "2026-10-28", "2026-10-15"), "future");
  assert.equal(weeklyPeriodStatus("2026-11-01", "2026-11-07", "2026-10-15"), "future");
});

test("keeps currencies separate and includes transfer-in in the destination wallet", () => {
  const result = calculateScenario(state(), scenario({ changes: [{ title: "Purchase", amount: 10, direction: "expense", walletId: "usd", currency: "USD", date: "2026-10-14", category: null }], horizonEnd: "2026-10-14" }), "2026-10-14");
  assert.deepEqual(result.wallets.map(({ walletId, currency, projectedBalance }) => ({ walletId, currency, projectedBalance })), [{ walletId: "usd", currency: "USD", projectedBalance: 615 }]);
});

test("sends wallet and category labels without financial amounts while retaining wallet choices", () => {
  const context = scenarioContext(state());
  assert.deepEqual(context.wallets.map((wallet) => wallet.id), ["vnd", "usd"]);
  assert.deepEqual(Object.keys(context.wallets[0]).sort(), ["currency", "id", "name"]);
  assert.equal(context.budgets[0].amount, undefined);
  assert.equal(context.fixedExpenses[0].amount, undefined);
  assert.equal(context.goals.length, 0);
  assert.equal("recentTransactions" in context, false);
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

test("answers wallet-wide spending queries with deterministic per-currency totals", () => {
  const app = state();
  app.settings = { language: "Tiếng Việt" };
  const answer = answerFinancialQuery({ action: "spending_summary", walletId: null, scope: "all", periodStart: "2026-10-01", periodEnd: "2026-10-14", category: null, searchTerm: null, transactionType: null }, app, "vnd", "2026-10-14");
  assert.match(answer, /VND/);
  assert.match(answer, /USD/);
  assert.match(answer, /100,000 VND/);
  assert.doesNotMatch(answer, /Giả định\/giới hạn/);
  assert.doesNotMatch(answer, /500,100/);
});

test("answers transaction follow-ups using the requested date and category filters", () => {
  const app = state();
  app.settings = { language: "English" };
  const answer = answerFinancialQuery({ action: "transactions", walletId: "vnd", scope: "selected", periodStart: "2026-10-10", periodEnd: "2026-10-10", category: "Education", searchTerm: null, transactionType: "expense" }, app, "vnd", "2026-10-14");
  assert.match(answer, /2026-10-10/);
  assert.match(answer, /Tuition/);
  assert.doesNotMatch(answer, /Salary/);
});

test("budget questions keep limits separate from actual balance and scheduled bills", () => {
  const app = state();
  app.settings = { language: "English" };
  const answer = answerFinancialQuery({ action: "budget_status", walletId: "vnd", scope: "selected", periodStart: null, periodEnd: null, category: null, searchTerm: null, transactionType: null }, app, "vnd", "2026-10-14");
  assert.match(answer, /500,000/);
  assert.match(answer, /Spent 0 VND/);
  assert.match(answer, /200,000/);
  assert.match(answer, /budget limit is not a wallet balance/i);
});

test("reports empty periods without inventing financial data", () => {
  const app = state();
  app.settings = { language: "English" };
  const answer = answerFinancialQuery({ action: "spending_summary", walletId: "vnd", scope: "selected", periodStart: "2026-09-01", periodEnd: "2026-09-30", category: null, searchTerm: null, transactionType: null }, app, "vnd", "2026-10-14");
  assert.match(answer, /no matching transactions/i);
  assert.match(answer, /2026-09-01/);
});
