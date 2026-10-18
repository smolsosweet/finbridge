import { getSession } from "@/lib/auth-session";
import { database } from "@/lib/database";
import { handleTransferReference } from "@/lib/transfer-reference-handler";
import { transferReferenceRepository } from "@/lib/transfer-reference-repository";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return handleTransferReference(request, session.user.id, new URL(process.env.BETTER_AUTH_URL!).origin, transferReferenceRepository(database()));
}
export const GET = handle;
export const POST = handle;
