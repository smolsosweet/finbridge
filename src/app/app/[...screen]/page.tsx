import { Suspense } from "react";
import { redirect } from "next/navigation";
import { FinBridgeApp } from "@/components/finbridge/workspace/FinBridgeApp";

export default async function AppScreenPage({ params }: { params: Promise<{ screen: string[] }> }) {
  const { screen } = await params;
  if (screen[0] === "welcome") redirect("/app");
  return <Suspense fallback={<div />}><FinBridgeApp screen={screen[0]} /></Suspense>;
}
