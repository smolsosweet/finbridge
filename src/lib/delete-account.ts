"use client";
import { authClient } from "./auth-client";
import { clearUserWorkspace, workspaceOwner } from "@/components/sites/rolly/replica/store";
import { userWorkspaceKey } from "./workspace-storage";

export async function deleteAccount(userId: string, password?: string) {
  if (!userId || workspaceOwner() !== userId) throw new Error("DELETE_ACCOUNT_FAILED");
  // The server selects the account from its authenticated session; no target ID is submitted.
  const result = await authClient.deleteUser(password ? { password } : {});
  if (result.error) throw new Error(result.error.code || "DELETE_ACCOUNT_FAILED");
  if (!result.data?.success || result.data.message !== "User deleted") throw new Error("DELETE_ACCOUNT_FAILED");
  for (const key of [userWorkspaceKey(userId), "finbridge-setup-draft:" + encodeURIComponent(userId)]) {
    try { localStorage.removeItem(key); } catch { /* Server deletion succeeded even if browser storage is unavailable. */ }
  }
  clearUserWorkspace(userId);
}
