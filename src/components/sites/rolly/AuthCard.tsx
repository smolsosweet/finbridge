"use client";

import { useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { GoogleIcon } from "./Icons";
import { authClient } from "@/lib/auth-client";
import { AUTH_COPY, authLanguage } from "@/lib/auth-copy";
import { AUTH_FORM_COPY, type AuthMode } from "@/lib/auth-form-copy";

export function AuthCard({ onBack, lang = "en", configured = false, initialError = false, mode = "login", mailMode = "unavailable", token = "", verified = false }: {
  onBack: () => void; lang?: string; configured?: boolean; initialError?: boolean;
  mode?: AuthMode; mailMode?: "local" | "smtp" | "brevo" | "unavailable"; token?: string; verified?: boolean;
}) {
  const language = authLanguage(lang), t = AUTH_COPY[language], f = AUTH_FORM_COPY[language];
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError ? (mode === "reset" ? f.invalidToken : t.failure) : "");
  const [notice, setNotice] = useState(verified ? f.verified : "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [name, setName] = useState("");
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
        const result = await authClient.signUp.email({ name: name.trim(), email: email.trim(), password, callbackURL: loginCallback });
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
  const inputClass = "min-h-14 w-full rounded-xl border border-[#dce5e7] bg-white px-4 text-[#173e50] outline-none focus:border-[#147d78] focus:ring-2 focus:ring-[#147d78]/20 disabled:opacity-60";
  return <main lang={language} className="min-h-dvh w-full bg-gradient-to-b from-[#dff7f5] to-[#f8faf9] px-4 py-6 sm:px-10">
    <header className="mx-auto flex max-w-5xl items-center justify-between">
      <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-[#173e50] hover:bg-white/70"><ArrowLeft size={18} />{t.back}</button>
      <span className="font-semibold text-[#173e50]">FinBridge</span>
    </header>
    <div className="mx-auto flex max-w-xl flex-col items-center py-5 sm:py-8">
      <Image src="/sites/rolly/images/Welcome_Icon.png" alt={t.jack} width={72} height={72} className="mb-4 object-contain" />
      <section className="w-full rounded-3xl border border-[#e0e8e9] bg-white px-5 py-7 text-center shadow-sm sm:p-9">
        <h1 className="text-3xl font-semibold tracking-tight text-[#173e50]">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#6c7e87]">{f.intro}</p>
        <form onSubmit={submit} className="mt-6 space-y-4 text-left">
          {mode === "signup" && <label className="block text-sm text-[#526d78]">{f.name}<input className={inputClass + " mt-1"} value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoComplete="name" disabled={loading} /></label>}
          {mode !== "reset" && <label className="block text-sm text-[#526d78]">{f.email}<input className={inputClass + " mt-1"} type="email" value={email} onChange={(e) => { setEmail(e.target.value); setNeedsVerification(false); }} required maxLength={254} autoComplete="email" disabled={loading} /></label>}
          {mode !== "forgot" && <label className="block text-sm text-[#526d78]">{f.password}<span className="relative mt-1 block"><input className={inputClass + " pr-14"} type={visible ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === "login" ? undefined : 12} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} disabled={loading} /><button type="button" aria-label={visible ? f.hide : f.show} aria-pressed={visible} onClick={() => setVisible(!visible)} className="absolute inset-y-0 right-1 grid min-w-12 place-items-center text-[#6c7e87]">{visible ? <EyeOff size={21} /> : <Eye size={21} />}</button></span></label>}
          {(mode === "signup" || mode === "reset") && <><label className="block text-sm text-[#526d78]">{f.confirm}<input className={inputClass + " mt-1"} type={visible ? "text" : "password"} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" disabled={loading} /></label><p className="text-xs text-[#6c7e87]">{f.passwordHint}</p></>}
          <button disabled={disabled} aria-busy={loading} className="min-h-14 w-full rounded-xl bg-[#147d78] px-4 py-3 font-semibold text-white hover:bg-[#106c68] disabled:cursor-not-allowed disabled:opacity-60">{loading ? f.working : label}</button>
        </form>
        {mode === "login" && <p className="mt-3 text-sm text-[#6c7e87]">{f.forgot} <Link className="font-semibold text-[#147d78] underline-offset-4 hover:underline" href={route("/forgot-password")}>{f.resetLink}</Link></p>}
        {error && <p role="alert" className="mt-4 rounded-xl bg-[#fff0f0] p-3 text-sm text-[#a33434]">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-xl bg-[#edf8f5] p-3 text-sm text-[#147d78]">{notice}</p>}
        {needsVerification && mailReady && <button type="button" onClick={resend} disabled={loading} className="mt-3 min-h-11 text-sm font-semibold text-[#147d78] underline">{f.resend}</button>}
        {(mode === "login" || mode === "signup") && <><div className="my-5 flex items-center gap-4 text-xs text-[#6c7e87]"><hr className="flex-1 border-[#e0e8e9]" />{f.or}<hr className="flex-1 border-[#e0e8e9]" /></div><button type="button" onClick={() => void signInGoogle()} disabled={!configured || loading} className="flex min-h-14 w-full items-center justify-center gap-3 rounded-xl border border-[#dce5e7] px-4 py-3 font-medium text-[#173e50] hover:bg-[#edf8f5] disabled:opacity-60"><GoogleIcon />{t.google}</button></>}
        {!configured && <p role="status" className="mt-4 text-sm text-[#885123]">{t.unavailable}</p>}
        {!mailReady && <p className="mt-4 text-xs leading-relaxed text-[#885123]">{f.mailUnavailable}</p>}
        {mailMode === "local" && <p className="mt-4 text-xs leading-relaxed text-[#885123]">{f.localMail}</p>}
        <p className="mt-5 text-sm text-[#6c7e87]">{mode === "login" ? f.noAccount : f.haveAccount} <Link className="font-semibold text-[#147d78] hover:underline" href={route(mode === "login" ? "/signup" : "/login")}>{mode === "login" ? f.signupLink : f.loginLink}</Link></p>
      </section>
    </div>
  </main>;
}
