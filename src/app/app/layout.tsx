import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { AuthenticatedWorkspace } from "@/components/auth/AuthenticatedWorkspace";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "development" && process.env.FINBRIDGE_DEMO_MODE === "true") {
    return (
      <AuthenticatedWorkspace demoMode user={{ id: "finbridge-local-demo", name: "Demo", email: "demo@localhost" }}>
        {children}
      </AuthenticatedWorkspace>
    );
  }
  const session = await getSession();
  if (!session) redirect("/");
  return <AuthenticatedWorkspace user={{ id: session.user.id, name: session.user.name, email: session.user.email }}>{children}</AuthenticatedWorkspace>;
}
