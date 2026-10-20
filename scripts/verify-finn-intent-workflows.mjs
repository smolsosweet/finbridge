import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import ts from "typescript";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {answerFinancialQuery} from "../src/lib/financial-chat.ts";
import {categoryDialogueResult,categoryDialogueSchema,resolveCategoryChoice} from "../src/lib/category-dialogue.ts";
import {prepareCategoryOperation,applyCategoryOperation} from "../src/lib/category-operations.ts";
import {transactionDeletionSelection,explicitlyRequestsDeleteAll} from "../src/lib/transaction-deletion.ts";
import {modelHistory} from "../src/lib/chat-local-plan.ts";
const state=()=>({wallets:[{id:"vnd",name:"Vietinbank",currency:"VND",initial:10000000,type:"cash"},{id:"cny",name:"Alipay",currency:"CNY",initial:10000,type:"cash"}],categories:["Food","Dining","Shopping","Salary"],categoryMeta:Object.fromEntries(["Food","Dining","Shopping","Salary"].map(name=>[name,{type:name==='Salary'?'income':'expense',icon:"",children:[]}])),transactions:[{id:"small",title:"Small breakfast",amount:25000,wallet:"vnd",currency:"VND",category:"Food",type:"expense",date:"2026-10-19",note:""},{id:"largest",title:"Laptop",amount:3000000,wallet:"vnd",currency:"VND",category:"Shopping",type:"expense",date:"2026-09-19",note:""},{id:"yuan",title:"Tuition",amount:5000,wallet:"cny",currency:"CNY",category:"Shopping",type:"expense",date:"2026-10-19",note:""}],goals:[],fixedExpenses:[],recurring:[],settings:{language:"en"},rules:[]});
const query={action:"largest_transaction",walletId:"vnd",scope:"selected",periodStart:null,periodEnd:null,category:null,searchTerm:null,transactionType:null};
const criteria={scope:"matching",amount:null,walletId:null,periodStart:null,periodEnd:null,category:null,searchTerm:null,type:null};
const command=(operation,patch={})=>({operation,sources:[],target:null,type:null,...patch});
test("largest recorded expense is calculated, not a list; period, ties and currencies remain separate",()=>{
 const s=state(),before=structuredClone(s);let text=answerFinancialQuery(query,s,"vnd","2026-10-20");assert.match(text,/Laptop.*3,000,000 VND/);assert.doesNotMatch(text,/Small breakfast|Tuition/);
 text=answerFinancialQuery({...query,periodStart:"2026-10-01"},s,"vnd","2026-10-20");assert.match(text,/Small breakfast/);assert.doesNotMatch(text,/Laptop/);
 s.transactions.push({...s.transactions[1],id:"tied",title:"Equal purchase"});text=answerFinancialQuery({...query,scope:"all",walletId:null},s,"vnd","2026-10-20");assert.match(text,/Laptop/);assert.match(text,/Equal purchase/);assert.match(text,/Tuition.*5,000 CNY/);assert.doesNotMatch(text,/Small breakfast/);assert.deepEqual(before.transactions,s.transactions.slice(0,3));
});
test("generic deletion browses recent records with none selected, explicit all and latest preserve their scope",()=>{
 const s=state(),before=structuredClone(s),generic=transactionDeletionSelection(s.transactions,criteria);assert.equal(generic.ids.length,3);assert.deepEqual(generic.selectedIds,[]);assert.equal(generic.browse,true);
 const latest=transactionDeletionSelection(s.transactions,{...criteria,relativeOrder:"latest"});assert.equal(latest.selectedIds.length,1);
 assert.equal(transactionDeletionSelection(s.transactions,{...criteria,scope:"all"}).selectedIds.length,3);
 assert.equal(explicitlyRequestsDeleteAll("Tôi muốn xóa giao dịch"),false);assert.equal(explicitlyRequestsDeleteAll("Remove everything"),true);assert.deepEqual(s,before);
});
test("creating a category collects name then type and prepares confirmation without saving",()=>{
 const s=state(),before=structuredClone(s),id=randomUUID();let step=categoryDialogueResult(command("create_category"),s,"vi",id);assert.equal(step.categoryDialogue.field,"target");assert.match(step.reply,/tên/);assert.deepEqual(step.categoryDialogue.choices,[]);
 step=categoryDialogueResult(command("create_category",{target:"Outdoor kit"}),s,"en",id);assert.equal(step.categoryDialogue.field,"type");const ready=resolveCategoryChoice(step.categoryDialogue.command,{field:"type",value:"expense"},s,"en",id);assert.equal(categoryDialogueResult(ready,s,"en",id).categoryDialogue,null);assert.deepEqual(s,before);
 const confirmed=applyCategoryOperation(s,prepareCategoryOperation(s,ready,id));assert.ok(confirmed.categories.includes("Outdoor kit"));assert.equal(confirmed.categoryMeta["Outdoor kit"].type,"expense");assert.deepEqual(confirmed.transactions,s.transactions);
 assert.ok(categoryDialogueResult(command("create_category",{target:"Food",type:"expense"}),s,"en",id).categoryDialogue.error);
});
test("merge collects actual same-type source/destination options, preserves references and requires confirmation",()=>{
 const s=state(),before=structuredClone(s),id=randomUUID();let step=categoryDialogueResult(command("merge_categories",{type:"expense"}),s,"vi",id);assert.equal(step.categoryDialogue.field,"sources");assert.ok(!step.categoryDialogue.choices.some(c=>c.value==="Salary"));
 const source=resolveCategoryChoice(step.categoryDialogue.command,{field:"sources",value:"Food"},s,"vi",id);step=categoryDialogueResult(source,s,"vi",id);assert.equal(step.categoryDialogue.field,"target");assert.ok(!step.categoryDialogue.choices.some(c=>c.value==="Food"||c.value==="Salary"));assert.throws(()=>resolveCategoryChoice(source,{field:"target",value:"foreign"},s,"vi",id));
 const ready=resolveCategoryChoice(step.categoryDialogue.command,{field:"target",value:"Dining"},s,"vi",id);assert.equal(categoryDialogueResult(ready,s,"vi",id).categoryDialogue,null);assert.deepEqual(s,before);
 const proposal=prepareCategoryOperation(s,ready,id);assert.throws(()=>applyCategoryOperation(s,{...proposal,status:"cancelled"}));const next=applyCategoryOperation(s,proposal);assert.equal(next.transactions[0].category,"Dining");assert.equal(next.transactions[0].amount,25000);assert.equal(next.transactions[0].wallet,"vnd");
});
test("unavailable and wrong-type categories are never accepted from remembered or forged parameters",()=>{
 const s=state(),id=randomUUID();s.categoryMeta.Food.archived=true;
 const result=categoryDialogueResult(command("merge_categories",{sources:["Food","foreign"],target:"Dining",type:"expense"}),s,"en",id);assert.equal(result.categoryDialogue.field,"sources");assert.deepEqual(result.categoryDialogue.command.sources,[]);
 const mismatch=categoryDialogueResult(command("merge_categories",{sources:["Dining"],target:"Salary"}),s,"en",id);assert.match(mismatch.categoryDialogue.error,/same.*type/);
 const h=modelHistory([{role:"assistant",text:"Old narrative",localOnly:true,categoryDialogue:result.categoryDialogue}]);assert.match(h[0].text,/Pending category request/);assert.doesNotMatch(h[0].text,/Old narrative/);
});

