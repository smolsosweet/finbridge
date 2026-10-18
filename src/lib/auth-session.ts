import "server-only";
import { headers } from "next/headers";
import { getAuth } from "./auth";

export async function getSession() {
  const requestHeaders = await headers();
  let auth;
  try { auth = getAuth(); } catch { return null; }
  if (!auth) return null;
  try { return await auth.api.getSession({ headers: requestHeaders }); }
  catch { console.warn("AUTH_SESSION_UNAVAILABLE"); return null; }
}
