import { Suspense } from "react";
import { RollyApp } from "@/components/sites/rolly/replica/RollyApp";

export default async function AppScreenPage({ params }: { params: Promise<{ screen: string[] }> }) {
  const { screen } = await params;
  return <Suspense fallback={<div />}><RollyApp screen={screen[0]} /></Suspense>;
}
