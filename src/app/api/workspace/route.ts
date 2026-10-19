import { getSession } from "@/lib/auth-session";
import { database } from "@/lib/database";
import { workspaceRepository } from "@/lib/workspace-repository";
import { handleWorkspace } from "@/lib/workspace-handler";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  const started = performance.now();
  try {
    const session = await getSession();
    const authMs = Math.round(performance.now() - started);
    if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    const response = await handleWorkspace(request, session.user.id, new URL(process.env.BETTER_AUTH_URL!).origin, workspaceRepository(database()));
    const totalMs = Math.round(performance.now() - started);
    response.headers.append("Server-Timing", `auth;dur=${authMs}, total;dur=${totalMs}`);
    console.info("[FinBridge workspace] total", { requestId: response.headers.get("x-finbridge-request-id"), status: response.status, authMs, totalMs });
    return response;
  } catch (error) {
    console.error("[FinBridge workspace] initialization failed", { name: error instanceof Error ? error.name : "UnknownError", durationMs: Math.round(performance.now() - started) });
    return Response.json({ error: "WORKSPACE_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
export const GET = handle;
export const POST = handle;
