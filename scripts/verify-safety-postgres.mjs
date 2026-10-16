import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { ruleFixture } from "./safety-fixtures.mjs";
import { safetyRepository, SAFETY_SQL } from "../src/lib/safety-repository.ts";
import { workspaceRepository } from "../src/lib/workspace-repository.ts";
import { handleSafety } from "../src/lib/safety-handler.ts";
import { runSafetyWorker } from "../src/lib/safety-worker.ts";
import { deactivateAccountLifecycle } from "../src/lib/account-lifecycle.ts";
import { testPool, syntheticUser, cleanupFinance, workspaceFixture } from "./workspace-fixtures.mjs";
const pool=await testPool(),owner=await syntheticUser(pool),other=await syntheticUser(pool),repo=safetyRepository(pool),workspaces=workspaceRepository(pool),origin="https://finbridge.invalid";
await workspaces.save(owner,{revision:0,mutationId:randomUUID(),data:workspaceFixture()});
const saved=()=>repo.read(owner);
async function request(body,{id=owner,trusted=true,emailAvailable=true}={}) {
 const revision=(await repo.read(id)).revision;
 return handleSafety(new Request(origin+"/api/safety",{method:"POST",headers:{"content-type":"application/json",origin:trusted?origin:"https://foreign.invalid"},body:JSON.stringify({revision,...body})}),id,origin,repo,emailAvailable);
}
after(async()=>{await cleanupFinance(pool,[owner,other]);await pool.end();});
test("schema migration preserves rows and reads authoritative database financial records",async()=>{await pool.query(SAFETY_SQL);const doc=await saved();assert.equal(doc.revision,0);assert.equal(doc.sourceId,"database");assert.equal(doc.snapshot.transactions[0].amount,850);});
test("foreign origins, missing sessions and client-supplied financial snapshots are rejected",async()=>{
 assert.equal((await request({action:"read"},{trusted:false})).status,403);
 assert.equal((await handleSafety(new Request(origin+"/api/safety"),null,origin,repo,true)).status,401);
 assert.equal((await request({action:"sync",sourceId:randomUUID(),snapshot:{}})).status,400);
 assert.equal((await saved()).revision,0);
});
const groupId=randomUUID();
const groupRules=[{...ruleFixture(),id:"actual-80",groupId,email:true},{...ruleFixture(),id:"actual-100",groupId,threshold:100,email:true},{...ruleFixture(),id:"forecast-100",groupId,basis:"forecast",threshold:100,email:true}];
test("one configuration atomically stores actual 80/100 and forecast 100 in relational alert rows",async()=>{
 const response=await request({action:"saveGroup",groupId,rules:groupRules});assert.equal(response.status,200);const publicDoc=await response.json();assert.equal("snapshot" in publicDoc,false);assert.equal(publicDoc.rules.length,3);
 const rows=await pool.query("SELECT basis,threshold_value FROM finbridge_alert_rules WHERE user_id=$1 ORDER BY position",[owner]);assert.equal(rows.rowCount,3);assert.deepEqual(rows.rows.map(r=>r.basis),["actual","actual","forecast"]);
 const doc=await saved();assert.equal(doc.events.filter(e=>e.ruleId==="actual-80").length,1);assert.ok(doc.evaluated["actual-80"]?.state!=="unavailable");
});
test("another account cannot access alerts or use scopes from an absent workspace",async()=>{assert.deepEqual((await repo.read(other)).rules,[]);assert.equal((await request({action:"save",rule:ruleFixture()},{id:other})).status,400);});
test("forged identity, invalid target, duplicate conditions, mixed groups and unsupported money precision roll back",async()=>{
 const before=(await saved()).revision;
 for(const body of [{action:"read",userId:other},{action:"save",rule:{...ruleFixture(),targetId:"foreign-budget"}},{action:"save",rule:{...ruleFixture(),unit:"amount",threshold:1.001}},{action:"saveGroup",groupId,rules:[groupRules[0],{...groupRules[0],id:"duplicate"}]},{action:"saveGroup",groupId,rules:[{...groupRules[0],groupId:randomUUID()}]}])assert.equal((await request(body)).status,400);
 assert.equal((await request({action:"save",rule:{...ruleFixture(),email:true}},{emailAvailable:false})).status,400);assert.equal((await saved()).revision,before);
});
test("concurrent rule edits conflict instead of overwriting",async()=>{const revision=(await saved()).revision;const responses=await Promise.all([request({action:"saveGroup",revision,groupId,rules:groupRules.map(r=>({...r,name:"A"}))}),request({action:"saveGroup",revision,groupId,rules:groupRules.map(r=>({...r,name:"B"}))})]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);});
test("GET has no writes and marking read retains financial data",async()=>{const before=await saved();assert.equal((await handleSafety(new Request(origin+"/api/safety"),owner,origin,repo,true)).status,200);assert.equal((await saved()).revision,before.revision);assert.equal((await request({action:"read"})).status,200);assert.ok((await saved()).events.every(e=>e.read));});
test("worker sends each generic reminder once and accepts database data even after 24 hours",async()=>{
 await pool.query("UPDATE finbridge_safety SET document=jsonb_set(document,'{syncedAt}',to_jsonb($2::text)) WHERE user_id=$1",[owner,new Date(Date.now()-26*3600000).toISOString()]);
 let calls=0;await runSafetyWorker(pool,async(to,language)=>{calls++;assert.equal(to,owner+"@example.invalid");assert.equal(language,"en");return "accepted";});assert.ok(calls>=1);const accepted=calls;
 await runSafetyWorker(pool,async()=>{calls++;return "accepted";});assert.equal(calls,accepted);assert.equal((await saved()).events.find(e=>e.ruleId==="actual-80").emailStatus,"accepted");
});
test("removed group conditions are archived; invalid grouped edit cannot save partially",async()=>{const old=await saved();const rules=old.rules.filter(r=>r.id!=="forecast-100");assert.equal((await request({action:"saveGroup",groupId,rules})).status,200);assert.equal((await saved()).rules.find(r=>r.id==="forecast-100").archived,true);assert.equal((await pool.query("SELECT archived FROM finbridge_alert_rules WHERE user_id=$1 AND id='forecast-100'",[owner])).rows[0].archived,true);});
test("ambiguous email result is not blindly resent; pause cancels queued mail",async()=>{
 const r={...ruleFixture(),id:"unknown-rule",unit:"amount",threshold:760,email:true};await request({action:"save",rule:r});let calls=0;await runSafetyWorker(pool,async()=>{calls++;return "unknown";});await runSafetyWorker(pool,async()=>{calls++;return "accepted";});assert.equal(calls,1);assert.equal((await saved()).events.find(e=>e.ruleId===r.id).emailStatus,"unknown");
 const pause={...r,id:"pause-rule",threshold:750};await request({action:"save",rule:pause});await request({action:"save",rule:{...pause,active:false}});assert.equal((await saved()).events.find(e=>e.ruleId===pause.id).emailStatus,"cancelled");
});
test("workspace edits refresh derived alert snapshots transactionally",async()=>{const r=await workspaces.read(owner);r.data.transactions[0].amount=900;await workspaces.save(owner,{revision:r.revision,mutationId:randomUUID(),data:r.data});assert.equal((await saved()).snapshot.transactions[0].amount,900);});
test("database request limits reject excess writes",async()=>{await pool.query("UPDATE finbridge_safety_limits SET requests=60,window_at=CURRENT_TIMESTAMP WHERE user_id=$1",[owner]);const before=(await saved()).revision;assert.equal((await request({action:"read"})).status,429);assert.equal((await saved()).revision,before);await pool.query("UPDATE finbridge_safety_limits SET requests=0 WHERE user_id=$1",[owner]);});
test("closed account retains financial records and rules while blocking access and email",async()=>{const before=(await saved()).rules.length;await deactivateAccountLifecycle(pool,{userId:owner,secret:"synthetic-only-lifecycle-secret-".repeat(2)});await assert.rejects(repo.read(owner),/UNAUTHENTICATED/);let calls=0;await runSafetyWorker(pool,async()=>{calls++;return "accepted";});assert.equal(calls,0);assert.equal((await pool.query("SELECT document FROM finbridge_safety WHERE user_id=$1",[owner])).rows[0].document.rules.length,before);});
