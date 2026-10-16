"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CheckCircle2, ExternalLink, ScanLine, Upload } from "lucide-react";
import { Modal } from "@/components/sites/rolly/replica/Ui";
import { flushWorkspace, today, updateState, useAppState, type FixedExpense } from "@/components/sites/rolly/replica/store";
import { bankRecipientSchema, buildBankLink, buildTransferQr, parseTransferQr, transferText, type BankCatalog, type BankRecipient } from "@/lib/bank-transfer";
import { expenseWallet, fixedExpensePayment, nextExpenseDue, recordFixedExpensePayment } from "@/lib/fixed-expense-payments";
import { readTransferImage } from "@/lib/read-transfer-image";
import { BILL_PAYMENT_COPY } from "@/lib/bill-payment-copy";
import styles from "./FixedExpenseActions.module.css";

const blank: BankRecipient = {bankBin:"",accountNumber:"",accountName:"",reference:""};
export function FixedExpenseActions({ expense, lang, navigate }: { expense: FixedExpense; lang: "en" | "vi" | "zh"; navigate: (path:string)=>void }) {
  const state=useAppState(), t=BILL_PAYMENT_COPY[lang], wallet=expenseWallet(state,expense), asOf=today();
  const [mode,setMode]=useState<""|"record"|"transfer">(""), [chosenDue,setChosenDue]=useState(""), [paidOn,setPaidOn]=useState(asOf), [amount,setAmount]=useState(String(expense.amount)), [source,setSource]=useState(wallet?.id||""), [note,setNote]=useState("");
  const [recipient,setRecipient]=useState<BankRecipient>(blank),[app,setApp]=useState(""),[catalog,setCatalog]=useState<BankCatalog|null>(null),[catalogAttempt,setCatalogAttempt]=useState(0),[catalogError,setCatalogError]=useState(false);
  const [busy,setBusy]=useState(false),[reading,setReading]=useState(false),[reviewed,setReviewed]=useState(false),[handoff,setHandoff]=useState(false),[qr,setQr]=useState(""),[error,setError]=useState(""),[message,setMessage]=useState(""),[mismatch,setMismatch]=useState(false),[retryRecord,setRetryRecord]=useState(false);
  const lock=useRef(false),scanVersion=useRef(0);
  const [existingId,setExistingId]=useState("");
  const suggestedDue=nextExpenseDue(state,expense,asOf),due=chosenDue||suggestedDue, payment=due?fixedExpensePayment(state,expense.id,due):undefined;
  const currency=wallet?.currency||"", format=(n:number)=>new Intl.NumberFormat(lang,{style:"currency",currency:currency||"USD"}).format(n);
  const bank=catalog?.banks.find(b=>b.bin===recipient.bankBin), bankApp=catalog?.apps.find(a=>a.id===app);
  const validRecipient=bankRecipientSchema.safeParse(recipient).success, transferAmount=Number(amount), validTransfer=validRecipient && Number.isSafeInteger(transferAmount)&&transferAmount>0&&transferAmount<=1e12;
  const lastPayment=state.transactions.filter(tx=>tx.fixedExpenseId===expense.id).sort((a,b)=>b.date.localeCompare(a.date))[0];
  function open(next:"record"|"transfer") { setChosenDue(due||expense.dueDate);setPaidOn(asOf);setAmount(String(expense.amount));setSource(wallet?.id||"");setNote("");setRecipient(expense.paymentRecipient||blank);setApp(expense.paymentRecipient?.preferredApp||"");setReviewed(false);setHandoff(false);setMismatch(false);setError("");setMessage("");setRetryRecord(false);setExistingId("");setQr("");setMode(next); }
  function close() { if (busy||reading) return;scanVersion.current++;setMode(""); }
  function changeRecipient(value:BankRecipient) {setRecipient(value);setReviewed(false);setQr("");setMessage("");}
  useEffect(()=>{
    if(mode!=="transfer"||currency!=="VND")return;
    let active=true;const controller=new AbortController();
    fetch("/api/bank-catalog?platform="+(/iPhone|iPad|iPod/.test(navigator.userAgent)?"ios":"android"),{signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error();const data:BankCatalog=await r.json();if(active){setCatalog(data);setCatalogError(false);}}).catch(()=>{if(active)setCatalogError(true);});
    return()=>{active=false;controller.abort();};
  },[mode,currency,catalogAttempt]);
  useEffect(()=>{
    let active=true;
    if(mode==="transfer"&&currency==="VND"&&validTransfer){
      try {const payload=buildTransferQr(recipient,transferAmount,recipient.reference);void import("qrcode").then(q=>q.toDataURL(payload,{width:256,margin:3,errorCorrectionLevel:"M"})).then(value=>{if(active)setQr(value);}).catch(()=>{if(active)setQr("");});}catch{/* Invalid fields keep the transfer disabled. */}
    }
    return()=>{active=false;};
  },[mode,currency,recipient,transferAmount,validTransfer]);
  async function scan(file:File) {
    const version=++scanVersion.current;setReading(true);setError("");setReviewed(false);setQr("");
    try{const decoded=parseTransferQr(await readTransferImage(file));if(version!==scanVersion.current)return;setRecipient({...decoded.recipient,preferredApp:app||undefined});if(decoded.amount!==null){setAmount(String(decoded.amount));setMismatch(decoded.amount!==expense.amount);}else{setAmount(String(expense.amount));setMismatch(false);}setMessage("");}
    catch(e){if(version===scanVersion.current){const key=e instanceof Error?e.message:"INVALID_QR";setError(key==="INVALID_IMAGE"?t.invalidImage:key==="QR_NOT_FOUND"?t.notFound:key==="UNSUPPORTED_QR"?t.unsupportedQr:t.invalidQr);}}
    finally{if(version===scanVersion.current)setReading(false);}
  }
  async function saveRecipient(remove=false) {
    if(lock.current)return;if(!remove&&(!validRecipient||!bank)){setError(t.invalid);return;}if(remove&&!window.confirm(t.confirmRemove))return;
    lock.current=true;setBusy(true);setError("");setMessage("");
    try{const saved=remove?undefined:bankRecipientSchema.parse({...recipient,preferredApp:app||undefined});updateState(s=>({...s,fixedExpenses:s.fixedExpenses?.map(e=>e.id===expense.id?{...e,paymentRecipient:saved}:e)}));await flushWorkspace();if(remove)setRecipient(blank);setMessage(remove?t.clear:t.saved);}
    catch{setError(t.failed);}finally{lock.current=false;setBusy(false);}
  }
  async function record() {
    if(lock.current||!due)return;lock.current=true;setBusy(true);setError("");setMessage("");
    let pending=retryRecord;
    try{if(!retryRecord)updateState(s=>recordFixedExpensePayment(s,expense.id,{dueDate:due,paidOn,amount:Number(amount),walletId:source,note,transactionId:crypto.randomUUID(),existingTransactionId:existingId||undefined},asOf));pending=true;await flushWorkspace();setRetryRecord(false);setMessage(t.success);}
    catch(e){setRetryRecord(pending);setError(e instanceof Error&&e.message==="INVALID_BILL_PAYMENT"?t.invalid:t.failed);}
    finally{lock.current=false;setBusy(false);}
  }
  let bankLink="";
  if(mode==="transfer"&&currency==="VND"&&validTransfer&&bank&&bankApp&&typeof window!=="undefined") {
    try{bankLink=buildBankLink(recipient,transferAmount,recipient.reference,bank,bankApp,new URL("/app/fixedExpenses",window.location.origin).href);}catch{/* No user-supplied URL is opened. */}
  }
  async function copy(value:string) {try{await navigator.clipboard.writeText(value);setMessage(t.copied);}catch{setError(t.clipboardError);}}
  return <div className={styles.root}>
    {payment&&suggestedDue&&suggestedDue!==due&&expense.recurrence!=="once"&&<button type="button" className={styles.next} onClick={()=>setChosenDue(suggestedDue)}>{lang==="vi"?"Kỳ tiếp theo":lang==="zh"?"下一期":"Next occurrence"}: {suggestedDue}</button>}
    {due&&<p className={styles.occurrence}>{t.upcoming}: <b>{due}</b>{payment&&<span className={styles.paid}><CheckCircle2 size={15}/>{t.paid}</span>}</p>}
    {lastPayment&&<p className={styles.last}>{t.recorded} {lastPayment.fixedExpenseDueDate} · {format(lastPayment.amount)}<small>{t.selfReport}</small></p>}
    <div className={styles.actions}><button type="button" disabled={!expense.active||!due||!!payment||!wallet||!!wallet.archived} onClick={()=>open("record")}><CheckCircle2 size={16}/>{t.paid}</button><button type="button" disabled={!expense.active||!due||!!payment||!wallet||!!wallet.archived} onClick={()=>open("transfer")}><ScanLine size={16}/>{t.pay}</button></div>
    {mode&&<Modal title={mode==="record"?t.record:t.transfer} onClose={close} closeLabel={t.close + ": " + (mode==="record"?t.record:t.transfer)}><div className={styles.dialog}>
      <div className={styles.summary}><b>{expense.title}</b><span>{t.planned}: {format(expense.amount)}</span></div>
      <label>{t.due}<input aria-label={t.due} type="date" value={due||""} min={expense.dueDate} disabled={busy||reading||retryRecord} onChange={e=>{setChosenDue(e.target.value);setMessage("");setError("");setReviewed(false);}}/><small>{t.dueHelp}</small></label>
      {payment&&!retryRecord&&!busy?<div role="status" className={styles.success}><CheckCircle2 size={18}/><p><span>{message||t.success}</span><small>{t.selfReport}</small></p><button type="button" onClick={()=>navigate("?tab=transactions&wallet="+encodeURIComponent(payment.wallet)+"&from="+payment.date.slice(0,10)+"&to="+payment.date.slice(0,10))}>{t.linked}</button></div>:mode==="record"?<>
        <p>{t.recordHint}</p>{state.transactions.some(tx=>tx.type==="expense"&&!tx.fixedExpenseId&&tx.category===expense.category&&state.wallets.some(w=>!w.archived&&w.id===tx.wallet&&w.currency===currency))&&<label>{t.existing}<select aria-label={t.existing} value={existingId} disabled={busy||retryRecord} onChange={e=>{setExistingId(e.target.value);const tx=state.transactions.find(row=>row.id===e.target.value);if(tx){setAmount(String(tx.amount));setPaidOn(tx.date.slice(0,10));setSource(tx.wallet);setNote(tx.note);}else{setAmount(String(expense.amount));setPaidOn(asOf);setSource(wallet?.id||"");setNote("");}}}><option value="">{t.newExpense}</option>{state.transactions.filter(tx=>tx.type==="expense"&&!tx.fixedExpenseId&&tx.category===expense.category&&tx.date.slice(0,10)<=asOf&&state.wallets.some(w=>!w.archived&&w.id===tx.wallet&&w.currency===currency)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,100).map(tx=><option value={tx.id} key={tx.id}>{tx.date.slice(0,10)} · {tx.title} · {format(tx.amount)}</option>)}</select></label>}<div className={styles.fields}><label>{t.wallet}<select aria-label={t.wallet} value={source} disabled={busy||retryRecord||!!existingId} onChange={e=>setSource(e.target.value)}>{state.wallets.filter(w=>!w.archived&&w.currency===currency).map(w=><option key={w.id} value={w.id}>{w.name} · {w.currency}</option>)}</select></label><label>{t.amount}<input aria-label={t.amount} type="number" min="0.01" max="1000000000000" step={currency==="VND"||currency==="JPY"?"1":"0.01"} value={amount} disabled={busy||retryRecord||!!existingId} onChange={e=>setAmount(e.target.value)}/></label><label>{t.paidOn}<input aria-label={t.paidOn} type="date" max={asOf} value={paidOn} disabled={busy||retryRecord||!!existingId} onChange={e=>setPaidOn(e.target.value)}/></label><label>{t.note}<input aria-label={t.note} value={note} maxLength={10000} disabled={busy||retryRecord||!!existingId} onChange={e=>setNote(e.target.value)}/></label></div><small>{t.otherWallet}</small>
        <button type="button" className={styles.primary} disabled={busy||!due} onClick={()=>void record()}>{busy?t.saving:retryRecord?t.saveRetry:t.confirm}</button>
      </>:currency!=="VND"?<p role="status">{t.unsupportedCurrency}</p>:<>
        <label className={styles.upload}><Upload size={20}/><b>{reading?t.reading:t.upload}</b><input type="file" aria-label={t.upload} accept="image/png,image/jpeg,image/webp" disabled={busy||reading} onChange={e=>{const file=e.target.files?.[0];if(file)void scan(file);e.target.value="";}}/><small>{t.imageHint}</small></label>
        {catalogError?<p role="alert">{t.noCatalog}<button type="button" onClick={()=>setCatalogAttempt(n=>n+1)}>{t.retry}</button></p>:catalog?.fallback?<small>{t.fallback}</small>:null}
        <h3>{t.manual}</h3><div className={styles.fields}>
          <label>{t.bank}<select aria-label={t.bank} value={recipient.bankBin} disabled={busy||reading} onChange={e=>changeRecipient({...recipient,bankBin:e.target.value})}><option value="">{t.choose}</option>{recipient.bankBin&&!bank&&<option value={recipient.bankBin}>{recipient.bankBin}</option>}{catalog?.banks.map(b=><option key={b.bin} value={b.bin}>{b.name}</option>)}</select></label>
          <label>{t.account}<div className={styles.copyField}><input aria-label={t.account} autoComplete="off" inputMode="text" maxLength={34} value={recipient.accountNumber} disabled={busy||reading} onChange={e=>changeRecipient({...recipient,accountNumber:e.target.value.trim()})}/><button type="button" disabled={!recipient.accountNumber} onClick={()=>void copy(recipient.accountNumber)}>{t.copy}</button></div></label>
          <label>{t.name}<input aria-label={t.name} autoComplete="off" maxLength={80} value={recipient.accountName} disabled={busy||reading} onChange={e=>changeRecipient({...recipient,accountName:e.target.value})}/></label>
          <label>{t.transferAmount}<input aria-label={t.transferAmount} type="number" min="1" max="1000000000000" step="1" value={amount} disabled={busy||reading} onChange={e=>{setAmount(e.target.value);setReviewed(false);setQr("");}}/></label>
          <label className={styles.full}>{t.reference}<div className={styles.copyField}><input aria-label={t.reference} maxLength={50} value={recipient.reference} disabled={busy||reading} onChange={e=>changeRecipient({...recipient,reference:e.target.value})} onBlur={e=>changeRecipient({...recipient,reference:transferText(e.target.value)})}/><button type="button" disabled={!recipient.reference} onClick={()=>void copy(recipient.reference)}>{t.copy}</button></div></label>
        </div>
        {mismatch&&<p className={styles.notice}>{t.mismatch} {t.planned}: {format(expense.amount)}.</p>}<p className={styles.notice}>{t.unverified}</p>
        <div className={styles.actions}><button type="button" disabled={busy||reading||!validRecipient||!bank} onClick={()=>void saveRecipient()}>{busy?t.saving:t.saveRecipient}</button>{expense.paymentRecipient&&<button type="button" disabled={busy||reading} onClick={()=>void saveRecipient(true)}>{t.forget}</button>}</div><small>{t.editing}</small>
        <h3>{t.reviewTitle}</h3><label>{t.bankApp}<select aria-label={t.bankApp} value={app} disabled={busy||reading} onChange={e=>{setApp(e.target.value);setReviewed(false);}}><option value="">{t.choose}</option>{catalog?.apps.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></label>
        {bankApp&&<p className={styles.notice}>{bankApp.autofill?t.autofill:t.openOnly}</p>}
        <label className={styles.review}><input type="checkbox" checked={reviewed} disabled={!validTransfer||!bank||reading||busy} onChange={e=>setReviewed(e.target.checked)}/><span>{t.review}</span></label>
        {reviewed&&validTransfer&&qr&&<figure className={styles.qr}><Image unoptimized src={qr} alt={t.qrAlt} width={256} height={256}/><figcaption>{bank?.name} · {recipient.accountNumber}<br/>{recipient.accountName}<br/><b>{format(transferAmount)}</b><br/>{recipient.reference}</figcaption><a href={qr} download="finbridge-transfer-qr.png">{t.download}</a></figure>}
        <p>{t.desktop}</p><p className={styles.notice}>{t.handoff}</p>
        {bankLink&&reviewed&&!reading&&!busy?<a className={styles.primary} href={bankLink} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" onClick={()=>setHandoff(true)}><ExternalLink size={17}/>{t.open}</a>:<button type="button" className={styles.primary} disabled>{t.open}</button>}
        <p className={styles.notice}>{t.notConfirmed}</p><small>{t.noAuto}</small>
        {handoff&&<button type="button" className={styles.primary} onClick={()=>{setMode("record");setMessage("");setError("");}}>{t.paid}</button>}
      </>}
      {error&&<p role="alert" className={styles.error}>{error}</p>}{message&&!(payment&&mode==="record")&&<p role="status" className={styles.success}>{message}</p>}
      <button type="button" className={styles.cancel} disabled={busy||reading} onClick={close}>{message===t.success?t.close:t.cancel}</button>
    </div></Modal>}
  </div>;
}
