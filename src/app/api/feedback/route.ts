import { getSession } from "@/lib/auth-session";
import { database } from "@/lib/database";
import { handleFeedback } from "@/lib/feedback-handler";
import { feedbackRepository } from "@/lib/feedback-repository";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    return await handleFeedback(request, session.user.id, new URL(process.env.BETTER_AUTH_URL!).origin, feedbackRepository(database()));
  } catch {
    return Response.json({ error: "FEEDBACK_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
