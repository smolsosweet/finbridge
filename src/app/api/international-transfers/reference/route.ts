import { getSession } from "@/lib/auth-session";
import { handleTransferReference } from "@/lib/transfer-reference-handler";
import { transferServices } from "@/lib/transfer-services";

import { isLocalDemoRequest } from "@/lib/local-demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  try {
    const session = await getSession();
    const demo = !session && isLocalDemoRequest(request);
    if (!session && !demo) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    // Database/configuration failures never downgrade an authenticated account.
    const repository = transferServices(demo).references();
    const owner = session?.user.id || "finbridge-local-demo";
    const origin = demo ? new URL(request.url).origin : new URL(process.env.BETTER_AUTH_URL!).origin;
    return await handleTransferReference(request, owner, origin, repository);
  } catch {
    return Response.json({ error: "UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
export const GET = handle;
export const POST = handle;
