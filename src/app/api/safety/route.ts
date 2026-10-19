import { getSession } from "@/lib/auth-session";
import { database } from "@/lib/database";
import { handleSafety, safetyCommand } from "@/lib/safety-handler";
import { createInMemorySafetyRepository, safetyRepository } from "@/lib/safety-repository";
import { safetyEmailAvailable } from "@/lib/safety-mail";

import { isLocalDemoRequest } from "@/lib/local-demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
let demoRepository: ReturnType<typeof createInMemorySafetyRepository> | undefined;

async function handle(request: Request) {
  try {
    const session = await getSession();
    const demo = !session && isLocalDemoRequest(request);
    if (!session && !demo) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    // Database/configuration failures never downgrade an authenticated account.
    const repository = demo ? (demoRepository ??= createInMemorySafetyRepository()) : safetyRepository(database());
    const owner = session?.user.id || "finbridge-local-demo";
    const origin = demo ? new URL(request.url).origin : new URL(process.env.BETTER_AUTH_URL!).origin;
    if (demo && repository.ensureSnapshotTargets && request.method === "POST" && request.headers.get("x-finbridge-workspace-owner") === owner) {
      const parsed = safetyCommand.safeParse(await request.clone().json().catch(() => null));
      if (parsed.success && parsed.data.action === "save") repository.ensureSnapshotTargets(owner, [parsed.data.rule]);
      if (parsed.success && parsed.data.action === "saveGroup") repository.ensureSnapshotTargets(owner, parsed.data.rules);
    }
    return await handleSafety(request, owner, origin, repository, !demo && safetyEmailAvailable());
  } catch {
    return Response.json({ error: "UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
export const GET = handle;
export const POST = handle;
