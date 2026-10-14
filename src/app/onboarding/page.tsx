import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { authLanguage } from "@/lib/auth-copy";
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { lang } = await searchParams;
  redirect(await getSession() ? "/app" : "/signup?lang=" + authLanguage(lang));
}
