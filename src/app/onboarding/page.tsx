"use client";

import { useRouter } from "next/navigation";
import { OnboardingFlow } from "@/components/sites/rolly/OnboardingFlow";

export default function OnboardingPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen w-full bg-[#f5f8f8]">
      <OnboardingFlow
        onComplete={() => router.push("/app")}
        onBackToWelcome={() => router.push("/")}
      />
    </main>
  );
}
