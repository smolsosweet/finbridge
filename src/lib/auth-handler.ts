import type { getAuth } from "./auth";

export async function handleAuthRequest(auth: NonNullable<ReturnType<typeof getAuth>>, request: Request, trustedOrigin: string) {
  // OAuth starts and logout are POSTs initiated by this app. A Google callback
  // uses GET with state + PKCE; it does not need a same-origin Origin header.
  if (request.method === "POST" && request.headers.get("origin") !== trustedOrigin) {
    return Response.json({ code: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }
  return auth.handler(request);
}