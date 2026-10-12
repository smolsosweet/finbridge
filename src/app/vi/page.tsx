"use client";

import { useRouter } from "next/navigation";
import { LandingPageVi } from "@/components/sites/rolly/LandingPageVi";

export default function ViLandingPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen w-full bg-[#f8faf9]">
      <LandingPageVi onGoToWeb={() => router.push("/app")} />
    </main>
  );
}
