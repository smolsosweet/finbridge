"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, LogOut, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Mascot } from "page-mascot";
import { SETUP_COPY } from "@/lib/setup-copy";
import { onboardingSchema, onboardingDraftSchema, OCCUPATIONS, SETUP_CURRENCIES, isStarterWorkspace, type OnboardingData, type OnboardingRecord } from "@/lib/onboarding";
import { authLanguage } from "@/lib/auth-copy";
import { rememberPreferredLanguage } from "@/lib/language-preference";
import { signOutGoogle } from "@/lib/sign-out";
import { LanguageSelector } from "@/components/sites/rolly/LanguageSelector";
import type { AppState } from "@/components/sites/rolly/replica/store";
import { getWorkspaceState, updateState, workspacePersistence } from "@/components/sites/rolly/replica/store";
import theme from "@/components/sites/rolly/WelcomeScreen.module.css";
import styles from "./OnboardingWizard.module.css";

const EXIT_COPY = {
  en: { action: "Sign out", pending: "Signing out…", error: "Could not sign out. Please try again." },
  vi: { action: "Đăng xuất", pending: "Đang đăng xuất…", error: "Không thể đăng xuất. Vui lòng thử lại." },
  zh: { action: "退出登录", pending: "正在退出登录…", error: "无法退出登录，请重试。" },
} as const;

const FIXED_BALANCE_COPY = {
  en: { exceeds: "The total fixed expenses paid from this wallet cannot exceed its opening balance. Choose another wallet or lower the amount.", other: "Other", otherLabel: "Other expense category" },
  vi: { exceeds: "Tổng các khoản chi cố định từ tài khoản này không được vượt số dư ban đầu. Hãy chọn tài khoản khác hoặc giảm số tiền.", other: "Khác", otherLabel: "Danh mục chi khác" },
  zh: { exceeds: "从此钱包支付的固定支出总额不能超过期初余额。请选择其他钱包或降低金额。", other: "其他", otherLabel: "其他支出类别" },
} as const;

const FIXED_STEP_COPY = {
  en: { draft: "Continue saves this expense automatically. Use Add expense to enter another one.", title: "Enter an expense name (up to 80 characters).", amount: "Enter an amount greater than 0, with at most 2 decimal places.", category: "Choose an expense category or enter one under Other (up to 80 characters).", dueDate: "Choose a valid first due date.", conflict: "This name is already an income category. Choose an expense category name.", limit: "You can add up to 50 expenses and 50 expense categories." },
  vi: { draft: "Bấm Tiếp tục để tự lưu khoản này. Dùng Thêm khoản chi nếu muốn nhập thêm khoản khác.", title: "Nhập tên khoản chi, tối đa 80 ký tự.", amount: "Nhập số tiền lớn hơn 0, tối đa 2 chữ số thập phân.", category: "Chọn danh mục chi hoặc nhập ở mục Khác, tối đa 80 ký tự.", dueDate: "Chọn ngày đến hạn đầu tiên hợp lệ.", conflict: "Tên này đã là danh mục thu. Hãy chọn tên danh mục chi khác.", limit: "Bạn có thể thêm tối đa 50 khoản chi và 50 danh mục chi." },
  zh: { draft: "点击继续将自动保存此支出。要输入下一笔，请点击添加支出。", title: "请输入支出名称，最多80个字符。", amount: "请输入大于0且最多两位小数的金额。", category: "请选择支出类别，或在其他中输入，最多80个字符。", dueDate: "请选择有效的首次到期日期。", conflict: "此名称已用于收入类别，请选择其他支出类别名称。", limit: "最多可添加50笔支出和50个支出类别。" },
} as const;

const OTHER_CATEGORY = "__finbridge_other_expense_category__";
const categoryKey = (value: string) => value.trim().normalize("NFKC").toLowerCase();

