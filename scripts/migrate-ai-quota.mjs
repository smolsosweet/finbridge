import nextEnv from "@next/env";
import { Pool } from "pg";
import { AI_QUOTA_SQL } from "../src/lib/ai-quota-repository.ts";

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  await pool.query(AI_QUOTA_SQL);
  console.log("AI quota schema migrated; existing counters and financial data were preserved.");
} finally { await pool.end(); }
