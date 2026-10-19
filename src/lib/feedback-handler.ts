import { feedbackSchema, FeedbackError } from "./feedback";
import type { FeedbackRepository } from "./feedback-repository";
export async function handleFeedback(request: Request, owner: string | null, origin: string, repository: FeedbackRepository) {
  const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!owner) return respond({ error: "UNAUTHENTICATED" }, 401);
  if (request.method !== "POST") return respond({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (request.headers.get("origin") !== origin) return respond({ error: "INVALID_ORIGIN" }, 403);
  if (request.headers.get("x-finbridge-workspace-owner") !== owner) return respond({ error: "ACCOUNT_CHANGED" }, 409);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return respond({ error: "INVALID_FEEDBACK" }, 400);
  try {
    const reader = request.body?.getReader(); if (!reader) return respond({ error: "INVALID_FEEDBACK" }, 400);
    let size = 0; const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        size += value.length;
        if (size > 16384) { await reader.cancel(); return respond({ error: "PAYLOAD_TOO_LARGE" }, 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    let body: unknown;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return respond({ error: "INVALID_FEEDBACK" }, 400); }
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) return respond({ error: "INVALID_FEEDBACK" }, 400);
    return respond({ receipt: await repository.submit(owner, parsed.data) });
  } catch (error) {
    return error instanceof FeedbackError ? respond({ error: error.code }, error.status) : respond({ error: "FEEDBACK_UNAVAILABLE" }, 503);
  }
}
