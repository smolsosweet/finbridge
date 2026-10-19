"use client";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/finbridge/AuthCard";
import type { AuthMode } from "@/lib/auth-form-copy";
export function LoginEntry({ lang, configured, errorCode = "", mode = "login", mailMode = "unavailable", token = "", verified = false, preferStoredLanguage = true }: { lang: string; configured: boolean; errorCode?: string; mode?: AuthMode; mailMode?: "local" | "smtp" | "brevo" | "unavailable"; token?: string; verified?: boolean; preferStoredLanguage?: boolean }) {
  const router = useRouter();
  return <AuthCard lang={lang} preferStoredLanguage={preferStoredLanguage} configured={configured} initialErrorCode={errorCode} mode={mode} mailMode={mailMode} token={token} verified={verified} onBack={() => router.push((mode === "login" || mode === "signup" ? "/" : "/login") + "?lang=" + lang)} />;
}
