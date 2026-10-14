"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useAuthenticatedUser } from "./AuthenticatedUser";
import { OnboardingWizard } from "./OnboardingWizard";
import { applyOnboarding, onboardingSchema, type OnboardingRecord } from "@/lib/onboarding";
import { SETUP_COPY } from "@/lib/setup-copy";
import { updateState, useAppState, workspaceOwner } from "@/components/sites/rolly/replica/store";
export function FirstRunGate({ children }: { children: ReactNode }) {
  const user = useAuthenticatedUser(), state = useAppState();
  const [status, setStatus] = useState<"loading" | "setup" | "complete" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const lang = /中文|zh/.test(String(state.settings.language)) ? "zh" : /Việt|vi/.test(String(state.settings.language)) ? "vi" : "en";
  const userId = user?.id;
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    if (!userId) return;
    fetch("/api/onboarding", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }).then(async response => {
      if (!response.ok) throw new Error("SETUP_UNAVAILABLE");
      const result = await response.json();
      if (!active || workspaceOwner() !== userId) return;
      if (result.profile) {
        if (!onboardingSchema.safeParse(result.profile.data).success) throw new Error("INVALID_PROFILE");
        updateState(s => applyOnboarding(s, result.profile)); setStatus("complete");
      } else setStatus("setup");
    }).catch(() => { if (active) setStatus("error"); });
    return () => { active = false; controller.abort(); };
  }, [userId, attempt]);
  function completed(profile: OnboardingRecord) {
    if (workspaceOwner() !== userId) return;
    updateState(s => applyOnboarding(s, profile)); setStatus("complete");
  }
  if (status === "complete") return children;
  if (status === "setup" && user) return <OnboardingWizard userId={user.id} name={user.name} state={state} onComplete={completed} />;
  return <div role="status" className="min-h-dvh grid place-content-center gap-4 p-6 text-center bg-[#f5f7fa] text-[#5930b5]">{status === "error" ? <><p>{SETUP_COPY[lang].unavailable}</p><button type="button" onClick={() => { setStatus("loading"); setAttempt(a => a + 1); }}>{SETUP_COPY[lang].retry}</button></> : "FinBridge…"}</div>;
}
