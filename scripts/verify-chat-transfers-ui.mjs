import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as model from "../src/lib/transfer-chat-model.ts";
import { transferChatWriteResult } from "../src/lib/transfer-chat.ts";
import { TRANSFER_COPY } from "../src/components/transfers/transfer-copy.ts";

const require = createRequire(import.meta.url), module = { exports: {} };
const code = ts.transpileModule(readFileSync("src/components/sites/rolly/replica/ChatTransferCard.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function("require", "module", "exports", code)(name => {
  if (name === "@/lib/transfer-chat-model") return model;
  if (name.endsWith(".module.css")) return { default: new Proxy({}, { get: (_, key) => String(key) }) };
  return require(name);
}, module, module.exports);
const { ChatTransferCard } = module.exports;
const proposal = { id: "00000000-0000-4000-8000-000000000001", request:{operation:"approve"},status:"review",title:"Transfers",text:"Check recipient",sandbox:true,rows:[{label:"School",value:"Synthetic recipient"}],choices:[],write:{endpoint:"sandbox",command:{action:"approve",mutationId:"00000000-0000-4000-8000-000000000001",id:"00000000-0000-4000-8000-000000000002",acknowledge:true}},acknowledgement:true };
const render = (result, language="en", busy=false) => renderToStaticMarkup(React.createElement(ChatTransferCard,{result,language,busy,onChoice(){},onConfirm(){},onCancel(){},onOpen(){}}));

test("reference header does not repeat its title",()=>{
  const title=model.transferChatCopy.vi.reference;
  const html=render({...proposal,title,sandbox:false,write:undefined,acknowledgement:false,status:"answer",rows:[]},"vi");
  assert.equal(html.match(/<header>(.*?)<\/header>/)[1].split(title).length-1,1);
});

test("real card requires acknowledgement before approval/execution and clearly labels sandbox in all languages",()=>{
  for (const language of ["en","vi","zh"]) {
    const html=render(proposal,language);assert.match(html,/type="checkbox"/);assert.match(html,/disabled=""[^>]*>[^<]+<\/button>/);
    assert.ok(html.includes(model.transferChatCopy[language].sandbox));assert.ok(html.includes(model.transferChatCopy[language].acknowledge));
  }
});
test("real currency choices are interactive; confirmed actions cannot be repeated; details are compact",()=>{
  const html=render({...proposal,acknowledgement:false,write:undefined,status:"clarification",choices:[{label:"CNY",patch:{sourceCurrency:"CNY"}}],rows:Array.from({length:8},(_,i)=>({label:"row "+i,value:"value"}))});
  assert.match(html,/<button[^>]*>CNY<\/button>/);assert.match(html,/<details>/);
  assert.doesNotMatch(render({...proposal,status:"confirmed"}),/type="checkbox"/);
  assert.doesNotMatch(render({...proposal,status:"confirmed"}),/>Confirm<\/button>/);
});
test("unknown outcomes retain retry, disable cancellation, and busy state disables actions",()=>{
  const html=render({...proposal,status:"failed",acknowledgement:false,uncertain:true,error:"Outcome unknown"});
  assert.match(html,/disabled=""[^>]*>Cancel request/);assert.match(html,/>Retry the same request/);assert.match(html,/role="alert"/);
  assert.match(render({...proposal,status:"saving"},"en",true),/aria-busy="true"/);
});

// Execute the actual nested ChatPage handlers with synthetic I/O, without
// duplicating their implementation or needing a real account/payment.
function clientHarness(fetch) {
  const source = ts.createSourceFile("Transactions.tsx",readFileSync("src/components/sites/rolly/replica/Transactions.tsx","utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const names = new Set(["updateTransfer","confirmTransfer","cancelTransfer","chooseTransfer"]), found=[];
  function visit(node){if(ts.isFunctionDeclaration(node)&&node.name&&names.has(node.name.text))found.push(node.getText(source));ts.forEachChild(node,visit);}visit(source);
  assert.equal(found.length,names.size);
  const body = ts.transpileModule(found.join("\n"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  return new Function("fetch","transferChatWriteSchema","transferChatResultSchema","transferChatCopy","transferChatWriteResult","TRANSFER_COPY",`
    let messages=[{role:"assistant",text:"",transfer:arguments[6]}], owner="alice";
    const workspaceOwner=()=>owner, conversationGeneration={current:0}, state={settings:{language:"vi"}}, resolveLanguage=()=>"vi";
    const busy=false,committing=false,categoryBusy=false,deletingId=null,transferRequestLock={current:false};
    let transferBusy=false;
    const setTransferBusy=value=>{transferBusy=value},setMessages=fn=>{messages=fn(messages)};
    ${body}
    return {confirmTransfer,cancelTransfer,chooseTransfer,get messages(){return messages},get busy(){return transferBusy},switchOwner(){owner="bob"}};
  `)(fetch,model.transferChatWriteSchema,model.transferChatResultSchema,model.transferChatCopy,transferChatWriteResult,TRANSFER_COPY,proposal);
}
test("actual confirmation handler locks duplicates, retains uncertain key after later rejection and recovers once",async()=>{
  const sent=[];let finish;
  const h=clientHarness(async(url,options)=>{sent.push(JSON.parse(options.body));if(sent.length===1)return new Promise(resolve=>{finish=resolve});return sent.length===2?Response.json({error:"UNAUTHENTICATED"},{status:401}):Response.json({mode:"sandbox",bills:[],quotes:[],plans:[{id:"00000000-0000-4000-8000-000000000002",status:"approved",bill:{id:"b"},quote:{total:1,receiveAmount:"1",currency:"CNY",rate:"1",provider:"ALIPAY",transferFee:0,fxMarkup:0,conversion:1,arrivalDate:"2026-10-20",latestSendDate:"2026-10-19",expiresAt:"2026-10-19T06:05:00Z"}}],resultId:"00000000-0000-4000-8000-000000000002"});});
  const first=h.confirmTransfer(proposal);await h.confirmTransfer(proposal);assert.equal(sent.length,1);
  finish(Response.json({error:"UNAVAILABLE"},{status:503}));await first;
  const unknown=h.messages[0].transfer;assert.equal(unknown.uncertain,true);assert.equal(unknown.status,"failed");
  h.cancelTransfer(unknown);assert.equal(h.messages[0].transfer.status,"failed");
  await h.confirmTransfer(unknown);assert.equal(h.messages[0].transfer.uncertain,true);
  await h.confirmTransfer(h.messages[0].transfer);assert.equal(h.messages[0].transfer.status,"confirmed");assert.equal(h.messages[0].transfer.uncertain,false);
  assert.deepEqual(sent,[proposal.write.command,proposal.write.command,proposal.write.command]);
});
test("actual client handler ignores a response after the signed-in owner changes",async()=>{
  let finish;const h=clientHarness(()=>new Promise(resolve=>{finish=resolve}));
  const pending=h.confirmTransfer(proposal);h.switchOwner();finish(Response.json({error:"UNAVAILABLE"},{status:503}));await pending;
  assert.notEqual(h.messages[0].transfer.status,"confirmed");
});
