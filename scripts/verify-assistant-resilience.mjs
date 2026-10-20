import test from "node:test";
import assert from "node:assert/strict";
import { assistantSmallTalk, recoverTransactionDraft } from "../src/lib/assistant-resilience.ts";
import { FINN_VOICE_POLICY, finnChatCopy } from "../src/lib/finn-voice.ts";

test("Finn's shared voice keeps draft, error and completion claims separate in every language", () => {
  for (const language of ["vi", "en", "zh"]) {
    const copy = finnChatCopy[language];
    for (const value of Object.values(copy)) {
      assert.ok(value.length > 0);
      assert.doesNotMatch(value, /Gemini|AI Studio|API key|localStorage/i);
    }
    assert.match(copy.draftReady, /chưa lưu|not saved|尚未保存/);
    assert.match(copy.greeting, /Finn/);
    assert.match(copy.timeout, /thử lại|retry|重试/);
    assert.notEqual(copy.timeout, copy.rateLimit);
    assert.notEqual(copy.rateLimit, copy.configuration);
  }
  assert.match(FINN_VOICE_POLICY, /Only claim saved, created, changed or deleted after the application confirms success/);
  assert.match(FINN_VOICE_POLICY, /Do not promise background monitoring/);
  assert.match(FINN_VOICE_POLICY, /never override validation, authorization, confirmations/);
});

const state=()=>({wallets:[{id:"vnd",name:"Vietinbank",currency:"VND"},{id:"cny",name:"Alipay",currency:"CNY"},{id:"usd",name:"AmericaBank",currency:"USD"}],categories:["Thức ăn & Đồ uống"],categoryMeta:{"Thức ăn & Đồ uống":{type:"expense",icon:"🍔",children:[]}},goals:[],fixedExpenses:[]});
const input=message=>({message,batchId:"stable-batch",today:"2026-10-19",selectedWalletId:null,language:"vi"});
test("small talk is whole-message only and never swallows financial instructions",()=>{
  for(const message of ["chào finn","Xin chào Finn!","Hello Finn","你好Finn","bạn tên gì"])assert.match(assistantSmallTalk(message,"vi"),/Finn/);
  for(const message of ["chào Finn, ăn sáng 10k","hello, delete my budget","chào Finn tôi còn bao nhiêu tiền"])assert.equal(assistantSmallTalk(message,"vi"),null);
});
test("recovery retains amount, currency, owned category and date without modifying state",()=>{
  const data=state(),before=structuredClone(data);
  for(const [message,amount,currency,wallet] of [["ăn sáng 25k",25000,"VND","vnd"],["ăn sáng 350k",350000,"VND","vnd"],["ăn sáng 1,5 triệu",1500000,"VND","vnd"],["ăn sáng 10 đô",10,"USD","usd"],["ăn sáng 10 nghìn tệ",10000,"CNY","cny"]]){
    const result=recoverTransactionDraft(input(message),data),draft=result.drafts[0];
    assert.equal(draft.amount,amount,message);assert.equal(draft.currency,currency,message);assert.equal(draft.wallet,wallet,message);assert.equal(draft.category,data.categories[0]);assert.equal(draft.date,"2026-10-19");assert.equal(draft.id,"stable-batch:0");
  }
  assert.deepEqual(data,before);
});
test("ambiguous wallets require selection; no matching wallet produces no draft",()=>{
  const data=state();data.wallets.push({id:"cash",name:"Cash",currency:"VND"});
  const ambiguous=recoverTransactionDraft(input("ăn sáng 10k"),data).drafts[0];assert.equal(ambiguous.wallet,null);assert.ok(ambiguous.needsReview.length);
  const selected=recoverTransactionDraft({...input("ăn sáng 10k"),selectedWalletId:"cash"},data).drafts[0];assert.equal(selected.wallet,"cash");
  data.wallets=data.wallets.filter(w=>w.currency!=="CNY");const missing=recoverTransactionDraft(input("ăn sáng 100 tệ"),data);assert.deepEqual(missing.drafts,[]);assert.match(missing.reply,/CNY/);
});
test("pending drafts, unknown categories, named currency conflicts and scenarios remain safe",()=>{
  const data=state();const first=recoverTransactionDraft(input("ăn sáng 10k"),data);
  assert.deepEqual(recoverTransactionDraft({...input("ăn sáng 20k"),pendingDrafts:first.drafts},data).drafts,[]);
  const conflict=recoverTransactionDraft(input("ăn sáng 10 đô ví Vietinbank"),data).drafts[0];assert.equal(conflict.wallet,null);assert.equal(conflict.currency,"USD");
  data.categories=[];data.categoryMeta={};assert.ok(recoverTransactionDraft(input("ăn sáng 10k"),data).drafts[0].needsReview.includes("category"));
  for(const message of ["nếu ăn sáng 10k thì sao","đừng ghi ăn sáng 10k","ngày mai ăn sáng 10k","sửa thành ăn sáng 10k","tạo ngân sách 10 triệu","chuyển 10 đô rồi ăn sáng 10k"])assert.equal(recoverTransactionDraft(input(message),data),null,message);
  assert.equal(recoverTransactionDraft({...input("ăn sáng 10k"),pendingScenario:{}},data),null);
});
