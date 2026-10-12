"use client";

import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/sites/rolly/AuthCard";

export default function SignupPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen w-full bg-[#e8faf7]">
      <AuthCard
        initialMode="signup"
        onSuccess={() => router.push("/app")}
        onBack={() => router.push("/")}
      />
    </main>
  );
}
