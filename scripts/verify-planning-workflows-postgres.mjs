import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { testPool, syntheticUser, cleanupFinance, workspaceFixture } from "./workspace-fixtures.mjs";
import { workspaceRepository } from "../src/lib/workspace-repository.ts";
import { safetyRepository } from "../src/lib/safety-repository.ts";
import { handleSafety } from "../src/lib/safety-handler.ts";
import { handleWorkspace } from "../src/lib/workspace-handler.ts";
import { budgetSummary } from "../src/components/finbridge/workspace/planningModel.ts";
import { recordFixedExpensePayment } from "../src/lib/fixed-expense-payments.ts";
const pool=await testPool(), owner=await syntheticUser(pool), other=await syntheticUser(pool), repo=workspaceRepository(pool), safety=safetyRepository(pool), origin="https://finbridge.invalid";
after(async()=>{await cleanupFinance(pool,[owner,other]);await pool.end();});
const save=async(data)=>repo.save(owner,{revision:(await repo.read(owner)).revision,mutationId:randomUUID(),data});
test("full planning workflow persists and reloads budgets, independent bills, payments and pause state",async()=>{
  const data=workspaceFixture();data.fixedExpenses.push({...data.fixedExpenses[0],id:"independent",budgetId:"",walletId:"bank",title:"Independent bill"});
  await save(data);let loaded=await repo.read(owner);
  assert.equal(loaded.data.fixedExpenses.find(e=>e.id==="independent").budgetId,"");
  const date=new Date().toISOString().slice(0,10);
  const paid=recordFixedExpensePayment(loaded.data,"rent",{dueDate:date,paidOn:date,amount:45,walletId:"bank",note:"Synthetic",transactionId:"payment"},date);
  await save(paid);loaded=await repo.read(owner);
  assert.equal(budgetSummary(loaded.data,loaded.data.goals[0],date).afterCommitments,105);
  loaded.data.fixedExpenses.find(e=>e.id==="independent").active=false;await save(loaded.data);
  assert.equal((await repo.read(owner)).data.fixedExpenses.find(e=>e.id==="independent").active,false);
  assert.equal((await repo.read(other)).data,null);
});
test("invalid API plans roll back every table and preserve revision",async()=>{
  const base=await repo.read(owner);
  for(const mutate of [s=>s.goals[0].amount=-1,s=>s.goals[0].cycle="invalid",s=>s.fixedExpenses[0].category="Salary",s=>s.wallets[0].currency="CNY"]){
    const data=structuredClone(base.data);mutate(data);
    const request=new Request(origin+"/api/workspace",{method:"POST",headers:{origin,"content-type":"application/json","x-finbridge-workspace-owner":owner},body:JSON.stringify({data,revision:base.revision,mutationId:randomUUID()})});
    assert.equal((await handleWorkspace(request,owner,origin,repo)).status,400);
    assert.equal((await repo.read(owner)).revision,base.revision);
  }
});
test("canonical payment columns override stale JSON copies when reloading",async()=>{
  await pool.query("UPDATE finbridge_transactions SET data=data - 'fixedExpenseId' - 'fixedExpenseDueDate' - 'paymentConfirmation' WHERE user_id=$1 AND id='payment'",[owner]);
  const row=(await repo.read(owner)).data.transactions.find(t=>t.id==="payment");
  assert.equal(row.fixedExpenseId,"rent"); assert.equal(row.paymentConfirmation,"user");
});
test("stale account tabs cannot read or mutate another account's safety state",async()=>{
  const before=await safety.read(owner);
  for(const method of ["GET","POST"]){
    const request=new Request(origin+"/api/safety",{method,headers:{origin,"content-type":"application/json","x-finbridge-workspace-owner":other},...(method==="POST"?{body:JSON.stringify({action:"read",revision:before.revision})}:{})});
    assert.equal((await handleSafety(request,owner,origin,safety,false)).status,409);
  }
  assert.equal((await safety.read(owner)).revision,before.revision);
});
test("GET recomputes current safety values without writes or historical event mutation",async()=>{
  const doc=await safety.read(owner), rule={id:randomUUID(),name:"Synthetic reserve",kind:"reserve",targetId:"bank",basis:"actual",unit:"amount",threshold:2000,active:true,email:false,language:"en"};
  await safety.mutate(owner,doc.revision,"save",d=>({...d,rules:[rule]}));
  const history=(await safety.read(owner)).events;
  await pool.query("UPDATE finbridge_safety SET document=jsonb_set(document,'{evaluated}','{}') WHERE user_id=$1",[owner]);
  const updated=await safety.read(owner);assert.equal(updated.evaluated[rule.id].state,"alarm");assert.deepEqual(updated.events,history);
  const persisted=(await pool.query("SELECT document FROM finbridge_safety WHERE user_id=$1",[owner])).rows[0].document;
  assert.deepEqual(persisted.evaluated,{},"GET remains read-only");
});
