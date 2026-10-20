import assert from "node:assert/strict";
import test from "node:test";
import {randomUUID} from "node:crypto";
import {AiRequestTiming,timeDatabaseClient} from "../src/lib/ai-request-timing.ts";
import {workspaceRepository} from "../src/lib/workspace-repository.ts";
import {readFileSync} from "node:fs";
import ts from "typescript";
import {workspaceProposalSchema,emptyWorkspaceAction,workspaceActionCopy} from "../src/lib/workspace-actions.ts";

test("query timing remains request-local on a reused client and preserves failures and release",async()=>{
  const client={released:0,async query(sql){assert.equal(this,client);if(sql==="failure")throw new Error("synthetic-secret");return {rows:[]};},release(){assert.equal(this,client);this.released++;}};
  const original=client.query,a=new AiRequestTiming(),b=new AiRequestTiming();
  const first=timeDatabaseClient(client,a),second=timeDatabaseClient(client,b);
  await Promise.all([first.query("private-sql"),second.query("private-sql")]);
  await assert.rejects(first.query("failure"),/synthetic-secret/);first.release();
  assert.equal(client.query,original);assert.equal(client.released,1);
  assert.equal(a.snapshot().databaseCalls,2);assert.equal(b.snapshot().databaseCalls,1);
  assert.ok(a.snapshot().stagesMs.database>=0);assert.doesNotMatch(JSON.stringify(a.snapshot()),/private|secret/);
});

test("a save returns unchanged canonical data with a small SQL acknowledgement, only after COMMIT",async()=>{
  const initial={wallets:[],transactions:[],goals:[],fixedExpenses:[],recurring:[],rules:[],categories:[],categoryMeta:{},settings:{}};
  const next={...structuredClone(initial),transactionChat:{messages:[{role:"user",text:"X".repeat(32000)}],drafts:[],clarifyingDraftId:null}};
  const sqls=[],at=new Date("2026-10-20T00:00:00Z");let releaseCommit;
  const commit=new Promise(resolve=>{releaseCommit=resolve;});let enteredCommit;
  const entered=new Promise(resolve=>{enteredCommit=resolve;});
  const client={release(){},async query(sql,values){
    sqls.push(sql);
    if(sql==="COMMIT"){enteredCommit();await commit;return {rows:[]};}
    if(sql.startsWith('SELECT id FROM "user"'))return {rowCount:1,rows:[{id:"synthetic-owner"}]};
    if(sql.startsWith("SELECT * FROM finbridge_workspaces"))return {rowCount:1,rows:[{revision:0,data:initial,updated_at:at}]};
    if(sql.startsWith("SELECT jsonb_build_object")){const sections={};for(const match of sql.matchAll(/'([a-zA-Z]+)', COALESCE/g))sections[match[1]]=[];return {rows:[{sections}]};}
    if(sql.startsWith("UPDATE finbridge_workspaces")){assert.ok(sql.endsWith("RETURNING revision,updated_at"));assert.deepEqual(JSON.parse(values[2]),next);return {rows:[{revision:1,updated_at:at}]};}
    if(sql.startsWith("INSERT INTO finbridge_workspace_limits"))return {rowCount:1,rows:[{user_id:"synthetic-owner"}]};
    return {rowCount:0,rows:[]};
  }};
  const timing=new AiRequestTiming(),repo=workspaceRepository({connect:async()=>client},timing);
  let complete=false;const saving=repo.save("synthetic-owner",{revision:0,mutationId:randomUUID(),data:next}).then(value=>{complete=true;return value;});
  await entered;assert.equal(complete,false);releaseCommit();const saved=await saving;
  assert.deepEqual(saved.data,next);assert.equal(saved.revision,1);assert.equal(saved.updatedAt,at.toISOString());assert.equal(timing.snapshot().databaseCalls,sqls.length);
  const before=Buffer.byteLength(JSON.stringify({revision:1,data:next,updated_at:at})),after=Buffer.byteLength(JSON.stringify({revision:1,updated_at:at}));
  assert.ok(after<before);console.info("Synthetic SQL acknowledgement bytes (not production latency):",{before,after});
});

test("the actual chat handler renders an extracted proposal without fetching another interpretation",async()=>{
  const source=ts.createSourceFile("Transactions.tsx",readFileSync("src/components/sites/rolly/replica/Transactions.tsx","utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let block;const visit=node=>{if(ts.isIfStatement(node)&&node.expression.getText(source).includes("ai.operationIntent")&&node.expression.getText(source).includes('"create_wallet"'))block=node;ts.forEachChild(node,visit);};visit(source);assert.ok(block);
  const js=ts.transpileModule(block.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  const batchId=randomUUID(),proposal={id:batchId,actions:[{...emptyWorkspaceAction("wallet",randomUUID()),name:"Test"}],status:"collecting"};
  let calls=0,messages=[];
  const run=new Function("env",`const {ai,result,batchId,workspaceProposalSchema,workspaceActionCopy,resolveLanguage,state,setMessages,requestWorkspaceCreation,message}=env;return (async()=>{${js}})();`);
  const env={ai:{operationIntent:"create_wallet",reply:"What currency?"},batchId,workspaceProposalSchema,workspaceActionCopy,resolveLanguage:()=>"en",state:{settings:{language:"en"}},message:"new wallet",setMessages:updater=>{messages=updater(messages);},requestWorkspaceCreation:async()=>{calls++;return true;}};
  await run({...env,result:{workspaceProposal:proposal}});assert.equal(calls,0);assert.deepEqual(messages[0].workspaceProposal,proposal);
  await run({...env,result:{workspaceProposal:{...proposal,id:randomUUID()}}});assert.equal(calls,1,"mismatched request IDs never reuse another proposal");
});

test("analysis reads keep account locking and repeatable-read snapshot while excluding only conversation metadata",async()=>{
  const seed={wallets:[],transactions:[],goals:[],fixedExpenses:[],recurring:[],rules:[],categories:[],categoryMeta:{},settings:{},transactionChat:{messages:[{role:"user",text:"private"}],drafts:[],clarifyingDraftId:null}};
  const sqls=[];const owner="synthetic-owner' OR true --";
  const client={release(){},async query(sql,params){sqls.push(sql);if(params)assert.deepEqual(params,[owner]);
    if(sql.startsWith('SELECT id FROM "user"'))return{rowCount:1,rows:[{id:owner}]};
    if(sql.includes(" AS data FROM finbridge_workspaces")){assert.match(sql,/data - ARRAY\['transactionChat','planningChat','receiptDraft','onboardingDraft'\]/);const data={...seed};delete data.transactionChat;return{rows:[{data,revision:7,updated_at:new Date()}]};}
    if(sql.startsWith("SELECT jsonb_build_object")){const sections={};for(const match of sql.matchAll(/'([a-zA-Z]+)', COALESCE/g))sections[match[1]]=[];assert.equal(Object.keys(sections).length,11);return{rows:[{sections}]};}
    return{rowCount:0,rows:[]};
  }};
  const result=await workspaceRepository({connect:async()=>client}).readForAnalysis(owner);
  assert.equal(result.revision,7);assert.equal(result.data.transactionChat,undefined);
  assert.equal(sqls[0],"BEGIN ISOLATION LEVEL REPEATABLE READ");assert.equal(sqls.at(-1),"COMMIT");
  assert.ok(sqls.includes('SELECT id FROM "user" WHERE id=$1 FOR SHARE'));assert.ok(sqls.includes("SELECT 1 FROM finbridge_account_lifecycle WHERE user_id=$1"));
});
