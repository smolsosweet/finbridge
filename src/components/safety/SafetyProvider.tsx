"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuthenticatedUser } from "@/components/auth/AuthenticatedUser";
import { flushWorkspace, workspaceOwner } from "@/components/sites/rolly/replica/store";
import type { SafetyCommand } from "@/lib/safety-handler";
import { emptySafetyPublic, type SafetyPublic } from "@/lib/safety-model";
type Command = SafetyCommand extends infer T ? T extends SafetyCommand ? Omit<T, "revision"> : never : never;
type Context = { doc: SafetyPublic; loading: boolean; busy: boolean; error: string; mutate: (command: Command) => Promise<void>; refresh: () => Promise<void> };
const SafetyContext = createContext<Context | null>(null);
export const useSafety = () => useContext(SafetyContext);
export function SafetyProvider({ children }: { children: ReactNode }) {
  const user = useAuthenticatedUser();
  return user ? <OwnedSafetyProvider key={user.id} owner={user.id}>{children}</OwnedSafetyProvider> : children;
}
function OwnedSafetyProvider({ children, owner }: { children: ReactNode; owner: string }) {
  const [doc, setDoc] = useState<SafetyPublic>(emptySafetyPublic), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const current = useRef(doc), active = useRef(true), locked = useRef(false);
  const adopt = useCallback((value: SafetyPublic) => { if (active.current && workspaceOwner() === owner && value.revision >= current.current.revision) { current.current = value; setDoc(value); } }, [owner]);
  const refresh = useCallback(async () => {
    const response = await fetch("/api/safety", { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("UNAVAILABLE"); adopt(await response.json());
    if (active.current) setError("");
  }, [adopt]);
  useEffect(() => {
    active.current = true;
    void refresh().catch(() => { if (active.current) setError("UNAVAILABLE"); }).finally(() => { if (active.current) setLoading(false); });
    const update = () => { if (!locked.current) void refresh().catch(() => {}); };
    const timer = setInterval(update, 60000); window.addEventListener("finbridge:workspace-saved", update);
    return () => { active.current = false; clearInterval(timer); window.removeEventListener("finbridge:workspace-saved", update); };
  }, [refresh]);
  const mutate = useCallback(async (command: Command) => {
    if (locked.current) throw new Error("BUSY");
    if (workspaceOwner() !== owner) throw new Error("UNAUTHENTICATED");
    locked.current = true; setBusy(true); setError("");
    try {
      await flushWorkspace();
      const response = await fetch("/api/safety", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...command, revision: current.current.revision }), signal: AbortSignal.timeout(20000) });
      const body = await response.json();
      if (!response.ok) { if (response.status === 409) await refresh(); throw new Error(body.error || "UNAVAILABLE"); }
      adopt(body);
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : "UNAVAILABLE"); throw e; }
    finally { locked.current = false; if (active.current) setBusy(false); }
  }, [adopt, owner, refresh]);
  return <SafetyContext.Provider value={{ doc, loading, busy, error, mutate, refresh }}>{children}</SafetyContext.Provider>;
}
