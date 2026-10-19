"use client";
import { useState, useSyncExternalStore } from "react";
import { authLanguage, type AuthLanguage } from "@/lib/auth-copy";
import { readPreferredLanguage, rememberPreferredLanguage, subscribePreferredLanguage } from "@/lib/language-preference";
export function usePreferredLanguage(initial: string, preferStored: boolean) {
  const fallback = authLanguage(initial);
  const stored = useSyncExternalStore(subscribePreferredLanguage, () => readPreferredLanguage(fallback), () => fallback);
  const [choice, setChoice] = useState<AuthLanguage | null>(null);
  const language = choice ?? (preferStored ? stored : fallback);
  return [language, (value: AuthLanguage) => { rememberPreferredLanguage(value); setChoice(value); }] as const;
}
