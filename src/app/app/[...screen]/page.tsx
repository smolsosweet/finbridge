import { Suspense } from "react";
import { redirect } from "next/navigation";
import { RollyApp } from "@/components/sites/rolly/replica/RollyApp";

export default async function AppScreenPage({ params }: { params: Promise<{ screen: string[] }> }) {
  const { screen } = await params;
  if (screen[0] === "welcome") redirect("/app");
  return <Suspense fallback={<div />}><RollyApp screen={screen[0]} /></Suspense>;
}