// Execute the actual JSX choices and handlers; no copied component or static mock list.
const source=ts.createSourceFile("Transactions.tsx",readFileSync("src/components/finbridge/workspace/Transactions.tsx","utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let expression;
function visit(node){if(ts.isJsxExpression(node)&&node.expression?.getText(source).startsWith("message.categoryDialogue &&"))expression=node.expression.getText(source);ts.forEachChild(node,visit);}visit(source);assert.ok(expression);
const code=ts.transpileModule(`exports.render=(message,messages,index,busy,committing,categoryBusy,send,setMessages,categoryDialogueSchema,categoryCommandCopy)=>(${expression});`,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};new Function("require","exports",code)(createRequire(import.meta.url),module.exports);
test("actual category controls are interactive, escaped, disabled while busy, and stop after cancellation/new reply",()=>{
 const step=categoryDialogueResult(command("merge_categories",{type:"expense"}),state(),"en",randomUUID()).categoryDialogue;
 let messages=[{role:"assistant",text:step.question,categoryDialogue:step}],sent=[];const setMessages=fn=>messages=fn(messages),copy={cancel:"Cancel",cancelled:"Request cancelled"};
 const render=(busy=false)=>module.exports.render(messages[0],messages,0,busy,false,false,(...args)=>sent.push(args),setMessages,categoryDialogueSchema,copy);
 const element=render(),buttons=React.Children.toArray(element.props.children).flatMap(child=>Array.isArray(child)?child:[child]).filter(child=>React.isValidElement(child));
 // The choice array is flattened by React.Children.toArray.
 const choice=buttons.find(button=>button.props.children==="Food");assert.ok(choice);choice.props.onClick();assert.deepEqual(sent[0],["Food",undefined,{field:"sources",value:"Food"}]);
 assert.match(renderToStaticMarkup(render(true)),/disabled=""/);buttons.find(button=>button.props.children==="Cancel").props.onClick();assert.equal(render(),false);
 assert.equal(messages.at(-1).categoryDialogue.status,"cancelled");assert.match(modelHistory(messages).at(-1).text,/Cancelled category request/);
});
