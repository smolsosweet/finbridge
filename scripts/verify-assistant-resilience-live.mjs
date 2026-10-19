// Manual provider probe: real SDK, synthetic authenticated workspace, no database/write.
import assert from "node:assert/strict";
import {registerHooks} from "node:module";
import {existsSync} from "node:fs";
import {fileURLToPath,pathToFileURL} from "node:url";
import path from "node:path";
import {randomUUID} from "node:crypto";
process.loadEnvFile(".env.local");
const root=path.resolve("src");
const data={wallets:[{id:"probe-vnd",name:"Synthetic VND",currency:"VND",initial:1000000,type:"cash"}],categories:["Thức ăn & Đồ uống"],categoryMeta:{"Thức ăn & Đồ uống":{type:"expense",icon:"",children:[]}},transactions:[],goals:[],fixedExpenses:[],recurring:[],settings:{language:"vi"},rules:[]};
globalThis.__resilienceProbe=data;
const stubs={
  "@/lib/auth-session":"export async function getSession(){return {user:{id:'synthetic-owner'}}}",
  "@/lib/database":"export function database(){return {}}",
  "@/lib/workspace-repository":"export function workspaceRepository(){return {read:async()=>({data:globalThis.__resilienceProbe,revision:0})}}",
};
const hooks=registerHooks({resolve(specifier,context,next){
  if(stubs[specifier])return{url:"resilience-probe:"+specifier,shortCircuit:true};
  if(specifier.startsWith("@/"))return{url:pathToFileURL(path.join(root,specifier.slice(2))+".ts").href,shortCircuit:true};
  if(specifier.startsWith(".")&&context.parentURL?.startsWith("file:")){const candidate=path.resolve(path.dirname(fileURLToPath(context.parentURL)),specifier);if(existsSync(candidate+".ts"))return{url:pathToFileURL(candidate+".ts").href,shortCircuit:true};}
  return next(specifier,context);
},load(url,context,next){if(url.startsWith("resilience-probe:"))return{format:"module",shortCircuit:true,source:stubs[url.slice("resilience-probe:".length)]};return next(url,context);}});
const names=["NODE_ENV","FINBRIDGE_DEMO_MODE","BETTER_AUTH_URL"],saved=Object.fromEntries(names.map(k=>[k,process.env[k]]));
try{
  process.env.NODE_ENV="production";process.env.FINBRIDGE_DEMO_MODE="false";process.env.BETTER_AUTH_URL="https://finbridge.example.invalid";
  const {POST}=await import("../src/app/api/ai/assistant/route.ts");const before=JSON.stringify(data);
  for(const message of ["chào finn","ăn sáng 10k"]){
    const start=performance.now();const response=await POST(new Request(process.env.BETTER_AUTH_URL+"/api/ai/assistant",{method:"POST",headers:{origin:process.env.BETTER_AUTH_URL,"content-type":"application/json","x-finbridge-workspace-owner":"synthetic-owner"},body:JSON.stringify({batchId:randomUUID(),message,today:"2026-10-19",timeZone:"Asia/Ho_Chi_Minh",language:"vi",selectedWalletId:null,wallets:[],categories:[],history:[],pendingDrafts:[]})}));
    const result=await response.json();assert.equal(response.status,200);assert.equal(JSON.stringify(data),before);
    if(message.startsWith("ăn")){assert.equal(result.drafts.length,1);assert.equal(result.drafts[0].amount,10000);assert.equal(result.drafts[0].currency,"VND");assert.equal(result.drafts[0].wallet,"probe-vnd");assert.equal(result.drafts[0].category,data.categories[0]);}
    else{assert.match(result.reply,/Finn/);assert.equal(result.drafts.length,0);}
    console.log(JSON.stringify({probe:"real-provider-synthetic-workspace",status:response.status,durationMs:Math.round(performance.now()-start),intent:result.intent,source:result.interpretationSource||"normal",draftCount:result.drafts.length,serverTiming:response.headers.get("server-timing")}));
  }
}finally{hooks.deregister();delete globalThis.__resilienceProbe;for(const[k,v]of Object.entries(saved))if(v===undefined)delete process.env[k];else process.env[k]=v;}
