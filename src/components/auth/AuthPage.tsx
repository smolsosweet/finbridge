import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { readAuthConfig } from "@/lib/auth-config";
import { readMailConfig } from "@/lib/auth-mail";
import { authLanguage } from "@/lib/auth-copy";
import type { AuthMode } from "@/lib/auth-form-copy";
import { LoginEntry } from "./LoginEntry";

export type AuthSearchParams = Promise<{ lang?: string; error?: string; token?: string; verified?: string }>;
export async function AuthPage({ searchParams, mode }: { searchParams: AuthSearchParams; mode: AuthMode }) {
  if ((mode === "login" || mode === "signup") && await getSession()) redirect("/app");
  const params = await searchParams;
  let configured = false;
  let mailMode: "local" | "smtp" | "brevo" | "unavailable" = "unavailable";
  try { configured = !!readAuthConfig(); mailMode = readMailConfig()?.mode || "unavailable"; } catch { configured = false; }
  return <LoginEntry lang={authLanguage(params.lang)} configured={configured} error={!!params.error} mode={mode} mailMode={mailMode} token={mode === "reset" ? params.token || "" : ""} verified={mode === "login" && params.verified === "1"} />;
}
