import { getSession } from "@/lib/auth-session";
import { database } from "@/lib/database";
import { handleSafety } from "@/lib/safety-handler";
import { createInMemorySafetyRepository, safetyRepository } from "@/lib/safety-repository";
import { safetyEmailAvailable } from "@/lib/safety-mail";

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

let inMemoryRepo: ReturnType<typeof createInMemorySafetyRepository> | null = null;
function getRepository() {
  try {
    return safetyRepository(database());
  } catch {
    return (inMemoryRepo ??= createInMemorySafetyRepository());
  }
}

async function handle(request: Request) {
  const session = await getSession();
  const isDemo = !session && localDemo(request);
  if (!session && !isDemo) {
    return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const userId = session?.user.id || "finbridge-local-demo";
  const origin = process.env.BETTER_AUTH_URL
    ? new URL(process.env.BETTER_AUTH_URL).origin
    : request.headers.get("origin") || (request.headers.get("host") ? `http://${request.headers.get("host")}` : "http://localhost:3000");

  const repo = getRepository();

  if (isDemo && repo.ensureSnapshotTargets && request.method === "POST") {
    try {
      const cloned = await request.clone().json();
      if (cloned && typeof cloned === "object") {
        const payload = cloned as { action?: string; rule?: any; rules?: any[] };
        if (payload.action === "save" && payload.rule) {
          repo.ensureSnapshotTargets(userId, [payload.rule]);
        } else if (payload.action === "saveGroup" && Array.isArray(payload.rules)) {
          repo.ensureSnapshotTargets(userId, payload.rules);
        }
      }
    } catch {
      // Body will be parsed and validated by handleSafety
    }
  }

  return handleSafety(request, userId, origin, repo, safetyEmailAvailable());
}

export const GET = handle;
export const POST = handle;
