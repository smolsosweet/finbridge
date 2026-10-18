import assert from "node:assert/strict";
import test from "node:test";
import { detectProactiveAlerts, readDismissedAlertIds } from "../src/lib/proactive-alerts.ts";

const base = () => ({
  wallets: [{ id: "usd", name: "Main", currency: "USD", initial: 1_000, type: "cash" }],
  transactions: [],
  goals: [{ id: "food", kind: "budget", title: "Food", amount: 100, saved: 0, currency: "USD", date: "2026-10-01", cycle: "monthly", category: "Food", wallet: "usd", direction: "", person: "" }],
  fixedExpenses: [], recurring: [], rules: [], categories: ["Food"], categoryMeta: { Food: { type: "expense", icon: "🍽️", children: [] } },
  settings: { language: "English" },
});
const expense = (id, amount, date, category = "Food", wallet = "usd") => ({ id, title: id, amount, type: "expense", category, date, wallet, note: "" });

test("flags actual budget overrun once and does not label actual as forecast", () => {
  const state = base();
  state.transactions.push(expense("one", 60, "2026-10-10"), expense("two", 50, "2026-10-12"));
  const alerts = detectProactiveAlerts(state, "2026-10-15");
  assert.equal(alerts.filter((alert) => alert.kind === "budget-exceeded").length, 1);
  assert.equal(alerts[0].projected, false);
  assert.match(alerts[0].figures, /110 USD/);
  assert.deepEqual(alerts, detectProactiveAlerts(state, "2026-10-15"));
});

test("warns on budget risk only with current-cycle expense evidence", () => {
  const empty = detectProactiveAlerts(base(), "2026-10-15");
  assert.equal(empty.some((alert) => alert.kind === "budget-risk"), false);
  const state = base();
  state.transactions.push(expense("food", 90, "2026-10-14"));
  assert.equal(detectProactiveAlerts(state, "2026-10-15").some((alert) => alert.kind === "budget-risk"), true);
});

test("reports upcoming fixed costs by date and suppresses a paid occurrence", () => {
  const state = base();
  state.fixedExpenses.push({ id: "rent", budgetId: "food", title: "Rent", amount: 300, category: "Food", dueDate: "2026-10-17", recurrence: "monthly", active: true, reminderDays: 3 });
  const due = detectProactiveAlerts(state, "2026-10-15").filter((alert) => alert.kind === "fixed-due");
  assert.equal(due.length, 1);
  assert.equal(due[0].when, "2026-10-17");
  state.transactions.push({ ...expense("paid-rent", 295, "2026-10-14"), fixedExpenseId: "rent", fixedExpenseDueDate: "2026-10-17", paymentConfirmation: "user" });
  assert.equal(detectProactiveAlerts(state, "2026-10-15").some((alert) => alert.kind === "fixed-due"), false);
});

test("reports projected shortfall once and keeps each currency separate", () => {
  const state = base();
  state.wallets[0].initial = 100;
  state.fixedExpenses.push(
    { id: "rent", title: "Rent", amount: 80, category: "Housing", dueDate: "2026-10-17", recurrence: "once", active: true, walletId: "usd", reminderDays: 10 },
    { id: "tuition", title: "Tuition", amount: 50, category: "Education", dueDate: "2026-10-18", recurrence: "once", active: true, walletId: "usd", reminderDays: 10 },
  );
  state.wallets.push({ id: "vnd", name: "Cash VND", currency: "VND", initial: 2_000_000, type: "cash" });
  const alerts = detectProactiveAlerts(state, "2026-10-15");
  const shortfall = alerts.filter((alert) => alert.kind === "cash-shortfall");
  assert.equal(shortfall.length, 1);
  assert.match(shortfall[0].figures, /30 USD/);
  assert.equal(alerts.some((alert) => alert.kind === "fixed-due" && alert.walletId === "usd"), false);
  assert.equal(alerts.some((alert) => alert.currency === "VND"), false);
});

test("dismissed alerts stay hidden and dismissed ID parsing is safe", () => {
  const state = base();
  state.transactions.push(expense("one", 101, "2026-10-10"));
  const id = detectProactiveAlerts(state, "2026-10-15")[0].id;
  assert.equal(detectProactiveAlerts(state, "2026-10-15", [id]).some((alert) => alert.id === id), false);
  assert.deepEqual(readDismissedAlertIds("not-json"), []);
  assert.deepEqual(readDismissedAlertIds(JSON.stringify([id, 1, null])), [id]);
});

test("one monthly plan projects separate overdue and upcoming periods, never duplicate dates", () => {
  const state = base(); state.settings.language = "vi"; state.goals = [];
  state.wallets[0] = { ...state.wallets[0], currency: "VND", initial: 200000 };
  state.fixedExpenses = [{ id: "travel", title: "Di Chuyển", amount: 150000, category: "Food", dueDate: "2026-10-16", recurrence: "monthly", intervalMonths: 1, active: true, walletId: "usd" }];
  const alerts = detectProactiveAlerts(state, "2026-10-18");
  const warning = alerts.find(a => a.kind === "cash-shortfall");
  assert.equal(warning.amount, 100000);
  assert.equal(warning.cause.split("\n").length, 2);
  assert.match(warning.cause, /16\/10\/2026.*quá hạn/);
  assert.match(warning.cause, /16\/11\/2026.*sắp đến hạn/);
  state.transactions.push({ ...expense("paid", 150000, "2026-10-18"), fixedExpenseId: "travel", fixedExpenseDueDate: "2026-10-16", paymentConfirmation: "user" });
  const afterPayment = detectProactiveAlerts(state, "2026-10-18").find(a => a.kind === "cash-shortfall");
  assert.equal(afterPayment.cause.split("\n").length, 1);
  assert.doesNotMatch(afterPayment.cause, /16\/10\/2026/);
  assert.match(afterPayment.cause, /16\/11\/2026/);
  state.transactions = []; state.fixedExpenses[0].dueDate = "2026-10-24";
  assert.equal(detectProactiveAlerts(state, "2026-10-18").some(a => a.kind === "cash-shortfall"), false);
});

test("rejects malformed amount evidence instead of producing a budget alert", () => {
  const state = base();
  state.transactions.push(expense("bad", Number.NaN, "2026-10-10"));
  assert.equal(detectProactiveAlerts(state, "2026-10-15").some((alert) => alert.kind.startsWith("budget")), false);
});

test("rejects impossible transaction dates as budget evidence", () => {
  const state = base();
  state.transactions.push(expense("bad-date", 500, "2026-02-31"));
  assert.equal(detectProactiveAlerts(state, "2026-10-15").some((alert) => alert.kind.startsWith("budget")), false);
});
