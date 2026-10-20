import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { assistantScenarioSchema, resolveAssistantScenario } from "../src/lib/assistant-response.ts";
import { calculateScenario, scenarioContext, findPreviousScenarioFromHistory } from "../src/lib/scenario-planner.ts";
import { scenarioAnswer } from "../src/lib/scenario-answer.ts";
import { scenarioCalculationExplanation } from "../src/lib/scenario-explanation.ts";
import { modelHistory } from "../src/lib/chat-local-plan.ts";
import { emptyWorkspaceAction, inspectWorkspaceProposal, applyWorkspaceProposal } from "../src/lib/workspace-actions.ts";
import { prepareCategoryOperation, applyCategoryOperation } from "../src/lib/category-operations.ts";
import { findTransactionsForDeletion } from "../src/lib/transaction-deletion.ts";

const today="2026-10-19";
const state=()=>({wallets:[{id:"cny",name:"Alipay",currency:"CNY",initial:10000,type:"cash"},{id:"vnd",name:"Vietinbank",currency:"VND",initial:10000000,type:"cash"}],categories:["Ăn uống","Ăn vặt","Mua sắm"],categoryMeta:Object.fromEntries(["Ăn uống","Ăn vặt","Mua sắm"].map(n=>[n,{type:"expense",icon:"❓",children:[]}])),transactions:[{id:"food",type:"expense",title:"Bữa ăn",amount:600,currency:"CNY",wallet:"cny",category:"Ăn uống",date:"2026-10-01",note:""}],goals:[],fixedExpenses:[{id:"rent",title:"Tiền nhà",budgetId:"",walletId:"cny",amount:1000,category:"Nhà",dueDate:"2026-10-20",recurrence:"once",active:true}],recurring:[],rules:[],settings:{language:"Tiếng Việt",reserveByWallet:'{"cny":2000}'}});
const action=(patch={})=>({kind:"change",title:"Điện thoại",amount:3000,direction:"expense",percent:null,walletId:"cny",currency:"CNY",category:"Mua sắm",date:"2026-10-20",startDate:null,endDate:null,...patch});
const spec=(patch={})=>({name:"Cân nhắc mua điện thoại",walletId:"cny",horizonEnd:"2026-10-31",estimateSpending:true,actions:[action()],...patch});
const input=(s,message="Nếu mua điện thoại 3000 tệ thì cuối tháng còn đủ tiền sinh hoạt không?")=>({today,message,preferredLanguage:"vi",selectedWalletId:"vnd",context:scenarioContext(s),history:[]});
const calculate=(s,request=spec())=>{const normalized=resolveAssistantScenario(assistantScenarioSchema.parse(request),input(s));assert.equal(normalized.intent,"scenario");const scenario=normalized.scenarios[0];return {scenario,result:calculateScenario(s,scenario,today)};};

test("phone affordability includes actual balance, unpaid bills, future pace and reserve without double deduction",()=>{
  const s=state(),before=structuredClone(s),{scenario,result}=calculate(s);
  assert.equal(result.wallets.length,1);const w=result.wallets[0];
  assert.equal(w.currency,"CNY");assert.equal(w.balanceNow,9400);assert.equal(w.components.unpaidBills,1000);assert.equal(w.components.hypotheticalExpense,3000);assert.equal(w.components.paceSpending,378.95);
  assert.equal(w.projectedBalance,5021.05);assert.equal(w.protectedReserve,2000);assert.equal(w.availableAfterReserve,3021.05);
  const answer=scenarioAnswer(result,scenario,s.wallets,today,"vi");assert.match(answer,/5\.021,05 CNY/);assert.match(answer,/3\.021,05 CNY/);assert.doesNotMatch(answer,/VND|đang tính|đợi/);
  assert.match(scenarioCalculationExplanation(result,scenario,s.wallets,today,"vi"),/Không trừ như một khoản thanh toán/);assert.deepEqual(s,before);
});

