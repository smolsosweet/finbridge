"use client";

import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/sites/rolly/AuthCard";

export default function LoginPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen w-full bg-[#e8faf7]">
      <AuthCard
        initialMode="login"
        onSuccess={() => router.push("/app")}
        onBack={() => router.push("/")}
      />
    </main>
  );
}
