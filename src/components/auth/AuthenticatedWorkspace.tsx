"use client";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LegacyWorkspaceNotice } from "./LegacyWorkspaceNotice";
import { authClient } from "@/lib/auth-client";
import { AuthenticatedUserContext, type AuthenticatedUser } from "./AuthenticatedUser";
import { activateUserWorkspace, clearUserWorkspace, subscribeWorkspace, workspaceOwner } from "@/components/sites/rolly/replica/store";

export function AuthenticatedWorkspace({ user, children, demoMode = false }: { user: AuthenticatedUser; children: ReactNode; demoMode?: boolean }) {
  if (demoMode) return <LocalDemoWorkspace user={user}>{children}</LocalDemoWorkspace>;
  return <SessionWorkspace user={user}>{children}</SessionWorkspace>;
}

function LocalDemoWorkspace({ user, children }: { user: AuthenticatedUser; children: ReactNode }) {
  const ready = useSyncExternalStore(subscribeWorkspace, () => workspaceOwner() === user.id, () => false);
  useEffect(() => {
    activateUserWorkspace(user.id, user.name);
    return () => clearUserWorkspace(user.id);
  }, [user.id, user.name]);
  if (!ready) return <div role="status" className="min-h-screen grid place-items-center bg-[#f3f6f6] text-[#147d78]">FinBridge…</div>;
  return <AuthenticatedUserContext.Provider value={user}>{children}</AuthenticatedUserContext.Provider>;
}

function SessionWorkspace({ user, children }: { user: AuthenticatedUser; children: ReactNode }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const ready = useSyncExternalStore(subscribeWorkspace, () => workspaceOwner() === user.id, () => false);
  useEffect(() => {
    activateUserWorkspace(user.id, user.name);
    return () => clearUserWorkspace(user.id);
  }, [user.id, user.name]);
  useEffect(() => {
    if (!isPending && session?.user.id !== user.id) {
      clearUserWorkspace(user.id);
      router.replace("/");
      router.refresh();
    }
  }, [session?.user.id, isPending, user.id, router]);
  if (!ready || (!isPending && session?.user.id !== user.id)) return <div role="status" className="min-h-screen grid place-items-center bg-[#f3f6f6] text-[#147d78]">FinBridge…</div>;
  const currentUser = session?.user.id === user.id
    ? { id: session.user.id, name: session.user.name, email: session.user.email }
    : user;
  return <AuthenticatedUserContext.Provider value={currentUser}><LegacyWorkspaceNotice />{children}</AuthenticatedUserContext.Provider>;
}
