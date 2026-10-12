import nextEnv from "@next/env";
import { Pool } from "pg";
import { getMigrations } from "better-auth/db/migration";

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  const migration = await getMigrations({ database: pool });
  await migration.runMigrations();
  console.log("Auth schema migrated. Existing data was not reset.");
} finally { await pool.end(); }