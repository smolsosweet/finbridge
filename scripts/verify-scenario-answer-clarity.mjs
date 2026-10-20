import test from "node:test";
import assert from "node:assert/strict";
import { calculateScenario } from "../src/lib/scenario-planner.ts";
import { scenarioAnswer } from "../src/lib/scenario-answer.ts";
import { scenarioCalculationExplanation } from "../src/lib/scenario-explanation.ts";
import { resolveScenarioLanguage } from "../src/lib/scenario-format.ts";

const today="2026-10-20";
const scenario={id:"test",name:"Laptop and rent",walletIds:["bank"],horizonEnd:"2026-10-31",estimateSpending:true,assumptions:[],changes:[{title:"Laptop",amount:3000000,direction:"expense",walletId:"bank",currency:"VND",date:"2026-10-20",category:"Shopping"}]};
const bill=(id,title,amount,date)=>({id,title,amount,dueDate:date,walletId:"bank",budgetId:"",category:"Bills",recurrence:"monthly",active:true});
function fixture(production=false){
 const transactions=[{id:"food",type:"expense",title:"Food",amount:production?407244:930622,wallet:"bank",currency:"VND",date:"2026-10-10",category:"Food",note:""}];
 if(!production)transactions.push({id:"internet-paid",type:"expense",title:"Internet",amount:239000,wallet:"bank",currency:"VND",date:"2026-10-17",category:"Bills",note:"",fixedExpenseId:"internet",fixedExpenseDueDate:"2026-10-17",paymentConfirmation:"user"});
 return {wallets:[{id:"bank",name:"Vietinbank",currency:"VND",initial:10000000,type:"cash"}],categories:["Food","Bills","Shopping"],categoryMeta:Object.fromEntries(["Food","Bills","Shopping"].map(name=>[name,{type:"expense",icon:"",children:[]}])),transactions,goals:[],fixedExpenses:production?[bill("rent","Rent",3000000,"2026-10-20")]:[bill("internet","Internet",239000,"2026-10-17"),bill("rent","Rent",3000000,"2026-10-18"),bill("parking","Parking",147000,"2026-10-20")],settings:{language:"vi",reserveByWallet:production?' {"bank":3000000}':'{}'},rules:[],recurring:[]};
}
test("observed local and production data reconcile independently, reserves are never deducted twice",()=>{
 for(const production of [false,true]){
  const state=fixture(production),before=structuredClone(state),result=calculateScenario(state,scenario,today),w=result.wallets[0];
  assert.equal(w.balanceNow,production?9592756:8830378);assert.equal(w.components.unpaidBills,production?3000000:3147000);
  assert.equal(w.components.paceSpending,production?223984:511842);assert.equal(w.projectedBalance,production?3368772:2171536);
  assert.equal(w.availableAfterReserve,production?368772:null);
  const text=scenarioAnswer(result,scenario,state.wallets,today,"en");assert.match(text,/projected/);assert.doesNotMatch(text,/needs more data|certainly|guaranteed/);
  if(production)assert.match(text,/368,772 VND/);else assert.match(text,/No reserve is set/);
  assert.deepEqual(state,before);
 }
});
test("a budget without pace cannot invalidate a calculable wallet forecast",()=>{
 const state=fixture(true);state.goals=[{id:"empty",kind:"budget",title:"Unspent shopping",amount:100000,saved:0,currency:"VND",date:"2026-10-01",cycle:"monthly",category:"Shopping",wallet:"bank",direction:"",person:""}];
 const result=calculateScenario(state,scenario,today);assert.ok(result.unavailableEstimates.length);assert.equal(result.budgets[0].forecastAvailable,false);
 const text=scenarioAnswer(result,scenario,state.wallets,today,"en");assert.match(text,/projected to have about \*\*3,368,772 VND/);assert.match(text,/Budget \*\*Unspent shopping\*\* has no usable/);assert.doesNotMatch(text,/Finn needs more data|not a complete forecast|could exceed its limit/);
 assert.doesNotMatch(scenarioCalculationExplanation(result,scenario,state.wallets,today,"en"),/Some data is missing/);
});
test("missing wallet history states the omitted living costs after the partial result",()=>{
 const state=fixture(true);state.transactions=[];const result=calculateScenario(state,scenario,today);
 const text=scenarioAnswer(result,scenario,state.wallets,today,"en");assert.ok(text.indexOf("7,000,000")==-1);assert.match(text,/4,000,000 VND/);
 assert.ok(text.indexOf("4,000,000 VND")<text.indexOf("Further living costs are not estimated"));assert.match(text,/expected daily amount/);assert.doesNotMatch(text,/projected to have about/);
 assert.match(scenarioCalculationExplanation(result,scenario,state.wallets,today,"en"),/Further living costs are not estimated/);
});
test("overdue/current occurrences are counted once, linked payments excluded, next month stays outside horizon",()=>{
 const state=fixture(false),result=calculateScenario(state,scenario,today);
 assert.deepEqual(result.plannedBills.map(b=>b.title).sort(),["Parking","Rent"]);assert.ok(result.plannedBills.every(b=>b.date<="2026-10-31"));
 assert.equal(result.wallets[0].components.unpaidBills,3147000);
 const explanation=scenarioCalculationExplanation(result,scenario,state.wallets,today,"en");assert.match(explanation,/Rent/);assert.doesNotMatch(explanation,/Internet/);
});
test("question language overrides UI only when clear, and mismatched model lead is omitted",()=>{
 for(const q of ['If I spend 3 milion VND on a laptop, will I still have enough money for rent?','If I buy a laptop for 3 triệu, will I have enough for tiền nhà?'])assert.equal(resolveScenarioLanguage(q,"vi"),"en");
 assert.equal(resolveScenarioLanguage("Nếu mình mua laptop 3 triệu thì còn đủ tiền thuê nhà không?","en"),"vi");assert.equal(resolveScenarioLanguage("如果买电脑以后还有钱交房租吗？","vi"),"zh");assert.equal(resolveScenarioLanguage("3000 CNY","vi"),"vi");
 const state=fixture(true),result=calculateScenario(state,scenario,today);
 const vi=scenarioAnswer(result,scenario,state.wallets,today,"vi",undefined,{detail:"standard",layout:"conversation",lead:"If you go ahead with that purchase, {{answer}}"});assert.doesNotMatch(vi,/If you|projected|Protected/);
 const en=scenarioAnswer(result,scenario,state.wallets,today,"en",undefined,{detail:"standard",layout:"conversation",lead:"Nếu bạn mua món đồ này, {{answer}}"});assert.doesNotMatch(en,/Nếu|dự kiến|Tiền hiện có/);assert.match(en,/Money available now|Protected reserve/);
});
test("missing category-reduction history and unknown balances identify the exact missing input",()=>{
 const state=fixture(true),spec={...scenario,spendingReductions:[{walletId:"bank",currency:"VND",category:"Food",percent:20,startDate:"2026-10-21",endDate:"2026-10-31"}]};
 const result=calculateScenario(state,spec,today),text=scenarioAnswer(result,spec,state.wallets,today,"en");assert.match(text,/reduction for “Food”/);assert.match(text,/not included/);
 delete state.wallets[0].initial;const unknown=calculateScenario(state,scenario,today);assert.match(scenarioAnswer(unknown,scenario,state.wallets,today,"en"),/cannot verify this wallet balance/);assert.doesNotMatch(scenarioAnswer(unknown,scenario,state.wallets,today,"en"),/projected to have about/);
});

