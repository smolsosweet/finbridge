"use client";
import { useRouter } from "next/navigation";
import { WelcomeScreen } from "@/components/sites/rolly/WelcomeScreen";

export function WelcomeEntry({ lang = "en" }: { lang?: string }) {
  const router = useRouter();
  return <WelcomeScreen initialLang={lang} onGetStarted={(selected) => router.push("/onboarding?lang=" + (selected || "en"))} onLogIn={(selected) => router.push("/login?lang=" + (selected || "en"))} />;
}