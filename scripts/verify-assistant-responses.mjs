import assert from "node:assert/strict";
import test from "node:test";
import { assistantScenarioSchema, conversationalLead, isDeferredAssistantReply, resolveAssistantScenario } from "../src/lib/assistant-response.ts";
import { scenarioCalculationExplanation } from "../src/lib/scenario-explanation.ts";
import { calculateScenario, findPreviousScenarioFromHistory, scenarioContext } from "../src/lib/scenario-planner.ts";
import { calculateSpendingPlan } from "../src/lib/financial-outlook.ts";
import { scenarioAnswer } from "../src/lib/scenario-answer.ts";
import { answerFinancialQuery } from "../src/lib/financial-chat.ts";
import { modelHistory } from "../src/lib/chat-local-plan.ts";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const state = () => ({ wallets: [{ id: "vnd", name: "Vietinbank", currency: "VND", initial: 10000000, type: "cash" }, { id: "cny", name: "Alipay", currency: "CNY", initial: 10000, type: "cash" }], transactions: [{ id: "food", title: "Ăn uống", amount: 895622, type: "expense", category: "Ăn uống", wallet: "vnd", date: "2026-10-19", note: "" }], goals: [], fixedExpenses: [["internet",239000,"2026-10-17"],["rent",3000000,"2026-10-18"],["parking",147000,"2026-10-20"]].map(([id,amount,dueDate]) => ({ id, title: id, amount, dueDate, walletId: "vnd", budgetId: "", category: "Ăn uống", recurrence: "monthly", active: true, reminderDays: 3 })), categories: ["Ăn uống", "Mua sắm"], categoryMeta: {}, recurring: [], rules: [], settings: { language: "Tiếng Việt" } });
const spec = changes => ({ name: "Dự báo", walletId: "vnd", horizonEnd: "2026-10-31", estimateSpending: true, actions: changes || [] });
const change = (patch = {}) => ({ kind: "change", title: "Giày", amount: 3000000, direction: "expense", percent: null, walletId: "vnd", currency: "VND", category: "Mua sắm", date: "2026-10-20", startDate: null, endDate: null, ...patch });
const input = (s, message = "nếu chi như hiện tại thì còn dư không") => ({ message, today: "2026-10-19", preferredLanguage: "vi", selectedWalletId: "vnd", history: [], context: scenarioContext(s) });

test("baseline and shoe purchase reconcile with the spending plan, including overdue bills exactly once", () => {
  const s = state(), before = structuredClone(s), i = input(s);
  const baseline = resolveAssistantScenario(spec(), i).scenarios[0], purchase = resolveAssistantScenario(spec([change()]), i).scenarios[0];
  const b = calculateScenario(s, baseline, i.today), p = calculateScenario(s, purchase, i.today);
  assert.equal(b.wallets.length, 1); assert.equal(b.wallets[0].balanceNow, 9104378);
  assert.equal(b.plannedBills.reduce((n,bill) => n + bill.amount,0),3386000);
  assert.equal(b.estimatedSpending[0].amount,565656);
  assert.equal(b.wallets[0].projectedBalance,5152722);
  assert.equal(b.wallets[0].projectedBalance,calculateSpendingPlan(s,i.today,{walletIds:["vnd"]}).wallets[0].projected);
  assert.equal(p.wallets[0].projectedBalance,2152722);
  const answer = scenarioAnswer(p,purchase,s.wallets,i.today,"vi",b);
  for(const amount of ["2.152.722 VND","3.386.000 VND","565.656 VND","5.152.722 VND"]) assert.ok(answer.includes(amount),amount);
  assert.doesNotMatch(answer,/đang tính|vui lòng đợi|Số liệu liên quan|Giả định\/giới hạn/);
  assert.deepEqual(s,before);
});

test("paying one bill changes the balance and removes only that occurrence, never deducting it twice", () => {
  const s = state(), i = input(s), sc = resolveAssistantScenario(spec(),i).scenarios[0];
  const before = calculateScenario(s,sc,i.today);
  s.transactions.push({id:"paid",title:"internet",amount:239000,type:"expense",wallet:"vnd",date:i.today,category:"Ăn uống",note:"",fixedExpenseId:"internet",fixedExpenseDueDate:"2026-10-17",paymentConfirmation:"user"});
  const after = calculateScenario(s,sc,i.today);
  assert.equal(after.plannedBills.length,2); assert.equal(after.wallets[0].balanceNow,8865378);
  assert.equal(after.estimatedSpending[0].amount,before.estimatedSpending[0].amount);
  assert.equal(after.wallets[0].projectedBalance,before.wallets[0].projectedBalance);
});

