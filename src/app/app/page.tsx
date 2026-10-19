import { Suspense } from "react";
import { FinBridgeApp } from "@/components/finbridge/workspace/FinBridgeApp";

export default function AppPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <FinBridgeApp />
    </Suspense>
  );
}
