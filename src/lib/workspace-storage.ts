import type { AppState } from "@/components/sites/rolly/replica/store";

export const LEGACY_WORKSPACE_KEY = "rolly-replica-v2";
export function userWorkspaceKey(userId: string) {
  if (!userId.trim()) throw new Error("An authenticated user ID is required.");
  return "finbridge-workspace-v1:" + encodeURIComponent(userId);
}
function parseWorkspace(value: string | null): AppState | null {
  try {
    const data = JSON.parse(value || "null") as AppState | null;
    return data && Array.isArray(data.wallets) && data.wallets.length && Array.isArray(data.transactions) && data.settings ? data : null;
  } catch { return null; }
}
export function readUserWorkspace(storage: Pick<Storage, "getItem">, userId: string) {
  return parseWorkspace(storage.getItem(userWorkspaceKey(userId)));
}
export function legacyWorkspaceBackup(storage: Pick<Storage, "getItem">) {
  const raw = storage.getItem(LEGACY_WORKSPACE_KEY);
  return parseWorkspace(raw) ? raw : null;
}
export function canImportLegacyWorkspace(storage: Pick<Storage, "getItem">, userId: string) {
  return !storage.getItem(userWorkspaceKey(userId)) && !!legacyWorkspaceBackup(storage);
}
export function importLegacyWorkspace(storage: Pick<Storage, "getItem" | "setItem">, userId: string, explicitlyConfirmed: boolean) {
  if (!explicitlyConfirmed) throw new Error("Explicit import confirmation required.");
  if (storage.getItem(userWorkspaceKey(userId))) throw new Error("Existing user data must not be overwritten.");
  const raw = legacyWorkspaceBackup(storage);
  if (!raw) throw new Error("No valid legacy workspace.");
  storage.setItem(userWorkspaceKey(userId), raw);
  // The legacy record remains byte-for-byte intact for recovery and export.
}