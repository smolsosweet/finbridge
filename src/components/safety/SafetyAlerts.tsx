"use client";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Bell, Check, ChevronRight, CircleHelp, Clock3, Mail, Plus, RefreshCw, Search, ShieldCheck, Wallet } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { FinBridgeHeader } from "@/components/sites/rolly/replica/FinBridgeHeader";
import { setSetting, useAppState } from "@/components/sites/rolly/replica/store";
import { evaluateSafety, safetyLanguage, safetyRuleSchema, safetySnapshot, type SafetyEvaluation, type SafetyRule } from "@/lib/safety-model";
import { useSafety } from "./SafetyProvider";
import { SAFETY_COPY } from "./safety-copy";
import styles from "./SafetyAlerts.module.css";

export function SafetyAlerts({ navigate }: { navigate: (screen: string) => void }) {
  const state = useAppState(), lang = safetyLanguage(state.settings.language), t = SAFETY_COPY[lang];
  const safety = useSafety(), params = useSearchParams();
  const [view, setView] = useState(["preferences", "history"].includes(params.get("view") || "") ? params.get("view")! : "rules"), [query, setQuery] = useState(""), [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState<SafetyRule | null>(null), [step, setStep] = useState(0), [formError, setFormError] = useState("");
  const [consent, setConsent] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null), fieldId = useId();
  const snapshot = useMemo(() => { try { return safetySnapshot(state); } catch { return null; } }, [state]);
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setClock(new Date()), 60000); return () => clearInterval(timer); }, []);
  useEffect(() => { heading.current?.focus(); }, [step, draft?.id]);
  if (!safety) return null;
  const { doc, loading, busy, source } = safety;
  const rules = doc.rules, currentRule = draft && rules.find(r => r.id === draft.id);
  const active = rules.filter(r => r.active), unread = doc.events.filter(e => !e.read).length;
  const stale = !!doc.syncedAt && clock.getTime() - Date.parse(doc.syncedAt) > 86400000;
  const wallets = snapshot?.wallets.filter(w => !w.archived) || [];
  const budgets = snapshot?.budgets.filter(b => wallets.some(w => w.id === b.wallet && w.currency === b.currency)) || [];
  const target = draft?.kind === "budget" ? budgets.find(b => b.id === draft.targetId) : wallets.find(w => w.id === draft?.targetId);
  const preview = draft && snapshot ? evaluateSafety(draft, snapshot, clock) : null;
  const amount = (n: number | null, currency: string) => n === null || !currency ? "—" : new Intl.NumberFormat(lang, { style: "currency", currency }).format(n);
  const timestamp = (date: string | null) => date ? new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" }).format(new Date(date)) : "—";
  const status = (r: SafetyRule, e?: SafetyEvaluation) => !r.active ? "paused" : stale ? "unavailable" : e?.state || "unavailable";
  const message = (code: string) => code === "RATE_LIMITED" ? (lang === "vi" ? "Bạn cập nhật quá nhanh. Vui lòng đợi một phút rồi thử lại." : lang === "zh" ? "更新过于频繁，请等待一分钟后重试。" : "Too many updates. Please wait a minute and try again.") : t.errors[code as keyof typeof t.errors] || t.errors.UNAVAILABLE;
  const error = formError || safety.error;
  function create(kind: SafetyRule["kind"] = "budget") {
    setStep(0); setFormError(""); setDraft({ id: crypto.randomUUID(), name: "", kind, targetId: "", basis: "actual", unit: kind === "budget" ? "percent" : "amount", threshold: kind === "budget" ? 80 : 1, email: false, active: true });
  }
  function selectTarget(id: string) {
    const item = draft!.kind === "budget" ? budgets.find(b => b.id === id) : wallets.find(w => w.id === id);
    let threshold = draft!.threshold;
    if (draft!.kind === "reserve") { try { threshold = Number(JSON.parse(String(state.settings.reserveByWallet || "{}"))[id]) || 1; } catch { /* Start with a valid positive floor. */ } }
    setDraft({ ...draft!, targetId: id, name: (item && ("title" in item ? item.title : item.name)) || "", threshold });
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!draft || busy) return;
    if ((step === 0 && (!target || !draft.name.trim())) || (step === 1 && !safetyRuleSchema.safeParse(draft).success)) { setFormError("INVALID_COMMAND"); return; }
    setFormError("");
    if (step < 3) { setStep(s => s + 1); return; }
    try { await safety!.mutate({ action: "save", rule: safetyRuleSchema.parse(draft) }); setDraft(null); setView("rules"); }
    catch (e) { setFormError(e instanceof Error ? e.message : "UNAVAILABLE"); }
  }
  const change = async (rule: SafetyRule) => { try { await safety.mutate({ action: "save", rule: { ...rule, active: !rule.active } }); } catch { /* Provider renders the retryable failure. */ } };
  const visible = rules.filter(r => r.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()) && (filter === "all" || status(r, doc.evaluated[r.id]) === filter));
  const metrics = (e: SafetyEvaluation) => <dl className={styles.metrics}><div><dt>{t.value}</dt><dd>{amount(e.value, e.currency)}</dd></div><div><dt>{t.limit}</dt><dd>{amount(e.limit, e.currency)}</dd></div>{e.remainingDays > 0 && <div><dt>{t.daily}</dt><dd>{amount(e.dailyAllowance, e.currency)}</dd></div>}</dl>;
  return <main className={`r-dashboard fb-home ${styles.page}`} lang={lang}>
    <FinBridgeHeader lang={lang} theme={String(state.settings.theme)} currentLanguage={String(state.settings.language)} onSelectLanguage={value => setSetting("language", value)} onToggleTheme={() => setSetting("theme", state.settings.theme === "dark" ? "light" : "dark")} />
    <nav className={styles.breadcrumb} aria-label={t.planning}><button onClick={() => navigate("?tab=tools")}>{t.planning}</button><ChevronRight size={14} /><span>{t.title}</span></nav>
    <div className={styles.titleRow}><div><p className="fb-eyebrow">FINBRIDGE</p><h1>{t.title}</h1><p>{t.subtitle}</p></div>{!draft && <button className={styles.primary} disabled={loading || busy} onClick={() => create()}><Plus size={17} />{t.create}</button>}</div>
    {error && <div className={styles.error} role="alert"><span>{message(error)}</span><button onClick={() => { setFormError(""); void safety.refresh().catch(() => setFormError("UNAVAILABLE")); }}>{t.retry}</button></div>}
    {loading ? <p role="status">{t.loading}</p> : <>
      <section className={`${styles.source} ${source && !stale ? styles.connected : ""}`}>
        <ShieldCheck size={21} /><div><b>{source ? t.sourceActive : doc.sourceId ? t.sourceOther : t.sourceTitle}</b><p>{doc.syncedAt ? `${t.synced}: ${timestamp(doc.syncedAt)} · ${doc.timeZone}` : t.localOnly}</p>{stale && <p className={styles.warning}>{t.stale}</p>}</div>
        <button className={styles.secondary} disabled={busy || !snapshot} onClick={() => setConsent(!consent)}>{source ? <RefreshCw size={15} /> : <ArrowRight size={15} />}{t.sourceAction}</button>
      </section>
      {consent && <section className={styles.consent} aria-label={t.sourceConfirm}><h2>{t.sourceConfirm}</h2><p>{t.sourceHint}</p><p>{t.sourceConfirmHint}</p><div className={styles.actions}><button className={styles.secondary} onClick={() => setConsent(false)}>{t.cancel}</button><button className={styles.primary} disabled={busy} onClick={async () => { try { await safety.connect(); setConsent(false); } catch (e) { setFormError(e instanceof Error ? e.message : "UNAVAILABLE"); } }}>{t.sourceAction}</button></div></section>}
      {draft ? <div className={styles.wizard}>
        <ol className={styles.steps}>{t.steps.map((label, i) => <li key={label} aria-current={i === step ? "step" : undefined} className={i === step ? styles.currentStep : i < step ? styles.doneStep : ""}><span>{i < step ? <Check size={16} /> : i + 1}</span><div><small>{i + 1} / 4</small><b>{label}</b></div></li>)}</ol>
        <form className={styles.panel} onSubmit={submit}>
          <h2 ref={heading} tabIndex={-1}>{[t.scopeTitle, t.thresholdTitle, t.notificationsTitle, t.reviewTitle][step]}</h2>
          {step === 0 && <><p>{t.scopeHint}</p><div className={styles.choices}>{(["budget", "reserve"] as const).map(kind => <button type="button" key={kind} aria-pressed={draft.kind === kind} onClick={() => setDraft({ ...draft, kind, targetId: "", basis: "actual", unit: kind === "budget" ? "percent" : "amount", threshold: kind === "budget" ? 80 : 1 })}><span>{kind === "budget" ? <Bell size={21} /> : <Wallet size={21} />}</span><b>{t[kind]}</b><small>{kind === "budget" ? t.budgetHint : t.reserveHint}</small></button>)}</div>
            <label htmlFor={fieldId + "target"}>{t.target}<select id={fieldId + "target"} value={draft.targetId} onChange={e => selectTarget(e.target.value)} required><option value="">{t.choose}</option>{draft.kind === "budget" ? budgets.map(b => <option key={b.id} value={b.id}>{b.title} · {amount(b.amount, b.currency)}</option>) : wallets.map(w => <option key={w.id} value={w.id}>{w.name} · {w.currency}</option>)}</select></label>
            {draft.kind === "budget" && !budgets.length && <div className={styles.notice}><p>{t.noBudget}</p><button type="button" onClick={() => navigate("createBudget")}>{t.createBudget}<ArrowRight size={14} /></button></div>}
            {draft.kind === "reserve" && !wallets.length && <p>{t.noWallet}</p>}
            <label htmlFor={fieldId + "name"}>{t.name}<input id={fieldId + "name"} required maxLength={100} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
            {draft.kind === "budget" && target && "amount" in target && <div className={styles.notice}><b>{amount(target.amount, target.currency)}</b><p>{target.category || t.allCategories}</p><p>{t.inherited}</p></div>}</>}
          {step === 1 && <>{draft.kind === "budget" && <div className={styles.segment}>{(["actual", "forecast"] as const).map(basis => <button type="button" key={basis} aria-pressed={draft.basis === basis} onClick={() => setDraft({ ...draft, basis })}>{t[basis]}</button>)}</div>}<p>{draft.kind === "reserve" ? t.reserveBasis : draft.basis === "forecast" ? t.forecastHint : t.actualHint}</p>
            <div className={styles.fields}><label htmlFor={fieldId + "threshold"}>{t.threshold}<input id={fieldId + "threshold"} required type="number" min="0.001" step="any" max={draft.unit === "percent" ? 1000 : 1e12} value={draft.threshold || ""} onChange={e => setDraft({ ...draft, threshold: e.target.valueAsNumber })} /></label><label htmlFor={fieldId + "unit"}>{lang === "vi" ? "Đơn vị ngưỡng" : lang === "zh" ? "阈值单位" : "Threshold unit"}<select id={fieldId + "unit"} value={draft.unit} disabled={draft.kind === "reserve"} onChange={e => setDraft({ ...draft, unit: e.target.value as SafetyRule["unit"] })}><option value="amount">{t.amount} · {target?.currency}</option>{draft.kind === "budget" && <option value="percent">{t.percent}</option>}</select></label></div>
            {draft.unit === "percent" && <div className={styles.presets}>{[50, 80, 100].map(n => <button type="button" key={n} aria-pressed={draft.threshold === n} onClick={() => setDraft({ ...draft, threshold: n })}>{n}%</button>)}</div>}
            {preview && <section className={styles.preview}><h3>{t.preview}</h3>{metrics(preview)}{preview.state === "unavailable" ? <p><CircleHelp size={14} />{t.reason}</p> : <><div className={styles.track}><span className={preview.state === "alarm" ? styles.exceeded : ""} style={{ width: `${Math.max(0, Math.min(100, (preview.value || 0) / Math.max(preview.limit, 1) * 80))}%` }} /><i /></div><b className={preview.state === "alarm" ? styles.warning : ""}>{t[preview.state]}</b></>}{draft.basis === "forecast" && <small>{t.forecastLimit}</small>}</section>}</>}
          {step === 2 && <><div className={styles.channel}><Bell size={22} /><div><b>{t.inApp}</b><p>{t.inAppHint}</p></div><Check size={20} /></div><label className={styles.channel}><Mail size={22} /><span><b>{t.email}</b><small>{t.emailHint}</small></span><input type="checkbox" checked={draft.email} disabled={!doc.emailAvailable} onChange={e => setDraft({ ...draft, email: e.target.checked })} /></label>{!doc.emailAvailable && <p className={styles.notice}>{t.emailUnavailable}</p>}<p className={styles.notice}><Clock3 size={16} />{t.frequency}</p></>}
          {step === 3 && <><p>{t.reviewHint}</p><dl className={styles.review}><div><dt>{t.name}</dt><dd>{draft.name}</dd></div><div><dt>{t.target}</dt><dd>{target && ("title" in target ? target.title : target.name)} · {target?.currency}</dd></div><div><dt>{t.threshold}</dt><dd>{draft.kind === "reserve" ? t.conditionReserve : t.conditionBudget} <b>{preview && amount(preview.limit, preview.currency)}</b> {draft.unit === "percent" && `(${draft.threshold}%)`} · {t[draft.basis]}</dd></div>{draft.kind === "budget" && preview && <div><dt>{t.period}</dt><dd>{preview.start} — {preview.end}<small>{doc.timeZone || snapshot?.timeZone}</small></dd></div>}<div><dt>{t.preferences}</dt><dd>{t.inApp}{draft.email ? ` + ${t.email}` : ""}</dd></div></dl>{preview && metrics(preview)}<p className={styles.notice}>{draft.basis === "forecast" ? t.forecastHint : t.frequency}</p>{!doc.sourceId && <p className={styles.warning}>{t.localOnly}</p>}</>}
          <footer className={styles.wizardFooter}><button type="button" className={styles.secondary} disabled={busy} onClick={() => { if (step) { setStep(s => s - 1); setFormError(""); } else setDraft(null); }}><ArrowLeft size={15} />{step ? t.back : t.cancel}</button><button className={styles.primary} type="submit" disabled={busy || (step === 3 && (!source || (!currentRule && rules.length >= 50))) || (step === 0 && !target)}>{busy ? t.saving : step === 3 ? currentRule ? t.update : t.save : t.next}<ArrowRight size={15} /></button></footer>
        </form>
      </div> : <>
        <div className={styles.summary}>{[[t.total, active.length, <ShieldCheck size={20} key="total" />], [t.attention, active.filter(r => status(r, doc.evaluated[r.id]) === "alarm").length, <Bell size={20} key="attention" />], [t.unread, unread, <Mail size={20} key="unread" />]].map(([label, n, icon]) => <div key={String(label)}>{icon}<span>{label}<b>{n}</b></span></div>)}</div>
        <div className={styles.tabs} role="tablist">{(["rules", "history", "preferences"] as const).map(v => <button role="tab" type="button" key={v} aria-selected={view === v} onClick={() => setView(v)}>{t[v]}{v === "history" && unread > 0 && <span>{unread}</span>}</button>)}</div>
        {view === "rules" && <><div className={styles.filters}><label><Search size={17} /><input aria-label={t.search} placeholder={t.search} value={query} onChange={e => setQuery(e.target.value)} /></label><select aria-label={t.all} value={filter} onChange={e => setFilter(e.target.value)}>{["all", "ok", "alarm", "paused", "unavailable"].map(v => <option key={v} value={v}>{t[v as keyof typeof t] as string}</option>)}</select></div>
          {!rules.length ? <div className={styles.empty}><ShieldCheck size={42} /><h2>{t.empty}</h2><p>{t.emptyHint}</p><button className={styles.primary} onClick={() => create()}><Plus size={17} />{t.create}</button></div> : !visible.length ? <div className={styles.empty}><p>{t.noResults}</p><button onClick={() => { setQuery(""); setFilter("all"); }}>{t.clear}</button></div> : <div className={styles.ruleList}>{visible.map(rule => {
            const e = doc.evaluated[rule.id], s = status(rule, e);
            return <article key={rule.id} className={styles.rule}><div className={styles.ruleHeading}><span className={styles.ruleIcon}>{rule.kind === "reserve" ? <Wallet size={21} /> : <Bell size={21} />}</span><div><h2>{rule.name}</h2><p>{t[rule.kind]} · {t[rule.basis]} · {e?.currency}</p></div><span className={`${styles.badge} ${styles[s]}`}>{t[s]}</span></div>{e && <>{metrics(e)}{rule.kind === "budget" && <div className={styles.track}><span className={s === "alarm" ? styles.exceeded : ""} style={{ width: `${Math.max(0, Math.min(100, (e.value || 0) / Math.max(e.limit, 1) * 80))}%` }} /><i /></div>}<p className={styles.muted}>{rule.kind === "budget" ? `${e.start} — ${e.end}` : t.reserveBasis}</p></>}
              <footer><span><Bell size={14} />{t.inApp}{rule.email && <><Mail size={14} />{t.email}</>}</span><div><button disabled={busy} onClick={() => { setDraft({ ...rule }); setStep(0); setFormError(""); }}>{t.edit}</button><button disabled={busy} onClick={() => void change(rule)}>{rule.active ? t.pause : t.resume}</button></div></footer></article>;
          })}</div>}</>}
        {view === "history" && <section className={styles.history}><div className={styles.historyHeader}><p>{t.historyNote}</p><button disabled={busy || !unread} onClick={() => void safety.mutate({ action: "read" }).catch(() => {})}>{t.markRead}</button></div>{!doc.events.length ? <div className={styles.empty}><Bell size={36} /><h2>{t.emptyHistory}</h2></div> : doc.events.map(event => <article key={event.id} className={!event.read ? styles.unread : ""}><div><h2>{event.name}</h2><p>{timestamp(event.createdAt)}</p></div>{metrics(event.evaluation)}<span className={styles.badge}>{t[event.emailStatus]}</span></article>)}</section>}
        {view === "preferences" && <section className={styles.panel}><h2>{t.emailPrefs}</h2><p>{t.emailPrefsHint}</p><p className={styles.notice}>{doc.emailAvailable ? t.emailHint : t.emailUnavailable}</p><h3>{t.timezone}</h3><p>{doc.timeZone || snapshot?.timeZone}</p><p>{t.timeNote}</p><h3>{t.sourceTitle}</h3><p>{t.sourceHint}</p><p>{t.dataNote}</p><button className={styles.secondary} onClick={() => setView("rules")}>{t.rules}<ArrowRight size={15} /></button></section>}
      </>}
      <p className={styles.footnote}><CircleHelp size={15} />{t.dataNote}</p>
    </>}
  </main>;
}