test("reserve overrides change available cash only, zero is explicit and unset reserve is not invented",()=>{
  const s=state(),normal=calculate(s),changed=calculate(s,spec({reserveAmount:6000,reserveCurrency:"CNY"}));
  assert.equal(changed.result.wallets[0].projectedBalance,normal.result.wallets[0].projectedBalance);
  assert.equal(changed.result.wallets[0].availableAfterReserve,-978.95);
  assert.match(scenarioAnswer(changed.result,changed.scenario,s.wallets,today,"vi"),/chưa giữ đủ tiền dự phòng/);
  assert.equal(calculate(s,spec({reserveAmount:0,reserveCurrency:"CNY"})).result.wallets[0].protectedReserve,0);
  s.settings.reserveByWallet="{}";assert.equal(calculate(s).result.wallets[0].protectedReserve,null);
  assert.equal(assistantScenarioSchema.safeParse(spec({reserveAmount:-1})).success,false);
  assert.equal(resolveAssistantScenario(spec({reserveAmount:1.001,reserveCurrency:"CNY"}),input(s)).intent,"clarification");
});

test("explicit empty actions override numeric keywords and reserve-only changes cannot become purchases",()=>{
  const s=state(),resolved=resolveAssistantScenario(spec({actions:[],reserveAmount:1000,reserveCurrency:"CNY"}),input(s,"Giữ lại 1000 tệ dự phòng, không mua điện thoại 3000 nữa"));
  assert.equal(resolved.scenarios[0].changes.length,0);
  const result=calculateScenario(s,resolved.scenarios[0],today);assert.equal(result.wallets[0].components.hypotheticalExpense,0);assert.equal(result.wallets[0].projectedBalance,8021.05);assert.equal(result.wallets[0].availableAfterReserve,7021.05);
});

test("missing input retains the complete hypothetical request and asks one essential field",()=>{
  const s=state(),pending=resolveAssistantScenario(spec({actions:[action({amount:null})]}),input(s));
  assert.equal(pending.intent,"clarification");assert.match(pending.clarification,/bao nhiêu tiền/);assert.doesNotMatch(pending.clarification,/loại thu\/chi|phần trăm/);
  const h=modelHistory([{role:"assistant",text:pending.clarification,localOnly:true,pendingScenario:pending.pendingScenario}]);
  assert.equal(h.length,1);assert.match(h[0].text,/Điện thoại|Mua sắm/);assert.match(h[0].text,/Pending financial scenario/);
  const completed=resolveAssistantScenario({...pending.pendingScenario,actions:[{...pending.pendingScenario.actions[0],amount:3000}]},{...input(s,"3000 tệ"),history:h});
  assert.equal(completed.scenarios[0].changes[0].amount,3000);assert.equal(completed.scenarios[0].changes.length,1);
});

test("unique explicit currency can resolve its matching wallet; ambiguous or conflicting currencies ask instead",()=>{
  const s=state();let request=spec({walletId:null,actions:[action({walletId:null})]});
  assert.equal(resolveAssistantScenario(request,input(s)).scenarios[0].walletIds[0],"cny");
  const rmb=resolveAssistantScenario(spec({walletId:null,reserveAmount:2000,reserveCurrency:"RMB",actions:[action({walletId:null,currency:"RMB"})]}),input(s));
  assert.equal(rmb.scenarios[0].changes[0].currency,"CNY");assert.equal(rmb.scenarios[0].reserves.cny,2000);
  s.wallets.push({...s.wallets[0],id:"second"});assert.equal(resolveAssistantScenario(request,input(s)).intent,"clarification");
  assert.equal(resolveAssistantScenario(spec({walletId:"vnd",actions:[action({walletId:null})]}),input(s)).intent,"clarification");
  assert.equal(resolveAssistantScenario(spec({walletId:"foreign"}),input(s)).intent,"clarification");
});

