import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

const fixture=globalThis.__transferOptionsTest={session:{user:{id:"alice"}},calls:[]};
const hooks=registerHooks({resolve(specifier,context,next){
  if(specifier==="@/lib/auth-session")return{url:"transfer-test:auth",shortCircuit:true};
  if(specifier==="@/lib/transfer-chat-runtime")return{url:"transfer-test:runtime",shortCircuit:true};
  if(specifier.startsWith("@/"))return{url:pathToFileURL(path.resolve("src",specifier.slice(2)+".ts")).href,shortCircuit:true};
  return next(specifier,context);
},load(url,context,next){
  if(url==="transfer-test:auth")return{format:"module",shortCircuit:true,source:"export async function getSession(){return globalThis.__transferOptionsTest.session}"};
  if(url==="transfer-test:runtime")return{format:"module",shortCircuit:true,source:"export async function readTransferChat(input){globalThis.__transferOptionsTest.calls.push(input);return {status:'answer'}}"};
  return next(url,context);
}});
const old={NODE_ENV:process.env.NODE_ENV,BETTER_AUTH_URL:process.env.BETTER_AUTH_URL};
process.env.NODE_ENV="production";process.env.BETTER_AUTH_URL="https://test.invalid";
const {POST}=await import("../src/app/api/ai/transfer-options/route.ts");
test.after(()=>{hooks.deregister();for(const[k,v]of Object.entries(old))if(v===undefined)delete process.env[k];else process.env[k]=v;});
const request=(body,owner="alice",origin="https://test.invalid")=>new Request("https://test.invalid/api/ai/transfer-options",{method:"POST",headers:{origin,"content-type":"application/json","x-finbridge-workspace-owner":owner},body:JSON.stringify(body)});
const input=()=>({id:randomUUID(),request:{operation:"convert",amount:"100",sourceCurrency:"USD",targetCurrency:"VND"},language:"vi"});
test("interactive lookup derives owner from session, uses no model and returns no-store",async()=>{
  const response=await POST(request(input()));assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"no-store");
  assert.equal(fixture.calls[0].owner,"alice");assert.equal(fixture.calls[0].demo,false);
});
test("authentication, account switching, origin, strict inputs and oversized bodies are rejected before tools",async()=>{
  const count=fixture.calls.length;
  assert.equal((await POST(request(input(),"bob"))).status,409);
  assert.equal((await POST(request(input(),"alice","https://evil.invalid"))).status,403);
  assert.equal((await POST(request({...input(),owner:"bob"}))).status,400);
  assert.equal((await POST(request({...input(),request:{operation:"execute",url:"evil"}}))).status,400);
  assert.equal((await POST(request({...input(),padding:"x".repeat(9000)}))).status,413);
  fixture.session=null;assert.equal((await POST(request(input()))).status,401);
  assert.equal(fixture.calls.length,count);
});
