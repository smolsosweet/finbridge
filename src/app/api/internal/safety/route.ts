import { database } from "@/lib/database";
import { handleSafetyCron } from "@/lib/safety-cron";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
export async function POST(request: Request) {
  return handleSafetyCron(request, database);
}