export function OnboardingWizard({ userId, name, state, onComplete }: { userId: string; name: string; state: AppState; onComplete: (record: OnboardingRecord) => void }) {
  const router = useRouter();
  const initialLanguage = authLanguage(/中文|zh/.test(String(state.settings.language)) ? "zh" : /Việt|vi/.test(String(state.settings.language)) ? "vi" : "en");
  const key = "finbridge-setup-draft:" + encodeURIComponent(userId);
  const [data, setData] = useState<OnboardingData>(() => {
    try { const draft = onboardingDraftSchema.safeParse(workspacePersistence() === "database" ? getWorkspaceState().onboardingDraft : JSON.parse(localStorage.getItem(key) || "null")); if (draft.success) return draft.data; } catch { /* Malformed drafts cannot become setup data. */ }
    return { version: 1, displayName: String(state.settings.name || name) === "." ? name : String(state.settings.name || name), occupation: "not_specified", language: initialLanguage,
      wallets: isStarterWorkspace(state) || !state.wallets.some(w => !w.archived) ? [{ id: crypto.randomUUID(), name: "", currency: initialLanguage === "vi" ? "VND" : initialLanguage === "zh" ? "CNY" : "USD", initial: 0 }] : state.wallets.filter(w => !w.archived).map(w => ({ id: w.id, name: w.name, currency: w.currency, initial: w.initial })),
      expenseCategories: [], incomeCategories: [], commitments: [], reserves: [] };
  });
  const lang = data.language, t = SETUP_COPY[lang];
  const [step, setStep] = useState(0), [walletIndex, setWalletIndex] = useState(0), [custom, setCustom] = useState("");
  const [hasFixed, setHasFixed] = useState(data.commitments.length > 0), [error, setError] = useState("");
  const [saving, setSaving] = useState(false); const inFlight = useRef(false);
  const [exiting, setExiting] = useState(false), [exitError, setExitError] = useState("");
  const exitText = EXIT_COPY[lang];
  const [bill, setBill] = useState({ title: "", amount: "", walletId: data.wallets[0]?.id || "", category: "", dueDate: "", intervalMonths: 1, monthPosition: "date" as "start" | "end" | "date", reminderDays: 3 });
  const [customBillCategory, setCustomBillCategory] = useState("");
  const [billIssue, setBillIssue] = useState<{ field: string; message: string } | null>(null);
  useEffect(() => { if (workspacePersistence() === "database") updateState(s => ({ ...s, onboardingDraft: data })); else { try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* Demo setup remains editable. */ } } }, [data, key]);
  const wallet = data.wallets[walletIndex];
  const updateWallet = (patch: Partial<OnboardingData["wallets"][number]>) => setData(d => ({ ...d, wallets: d.wallets.map((w, i) => i === walletIndex ? { ...w, ...patch } : w) }));
  const setReserve = (walletId: string, value: number) => setData(d => ({ ...d, reserves: [...d.reserves.filter(r => r.walletId !== walletId), { walletId, amount: value }] }));
  const toggle = (field: "expenseCategories" | "incomeCategories", value: string) => setData(d => ({ ...d, [field]: d[field].includes(value) ? d[field].filter(c => c !== value) : [...d[field], value] }));
  function addCategory() {
    const value = custom.trim(), field = step === 3 ? "expenseCategories" : "incomeCategories";
    const otherField = step === 3 ? "incomeCategories" : "expenseCategories";
    if (!value || value.length > 80 || data[otherField].some(c => categoryKey(c) === categoryKey(value))) { setError(t.invalid); return; }
    if (!data[field].some(c => categoryKey(c) === categoryKey(value))) toggle(field, value);
    setCustom(""); setError("");
  }
  function addBill() {
    setBillIssue(null); setError("");
    let dueDate = bill.dueDate;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dueDate) && bill.monthPosition !== "date") {
      const [year, month] = dueDate.split("-").map(Number);
      dueDate = `${year}-${String(month).padStart(2, "0")}-${String(bill.monthPosition === "start" ? 1 : new Date(year, month, 0).getDate()).padStart(2, "0")}`;
    }
    const typedCategory = bill.category === OTHER_CATEGORY ? customBillCategory.trim() : bill.category;
    const normalizedCategory = categoryKey(typedCategory);
    const category = data.expenseCategories.find(item => categoryKey(item) === normalizedCategory) || typedCategory;
    const commitment = { ...bill, id: crypto.randomUUID(), amount: Number(bill.amount), title: bill.title.trim(), category, dueDate };
    const sourceWallet = data.wallets.find(wallet => wallet.id === commitment.walletId);
    const allocated = data.commitments.filter(item => item.walletId === commitment.walletId).reduce((total, item) => total + item.amount, 0);
    const check = onboardingSchema.shape.commitments.safeParse([...data.commitments, commitment]);
    if (!check.success) {
      const field = String(check.error.issues[0].path[1] || "limit");
      const message = FIXED_STEP_COPY[lang][field as "title" | "amount" | "category" | "dueDate"] || FIXED_STEP_COPY[lang].limit;
      setBillIssue({ field, message }); return false;
    }
    if (!sourceWallet || commitment.amount + allocated > sourceWallet.initial + 0.000001) { setBillIssue({ field: "amount", message: FIXED_BALANCE_COPY[lang].exceeds }); return false; }
    if (data.incomeCategories.some(item => categoryKey(item) === normalizedCategory)) { setBillIssue({ field: "category", message: FIXED_STEP_COPY[lang].conflict }); return false; }
    if (!data.expenseCategories.includes(category) && data.expenseCategories.length >= 50) { setBillIssue({ field: "category", message: FIXED_STEP_COPY[lang].limit }); return false; }
    setData(d => ({ ...d, expenseCategories: d.expenseCategories.includes(category) ? d.expenseCategories : [...d.expenseCategories, category], commitments: [...d.commitments, commitment] }));
    setBill(b => ({ ...b, title: "", amount: "", category: "", dueDate: "" })); setCustomBillCategory("");
    return true;
  }
  async function next(event: FormEvent) {
    event.preventDefault(); if (inFlight.current) return; setError("");
    if ((step === 0 && !data.displayName.trim()) || (step === 2 && (!onboardingSchema.shape.wallets.safeParse(data.wallets).success || new Set(data.wallets.map(w => w.name.trim().toLocaleLowerCase())).size !== data.wallets.length))
      || (step === 3 && !data.expenseCategories.length) || (step === 4 && !data.incomeCategories.length)) { setError(t.invalid); return; }
    if (step === 5 && hasFixed && (hasFixedDraft || !data.commitments.length) && !addBill()) return;
    if (step < 6) { setCustom(""); setStep(step + 1); return; }
    const payload = { ...data, commitments: hasFixed ? data.commitments : [], reserves: data.wallets.map(w => ({ walletId: w.id, amount: data.reserves.find(r => r.walletId === w.id)?.amount ?? 0 })) };
    const parsed = onboardingSchema.safeParse(payload);
    if (!parsed.success) { setError(t.invalid); return; }
    inFlight.current = true; setSaving(true);
    try {
      const response = await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data), signal: AbortSignal.timeout(15000) });
      const result = await response.json();
      if (!response.ok || !result.profile || !onboardingSchema.safeParse(result.profile.data).success) throw new Error("SETUP_UNAVAILABLE");
      onComplete(result.profile); if (workspacePersistence() !== "database") localStorage.removeItem(key);
    } catch { setError(t.unavailable); } finally { inFlight.current = false; setSaving(false); }
  }
  async function exitSetup() {
    if (saving || exiting) return;
    setExiting(true); setExitError("");
    try {
      await signOutGoogle();
      router.replace(`/?lang=${lang}`);
    } catch {
      setExitError(exitText.error);
      setExiting(false);
    }
  }
  const field = step === 3 ? "expenseCategories" : "incomeCategories";
  const selectedBillWallet = data.wallets.find(wallet => wallet.id === bill.walletId);
  const availableForFixed = selectedBillWallet ? Math.max(0, selectedBillWallet.initial - data.commitments.filter(item => item.walletId === selectedBillWallet.id).reduce((total, item) => total + item.amount, 0)) : 0;
  const enteredBillAmount = Number(bill.amount);
  const billAmountExceedsBalance = bill.amount !== "" && Number.isFinite(enteredBillAmount) && enteredBillAmount > availableForFixed + 0.000001;
  const hasFixedDraft = Boolean(bill.title.trim() || bill.amount || bill.category || customBillCategory.trim() || bill.dueDate);
  const billFieldError = (field: string) => billIssue?.field === field ? <span role="alert" className={styles.fieldError}>{billIssue.message}</span> : null;
  return <main lang={lang} className={`${theme.welcome} ${styles.page}`}>
    <div className={styles.shell}>
      <header className={styles.header}><b><span className={theme.fin}>Fin</span><span className={theme.bridge}>Bridge</span></b><div className={styles.headerControls}><LanguageSelector value={lang} onChange={l => { rememberPreferredLanguage(l); setData(d => ({ ...d, language: l })); }} /><button type="button" className={styles.exit} disabled={saving || exiting} onClick={exitSetup}><LogOut size={15} />{exiting ? exitText.pending : exitText.action}</button><span>{step + 1} / 7</span></div></header>
      <progress value={step + 1} max={7} aria-label={t.title} className={styles.progress} />
      {exitError && <p role="alert" className={styles.exitError}>{exitError}</p>}
      <div className={styles.intro}><Mascot directions="/mascots/lac-directions.webp" reactions="/mascots/lac-reactions.webp" size={96} label="Jake, FinBridge" /><div><p>{t.title}</p><h1>{t.steps[step]}</h1><small>{t.subtitle}</small></div></div>
      <form onSubmit={next} onChange={() => { setBillIssue(null); setError(""); }} className={styles.card}>
        {step === 0 && <label>{t.name}<input required maxLength={80} autoComplete="given-name" value={data.displayName} onChange={e => setData(d => ({ ...d, displayName: e.target.value }))} /></label>}
        {step === 1 && <fieldset><legend>{t.occupation}</legend><div className={styles.options}>{OCCUPATIONS.map((job, i) => <button key={job} type="button" aria-pressed={data.occupation === job} onClick={() => setData(d => ({ ...d, occupation: job }))}>{t.jobs[i] || (lang === "vi" ? "Chưa muốn trả lời" : lang === "zh" ? "暂不提供" : "Prefer not to say")}{data.occupation === job && <Check size={16} />}</button>)}</div></fieldset>}
        {step === 2 && wallet && <><p>{t.walletHint}</p>{!isStarterWorkspace(state) && <p className={styles.hint}>{t.existing}</p>}<label>{t.wallet} {walletIndex + 1}<input maxLength={80} required value={wallet.name} onChange={e => updateWallet({ name: e.target.value })} placeholder="Techcombank, Momo, Alipay…" /></label><div className={styles.row}><label>{t.balance}<input type="number" min={-1e12} max={1e12} step="0.01" required value={wallet.initial} onChange={e => updateWallet({ initial: e.target.valueAsNumber })} /></label><label>{t.currency}<select disabled={state.transactions.some(t => t.wallet === wallet.id || t.targetWallet === wallet.id)} value={wallet.currency} onChange={e => updateWallet({ currency: e.target.value as typeof wallet.currency })}>{Array.from(new Set([...SETUP_CURRENCIES, wallet.currency])).map(c => <option key={c}>{c}</option>)}</select></label></div><div className={styles.row}><button type="button" disabled={walletIndex === 0} onClick={() => setWalletIndex(i => i - 1)}>{t.previousWallet}</button><button type="button" disabled={walletIndex === data.wallets.length - 1} onClick={() => setWalletIndex(i => i + 1)}>{t.nextWallet}</button></div><button type="button" className={styles.outline} disabled={!wallet.name.trim() || data.wallets.length >= 30} onClick={() => { setData(d => ({ ...d, wallets: [...d.wallets, { id: crypto.randomUUID(), name: "", currency: wallet.currency, initial: 0 }] })); setWalletIndex(data.wallets.length); }}><Plus size={16} />{t.addWallet}</button>{data.wallets.length > 1 && !state.wallets.some(w => w.id === wallet.id) && <button type="button" onClick={() => { setData(d => ({ ...d, wallets: d.wallets.filter(w => w.id !== wallet.id), reserves: d.reserves.filter(r => r.walletId !== wallet.id), commitments: d.commitments.filter(c => c.walletId !== wallet.id) })); setWalletIndex(0); }}><Trash2 size={14} />{t.remove}</button>}</>}
        {(step === 3 || step === 4) && <><div className={styles.options}>{Array.from(new Set([...(step === 3 ? t.expense : t.income), ...data[field]])).map(c => <button key={c} type="button" aria-pressed={data[field].includes(c)} onClick={() => toggle(field, c)}>{c}{data[field].includes(c) && <Check size={16} />}</button>)}</div><div className={styles.row}><label>{t.custom}<input maxLength={80} value={custom} onChange={e => setCustom(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }} /></label><button type="button" className={styles.outline} onClick={addCategory}>{t.addCategory}</button></div></>}
        {step === 5 && <>
          <fieldset><legend>{t.fixed}</legend><div className={styles.options}><button type="button" aria-pressed={!hasFixed} onClick={() => setHasFixed(false)}>{t.no}</button><button type="button" aria-pressed={hasFixed} onClick={() => setHasFixed(true)}>{t.yes}</button></div></fieldset>
          {hasFixed && <>
            <label>{t.titleLabel}<input maxLength={80} value={bill.title} aria-invalid={billIssue?.field === "title"} onChange={e => setBill(b => ({ ...b, title: e.target.value }))} />{billFieldError("title")}</label>
            <div className={styles.row}>
              <label>{t.source}<select value={bill.walletId} onChange={e => { setBill(b => ({ ...b, walletId: e.target.value, amount: "" })); setError(""); }}>{data.wallets.map(w => <option value={w.id} key={w.id}>{w.name} · {w.currency}</option>)}</select></label>
              <label>{t.amount}<input type="number" min="0.01" max={availableForFixed} step="0.01" value={bill.amount} aria-invalid={billAmountExceedsBalance || billIssue?.field === "amount"} aria-describedby={billAmountExceedsBalance ? "fixed-expense-amount-error" : undefined} onChange={e => { setBill(b => ({ ...b, amount: e.target.value })); setError(""); }} />{!billAmountExceedsBalance && billFieldError("amount")}</label>
            </div>
            {billAmountExceedsBalance && <p id="fixed-expense-amount-error" role="alert" className={styles.fieldError}>{FIXED_BALANCE_COPY[lang].exceeds}</p>}
            <label>{t.category}<select value={bill.category} aria-invalid={billIssue?.field === "category"} onChange={e => { const category = e.target.value; setBill(b => ({ ...b, category })); if (category !== OTHER_CATEGORY) setCustomBillCategory(""); setError(""); }}><option value="">—</option>{data.expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}<option value={OTHER_CATEGORY}>{FIXED_BALANCE_COPY[lang].other}</option></select>{bill.category !== OTHER_CATEGORY && billFieldError("category")}</label>
            {bill.category === OTHER_CATEGORY && <label>{FIXED_BALANCE_COPY[lang].otherLabel}<input maxLength={80} value={customBillCategory} aria-invalid={billIssue?.field === "category"} onChange={e => { setCustomBillCategory(e.target.value); setError(""); }} />{billFieldError("category")}</label>}
            <div className={styles.row}><label>{t.interval}<select value={bill.intervalMonths} onChange={e => setBill(b => ({ ...b, intervalMonths: Number(e.target.value) }))}>{[1, 2, 3, 6, 12].map(n => <option key={n} value={n}>{n}</option>)}</select></label><label>{t.reminder}<select value={bill.reminderDays} onChange={e => setBill(b => ({ ...b, reminderDays: Number(e.target.value) }))}>{[0, 1, 3, 5, 7].map(n => <option key={n} value={n}>{n}</option>)}</select></label></div>
            <div className={styles.row}><label>{t.monthPosition}<select value={bill.monthPosition} onChange={e => setBill(b => ({ ...b, monthPosition: e.target.value as typeof b.monthPosition }))}>{["start", "end", "date"].map((p, i) => <option key={p} value={p}>{t.positions[i]}</option>)}</select></label><label>{t.due}<input type="date" value={bill.dueDate} aria-invalid={billIssue?.field === "dueDate"} onChange={e => setBill(b => ({ ...b, dueDate: e.target.value }))} />{billFieldError("dueDate")}</label></div>
            <button type="button" className={styles.outline} disabled={billAmountExceedsBalance} onClick={addBill}><Plus size={16} />{t.addFixed}</button>
            {hasFixedDraft && <p role="status">{FIXED_STEP_COPY[lang].draft}</p>}
            {billIssue && !["title", "amount", "category", "dueDate"].includes(billIssue.field) && <p role="alert" className={styles.fieldError}>{billIssue.message}</p>}
            <ul className={styles.bills}>{data.commitments.map(c => <li key={c.id}><span><b>{c.title}</b><small>{c.amount.toLocaleString()} {data.wallets.find(w => w.id === c.walletId)?.currency} · {c.dueDate} · {c.intervalMonths} {t.interval}</small></span><button type="button" aria-label={`${t.remove} ${c.title}`} onClick={() => setData(d => ({ ...d, commitments: d.commitments.filter(item => item.id !== c.id) }))}><Trash2 size={16} /></button></li>)}</ul>
            <p className={styles.hint}>{t.planned}</p>
          </>}
        </>}
        {step === 6 && <><p>{t.reserveHint}</p>{data.wallets.map(w => <label key={w.id}>{t.reserve} · {w.name} ({w.currency})<input type="number" min={0} max={1e12} step="0.01" value={data.reserves.find(r => r.walletId === w.id)?.amount ?? 0} onChange={e => setReserve(w.id, e.target.valueAsNumber)} /></label>)}<small>{t.zero}</small></>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <footer className={styles.footer}><button type="button" disabled={step === 0 || saving} onClick={() => { setError(""); setStep(s => s - 1); }}><ArrowLeft size={16} />{t.back}</button><button type="submit" className={theme.start} disabled={saving || (step === 5 && hasFixed && billAmountExceedsBalance)}>{saving ? t.saving : step === 6 ? t.finish : t.next}<ArrowRight size={16} /></button></footer>
      </form>
    </div>
  </main>;
}
