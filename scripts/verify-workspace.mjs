import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorkspaceWriter } from "../src/lib/workspace-writer.ts";
import { workspaceSchema } from "../src/lib/workspace-model.ts";
import { addBudgetCategory, expenseCategoriesForWallet } from "../src/lib/budget-categories.ts";
import { workspaceFixture } from "./workspace-fixtures.mjs";
test("workspace rejects invalid references, duplicates and silent monetary rounding", () => {
  const s=workspaceFixture(); assert.ok(workspaceSchema.safeParse(s).success);
  for(const change of [s=>s.transactions[0].wallet="foreign",s=>s.goals[0].wallet="foreign",s=>s.fixedExpenses[0].budgetId="foreign",s=>s.walletCategories.bank.push("foreign"),s=>s.wallets.push(s.wallets[0]),s=>s.transactions[0].amount=0.00001]) {const d=structuredClone(s);change(d);assert.equal(workspaceSchema.safeParse(d).success,false);}
});
test("new budget category belongs to selected wallet, is reusable, and cannot replace income",()=>{
  const s=workspaceFixture(), added=addBudgetCategory(s,"bank","  Books  ");
  assert.equal(added.name,"Books"); assert.ok(expenseCategoriesForWallet(added.state,"bank").includes("Books")); assert.ok(!expenseCategoriesForWallet(added.state,"ali").includes("Books"));
  assert.equal(addBudgetCategory(added.state,"bank","books").state.categories.filter(n=>n==="Books").length,1);
  assert.throws(()=>addBudgetCategory(s,"bank","Salary"),/CATEGORY_IS_INCOME/); assert.throws(()=>addBudgetCategory(s,"foreign","Books"));assert.ok(!s.categories.includes("Books"));
});
test("writer serializes in-flight edits without losing changes",async()=>{
  let state=workspaceFixture(), resolve; const calls=[], statuses=[];
  const w=createWorkspaceWriter({revision:1,initial:structuredClone(state),getState:()=>state,onStatus:s=>statuses.push(s),save:async value=>{calls.push(structuredClone(value));if(calls.length===1)await new Promise(r=>resolve=r);return {revision:value.revision+1,data:value.data,updatedAt:null};}});
  state.settings.name="First";const promise=w.flush();state.settings.name="Second";const same=w.flush();assert.equal(promise,same);resolve();await promise;
  assert.deepEqual(calls.map(c=>[c.revision,c.data.settings.name]),[[1,"First"],[2,"Second"]]);assert.equal(w.dirty(),false);assert.equal(statuses.at(-1),"saved");
});
test("ambiguous retries reuse mutation id and payload; conflict blocks overwriting",async()=>{
  let state=workspaceFixture(), n=0;const calls=[];
  const w=createWorkspaceWriter({revision:0,initial:structuredClone(state),getState:()=>state,onStatus:()=>{},save:async value=>{calls.push(structuredClone(value));if(++n===1)throw new Error("NETWORK");return {revision:value.revision+1,data:value.data,updatedAt:null};}});
  state.settings.name="A";await assert.rejects(w.flush());state.settings.name="B";await w.flush();assert.deepEqual(calls[0],calls[1]);assert.equal(calls[2].data.settings.name,"B");
  const c=createWorkspaceWriter({revision:0,initial:structuredClone(state),getState:()=>state,onStatus:()=>{},save:async()=>{throw new Error("WORKSPACE_CONFLICT");}});state.settings.name="C";await assert.rejects(c.flush());await assert.rejects(c.flush());assert.ok(c.dirty());
});
