import { z } from "zod";
import { workspaceSchema } from "./workspace-model";
import { WorkspaceError, type WorkspaceRepository } from "./workspace-repository";
const command = z.object({ revision: z.number().int().nonnegative(), mutationId: z.string().uuid(), data: workspaceSchema }).strict();
export async function handleWorkspace(request: Request, owner: string | null, origin: string, repository: WorkspaceRepository) {
  const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
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
    let value: unknown; try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return respond({ error: "INVALID_WORKSPACE" }, 400); }
    const parsed = command.safeParse(value); if (!parsed.success) return respond({ error: "INVALID_WORKSPACE" }, 400);
    return respond(await repository.save(owner, parsed.data as Parameters<WorkspaceRepository["save"]>[1]));
  } catch (e) { return respond({ error: e instanceof WorkspaceError ? e.message : "WORKSPACE_UNAVAILABLE" }, e instanceof WorkspaceError ? e.status : 503); }
}
