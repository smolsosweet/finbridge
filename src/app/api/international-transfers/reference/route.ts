import { getSession } from "@/lib/auth-session";
import { database } from "@/lib/database";
import { handleTransferReference } from "@/lib/transfer-reference-handler";
import { createInMemoryReferenceRepository, transferReferenceRepository } from "@/lib/transfer-reference-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function localDemo(request: Request) {
  if (process.env.NODE_ENV !== "development" || process.env.FINBRIDGE_DEMO_MODE !== "true") return false;
  const host = request.headers.get("host")?.split(":")[0];
  const origin = request.headers.get("origin");
  try {
    return (host === "localhost" || host === "127.0.0.1") && (!origin || new URL(origin).host === request.headers.get("host"));
  } catch {
    return false;
  }
}

let inMemoryRepo: ReturnType<typeof createInMemoryReferenceRepository> | null = null;
function getRepository() {
  try {
    return transferReferenceRepository(database());
  } catch {
    return (inMemoryRepo ??= createInMemoryReferenceRepository());
  }
}

async function handle(request: Request) {
  const session = await getSession();
  const isDemo = !session && localDemo(request);
  if (!session && !isDemo) {
    return Response.json({ error: "UNAUTHENTICATED" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const owner = session?.user.id || "finbridge-local-demo";
  const origin = process.env.BETTER_AUTH_URL
    ? new URL(process.env.BETTER_AUTH_URL).origin
    : request.headers.get("origin") || (request.headers.get("host") ? `http://${request.headers.get("host")}` : "http://localhost:3000");

  return handleTransferReference(request, owner, origin, getRepository());
}

export const GET = handle;
export const POST = handle;