test("forecast comparison renders a real compact table; calculations remain escaped and expandable",()=>{
  const s=state(),{scenario,result}=calculate(s),baseline=calculateScenario(s,{...scenario,changes:[]},today);
  const text=scenarioAnswer(result,scenario,s.wallets,today,"vi",baseline,{detail:"standard",layout:"comparison"});
  const module={exports:{}},require=createRequire(import.meta.url),code=ts.transpileModule(readFileSync("src/components/finbridge/workspace/FinancialChatAnswer.tsx","utf8"),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function("require","module","exports",code)(require,module,module.exports);
  const html=renderToStaticMarkup(React.createElement(module.exports.FinancialChatAnswer,{text,calculationDetails:"<script>unsafe</script>"}));
  assert.match(html,/<table>/);assert.match(html,/<th scope="col">/);assert.match(html,/8\.021,05 CNY/);assert.match(html,/-3\.000 CNY/);assert.match(html,/<details>/);assert.doesNotMatch(html,/<script>|<details open/);
});

test("unknown balance cannot turn partial arithmetic into an invented zero or a positive affordability answer",()=>{
  const s=state();delete s.wallets[0].initial;const {scenario,result}=calculate(s);
  assert.equal(result.wallets[0].balanceComplete,false);
  const text=scenarioAnswer(result,scenario,s.wallets,today,"vi");assert.match(text,/chưa xác minh được số dư/);assert.doesNotMatch(text,/9\.400|5\.021|0 CNY|dự kiến còn khoảng/);
  assert.doesNotMatch(scenarioCalculationExplanation(result,scenario,s.wallets,today,"vi"),/= \*\*/);
});

test("management proposals keep context and require explicit application; creation and retry use stable IDs",()=>{
  const s=state(),before=structuredClone(s),wallet={...emptyWorkspaceAction("wallet",randomUUID()),name:"Ví thử",currency:"USD",walletType:"cash",initialBalance:2000};
  const proposal={id:randomUUID(),actions:[wallet],status:"collecting"};
  const inspected=inspectWorkspaceProposal(s,proposal,"vi");assert.equal(inspected.question,null);assert.equal(inspected.proposal.status,"review");assert.deepEqual(s,before);
  const h=modelHistory([{role:"assistant",text:"Xác nhận tạo ví?",workspaceProposal:inspected.proposal,localOnly:true}]);assert.match(h[0].text,/Ví thử/);assert.match(h[0].text,/not authorization/);
  const next=applyWorkspaceProposal(s,inspected.proposal,"vi");assert.equal(next.wallets.length,s.wallets.length+1);assert.equal(applyWorkspaceProposal(next,inspected.proposal,"vi").wallets.length,next.wallets.length);
});

test("category merge proposal preserves monetary facts and context; cancelled actions do not execute",()=>{
  const s=state(),before=structuredClone(s),proposal=prepareCategoryOperation(s,{operation:"merge_categories",sources:["Ăn vặt"],target:"Ăn uống",type:"expense"},randomUUID());
  assert.deepEqual(s,before);const h=modelHistory([{role:"assistant",text:"",categoryOperation:proposal,localOnly:true}]);assert.match(h[0].text,/Ăn vặt/);assert.match(h[0].text,/Ăn uống/);
  assert.throws(()=>applyCategoryOperation(s,{...proposal,status:"cancelled"}));
  const next=applyCategoryOperation(s,proposal);assert.deepEqual(next.transactions.map(t=>t.amount),s.transactions.map(t=>t.amount));assert.equal(next.categories.includes("Ăn vặt"),false);
});

test("transaction deletion lookup proposes actual matches without deleting anything",()=>{
  const s=state(),before=structuredClone(s),criteria={scope:"matching",amount:null,walletId:"cny",periodStart:"2026-10-01",periodEnd:"2026-10-19",category:null,searchTerm:"Bữa ăn",type:"expense"};
  assert.deepEqual(findTransactionsForDeletion(s.transactions,criteria).map(t=>t.id),["food"]);assert.deepEqual(s,before);
});
