import nextEnv from "@next/env";
import { Pool } from "pg";
import { AI_QUOTA_SQL } from "../src/lib/ai-quota-repository.ts";

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const url = new URL(process.env.DATABASE_URL), target = url.host + url.pathname;
const args = process.argv.slice(2);
console.log(JSON.stringify({ target, apply: args.includes("--apply"), additive: true }));
if (args.includes("--apply")) {
  if (!args.includes("--confirm-target=" + target)) throw Error("Confirm exact host/database with --confirm-target=" + target);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN"); await client.query("SET LOCAL lock_timeout='5s'"); await client.query("SET LOCAL statement_timeout='30s'");
    await client.query(AI_QUOTA_SQL); await client.query("COMMIT");
    console.log("AI quota schema migrated; existing counters and financial data were preserved.");
  } catch { await client?.query("ROLLBACK").catch(() => {}); console.error("QUOTA_MIGRATION_FAILED; no migration transaction committed."); process.exitCode = 1; }
  finally { client?.release(); await pool.end(); }
} else console.log("Dry run only. Add --apply and exact --confirm-target=HOST:PORT/DATABASE after verifying the target.");
