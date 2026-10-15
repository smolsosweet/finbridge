"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Mascot } from "page-mascot";
import { AUTH_COPY, authLanguage, type AuthLanguage } from "@/lib/auth-copy";
import { readPreferredLanguage, rememberPreferredLanguage } from "@/lib/language-preference";
import { LanguageSelector } from "./LanguageSelector";
import styles from "./WelcomeScreen.module.css";

export function WelcomeScreen({ onGetStarted, onLogIn, initialLang = "en", preferStoredLanguage = true }: { onGetStarted: (lang?: AuthLanguage) => void; onLogIn: (lang?: AuthLanguage) => void; initialLang?: string; preferStoredLanguage?: boolean }) {
  const [lang, setLang] = useState<AuthLanguage>(authLanguage(initialLang));
  useEffect(() => { if (preferStoredLanguage) setLang(readPreferredLanguage(authLanguage(initialLang))); }, [initialLang, preferStoredLanguage]);
  const t = AUTH_COPY[lang];
  return <main lang={lang} className={styles.welcome}>
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <path d="M5 24V13M27 24V13M5 17C11 5 21 5 27 17M5 20H27M11 20V24M16 20V24M21 20V24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </span>
        <span><span className={styles.fin}>Fin</span><span className={styles.bridge}>Bridge</span></span>
      </div>
      <LanguageSelector value={lang} onChange={(next) => { rememberPreferredLanguage(next); setLang(next); }} />
    </header>
    <section className={styles.hero} aria-labelledby="welcome-title">
      <div className={styles.mascotStage}>
        <Mascot directions="/mascots/lac-directions.webp" reactions="/mascots/lac-reactions.webp" size={220} label={t.jack} className={styles.mascot} />
      </div>
      <p className={styles.greeting}>{t.greeting}</p>
      <h1 id="welcome-title" className={styles.headline}>{t.headline}</h1>
      <div className={styles.actions}>
        <button type="button" onClick={() => onGetStarted(lang)} className={styles.start}>
          {lang === "vi" ? "Tạo tài khoản" : lang === "zh" ? "创建账户" : "Create account"}<ArrowRight size={19} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onLogIn(lang)} className={styles.login}>{t.returning}</button>
      </div>
    </section>
  </main>;
}
