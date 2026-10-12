import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { readAuthConfig } from "@/lib/auth-config";
import { authLanguage } from "@/lib/auth-copy";
import { LoginEntry } from "@/components/auth/LoginEntry";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ lang?: string; error?: string }> }) {
  if (await getSession()) redirect("/app");
  const params = await searchParams;
  let configured = false;
  try { configured = !!readAuthConfig(); } catch { /* Invalid configuration keeps sign-in unavailable. */ }
  return <LoginEntry lang={authLanguage(params.lang)} configured={configured} error={!!params.error} />;
}