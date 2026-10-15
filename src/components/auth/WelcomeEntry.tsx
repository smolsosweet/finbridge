"use client";
import { useRouter } from "next/navigation";
import { WelcomeScreen } from "@/components/sites/rolly/WelcomeScreen";

export function WelcomeEntry({ lang = "en", preferStoredLanguage = true }: { lang?: string; preferStoredLanguage?: boolean }) {
  const router = useRouter();
  return <WelcomeScreen initialLang={lang} preferStoredLanguage={preferStoredLanguage} onGetStarted={(selected) => router.push("/signup?lang=" + (selected || "en"))} onLogIn={(selected) => router.push("/login?lang=" + (selected || "en"))} />;
}
