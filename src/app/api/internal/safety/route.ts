import { timingSafeEqual } from "node:crypto";
import { database } from "@/lib/database";
import { runSafetyWorker } from "@/lib/safety-worker";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const key = process.env.SAFETY_CRON_SECRET;
  if (!key || key.length < 32) return Response.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  const expected = Buffer.from("Bearer " + key), supplied = Buffer.from(request.headers.get("authorization") || "");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try { return Response.json(await runSafetyWorker(database()), { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "WORKER_UNAVAILABLE" }, { status: 503 }); }
}
