import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { planTransferChat, transferChatConversion, transferChatWriteResult, mergeTransferChatRequest } from "../src/lib/transfer-chat.ts";
import { transferChatRequestSchema, transferChatResultSchema } from "../src/lib/transfer-chat-model.ts";
import { createInMemoryTransferRepository } from "../src/lib/international-transfer-repository.ts";
import { createInMemoryReferenceRepository } from "../src/lib/transfer-reference-repository.ts";
import { handleInternationalTransfer } from "../src/lib/international-transfer-handler.ts";
import { handleTransferReference } from "../src/lib/transfer-reference-handler.ts";
import { modelHistory } from "../src/lib/chat-local-plan.ts";

// Synthetic provider and isolated in-memory repositories; no user data/network/DB.
function setup(enabled = true) {
  let now = new Date("2026-10-19T06:00:00Z");
  const transfers = createInMemoryTransferRepository(() => now, { sandboxEnabled: enabled });
  const references = createInMemoryReferenceRepository({ clock: () => now, loadRate: async (base, at) => ({ base, quote: "VND", rate: ({ CNY: "3500", USD: "25000", AUD: "16000" })[base], date: "2026-10-19", fetchedAt: at.toISOString(), source: "Frankfurter" }) });
  const services = { transfers: () => transfers, references: () => references };
  const ask = (request, owner = "alice") => planTransferChat(owner, request, randomUUID(), "vi", services);
  const confirm = async (proposal, owner = "alice", header = owner) => {
    assert.equal(proposal.status, "review");
    const request = new Request("https://test.invalid/api", { method: "POST", headers: { origin: "https://test.invalid", "content-type": "application/json", "x-finbridge-workspace-owner": header }, body: JSON.stringify(proposal.write.command) });
    const response = proposal.write.endpoint === "reference" ? await handleTransferReference(request, owner, "https://test.invalid", references) : await handleInternationalTransfer(request, owner, "https://test.invalid", transfers);
    const body = await response.json();
    return { response, body, result: response.ok ? transferChatWriteResult(proposal, body, "vi") : undefined };
  };
  return { services, transfers, references, ask, confirm, advance: ms => { now = new Date(+now + ms); } };
}
const billInput = { operation: "save_bill", schoolId: "shenzhen", title: "Học phí học kỳ", amount: "1000", dueDate: "2026-11-01", reference: "OCT-TEST-01", sourceCurrency: "CNY" };

test("read-only FX queries use actual observations; inverse and cross conversions use exact decimal arithmetic", async () => {
  const s = setup(), doc = await s.references.read("alice");
  assert.equal(transferChatConversion("1000", "CNY", "VND", doc).amount, "3500000");
  assert.equal(transferChatConversion("250000", "VND", "USD", doc).amount, "10.00");
  assert.equal(transferChatConversion("100", "USD", "CNY", doc).amount, "714.29");
  const result = await s.ask({ operation: "convert", amount: "1000", sourceCurrency: "CNY", targetCurrency: "VND" });
  assert.match(result.rows[0].value, /3.500.000 VND/); assert.equal(result.write, undefined);
  assert.equal((await s.references.read("alice")).estimates.length, 0);
  assert.equal((await s.transfers.read("alice")).bills.length, 0);
  const inverseRate = await s.ask({operation:"rates",sourceCurrency:"VND",targetCurrency:"USD"});
  assert.match(inverseRate.rows[0].value,/0,00004 USD/);
});

test("missing currencies and amount ask real interactive choices without guessing or writing", async () => {
  const s = setup(); let request = { operation: "convert" };
  for (const patch of [{ sourceCurrency: "USD" }, { targetCurrency: "VND" }, { amount: "20" }]) {
    const result = await s.ask(request); assert.equal(result.status, "clarification");
    request = mergeTransferChatRequest({ ...request, ...patch }, request);
  }
  assert.equal((await s.ask(request)).status, "answer");
  assert.equal(mergeTransferChatRequest({ operation: "plans" }, request).amount, undefined);
});

test("stale, unavailable and different-date FX observations never fabricate a result", async () => {
  const s = setup(), doc = await s.references.read("alice");
  for (const invalid of [{ ...doc, rates: [] }, { ...doc, serverTime: "2026-10-21T06:00:00Z" }, { ...doc, rates: doc.rates.map(r => r.currency === "CNY" ? { ...r, reference: { ...r.reference, date: "2026-10-18" } } : r) }]) {
    assert.throws(() => transferChatConversion("100", "USD", "CNY", invalid));
  }
  assert.throws(() => transferChatConversion("1.001", "USD", "VND", doc));
  assert.throws(() => transferChatConversion("1000001", "USD", "VND", doc));
});

