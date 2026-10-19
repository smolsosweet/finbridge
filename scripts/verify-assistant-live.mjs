// Opt-in provider test: synthetic in-memory workspace, no real account or database.
// Run with FINBRIDGE_LIVE_AI_TEST=1. Never print keys, provider bodies or prompts.
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { randomUUID } from "node:crypto";

if (process.env.FINBRIDGE_LIVE_AI_TEST !== "1") {
  console.log("SKIPPED: opt-in live provider test.");
  process.exit(0);
}
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const {default:env}=await import("@next/env");
env.loadEnvConfig(repo,true,{info(){},error(){}});
if(!process.env.GEMINI_API_KEY){console.log("SKIPPED: provider key is not configured.");process.exit(0);}
const providerUrl=import.meta.resolve("@google/genai");
const fixture=globalThis.__finbridgeLiveAssistant={calls:0,data:{wallets:[{id:"vnd",name:"Synthetic VND wallet",currency:"VND",initial:10000000,type:"cash"}],transactions:[{id:"food",title:"Food",type:"expense",amount:190000,category:"Thức ăn & Đồ uống",wallet:"vnd",date:"2026-10-19",note:""}],categories:["Thức ăn & Đồ uống","Mua sắm"],categoryMeta:{"Thức ăn & Đồ uống":{type:"expense"},"Mua sắm":{type:"expense"}},goals:[],fixedExpenses:[{id:"bill",title:"Synthetic internet",amount:239000,walletId:"vnd",budgetId:"",category:"Mua sắm",dueDate:"2026-10-17",recurrence:"monthly",active:true}],recurring:[],rules:[],settings:{language:"Tiếng Việt"}}};
const stubs={
  "@google/genai":`import { GoogleGenAI as SDK, ThinkingLevel, Type } from ${JSON.stringify(providerUrl)}; export { ThinkingLevel, Type }; export class GoogleGenAI { constructor(config){ const sdk=new SDK(config);this.models={generateContent:args=>{globalThis.__finbridgeLiveAssistant.calls++;return sdk.models.generateContent(args);}}; } }`,
  "@/lib/auth-session":`export async function getSession(){return {user:{id:"synthetic-owner"}};}`,
  "@/lib/database":`export function database(){return {};}`,
  "@/lib/workspace-repository":`export function workspaceRepository(){return {read:async()=>({data:globalThis.__finbridgeLiveAssistant.data,revision:0})};}`,
};
const hooks=registerHooks({
  resolve(specifier,context,next){
    if(stubs[specifier])return {url:"finbridge-live:"+specifier,shortCircuit:true};
    if(specifier.startsWith("@/"))return {url:pathToFileURL(path.join(repo,"src",specifier.slice(2))+".ts").href,shortCircuit:true};
    if(specifier.startsWith(".")&&context.parentURL?.startsWith("file:")){const candidate=path.resolve(path.dirname(fileURLToPath(context.parentURL)),specifier);if(existsSync(candidate+".ts"))return {url:pathToFileURL(candidate+".ts").href,shortCircuit:true};}
    return next(specifier,context);
  },
  load(url,context,next){if(url.startsWith("finbridge-live:"))return {source:stubs[url.slice("finbridge-live:".length)],format:"module",shortCircuit:true};return next(url,context);},
});
process.env.BETTER_AUTH_URL="https://finbridge.example.invalid";
const {POST}=await import("../src/app/api/ai/assistant/route.ts");
const {modelHistory}=await import("../src/lib/chat-local-plan.ts");
const {scenarioAnswer}=await import("../src/lib/scenario-answer.ts");
const history=[];
const planningMode=process.env.FINBRIDGE_LIVE_PLANNING_TEST==="1";
if(planningMode){
  fixture.data.goals=[{id:"living",kind:"budget",title:"Sinh hoạt",amount:7000000,saved:0,currency:"VND",date:"2026-10-01",cycle:"monthly",category:"",wallet:"vnd",direction:"",person:""}];
  fixture.data.fixedExpenses[0].title="Tiền mạng";
  fixture.data.fixedExpenses.push({...fixture.data.fixedExpenses[0],id:"rent",title:"Tiền nhà",amount:3000000});
}
const before=structuredClone(fixture.data);
let failures=0;
const cases=planningMode?[["list-budgets","hiện tại có ngân sách gì",0],["delete-this-budget","tôi muốn xóa ngân sách này",0],["choose-fixed-expense","tôi muốn xóa chi phí cố định",0],["delete-named-fixed","tôi muốn xóa chi phí Tiền mạng",0],["anomaly-question","đang có khoản chi nào bất thường trong tài khoản của tôi không",0]]:[
    ["purchase","nếu tui mua giày 3 triệu thì cuối tháng còn đủ tiền sài không",3000000],
    ["baseline-follow-up","nếu tôi chi như hiện tại thì cuối tháng còn dư tiền không",0],
    ["short-follow-up","ok, tính lại giúp mình",0],
];
try{
  for(const [label,message,expectedChange] of cases){
    const calls=fixture.calls,started=Date.now();
    const request=new Request(process.env.BETTER_AUTH_URL+"/api/ai/assistant",{method:"POST",headers:{"content-type":"application/json",origin:process.env.BETTER_AUTH_URL,"x-finbridge-workspace-owner":"synthetic-owner"},body:JSON.stringify({batchId:randomUUID(),message,today:"2026-10-19",timeZone:"Asia/Ho_Chi_Minh",selectedWalletId:"vnd",wallets:fixture.data.wallets.map(({id,name,currency})=>({id,name,currency})),categories:fixture.data.categories.map(name=>({name,type:"expense"})),history:modelHistory(history).slice(-12),pendingDrafts:[],activeDraftId:null,referencedCategories:[]})});
    const http=await POST(request),result=await http.json();
    console.log(JSON.stringify({case:label,status:http.status,intent:result.operationIntent,durationMs:Date.now()-started,providerCalls:fixture.calls-calls,error:result.error||null}));
    if(!http.ok){history.push({role:"user",text:message},{role:"assistant",text:"The previous request failed; no calculation was completed. User input is preserved."});failures++;continue;}
    try{
      assert.equal(fixture.calls-calls,1);
      if(planningMode){
        if(label==="list-budgets"){
          assert.equal(result.action,"budget_status");assert.deepEqual(result.financialEntities,[{kind:"budget",id:"living",title:"Sinh hoạt"}]);
          history.push({role:"user",text:message},{role:"assistant",text:result.financialAnswer,localOnly:true,financialEntities:result.financialEntities,financialContext:{action:"budget_status",walletId:"vnd",scope:"selected"}});
        }else if(label==="anomaly-question"){
          assert.equal(result.action,"anomalies");assert.match(result.financialAnswer,/chưa có đủ lịch sử/);assert.doesNotMatch(result.financialAnswer,/90 ngày|5 giao dịch|3 lần|trung vị/);
        }else{
          assert.equal(result.operationIntent,label==="delete-this-budget"?"delete_budget":"delete_fixed_expense");
          assert.deepEqual(result.planningDeletion.selectedIds,label==="delete-this-budget"?["living"]:label==="delete-named-fixed"?["bill"]:[]);
          assert.equal(result.planningDeletion.status,"pending");
          history.push({role:"user",text:message},{role:"assistant",text:"",localOnly:true,planningDeletion:result.planningDeletion});
        }
        assert.deepEqual(fixture.data,before);continue;
      }
      assert.equal(result.operationIntent,"simulate_financial_scenario");
      const scenario=result.scenarioResponse.scenarios[0];
      assert.equal(scenario.estimateSpending,true);
      assert.equal(scenario.changes.reduce((n,c)=>n+(c.direction==="expense"?c.amount:0),0),expectedChange);
      assert.equal(result.calculations[0].wallets[0].projectedBalance,9451000-expectedChange);
      const answer=scenarioAnswer(result.calculations[0],scenario,fixture.data.wallets,"2026-10-19","vi",result.baselines?.[0],result.presentation);
      assert.doesNotMatch(answer,/\{\{answer\}\}|Theo các khoản đã biết|2026-10-31/);
      assert.match(answer,/31\/10\/2026/);
      assert.deepEqual(fixture.data,before);
      history.push({role:"user",text:message},{role:"assistant",text:"",localOnly:true,scenarios:[scenario]});
    }catch{
      const scenario=result.scenarioResponse?.scenarios?.[0],wallet=result.calculations?.[0]?.wallets?.[0];
      console.log(JSON.stringify({case:label,verification:"FAILED",scenarioCount:result.scenarioResponse?.scenarios?.length||0,estimateSpending:scenario?.estimateSpending,horizonEnd:scenario?.horizonEnd,hypotheticalTotal:scenario?.changes.reduce((n,c)=>n+(c.direction==="expense"?c.amount:0),0),syntheticProjectedBalance:wallet?.projectedBalance}));failures++;
    }
  }
}finally{hooks.deregister();delete globalThis.__finbridgeLiveAssistant;}
if(failures)process.exitCode=1;
