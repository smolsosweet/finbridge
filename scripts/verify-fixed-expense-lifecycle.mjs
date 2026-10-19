import assert from "node:assert/strict";
import test from "node:test";
import { fixedExpenseOccurrence, nextExpenseDue, nextScheduledExpenseDue, recordFixedExpensePayment } from "../src/lib/fixed-expense-payments.ts";
import { calculateSpendingPlan } from "../src/lib/financial-outlook.ts";
import { financialCalendarDate } from "../src/lib/financial-calendar.ts";
import { subscribeFinancialDate } from "../src/components/sites/rolly/replica/useFinancialDate.ts";
import { detectProactiveAlerts } from "../src/lib/proactive-alerts.ts";

const expense = (extra = {}) => ({ id: "internet", title: "Internet", amount: 239000, budgetId: "", walletId: "vnd", category: "Utilities", active: true, dueDate: "2026-10-20", recurrence: "monthly", reminderDays: 2, ...extra });
const state = (bill = expense()) => ({ wallets: [{ id: "vnd", name: "Cash", currency: "VND", initial: 10000000, type: "cash" }], transactions: [], fixedExpenses: [bill], goals: [], categories: ["Utilities"], categoryMeta: { Utilities: { type: "expense", children: [], icon: "" } }, settings: { language: "vi", reserveByWallet: '{"vnd":3000000}' }, rules: [], recurring: [] });
const payment = { dueDate: "2026-10-20", paidOn: "2026-10-20", amount: 239000, walletId: "vnd", note: "", transactionId: "payment" };

test("every due date has its own reminder window, due-today and overdue states", () => {
  const e = expense(), s = state(e), before = structuredClone(s);
  for (const [asOf, expected] of [["2026-10-17", "not-due"], ["2026-10-18", "due-soon"], ["2026-10-19", "due-soon"], ["2026-10-20", "due-today"], ["2026-10-21", "overdue"]]) {
    assert.equal(fixedExpenseOccurrence(s, e, e.dueDate, asOf).status, expected);
  }
  assert.equal(fixedExpenseOccurrence(s, e, "2026-11-20", "2026-10-21").status, "not-due");
  assert.equal(fixedExpenseOccurrence(s, e, "2026-10-20", "2026-10-21").status, "overdue");
  assert.notEqual(fixedExpenseOccurrence(s, e, "2026-10-20", "2026-10-21").id, fixedExpenseOccurrence(s, e, "2026-11-20", "2026-10-21").id);
  assert.deepEqual(s, before);
});

test("explicit reminder zero does not become the fallback and does not change stored settings", () => {
  const e = expense({ reminderDays: 0 }), s = state(e);
  assert.equal(fixedExpenseOccurrence(s, e, e.dueDate, "2026-10-19").reminderActive, false);
  assert.equal(fixedExpenseOccurrence(s, e, e.dueDate, "2026-10-20").status, "due-today");
  assert.equal(s.fixedExpenses[0].reminderDays, 0);
});

test("confirmed payment completes only its occurrence, next month starts fresh, and retries do not duplicate", () => {
  const e = expense(), s = state(e), paid = recordFixedExpensePayment(s, e.id, payment, "2026-10-20");
  assert.equal(fixedExpenseOccurrence(paid, e, "2026-10-20", "2026-10-20").status, "paid");
  assert.equal(fixedExpenseOccurrence(paid, e, "2026-11-20", "2026-10-20").status, "not-due");
  assert.equal(nextExpenseDue(paid, e, "2026-10-20"), "2026-11-20");
  assert.equal(recordFixedExpensePayment(paid, e.id, payment, "2026-10-20").transactions.length, 1);
  const p = calculateSpendingPlan(paid, "2026-10-20").wallets[0];
  assert.equal(p.balance, 9761000); assert.equal(p.committed, 0); assert.equal(p.pending.length, 0);
  assert.equal(p.paidPeriods.length, 1); assert.equal(p.paidPeriods[0].nextDue, "2026-11-20");
  const november = calculateSpendingPlan(paid, "2026-11-19").wallets[0];
  assert.equal(november.pending[0].date, "2026-11-20"); assert.equal(november.pending[0].status, "due-soon");
});

