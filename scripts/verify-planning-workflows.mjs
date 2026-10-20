import assert from "node:assert/strict";
import { test } from "node:test";
import { workspaceFixture } from "./workspace-fixtures.mjs";
import { budgetSummary, plannedOccurrences, weeklySpendingRows, validBudget } from "../src/components/finbridge/workspace/planningModel.ts";
import { recordFixedExpensePayment, nextExpenseDue, unpaidOccurrences, validateFixedPaymentChanges } from "../src/lib/fixed-expense-payments.ts";
import { validatePlanningChanges } from "../src/lib/planning-validation.ts";
import { detectProactiveAlerts } from "../src/lib/proactive-alerts.ts";
import { financialOutlook, trackedBalance } from "../src/lib/financial-outlook.ts";

const today = new Date().toISOString().slice(0, 10);
const pay = (state, amount = 45, walletId = "bank") => recordFixedExpensePayment(state, "rent", { dueDate: today, paidOn: today, amount, walletId, note: "Synthetic", transactionId: "payment" }, today);

test("available budget deducts actual spending and only unpaid commitments", () => {
  const state = workspaceFixture(), budget = state.goals[0];
  let summary = budgetSummary(state, budget, today);
  assert.equal(summary.unpaidPlanned, 50); assert.equal(summary.afterCommitments, 100);
  const paid = pay(state); summary = budgetSummary(paid, budget, today);
  assert.equal(summary.actual, 895); assert.equal(summary.unpaidPlanned, 0); assert.equal(summary.afterCommitments, 105);
  assert.equal(summary.planned, 50, "the original scheduled allocation remains available for existing consumers");
  const tight = { ...budget, amount: 880 };
  assert.equal(budgetSummary(state, tight, today).afterCommitments, -20, "show a deficit before recording payment");
});
test("equal amount and nearby date never count as payment without explicit confirmation", () => {
  const state = workspaceFixture(); state.transactions = [{ ...state.transactions[0], amount: 50 }];
  assert.deepEqual(unpaidOccurrences(state, state.fixedExpenses[0], today, today), [today]);
  assert.equal(weeklySpendingRows(state, state.goals, today.slice(0,7), today).reduce((sum,r)=>sum+r.fixed,0),0);
  const alerts = detectProactiveAlerts(state, today);
  assert.ok(alerts.some(a => a.kind === "fixed-due"));
});
test("payment from another wallet in the same currency clears the bill without charging its source twice", () => {
  const state = workspaceFixture(); state.wallets.push({ ...state.wallets[0], id: "second" });
  const paid = pay(state, 45, "second");
  validatePlanningChanges(state, paid); validateFixedPaymentChanges(state, paid);
  assert.equal(budgetSummary(paid, state.goals[0], today).actual, 850);
  assert.equal(budgetSummary(paid, state.goals[0], today).unpaidPlanned, 0);
  assert.equal(trackedBalance(paid, "second", today).amount, 1955);
  assert.ok(!detectProactiveAlerts(paid,today).some(a=>a.kind === "fixed-due" && a.targetId === "rent"));
});
test("overdue bills remain visible across month boundaries", () => {
  const state = workspaceFixture(); state.goals = []; state.transactions = [];
  state.fixedExpenses[0] = { ...state.fixedExpenses[0], budgetId: "", walletId: "bank", dueDate: "2026-01-31" };
  assert.equal(nextExpenseDue(state,state.fixedExpenses[0],"2026-03-05"),"2026-01-31");
  assert.equal(financialOutlook(state,"2026-03-05").expenses[0].daysUntil,-33);
  assert.ok(detectProactiveAlerts(state,"2026-03-05").some(a=>a.kind==="fixed-due"&&a.when==="2026-01-31"));
});
test("long weekly payment histories do not hide the next occurrence after 400 rows", () => {
  const state = workspaceFixture(); state.goals = []; state.transactions = [];
  const bill = { ...state.fixedExpenses[0], budgetId:"",walletId:"bank",dueDate:"2015-01-01",recurrence:"weekly" };
  const dates = plannedOccurrences(bill,bill.dueDate,"2026-12-31");
  state.transactions = dates.map((due,i)=>({id:String(i),title:"Synthetic",amount:50,type:"expense",category:"Dining",wallet:"bank",date:due,note:"",fixedExpenseId:bill.id,fixedExpenseDueDate:due,paymentConfirmation:"user"}));
  const next = nextExpenseDue(state,bill,"2026-10-16"); assert.ok(next > dates.at(-1));
});
test("planning and balances retain three-decimal currency precision", () => {
  const state = workspaceFixture(); state.wallets[0].currency="KWD"; state.wallets[0].initial=2.005;
  state.transactions=[{...state.transactions[0],amount:0.001}]; state.goals[0]={...state.goals[0],currency:"KWD",amount:1.005}; state.fixedExpenses[0].amount=0.003;
  const summary=budgetSummary(state,state.goals[0],today); assert.equal(summary.actual,0.001); assert.equal(summary.afterCommitments,1.001);
  assert.equal(trackedBalance(state,"bank",today).amount,2.004);
  assert.equal(validBudget(state,{...state.goals[0],amount:0.0001}),false);
});
test("server rejects forged plans, category mismatches, currency reinterpretation and invalid precision", () => {
  const state=workspaceFixture();
  for(const edit of [s=>s.goals[0].amount=0,s=>s.goals[0].amount=-1,s=>s.goals[0].amount=1.001,s=>s.goals[0].cycle="arbitrary",s=>s.goals[0].currency="CNY",s=>s.fixedExpenses[0].category="Salary",s=>s.fixedExpenses[0].amount=1.001,s=>s.wallets[0].currency="CNY",s=>s.transactions[0].amount=0]) {
    const changed=structuredClone(state);edit(changed); assert.throws(()=>validatePlanningChanges(state,changed),/INVALID_PLANNING_CHANGE/);
  }
  const standalone=structuredClone(state);standalone.goals=[];standalone.fixedExpenses[0].budgetId="";standalone.fixedExpenses[0].walletId="bank";
  validatePlanningChanges(state,standalone);
});
test("server rejects new payment links to paused bills, archived wallets and wrong categories", () => {
  const state=workspaceFixture();const paid=pay(state);
  for(const edit of [s=>s.fixedExpenses[0].active=false,s=>s.wallets[0].archived=true,s=>s.transactions.at(-1).category="Salary"]) {
    const changed=structuredClone(paid);edit(changed);assert.throws(()=>validateFixedPaymentChanges(state,changed),/INVALID_BILL_PAYMENT/);
  }
});
test("alerts follow EN, VI and ZH language selections and wait three days before pace forecasts", () => {
  const state=workspaceFixture();state.goals[0].amount=800;
  for(const [language,pattern] of [["English",/is over its limit/],["Tiếng Việt",/đã vượt hạn mức/],["中文",/已超出限额/]]) {
    state.settings.language=language; assert.match(detectProactiveAlerts(state,today).find(a=>a.kind==="budget-exceeded").problem,pattern);
  }
  state.goals[0].amount=1000;state.goals[0].date=today;
  assert.ok(!detectProactiveAlerts(state,today).some(a=>a.kind==="budget-risk"));
});