test("saving an estimate requires confirmation, retries are idempotent and histories are owner-isolated", async () => {
  const s = setup(), proposal = await s.ask({ operation: "save_estimate", amount: "100", sourceCurrency: "USD", targetCurrency: "VND" });
  assert.equal((await s.references.read("alice")).estimates.length, 0);
  const first = await s.confirm(proposal), retry = await s.confirm(proposal);
  assert.equal(first.result.status, "confirmed"); assert.deepEqual(retry.body, first.body);
  assert.equal((await s.references.read("alice")).estimates.length, 1);
  assert.equal((await s.references.read("bob")).estimates.length, 0);
  assert.equal((await s.confirm(proposal, "alice", "bob")).response.status, 409);
  const inverse = await s.ask({ operation: "save_estimate", amount: "100000", sourceCurrency: "VND", targetCurrency: "CNY" });
  assert.equal(inverse.write, undefined); assert.match(inverse.text, /chỉ hỗ trợ/);
});

test("bill creation asks one missing field, preserves answers and does not persist before confirmation", async () => {
  const s = setup(); let request = { operation: "save_bill" };
  for (const patch of [{ schoolId: "shenzhen" }, { title: "Học phí học kỳ" }, { amount: "1000" }, { dueDate: "2026-11-01" }, { reference: "OCT-TEST-01" }]) {
    const result = await s.ask(request); assert.equal(result.status, "clarification");
    request = mergeTransferChatRequest({ operation: "save_bill", ...patch }, request);
    assert.equal((await s.transfers.read("alice")).bills.length, 0);
  }
  const proposal = await s.ask(request); assert.equal(proposal.status, "review");
  const { body, result } = await s.confirm(proposal);
  assert.equal(result.status, "confirmed"); assert.equal(result.request.billId, body.resultId);
  assert.equal(body.bills[0].amount, "1000");
  assert.equal((await s.confirm(proposal)).body.bills.length, 1);
  assert.equal((await s.transfers.read("bob")).bills.length, 0);
});

test("sandbox gates remain enforced and never block read-only reference rates", async () => {
  const s = setup(false), created = await s.confirm(await s.ask(billInput));
  const proposal = await s.ask({operation:"quote",billId:created.body.resultId});
  assert.equal(proposal.write, undefined); assert.match(proposal.text,/chưa được bật/);
  assert.ok((await s.ask({operation:"rates"})).rows.length);
});

async function draftFlow(s) {
  const created = await s.confirm(await s.ask(billInput));
  const quoted = await s.confirm(await s.ask({operation:"quote",billId:created.body.resultId}));
  assert.ok(quoted.result.choices.length);
  const choice = quoted.result.choices[0].patch;
  const drafted = await s.confirm(await s.ask({operation:"draft",...choice}));
  return drafted.body.resultId;
}

test("comparison → draft → approve → execute are separate confirmed steps; no real wallet is changed", async () => {
  const s = setup(), planId = await draftFlow(s);
  assert.equal((await s.transfers.read("alice")).accounts[0].spent, 0);
  const premature = await s.ask({operation:"execute",planId}); assert.equal(premature.write, undefined);
  const approve = await s.ask({operation:"approve",planId}); assert.equal(approve.acknowledgement, true);
  const approved = await s.confirm(approve); assert.equal(approved.result.status,"confirmed");
  assert.equal((await s.transfers.read("alice")).accounts[0].spent,0);
  const execute = await s.ask({operation:"execute",planId}); assert.equal(execute.acknowledgement,true);
  const completed = await s.confirm(execute), repeated = await s.confirm(execute);
  assert.equal(completed.result.status,"confirmed"); assert.deepEqual(repeated.body,completed.body);
  assert.ok(completed.body.receipts[0].receiptId);
  assert.equal(completed.body.accounts[0].spent,completed.body.receipts[0].quote.total);
  assert.equal((await s.ask({operation:"execute",planId})).write,undefined);
  assert.equal((await s.ask({operation:"bills"})).rows.length,0);
  assert.ok((await s.ask({operation:"plans",planId})).rows.length);
});

