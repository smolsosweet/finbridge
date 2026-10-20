import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { ruleFixture } from "./safety-fixtures.mjs";
import { safetyRepository, safetyWorkspace, SAFETY_SQL } from "../src/lib/safety-repository.ts";
import { workspaceRepository } from "../src/lib/workspace-repository.ts";
import { readFinanceTables, readSafetyFinanceTables } from "../src/lib/finance-tables.ts";
import { safetySnapshot } from "../src/lib/safety-model.ts";
import { handleSafety } from "../src/lib/safety-handler.ts";
import { runSafetyWorker } from "../src/lib/safety-worker.ts";
import { deactivateAccountLifecycle } from "../src/lib/account-lifecycle.ts";
import { testPool, syntheticUser, cleanupFinance, workspaceFixture } from "./workspace-fixtures.mjs";
const pool=await testPool(),owner=await syntheticUser(pool),other=await syntheticUser(pool),repo=safetyRepository(pool),workspaces=workspaceRepository(pool),origin="https://finbridge.invalid";
await workspaces.save(owner,{revision:0,mutationId:randomUUID(),data:workspaceFixture()});
const saved=()=>repo.read(owner);
async function request(body,{id=owner,trusted=true,emailAvailable=true}={}) {
 const revision=(await repo.read(id)).revision;
 return handleSafety(new Request(origin+"/api/safety",{method:"POST",headers:{"content-type":"application/json","x-finbridge-workspace-owner":id,origin:trusted?origin:"https://foreign.invalid"},body:JSON.stringify({revision,...body})}),id,origin,repo,emailAvailable);
}
after(async()=>{await cleanupFinance(pool,[owner,other]);await pool.end();});
test("schema migration preserves rows and reads authoritative database financial records",async()=>{await pool.query(SAFETY_SQL);const doc=await saved();assert.equal(doc.revision,0);assert.equal(doc.sourceId,"database");assert.equal(doc.snapshot.transactions[0].amount,850);});
test("safety projection matches the full relational reader in one query without leaking another account", async () => {
 const client = await pool.connect();
 try {
  const fallback = workspaceFixture(), full = await readFinanceTables(client, owner, fallback);
  let calls = 0;
  const measured = { query(...args) { calls++; return client.query(...args); } };
  const minimal = await readSafetyFinanceTables(measured, owner, fallback);
  assert.equal(calls, 1);
  assert.deepEqual(safetySnapshot(minimal, "UTC"), safetySnapshot(full, "UTC"));
  const foreign = await readSafetyFinanceTables(client, other, fallback);
  assert.deepEqual(foreign.wallets, []); assert.deepEqual(foreign.transactions, []); assert.deepEqual(foreign.goals, []);
 } finally { client.release(); }
});
test("safety reads exclude bulky chat, receipts and transaction notes without changing financial results", async () => {
 const client = await pool.connect();
 try {
  await client.query("BEGIN");
  const expected = safetySnapshot(await readFinanceTables(client, owner, workspaceFixture()), "UTC");
  await client.query("UPDATE finbridge_workspaces SET data=data || jsonb_build_object('receiptDraft',repeat('r',250000),'planningChat',jsonb_build_array(jsonb_build_object('role','user','text',repeat('c',250000)))) WHERE user_id=$1", [owner]);
  await client.query("UPDATE finbridge_transactions SET data=data || jsonb_build_object('note',repeat('n',250000)) WHERE user_id=$1", [owner]);
  const oldRows = await client.query("SELECT data,updated_at FROM finbridge_workspaces WHERE user_id=$1", [owner]);
  const oldBytes = Buffer.byteLength(JSON.stringify(oldRows.rows));
  let bytes = 0;
  const measured = { async query(...args) { const result = await client.query(...args); bytes += Buffer.byteLength(JSON.stringify(result.rows)); return result; } };
  const workspace = await safetyWorkspace(measured, owner);
  assert.deepEqual(safetySnapshot(workspace.data, "UTC"), expected);
  assert.equal(workspace.data.planningChat, undefined);
  assert.equal(workspace.data.receiptDraft, undefined);
  assert.equal(workspace.data.transactions[0].note, undefined);
  assert.ok(bytes < oldBytes / 10, `safety query result bytes ${bytes} must be less than a tenth of ${oldBytes}`);
  console.log(`Synthetic safety payload: full workspace ${oldBytes} bytes; projected reads ${bytes} bytes`);
  assert.equal(await safetyWorkspace(measured, other), null);
 } finally { await client.query("ROLLBACK"); client.release(); }
});

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
test("selected read touches only the requested event belonging to this account",async()=>{
 const original=(await saved()).events[0], first=randomUUID(), second=randomUUID(), foreign=randomUUID();
 for(const [id,userId] of [[first,owner],[second,owner],[foreign,other]]){const event={...original,id,ruleId:"synthetic-selected",read:false,emailStatus:"off"};await pool.query("INSERT INTO finbridge_safety_events(id,user_id,event,created_at) VALUES($1,$2,$3,$4)",[id,userId,JSON.stringify(event),event.createdAt]);}
 const rules=JSON.stringify((await saved()).rules), before=(await saved()).revision;
 assert.equal((await request({action:"read",ids:[]})).status,400);
 assert.equal((await request({action:"read",ids:Array(101).fill(first)})).status,400);
 assert.equal((await saved()).revision,before);
 assert.equal((await request({action:"read",ids:[first,foreign]})).status,200);
 const rows=(await pool.query("SELECT id,event FROM finbridge_safety_events WHERE id=ANY($1::text[])",[[first,second,foreign]])).rows;
 assert.equal(rows.find(row=>row.id===first).event.read,true);
 assert.equal(rows.find(row=>row.id===second).event.read,false);
 assert.equal(rows.find(row=>row.id===foreign).event.read,false);
 assert.equal(JSON.stringify((await saved()).rules),rules);
});
test("GET has no writes and marking read retains financial data",async()=>{const before=await saved();assert.equal((await handleSafety(new Request(origin+"/api/safety",{headers:{"x-finbridge-workspace-owner":owner}}),owner,origin,repo,true)).status,200);assert.equal((await saved()).revision,before.revision);assert.equal((await request({action:"read"})).status,200);assert.ok((await saved()).events.every(e=>e.read));});
test("worker sends a bounded batch and never resends accepted reminders",async()=>{
 await pool.query("UPDATE finbridge_safety SET document=jsonb_set(document,'{syncedAt}',to_jsonb($2::text)) WHERE user_id=$1",[owner,new Date(Date.now()-26*3600000).toISOString()]);
 let calls=0;await runSafetyWorker(pool,async(to,language)=>{calls++;assert.equal(to,owner+"@example.invalid");assert.equal(language,"en");return "accepted";});assert.equal(calls,1);
 const acceptedBefore=(await pool.query("SELECT id FROM finbridge_safety_events WHERE user_id=$1 AND event->>'emailStatus'='accepted'",[owner])).rows.map(row=>row.id);assert.equal(acceptedBefore.length,1);
 await runSafetyWorker(pool,async()=>{calls++;return "accepted";});assert.equal(calls,2);
 const acceptedAfter=(await pool.query("SELECT id,attempts FROM finbridge_safety_events WHERE user_id=$1 AND event->>'emailStatus'='accepted'",[owner])).rows;assert.ok(acceptedBefore.every(id=>acceptedAfter.some(row=>row.id===id&&row.attempts===1)));
});
test("transaction worker lock excludes another worker and is released on rollback",async()=>{
 const guard=await pool.connect();
 try {
  await guard.query("BEGIN");await guard.query("SELECT pg_advisory_xact_lock(17961015,1)");
  let calls=0;const result=await runSafetyWorker(pool,async()=>{calls++;return "accepted";});assert.equal(result.busy,true);assert.equal(calls,0);
 }finally{await guard.query("ROLLBACK");guard.release();}
 const legacy=await pool.connect();
 try{await legacy.query("SELECT pg_advisory_lock(17961015)");const result=await runSafetyWorker(pool,async()=>"accepted");assert.notEqual(result.busy,true);}finally{await legacy.query("SELECT pg_advisory_unlock(17961015)");legacy.release();}
 const check=await pool.connect();
 try{await check.query("BEGIN");assert.equal((await check.query("SELECT pg_try_advisory_xact_lock(17961015,1) AS locked")).rows[0].locked,true);}finally{await check.query("ROLLBACK");check.release();}
});
test("removed group conditions are archived; invalid grouped edit cannot save partially",async()=>{const old=await saved();const rules=old.rules.filter(r=>r.id!=="forecast-100");assert.equal((await request({action:"saveGroup",groupId,rules})).status,200);assert.equal((await saved()).rules.find(r=>r.id==="forecast-100").archived,true);assert.equal((await pool.query("SELECT archived FROM finbridge_alert_rules WHERE user_id=$1 AND id='forecast-100'",[owner])).rows[0].archived,true);});
test("ambiguous email result is not blindly resent; pause cancels queued mail",async()=>{
 const r={...ruleFixture(),id:"unknown-rule",unit:"amount",threshold:760,email:true};await request({action:"save",rule:r});let calls=0;await runSafetyWorker(pool,async()=>{calls++;return "unknown";});await runSafetyWorker(pool,async()=>{calls++;return "accepted";});assert.equal(calls,1);assert.equal((await saved()).events.find(e=>e.ruleId===r.id).emailStatus,"unknown");
 const pause={...r,id:"pause-rule",threshold:750};await request({action:"save",rule:pause});await request({action:"save",rule:{...pause,active:false}});assert.equal((await saved()).events.find(e=>e.ruleId===pause.id).emailStatus,"cancelled");
});
test("workspace edits refresh derived alert snapshots transactionally",async()=>{const r=await workspaces.read(owner);r.data.transactions[0].amount=900;await workspaces.save(owner,{revision:r.revision,mutationId:randomUUID(),data:r.data});assert.equal((await saved()).snapshot.transactions[0].amount,900);});
test("database request limits reject excess writes",async()=>{await pool.query("UPDATE finbridge_safety_limits SET requests=60,window_at=CURRENT_TIMESTAMP WHERE user_id=$1",[owner]);const before=(await saved()).revision;assert.equal((await request({action:"read"})).status,429);assert.equal((await saved()).revision,before);await pool.query("UPDATE finbridge_safety_limits SET requests=0 WHERE user_id=$1",[owner]);});
test("closed account retains financial records and rules while blocking access and email",async()=>{const before=(await saved()).rules.length;await deactivateAccountLifecycle(pool,{userId:owner,secret:"synthetic-only-lifecycle-secret-".repeat(2)});await assert.rejects(repo.read(owner),/UNAUTHENTICATED/);let calls=0;await runSafetyWorker(pool,async()=>{calls++;return "accepted";});assert.equal(calls,0);assert.equal((await pool.query("SELECT document FROM finbridge_safety WHERE user_id=$1",[owner])).rows[0].document.rules.length,before);});
