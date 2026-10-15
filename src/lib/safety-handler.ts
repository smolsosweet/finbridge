import { z } from "zod";
import { evaluateSafety, publicSafety, safetyRuleSchema, safetySnapshotSchema } from "./safety-model";
import { SafetyError, type SafetyRepository } from "./safety-repository";

export const safetyCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), revision: z.number().int().nonnegative(), rule: safetyRuleSchema }).strict(),
  z.object({ action: z.literal("archive"), revision: z.number().int().nonnegative(), id: z.string().min(1).max(100) }).strict(),
  z.object({ action: z.literal("sync"), revision: z.number().int().nonnegative(), sourceId: z.string().uuid(), snapshot: safetySnapshotSchema }).strict(),
  z.object({ action: z.literal("source"), revision: z.number().int().nonnegative(), sourceId: z.string().uuid(), snapshot: safetySnapshotSchema }).strict(),
  z.object({ action: z.literal("read"), revision: z.number().int().nonnegative() }).strict(),
]);
export type SafetyCommand = z.infer<typeof safetyCommand>;
export async function handleSafety(request: Request, userId: string | null, origin: string, repo: SafetyRepository, emailAvailable: boolean) {
  const respond = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
  if (!userId) return respond({ error: "UNAUTHENTICATED" }, 401);
  if (request.method !== "GET" && request.headers.get("origin") !== origin) return respond({ error: "INVALID_ORIGIN" }, 403);
  try {
    if (request.method === "GET") return respond(publicSafety(await repo.read(userId), emailAvailable));
    if (request.method !== "POST") return respond({ error: "METHOD_NOT_ALLOWED" }, 405);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return respond({ error: "INVALID_COMMAND" }, 400);
    const reader = request.body?.getReader(); if (!reader) return respond({ error: "INVALID_COMMAND" }, 400);
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 4_000_000) { await reader.cancel(); return respond({ error: "PAYLOAD_TOO_LARGE" }, 413); } chunks.push(value); }
    let decoded: unknown; try { decoded = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return respond({ error: "INVALID_COMMAND" }, 400); }
    const parsed = safetyCommand.safeParse(decoded); if (!parsed.success) return respond({ error: "INVALID_COMMAND" }, 400);
    const command = parsed.data;
    const doc = await repo.mutate(userId, command.revision, command.action, doc => {
      if (command.action === "sync" || command.action === "source") {
        if (command.action === "sync" && doc.sourceId !== command.sourceId) throw new SafetyError("SOURCE_CHANGED");
        doc.sourceId = command.sourceId; doc.snapshot = command.snapshot; doc.syncedAt = new Date().toISOString();
      } else if (command.action === "save") {
        if (!doc.snapshot) throw new SafetyError("SOURCE_REQUIRED", 400);
        const r = command.rule;
        if (r.active && r.email && !emailAvailable) throw new SafetyError("EMAIL_UNAVAILABLE", 400);
        const target = r.kind === "budget" ? doc.snapshot.budgets.find(b => b.id === r.targetId && doc.snapshot!.wallets.some(w => w.id === b.wallet && !w.archived && w.currency === b.currency)) : doc.snapshot.wallets.find(w => w.id === r.targetId && !w.archived);
        if (!target) throw new SafetyError("INVALID_TARGET", 400);
        const scale = 10 ** (new Intl.NumberFormat("en", { style: "currency", currency: target.currency }).resolvedOptions().maximumFractionDigits ?? 2);
        if (r.unit === "amount" && Math.abs(r.threshold * scale - Math.round(r.threshold * scale)) > 1e-6) throw new SafetyError("INVALID_COMMAND", 400);
        if (!doc.rules.some(old => old.id === r.id) && doc.rules.length >= 50) throw new SafetyError("RULE_LIMIT", 400);
        if (doc.rules.some(old => old.id !== r.id && old.active && r.active && old.kind === r.kind && old.targetId === r.targetId && old.basis === r.basis && evaluateSafety(old, doc.snapshot!).limit === evaluateSafety(r, doc.snapshot!).limit)) throw new SafetyError("DUPLICATE_RULE", 400);
        const old = doc.rules.find(old => old.id === r.id);
        if (old && ["kind", "targetId", "basis", "unit", "threshold"].some(key => old[key as keyof typeof old] !== r[key as keyof typeof r])) delete doc.episodes[r.id];
        doc.rules = [...doc.rules.filter(old => old.id !== r.id), r];
      } else if (command.action === "archive") {
        // Keep the rule and its history; archiving never deletes financial records.
        doc.rules = doc.rules.map(r => r.id === command.id ? { ...r, active: false, email: false } : r);
      }
      return doc;
    });
    return respond(publicSafety(doc, emailAvailable));
  } catch (error) {
    return error instanceof SafetyError ? respond({ error: error.code }, error.status) : respond({ error: "UNAVAILABLE" }, 503);
  }
}
