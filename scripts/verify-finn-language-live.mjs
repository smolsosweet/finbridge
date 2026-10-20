// Manual synthetic-data probe. Real Gemini; stubbed auth/workspace, no database or writes.
import assert from "node:assert/strict";
import {registerHooks} from "node:module";
import {existsSync} from "node:fs";
import {fileURLToPath,pathToFileURL} from "node:url";
import path from "node:path";
import {randomUUID} from "node:crypto";
process.loadEnvFile(".env.local");
const data={wallets:[{id:"vnd",name:"Synthetic wallet",currency:"VND",initial:10000000,type:"cash"}],categories:["Food","Dining","Shopping"],categoryMeta:Object.fromEntries(["Food","Dining","Shopping"].map(name=>[name,{type:"expense",icon:"",children:[]}])),transactions:[{id:"small",title:"Breakfast",amount:25000,type:"expense",wallet:"vnd",category:"Food",date:"2026-10-10",note:""},{id:"large",title:"Laptop",amount:3000000,type:"expense",wallet:"vnd",category:"Shopping",date:"2026-10-15",note:""}],goals:[],fixedExpenses:[],recurring:[],rules:[],settings:{language:"vi"}};
globalThis.__finnLanguageProbe=data;
const stubs={"@/lib/auth-session":"export async function getSession(){return {user:{id:'synthetic-owner',emailVerified:true}}}","@/lib/database":"export function database(){return {}}","@/lib/workspace-repository":"export function workspaceRepository(){return {read:async()=>({data:globalThis.__finnLanguageProbe,revision:0})}}"};
const root=path.resolve("src"),hooks=registerHooks({resolve(specifier,context,next){
 if(stubs[specifier])return{url:"language-probe:"+specifier,shortCircuit:true};
 if(specifier.startsWith("@/"))return{url:pathToFileURL(path.join(root,specifier.slice(2))+".ts").href,shortCircuit:true};
 if(specifier.startsWith(".")&&context.parentURL?.startsWith("file:")){const candidate=path.resolve(path.dirname(fileURLToPath(context.parentURL)),specifier);if(existsSync(candidate+".ts"))return{url:pathToFileURL(candidate+".ts").href,shortCircuit:true};}
 return next(specifier,context);
},load(url,context,next){if(url.startsWith("language-probe:"))return{format:"module",shortCircuit:true,source:stubs[url.slice("language-probe:".length)]};return next(url,context);}});
const keys=["NODE_ENV","FINBRIDGE_DEMO_MODE","BETTER_AUTH_URL"],saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
try{
 Object.assign(process.env,{NODE_ENV:"production",FINBRIDGE_DEMO_MODE:"false",BETTER_AUTH_URL:"https://finbridge.example.invalid"});
 const {POST}=await import("../src/app/api/ai/assistant/route.ts"),before=JSON.stringify(data);let pending;
 const cases=[
  {message:"Khoản mua nào đứng đầu bảng về số tiền?",check:r=>{assert.equal(r.action,"largest_transaction");assert.match(r.financialAnswer,/Laptop.*3,000,000 VND/);assert.doesNotMatch(r.financialAnswer,/Breakfast/);}},
  {message:"Show me the priciest thing I've paid for, not the whole list.",language:"en",check:r=>assert.equal(r.action,"largest_transaction")},
  {message:"Tui mún bỏ bớt 1 giao dịhc, cho tui coi để chọn.",check:r=>{assert.equal(r.operationIntent,"delete_transactions");assert.ok(r.transactionSelection.ids.length);assert.deepEqual(r.transactionSelection.selectedIds,[]);}},
  {message:"Cho mình mở thêm một nhóm để phân loại khoản chi.",check:r=>{assert.equal(r.operationIntent,"create_category");assert.equal(r.categoryDialogue.field,"target");pending=r.categoryDialogue.command;}},
  {message:"Nhóm mới tên là Đồ leo núi.",pending:true,check:r=>{assert.equal(r.operationIntent,"create_category");assert.equal(r.categoryOperation?.target || r.categoryDialogue?.command.target,"Đồ leo núi");}},
  {message:"Mình đang tách Food với Dining, gom Food về Dining cho gọn được không?",check:r=>{assert.equal(r.operationIntent,"merge_categories");assert.deepEqual(r.categoryOperation.sources,["Food"]);assert.equal(r.categoryOperation.target,"Dining");}},
  {message:"Có thể hợp nhất mấy nhóm chi giúp mình không?",check:r=>{assert.equal(r.operationIntent,"merge_categories");assert.equal(r.categoryDialogue.field,"sources");pending=r.categoryDialogue.command;}},
  {message:"Thôi, đừng đổi danh mục nữa.",pending:true,check:r=>{assert.equal(r.categoryOperation,null);assert.equal(r.categoryDialogue,undefined);assert.equal(r.drafts.length,0);}},
 ];
 let failures=0;
 for(let i=0;i<cases.length;i++){
  const item=cases[i],start=Date.now();let status,passed=false,error;
  try{
   const http=await POST(new Request(process.env.BETTER_AUTH_URL+"/api/ai/assistant",{method:"POST",headers:{origin:process.env.BETTER_AUTH_URL,"content-type":"application/json","x-finbridge-workspace-owner":"synthetic-owner"},body:JSON.stringify({batchId:randomUUID(),message:item.message,today:"2026-10-20",timeZone:"Asia/Ho_Chi_Minh",language:item.language||"vi",selectedWalletId:"vnd",wallets:data.wallets.map(({id,name,currency})=>({id,name,currency})),categories:data.categories.map(name=>({name,type:"expense"})),history:[],pendingDrafts:[],...(item.pending?{pendingCategory:pending}:{})}),signal:AbortSignal.timeout(35000)}));
   status=http.status;const result=await http.json();assert.equal(status,200);item.check(result);assert.equal(JSON.stringify(data),before);passed=true;
  }catch(e){failures++;error=e.name;}
  console.log(JSON.stringify({case:i+1,status,passed,durationMs:Date.now()-start,error}));
 }
 console.log(JSON.stringify({passed:cases.length-failures,total:cases.length,scope:"synthetic workspace, real provider; no production claim"}));if(failures)process.exitCode=1;
}finally{hooks.deregister();delete globalThis.__finnLanguageProbe;for(const[k,v]of Object.entries(saved))if(v===undefined)delete process.env[k];else process.env[k]=v;}
