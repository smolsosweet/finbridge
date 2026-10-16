import type { Pool, PoolClient } from "pg";
import { advanceSafety, emptySafetyDocument, type SafetyDocument, type SafetyEvent } from "./safety-model";
import { safetySnapshot } from "./safety-model";
import { readFinanceTables, writeAlertRules } from "./finance-tables";
import type { AppState } from "../components/sites/rolly/replica/store";

export async function safetyWorkspace(client: PoolClient, userId: string) {
  const rows = await client.query("SELECT data,updated_at FROM finbridge_workspaces WHERE user_id=$1 FOR SHARE", [userId]);
  if (!rows.rows[0]?.data) return null;
  const data = await readFinanceTables(client, userId, rows.rows[0].data);
  return { data, updatedAt: rows.rows[0].updated_at };
}
export function databaseSafety(doc: SafetyDocument, state: AppState, updatedAt: Date) {
  try { doc.snapshot = safetySnapshot(state, String(state.settings.timeZone || "UTC")); } catch { doc.snapshot = null; }
  doc.sourceId = "database"; doc.syncedAt = updatedAt.toISOString(); return doc;
}
export async function refreshSafetyFromWorkspace(client: PoolClient, userId: string, state: AppState, updatedAt: Date) {
  await client.query("INSERT INTO finbridge_safety(user_id,document) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING", [userId, JSON.stringify(emptySafetyDocument())]);
  const rows = await client.query<{ document: SafetyDocument }>("SELECT document FROM finbridge_safety WHERE user_id=$1 FOR UPDATE", [userId]);
  await saveSafety(client, userId, advanceSafety(databaseSafety(rows.rows[0].document, state, updatedAt)));
}

export const SAFETY_SQL = `
CREATE TABLE IF NOT EXISTS finbridge_safety (
 user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE RESTRICT,
 document JSONB NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS finbridge_safety_events (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
 event JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS finbridge_safety_events_owner ON finbridge_safety_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS finbridge_safety_events_pending ON finbridge_safety_events(next_attempt_at) WHERE event->>'emailStatus' = 'pending';
CREATE TABLE IF NOT EXISTS finbridge_safety_changes (
 id BIGSERIAL PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
 revision INTEGER NOT NULL,
 action TEXT NOT NULL,
 rules JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS finbridge_safety_limits (
 user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE RESTRICT,
 window_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 requests INTEGER NOT NULL DEFAULT 1
);`;
export class SafetyError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 409) { super(code); this.code = code; this.status = status; }
}
export type SafetyRepository = {
  read(userId: string): Promise<SafetyDocument>;
  mutate(userId: string, revision: number, action: string, change: (doc: SafetyDocument) => SafetyDocument): Promise<SafetyDocument>;
};
async function activeUser(client: PoolClient, userId: string) {
  const user = await client.query('SELECT id FROM "user" WHERE id=$1 FOR SHARE', [userId]);
  if (!user.rowCount || (await client.query("SELECT 1 FROM finbridge_account_lifecycle WHERE user_id=$1", [userId])).rowCount) throw new SafetyError("UNAUTHENTICATED", 401);
}
async function events(client: Pool | PoolClient, userId: string) {
  return (await client.query<{ event: SafetyEvent }>("SELECT event FROM finbridge_safety_events WHERE user_id=$1 ORDER BY created_at DESC, id DESC LIMIT 100", [userId])).rows.map(r => r.event);
}
export async function saveSafety(client: PoolClient, userId: string, doc: SafetyDocument) {
  await writeAlertRules(client, userId, doc.rules);
  for (const e of doc.events) await client.query("INSERT INTO finbridge_safety_events(id,user_id,event,created_at) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING", [e.id, userId, JSON.stringify(e), e.createdAt]);
  await client.query("UPDATE finbridge_safety SET document=$2::jsonb,updated_at=CURRENT_TIMESTAMP WHERE user_id=$1", [userId, JSON.stringify({ ...doc, events: [] })]);
}
export function safetyRepository(pool: Pool): SafetyRepository {
  return {
    async read(userId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN"); await activeUser(client, userId);
        const workspace = await safetyWorkspace(client, userId);
        const row = await client.query<{ document: SafetyDocument }>("SELECT document FROM finbridge_safety WHERE user_id=$1", [userId]);
        const doc = row.rows[0]?.document || emptySafetyDocument();
        if (workspace) databaseSafety(doc, workspace.data, workspace.updatedAt);
        doc.events = await events(client, userId);
        await client.query("COMMIT"); return doc;
      } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
    },
    async mutate(userId, revision, action, change) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN"); await activeUser(client, userId);
        const workspace = await safetyWorkspace(client, userId);
        if (!workspace) throw new SafetyError("WORKSPACE_REQUIRED", 400);
        const limited = await client.query(`INSERT INTO finbridge_safety_limits(user_id) VALUES($1)
          ON CONFLICT(user_id) DO UPDATE SET
          requests=CASE WHEN finbridge_safety_limits.window_at < CURRENT_TIMESTAMP - INTERVAL '1 minute' THEN 1 ELSE finbridge_safety_limits.requests+1 END,
          window_at=CASE WHEN finbridge_safety_limits.window_at < CURRENT_TIMESTAMP - INTERVAL '1 minute' THEN CURRENT_TIMESTAMP ELSE finbridge_safety_limits.window_at END
          WHERE finbridge_safety_limits.requests < 60 OR finbridge_safety_limits.window_at < CURRENT_TIMESTAMP - INTERVAL '1 minute' RETURNING user_id`, [userId]);
        if (!limited.rowCount) throw new SafetyError("RATE_LIMITED", 429);
        await client.query("INSERT INTO finbridge_safety(user_id,document) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING", [userId, JSON.stringify(emptySafetyDocument())]);
        const row = await client.query<{ document: SafetyDocument }>("SELECT document FROM finbridge_safety WHERE user_id=$1 FOR UPDATE", [userId]);
        const doc = row.rows[0].document;
        databaseSafety(doc, workspace.data, workspace.updatedAt);
        if (doc.revision !== revision) throw new SafetyError("CONFLICT");
        const updated = change(doc);
        const next = advanceSafety({ ...updated, revision: doc.revision + 1 });
        if (action === "read") await client.query("UPDATE finbridge_safety_events SET event=jsonb_set(event,'{read}','true') WHERE user_id=$1 AND event->>'read'='false'", [userId]);
        // A paused/removed rule must not leave a queued email behind.
        await client.query("UPDATE finbridge_safety_events SET event=jsonb_set(event,'{emailStatus}','\"cancelled\"') WHERE user_id=$1 AND event->>'emailStatus'='pending' AND NOT(event->>'ruleId'=ANY($2::text[]))", [userId, next.rules.filter(r => r.active && r.email).map(r => r.id)]);
        await saveSafety(client, userId, next);
        if (action !== "sync" && action !== "read") await client.query("INSERT INTO finbridge_safety_changes(user_id,revision,action,rules) VALUES($1,$2,$3,$4)", [userId, next.revision, action, JSON.stringify(next.rules)]);
        next.events = await events(client, userId);
        await client.query("COMMIT"); return next;
      } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
    },
  };
}
