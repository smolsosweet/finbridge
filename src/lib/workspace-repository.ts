import { createHash } from "node:crypto";
import type { Pool } from "pg";
import type { AppState } from "../components/sites/rolly/replica/store";
import { emptyWorkspaceRecord, parseWorkspace, type WorkspaceRecord } from "./workspace-model";
import { refreshSafetyFromWorkspace } from "./safety-repository";
import { readFinanceTables, writeFinanceTables } from "./finance-tables";
import { validateFixedPaymentChanges } from "./fixed-expense-payments";
export const WORKSPACE_SQL = `
CREATE TABLE IF NOT EXISTS finbridge_workspaces (
 user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE RESTRICT,
 revision INTEGER NOT NULL DEFAULT 0,
 data JSONB,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS finbridge_workspace_revisions (
 user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
 revision INTEGER NOT NULL,
 mutation_id TEXT NOT NULL,
 content_hash TEXT NOT NULL,
 data JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,revision), UNIQUE(user_id,mutation_id)
);
CREATE TABLE IF NOT EXISTS finbridge_workspace_limits (
 user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE RESTRICT,
 window_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 requests INTEGER NOT NULL DEFAULT 1
);`;
export class WorkspaceError extends Error {
  status: number;
  constructor(code: string, status = 409) { super(code); this.status = status; }
}
export type WorkspaceRepository = { read(userId: string): Promise<WorkspaceRecord>; save(userId: string, input: { revision: number; mutationId: string; data: AppState }): Promise<WorkspaceRecord> };
const record = (row?: { revision: number; data: unknown; updated_at: Date }): WorkspaceRecord => row ? { revision: row.revision, data: row.data ? parseWorkspace(row.data) : null, updatedAt: row.updated_at.toISOString() } : emptyWorkspaceRecord();
export function workspaceRepository(pool: Pool): WorkspaceRepository {
  async function active(client: Pick<Pool, "query">, owner: string) {
    const user = await client.query('SELECT id FROM "user" WHERE id=$1 FOR SHARE', [owner]);
    if (!user.rowCount || (await client.query("SELECT 1 FROM finbridge_account_lifecycle WHERE user_id=$1", [owner])).rowCount) throw new WorkspaceError("UNAUTHENTICATED", 401);
  }
  return {
    async read(owner) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ"); await active(client, owner);
        const rows = await client.query("SELECT * FROM finbridge_workspaces WHERE user_id=$1", [owner]); const result = record(rows.rows[0]);
        if (result.data) result.data = parseWorkspace(await readFinanceTables(client, owner, result.data));
        await client.query("COMMIT"); return result;
      }
      catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
    },
    async save(owner, input) {
      const data = parseWorkspace(input.data), encoded = JSON.stringify(data), hash = createHash("sha256").update(encoded).digest("hex");
      const client = await pool.connect();
      try {
        await client.query("BEGIN"); await active(client, owner);
        await client.query("INSERT INTO finbridge_workspaces(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING", [owner]);
        const rows = await client.query("SELECT * FROM finbridge_workspaces WHERE user_id=$1 FOR UPDATE", [owner]);
        const previous = rows.rows[0];
        const replay = await client.query("SELECT revision,content_hash FROM finbridge_workspace_revisions WHERE user_id=$1 AND mutation_id=$2", [owner, input.mutationId]);
        if (replay.rowCount) {
          if (replay.rows[0].content_hash !== hash) throw new WorkspaceError("MUTATION_MISMATCH");
          // Return the accepted revision, never claim that a newer writer's data
          // belongs to this request. The next save will surface a conflict.
          await client.query("COMMIT"); return { revision: replay.rows[0].revision, data, updatedAt: previous.updated_at.toISOString() };
        }
        if (previous.revision !== input.revision) throw new WorkspaceError("WORKSPACE_CONFLICT");
        try { validateFixedPaymentChanges(previous.data, data); } catch { throw new WorkspaceError("INVALID_BILL_PAYMENT", 400); }
        const allowed = await client.query(`INSERT INTO finbridge_workspace_limits(user_id) VALUES($1)
          ON CONFLICT(user_id) DO UPDATE SET requests=CASE WHEN finbridge_workspace_limits.window_at < CURRENT_TIMESTAMP - INTERVAL '1 minute' THEN 1 ELSE finbridge_workspace_limits.requests+1 END,
          window_at=CASE WHEN finbridge_workspace_limits.window_at < CURRENT_TIMESTAMP - INTERVAL '1 minute' THEN CURRENT_TIMESTAMP ELSE finbridge_workspace_limits.window_at END
          WHERE finbridge_workspace_limits.requests < 120 OR finbridge_workspace_limits.window_at < CURRENT_TIMESTAMP - INTERVAL '1 minute' RETURNING user_id`, [owner]);
        if (!allowed.rowCount) throw new WorkspaceError("RATE_LIMITED", 429);
        const revision = previous.revision + 1;
        const result = await client.query("UPDATE finbridge_workspaces SET revision=$2,data=$3::jsonb,updated_at=CURRENT_TIMESTAMP WHERE user_id=$1 RETURNING *", [owner, revision, encoded]);
        await writeFinanceTables(client, owner, data);
        await client.query("INSERT INTO finbridge_workspace_revisions(user_id,revision,mutation_id,content_hash,data) VALUES($1,$2,$3,$4,$5)", [owner, revision, input.mutationId, hash, encoded]);
        await refreshSafetyFromWorkspace(client, owner, data, result.rows[0].updated_at);
        await client.query("COMMIT"); return record(result.rows[0]);
      } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
    },
  };
}
