import assert from "node:assert/strict";
import test from "node:test";
import { financialOutlook, budgetPace, trackedBalance, calculateSpendingPlan, resolveSpendingPlanAdjustment } from "../src/lib/financial-outlook.ts";
import { modelHistory } from "../src/lib/chat-local-plan.ts";
import { workspaceSchema } from "../src/lib/workspace-model.ts";

const state = () => ({ wallets: [{ id: "vnd", name: "Cash", currency: "VND", initial: 1000000, type: "cash" }], transactions: [], goals: [], fixedExpenses: [], categories: ["Food"], categoryMeta: { Food: { type: "expense", children: [] } }, settings: {}, recurring: [], rules: [] });
const bill = (id, amount, dueDate, extra = {}) => ({ id, title: id, amount, category: "Food", walletId: "vnd", budgetId: "", dueDate, recurrence: "once", active: true, ...extra });
const tx = (id, amount, date, extra = {}) => ({ id, title: id, amount, date, wallet: "vnd", type: "expense", category: "Food", note: "", ...extra });

test("successive bills deduct cumulatively from the same wallet", () => {
  const s = state(); s.fixedExpenses = [bill("one", 200000, "2026-10-20"), bill("two", 300000, "2026-10-22")];
  assert.deepEqual(financialOutlook(s, "2026-10-19").expenses.map(e => e.after), [800000, 500000]);
});
test("daily budget ceiling reserves unpaid fixed commitments", () => {
  const s = state(), b = { id: "budget", kind: "budget", title: "Monthly", amount: 700000, currency: "VND", date: "2026-10-01", cycle: "monthly", category: "", wallet: "vnd" };
  s.goals = [b]; s.transactions = [tx("food", 100000, "2026-10-19")]; s.fixedExpenses = [bill("rent", 300000, "2026-10-20", { budgetId: b.id })];
  assert.equal(budgetPace(s, b, "2026-10-19").dailyAllowance, 25000);
});
test("duplicate transaction identities do not produce a silently incorrect balance", () => {
  const s = state(); s.transactions = [tx("same", 100000, "2026-10-18"), tx("same", 100000, "2026-10-18")];
  assert.equal(trackedBalance(s, "vnd", "2026-10-19").amount, 900000);
  assert.equal(trackedBalance(s, "vnd", "2026-10-19").complete, false);
});

test("month-end balance, cash capacity and reserve reconcile without treating reserves as spending", () => {
  const s = state(); s.settings.reserveByWallet = JSON.stringify({ vnd: 100000 });
  s.transactions = [tx("food", 190000, "2026-10-19")];
  s.fixedExpenses = [bill("one", 200000, "2026-10-20"), bill("two", 300000, "2026-10-22")];
  const before = structuredClone(s), p = calculateSpendingPlan(s, "2026-10-19"), w = p.wallets[0];
  assert.equal(p.remainingDays, 12); assert.equal(w.balance, 810000);
  assert.deepEqual(w.pending.map(b => [b.before, b.after]), [[810000, 610000], [610000, 310000]]);
  assert.equal(w.spendable, 210000); assert.equal(w.dailyLimit, 17500);
  assert.equal(w.flexibleForecast, 120000); assert.equal(w.projected, 190000); assert.equal(w.projectedAfterReserve, 90000);
  assert.deepEqual(s, before);
});

test("explicit adjusted payment is counted once while other spending in the same category remains in pace", () => {
  const s = state(); s.fixedExpenses = [bill("rent", 200000, "2026-10-20")];
  s.transactions = [tx("paid", 180000, "2026-10-18", { fixedExpenseId: "rent", fixedExpenseDueDate: "2026-10-20", paymentConfirmation: "user" }), tx("other-food", 19000, "2026-10-19")];
  const w = calculateSpendingPlan(s, "2026-10-19").wallets[0];
  assert.equal(w.pending.length, 0); assert.equal(w.balance, 801000); assert.equal(w.sampleSpent, 19000); assert.equal(w.flexibleForecast, 12000); assert.equal(w.projected, 789000);
});

