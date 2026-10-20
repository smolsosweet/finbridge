"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftRight, RefreshCw } from "lucide-react";
import { LANGUAGE_LOCALES, type AppLanguage } from "@/lib/i18n";
import {
  ALL_REFERENCE_CURRENCIES,
  estimateInputSchema,
  referenceUsable,
  type EstimateInput,
  type ReferenceDocument,
  type ReferenceEstimate,
  type ReferenceRate,
  type SupportedReferenceCurrency,
} from "@/lib/reference-rates";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/currency-format";
import { Modal } from "@/components/finbridge/workspace/Ui";
import { REFERENCE_COPY } from "./reference-copy";
import styles from "./TransferReference.module.css";

type EstimateMeta = {
  sourceCurrency: string;
  sourceAmount: string;
  targetCurrency: string;
  targetAmount: string;
};

const META_STORAGE_KEY = "finbridge-reference-meta-v1";

function readMetaStorage(): Record<string, EstimateMeta> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeMetaStorage(id: string, meta: EstimateMeta) {
  if (typeof window === "undefined") return;
  try {
    const existing = readMetaStorage();
    existing[id] = meta;
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(existing));
  } catch {
    // Ignore storage issues
  }
}

export function TransferReference({ owner, lang }: { owner: string; lang: AppLanguage }) {
  const t = REFERENCE_COPY[lang], locale = LANGUAGE_LOCALES[lang];
  const [document, setDocument] = useState<ReferenceDocument | null>(null), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [fromCurrency, setFromCurrency] = useState<SupportedReferenceCurrency>("CNY");
  const [toCurrency, setToCurrency] = useState<SupportedReferenceCurrency>("VND");
  const [amount, setAmount] = useState("1000");
  const [selected, setSelected] = useState<ReferenceEstimate | null>(null);
  const [count, setCount] = useState(5);
  const [pending, setPending] = useState<EstimateInput | null>(null), [now, setNow] = useState(0);
  const [metaMap, setMetaMap] = useState<Record<string, EstimateMeta>>({});
  const active = useRef(true), locked = useRef(false), offset = useRef(0);

  useEffect(() => {
    setMetaMap(readMetaStorage());
  }, []);

  const money = (value: string | number, unit: string) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return "0 " + unit;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: unit,
      currencyDisplay: "code",
      maximumFractionDigits: unit === "VND" ? 0 : 2,
    }).format(num);
  };
  const rateText = (value: number | string) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 10 }).format(Number(value)) + " VND";
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

  const getRateInfo = useCallback((cur: SupportedReferenceCurrency) => {
    if (cur === "VND") {
      return { rate: 1, reference: null as ReferenceRate | null, usable: true, cached: false };
    }
    const pair = document?.rates.find(r => r.currency === cur);
    const ref = pair?.reference || null;
    const isUsable = !!pair?.usable && !!ref && !!now && referenceUsable(ref, new Date(now));
    return {
      rate: ref ? Number(ref.rate) : 0,
      reference: ref,
      usable: isUsable,
      cached: !!pair?.cached,
    };
  }, [document, now]);

  const fromInfo = getRateInfo(fromCurrency);
  const toInfo = getRateInfo(toCurrency);
  const usable = fromInfo.usable && toInfo.usable;
  const hasRates = fromInfo.rate > 0 && toInfo.rate > 0;
  const crossRate = hasRates ? fromInfo.rate / toInfo.rate : 0;

  const numericAmount = parseCurrencyInput(amount);
  let liveConvertedText = "";
  if (usable && hasRates && crossRate > 0 && Number.isFinite(numericAmount) && numericAmount > 0) {
    const convertedVal = numericAmount * crossRate;
    const formattedNum = toCurrency === "VND" ? Math.round(convertedVal) : Number(convertedVal.toFixed(2));
    liveConvertedText = `≈ ${money(formattedNum, toCurrency)}`;
  }

  function handleSwap() {
    setError("");
    const nextFrom = toCurrency;
    const nextTo = fromCurrency;
    setFromCurrency(nextFrom);
    setToCurrency(nextTo);
    if (Number.isFinite(numericAmount) && numericAmount > 0 && crossRate > 0) {
      const converted = numericAmount * crossRate;
      const formattedNum = nextTo === "VND" ? Math.round(converted) : Number(converted.toFixed(2));
      setAmount(formatCurrencyInput(formattedNum));
    }
  }

  function handleFromChange(val: SupportedReferenceCurrency) {
    setError("");
    if (val === toCurrency) {
      setToCurrency(fromCurrency);
    }
    setFromCurrency(val);
  }

  function handleToChange(val: SupportedReferenceCurrency) {
    setError("");
    if (val === fromCurrency) {
      setFromCurrency(toCurrency);
    }
    setToCurrency(val);
  }

  async function save(input: EstimateInput, meta?: EstimateMeta) {
    if (locked.current) return;
    locked.current = true; setSaving(true); setError(""); setPending(input);
    try {
      const response = await fetch("/api/international-transfers/reference", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-finbridge-workspace-owner": owner },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(15000),
      });
      const body = await response.json(); if (!active.current) return;
      if (!response.ok) { if (response.status < 500) setPending(null); throw new Error(body.error); }
      setPending(null);
      setSelected(body);
      if (meta) {
        writeMetaStorage(body.id, meta);
        setMetaMap(prev => ({ ...prev, [body.id]: meta }));
      }
      setDocument(current => current ? { ...current, estimates: [body, ...current.estimates.filter(e => e.id !== body.id)].slice(0, 20) } : current);
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : "UNAVAILABLE"); }
    finally { locked.current = false; if (active.current) setSaving(false); }
  }

  function submit() {
    if (!usable || !hasRates || crossRate <= 0) return;
    const num = parseCurrencyInput(amount);
    if (!Number.isFinite(num) || num <= 0) {
      setError("INVALID_COMMAND");
      return;
    }

    let foreignAmountStr: string;
    let refId: string;
    const mutationId = crypto.randomUUID();

    if (fromCurrency !== "VND") {
      if (num > 1_000_000) {
        setError("INVALID_COMMAND");
        return;
      }
      foreignAmountStr = Number.isInteger(num) ? String(num) : num.toFixed(2);
      refId = fromInfo.reference!.id;
    } else {
      const foreignNum = Math.round((num / toInfo.rate) * 100) / 100;
      if (foreignNum <= 0 || foreignNum > 1_000_000) {
        setError("INVALID_COMMAND");
        return;
      }
      foreignAmountStr = foreignNum.toFixed(2);
      refId = toInfo.reference!.id;
    }

    const parsed = estimateInputSchema.safeParse({ amount: foreignAmountStr, referenceId: refId, mutationId });
    if (!parsed.success) { setError("INVALID_COMMAND"); return; }

    const converted = num * crossRate;
    const targetAmountStr = toCurrency === "VND" ? String(Math.round(converted)) : converted.toFixed(2);
    const meta: EstimateMeta = {
      sourceCurrency: fromCurrency,
      sourceAmount: String(num),
      targetCurrency: toCurrency,
      targetAmount: targetAmountStr,
    };

    void save(parsed.data, meta);
  }

  const errorText = error === "RATE_STALE" ? t.stale : error === "RATE_UNAVAILABLE" ? t.unavailable : error === "RATE_LIMITED" ? t.limited : error === "INVALID_COMMAND" ? t.invalid : error === "MUTATION_MISMATCH" ? t.mismatch : ["UNAUTHENTICATED", "WORKSPACE_OWNER_CHANGED"].includes(error) ? t.auth : t.error;

  const primaryRef = fromInfo.reference || toInfo.reference;
  const isStale = (fromInfo.reference && !fromInfo.usable) || (toInfo.reference && !toInfo.usable);
  const isCached = fromInfo.cached || toInfo.cached;

  return <section className={styles.card} aria-label={t.title}>
    <header><div><h2>{t.title}</h2><p>{t.subtitle}</p></div><button type="button" disabled={loading || saving || !!pending} onClick={() => void load()}><RefreshCw size={15}/>{t.refresh}</button></header>
    {loading && !document && <p role="status">{t.loading}</p>}
    {error && <p role="alert" className={styles.warning}>{errorText}</p>}
    <form onSubmit={e => { e.preventDefault(); submit(); }} className={styles.formGrid}>
      <label className={`${styles.field} ${styles.fromField}`}>
        <span>{t.from}</span>
        <select
          value={fromCurrency}
          disabled={saving || !!pending}
          onChange={e => handleFromChange(e.target.value as SupportedReferenceCurrency)}
        >
          {ALL_REFERENCE_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>

      <div className={styles.swapCol}>
        <span className={styles.labelPlaceholder} aria-hidden="true">&nbsp;</span>
        <button type="button" className={styles.swapBtn} onClick={handleSwap} title={t.swap} aria-label={t.swap}>
          <ArrowLeftRight size={16} />
        </button>
      </div>

      <label className={`${styles.field} ${styles.toField}`}>
        <span>{t.to}</span>
        <select
          value={toCurrency}
          disabled={saving || !!pending}
          onChange={e => handleToChange(e.target.value as SupportedReferenceCurrency)}
        >
          {ALL_REFERENCE_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>

      <label className={`${styles.field} ${styles.amountField}`}>
        <span>{`${t.convertAmount || t.amount} · ${fromCurrency}`}</span>
        <input
          inputMode="decimal"
          type="text"
          required
          disabled={saving || !!pending}
          value={amount}
          onChange={e => { setAmount(e.target.value); setError(""); }}
          onBlur={e => setAmount(formatCurrencyInput(e.target.value))}
        />
        {liveConvertedText && <span className={styles.livePreview} aria-live="polite">{liveConvertedText}</span>}
      </label>

      <div className={styles.submitCol}>
        <span className={styles.labelPlaceholder} aria-hidden="true">&nbsp;</span>
        <button type="submit" disabled={!usable || !hasRates || loading || saving || !!pending}>{t.calculate}</button>
      </div>

      {pending && (
        <div className={styles.retryCol}>
          <span className={styles.labelPlaceholder} aria-hidden="true">&nbsp;</span>
          <button type="button" disabled={saving} onClick={() => void save(pending)}>{t.retry}</button>
        </div>
      )}
    </form>

    {hasRates ? (
      <div className={styles.rate}>
        <b>
          {fromCurrency === toCurrency
            ? `1 ${fromCurrency} = 1 ${toCurrency}`
            : toCurrency === "VND"
            ? `1 ${fromCurrency} = ${rateText(fromInfo.rate)}`
            : fromCurrency === "VND"
            ? `1 VND ≈ ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(1 / toInfo.rate)} ${toCurrency} · (1 ${toCurrency} = ${rateText(toInfo.rate)})`
            : `1 ${fromCurrency} ≈ ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(crossRate)} ${toCurrency} · (1 ${fromCurrency} = ${rateText(fromInfo.rate)} · 1 ${toCurrency} = ${rateText(toInfo.rate)})`}
        </b>
        <span>{t.source}: <a href="https://frankfurter.dev/" target="_blank" rel="noreferrer">Frankfurter</a></span>
        {primaryRef && <span>{t.date}: {date(primaryRef.date)}</span>}
        {primaryRef && <span>{t.fetched}: {date(primaryRef.fetchedAt, true)}</span>}
      </div>
    ) : !loading && <p className={styles.warning}>{t.unavailable}</p>}

    {isStale && <p className={styles.warning}>{t.stale}</p>}
    {isCached && <p className={styles.warning}>{t.cached}</p>}
    <p className={styles.note}>{t.note}</p>

    {!!document?.estimates.length && (
      <details className={styles.history}>
        <summary>{t.history} ({document.estimates.length})</summary>
        <div>
          {document.estimates.slice(0, count).map(estimate => {
            const meta = metaMap[estimate.id];
            const fromDisplay = meta ? `${money(meta.sourceAmount, meta.sourceCurrency)}` : money(estimate.amount, estimate.reference.base);
            const toDisplay = meta ? money(meta.targetAmount, meta.targetCurrency) : money(estimate.convertedVnd, "VND");
            return (
              <button type="button" key={estimate.id} onClick={() => setSelected(estimate)}>
                <span>{fromDisplay} → <b>{toDisplay}</b></span>
                <small>{date(estimate.createdAt, true)}</small>
              </button>
            );
          })}
        </div>
        {count < document.estimates.length && <button type="button" onClick={() => setCount(c => c + 5)}>{t.more}</button>}
        {count > 5 && <button type="button" onClick={() => setCount(5)}>{t.collapse}</button>}
      </details>
    )}

    <details className={styles.scope}><summary>{t.scope}</summary><p>{t.settings}</p></details>

    {selected && (() => {
      const meta = metaMap[selected.id];
      const fromDisplay = meta ? `${money(meta.sourceAmount, meta.sourceCurrency)}` : money(selected.amount, selected.reference.base);
      const toDisplay = meta ? money(meta.targetAmount, meta.targetCurrency) : money(selected.convertedVnd, "VND");
      return (
        <Modal title={t.details} closeLabel={t.close} onClose={() => setSelected(null)}>
          <div className={styles.detail}>
            <p>{t.saved}</p>
            <h3>{fromDisplay} → {toDisplay}</h3>
            <dl>
              <div>
                <dt>{t.result}</dt>
                <dd>
                  {toDisplay}
                  {meta && meta.targetCurrency !== "VND" ? ` (≈ ${money(selected.convertedVnd, "VND")})` : ""}
                </dd>
              </div>
              <div>
                <dt>{t.rate}</dt>
                <dd>1 {selected.reference.base} = {rateText(selected.reference.rate)}</dd>
              </div>
              <div><dt>{t.source}</dt><dd>{selected.reference.source}</dd></div>
              <div><dt>{t.date}</dt><dd>{date(selected.reference.date)}</dd></div>
              <div><dt>{t.fetched}</dt><dd>{date(selected.reference.fetchedAt, true)}</dd></div>
            </dl>
            <p>{t.note}</p>
            <p>{t.snapshot}</p>
            <small>{selected.id}</small>
          </div>
        </Modal>
      );
    })()}
  </section>;
}
