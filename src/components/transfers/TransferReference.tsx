"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { LANGUAGE_LOCALES, type AppLanguage } from "@/lib/i18n";
import { estimateInputSchema, REFERENCE_CURRENCIES, referenceUsable, type EstimateInput, type ReferenceCurrency, type ReferenceDocument, type ReferenceEstimate } from "@/lib/reference-rates";
import { Modal } from "@/components/sites/rolly/replica/Ui";
import { REFERENCE_COPY } from "./reference-copy";
import styles from "./TransferReference.module.css";

export function TransferReference({ owner, lang }: { owner: string; lang: AppLanguage }) {
  const t = REFERENCE_COPY[lang], locale = LANGUAGE_LOCALES[lang];
  const [document, setDocument] = useState<ReferenceDocument | null>(null), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [currency, setCurrency] = useState<ReferenceCurrency>("CNY"), [amount, setAmount] = useState("1000"), [selected, setSelected] = useState<ReferenceEstimate | null>(null), [count, setCount] = useState(5);
  const [pending, setPending] = useState<EstimateInput | null>(null), [now, setNow] = useState(0);
  const active = useRef(true), locked = useRef(false), offset = useRef(0);
  const money = (value: string, unit: string) => new Intl.NumberFormat(locale, { style: "currency", currency: unit, currencyDisplay: "code" }).format(Number(value));
  const rateText = (value: string) => new Intl.NumberFormat(locale, { maximumFractionDigits: 10 }).format(Number(value)) + " VND";
  const date = (value: string, time = false) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", ...(time ? { timeStyle: "short" as const } : { timeZone: "UTC" }) }).format(new Date(time ? value : value + "T12:00:00Z"));
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/international-transfers/reference", { cache: "no-store", headers: { "x-finbridge-workspace-owner": owner }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      if (active.current && !signal?.aborted) { offset.current = Date.parse(body.serverTime) - Date.now(); setNow(Date.now() + offset.current); setDocument(body); }
    } catch (e) { if (active.current && !signal?.aborted) setError(e instanceof Error ? e.message : "UNAVAILABLE"); }
    finally { if (active.current && !signal?.aborted) setLoading(false); }
  }, [owner]);
  useEffect(() => {
    active.current = true; const abort = new AbortController();
    void Promise.resolve().then(() => { if (!abort.signal.aborted) void load(abort.signal); });
    const timer = window.setInterval(() => setNow(Date.now() + offset.current), 30000);
    return () => { active.current = false; abort.abort(); window.clearInterval(timer); };
  }, [load]);
  const pair = document?.rates.find(r => r.currency === currency), reference = pair?.reference;
  const usable = !!pair?.usable && !!reference && !!now && referenceUsable(reference, new Date(now));
  async function save(input: EstimateInput) {
    if (locked.current) return;
    locked.current = true; setSaving(true); setError(""); setPending(input);
    try {
      const response = await fetch("/api/international-transfers/reference", { method: "POST", headers: { "Content-Type": "application/json", "x-finbridge-workspace-owner": owner }, body: JSON.stringify(input), signal: AbortSignal.timeout(15000) });
      const body = await response.json(); if (!active.current) return;
      if (!response.ok) { if (response.status < 500) setPending(null); throw new Error(body.error); }
      setPending(null); setSelected(body);
      setDocument(current => current ? { ...current, estimates: [body, ...current.estimates.filter(e => e.id !== body.id)].slice(0, 20) } : current);
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : "UNAVAILABLE"); }
    finally { locked.current = false; if (active.current) setSaving(false); }
  }
  function submit() {
    if (!reference || !usable) return;
    const parsed = estimateInputSchema.safeParse({ amount, referenceId: reference.id, mutationId: crypto.randomUUID() });
    if (!parsed.success) { setError("INVALID_COMMAND"); return; }
    void save(parsed.data);
  }
  const errorText = error === "RATE_STALE" ? t.stale : error === "RATE_UNAVAILABLE" ? t.unavailable : error === "RATE_LIMITED" ? t.limited : error === "INVALID_COMMAND" ? t.invalid : error === "MUTATION_MISMATCH" ? t.mismatch : ["UNAUTHENTICATED", "WORKSPACE_OWNER_CHANGED"].includes(error) ? t.auth : t.error;
  return <section className={styles.card} aria-label={t.title}>
    <header><div><h2>{t.title}</h2><p>{t.subtitle}</p></div><button type="button" disabled={loading || saving || !!pending} onClick={() => void load()}><RefreshCw size={15}/>{t.refresh}</button></header>
    {loading && !document && <p role="status">{t.loading}</p>}
    {error && <p role="alert" className={styles.warning}>{errorText}</p>}
    <form onSubmit={e => { e.preventDefault(); submit(); }} className={styles.form}>
      <label>{t.currency}<select value={currency} disabled={saving || !!pending} onChange={e => { setCurrency(e.target.value as ReferenceCurrency); setError(""); }}>{REFERENCE_CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></label>
      <label>{t.amount} · {currency}<input inputMode="decimal" type="number" min="0.01" max="1000000" step="0.01" required disabled={saving || !!pending} value={amount} onChange={e => { setAmount(e.target.value); setError(""); }}/></label>
      <button type="submit" disabled={!usable || loading || saving || !!pending}>{t.calculate}</button>
      {pending && <button type="button" disabled={saving} onClick={() => void save(pending)}>{t.retry}</button>}
    </form>
    {reference ? <div className={styles.rate}><b>1 {currency} = {rateText(reference.rate)}</b><span>{t.source}: <a href="https://frankfurter.dev/" target="_blank" rel="noreferrer">Frankfurter</a></span><span>{t.date}: {date(reference.date)}</span><span>{t.fetched}: {date(reference.fetchedAt, true)}</span></div> : !loading && <p className={styles.warning}>{t.unavailable}</p>}
    {reference && !usable && <p className={styles.warning}>{t.stale}</p>}
    {reference && pair?.cached && <p className={styles.warning}>{t.cached}</p>}
    <p className={styles.note}>{t.note}</p>
    {!!document?.estimates.length && <details className={styles.history}><summary>{t.history} ({document.estimates.length})</summary>
      <div>{document.estimates.slice(0, count).map(estimate => <button type="button" key={estimate.id} onClick={() => setSelected(estimate)}><span>{money(estimate.amount, estimate.reference.base)} → <b>{money(estimate.convertedVnd, "VND")}</b></span><small>{date(estimate.createdAt, true)}</small></button>)}</div>
      {count < document.estimates.length && <button type="button" onClick={() => setCount(c => c + 5)}>{t.more}</button>}{count > 5 && <button type="button" onClick={() => setCount(5)}>{t.collapse}</button>}
    </details>}
    <details className={styles.scope}><summary>{t.scope}</summary><p>{t.settings}</p></details>
    {selected && <Modal title={t.details} closeLabel={t.close} onClose={() => setSelected(null)}><div className={styles.detail}>
      <p>{t.saved}</p><h3>{money(selected.amount, selected.reference.base)} → {money(selected.convertedVnd, "VND")}</h3>
      <dl><div><dt>{t.result}</dt><dd>{money(selected.convertedVnd, "VND")}</dd></div><div><dt>{t.rate}</dt><dd>1 {selected.reference.base} = {rateText(selected.reference.rate)}</dd></div><div><dt>{t.source}</dt><dd>{selected.reference.source}</dd></div><div><dt>{t.date}</dt><dd>{date(selected.reference.date)}</dd></div><div><dt>{t.fetched}</dt><dd>{date(selected.reference.fetchedAt, true)}</dd></div></dl>
      <p>{t.note}</p><p>{t.snapshot}</p><small>{selected.id}</small>
    </div></Modal>}
  </section>;
}
