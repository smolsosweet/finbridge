import nextEnv from "@next/env";
import { Pool } from "pg";
import { demoIdentity } from "../src/lib/demo-accounts.ts";
nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DEMO_DATABASE_URL) throw Error("DEMO_DATABASE_URL_REQUIRED");
const url = new URL(process.env.DEMO_DATABASE_URL), target = url.host + url.pathname;
const pool = new Pool({ connectionString: process.env.DEMO_DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
let client;
try {
  client = await pool.connect();
  await client.query("BEGIN READ ONLY");
  await client.query("SET LOCAL statement_timeout='10s'");
  const expected = ["user", "account", "session", "finbridge_workspaces", "finbridge_wallets", "finbridge_transactions", "finbridge_categories", "finbridge_preferences", "finbridge_onboarding", "finbridge_safety", "finbridge_safety_events", "finbridge_transfer_controls", "finbridge_ai_quota_buckets"];
  const tables = (await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).rows.map(row => row.table_name);
  const identities = [demoIdentity(1), demoIdentity(2)];
  const existing = await client.query('SELECT id,name,email,"emailVerified" FROM "user" WHERE id=ANY($1::text[]) OR lower(email)=ANY($2::text[])', [identities.map(i => i.id), identities.map(i => i.email)]);
  const registry = tables.includes("finbridge_demo_accounts") ? (await client.query("SELECT user_id FROM finbridge_demo_accounts WHERE user_id=ANY($1::text[])", [identities.map(i => i.id)])).rows.map(row => row.user_id) : [];
  console.log(JSON.stringify({ target, connected: true, missingTables: expected.filter(name => !tables.includes(name)), demoAccounts: existing.rows.map(row => ({ ...row, registered: registry.includes(row.id) })), readOnly: true }));
  await client.query("ROLLBACK");
} catch {
  await client?.query("ROLLBACK").catch(() => {});
  console.error("DEMO_INSPECTION_FAILED; connection details redacted."); process.exitCode = 1;
} finally { client?.release(); await pool.end(); }