test("baseline follow-up drops hypothetical shoes and recalculates after new actual data", () => {
  const s=state(), i=input(s), purchase=resolveAssistantScenario(spec([change()]),i).scenarios[0];
  const history=modelHistory([{role:"assistant",text:"old computed amount",localOnly:true,scenarios:[purchase]}]);
  assert.doesNotMatch(history[0].text,/old computed amount/);
  assert.equal(findPreviousScenarioFromHistory(history).changes[0].amount,3000000);
  assert.deepEqual(findPreviousScenarioFromHistory(history).walletIds,["vnd"]);
  const baseline=resolveAssistantScenario(spec(),{...i,history}).scenarios[0];
  assert.equal(baseline.changes.length,0); assert.deepEqual(baseline.walletIds,["vnd"]);
  s.transactions.push({id:"new",title:"Cơm",amount:19000,type:"expense",wallet:"vnd",date:i.today,category:"Ăn uống",note:""});
  assert.equal(calculateScenario(s,baseline,i.today).wallets[0].balanceNow,9085378);
});

test("missing history never produces a positive affordability claim and unrelated currencies stay out of scope", () => {
  const s=state();s.transactions=[];
  const i=input(s), sc=resolveAssistantScenario({...spec(),walletId:"cny"},i).scenarios[0], result=calculateScenario(s,sc,i.today);
  assert.equal(result.wallets.length,1); assert.equal(result.wallets[0].currency,"CNY");assert.equal(result.plannedBills.length,0);
  const answer=scenarioAnswer(result,sc,s.wallets,i.today,"vi");
  assert.match(answer,/Chưa ước tính được chi sinh hoạt tiếp theo/i);assert.doesNotMatch(answer,/dự kiến vẫn còn tiền|VND/);
});

test("scenario interpretation validates missing wallets, precision, currency, dates and percentages", () => {
  const s=state(), i=input(s);
  for(const bad of [spec([change({currency:"CNY"})]),spec([change({amount:1.5})]),spec([change({amount:null})]),spec([change({date:"2026-02-30"})]),spec([change({date:"2026-11-02"})]),{...spec(),walletId:"foreign"}]) assert.equal(resolveAssistantScenario(bad,i).intent,"clarification");
  assert.equal(resolveAssistantScenario({...spec(),walletId:null},{...i,selectedWalletId:null}).intent,"clarification");
  assert.equal(assistantScenarioSchema.safeParse(spec([change({kind:"spending_reduction",percent:120})])).success,false);
});

test("inconsistent ledger, future income and early-month sparse history cannot justify an optimistic result", () => {
  const s=state(), i=input(s), sc=resolveAssistantScenario(spec(),i).scenarios[0];
  s.transactions.push({id:"salary",title:"Future",type:"income",amount:999999999,wallet:"vnd",category:"Lương",date:"2026-10-30",note:""});
  assert.equal(calculateScenario(s,sc,i.today).wallets[0].balanceNow,9104378);
  s.transactions.push({...s.transactions[0]});
  const result=calculateScenario(s,sc,i.today);
  assert.match(scenarioAnswer(result,sc,s.wallets,i.today,"en"),/cannot verify this wallet balance/);
  const sparse=state();sparse.transactions[0].date="2026-10-01";
  assert.ok(calculateScenario(sparse,sc,"2026-10-01").unavailableEstimates.length);
});

test("model wording can vary without introducing amounts or a financial verdict", () => {
  const answer="Đến cuối tháng bạn dự kiến còn **100.000 VND**.";
  const first=conversationalLead("Với đôi giày bạn cân nhắc, {{answer}}",answer);
  const second=conversationalLead("Nếu giữ cách chi hiện tại, {{answer}}",answer);
  assert.notEqual(first,second);assert.ok(first.includes("100.000 VND"));assert.ok(second.includes("100.000 VND"));
  for(const unsafe of ["Chắc chắn đủ tiền, {{answer}}", "Bạn còn 999999 VND, {{answer}}", "You can definitely afford it. {{answer}}", "Đã lưu giao dịch. {{answer}}", "{{answer}} {{answer}}", "请等待，{{answer}}", "<script>{{answer}}</script>"]) assert.equal(conversationalLead(unsafe,answer),answer);
});

