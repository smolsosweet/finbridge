export const RECENT_LOGIN_MS = 5 * 60 * 1000;

type Session = { user: { id: string }; session: { createdAt: Date | string } };

type Dependencies = {
  baseURL: string;
  secret: string;
  getSession: (headers: Headers) => Promise<Session | null>;
  deactivate: (input: { userId: string; secret: string }) => Promise<void>;
};

/** Security boundary for the irreversible user-facing "close account" action. */
export async function handleAccountDeactivation(request: Request, dependencies: Dependencies) {
  if (request.headers.get("origin") !== dependencies.baseURL) return Response.json({ code: "UNTRUSTED_ORIGIN" }, { status: 403 });
  try {
    const session = await dependencies.getSession(request.headers);
    if (!session) return Response.json({ code: "UNAUTHENTICATED" }, { status: 401 });
    const createdAt = new Date(session.session.createdAt).getTime();
    if (!Number.isFinite(createdAt) || Date.now() - createdAt >= RECENT_LOGIN_MS) {
      return Response.json({ code: "RECENT_LOGIN_REQUIRED" }, { status: 403 });
    }
    // The user id is read solely from the signed server session. Never accept it
    // from the request body, which would permit closing another user's account.
    await dependencies.deactivate({ userId: session.user.id, secret: dependencies.secret });
    return Response.json({ success: true });
  } catch {
    return Response.json({ code: "DEACTIVATION_FAILED" }, { status: 500 });
  }
}
