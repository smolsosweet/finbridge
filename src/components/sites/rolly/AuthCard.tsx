"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { GoogleIcon } from "./Icons";
import { authClient } from "@/lib/auth-client";
import { AUTH_COPY, authLanguage, type AuthLanguage } from "@/lib/auth-copy";
import { AUTH_FORM_COPY, type AuthMode } from "@/lib/auth-form-copy";
import { LanguageSelector } from "./LanguageSelector";
import welcome from "./WelcomeScreen.module.css";
import styles from "./AuthCard.module.css";

export function AuthCard({ onBack, lang = "en", configured = false, initialError = false, mode = "login", mailMode = "unavailable", token = "", verified = false }: {
  onBack: () => void; lang?: string; configured?: boolean; initialError?: boolean;
  mode?: AuthMode; mailMode?: "local" | "smtp" | "brevo" | "unavailable"; token?: string; verified?: boolean;
}) {
  const [language, setLanguage] = useState<AuthLanguage>(authLanguage(lang));
  const t = AUTH_COPY[language], f = AUTH_FORM_COPY[language];
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError ? (mode === "reset" ? f.invalidToken : t.failure) : "");
  const [notice, setNotice] = useState(verified ? f.verified : "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const inFlight = useRef(false);
  const mailReady = mailMode !== "unavailable";
  const route = (page: string) => page + "?lang=" + language;
  const loginCallback = route("/login") + "&verified=1";
  const title = mode === "signup" ? f.signupTitle : mode === "forgot" ? f.forgotTitle : mode === "reset" ? f.resetTitle : f.loginTitle;
  const label = mode === "signup" ? f.signup : mode === "forgot" ? f.sendReset : mode === "reset" ? f.savePassword : f.login;
  const disabled = !configured || loading || ((mode === "signup" || mode === "forgot") && !mailReady) || (mode === "reset" && (!token || initialError));
  function failure(code?: string, status?: number) {
    if (status === 429) return f.limited;
    if (code === "EMAIL_NOT_VERIFIED") { setNeedsVerification(true); return f.verifyRequired; }
    if (code === "INVALID_TOKEN") return f.invalidToken;
    return mode === "login" ? f.invalid : f.failure;
  }
  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true; setLoading(true); setError(""); setNotice("");
    try { await action(); } catch { setError(f.failure); }
    finally { inFlight.current = false; setLoading(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    if ((mode === "signup" || mode === "reset") && password !== confirmation) { setError(f.mismatch); return; }
    void run(async () => {
      if (mode === "login") {
        const result = await authClient.signIn.email({ email: email.trim(), password, callbackURL: "/app" });
        if (result.error) { setError(failure(result.error.code, result.error.status)); return; }
        router.replace("/app"); router.refresh();
      } else if (mode === "signup") {
        const fallbackName = email.trim().split("@")[0] || "User";
        const result = await authClient.signUp.email({ name: fallbackName, email: email.trim(), password, callbackURL: loginCallback });
        if (result.error) { setError(failure(result.error.code, result.error.status)); return; }
        setPassword(""); setConfirmation(""); setNotice(f.checkVerification);
      } else if (mode === "forgot") {
        const result = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: route("/reset-password") });
        if (result.error) { setError(failure(result.error.code, result.error.status)); return; }
        setNotice(f.checkReset);
      } else {
        const result = await authClient.resetPassword({ token, newPassword: password });
        if (result.error) { setError(failure(result.error.code, result.error.status)); return; }
        setPassword(""); setConfirmation(""); setNotice(f.resetDone);
      }
    });
  }
  async function signInGoogle() {
    if (!configured || inFlight.current) return;
    await run(async () => {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: "/app", errorCallbackURL: route("/login") + "&error=oauth" });
      if (result.error || !result.data?.url) setError(t.failure);
    });
  }
  function resend() {
    if (!mailReady || !email.trim()) return;
    void run(async () => {
      const result = await authClient.sendVerificationEmail({ email: email.trim(), callbackURL: loginCallback });
      if (result.error) setError(f.failure); else setNotice(f.checkVerification);
    });
  }
  const inputClass = styles.input;
  return <main lang={language} data-mode={mode} className={`${welcome.welcome} ${styles.page}`}>
    <header className={styles.authHeader}>
      <div className={styles.headerLeft}>
        <button type="button" onClick={onBack} className={styles.back}><ArrowLeft size={18} aria-hidden="true" />{t.back}</button>
      </div>
      <div className={styles.headerCenter}>
        <button type="button" onClick={() => router.push("/?lang=" + language)} className={styles.brandButton} title="FinBridge" aria-label="FinBridge">
          <span className={welcome.brandMark} aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none"><path d="M5 24V13M27 24V13M5 17C11 5 21 5 27 17M5 20H27M11 20V24M16 20V24M21 20V24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
          </span>
          <span className={styles.brandText}><span className={welcome.fin}>Fin</span><span className={welcome.bridge}>Bridge</span></span>
        </button>
      </div>
      <div className={styles.headerRight}>
        <LanguageSelector value={language} onChange={setLanguage} />
      </div>
    </header>
    <div className={styles.content}>
      <section className={styles.card} data-mode={mode} aria-labelledby="auth-title">
        <h1 id="auth-title" className={styles.title}>{title}</h1>
        <p className={styles.intro}>{f.intro}</p>
        <form onSubmit={submit} className={styles.form}>
          {mode !== "reset" && <label className="block text-sm text-[#526d78]">{f.email}<input className={inputClass + " mt-1"} type="email" value={email} onChange={(e) => { setEmail(e.target.value); setNeedsVerification(false); }} required maxLength={254} autoComplete="email" disabled={loading} /></label>}
          {mode !== "forgot" && <label className="block text-sm text-[#526d78]">{f.password}<span className="relative mt-1 block"><input className={`${inputClass} ${styles.passwordInput}`} type={visible ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === "login" ? undefined : 12} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} disabled={loading} /><button type="button" aria-label={visible ? f.hide : f.show} aria-pressed={visible} onClick={() => setVisible(!visible)} className="absolute inset-y-0 right-1 grid min-w-12 place-items-center text-[#6c7e87]">{visible ? <EyeOff size={21} /> : <Eye size={21} />}</button></span></label>}
          {(mode === "signup" || mode === "reset") && <><label className="block text-sm text-[#526d78]">{f.confirm}<input className={inputClass + " mt-1"} type={visible ? "text" : "password"} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" disabled={loading} /></label><p className="text-xs text-[#6c7e87]">{f.passwordHint}</p></>}
          <button disabled={disabled} aria-busy={loading} className={`${welcome.start} ${styles.submit}`}>{loading ? f.working : label}</button>
        </form>
        {mode === "login" && <p className={styles.recovery}>{f.forgot} <Link className={styles.link} href={route("/forgot-password")}>{f.resetLink}</Link></p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {notice && <p role="status" className={styles.notice}>{notice}</p>}
        {needsVerification && mailReady && <button type="button" onClick={resend} disabled={loading} className={`${styles.link} ${styles.resend}`}>{f.resend}</button>}
        {(mode === "login" || mode === "signup") && <><div className={styles.divider}><hr />{f.or}<hr /></div><button type="button" onClick={() => void signInGoogle()} disabled={!configured || loading} className={styles.google}><GoogleIcon />{t.google}</button></>}
        {!configured && <p role="status" className={styles.delivery}>{t.unavailable}</p>}
        {!mailReady && <p className={styles.delivery}>{f.mailUnavailable}</p>}
        <p className={styles.footer}>{mode === "login" ? f.noAccount : f.haveAccount} <Link className={styles.link} href={route(mode === "login" ? "/signup" : "/login")}>{mode === "login" ? f.signupLink : f.loginLink}</Link></p>
      </section>
    </div>
  </main>;
}
