"use client";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/sites/rolly/AuthCard";
import type { AuthMode } from "@/lib/auth-form-copy";
export function LoginEntry({ lang, configured, error, mode = "login", mailMode = "unavailable", token = "", verified = false }: { lang: string; configured: boolean; error: boolean; mode?: AuthMode; mailMode?: "local" | "smtp" | "brevo" | "unavailable"; token?: string; verified?: boolean }) {
  const router = useRouter();
  return <AuthCard lang={lang} configured={configured} initialError={error} mode={mode} mailMode={mailMode} token={token} verified={verified} onBack={() => router.push((mode === "login" ? "/" : "/login") + "?lang=" + lang)} />;
}
