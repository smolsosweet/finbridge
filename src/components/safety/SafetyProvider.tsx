"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuthenticatedUser } from "@/components/auth/AuthenticatedUser";
import { useAppState, workspaceOwner } from "@/components/sites/rolly/replica/store";
import type { SafetyCommand } from "@/lib/safety-handler";
import { emptySafetyPublic, safetySnapshot, type SafetyPublic } from "@/lib/safety-model";

type Command = SafetyCommand extends infer T ? T extends SafetyCommand ? Omit<T, "revision"> : never : never;
type Context = { doc: SafetyPublic; loading: boolean; busy: boolean; error: string; source: boolean; mutate: (command: Command) => Promise<void>; connect: () => Promise<void>; refresh: () => Promise<void> };
const SafetyContext = createContext<Context | null>(null);
export const useSafety = () => useContext(SafetyContext);
export function SafetyProvider({ children }: { children: ReactNode }) {
  const user = useAuthenticatedUser();
  return user ? <OwnedSafetyProvider key={user.id} owner={user.id}>{children}</OwnedSafetyProvider> : children;
}
function OwnedSafetyProvider({ children, owner }: { children: ReactNode; owner: string }) {
  const state = useAppState();
  const [doc, setDoc] = useState<SafetyPublic>(emptySafetyPublic), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const current = useRef(doc), active = useRef(true), locked = useRef(false), blocked = useRef(false), lastSnapshot = useRef("");
  const [localSource, setLocalSource] = useState("");
  const key = `finbridge-safety-source:${encodeURIComponent(owner)}`;
  const snapshot = useMemo(() => { try { return safetySnapshot(state); } catch { return null; } }, [state]);
  const json = JSON.stringify(snapshot);
  const adopt = useCallback((value: SafetyPublic) => { if (active.current && workspaceOwner() === owner) { current.current = value; setDoc(value); } }, [owner]);
  const refresh = useCallback(async () => {
    const response = await fetch("/api/safety", { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("UNAVAILABLE");
    adopt(await response.json());
    if (active.current) setError(previous => ["CONFLICT", "SOURCE_CHANGED"].includes(previous) ? previous : "");
  }, [adopt]);
  useEffect(() => {
    active.current = true;
    void refresh().then(() => { if (active.current) { try { setLocalSource(localStorage.getItem(key) || ""); } catch { /* Read-only without a stored source identity. */ } } }).catch(() => { if (active.current) setError("UNAVAILABLE"); }).finally(() => { if (active.current) setLoading(false); });
    return () => { active.current = false; };
  }, [refresh, key]);
  useEffect(() => {
    const timer = setInterval(() => { if (!locked.current && document.visibilityState === "visible") void refresh().catch(() => {}); }, 60000);
    return () => clearInterval(timer);
  }, [refresh]);
  const mutate = useCallback(async (command: Command) => {
    if (locked.current) throw new Error("BUSY");
    if (workspaceOwner() !== owner) throw new Error("UNAUTHENTICATED");
    locked.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/safety", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...command, revision: current.current.revision }), signal: AbortSignal.timeout(20000) });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 409) { blocked.current = true; await refresh(); }
        throw new Error(body.error || "UNAVAILABLE");
      }
      adopt(body);
      if (command.action === "source" || command.action === "sync") lastSnapshot.current = JSON.stringify(command.snapshot);
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : "UNAVAILABLE"); throw e; }
    finally { locked.current = false; if (active.current) setBusy(false); }
  }, [adopt, owner, refresh]);
  const source = !!localSource && doc.sourceId === localSource;
  const connect = async () => {
    if (!snapshot) throw new Error("INVALID_SNAPSHOT");
    const sourceId = crypto.randomUUID();
    // Persist the source identity before committing consent. Storage failure
    // cannot leave an unidentifiable automatic writer running on this device.
    localStorage.setItem(key, sourceId);
    await mutate({ action: "source", sourceId, snapshot });
    blocked.current = false; setLocalSource(sourceId);
  };
  useEffect(() => {
    if (loading || !source || !snapshot || blocked.current || json === lastSnapshot.current) return;
    const timer = setTimeout(() => { if (!locked.current) void mutate({ action: "sync", sourceId: localSource, snapshot }).catch(() => {}); }, 1500);
    return () => clearTimeout(timer);
  }, [json, snapshot, loading, source, localSource, mutate]);
  useEffect(() => {
    if (!source) return;
    const timer = setInterval(() => {
      if (!locked.current && !blocked.current && snapshot) void mutate({ action: "sync", sourceId: localSource, snapshot }).catch(() => {});
    }, 5 * 60000);
    return () => clearInterval(timer);
  }, [source, snapshot, localSource, mutate]);
  return <SafetyContext.Provider value={{ doc, loading, busy, error, source, mutate, connect, refresh }}>{children}</SafetyContext.Provider>;
}
