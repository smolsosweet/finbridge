import assert from "node:assert/strict";
import {test} from "node:test";
import {randomUUID} from "node:crypto";
import QRCode from "qrcode";
import jsQR from "jsqr";
import {PNG} from "pngjs";
import {bankRecipientSchema,buildTransferQr,parseTransferQr,qrCrc,buildBankLink} from "../src/lib/bank-transfer.ts";
import {recordFixedExpensePayment,unpaidOccurrences,fixedExpensePayment,validateFixedPaymentChanges} from "../src/lib/fixed-expense-payments.ts";
import {financialOutlook,trackedBalance} from "../src/lib/financial-outlook.ts";
import {calculateScenario} from "../src/lib/scenario-planner.ts";
import {workspaceSchema} from "../src/lib/workspace-model.ts";
import {workspaceFixture} from "./workspace-fixtures.mjs";
const recipient={bankBin:"970415",accountNumber:"0000000000",accountName:"SYNTHETIC TEST",reference:"Synthetic rent"};
test("CRC matches the CCITT-FALSE reference vector and VietQR round-trips",()=>{
 assert.equal(qrCrc(new TextEncoder().encode("123456789")),"29B1");const raw=buildTransferQr(recipient,200000,"Synthetic rent");const data=parseTransferQr(raw);assert.deepEqual(data,{recipient,amount:200000});
});
test("rendered QR image decodes without any network or image upload",async()=>{
 const raw=buildTransferQr(recipient,200000,"Synthetic rent"),bytes=await QRCode.toBuffer(raw,{width:500,margin:4});const image=PNG.sync.read(bytes);assert.equal(jsQR(new Uint8ClampedArray(image.data),image.width,image.height).data,raw);
});
test("tampered checksum, malformed lengths, duplicate tags, links, foreign currency and unsupported services fail closed",()=>{
 const raw=buildTransferQr(recipient,200000,"Synthetic rent");
 const checksum=s=>s+qrCrc(new TextEncoder().encode(s));
 for(const value of [raw.slice(0,-4)+"0000","https://evil.invalid/pay","javascript:alert(1)",checksum(raw.slice(0,-8)+"5303704"+"6304"),checksum(raw.slice(0,-4).replace("5303704","5303840")),checksum(raw.slice(0,-4).replace("QRIBFTTA","QRIBFTTC")),raw.replace("3850","3899")+"x"])assert.throws(()=>parseTransferQr(value));
});
test("bank links are allowlisted, encode recipient/reference, and never claim bank confirmation",()=>{
 const link=new URL(buildBankLink(recipient,200000,"Rent & fee",{bin:"970415",code:"ICB",name:"VietinBank"},{id:"mb",name:"MB",autofill:true},"https://finbridge.invalid/app/fixedExpenses"));assert.equal(link.origin,"https://dl.vietqr.io");assert.equal(link.searchParams.get("ba"),"0000000000@icb");assert.equal(link.searchParams.get("tn"),"Rent & fee");assert.equal(link.searchParams.has("paid"),false);
 assert.equal(bankRecipientSchema.safeParse({...recipient,accountNumber:"x@evil.invalid"}).success,false);assert.throws(()=>buildTransferQr(recipient,0.5,"test"));assert.throws(()=>buildBankLink(recipient,200000,"test",{bin:"970415",code:"ICB",name:"test"},{id:"mb",name:"test",autofill:true},"javascript:alert(1)"));
});
const pay=(state,override={})=>{const e=state.fixedExpenses[0],date=new Date().toISOString().slice(0,10);return recordFixedExpensePayment(state,e.id,{dueDate:e.dueDate,paidOn:date,amount:e.amount,walletId:"bank",note:"Synthetic paid",transactionId:randomUUID(),...override},date);};
test("one manual confirmation creates one actual expense and duplicate confirmation is idempotent",()=>{
 const before=workspaceFixture(),after=pay(before);assert.equal(after.transactions.length,before.transactions.length+1);assert.equal(trackedBalance(after,"bank").amount,trackedBalance(before,"bank").amount-50);assert.equal(pay(after),after);assert.equal(fixedExpensePayment(after,"rent",before.fixedExpenses[0].dueDate).paymentConfirmation,"user");assert.ok(workspaceSchema.safeParse(after).success);validateFixedPaymentChanges(before,after);
});
test("linking an existing expense marks the occurrence without creating a second transaction",()=>{const s=workspaceFixture(),date=new Date().toISOString().slice(0,10),before=trackedBalance(s,"bank").amount;const next=pay(s,{existingTransactionId:s.transactions[0].id,dueDate:date});assert.equal(next.transactions.length,s.transactions.length);assert.equal(next.transactions[0].fixedExpenseId,"rent");assert.equal(trackedBalance(next,"bank").amount,before);validateFixedPaymentChanges(s,next);});
test("invalid schedule, future payment date, income and cross-currency wallets cannot mark a bill paid",()=>{
 const s=workspaceFixture();for(const change of [{dueDate:"2026-02-31"},{dueDate:"2099-12-31"},{paidOn:"2099-01-01"},{walletId:"ali"},{amount:0},{amount:Infinity}])assert.throws(()=>pay(s,change));const next=pay(s);next.transactions.at(-1).type="income";assert.equal(workspaceSchema.safeParse(next).success,false);
});
test("prepaid future occurrence is excluded from reminders and future bill projections, without double subtraction",()=>{
 const s=workspaceFixture(),today=new Date().toISOString().slice(0,10),date=new Date(today+"T12:00:00Z");date.setUTCDate(date.getUTCDate()+4);const due=date.toISOString().slice(0,10);s.fixedExpenses[0]={...s.fixedExpenses[0],recurrence:"once",dueDate:due};
 const after=pay(s),e=after.fixedExpenses[0];assert.deepEqual(unpaidOccurrences(after,e,today,due),[]);assert.equal(financialOutlook(after,today).expenses.some(row=>row.expense.id===e.id),false);
 const scenario={id:"synthetic",name:"Synthetic",horizonEnd:due,changes:[{title:"Synthetic future expense",amount:1,direction:"expense",walletId:"bank",currency:"USD",date:due,category:"Dining"}],estimateSpending:false,assumptions:[]};const projection=calculateScenario(after,scenario,today);assert.equal(projection.plannedBills.length,0);assert.equal(projection.wallets.find(w=>w.walletId==="bank").projectedBalance,trackedBalance(after,"bank").amount-1);
});
test("existing history retains its link after plan removal, while forged new references and duplicate occurrences are rejected",()=>{
 const s=workspaceFixture(),paid=pay(s);const removed={...paid,fixedExpenses:[]};validateFixedPaymentChanges(paid,removed);const forged=structuredClone(paid);forged.transactions.at(-1).fixedExpenseId="other-account-bill";assert.throws(()=>validateFixedPaymentChanges(s,forged));const duplicate=structuredClone(paid);duplicate.transactions.push({...duplicate.transactions.at(-1),id:randomUUID()});assert.equal(workspaceSchema.safeParse(duplicate).success,false);
});