test("expired approval/quote, pause, cancel and edited bill are validated against current repository state", async () => {
  const s = setup(), planId = await draftFlow(s);
  await s.confirm(await s.ask({operation:"approve",planId})); s.advance(120001);
  assert.equal((await s.ask({operation:"execute",planId})).write,undefined);
  await s.confirm(await s.ask({operation:"pause",paused:true}));
  const paused = await s.ask({operation:"approve",planId}); assert.equal(paused.write,undefined); assert.match(paused.text,/tạm dừng/);
  await s.confirm(await s.ask({operation:"pause",paused:false}));
  const cancelled = await s.confirm(await s.ask({operation:"cancel",planId})); assert.equal(cancelled.body.plans[0].status,"cancelled");
  assert.equal((await s.ask({operation:"approve",planId})).write,undefined);
  s.advance(300001); assert.equal((await s.ask({operation:"draft"})).write,undefined);
});

test("archive/restore/edit use actual bill versions; failed validation and forged owner never write", async () => {
  const s = setup(), first = await s.confirm(await s.ask(billInput)), billId = first.body.resultId;
  const invalid = await s.ask({...billInput,dueDate:"2026-02-30"}); assert.equal(invalid.write,undefined);
  const wrongCurrency = await s.ask({...billInput,sourceCurrency:"USD"}); assert.equal(wrongCurrency.write,undefined);
  const edit = await s.ask({operation:"save_bill",billId,title:"Tuition updated"});
  assert.equal(edit.write.command.bill.amount,"1000");
  assert.equal((await s.confirm(edit,"alice","bob")).response.status,409);
  assert.equal((await s.confirm(edit)).body.bills[0].title,"Tuition updated");
  const stale = await s.confirm(edit); assert.equal(stale.response.status,200); // same stable key
  for (const archived of [true,false]) {
    const result = await s.confirm(await s.ask({operation:"archive_bill",billId,archived}));
    assert.equal(result.body.bills[0].archived,archived);
  }
  assert.equal((await s.ask({operation:"approve",planId:randomUUID()},"bob")).write,undefined);
});

test("canonical response is required; HTTP 200 with missing result does not count as success", async () => {
  const s = setup(), proposal = await s.ask(billInput);
  assert.throws(()=>transferChatWriteResult(proposal,{},"vi"));
  const created = await s.confirm(proposal), quote = await s.ask({operation:"quote",billId:created.body.resultId});
  assert.throws(()=>transferChatWriteResult(quote,{...created.body,quotes:[]},"vi"));
  assert.equal(transferChatRequestSchema.safeParse({operation:"execute",url:"https://evil.invalid"}).success,false);
  assert.equal(transferChatResultSchema.safeParse({...proposal,write:{endpoint:"bank",command:{}}}).success,false);
});

test("insufficient sandbox reserve and changed bills cannot be approved through chat", async () => {
  const s=setup(), created=await s.confirm(await s.ask({...billInput,amount:"1000000"}));
  const quoted=await s.confirm(await s.ask({operation:"quote",billId:created.body.resultId}));
  const blocked=await s.ask({operation:"draft",...quoted.result.choices[0].patch});
  assert.equal(blocked.write,undefined);assert.match(blocked.text,/dự phòng/);
  const t=setup(), planId=await draftFlow(t), doc=await t.transfers.read("alice"), billId=doc.plans[0].bill.id;
  await t.confirm(await t.ask({operation:"save_bill",billId,amount:"1100"}));
  assert.equal((await t.ask({operation:"approve",planId})).write,undefined);
});

test("all operation results validate with real schemas; unknown names select actual records instead of inventing IDs",async()=>{
  const s=setup();await s.confirm(await s.ask(billInput));
  await s.confirm(await s.ask({...billInput,title:"Second bill",reference:"OCT-TEST-02"}));
  for(const operation of ["open","rates","estimates","bills","plans","history","accounts","schools","pause","quote","archive_bill","cancel"]) {
    const result=await s.ask({operation});assert.equal(transferChatResultSchema.safeParse(result).success,true,operation);
  }
  const ambiguous=await s.ask({operation:"quote"});assert.equal(ambiguous.status,"clarification");assert.equal(ambiguous.choices.length,2);
  const missing=await s.ask({operation:"quote",searchTerm:"Not my bill"});assert.equal(missing.write,undefined);
  const badServices={transfers:()=>{throw new Error("Database unavailable")},references:()=>{throw new Error("Rate unavailable")}};
  await assert.rejects(()=>planTransferChat("alice",{operation:"bills"},randomUUID(),"vi",badServices));
});

test("conversation retains parameters and real IDs, excludes computed figures and payment account details", async () => {
  const s = setup(), proposal = await s.ask(billInput);
  const history = modelHistory([{role:"assistant",text:"",localOnly:true,transfer:proposal}]);
  assert.match(history[0].text,/save_bill/); assert.match(history[0].text,/shenzhen/);
  assert.doesNotMatch(history[0].text,/SZDU-TUITION|3500000|Frankfurter/);
});