test("matching date and amount without a payment link never marks a bill paid", () => {
  const s = state(); s.fixedExpenses = [bill("bill", 10000, "2026-10-19")]; s.transactions = [tx("unlinked", 10000, "2026-10-19")];
  assert.equal(calculateSpendingPlan(s, "2026-10-19").wallets[0].pending.length, 1);
});

test("future recorded salary is excluded; a future payment link does not clear a current obligation", () => {
  const s = state(); s.fixedExpenses = [bill("bill", 10000, "2026-10-19")];
  s.transactions = [tx("salary", 2000000, "2026-10-21", { type: "income" }), tx("future-paid", 10000, "2026-10-20", { fixedExpenseId: "bill", fixedExpenseDueDate: "2026-10-19", paymentConfirmation: "user" })];
  const w = calculateSpendingPlan(s, "2026-10-19").wallets[0]; assert.equal(w.balance, 1000000); assert.equal(w.pending.length, 1);
});

test("payment from a different same-currency wallet clears the occurrence but charges only that wallet", () => {
  const s = state(); s.wallets.push({ ...s.wallets[0], id: "other" }); s.fixedExpenses = [bill("bill", 10000, "2026-10-20")];
  s.transactions = [tx("paid", 9000, "2026-10-19", { wallet: "other", fixedExpenseId: "bill", fixedExpenseDueDate: "2026-10-20", paymentConfirmation: "user" })];
  const p = calculateSpendingPlan(s, "2026-10-19"); assert.deepEqual(p.wallets.map(w => w.pending.length), [0, 0]); assert.deepEqual(p.wallets.map(w => w.balance), [1000000, 991000]);
});

test("all recurring occurrences and overdue bills through month-end are counted, paused bills excluded", () => {
  const s = state(); s.fixedExpenses = [bill("weekly", 10000, "2026-10-01", { recurrence: "weekly" }), bill("paused", 990000, "2026-10-20", { active: false })];
  const w = calculateSpendingPlan(s, "2026-10-19").wallets[0];
  assert.deepEqual(w.pending.map(b => b.date), ["2026-10-01", "2026-10-08", "2026-10-15", "2026-10-22", "2026-10-29"]); assert.equal(w.committed, 50000); assert.equal(w.pending.filter(b => b.overdue).length, 3);
});

test("missing history and missing reserve are unknown, not invented zero projections", () => {
  const w = calculateSpendingPlan(state(), "2026-10-19").wallets[0];
  assert.equal(w.forecastAvailable, false); assert.equal(w.projected, null); assert.equal(w.reserve, null); assert.equal(w.spendable, null); assert.equal(w.dailyLimit, null); assert.equal(w.afterBills, 1000000);
});

test("date boundaries include today, exclude tomorrow, and handle leap months and year-end", () => {
  const s = state(); s.transactions = [tx("today", 10000, "2024-02-28"), tx("tomorrow", 20000, "2024-02-29")];
  const p = calculateSpendingPlan(s, "2024-02-28"); assert.equal(p.remainingDays, 1); assert.equal(p.end, "2024-02-29"); assert.equal(p.wallets[0].balance, 990000);
  const end = calculateSpendingPlan(s, "2024-02-29"); assert.equal(end.wallets[0].flexibleForecast, 0); assert.equal(end.wallets[0].projected, 970000); assert.equal(end.wallets[0].dailyLimit, null);
  assert.equal(calculateSpendingPlan(state(), "2026-12-31").end, "2026-12-31"); assert.throws(() => calculateSpendingPlan(s, "2026-02-30"), /INVALID_PLAN_DATE/);
});

test("month-to-date forecast sums before rounding rather than losing a minor unit per category", () => {
  const s = state(); s.wallets[0].initial = 10000000;
  s.transactions = [627000, 200000, 10000].map((amount, i) => tx(String(i), amount, "2026-10-18", { category: String(i) }));
  const w = calculateSpendingPlan(s, "2026-10-18").wallets[0]; assert.equal(w.balance, 9163000); assert.equal(w.flexibleForecast, 604500); assert.equal(w.projected, 8558500);
});

