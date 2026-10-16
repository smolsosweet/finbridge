import { z } from "zod";
import { evaluateSafety, publicSafety, safetyRuleSchema } from "./safety-model";
import { SafetyError, type SafetyRepository } from "./safety-repository";

export const safetyCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), revision: z.number().int().nonnegative(), rule: safetyRuleSchema }).strict(),
  z.object({ action: z.literal("saveGroup"), revision: z.number().int().nonnegative(), groupId: z.string().uuid(), replaceIds: z.array(z.string().min(1).max(100)).max(10).optional(), rules: z.array(safetyRuleSchema).min(1).max(10) }).strict(),
  z.object({ action: z.literal("archive"), revision: z.number().int().nonnegative(), id: z.string().min(1).max(100) }).strict(),
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
      if (command.action === "save" || command.action === "saveGroup") {
        if (!doc.snapshot) throw new SafetyError("SOURCE_REQUIRED", 400);
        const rules = command.action === "save" ? [command.rule] : command.rules;
        const group = rules[0];
        if (command.action === "saveGroup" && (new Set(rules.map(r => r.id)).size !== rules.length || rules.some(r => r.groupId !== command.groupId || r.kind !== group.kind || r.targetId !== group.targetId || r.name !== group.name || r.email !== group.email || r.active !== group.active))) throw new SafetyError("INVALID_COMMAND", 400);
        if (command.action === "saveGroup" && command.replaceIds?.some(id => !doc.rules.some(r => r.id === id && (!r.groupId || r.groupId === command.groupId)))) throw new SafetyError("INVALID_COMMAND", 400);
        const retained = command.action === "saveGroup" ? doc.rules.map(old => (old.groupId === command.groupId || command.replaceIds?.includes(old.id)) && !rules.some(r => r.id === old.id) ? { ...old, active: false, email: false, archived: true } : old) : doc.rules;
        for (const r of rules) {
        if (r.active && r.email && !emailAvailable) throw new SafetyError("EMAIL_UNAVAILABLE", 400);
        const target = r.kind === "budget" ? doc.snapshot.budgets.find(b => b.id === r.targetId && doc.snapshot!.wallets.some(w => w.id === b.wallet && !w.archived && w.currency === b.currency)) : doc.snapshot.wallets.find(w => w.id === r.targetId && !w.archived);
        if (!target) throw new SafetyError("INVALID_TARGET", 400);
        const scale = 10 ** (new Intl.NumberFormat("en", { style: "currency", currency: target.currency }).resolvedOptions().maximumFractionDigits ?? 2);
        if (r.unit === "amount" && Math.abs(r.threshold * scale - Math.round(r.threshold * scale)) > 1e-6) throw new SafetyError("INVALID_COMMAND", 400);
        if (retained.some(old => old.id !== r.id && !rules.some(row => row.id === old.id) && old.active && r.active && old.kind === r.kind && old.targetId === r.targetId && old.basis === r.basis && evaluateSafety(old, doc.snapshot!).limit === evaluateSafety(r, doc.snapshot!).limit)) throw new SafetyError("DUPLICATE_RULE", 400);
        const old = doc.rules.find(old => old.id === r.id);
        if (old && ["kind", "targetId", "basis", "unit", "threshold"].some(key => old[key as keyof typeof old] !== r[key as keyof typeof r])) delete doc.episodes[r.id];
        }
        if (rules.some((r, i) => rules.slice(i + 1).some(other => other.basis === r.basis && evaluateSafety(other, doc.snapshot!).limit === evaluateSafety(r, doc.snapshot!).limit))) throw new SafetyError("DUPLICATE_RULE", 400);
        doc.rules = [...retained.filter(old => !rules.some(r => r.id === old.id)), ...rules.map(r => ({ ...r, archived: false }))];
        if (doc.rules.filter(r => !r.archived).length > 50) throw new SafetyError("RULE_LIMIT", 400);
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
