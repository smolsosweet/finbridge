import { pathToFileURL } from "node:url";

export async function invokeSafetyScheduler(env = process.env, transport = fetch) {
  const url = new URL(env.FINBRIDGE_BASE_URL || "");
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw Error("SCHEDULER_REQUIRES_CANONICAL_HTTPS_ORIGIN");
  if ((env.SAFETY_CRON_SECRET?.length || 0) < 32) throw Error("SCHEDULER_SECRET_NOT_CONFIGURED");
  const response = await transport(new URL("/api/internal/safety", url), { method: "POST", redirect: "error", signal: AbortSignal.timeout(175_000), headers: { authorization: "Bearer " + env.SAFETY_CRON_SECRET } });
  if (!response.ok) throw Error("SCHEDULER_HTTP_" + response.status);
  const body = await response.json(), counts = {};
  for (const key of ["evaluated", "accepted", "cancelled", "failed", "unknown", "retried"]) {
    if (!Number.isSafeInteger(body[key]) || body[key] < 0) throw Error("SCHEDULER_INVALID_RESPONSE");
    counts[key] = body[key];
  }
  if (counts.failed || counts.unknown) throw Error("SCHEDULER_DELIVERY_REQUIRES_REVIEW");
  return { ...counts, busy: body.busy === true };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await invokeSafetyScheduler())); }
  catch (error) { console.error(error instanceof Error && /^SCHEDULER_/.test(error.message) ? error.message : "SCHEDULER_FAILED"); process.exitCode = 1; }
}