test("multi-step percentage and reserve changes preserve context and never mutate the workspace", () => {
  const s = state(); s.transactions = [tx("food", 190000, "2026-10-19")]; const before = structuredClone(s);
  const change = { walletId: "vnd", currency: "VND", category: "Food", percent: 20, reserve: null, reset: false };
  const first = resolveSpendingPlanAdjustment(s, {}, change); const second = resolveSpendingPlanAdjustment(s, first.options, { ...change, category: null, percent: null, reserve: 300000 });
  const w = calculateSpendingPlan(s, "2026-10-19", second.options).wallets[0];
  assert.equal(w.flexibleForecast, 96000); assert.equal(w.savings, 24000); assert.equal(w.reserve, 300000); assert.equal(w.projected, 714000); assert.equal(w.projectedAfterReserve, 414000);
  assert.deepEqual(s, before); assert.equal(resolveSpendingPlanAdjustment(s, second.options, { ...change, currency: "USD" }).missing, "currency");
  assert.deepEqual(resolveSpendingPlanAdjustment(s, second.options, { ...change, reset: true }).options, {});
});

test("multiple wallets require a specific adjustment target; scope survives JSON restoration", () => {
  const s = state(); s.wallets.push({ ...s.wallets[0], id: "second" });
  const a = { walletId: null, currency: null, category: "Food", percent: 20, reserve: null, reset: false };
  assert.equal(resolveSpendingPlanAdjustment(s, {}, a).missing, "wallet");
  const options = JSON.parse(JSON.stringify({ walletIds: ["second"] })); assert.equal(resolveSpendingPlanAdjustment(s, options, a).options.reductions[0].walletId, "second");
});

test("cross-currency transfers never invent destination balances or aggregate wallets", () => {
  const s = state(); s.wallets.push({ id: "usd", name: "USD", currency: "USD", type: "cash", initial: 100 }); s.transactions = [tx("fx", 100000, "2026-10-18", { type: "transfer", targetWallet: "usd" })];
  const p = calculateSpendingPlan(s, "2026-10-19"); assert.equal(p.wallets[0].balance, 900000); assert.equal(p.wallets[1].balance, null); assert.equal(p.wallets[1].projected, null);
});

test("invalid dates, duplicate IDs and inconsistent payment links disable trusted projections", () => {
  for (const transactions of [[tx("x", 1, "2026-02-31")], [tx("x", 1, "2026-10-18"), tx("x", 1, "2026-10-18")], [tx("a", 1, "2026-10-18", { fixedExpenseId: "bill", fixedExpenseDueDate: "2026-10-18", paymentConfirmation: "user" }), tx("b", 1, "2026-10-18", { fixedExpenseId: "bill", fixedExpenseDueDate: "2026-10-18", paymentConfirmation: "user" })]]) {
    const s = state(); s.transactions = transactions; const w = calculateSpendingPlan(s, "2026-10-19").wallets[0]; assert.equal(w.complete, false); assert.equal(w.projected, null); assert.equal(w.balance, null);
  }
});

test("currency minor units and reserve validation support KWD and normal decimal USD", () => {
  const s = state(); s.wallets[0].currency = "KWD"; s.wallets[0].initial = 2.005; s.transactions = [tx("small", 0.001, "2026-10-19")];
  const w = calculateSpendingPlan(s, "2026-10-19", { reserves: { vnd: 0.003 } }).wallets[0]; assert.equal(w.balance, 2.004); assert.equal(w.spendable, 2.001);
  s.wallets[0].currency = "USD"; s.wallets[0].initial = 2; s.transactions = [];
  assert.equal(resolveSpendingPlanAdjustment(s, {}, { walletId: null, currency: "USD", category: null, percent: null, reserve: 0.29, reset: false }).missing, null);
});

