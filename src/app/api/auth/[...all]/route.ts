import { getAuth } from "@/lib/auth";
import { readAuthConfig } from "@/lib/auth-config";
import { handleAuthRequest } from "@/lib/auth-handler";

export const runtime = "nodejs";
async function handle(request: Request) {
  try {
    const auth = getAuth();
    if (!auth) return Response.json({ code: "AUTH_NOT_CONFIGURED" }, { status: 503 });
    return await handleAuthRequest(auth, request, readAuthConfig()!.baseURL);
  } catch {
    // Never expose connection strings, provider responses or tokens.
    return Response.json({ code: "AUTH_UNAVAILABLE" }, { status: 503 });
  }
}
export { handle as GET, handle as POST };