import { TRANSFER_COPY } from "../components/transfers/transfer-copy";
import { TRANSFER_SCHOOLS, assertTransferReady, transferBillSchema, transferCommandSchema, type TransferBill, type TransferDocument, type TransferQuote } from "./international-transfer";
import { estimateInputSchema, referenceConversion, referenceUsable, type ReferenceDocument, type ReferenceRate } from "./reference-rates";
import { completedTransfers, pendingTransferBills } from "./transfer-views";
import { formatScenarioMoney, type ScenarioLanguage } from "./scenario-format";
import { transferChatCopy, transferChatRequestSchema, type TransferChatRequest, type TransferChatResult, type TransferChatWrite } from "./transfer-chat-model";
import type { TransferRepository } from "./international-transfer-repository";
import type { ReferenceRepository } from "./transfer-reference-repository";

type Services = { transfers: () => TransferRepository; references: () => ReferenceRepository };
type Currency = "VND" | "CNY" | "USD" | "AUD";
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().trim();
const decimal = (value: string) => { const [whole, fraction = ""] = value.split("."); return { number: BigInt(whole + fraction), scale: BigInt(10) ** BigInt(fraction.length) }; };
const currencyChoices = (field: "sourceCurrency" | "targetCurrency") => (["CNY", "USD", "AUD", "VND"] as const).map(currency => ({ label: currency, patch: { [field]: currency } }));

/** Uses only the tab's validated observations. Cross pairs require matching dates. */
export function transferChatConversion(amount: string, source: Currency, target: Currency, doc: ReferenceDocument, digits: 2 | 6 = 2) {
  if (!/^\d{1,13}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || Number(amount) > (source === "VND" ? 1e12 : 1e6)) throw new Error("INVALID_AMOUNT");
  const usable = (currency: Currency): ReferenceRate | null => {
    if (currency === "VND") return null;
    const row = doc.rates.find(item => item.currency === currency);
    if (!row?.reference || !row.usable || !referenceUsable(row.reference, new Date(doc.serverTime))) throw new Error("RATE_UNAVAILABLE");
    return row.reference;
  };
  if (source === target) return { amount, references: [] as ReferenceRate[] };
  const a = usable(source), b = usable(target), references = [a,b].filter((r): r is ReferenceRate => !!r);
  if (a && b && a.date !== b.date) throw new Error("RATE_DATE_MISMATCH");
  if (source === target) return { amount, references };
  if (target === "VND" && a && digits === 2) return { amount: referenceConversion(amount, a.rate), references };
  const input = decimal(amount), from = a ? decimal(a.rate) : { number: BigInt(1), scale: BigInt(1) }, to = b ? decimal(b.rate) : { number: BigInt(1), scale: BigInt(1) };
  const numerator = input.number * from.number * to.scale * (BigInt(10) ** BigInt(digits)), denominator = input.scale * from.scale * to.number;
  const minor = (numerator + denominator / BigInt(2)) / denominator;
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("INVALID_AMOUNT");
  return { amount: `${minor / (BigInt(10) ** BigInt(digits))}.${String(minor % (BigInt(10) ** BigInt(digits))).padStart(digits,"0")}`, references };
}

export function mergeTransferChatRequest(patch: TransferChatRequest, previous?: TransferChatRequest | null): TransferChatRequest {
  const supplied = Object.fromEntries(Object.entries(patch).filter(([,value]) => value !== null && value !== undefined));
  return transferChatRequestSchema.parse(previous && previous.operation === patch.operation ? { ...previous, ...supplied } : supplied);
}

/** Read/propose only. Mutations go to the existing authenticated endpoints after
 * explicit UI confirmation, with a stable mutationId on retry.
 */
