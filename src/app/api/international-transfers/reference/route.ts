import { getSession } from "@/lib/auth-session";
import { database } from "@/lib/database";
import { handleTransferReference } from "@/lib/transfer-reference-handler";
import { createInMemoryReferenceRepository, transferReferenceRepository } from "@/lib/transfer-reference-repository";

import { isLocalDemoRequest } from "@/lib/local-demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
let demoRepository: ReturnType<typeof createInMemoryReferenceRepository> | undefined;

async function handle(request: Request) {
  try {
    const session = await getSession();
    const demo = !session && isLocalDemoRequest(request);
    if (!session && !demo) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    // Database/configuration failures never downgrade an authenticated account.
    const repository = demo ? (demoRepository ??= createInMemoryReferenceRepository()) : transferReferenceRepository(database());
    const owner = session?.user.id || "finbridge-local-demo";
    const origin = demo ? new URL(request.url).origin : new URL(process.env.BETTER_AUTH_URL!).origin;
    return await handleTransferReference(request, owner, origin, repository);
  } catch {
    return Response.json({ error: "UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
export const GET = handle;
export const POST = handle;
