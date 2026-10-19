// Manual public-data probe, NOT part of offline regression tests.
// Runs the actual assistant route in explicit isolated localhost demo mode;
// no user session, financial workspace, API key or model request is used.
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { randomUUID } from "node:crypto";

const root=path.resolve("src");
const hooks=registerHooks({resolve(specifier,context,next){
  if(specifier==="@/lib/auth-session"||specifier==="@/lib/workspace-repository"||specifier==="server-only")return{url:"fx-probe:"+specifier,shortCircuit:true};
  if(specifier.startsWith("@/"))return{url:pathToFileURL(path.join(root,specifier.slice(2))+".ts").href,shortCircuit:true};
  if(specifier.startsWith(".")&&context.parentURL?.startsWith("file:")){
    const candidate=path.resolve(path.dirname(fileURLToPath(context.parentURL)),specifier);
    if(existsSync(candidate+".ts"))return{url:pathToFileURL(candidate+".ts").href,shortCircuit:true};
  }
  return next(specifier,context);
},load(url,context,next){
  if(url==="fx-probe:@/lib/auth-session")return{format:"module",shortCircuit:true,source:"export async function getSession(){throw new Error('Unexpected session access in isolated demo')}"};
  if(url==="fx-probe:@/lib/workspace-repository")return{format:"module",shortCircuit:true,source:"export function workspaceRepository(){throw new Error('Unexpected financial workspace access')}"};
  if(url==="fx-probe:server-only")return{format:"module",shortCircuit:true,source:"export {}"};
  return next(url,context);
}});
const names=["NODE_ENV","FINBRIDGE_DEMO_MODE","BETTER_AUTH_URL","GEMINI_API_KEY"], saved=Object.fromEntries(names.map(k=>[k,process.env[k]]));
try {
  process.env.NODE_ENV="development";process.env.FINBRIDGE_DEMO_MODE="true";process.env.BETTER_AUTH_URL="http://127.0.0.1:3011";delete process.env.GEMINI_API_KEY;
  const {POST}=await import("../src/app/api/ai/assistant/route.ts");
  for(const message of ["Tỷ giá nhân dân tệ sang VND hiện có là bao nhiêu? Dữ liệu ngày nào?","10 triệu VND đổi được bao nhiêu tệ?"]){
    const start=performance.now();
    const response=await POST(new Request("http://127.0.0.1:3011/api/ai/assistant",{method:"POST",headers:{origin:"http://127.0.0.1:3011",host:"127.0.0.1:3011","content-type":"application/json"},body:JSON.stringify({batchId:randomUUID(),message,today:new Date().toISOString().slice(0,10),language:"vi",timeZone:"Asia/Ho_Chi_Minh",selectedWalletId:null,wallets:[],categories:[],history:[]})}));
    const result=await response.json();
    assert.equal(response.status,200);assert.equal(result.intent,"international_transfer");assert.equal(result.transfer.status,"answer");assert.ok(result.transfer.rows.length);
    assert.doesNotMatch(response.headers.get("server-timing")||"",/model;/);
    assert.match(result.transfer.rows.map(r=>r.value).join(" "),/Frankfurter/);
    assert.equal(result.transfer.write,undefined);
    console.log(JSON.stringify({probe:"isolated-route-public-FX",status:response.status,durationMs:Math.round(performance.now()-start),operation:result.transfer.request.operation,rows:result.transfer.rows,serverTiming:response.headers.get("server-timing")}));
  }
} finally {hooks.deregister();for(const[k,v]of Object.entries(saved))if(v===undefined)delete process.env[k];else process.env[k]=v;}
