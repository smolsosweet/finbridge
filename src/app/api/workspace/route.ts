import { getSession } from "@/lib/auth-session";
import { database } from "@/lib/database";
import { workspaceRepository } from "@/lib/workspace-repository";
import { handleWorkspace } from "@/lib/workspace-handler";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  return handleWorkspace(request, session.user.id, new URL(process.env.BETTER_AUTH_URL!).origin, workspaceRepository(database()));
}
export const GET = handle;
export const POST = handle;
