"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from "lucide-react";
import { Mascot } from "page-mascot";
import { SETUP_COPY } from "@/lib/setup-copy";
import { onboardingSchema, onboardingDraftSchema, OCCUPATIONS, SETUP_CURRENCIES, isStarterWorkspace, type OnboardingData, type OnboardingRecord } from "@/lib/onboarding";
import { authLanguage } from "@/lib/auth-copy";
import { rememberPreferredLanguage } from "@/lib/language-preference";
import { LanguageSelector } from "@/components/sites/rolly/LanguageSelector";
import type { AppState } from "@/components/sites/rolly/replica/store";
import theme from "@/components/sites/rolly/WelcomeScreen.module.css";
import styles from "./OnboardingWizard.module.css";

export function OnboardingWizard({ userId, name, state, onComplete }: { userId: string; name: string; state: AppState; onComplete: (record: OnboardingRecord) => void }) {
  const initialLanguage = authLanguage(/中文|zh/.test(String(state.settings.language)) ? "zh" : /Việt|vi/.test(String(state.settings.language)) ? "vi" : "en");
  const key = "finbridge-setup-draft:" + encodeURIComponent(userId);
  const [data, setData] = useState<OnboardingData>(() => {
    try { const draft = onboardingDraftSchema.safeParse(JSON.parse(localStorage.getItem(key) || "null")); if (draft.success) return draft.data; } catch { /* Malformed drafts cannot become setup data. */ }
    return { version: 1, displayName: String(state.settings.name || name) === "." ? name : String(state.settings.name || name), occupation: "not_specified", language: initialLanguage,
      wallets: isStarterWorkspace(state) || !state.wallets.some(w => !w.archived) ? [{ id: crypto.randomUUID(), name: "", currency: initialLanguage === "vi" ? "VND" : initialLanguage === "zh" ? "CNY" : "USD", initial: 0 }] : state.wallets.filter(w => !w.archived).map(w => ({ id: w.id, name: w.name, currency: w.currency, initial: w.initial })),
      expenseCategories: [], incomeCategories: [], commitments: [], reserves: [] };
  });
  const lang = data.language, t = SETUP_COPY[lang];
  const [step, setStep] = useState(0), [walletIndex, setWalletIndex] = useState(0), [custom, setCustom] = useState("");
  const [hasFixed, setHasFixed] = useState(data.commitments.length > 0), [error, setError] = useState("");
  const [saving, setSaving] = useState(false); const inFlight = useRef(false);
  const [bill, setBill] = useState({ title: "", amount: "", walletId: data.wallets[0]?.id || "", category: "", dueDate: "", intervalMonths: 1, monthPosition: "date" as "start" | "end" | "date", reminderDays: 3 });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* Setup remains editable if browser storage is full. */ } }, [data, key]);
  const wallet = data.wallets[walletIndex];
  const updateWallet = (patch: Partial<OnboardingData["wallets"][number]>) => setData(d => ({ ...d, wallets: d.wallets.map((w, i) => i === walletIndex ? { ...w, ...patch } : w) }));
  const setReserve = (walletId: string, value: number) => setData(d => ({ ...d, reserves: [...d.reserves.filter(r => r.walletId !== walletId), { walletId, amount: value }] }));
  const toggle = (field: "expenseCategories" | "incomeCategories", value: string) => setData(d => ({ ...d, [field]: d[field].includes(value) ? d[field].filter(c => c !== value) : [...d[field], value] }));
  function addCategory() {
    const value = custom.trim(), all = [...data.expenseCategories, ...data.incomeCategories];
    if (!value || all.some(c => c.normalize("NFKC").toLocaleLowerCase() === value.normalize("NFKC").toLocaleLowerCase())) { setError(t.invalid); return; }
    toggle(step === 3 ? "expenseCategories" : "incomeCategories", value); setCustom(""); setError("");
  }
  function addBill() {
    let dueDate = bill.dueDate;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dueDate) && bill.monthPosition !== "date") {
      const [year, month] = dueDate.split("-").map(Number);
      dueDate = `${year}-${String(month).padStart(2, "0")}-${String(bill.monthPosition === "start" ? 1 : new Date(year, month, 0).getDate()).padStart(2, "0")}`;
    }
    const commitment = { ...bill, id: crypto.randomUUID(), amount: Number(bill.amount), title: bill.title.trim(), dueDate };
    const check = onboardingSchema.shape.commitments.safeParse([...data.commitments, commitment]);
    if (!check.success || !data.expenseCategories.includes(commitment.category) || !data.wallets.some(w => w.id === commitment.walletId)) { setError(t.invalid); return; }
    setData(d => ({ ...d, commitments: [...d.commitments, commitment] })); setBill(b => ({ ...b, title: "", amount: "" })); setError("");
  }
  async function next(event: FormEvent) {
    event.preventDefault(); if (inFlight.current) return; setError("");
    if ((step === 0 && !data.displayName.trim()) || (step === 2 && (!onboardingSchema.shape.wallets.safeParse(data.wallets).success || new Set(data.wallets.map(w => w.name.trim().toLocaleLowerCase())).size !== data.wallets.length))
      || (step === 3 && !data.expenseCategories.length) || (step === 4 && !data.incomeCategories.length)
      || (step === 5 && hasFixed && (!data.commitments.length || bill.title.trim() || bill.amount))) { setError(t.invalid); return; }
    if (step < 6) { setCustom(""); setStep(step + 1); return; }
    const payload = { ...data, commitments: hasFixed ? data.commitments : [], reserves: data.wallets.map(w => ({ walletId: w.id, amount: data.reserves.find(r => r.walletId === w.id)?.amount ?? 0 })) };
    const parsed = onboardingSchema.safeParse(payload);
    if (!parsed.success) { setError(t.invalid); return; }
    inFlight.current = true; setSaving(true);
    try {
      const response = await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data), signal: AbortSignal.timeout(15000) });
      const result = await response.json();
      if (!response.ok || !result.profile || !onboardingSchema.safeParse(result.profile.data).success) throw new Error("SETUP_UNAVAILABLE");
      onComplete(result.profile); localStorage.removeItem(key);
    } catch { setError(t.unavailable); } finally { inFlight.current = false; setSaving(false); }
  }
  const field = step === 3 ? "expenseCategories" : "incomeCategories";
  return <main lang={lang} className={`${theme.welcome} ${styles.page}`}>
    <div className={styles.shell}>
      <header className={styles.header}><b><span className={theme.fin}>Fin</span><span className={theme.bridge}>Bridge</span></b><LanguageSelector value={lang} onChange={l => { rememberPreferredLanguage(l); setData(d => ({ ...d, language: l })); }} /><span>{step + 1} / 7</span></header>
      <progress value={step + 1} max={7} aria-label={t.title} className={styles.progress} />
      <div className={styles.intro}><Mascot directions="/mascots/lac-directions.webp" reactions="/mascots/lac-reactions.webp" size={96} label="Jake, FinBridge" /><div><p>{t.title}</p><h1>{t.steps[step]}</h1><small>{t.subtitle}</small></div></div>
      <form onSubmit={next} className={styles.card}>
        {step === 0 && <label>{t.name}<input required maxLength={80} autoComplete="given-name" value={data.displayName} onChange={e => setData(d => ({ ...d, displayName: e.target.value }))} /></label>}
        {step === 1 && <fieldset><legend>{t.occupation}</legend><div className={styles.options}>{OCCUPATIONS.map((job, i) => <button key={job} type="button" aria-pressed={data.occupation === job} onClick={() => setData(d => ({ ...d, occupation: job }))}>{t.jobs[i] || (lang === "vi" ? "Chưa muốn trả lời" : lang === "zh" ? "暂不提供" : "Prefer not to say")}{data.occupation === job && <Check size={16} />}</button>)}</div></fieldset>}
        {step === 2 && wallet && <><p>{t.walletHint}</p>{!isStarterWorkspace(state) && <p className={styles.hint}>{t.existing}</p>}<label>{t.wallet} {walletIndex + 1}<input maxLength={80} required value={wallet.name} onChange={e => updateWallet({ name: e.target.value })} placeholder="Techcombank, Momo, Alipay…" /></label><div className={styles.row}><label>{t.balance}<input type="number" min={-1e12} max={1e12} step="0.01" required value={wallet.initial} onChange={e => updateWallet({ initial: e.target.valueAsNumber })} /></label><label>{t.currency}<select disabled={state.transactions.some(t => t.wallet === wallet.id || t.targetWallet === wallet.id)} value={wallet.currency} onChange={e => updateWallet({ currency: e.target.value as typeof wallet.currency })}>{Array.from(new Set([...SETUP_CURRENCIES, wallet.currency])).map(c => <option key={c}>{c}</option>)}</select></label></div><div className={styles.row}><button type="button" disabled={walletIndex === 0} onClick={() => setWalletIndex(i => i - 1)}>{t.previousWallet}</button><button type="button" disabled={walletIndex === data.wallets.length - 1} onClick={() => setWalletIndex(i => i + 1)}>{t.nextWallet}</button></div><button type="button" className={styles.outline} disabled={!wallet.name.trim() || data.wallets.length >= 30} onClick={() => { setData(d => ({ ...d, wallets: [...d.wallets, { id: crypto.randomUUID(), name: "", currency: wallet.currency, initial: 0 }] })); setWalletIndex(data.wallets.length); }}><Plus size={16} />{t.addWallet}</button>{data.wallets.length > 1 && !state.wallets.some(w => w.id === wallet.id) && <button type="button" onClick={() => { setData(d => ({ ...d, wallets: d.wallets.filter(w => w.id !== wallet.id), reserves: d.reserves.filter(r => r.walletId !== wallet.id), commitments: d.commitments.filter(c => c.walletId !== wallet.id) })); setWalletIndex(0); }}><Trash2 size={14} />{t.remove}</button>}</>}
        {(step === 3 || step === 4) && <><div className={styles.options}>{Array.from(new Set([...(step === 3 ? t.expense : t.income), ...data[field]])).map(c => <button key={c} type="button" aria-pressed={data[field].includes(c)} onClick={() => toggle(field, c)}>{c}{data[field].includes(c) && <Check size={16} />}</button>)}</div><div className={styles.row}><label>{t.custom}<input maxLength={80} value={custom} onChange={e => setCustom(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }} /></label><button type="button" className={styles.outline} onClick={addCategory}>{t.addCategory}</button></div></>}
        {step === 5 && <><fieldset><legend>{t.fixed}</legend><div className={styles.options}><button type="button" aria-pressed={!hasFixed} onClick={() => setHasFixed(false)}>{t.no}</button><button type="button" aria-pressed={hasFixed} onClick={() => setHasFixed(true)}>{t.yes}</button></div></fieldset>{hasFixed && <><label>{t.titleLabel}<input maxLength={80} value={bill.title} onChange={e => setBill(b => ({ ...b, title: e.target.value }))} /></label><div className={styles.row}><label>{t.source}<select value={bill.walletId} onChange={e => setBill(b => ({ ...b, walletId: e.target.value, amount: "" }))}>{data.wallets.map(w => <option value={w.id} key={w.id}>{w.name} · {w.currency}</option>)}</select></label><label>{t.amount}<input type="number" min="0.01" max={1e12} step="0.01" value={bill.amount} onChange={e => setBill(b => ({ ...b, amount: e.target.value }))} /></label></div><label>{t.category}<select value={bill.category} onChange={e => setBill(b => ({ ...b, category: e.target.value }))}><option value="">—</option>{data.expenseCategories.map(c => <option key={c}>{c}</option>)}</select></label><div className={styles.row}><label>{t.interval}<select value={bill.intervalMonths} onChange={e => setBill(b => ({ ...b, intervalMonths: Number(e.target.value) }))}>{[1, 2, 3, 6, 12].map(n => <option key={n} value={n}>{n}</option>)}</select></label><label>{t.reminder}<select value={bill.reminderDays} onChange={e => setBill(b => ({ ...b, reminderDays: Number(e.target.value) }))}>{[0, 1, 3, 5, 7].map(n => <option key={n} value={n}>{n}</option>)}</select></label></div><div className={styles.row}><label>{t.monthPosition}<select value={bill.monthPosition} onChange={e => setBill(b => ({ ...b, monthPosition: e.target.value as typeof b.monthPosition }))}>{["start", "end", "date"].map((p, i) => <option key={p} value={p}>{t.positions[i]}</option>)}</select></label><label>{t.due}<input type="date" value={bill.dueDate} onChange={e => setBill(b => ({ ...b, dueDate: e.target.value }))} /></label></div><button type="button" className={styles.outline} onClick={addBill}><Plus size={16} />{t.addFixed}</button><ul className={styles.bills}>{data.commitments.map(c => <li key={c.id}><span><b>{c.title}</b><small>{c.amount.toLocaleString()} {data.wallets.find(w => w.id === c.walletId)?.currency} · {c.dueDate} · {c.intervalMonths} {t.interval}</small></span><button type="button" aria-label={`${t.remove} ${c.title}`} onClick={() => setData(d => ({ ...d, commitments: d.commitments.filter(item => item.id !== c.id) }))}><Trash2 size={16} /></button></li>)}</ul><p className={styles.hint}>{t.planned}</p></>}</>}
        {step === 6 && <><p>{t.reserveHint}</p>{data.wallets.map(w => <label key={w.id}>{t.reserve} · {w.name} ({w.currency})<input type="number" min={0} max={1e12} step="0.01" value={data.reserves.find(r => r.walletId === w.id)?.amount ?? 0} onChange={e => setReserve(w.id, e.target.valueAsNumber)} /></label>)}<small>{t.zero}</small></>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <footer className={styles.footer}><button type="button" disabled={step === 0 || saving} onClick={() => { setError(""); setStep(s => s - 1); }}><ArrowLeft size={16} />{t.back}</button><button type="submit" className={theme.start} disabled={saving}>{saving ? t.saving : step === 6 ? t.finish : t.next}<ArrowRight size={16} /></button></footer>
      </form>
    </div>
  </main>;
}
