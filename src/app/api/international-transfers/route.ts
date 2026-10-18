import { getSession } from "@/lib/auth-session";
import { database } from "@/lib/database";
import { handleInternationalTransfer } from "@/lib/international-transfer-handler";
import { createInMemoryTransferRepository, internationalTransferRepository } from "@/lib/international-transfer-repository";

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

let inMemoryRepo: ReturnType<typeof createInMemoryTransferRepository> | null = null;
function getRepository() {
  try {
    return internationalTransferRepository(database());
  } catch {
    return (inMemoryRepo ??= createInMemoryTransferRepository());
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

  return handleInternationalTransfer(request, owner, origin, getRepository());
}

export const GET = handle;
export const POST = handle;
