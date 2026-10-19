import { getSession } from "@/lib/auth-session";

/** Provider access always requires a real account, including local demo mode. */
export async function requireAiSession(request: Request) {
  let expectedOrigin: string;
  try { expectedOrigin = new URL(process.env.BETTER_AUTH_URL || request.url).origin; }
  catch { return Response.json({ error: "INVALID_ORIGIN" }, { status: 403 }); }
  if (request.headers.get("origin") !== expectedOrigin) return Response.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const session = await getSession();
  if (!session || !session.user.emailVerified) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const owner = request.headers.get("x-finbridge-workspace-owner");
  if (owner && owner !== session.user.id) return Response.json({ error: "ACCOUNT_CHANGED" }, { status: 409 });
  return session;
}