export async function planTransferChat(owner: string, request: TransferChatRequest, id: string, language: ScenarioLanguage, services: Services): Promise<TransferChatResult> {
  const t = transferChatCopy[language], money = (amount: string | number, currency = "VND") => formatScenarioMoney(Number(amount), currency, language);
  const result: TransferChatResult = { id, request, status: "answer", title: t.title, text: "", sandbox: false, rows: [], choices: [] };
  const ask = (text: string, choices: TransferChatResult["choices"] = []) => ({ ...result, status: "clarification" as const, text, choices });
  const review = (write: TransferChatWrite, rows: TransferChatResult["rows"], acknowledgement = false): TransferChatResult => ({ ...result, status: "review", text: t.review, rows, write, acknowledgement });
  if (request.operation === "open") return { ...result, text: t.noReal, choices: [
      {label:t.reference,patch:{operation:"rates"}}, {label:TRANSFER_COPY[language].bills,patch:{operation:"bills"}}, {label:TRANSFER_COPY[language].history,patch:{operation:"plans"}}, {label:TRANSFER_COPY[language].controls,patch:{operation:"accounts"}}, {label:TRANSFER_COPY[language].newBill,patch:{operation:"save_bill"}}
    ] };
  if (request.operation === "schools") return { ...result, sandbox: true, text: t.sandboxNote, rows: TRANSFER_SCHOOLS.map(s => ({ label: s.name, value: `${s.country} · ${s.currency} · ${s.recipient} · ${s.bank}` })) };
  if (["rates", "convert", "estimates", "save_estimate"].includes(request.operation)) {
    const doc = await services.references().read(owner);
    result.title = t.reference;
    result.text = t.referenceNote;
    if (request.operation === "estimates") return { ...result, text: doc.estimates.length ? t.referenceNote : t.empty, rows: doc.estimates.map(e => ({ label: `${money(e.amount,e.reference.base)} → ${money(e.convertedVnd)}`, value: `${e.reference.source} · ${e.reference.date} · ${e.createdAt}` })) };
    if (request.operation === "rates" && request.sourceCurrency === "VND" && !request.targetCurrency) return ask(t.target,currencyChoices("targetCurrency"));
    if (request.operation === "rates" && request.sourceCurrency && request.targetCurrency) {
      try { const c=transferChatConversion("1",request.sourceCurrency,request.targetCurrency,doc,6); return {...result,rows:[{label:`1 ${request.sourceCurrency}`,value:`${new Intl.NumberFormat(language==="vi"?"vi-VN":language==="zh"?"zh-CN":"en-US",{maximumFractionDigits:6}).format(Number(c.amount))} ${request.targetCurrency}`},...c.references.map(r=>({label:t.rate,value:`${r.base}/VND = ${r.rate} · ${r.source} · ${r.date}`}))]}; }
      catch { return {...result,text:t.unsupportedPair}; }
    }
    if (request.operation === "rates") return { ...result, rows: doc.rates.filter(row => !request.sourceCurrency || row.currency === request.sourceCurrency).map(row => ({ label: `${row.currency}/VND`, value: row.reference && row.usable && referenceUsable(row.reference, new Date(doc.serverTime)) ? `${row.reference.rate} VND · ${row.reference.source} · ${row.reference.date}${row.cached ? " · cache" : ""}` : t.stale })) };
    if (!request.sourceCurrency) return ask(t.source, currencyChoices("sourceCurrency"));
    if (!request.targetCurrency) return ask(t.target, currencyChoices("targetCurrency"));
    if (!request.amount) return ask(t.amount);
    let conversion;
    try { conversion = transferChatConversion(request.amount, request.sourceCurrency, request.targetCurrency, doc); }
    catch (error) { return ask(error instanceof Error && error.message === "INVALID_AMOUNT" ? t.amount : t.unsupportedPair); }
    const rows = [{ label: `${money(request.amount, request.sourceCurrency)} → ${request.targetCurrency}`, value: money(conversion.amount, request.targetCurrency) }, ...conversion.references.map(reference => ({ label: t.rate, value: `${reference.source} · ${reference.base}/VND = ${reference.rate} · ${reference.date}` }))];
    if (request.operation === "convert") return { ...result, rows };
    if (request.sourceCurrency === "VND" || request.targetCurrency !== "VND") return { ...result, text: ({vi:"Có thể tính quy đổi này, nhưng chức năng lưu ước tính hiện chỉ hỗ trợ CNY/USD/AUD sang VND.",en:"This conversion can be calculated, but saving estimates currently supports CNY/USD/AUD to VND only.",zh:"可计算此兑换，但目前仅支持保存CNY/USD/AUD至VND的估算。"}[language]), rows, choices: [{ label: t.open, patch: { operation: "open" } }] };
    const reference = conversion.references[0];
    const command = estimateInputSchema.parse({ mutationId: id, referenceId: reference.id, amount: request.amount });
    return review({ endpoint: "reference", command }, rows);
  }
  const doc = await services.transfers().read(owner);
  result.sandbox = true; result.text = t.sandboxNote;
  const receipts = completedTransfers(doc);
  const billRows = (b: TransferBill) => ({ label: b.title, value: `${money(b.amount, TRANSFER_SCHOOLS.find(s => s.id === b.schoolId)!.currency)} · ${b.dueDate} · ${b.reference}${b.archived ? ` · ${TRANSFER_COPY[language].archived}` : ""}` });
  if (request.operation === "bills") { const bills = pendingTransferBills(doc.bills, receipts, true).filter(b => (!request.billId || b.id===request.billId) && (!request.schoolId || b.schoolId===request.schoolId) && (!request.searchTerm || normalize(`${b.title} ${b.reference} ${TRANSFER_SCHOOLS.find(s=>s.id===b.schoolId)?.name}`).includes(normalize(request.searchTerm)))); return { ...result, text: bills.length ? t.sandboxNote : t.empty, rows: bills.map(billRows), choices: bills.map(b => ({ label: b.title, patch: { operation: "quote", billId: b.id } })) }; }
  if (request.operation === "accounts") return { ...result, rows: [...doc.accounts.map(a => ({ label: a.id, value: money(a.balance) })), { label: t.reserve, value: money(doc.reserve) }] };
  if (request.operation === "history") return { ...result, text: doc.audit.length ? t.sandboxNote : t.empty, rows: doc.audit.map(event => ({ label: TRANSFER_COPY[language].events[event.event as keyof typeof TRANSFER_COPY.en.events] || TRANSFER_COPY[language].audit, value: `${doc.bills.find(b => b.id === event.targetId)?.title || doc.plans.find(p => p.id === event.targetId)?.bill.title || event.targetId} · ${event.createdAt}` })) };
  if (request.operation === "plans" && request.planId) {
    const plan = [...doc.plans,...receipts].find(p=>p.id===request.planId);
    if (!plan) return {...result,text:t.empty};
    return {...result,text:TRANSFER_COPY[language].states[plan.status],rows:[{label:plan.bill.title,value:plan.bill.reference},{label:t.recipient,value:TRANSFER_SCHOOLS.find(s=>s.id===plan.bill.schoolId)!.recipient},...quoteRows(plan.quote,language),...(plan.receiptId?[{label:TRANSFER_COPY[language].receiptId,value:plan.receiptId}]:[])]};
  }
  if (request.operation === "plans") return { ...result, text: doc.plans.length || receipts.length ? t.sandboxNote : t.empty, rows: [...new Map([...doc.plans,...receipts].map(p => [p.id,p])).values()].map(p => ({ label: p.bill.title, value: `${TRANSFER_COPY[language].states[p.status]} · ${p.quote.provider} · ${money(p.quote.total)}${p.receiptId ? ` · ${p.receiptId}` : ""}` })) };
  if (doc.sandboxEnabled === false && ["quote", "draft", "approve", "execute"].includes(request.operation)) return { ...result, text: t.disabled };
  if (request.operation === "pause") {
    if (request.paused == null) return ask(t.paused, [{ label: language === "vi" ? "Tạm dừng" : language === "zh" ? "暂停" : "Pause", patch: { paused: true } }, { label: language === "vi" ? "Mở lại" : language === "zh" ? "恢复" : "Resume", patch: { paused: false } }]);
    return review({ endpoint: "sandbox", command: { action: "pause", mutationId: id, paused: request.paused } }, [{ label: t.title, value: request.paused ? TRANSFER_COPY[language].pause : TRANSFER_COPY[language].resume }]);
  }
  const candidates = request.billId ? doc.bills.filter(b => b.id === request.billId) : request.searchTerm ? doc.bills.filter(b => normalize(`${b.title} ${b.reference}`).includes(normalize(request.searchTerm!))) : doc.bills;
  const selectBill = () => ask(candidates.length ? t.choose : t.empty, candidates.map(b => ({ label: `${b.title} · ${b.reference}`, patch: { billId: b.id } })));
  const bill = candidates.length === 1 ? candidates[0] : undefined;
  if (request.operation === "save_bill") {
    if (request.billId && !bill) return selectBill();
    const input = { schoolId: request.schoolId || (request.billId ? bill?.schoolId : undefined), title: request.title || (request.billId ? bill?.title : undefined), amount: request.amount || (request.billId ? bill?.amount : undefined), dueDate: request.dueDate || (request.billId ? bill?.dueDate : undefined), reference: request.reference || (request.billId ? bill?.reference : undefined) };
    if (!input.schoolId) return ask(t.school, TRANSFER_SCHOOLS.map(s => ({ label: `${s.name} · ${s.currency}`, patch: { schoolId: s.id } })));
    if (!input.title) return ask(t.name);
    if (!input.amount) return ask(t.amount);
    const school = TRANSFER_SCHOOLS.find(s => s.id === input.schoolId)!;
    if (request.sourceCurrency && request.sourceCurrency !== school.currency) return ask(t.school, TRANSFER_SCHOOLS.map(s => ({ label: `${s.name} · ${s.currency}`, patch: { schoolId: s.id, sourceCurrency: s.currency } })));
    if (!input.dueDate) return ask(t.date);
    if (!input.reference) return ask(t.ref);
    const parsed = transferBillSchema.safeParse(input);
    if (!parsed.success) return ask(parsed.error.issues.some(i => i.path.includes("dueDate")) ? t.date : t.amount);
    const command = transferCommandSchema.parse({ action: "saveBill", mutationId: id, ...(request.billId ? { id: bill!.id, version: bill!.version } : {}), bill: parsed.data });
    return review({ endpoint: "sandbox", command }, [billRows({ ...parsed.data, id: "", version: 0, archived: false, createdAt: "" }), { label: t.recipient, value: `${school.recipient} · ${school.bank} · ${school.bankCode} · ${school.account}` }]);
  }
  if (request.operation === "archive_bill" || request.operation === "quote") {
    if (!bill) return selectBill();
    if (request.operation === "archive_bill" && request.archived == null) return ask(t.archived, [{ label: language === "vi" ? "Lưu trữ" : language === "zh" ? "归档" : "Archive", patch: { archived: true } }, { label: language === "vi" ? "Khôi phục" : language === "zh" ? "恢复" : "Restore", patch: { archived: false } }]);
    const command = request.operation === "quote" ? { action: "quote" as const, mutationId: id, id: bill.id, version: bill.version } : { action: "archiveBill" as const, mutationId: id, id: bill.id, version: bill.version, archived: request.archived! };
    return review({ endpoint: "sandbox", command }, [billRows(bill)]);
  }
  if (request.operation === "draft") {
    const quotes = doc.quotes.filter(q => q.eligible && Date.parse(q.expiresAt) > Date.parse(doc.serverTime) && (!request.billId || q.billId === request.billId));
    const quote = request.quoteId ? quotes.find(q => q.id === request.quoteId) : request.provider && bill ? quotes.find(q => q.billId === bill.id && q.provider === request.provider) : undefined;
    if (!quote) return ask(quotes.length ? t.choose : t.stale, quotes.sort((a,b) => request.preference === "speed" ? a.maxDays - b.maxDays || a.total - b.total : a.total - b.total).map(q => ({ label: `${q.provider} · ${money(q.total)} · ${q.maxDays}d`, patch: { quoteId: q.id, billId: q.billId } })));
    const currentBill = doc.bills.find(b => b.id === quote.billId);
    if (!currentBill) return { ...result, text: t.empty };
    try {
      assertTransferReady({ id, bill: currentBill, quote, status: "review", createdAt: doc.serverTime }, currentBill, doc.paused, doc.accounts.find(a => a.id === quote.provider)?.balance || 0, new Date(doc.serverTime));
      if (currentBill.version !== quote.billVersion) throw new Error("BILL_CHANGED");
    } catch (error) {
      return { ...result, text: TRANSFER_COPY[language].errors[(error as {code:string}).code as keyof typeof TRANSFER_COPY.en.errors] || t.stale, rows: quoteRows(quote, language) };
    }
    return review({ endpoint: "sandbox", command: { action: "draft", mutationId: id, quoteId: quote.id } }, quoteRows(quote, language));
  }
  const plans = [...new Map([...doc.plans, ...receipts].map(p => [p.id,p])).values()];
  const selected = request.planId ? plans.filter(p => p.id === request.planId) : plans.filter(p => (!request.billId || p.bill.id === request.billId) && ["review", "approved"].includes(p.status));
  if (selected.length !== 1) return ask(selected.length ? t.choose : t.empty, selected.map(p => ({ label: `${p.bill.title} · ${p.quote.provider} · ${money(p.quote.total)}`, patch: { planId: p.id, billId: p.bill.id } })));
  const plan = selected[0];
  if (plan.status === "completed") return { ...result, text: t.completed, rows: [...quoteRows(plan.quote, language), { label: TRANSFER_COPY[language].receiptId, value: plan.receiptId || "" }] };
  if (request.operation === "approve" || request.operation === "execute") {
    const currentBill = doc.bills.find(b => b.id === plan.bill.id), account = doc.accounts.find(a => a.id === plan.quote.provider);
    if (!currentBill || !account) return { ...result, text: t.empty };
    try { assertTransferReady(plan, currentBill, doc.paused, account.balance, new Date(doc.serverTime), request.operation === "execute"); }
    catch (error) { return { ...result, text: TRANSFER_COPY[language].errors[(error as {code:string}).code as keyof typeof TRANSFER_COPY.en.errors] || t.stale, rows: quoteRows(plan.quote, language), choices: [{ label: t.open, patch: { operation: "open" } }] }; }
    const rows = [...quoteRows(plan.quote, language), { label: t.recipient, value: `${TRANSFER_SCHOOLS.find(s => s.id === plan.bill.schoolId)!.recipient} · ${plan.bill.reference}` }, { label: t.after, value: money(account.balance - plan.quote.total) }, { label: t.reserve, value: money(doc.reserve) }];
    return review({ endpoint: "sandbox", command: request.operation === "approve" ? { action: "approve", mutationId: id, id: plan.id, acknowledge: true } : { action: "execute", mutationId: id, id: plan.id } }, rows, true);
  }
  if (request.operation !== "cancel") return { ...result, text: t.empty };
  return review({ endpoint: "sandbox", command: { action: "cancel", mutationId: id, id: plan.id } }, [{ label: plan.bill.title, value: plan.bill.reference }]);
}

