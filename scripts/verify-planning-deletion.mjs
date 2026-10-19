import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as deletion from "../src/lib/planning-deletion.ts";
import * as formatting from "../src/lib/scenario-format.ts";
import { answerFinancialQuery } from "../src/lib/financial-chat.ts";
import { modelHistory } from "../src/lib/chat-local-plan.ts";
import { workspaceSchema } from "../src/lib/workspace-model.ts";
import { createWorkspaceWriter } from "../src/lib/workspace-writer.ts";
import { isClearlyNewTransaction } from "../src/lib/conversation-intent.ts";
const state=()=>({wallets:[{id:"vnd",name:"Vietinbank",currency:"VND",initial:10000000,type:"cash"}],transactions:[{id:"paid",title:"Internet",type:"expense",amount:239000,wallet:"vnd",category:"Bills",date:"2026-10-18",note:"",fixedExpenseId:"internet",fixedExpenseDueDate:"2026-10-18",paymentConfirmation:"user"}],goals:[{id:"living",title:"Sinh hoạt",kind:"budget",amount:7000000,saved:0,currency:"VND",wallet:"vnd",date:"2026-10-01",cycle:"monthly",category:"",direction:"",person:""},{id:"tuition",title:"Học phí",kind:"budget",amount:3000000,saved:0,currency:"VND",wallet:"vnd",date:"2026-10-01",cycle:"monthly",category:"",direction:"",person:""}],fixedExpenses:[{id:"internet",title:"Tiền mạng",walletId:"vnd",budgetId:"living",amount:239000,category:"Bills",dueDate:"2026-10-18",recurrence:"monthly",reminderDays:3,active:true},{id:"rent",title:"Tiền nhà",budgetId:"living",amount:3000000,category:"Bills",dueDate:"2026-10-20",recurrence:"monthly",active:true}],categories:["Bills"],categoryMeta:{Bills:{type:"expense",icon:"🧾",children:[]}},settings:{language:"Tiếng Việt"},recurring:[],rules:[]});
const preview=(s,kind,ids=[],scope="matching",searchTerm=null)=>deletion.preparePlanningDeletion(s,{kind,ids,scope,searchTerm},randomUUID());