test("shoe explanation separates unpaid bills, living expenses and the purchase and reconciles its equation", () => {
  const s=state(),i=input(s),sc=resolveAssistantScenario(spec([change()]),i).scenarios[0],result=calculateScenario(s,sc,i.today);
  const w=result.wallets[0],c=w.components;
  assert.equal(w.balanceNow-c.unpaidBills-c.paceSpending-c.dailyLimitSpending-c.hypotheticalExpense+c.hypotheticalIncome-c.reducedCategorySpending,w.projectedBalance);
  assert.equal(c.unpaidBills,3386000);assert.equal(c.hypotheticalExpense,3000000);
  const explanation=scenarioCalculationExplanation(result,sc,s.wallets,i.today,"vi");
  for(const text of ["Hóa đơn chưa trả", "Khoản chi giả định", "Giày", "Chi sinh hoạt dự kiến thêm", "3.386.000 VND", "3.000.000 VND", "2.152.722 VND", "31/10/2026"])assert.ok(explanation.includes(text),text);
  assert.doesNotMatch(explanation,/Điều chỉnh ròng|6,386,000|2026-10-31/);
});

test("budget risk names the affected budget and its shortfall instead of a generic warning", () => {
  const s=state();s.goals=[{id:"living",kind:"budget",title:"Sinh hoạt",amount:7000000,saved:0,currency:"VND",date:"2026-10-01",cycle:"monthly",category:"",wallet:"vnd",direction:"",person:""}];
  s.fixedExpenses=s.fixedExpenses.map(e=>({...e,budgetId:"living"}));
  const i=input(s),sc=resolveAssistantScenario(spec([change()]),i).scenarios[0],result=calculateScenario(s,sc,i.today);
  const answer=scenarioAnswer(result,sc,s.wallets,i.today,"vi");
  assert.match(answer,/Ngân sách \*\*Sinh hoạt\*\*/);assert.doesNotMatch(answer,/ít nhất một ngân sách|Theo các khoản đã biết/);
});

test("presentation adapts to question complexity without changing calculated figures or hiding warnings", () => {
  const s=state(), i=input(s), sc=resolveAssistantScenario(spec(),i).scenarios[0], result=calculateScenario(s,sc,i.today);
  const short=scenarioAnswer(result,sc,s.wallets,i.today,"vi",undefined,{detail:"brief",layout:"conversation"});
  const full=scenarioAnswer(result,sc,s.wallets,i.today,"vi",undefined,{detail:"detailed",layout:"list"});
  assert.ok(full.length>short.length);assert.ok(short.includes("5.152.722 VND"));assert.ok(full.includes("5.152.722 VND"));
  const query={action:"balance",walletId:"vnd",scope:"selected",periodStart:null,periodEnd:null,category:null,searchTerm:null,transactionType:null};
  const casual=answerFinancialQuery(query,s,"vnd",i.today,{detail:"standard",layout:"conversation"});
  const detailed=answerFinancialQuery(query,s,"vnd",i.today,{detail:"detailed",layout:"list"});
  assert.doesNotMatch(casual,/Số liệu liên quan/);assert.match(detailed,/Số liệu liên quan/);
  for(const reply of ["Để tôi kiểm tra lại số dư hiện tại", "Đang tính toán, vui lòng đợi", "Kết quả sẽ có ngay sau đây", "I'm checking your balance. Please wait."]) assert.equal(isDeferredAssistantReply(reply),true);
});

test("actual answer component renders readable metrics and collapsed calculation details without interpreting HTML", () => {
  const module={exports:{}},require=createRequire(import.meta.url);
  const code=ts.transpileModule(readFileSync("src/components/finbridge/workspace/FinancialChatAnswer.tsx","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function("require","module","exports",code)(require,module,module.exports);
  const html=renderToStaticMarkup(React.createElement(module.exports.FinancialChatAnswer,{text:"Dự kiến còn **123.000 VND**\n\n• Hiện có: 200.000 VND\n• Hóa đơn: 77.000 VND",calculationDetails:"200.000 VND − 77.000 VND = 123.000 VND\n<script>alert(1)</script>",calculationLabel:"Xem cách tính"}));
  assert.match(html,/<strong>123.000 VND<\/strong>/);assert.match(html,/<ul>/);assert.match(html,/<details><summary>Xem cách tính<\/summary>/);
  assert.doesNotMatch(html,/<details open|<script>/);assert.match(html,/&lt;script&gt;/);
});

test("balance inputs exclude future income just like the balance itself", () => {
  const s=state();s.transactions.push({id:"later",title:"Salary",amount:999999999,type:"income",wallet:"vnd",date:"2026-10-30",category:"Salary",note:""});
  const query={action:"balance",walletId:"vnd",scope:"selected",periodStart:null,periodEnd:null,category:null,searchTerm:null,transactionType:null};
  const answer=answerFinancialQuery(query,s,"vnd","2026-10-19");
  assert.doesNotMatch(answer,/999,999,999|999\.999\.999/);assert.match(answer,/9,104,378 VND/);
});
