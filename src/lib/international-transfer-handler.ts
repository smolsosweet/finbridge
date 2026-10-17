import { transferCommandSchema, TransferError } from "./international-transfer";
import type { TransferRepository } from "./international-transfer-repository";
export async function handleInternationalTransfer(request: Request, owner: string | null, origin: string, repo: TransferRepository) {
  const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!owner) return respond({ error: "UNAUTHENTICATED" }, 401);
  if (request.method !== "GET" && request.method !== "POST") return respond({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (request.method === "POST" && request.headers.get("origin") !== origin) return respond({ error: "INVALID_ORIGIN" }, 403);
  if (request.headers.get("x-finbridge-workspace-owner") !== owner) return respond({ error: "WORKSPACE_OWNER_CHANGED" }, 409);
  try {
    if (request.method === "GET") return respond(await repo.read(owner));
    if (!request.headers.get("content-type")?.startsWith("application/json")) return respond({ error: "INVALID_COMMAND" }, 400);
    const reader = request.body?.getReader(); if (!reader) return respond({ error: "INVALID_COMMAND" }, 400);
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 8192) { await reader.cancel(); return respond({ error: "PAYLOAD_TOO_LARGE" }, 413); } chunks.push(value); }
    let decoded: unknown; try { decoded = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return respond({ error: "INVALID_COMMAND" }, 400); }
    const parsed = transferCommandSchema.safeParse(decoded); if (!parsed.success) return respond({ error: "INVALID_COMMAND" }, 400);
    return respond(await repo.mutate(owner, parsed.data));
  } catch (e) { return e instanceof TransferError ? respond({ error: e.code }, e.status) : respond({ error: "UNAVAILABLE" }, 503); }
}
