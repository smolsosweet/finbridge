import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { WelcomeEntry } from "@/components/auth/WelcomeEntry";
import { authLanguage } from "@/lib/auth-copy";

export default async function Home({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  if (await getSession()) redirect("/app");
  const { lang } = await searchParams;
  return <WelcomeEntry lang={authLanguage(lang)} />;
}