test("plan history retains assumptions only and never sends derived balances to AI", () => {
  const history = modelHistory([{ role: "assistant", text: "SECRET derived balance 999999", localOnly: true, spendingPlan: { reserves: { vnd: 100000 } } }]);
  assert.equal(history.length, 1); assert.match(history[0].text, /100000/); assert.doesNotMatch(history[0].text, /SECRET|999999/);
});

test("historical fallback needs two active months; one sparse month does not imply zero spending", () => {
  const s = state(); s.transactions = [tx("aug", 92000, "2026-08-10"), tx("sep", 92000, "2026-09-10")];
  const w = calculateSpendingPlan(s, "2026-10-19").wallets[0]; assert.equal(w.basis, "previous-three-months"); assert.equal(w.sampleDays, 92); assert.equal(w.flexibleForecast, 24000);
  s.transactions.pop(); assert.equal(calculateSpendingPlan(s, "2026-10-19").wallets[0].projected, null);
});

test("insufficient category history leaves a changed forecast unknown rather than claiming savings", () => {
  const s = state(); s.transactions = [tx("food", 190000, "2026-10-19")]; s.categories.push("Shopping");
  const w = calculateSpendingPlan(s, "2026-10-19", { reductions: [{ walletId: "vnd", category: "Shopping", percent: 20 }] }).wallets[0];
  assert.equal(w.projected, null); assert.equal(w.savings, null); assert.ok(w.issues.includes("missing-category-history")); assert.equal(w.balance, 810000);
});

test("a cash shortfall clamps the daily ceiling to zero but keeps the deficit visible", () => {
  const s = state(); s.fixedExpenses = [bill("expensive", 1100000, "2026-10-20")];
  const w = calculateSpendingPlan(s, "2026-10-19", { reserves: { vnd: 100000 } }).wallets[0];
  assert.equal(w.afterBills, -100000); assert.equal(w.spendable, -200000); assert.equal(w.dailyLimit, 0);
});

test("overlapping budgets remain separate limits and never add cash to a wallet", () => {
  const s = state(); s.settings.reserveByWallet = '{"vnd":0}';
  s.goals = ["a", "b"].map(id => ({ id, kind: "budget", title: id, amount: 700000, currency: "VND", date: "2026-10-01", cycle: "monthly", category: "Food", wallet: "vnd" }));
  const w = calculateSpendingPlan(s, "2026-10-19").wallets[0]; assert.equal(w.balance, 1000000); assert.equal(w.spendable, 1000000); assert.equal(w.budgets.length, 2); assert.deepEqual(w.budgets.map(b => b.afterBills), [700000, 700000]);
});

test("budget pace forecasts do not extrapolate a paid fixed bill as daily flexible spending", () => {
  const s = state(), b = { id: "b", kind: "budget", title: "All", amount: 1000000, currency: "VND", date: "2026-10-01", cycle: "monthly", category: "", wallet: "vnd" };
  s.goals = [b]; s.transactions = [tx("paid", 300000, "2026-10-19", { fixedExpenseId: "rent", fixedExpenseDueDate: "2026-10-19", paymentConfirmation: "user" }), tx("food", 190000, "2026-10-19")];
  assert.equal(budgetPace(s, b, "2026-10-19").projected, 610000);
});

test("plan assumptions round-trip through the existing conversation storage without a second data store", () => {
  const s = state(); s.categoryMeta.Food.icon = "🍽️";
  s.transactionChat = { messages: [{ role: "assistant", text: "", localOnly: true, spendingPlan: { walletIds: ["vnd"], reserves: { vnd: 100000 }, reductions: [{ walletId: "vnd", category: "Food", percent: 20 }] } }], drafts: [], clarifyingDraftId: null };
  const restored = workspaceSchema.parse(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(restored.transactionChat.messages[0].spendingPlan, s.transactionChat.messages[0].spendingPlan);
  assert.deepEqual(restored.wallets, s.wallets); assert.deepEqual(restored.transactions, []);
});
