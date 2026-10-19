"use client";
import { authClient } from "./auth-client";
import { clearUserWorkspace, flushWorkspace } from "@/components/finbridge/workspace/store";
export async function signOutGoogle() {
  await flushWorkspace();
  const result = await authClient.signOut();
  if (result.error) throw new Error("SIGN_OUT_FAILED");
  clearUserWorkspace();

}
