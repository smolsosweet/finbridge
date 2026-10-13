"use client";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/sites/rolly/AuthCard";
export function LoginEntry({ lang, configured, error }: { lang: string; configured: boolean; error: boolean }) {
  const router = useRouter();
  return <AuthCard lang={lang} configured={configured} initialError={error} onBack={() => router.push("/?lang=" + lang)} />;
}