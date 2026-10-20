import { timingSafeEqual } from "node:crypto";
import type { Pool } from "pg";
import { runSafetyWorker } from "./safety-worker";

export async function handleSafetyCron(request: Request, pool: () => Pool, worker = runSafetyWorker, env: NodeJS.ProcessEnv = process.env) {
  const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  const key = env.SAFETY_CRON_SECRET;
  if (!key || key.length < 32) return response({ error: "NOT_CONFIGURED" }, 503);
  const expected = Buffer.from("Bearer " + key), supplied = Buffer.from(request.headers.get("authorization") || "");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return response({ error: "UNAUTHORIZED" }, 401);
  try {
    const result = await worker(pool());
    if ("busy" in result && result.busy) {
      const busy = response({ ...result, error: "WORKER_BUSY" }, 503);
      busy.headers.set("Retry-After", "60");
      return busy;
    }
    return response(result);
  }
  catch { return response({ error: "WORKER_UNAVAILABLE" }, 503); }
}
