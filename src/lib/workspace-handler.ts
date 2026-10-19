import { z } from "zod";
import { workspaceSchema } from "./workspace-model";
import { WorkspaceError, type WorkspaceRepository } from "./workspace-repository";
import { gzipSync, gunzipSync } from "node:zlib";
import { randomUUID } from "node:crypto";
const command = z.object({ revision: z.number().int().nonnegative(), mutationId: z.string().uuid(), data: workspaceSchema }).strict();
export async function handleWorkspace(request: Request, owner: string | null, origin: string, repository: WorkspaceRepository) {
  const started = performance.now(), requestId = randomUUID();
  const respond = (body: unknown, status = 200) => {
    const durationMs = Math.round(performance.now() - started);
    const headers: Record<string, string> = { "Cache-Control": "no-store", "Content-Type": "application/json", "X-FinBridge-Request-Id": requestId, "Server-Timing": `workspace;dur=${durationMs}` };
    console.info("[FinBridge workspace] request", { requestId, method: request.method, status, durationMs, ...(status >= 400 && body && typeof body === "object" && "error" in body ? { code: body.error } : {}) });
    const json = JSON.stringify(body);
    if (request.headers.get("x-finbridge-compression") === "gzip" && Buffer.byteLength(json) > 32000) {
      headers["Content-Encoding"] = "gzip"; headers.Vary = "X-FinBridge-Compression";
      return new Response(new Uint8Array(gzipSync(json)), { status, headers });
    }
    return new Response(json, { status, headers });
  };
  if (!owner) return respond({ error: "UNAUTHENTICATED" }, 401);
  if (request.method !== "GET" && request.headers.get("origin") !== origin) return respond({ error: "INVALID_ORIGIN" }, 403);
  // A tab opened under a previous login must never load or write the new account.
  // This header is a consistency check; only the server session grants authority.
  if (request.headers.get("x-finbridge-workspace-owner") !== owner) return respond({ error: "ACCOUNT_CHANGED" }, 409);
  try {
    if (request.method === "GET") return respond(await repository.read(owner));
    if (request.method !== "POST" || !request.headers.get("content-type")?.startsWith("application/json")) return respond({ error: "INVALID_WORKSPACE" }, 400);
    const reader = request.body?.getReader(); if (!reader) return respond({ error: "INVALID_WORKSPACE" }, 400);
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 12_000_000) { await reader.cancel(); return respond({ error: "PAYLOAD_TOO_LARGE" }, 413); } chunks.push(value); }
    let buffer = Buffer.concat(chunks);
    const encoding = request.headers.get("content-encoding");
    if (encoding && encoding !== "gzip" && encoding !== "identity") return respond({ error: "UNSUPPORTED_ENCODING" }, 415);
    if (encoding === "gzip") {
      try { buffer = gunzipSync(buffer, { maxOutputLength: 12000000 }); }
      catch (error) { return respond({ error: error && typeof error === "object" && "code" in error && error.code === "ERR_BUFFER_TOO_LARGE" ? "PAYLOAD_TOO_LARGE" : "INVALID_WORKSPACE" }, error && typeof error === "object" && "code" in error && error.code === "ERR_BUFFER_TOO_LARGE" ? 413 : 400); }
    }
    let value: unknown; try { value = JSON.parse(buffer.toString("utf8")); } catch { return respond({ error: "INVALID_WORKSPACE" }, 400); }
    const parsed = command.safeParse(value); if (!parsed.success) return respond({ error: "INVALID_WORKSPACE" }, 400);
    const saved = await repository.save(owner, parsed.data as Parameters<WorkspaceRepository["save"]>[1]);
    return respond(request.headers.get("x-finbridge-save-ack") === "1" ? { revision: saved.revision, updatedAt: saved.updatedAt, data: null } : saved);
  } catch (e) {
    console.error("[FinBridge workspace] failure", { requestId, name: e instanceof Error ? e.name : "UnknownError", ...(e && typeof e === "object" && "code" in e && typeof e.code === "string" && /^[A-Z0-9]{5}$/.test(e.code) ? { databaseCode: e.code } : {}) });
    return respond({ error: e instanceof WorkspaceError ? e.message : "WORKSPACE_UNAVAILABLE" }, e instanceof WorkspaceError ? e.status : 503);
  }
}
