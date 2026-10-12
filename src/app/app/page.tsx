import { Suspense } from "react";
import { RollyApp } from "@/components/sites/rolly/replica/RollyApp";

export default function AppPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <RollyApp />
    </Suspense>
  );
}
