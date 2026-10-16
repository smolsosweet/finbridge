"use client";
import { authClient } from "./auth-client";
import { clearUserWorkspace, flushWorkspace, workspaceOwner } from "@/components/sites/rolly/replica/store";
import { userWorkspaceKey } from "./workspace-storage";

export async function deactivateAccount(userId: string) {
  if (!userId || workspaceOwner() !== userId) throw new Error("DEACTIVATION_FAILED");
  await flushWorkspace();
  const response = await fetch("/api/account/deactivate", { method: "POST", headers: { "content-type": "application/json" }, body: "{}", credentials: "same-origin" });
  const result = await response.json().catch(() => ({})) as { code?: string; success?: boolean };
  if (!response.ok || !result.success) throw new Error(result.code || "DEACTIVATION_FAILED");
  try { await authClient.signOut(); } catch { /* The server already revoked every session. */ }
  for (const key of [userWorkspaceKey(userId), "finbridge-setup-draft:" + encodeURIComponent(userId)]) {
    try { localStorage.removeItem(key); } catch { /* Browser storage may be unavailable. */ }
  }
  clearUserWorkspace(userId);
}
