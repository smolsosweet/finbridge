"use client";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FirstRunGate } from "./FirstRunGate";
import { DatabaseWorkspace } from "./DatabaseWorkspace";
import { authClient } from "@/lib/auth-client";
import { AuthenticatedUserContext, type AuthenticatedUser } from "./AuthenticatedUser";
import { SafetyProvider } from "@/components/safety/SafetyProvider";
import { activateUserWorkspace, clearUserWorkspace, subscribeWorkspace, workspaceOwner, useAppState } from "@/components/finbridge/workspace/store";
import { resolveLanguage } from "@/lib/i18n";

export function AuthenticatedWorkspace({ user, children, demoMode = false }: { user: AuthenticatedUser; children: ReactNode; demoMode?: boolean }) {
  if (demoMode) return <LocalDemoWorkspace user={user}>{children}</LocalDemoWorkspace>;
  return <SessionWorkspace user={user}>{children}</SessionWorkspace>;
}

function LocalDemoWorkspace({ user, children }: { user: AuthenticatedUser; children: ReactNode }) {
  const state = useAppState();
  const notice = {
    vi: "Demo cục bộ: dữ liệu trên thiết bị và bộ nhớ tạm, không đồng bộ database.",
    en: "Local demo: device storage and temporary server memory, without database sync.",
    zh: "本地演示：数据使用设备存储和服务器临时内存，不同步到数据库。",
  }[resolveLanguage(state.settings.language)];
  const ready = useSyncExternalStore(subscribeWorkspace, () => workspaceOwner() === user.id, () => false);
  useEffect(() => {
    activateUserWorkspace(user.id, user.name);
    return () => clearUserWorkspace(user.id);
  }, [user.id, user.name]);
  if (!ready) return <div role="status" className="min-h-screen grid place-items-center bg-[#f3f6f6] text-[#147d78]">FinBridge…</div>;
  return <AuthenticatedUserContext.Provider value={user}><SafetyProvider><div className="fb-local-demo-shell"><div role="status" className="fb-database-status">{notice}</div>{children}</div></SafetyProvider></AuthenticatedUserContext.Provider>;
}

function SessionWorkspace({ user, children }: { user: AuthenticatedUser; children: ReactNode }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const ready = useSyncExternalStore(subscribeWorkspace, () => workspaceOwner() === user.id, () => false);
  useEffect(() => {
    activateUserWorkspace(user.id, user.name, { persistence: "database" });
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
  return <AuthenticatedUserContext.Provider value={currentUser}><DatabaseWorkspace key={user.id} owner={user.id}><SafetyProvider><FirstRunGate>{children}</FirstRunGate></SafetyProvider></DatabaseWorkspace></AuthenticatedUserContext.Provider>;
}