test("an incomplete foreign wallet does not suppress another wallet's valid forecast",()=>{
 const state=fixture(true);state.wallets.push({id:"cny",name:"Alipay",currency:"CNY",initial:10000,type:"cash"});
 const spec={...scenario,walletIds:["bank","cny"]},result=calculateScenario(state,spec,today);
 const text=scenarioAnswer(result,spec,state.wallets,today,"en");assert.match(text,/projected to have about \*\*3,368,772 VND/);assert.match(text,/\*\*Alipay\*\* has \*\*10,000 CNY/);
 assert.equal(result.wallets.find(w=>w.walletId==='bank').projectedBalance,3368772);
});

test("an explicit daily amount replaces missing history, including a deliberate zero",()=>{
 const state=fixture(true);state.transactions=[];
 for(const amount of [0,10000]){
  const spec={...scenario,dailySpendingLimits:[{walletId:"bank",currency:"VND",amount,category:null,startDate:"2026-10-21",endDate:"2026-10-31"}]};
  const result=calculateScenario(state,spec,today),text=scenarioAnswer(result,spec,state.wallets,today,"en");
  assert.doesNotMatch(text,/Further living costs are not estimated|not a complete forecast/);assert.equal(result.wallets[0].projectedBalance,4000000-amount*11);
 }
});

test("unrecorded rent is never invented or implied to be included",()=>{
 const state=fixture(true);state.fixedExpenses=[];const result=calculateScenario(state,scenario,today),text=scenarioAnswer(result,scenario,state.wallets,today,"en");
 assert.equal(result.plannedBills.length,0);assert.equal(result.wallets[0].components.unpaidBills,0);
 assert.match(text,/No unpaid bills are recorded/);assert.match(text,/rent or other bill not yet recorded is not included/);assert.doesNotMatch(text,/recorded unpaid bills:|enough for rent/);
});
