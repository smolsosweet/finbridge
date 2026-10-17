"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Globe2, Pause, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { useAuthenticatedUser } from "@/components/auth/AuthenticatedUser";
import { FinBridgeHeader } from "@/components/sites/rolly/replica/FinBridgeHeader";
import { CalendarLedgerModal } from "@/components/sites/rolly/replica/CalendarLedgerModal";
import { Modal } from "@/components/sites/rolly/replica/Ui";
import { setSetting, useAppState } from "@/components/sites/rolly/replica/store";
import { LANGUAGE_LOCALES, resolveLanguage } from "@/lib/i18n";
import { TRANSFER_APPROVAL_MS, TRANSFER_SCHOOLS, transferDate, type TransferBill, type TransferBillInput, type TransferCommand, type TransferDocument, type TransferPlan, type TransferQuote } from "@/lib/international-transfer";
import { TRANSFER_COPY, transferProviderName } from "./transfer-copy";
import styles from "./InternationalTransfers.module.css";

type CommandInput = TransferCommand extends infer C ? C extends TransferCommand ? Omit<C, "mutationId"> : never : never;
type Result = TransferDocument & { resultId?: string };
type Pending = { command: TransferCommand; onSuccess?: (doc: Result) => void };
const pageSize = 7;
export function InternationalTransfers({ navigate }: { navigate: (path: string) => void }) {
  const user = useAuthenticatedUser(), state = useAppState();
  const lang = resolveLanguage(state.settings.language, "en"), t = TRANSFER_COPY[lang], locale = LANGUAGE_LOCALES[lang];
  const [doc, setDoc] = useState<TransferDocument | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [view, setView] = useState<"bills" | "history">("bills"), [search, setSearch] = useState(""), [page, setPage] = useState(1), [includeArchived, setIncludeArchived] = useState(false);
  const [editor, setEditor] = useState<{ previous?: TransferBill; bill: TransferBillInput } | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null), [planId, setPlanId] = useState<string | null>(null), [preference, setPreference] = useState("cost"), [acknowledged, setAcknowledged] = useState(false);
  const [calendar, setCalendar] = useState(false), [now, setNow] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const offset = useRef(0), locked = useRef(false), generation = useRef(0);
  const money = (amount: number | string, currency = "VND") => new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "code" }).format(Number(amount));
  const dateText = (value: string, time = false) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", ...(time ? { timeStyle: "short" as const } : { timeZone: "UTC" }) }).format(new Date(value.length === 10 ? value + "T12:00:00Z" : value));
  const errorText = (code: string) => code === "UNAVAILABLE" ? t.error : t.errors[code as keyof typeof t.errors] || t.error;
  const accept = useCallback((result: Result) => { offset.current = Date.parse(result.serverTime) - Date.now(); setNow(Date.now() + offset.current); setDoc(result); }, []);
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!user) return;
    try {
      const response = await fetch("/api/international-transfers", { headers: { "x-finbridge-workspace-owner": user.id }, cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "UNAVAILABLE");
      if (!signal?.aborted) { accept(body); setError(""); }
    } catch (e) { if (!signal?.aborted) setError(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "UNAVAILABLE"); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [user, accept]);
  useEffect(() => {
    const abort = new AbortController(); const token = ++generation.current;
    void Promise.resolve().then(() => { if (!abort.signal.aborted) void load(abort.signal); });
    return () => { abort.abort(); generation.current = token + 1; };
  }, [load]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now() + offset.current), 1000); return () => window.clearInterval(timer); }, []);
  async function dispatch(request: Pending) {
    if (!user || locked.current) return;
    const token = generation.current;
    locked.current = true; setBusy(true); setError(""); setPending(request);
    try {
      const response = await fetch("/api/international-transfers", { method: "POST", headers: { "Content-Type": "application/json", "x-finbridge-workspace-owner": user.id }, body: JSON.stringify(request.command), signal: AbortSignal.timeout(20000) });
      const result = await response.json();
      if (token !== generation.current) return;
      if (!response.ok) { if (response.status < 500) setPending(null); throw new Error(result.error || "UNAVAILABLE"); }
      setPending(null); accept(result); request.onSuccess?.(result);
    } catch (e) { if (token === generation.current) setError(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "UNAVAILABLE"); }
    finally { locked.current = false; if (token === generation.current) setBusy(false); }
  }
  function send(command: CommandInput, onSuccess?: Pending["onSuccess"]) { void dispatch({ command: { ...command, mutationId: crypto.randomUUID() } as TransferCommand, onSuccess }); }
  function openNew() {
    const due = new Date(); due.setUTCDate(due.getUTCDate() + 14);
    setError(""); setEditor({ bill: { schoolId: "shenzhen", title: "", amount: "1000", dueDate: transferDate(due), reference: "" } });
  }
  function compare(bill: TransferBill) { send({ action: "quote", id: bill.id, version: bill.version }, () => { setCompareId(bill.id); setPlanId(null); }); }
  function openPlan(plan: TransferPlan) { setAcknowledged(false); setError(""); setPlanId(plan.id); }
  const comparing = doc?.bills.find(b => b.id === compareId), plan = doc?.plans.find(p => p.id === planId) || doc?.receipts.find(p => p.id === planId);
  const account = (q: TransferQuote) => doc?.accounts.find(a => a.id === q.provider);
  const quotes = (doc?.quotes.filter(q => q.billId === compareId && q.billVersion === comparing?.version) || []).sort((a, b) => Number(b.eligible) - Number(a.eligible) || (preference === "speed" ? a.maxDays - b.maxDays : 0) || a.total - b.total);
  const matchedSchool = (id: string) => TRANSFER_SCHOOLS.find(s => s.id === id)!;
  const filteredBills = (doc?.bills || []).filter(b => (includeArchived || !b.archived) && `${b.title} ${b.reference} ${matchedSchool(b.schoolId).name}`.toLowerCase().includes(search.toLowerCase()));
  const filteredPlans = (doc?.plans || []).filter(p => `${p.bill.title} ${p.bill.reference} ${p.id}`.toLowerCase().includes(search.toLowerCase()));
  const items = view === "bills" ? filteredBills : filteredPlans, pages = Math.max(1, Math.ceil(items.length / pageSize)), currentPage = Math.min(page, pages);
  function clockText(expires: string) { const seconds = Math.max(0, Math.ceil((Date.parse(expires) - now) / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
  function recipient(bill: TransferBillInput) {
    const school = matchedSchool(bill.schoolId);
    return <section className={styles.recipient}><b><ShieldCheck size={16}/>{t.matched}</b><dl><div><dt>{t.school}</dt><dd>{school.name}</dd></div><div><dt>{t.recipient}</dt><dd>{school.recipient}</dd></div><div><dt>{t.bank}</dt><dd>{school.bank}</dd></div><div><dt>{t.bankCode}</dt><dd>{school.bankCode}</dd></div><div><dt>{t.account}</dt><dd>{school.account}</dd></div></dl><small>{t.registryHelp}</small></section>;
  }
  function costs(q: TransferQuote) {
    return <dl className={styles.costs}><div><dt>{t.rate}</dt><dd>1 {q.currency} = {money(q.rate)}</dd></div><div><dt>{t.conversion}</dt><dd>{money(q.conversion)}</dd></div><div><dt>{t.markup}</dt><dd>{money(q.fxMarkup)}</dd></div><div><dt>{t.fee}</dt><dd>{money(q.transferFee)}</dd></div><div className={styles.total}><dt>{t.total}</dt><dd>{money(q.total)}</dd></div><div><dt>{t.receives}</dt><dd>{money(q.receiveAmount, q.currency)}</dd></div></dl>;
  }
  const errorBanner = error ? <div className={styles.error} role="alert"><p>{errorText(error)}</p>{pending ? <button type="button" onClick={() => void dispatch(pending)} disabled={busy}>{t.retry}</button> : !editor && !plan ? <button type="button" onClick={() => void load()} disabled={loading || busy}>{t.retry}</button> : null}</div> : null;
  const q = plan?.quote, source = q ? account(q) : undefined, complete = plan?.status === "completed";
  const terminal = !!plan && ["cancelled", "invalidated"].includes(plan.status), expired = !!q && now >= Date.parse(q.expiresAt);
  const approvalValid = plan?.status === "approved" && !!plan.approvedAt && now < Date.parse(plan.approvedAt) + TRANSFER_APPROVAL_MS;
  const balance = source?.balance || 0, insufficient = !!q && balance - q.total < (doc?.reserve || 0);
  return <main className={`fb-home ${styles.page}`}>
    <FinBridgeHeader lang={lang} title={t.title} subtitle={t.subtitle} eyebrow={t.eyebrow} navigate={navigate} theme={String(state.settings.theme)} currentLanguage={String(state.settings.language)} onSelectLanguage={value => setSetting("language", value)} onToggleTheme={() => setSetting("theme", state.settings.theme === "dark" ? "light" : "dark")} onOpenCalendar={() => setCalendar(true)} primaryAction={<button type="button" aria-label={t.newBill} className="fb-add-button fb-header-primary-action" disabled={!doc || busy} onClick={openNew}><Plus size={17}/><span>{t.newBill}</span></button>}/>
    <aside className={styles.banner}><Globe2 size={23}/><div><b>{t.sandbox}</b><p>{t.disclaimer}</p></div></aside>
    {errorBanner}
    {loading && !doc && <p role="status">{t.loading}</p>}
    {doc && <>
      <details className={styles.controls}><summary><span><ShieldCheck size={17}/>{t.controls}</span><span>{t.saved}</span></summary><div className={styles.controlBody}><p>{t.balanceHelp}</p><div className={styles.accounts}>{doc.accounts.map(a => <article key={a.id}><b>{transferProviderName(a.id, lang)}</b><strong>{money(a.balance)}</strong><small>{t.spent}: {money(a.spent)}</small></article>)}</div><p>{t.reserve}: <b>{money(doc.reserve)}</b></p><button type="button" disabled={busy} className={doc.paused ? styles.primary : styles.danger} onClick={() => send({ action: "pause", paused: !doc.paused })}>{doc.paused ? <RefreshCw size={15}/> : <Pause size={15}/>} {doc.paused ? t.resume : t.pause}</button></div></details>
      {doc.paused && <div className={styles.warning} role="status">{t.paused}</div>}
      {!comparing ? <>
        <nav className={styles.tabs} role="tablist" aria-label={t.title}>{(["bills", "history"] as const).map(v => <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => { setView(v); setPage(1); setSearch(""); }}>{t[v]} <span>{v === "bills" ? doc.bills.filter(b => !b.archived).length : doc.plans.length}</span></button>)}</nav>
        <div className={styles.toolbar}><input aria-label={t.search} placeholder={t.search} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/>{view === "bills" && <label><input type="checkbox" checked={includeArchived} onChange={e => { setIncludeArchived(e.target.checked); setPage(1); }}/>{t.showArchived}</label>}</div>
        <div className={styles.list}>
          {view === "bills" ? filteredBills.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(b => {
            const completed = doc.receipts.find(p => p.bill.id === b.id), school = matchedSchool(b.schoolId);
            return <article className={styles.row} key={b.id}><div><h2>{b.title}</h2><p>{school.name} · {b.reference}</p><small>{t.due}: {dateText(b.dueDate)} · {b.archived ? t.archived : t.active}</small></div><strong>{money(b.amount, school.currency)}</strong><div className={styles.rowActions}>{completed ? <button type="button" onClick={() => openPlan(completed)}>{t.receipt}</button> : <><button type="button" className={styles.primary} disabled={b.archived || doc.paused || busy} onClick={() => compare(b)}>{t.compare}<ArrowRight size={14}/></button><button type="button" disabled={busy} onClick={() => { setError(""); setEditor({ previous: b, bill: { schoolId: b.schoolId, title: b.title, amount: b.amount, dueDate: b.dueDate, reference: b.reference } }); }}>{t.edit}</button><button type="button" disabled={busy} onClick={() => send({ action: "archiveBill", id: b.id, version: b.version, archived: !b.archived })}>{b.archived ? t.restore : t.archive}</button></>}</div></article>;
          }) : filteredPlans.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(p => <article className={styles.row} key={p.id}><div><h2>{p.bill.title}</h2><p>{transferProviderName(p.quote.provider, lang)} · {p.bill.reference}</p><small>{dateText(p.createdAt, true)}</small></div><div><strong>{money(p.quote.total)}</strong><span className={styles.badge}>{t.states[p.status]}</span></div><button type="button" onClick={() => openPlan(p)}>{t.details}<ArrowRight size={14}/></button></article>)}
          {!items.length && <section className={styles.empty}><Globe2 size={36}/><h2>{view === "bills" ? t.empty : t.noHistory}</h2><p>{t.emptyHelp}</p>{view === "bills" && <button type="button" className={styles.primary} onClick={openNew}>{t.newBill}</button>}</section>}
        </div>
        {pages > 1 && <nav className={styles.pagination} aria-label={t.page}><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>{t.prev}</button><span>{t.page} {currentPage} / {pages}</span><button disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>{t.next}</button></nav>}
        {view === "history" && doc.hasMore && <p className={styles.note}>{t.recent}</p>}
      </> : <section className={styles.comparison}>
        <div className={styles.comparisonHeading}><button type="button" onClick={() => setCompareId(null)}><ArrowLeft size={16}/>{t.back}</button><button type="button" disabled={busy || doc.paused} onClick={() => compare(comparing)}><RefreshCw size={15}/>{t.refresh}</button></div>
        <ol className={styles.steps}>{t.steps.map((step, i) => <li key={step} aria-current={i === 1 ? "step" : undefined}>{step}</li>)}</ol>
        <div className={styles.comparisonHeading}><div><h2>{comparing.title}</h2><p>{matchedSchool(comparing.schoolId).name} · <b>{money(comparing.amount, matchedSchool(comparing.schoolId).currency)}</b></p><small>{comparing.reference} · {t.due}: {dateText(comparing.dueDate)}</small></div><label>{t.preference}<select value={preference} onChange={e => setPreference(e.target.value)}><option value="cost">{t.cheaper}</option><option value="speed">{t.faster}</option></select></label></div>
        <p className={styles.note}>{t.compareHelp}</p>
        <div className={styles.quotes}>{quotes.map((q, i) => {
          const expired = Date.parse(q.expiresAt) <= now, source = account(q), insufficient = !!source && source.balance - q.total < doc.reserve;
          return <article className={`${styles.quote} ${!q.eligible ? styles.referenceQuote : ""}`} key={q.id}><header><h3>{transferProviderName(q.provider, lang)}</h3><span className={styles.badge}>{q.eligible ? i === 0 ? t.best : t.sandbox : t.referenceOnly}</span></header>{costs(q)}<div className={styles.timing}><p><Clock3 size={15}/>{t.eta}: {dateText(q.arrivalDate)} ({q.minDays}–{q.maxDays} {t.days})</p><small>{t.latest}: {dateText(q.latestSendDate)}</small><small>{expired ? t.expired : `${t.expires}: ${clockText(q.expiresAt)}`}</small></div>{q.deadlineRisk && <p className={styles.warning}>{t.deadline}</p>}{!q.eligible && <p className={styles.note}>{q.provider === "BANK_B" ? t.bankB : t.unavailableRoute}</p>}{source && <p className={styles.note}>{t.available}: {money(source.balance)}</p>}{insufficient && <p className={styles.warning}>{t.insufficient}</p>}<button type="button" className={styles.primary} disabled={busy || doc.paused || expired || !q.eligible || insufficient} onClick={() => send({ action: "draft", quoteId: q.id }, result => { if (result.resultId) { setAcknowledged(false); setPlanId(result.resultId); } })}>{t.choose}<ArrowRight size={15}/></button></article>;
        })}</div>
        {!quotes.length && <p className={styles.warning}>{t.expired}</p>}
      </section>}
      <details className={styles.audit}><summary>{t.audit} · {doc.audit.length}</summary><ol>{doc.audit.slice(0, 30).map(a => <li key={a.id}><span>{t.events[a.event as keyof typeof t.events] || a.event}</span><time>{dateText(a.createdAt, true)}</time><small>{a.targetId}</small></li>)}</ol></details>
    </>}
    {editor && <Modal title={editor.previous ? t.edit : t.newBill} wide closeLabel={t.close} onClose={() => { if (!busy) setEditor(null); }}><form className={styles.editor} onSubmit={e => { e.preventDefault(); send({ action: "saveBill", ...(editor.previous ? { id: editor.previous.id, version: editor.previous.version } : {}), bill: editor.bill }, () => { setEditor(null); setCompareId(null); setView("bills"); setPage(1); }); }}>
      <p className={styles.note}>{t.disclaimer}</p>{errorBanner}<div className={styles.formGrid}>
        <label>{t.school}<select value={editor.bill.schoolId} onChange={e => setEditor({ ...editor, bill: { ...editor.bill, schoolId: e.target.value as TransferBillInput["schoolId"] } })}>{TRANSFER_SCHOOLS.map(s => <option key={s.id} value={s.id}>{s.name} · {s.currency}</option>)}</select></label>
        <label>{t.billTitle}<input required maxLength={140} value={editor.bill.title} onChange={e => setEditor({ ...editor, bill: { ...editor.bill, title: e.target.value } })}/></label>
        <label>{t.amount} · {matchedSchool(editor.bill.schoolId).currency}<input type="number" required min="0.01" max="1000000" step="0.01" value={editor.bill.amount} onChange={e => setEditor({ ...editor, bill: { ...editor.bill, amount: e.target.value } })}/></label>
        <label>{t.due}<input type="date" required min={now ? transferDate(new Date(now)) : undefined} value={editor.bill.dueDate} onChange={e => setEditor({ ...editor, bill: { ...editor.bill, dueDate: e.target.value } })}/></label>
        <label className={styles.full}>{t.reference}<input aria-label={t.reference} required maxLength={140} value={editor.bill.reference} onChange={e => setEditor({ ...editor, bill: { ...editor.bill, reference: e.target.value } })}/><small>{t.referenceHelp}</small></label>
      </div>{recipient(editor.bill)}<footer className={styles.actions}><button type="button" disabled={busy} onClick={() => setEditor(null)}>{t.cancel}</button><button type="submit" className={styles.primary} disabled={busy}>{busy ? t.processing : t.save}</button></footer>
    </form></Modal>}
    {plan && q && <Modal title={complete ? t.receipt : t.review} wide closeLabel={t.close} onClose={() => { if (!busy) setPlanId(null); }}><div className={styles.review}>{errorBanner}<ol className={styles.steps}>{t.steps.map((step, i) => <li key={step} aria-current={i === (complete ? 3 : 2) ? "step" : undefined}>{step}</li>)}</ol><div className={styles.receiptHeading}>{complete && <CheckCircle2 size={28}/>}<div><h3>{plan.bill.title}</h3><p>{plan.bill.reference} · {t.states[plan.status]}</p></div></div>
        {complete && <p className={styles.success}>{t.receiptHelp}</p>}<div className={styles.reviewGrid}><div>{recipient(plan.bill)}</div><div><h3>{transferProviderName(q.provider, lang)}</h3>{costs(q)}<dl className={styles.costs}><div><dt>{t.source}</dt><dd>{transferProviderName(q.provider, lang)}</dd></div><div><dt>{complete ? t.available : t.available}</dt><dd>{money(complete ? plan.balanceBefore! : balance)}</dd></div><div><dt>{t.after}</dt><dd>{money(complete ? plan.balanceAfter! : balance - q.total)}</dd></div><div><dt>{t.reserve}</dt><dd>{money(doc?.reserve || 0)}</dd></div><div><dt>{t.eta}</dt><dd>{dateText(q.arrivalDate)}</dd></div><div><dt>{t.due}</dt><dd>{dateText(plan.bill.dueDate)}</dd></div></dl></div></div>
        {complete ? <dl className={styles.receiptIds}><div><dt>{t.receiptId}</dt><dd>{plan.receiptId}</dd></div><div><dt>{t.planId}</dt><dd>{plan.id}</dd></div><div><dt>{t.approvedOn}</dt><dd>{plan.approvedAt && dateText(plan.approvedAt, true)}</dd></div><div><dt>{t.completedOn}</dt><dd>{plan.completedAt && dateText(plan.completedAt, true)}</dd></div></dl> : <>
          <p className={styles.note}>{expired ? t.expired : `${t.expires}: ${clockText(q.expiresAt)}`}</p>{q.deadlineRisk && <p className={styles.warning}>{t.deadline}</p>}{insufficient && <p className={styles.warning}>{t.insufficient}</p>}{doc?.paused && <p className={styles.warning}>{t.paused}</p>}{plan.status === "approved" && <p className={styles.note}>{approvalValid ? t.approved : t.approvalExpired}</p>}
          {!terminal && !approvalValid && <label className={styles.acknowledge}><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)}/>{t.acknowledgement}</label>}
          <footer className={styles.actions}>{!terminal && <button type="button" disabled={busy} onClick={() => send({ action: "cancel", id: plan.id })}>{t.cancel}</button>}{expired || terminal ? <button type="button" className={styles.primary} disabled={busy || doc?.paused} onClick={() => { const b = doc?.bills.find(b => b.id === plan.bill.id); if (b) compare(b); }}>{t.refresh}</button> : approvalValid ? <button type="button" className={styles.primary} disabled={busy || doc?.paused || insufficient} onClick={() => send({ action: "execute", id: plan.id }, () => { setAcknowledged(false); setCompareId(null); })}>{busy ? t.processing : t.execute}</button> : <button type="button" className={styles.primary} disabled={busy || !acknowledged || doc?.paused || insufficient} onClick={() => send({ action: "approve", id: plan.id, acknowledge: true })}>{busy ? t.processing : t.approve}</button>}</footer>
        </>}
      </div></Modal>}
    {calendar && <CalendarLedgerModal onClose={() => setCalendar(false)} navigate={navigate}/>}
  </main>;
}
