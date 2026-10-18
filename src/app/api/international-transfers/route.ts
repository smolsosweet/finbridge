import { getSession } from "@/lib/auth-session";
import { database } from "@/lib/database";
import { handleInternationalTransfer } from "@/lib/international-transfer-handler";
import { internationalTransferRepository } from "@/lib/international-transfer-repository";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return handleInternationalTransfer(request, session.user.id, new URL(process.env.BETTER_AUTH_URL!).origin, internationalTransferRepository(database()));
}
export const GET = handle;
export const POST = handle;
