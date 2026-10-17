import nextEnv from "@next/env";
import { Pool } from "pg";
import { getMigrations } from "better-auth/db/migration";
import { initializeAccountLifecycle } from "../src/lib/account-lifecycle.ts";
import { SAFETY_SQL } from "../src/lib/safety-repository.ts";
import { WORKSPACE_SQL } from "../src/lib/workspace-repository.ts";
import { FINANCE_TABLES_SQL, writeFinanceTables } from "../src/lib/finance-tables.ts";
import { INTERNATIONAL_TRANSFER_SQL } from "../src/lib/international-transfer-repository.ts";

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  const { buildAuthOptions } = await import("../src/lib/auth-options.ts");
  const config = { baseURL: process.env.BETTER_AUTH_URL, secret: process.env.BETTER_AUTH_SECRET, clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, databaseURL: process.env.DATABASE_URL };
  const migration = await getMigrations(buildAuthOptions(config, pool));
  await migration.runMigrations();
  await initializeAccountLifecycle(pool);
  await pool.query(SAFETY_SQL);
  await pool.query(WORKSPACE_SQL);
  await pool.query(FINANCE_TABLES_SQL);
  await pool.query(INTERNATIONAL_TRANSFER_SQL);
  // Backfill only server-owned records from the earlier snapshot prototype.
  // Device-only data is migrated explicitly by its signed-in owner in the UI.
  const workspaces = await pool.query("SELECT user_id,data FROM finbridge_workspaces WHERE data IS NOT NULL");
  for (const row of workspaces.rows) {
    const exists = await pool.query("SELECT 1 FROM finbridge_wallets WHERE user_id=$1 LIMIT 1", [row.user_id]);
    if (!exists.rowCount) {
      const client = await pool.connect();
      try { await client.query("BEGIN"); await writeFinanceTables(client, row.user_id, row.data); await client.query("COMMIT"); }
      catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    }
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS finbridge_onboarding (
    user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  console.log("FinBridge schema migrated. Existing data was not reset.");
} finally { await pool.end(); }