export function quoteRows(q: TransferQuote, language: ScenarioLanguage) {
  const t = transferChatCopy[language], money = (n: string | number, currency = "VND") => formatScenarioMoney(Number(n), currency, language);
  return [{ label: t.receive, value: money(q.receiveAmount, q.currency) }, { label: t.total, value: money(q.total) }, {label:TRANSFER_COPY[language].conversion,value:money(q.conversion)}, { label: t.fee, value: money(q.transferFee) }, { label: t.margin, value: money(q.fxMarkup) }, { label: t.rate, value: `${q.rate} VND/${q.currency} · ${q.provider}` }, { label: TRANSFER_COPY[language].eta, value: q.arrivalDate }, { label: TRANSFER_COPY[language].latest, value: q.latestSendDate }, ...(q.deadlineRisk ? [{label: TRANSFER_COPY[language].due, value: TRANSFER_COPY[language].deadline}] : []), { label: t.expires, value: q.expiresAt }];
}

/** Verify the canonical response rather than treating any HTTP 200 as success. */
export function transferChatWriteResult(proposal: TransferChatResult, response: unknown, language: ScenarioLanguage): TransferChatResult {
  const t = transferChatCopy[language];
  if (!proposal.write || !response || typeof response !== "object") throw new Error(t.unavailable);
  if (proposal.write.endpoint === "reference") {
    const estimate = response as ReferenceDocument["estimates"][number];
    const input = proposal.write.command;
    if (estimate.id !== input.mutationId || estimate.reference?.id !== input.referenceId || Number(estimate.amount) !== Number(input.amount) || estimate.convertedVnd !== referenceConversion(input.amount, estimate.reference.rate)) throw new Error(t.unavailable);
    return { ...proposal, status: "confirmed", text: t.done, rows: [{ label: `${input.amount} ${estimate.reference.base}`, value: `${estimate.convertedVnd} VND · ${estimate.reference.source} · ${estimate.reference.date}` }], choices: [] };
  }
  const command = proposal.write.command;
  const doc = response as TransferDocument & { resultId?: string };
  if (doc.mode !== "sandbox" || !Array.isArray(doc.bills) || !Array.isArray(doc.plans) || !Array.isArray(doc.quotes)) throw new Error(t.unavailable);
  const done = { ...proposal, status: "confirmed" as const, text: t.done, choices: [] as TransferChatResult["choices"] };
  if (command.action === "saveBill") { if (!doc.bills.some(b => b.id === doc.resultId && b.reference === command.bill.reference && b.title === command.bill.title && b.schoolId === command.bill.schoolId && b.dueDate === command.bill.dueDate && Number(b.amount) === Number(command.bill.amount))) throw new Error(t.unavailable); }
  if (command.action === "saveBill") return {...done,request:{...proposal.request,billId:doc.resultId!}};
  if (command.action === "archiveBill" && !doc.bills.some(b => b.id === command.id && b.archived === command.archived)) throw new Error(t.unavailable);
  if (command.action === "pause" && doc.paused !== command.paused) throw new Error(t.unavailable);
  if (command.action === "quote" && !doc.quotes.some(q => q.billId === command.id && q.billVersion === command.version)) throw new Error(t.unavailable);
  if (command.action === "quote") return { ...done, request: { operation: "draft", billId: command.id }, rows: doc.quotes.filter(q => q.billId === command.id && q.billVersion === command.version).sort((a,b) => a.total-b.total).flatMap(q => [{label:q.provider,value:q.eligible ? formatScenarioMoney(q.total,"VND",language) : TRANSFER_COPY[language].unavailableRoute},...quoteRows(q,language).map(row=>({...row,label:`${q.provider} · ${row.label}`}))]), choices: doc.quotes.filter(q => q.billId === command.id && q.billVersion === command.version && q.eligible).map(q => ({ label: `${q.provider} · ${formatScenarioMoney(q.total,"VND",language)}`, patch: { operation: "draft", quoteId: q.id, billId: q.billId } })) };
  if (["draft","approve","execute","cancel"].includes(command.action)) {
    const plan = [...doc.plans,...(doc.receipts || [])].find(p => p.id === doc.resultId || ("id" in command && p.id === command.id));
    const expected = { draft: "review", approve: "approved", execute: "completed", cancel: "cancelled" }[command.action as "draft"|"approve"|"execute"|"cancel"];
    if (!plan || plan.status !== expected || (command.action === "execute" && !plan.receiptId)) throw new Error(t.unavailable);
    return { ...done, request: { operation: command.action === "draft" ? "approve" : command.action === "approve" ? "execute" : "plans", planId: plan.id, billId: plan.bill.id }, text: command.action === "execute" ? t.completed : command.action === "approve" ? t.approved : t.done, rows: [...quoteRows(plan.quote,language), ...(plan.receiptId ? [{ label: TRANSFER_COPY[language].receiptId, value: plan.receiptId }] : [])], choices: command.action === "draft" || command.action === "approve" ? [{ label: t.confirm, patch: { operation: command.action === "draft" ? "approve" : "execute", planId: plan.id, billId: plan.bill.id } }] : [] };
  }
  return done;
}
