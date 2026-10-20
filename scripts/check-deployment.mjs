import nextEnv from "@next/env";
import { Pool } from "pg";
import { deploymentReadiness } from "../src/lib/deployment-readiness.ts";

nextEnv.loadEnvConfig(process.cwd());
const report = deploymentReadiness(process.env, !process.argv.includes("--local"));
report.scope = "Only the environment of this command; does not read Vercel project settings.";
if (process.argv.includes("--database")) {
  if (!process.env.DATABASE_URL) throw Error("DATABASE_URL required");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN READ ONLY"); await client.query("SET LOCAL statement_timeout='5s'");
    await client.query("SELECT 1");
    const expected = ["user", "account", "session", "verification", "finbridge_account_lifecycle", "finbridge_onboarding", "finbridge_workspaces", "finbridge_wallets", "finbridge_transactions", "finbridge_safety", "finbridge_ai_control", "finbridge_ai_quota_buckets", "finbridge_ai_reservations"];
    const schema = (await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[])", [expected])).rows.map(r => r.table_name);
    report.database = { connected: true, missingTables: expected.filter(name => !schema.includes(name)) };
    if (report.database.missingTables.length) report.ready = false;
    await client.query("ROLLBACK");
  } catch { await client?.query("ROLLBACK").catch(() => {}); report.database = { connected: false }; report.ready = false; }
  finally { client?.release(); await pool.end(); }
}
console.log(JSON.stringify(report, null, 2)); if (!report.ready) process.exitCode = 1;
