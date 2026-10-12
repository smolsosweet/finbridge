"use client";

import { useState } from "react";
import Image from "next/image";
import { Globe } from "lucide-react";
import { AUTH_COPY, authLanguage, type AuthLanguage } from "@/lib/auth-copy";

export function WelcomeScreen({ onGetStarted, onLogIn, initialLang = "en" }: { onGetStarted: (lang?: AuthLanguage) => void; onLogIn: (lang?: AuthLanguage) => void; initialLang?: string }) {
  const [lang, setLang] = useState<AuthLanguage>(authLanguage(initialLang));
  const t = AUTH_COPY[lang];
  return <main lang={lang} className="min-h-dvh flex flex-col items-center bg-gradient-to-b from-[#dff7f5] to-[#f8faf9] px-5 py-7 sm:px-10">
    <header className="flex w-full max-w-5xl items-center justify-between gap-5">
      <label className="flex items-center gap-2 rounded-xl border border-[#147d78]/30 bg-white/60 px-3 py-2 text-sm text-[#173e50]"><Globe size={17} /><select aria-label={t.language} value={lang} onChange={(e) => setLang(authLanguage(e.target.value))} className="bg-transparent py-1 focus:outline-2 focus:outline-[#147d78]"><option value="en">English</option><option value="vi">Tiếng Việt</option><option value="zh">中文</option></select></label>
      <span className="font-semibold tracking-tight text-[#173e50]">FinBridge</span>
    </header>
    <section className="my-auto flex max-w-2xl flex-col items-center py-9 text-center">
      <p className="max-w-md text-base leading-relaxed text-[#6c7e87] sm:text-lg">{t.greeting}</p>
      <Image src="/sites/rolly/images/Welcome_Icon.png" alt={t.jack} width={280} height={280} priority className="my-8 h-52 w-52 object-contain sm:h-64 sm:w-64" />
      <h1 className="text-3xl font-semibold leading-tight tracking-tight text-[#147d78] sm:text-4xl">{t.headline}</h1>
    </section>
    <div className="flex w-full max-w-2xl flex-col items-center gap-5 pb-4">
      <button type="button" onClick={() => onGetStarted(lang)} className="w-full rounded-2xl bg-[#147d78] px-6 py-4 font-semibold text-white transition-colors hover:bg-[#106762] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#147d78]">{t.start}</button>
      <button type="button" onClick={() => onLogIn(lang)} className="text-sm text-[#173e50] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#147d78]">{t.returning}</button>
    </div>
  </main>;
}