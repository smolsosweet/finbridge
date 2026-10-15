import { getSession } from "@/lib/auth-session";
import { database } from "@/lib/database";
import { handleSafety } from "@/lib/safety-handler";
import { safetyRepository } from "@/lib/safety-repository";
import { safetyEmailAvailable } from "@/lib/safety-mail";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  return handleSafety(request, session.user.id, new URL(process.env.BETTER_AUTH_URL!).origin, safetyRepository(database()), safetyEmailAvailable());
}
export const GET = handle;
export const POST = handle;
