import { estimateInputSchema, ReferenceError } from "./reference-rates";
import type { ReferenceRepository } from "./transfer-reference-repository";

export async function handleTransferReference(request: Request, owner: string | null, origin: string, repository: ReferenceRepository) {
  const respond = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
  if (!owner) return respond({ error: "UNAUTHENTICATED" }, 401);
  if (request.method !== "GET" && request.method !== "POST") return respond({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (request.headers.get("x-finbridge-workspace-owner") !== owner) return respond({ error: "WORKSPACE_OWNER_CHANGED" }, 409);
  if (request.method === "POST" && request.headers.get("origin") !== origin) return respond({ error: "INVALID_ORIGIN" }, 403);
  try {
    if (request.method === "GET") return respond(await repository.read(owner));
    if (!request.headers.get("content-type")?.startsWith("application/json")) return respond({ error: "INVALID_COMMAND" }, 400);
    const reader = request.body?.getReader(); if (!reader) return respond({ error: "INVALID_COMMAND" }, 400);
    let size = 0; const chunks: Uint8Array[] = [];
    try {
      for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 2048) { await reader.cancel(); return respond({ error: "PAYLOAD_TOO_LARGE" }, 413); } chunks.push(value); }
    } finally { reader.releaseLock(); }
    let decoded: unknown;
    try { decoded = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return respond({ error: "INVALID_COMMAND" }, 400); }
    const input = estimateInputSchema.safeParse(decoded);
    if (!input.success) return respond({ error: "INVALID_COMMAND" }, 400);
    return respond(await repository.estimate(owner, input.data));
  } catch (error) { return error instanceof ReferenceError ? respond({ error: error.code }, error.status) : respond({ error: "UNAVAILABLE" }, 503); }
}