test("planning nouns and existing bill names cannot become transaction deletion",()=>{
 for(const text of ["tôi muốn xóa chi phí cố định","xóa khoản chi cố định","delete recurring bills","删除固定支出","tôi muốn xóa chi phí Tiền mạng"])assert.equal(deletion.explicitPlanningDeletion(text,state()),"fixed_expense",text);
 for(const text of ["xóa ngân sách này","remove budget","删除预算"])assert.equal(deletion.explicitPlanningDeletion(text,state()),"budget",text);
 for(const text of ["xóa giao dịch tiền mạng","delete transaction","ngân sách nào đang có"])assert.equal(deletion.explicitPlanningDeletion(text,state()),null,text);
 for(const text of ["xóa chi phí cố định 147k","xóa giao dịch ăn sáng 25k"])assert.equal(isClearlyNewTransaction(text),false,text);
});
test("missing names offer actual selectable items and never select all by default",()=>{
 const s=state(),before=structuredClone(s),p=preview(s,"budget");
 assert.deepEqual(p.targets.map(t=>t.title),["Sinh hoạt","Học phí"]);assert.deepEqual(p.selectedIds,[]);assert.throws(()=>deletion.applyPlanningDeletion(s,p),/CONFIRMATION/);assert.deepEqual(s,before);
});
test("new confirmation metadata persists in the existing conversation without a parallel store",()=>{
 const s=state(),proposal=preview(s,"budget",["living"]);
 s.transactionChat={messages:[{role:"assistant",text:"",planningDeletion:proposal}],drafts:[],clarifyingDraftId:null};
 const parsed=workspaceSchema.parse(s);assert.deepEqual(parsed.transactionChat.messages[0].planningDeletion.selectedIds,["living"]);
 assert.equal(deletion.planningDeletionSchema.safeParse(parsed.transactionChat.messages[0].planningDeletion).success,true);
});
test("names resolve accent-insensitively but duplicate names require selection",()=>{
 const s=state();assert.deepEqual(preview(s,"fixed_expense",[],"matching","tien mang").selectedIds,["internet"]);
 s.fixedExpenses.push({...s.fixedExpenses[0],id:"second"});assert.deepEqual(preview(s,"fixed_expense",[],"matching","Tiền mạng").selectedIds,[]);
});
test("budget deletion keeps schedules, source wallets and all recorded payments",()=>{
 const s=state(),before=structuredClone(s),p=preview(s,"budget",["living"]),next=deletion.applyPlanningDeletion(s,p);
 assert.deepEqual(next.goals.map(g=>g.id),["tuition"]);assert.equal(next.fixedExpenses.length,2);
 assert.ok(next.fixedExpenses.every(e=>e.budgetId===""&&e.walletId==="vnd"));assert.deepEqual(next.transactions,s.transactions);assert.deepEqual(next.wallets,s.wallets);assert.deepEqual(s,before);
 assert.equal(workspaceSchema.safeParse(next).success,true);
});
test("fixed schedule deletion never deletes payment history or budget limits",()=>{
 const s=state(),p=preview(s,"fixed_expense",["internet"]),next=deletion.applyPlanningDeletion(s,p);
 assert.deepEqual(next.fixedExpenses.map(e=>e.id),["rent"]);assert.deepEqual(next.transactions,s.transactions);assert.deepEqual(next.goals,s.goals);assert.equal(workspaceSchema.safeParse(next).success,true);
});
test("explicit all selects only the requested entity kind",()=>{
 const s=state(),p=preview(s,"budget",[],"all"),next=deletion.applyPlanningDeletion(s,p);
 assert.equal(next.goals.length,0);assert.equal(next.fixedExpenses.length,2);assert.equal(next.transactions.length,1);
});
test("changed or missing records invalidate a prior confirmation",()=>{
 const s=state(),p=preview(s,"fixed_expense",["internet"]);s.fixedExpenses[0].amount=250000;
 assert.throws(()=>deletion.applyPlanningDeletion(s,p),/DATA_CHANGED/);
 s.fixedExpenses=[];assert.throws(()=>deletion.applyPlanningDeletion(s,p),/DATA_CHANGED/);
});
test("cancelled, saved, empty and forged selections cannot be applied",()=>{
 const s=state(),p=preview(s,"budget",["living"]);
 for(const status of ["cancelled","confirmed","saving"])assert.throws(()=>deletion.applyPlanningDeletion(s,{...p,status}));
 assert.throws(()=>deletion.applyPlanningDeletion(s,{...p,applied:true}));assert.throws(()=>deletion.applyPlanningDeletion(s,{...p,selectedIds:["foreign"]}));assert.throws(()=>preview(s,"budget",["foreign"]));
});
test("natural confirmation and cancellation are scoped commands, not incidental words in a question",()=>{
 for(const text of ["xác nhận xóa","đồng ý","ok","confirm deletion","确认删除"])assert.equal(deletion.planningConfirmationReply(text),"confirm");
 for(const text of ["không xóa nữa","hủy yêu cầu xóa","giữ lại","cancel deletion","取消删除"])assert.equal(deletion.planningConfirmationReply(text),"cancel");
 assert.equal(deletion.planningConfirmationReply("nếu xóa thì còn bao nhiêu"),null);
});
test("a failed save retries the same workspace mutation without deleting additional records",async()=>{
 let current=state();const original=structuredClone(current),calls=[];
 const writer=createWorkspaceWriter({revision:0,initial:structuredClone(current),getState:()=>current,onStatus(){},save:async command=>{calls.push(command);if(calls.length===1)throw Object.assign(new Error("TIMEOUT"),{status:504});return {revision:1,data:command.data,updatedAt:null};}});
 const proposal=preview(current,"fixed_expense",["internet"]);
 current=deletion.applyPlanningDeletion(current,proposal);
 await assert.rejects(writer.flush());await writer.flush();
 assert.equal(calls.length,2);assert.equal(calls[0].mutationId,calls[1].mutationId);assert.deepEqual(current.fixedExpenses.map(e=>e.id),["rent"]);assert.deepEqual(current.transactions,original.transactions);
 assert.throws(()=>deletion.applyPlanningDeletion(current,{...proposal,applied:true}),/CONFIRMATION/);
});
test("budget wording does not aggregate overlapping limits or deduct a paid bill again",()=>{
 const s=state(),query={action:"budget_status",walletId:"vnd",scope:"selected",periodStart:null,periodEnd:null,category:null,searchTerm:null,transactionType:null};
 let answer=answerFinancialQuery(query,s,"vnd","2026-10-19");
 assert.match(answer,/2 ngân sách/);assert.doesNotMatch(answer,/✅ Còn lại/);assert.match(answer,/Khoản cố định chưa trả: 3,000,000 VND/);assert.match(answer,/\*\*3,761,000 VND\*\*/);
 s.goals=[s.goals[0]];answer=answerFinancialQuery(query,s,"vnd","2026-10-19");assert.doesNotMatch(answer,/Tiền mạng · 2026-10-18/);
});
test("selection replies stay attached to one pending request and context sends IDs, not financial snapshots",()=>{
 const p=preview(state(),"budget");assert.equal(deletion.planningSelectionReply("chọn Sinh hoạt",p),"living");assert.equal(deletion.planningSelectionReply("chi tiêu của tôi thế nào",p),null);
 const history=modelHistory([{role:"assistant",text:"",localOnly:true,planningDeletion:p}]);
 assert.match(history[0].text,/living/);assert.doesNotMatch(history[0].text,/7000000|signature|239000/);
 const result=modelHistory([{role:"assistant",text:"private computed data",localOnly:true,financialContext:{action:"budget_status",walletId:"vnd"},financialEntities:[{kind:"budget",id:"living",title:"Sinh hoạt"}]}]);
 assert.match(result[0].text,/Previous financial result context.*walletId="vnd".*living/);assert.doesNotMatch(result[0].text,/private computed data/);
});
test("real confirmation card has required selection, distinct cancel/confirm actions and localized effects",()=>{
 const require=createRequire(import.meta.url),m={exports:{}};
 const code=ts.transpileModule(readFileSync("src/components/sites/rolly/replica/PlanningDeletionCard.tsx","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function("require","module","exports",code)(name=>name==="@/lib/planning-deletion"?deletion:name==="@/lib/scenario-format"?formatting:require(name),m,m.exports);
 for(const language of ["vi","en","zh"]){
 const props={proposal:preview(state(),"budget"),language,busy:false,onSelect(){},onConfirm(){},onCancel(){}};
 const html=renderToStaticMarkup(React.createElement(m.exports.PlanningDeletionCard,props));assert.match(html,/<input[^>]*type="checkbox"/);assert.match(html,/<button[^>]*class="r-danger"[^>]*disabled/);
 const selected=renderToStaticMarkup(React.createElement(m.exports.PlanningDeletionCard,{...props,proposal:{...props.proposal,selectedIds:["living"]}}));assert.doesNotMatch(selected,/<button[^>]*class="r-danger"[^>]*disabled/);
 }
});
test("anomaly replies distinguish missing history from a completed comparison without exposing detection parameters",()=>{
 const q={action:"anomalies",walletId:"vnd",scope:"selected",periodStart:"2026-10-01",periodEnd:"2026-10-19",category:null,searchTerm:null,transactionType:"expense"},s=state();
 let answer=answerFinancialQuery(q,s,"vnd","2026-10-19");assert.match(answer,/chưa có đủ lịch sử/);assert.doesNotMatch(answer,/Không phát hiện|5 giao dịch|90 ngày|3 lần|trung vị|quy tắc|n=/);
 for(let i=0;i<5;i++)s.transactions.push({id:`history-${i}`,title:"usual",amount:10000,type:"expense",wallet:"vnd",category:"Bills",date:`2026-09-${String(i+1).padStart(2,"0")}`,note:""});
 answer=answerFinancialQuery(q,s,"vnd","2026-10-19");assert.match(answer,/Internet/);assert.match(answer,/10,000 VND/);assert.doesNotMatch(answer,/90 ngày|3 lần|trung vị|n=|gian lận/);
 s.transactions[0].amount=10000;answer=answerFinancialQuery(q,s,"vnd","2026-10-19");assert.match(answer,/chưa thấy khoản nào tăng đột biến/);
});