test("a future payment or a link for another due date cannot mark this occurrence paid", () => {
  const e = expense(), s = state(e);
  s.transactions = [{ id: "future", title: "Payment", wallet: "vnd", type: "expense", amount: 239000, category: "Utilities", date: "2026-10-21", note: "", fixedExpenseId: e.id, fixedExpenseDueDate: "2026-10-20", paymentConfirmation: "user" }];
  assert.equal(fixedExpenseOccurrence(s, e, "2026-10-20", "2026-10-19").status, "due-soon");
  s.transactions[0].fixedExpenseDueDate = "2026-11-20";
  assert.equal(fixedExpenseOccurrence(s, e, "2026-10-20", "2026-10-22").status, "overdue");
});

test("old unpaid occurrences remain liabilities while new ones keep their own status", () => {
  const s = state();
  const p = calculateSpendingPlan(s, "2026-11-19").wallets[0];
  assert.deepEqual(p.pending.map(b => [b.date, b.status]), [["2026-10-20", "overdue"], ["2026-11-20", "due-soon"]]);
  assert.equal(p.committed, 478000); assert.equal(p.afterBills, 9522000);
});

test("monthly anchors survive short months, leap years, end-of-month and custom intervals", () => {
  assert.equal(nextScheduledExpenseDue(expense({ dueDate: "2026-01-31" }), "2026-01-31"), "2026-02-28");
  assert.equal(nextScheduledExpenseDue(expense({ dueDate: "2026-01-31" }), "2026-02-28"), "2026-03-31");
  assert.equal(nextScheduledExpenseDue(expense({ dueDate: "2024-01-31" }), "2024-01-31"), "2024-02-29");
  assert.equal(nextScheduledExpenseDue(expense({ intervalMonths: 3 }), "2026-10-20"), "2027-01-20");
  assert.equal(nextScheduledExpenseDue(expense({ monthPosition: "end" }), "2026-10-31"), "2026-11-30");
  assert.equal(nextScheduledExpenseDue(expense({ recurrence: "once" }), "2026-10-20"), null);
});

test("read or handled reminders from October do not suppress November's occurrence", () => {
  const e = expense(), s = state(e), paid = recordFixedExpensePayment(s, e.id, payment, "2026-10-20");
  const alerts = detectProactiveAlerts(paid, "2026-11-20", ["fixed-due:internet:2026-10-20"]);
  assert.equal(alerts.filter(a => a.id === "fixed-due:internet:2026-11-20").length, 1);
  assert.match(alerts.find(a => a.kind === "fixed-due").problem, /hôm nay/);
});

test("calendar day follows workspace timezone across midnight and DST, not server-local hours", () => {
  const instant = new Date("2026-10-19T17:00:00Z");
  assert.equal(financialCalendarDate(instant, "Asia/Ho_Chi_Minh"), "2026-10-20");
  assert.equal(financialCalendarDate(instant, "America/Los_Angeles"), "2026-10-19");
  assert.equal(financialCalendarDate(new Date("2026-03-08T07:30:00Z"), "America/New_York"), "2026-03-08");
  assert.equal(financialCalendarDate(instant, "invalid/timezone"), "2026-10-19");
});

test("mounted views share one clock and refresh after midnight, focus and visibility without navigation", () => {
  const saved = { window: globalThis.window, document: globalThis.document, setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval };
  let tick, starts = 0, stops = 0, now = new Date("2026-10-19T16:59:59Z"), first = 0, second = 0;
  const statuses = [], e = expense({ reminderDays: 0 }), s = state(e);
  let offA, offB;
  try {
    globalThis.window = new EventTarget(); globalThis.document = new EventTarget();
    globalThis.setInterval = fn => { tick = fn; starts++; return 1; };
    globalThis.clearInterval = () => { stops++; };
    offA = subscribeFinancialDate(() => { first++; statuses.push(fixedExpenseOccurrence(s, e, e.dueDate, financialCalendarDate(now, "Asia/Ho_Chi_Minh")).status); });
    offB = subscribeFinancialDate(() => second++);
    assert.equal(starts, 1);
    tick(); now = new Date("2026-10-19T17:00:00Z"); tick();
    now = new Date("2026-10-20T17:00:00Z"); window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    assert.deepEqual(statuses, ["not-due", "due-today", "overdue", "overdue"]);
    assert.equal(first, second);
    offA(); offA = null; assert.equal(stops, 0);
    offB(); offB = null; assert.equal(stops, 1);
  } finally {
    offA?.(); offB?.();
    Object.assign(globalThis, saved);
  }
});
