import { getSession } from "@/lib/auth-session";
import { getOnboarding, saveOnboarding } from "@/lib/onboarding-server";
import { handleOnboarding } from "@/lib/onboarding-handler";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  const session = await getSession();
  return handleOnboarding(request, session?.user.id || null, process.env.BETTER_AUTH_URL || request.url, { read: getOnboarding, complete: saveOnboarding });
}
export const GET = handle;
export const POST = handle;
