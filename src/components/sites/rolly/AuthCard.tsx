"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { GoogleIcon } from "./Icons";
import { authClient } from "@/lib/auth-client";
import { AUTH_COPY, authLanguage } from "@/lib/auth-copy";

export function AuthCard({ onBack, lang = "en", configured = false, initialError = false }: { onBack: () => void; lang?: string; configured?: boolean; initialError?: boolean }) {
  const language = authLanguage(lang), t = AUTH_COPY[language];
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(initialError);
  const inFlight = useRef(false);
  async function signInGoogle() {
    if (!configured || inFlight.current) return;
    inFlight.current = true; setLoading(true); setFailed(false);
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: "/app", errorCallbackURL: "/login?lang=" + language + "&error=oauth" });
      if (result.error || !result.data?.url) { setFailed(true); setLoading(false); inFlight.current = false; }
      // The auth client navigates to Google. Only the server callback creates a session.
    } catch { setFailed(true); setLoading(false); inFlight.current = false; }
  }
  return <main lang={language} className="min-h-dvh w-full bg-gradient-to-b from-[#dff7f5] to-[#f8faf9] px-5 py-7 sm:px-10">
    <header className="mx-auto flex max-w-5xl items-center justify-between">
      <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-[#173e50] hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-[#147d78]"><ArrowLeft size={18} />{t.back}</button>
      <span className="font-semibold text-[#173e50]">FinBridge</span>
    </header>
    <div className="mx-auto flex max-w-lg flex-col items-center py-10 sm:py-14">
      <Image src="/sites/rolly/images/Welcome_Icon.png" alt={t.jack} width={96} height={96} className="mb-5 object-contain" />
      <section className="w-full rounded-3xl border border-[#e0e8e9] bg-white px-6 py-8 text-center shadow-sm sm:p-10">
        <h1 className="text-2xl font-semibold tracking-tight text-[#173e50] sm:text-3xl">{t.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#6c7e87]">{t.subtitle}</p>
        <button type="button" onClick={() => void signInGoogle()} disabled={!configured || loading} aria-busy={loading} className="mt-8 flex min-h-14 w-full items-center justify-center gap-3 rounded-xl border border-[#dce5e7] bg-white px-4 py-3 font-medium text-[#173e50] hover:bg-[#edf8f5] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#147d78] disabled:cursor-not-allowed disabled:opacity-60"><GoogleIcon /><span>{loading ? t.loading : t.google}</span></button>
        {!configured && <p role="status" className="mt-5 rounded-xl bg-[#fff5eb] p-3 text-sm leading-relaxed text-[#885123]">{t.unavailable}</p>}
        {failed && <p role="alert" className="mt-5 rounded-xl bg-[#fff0f0] p-3 text-sm text-[#a33434]">{t.failure}</p>}
        <p className="mt-6 text-xs leading-relaxed text-[#6c7e87]">{t.note}</p>
        <p className="mt-3 text-xs leading-relaxed text-[#6c7e87]">{t.secure}</p>
      </section>
    </div>
  </main>;
}