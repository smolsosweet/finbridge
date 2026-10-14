import nextEnv from "@next/env";
import { Pool } from "pg";
import { getMigrations } from "better-auth/db/migration";
import fs from "node:fs";
import ts from "typescript";

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  const source = ts.transpileModule(fs.readFileSync("src/lib/auth-options.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  const { buildAuthOptions } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
  const config = { baseURL: process.env.BETTER_AUTH_URL, secret: process.env.BETTER_AUTH_SECRET, clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, databaseURL: process.env.DATABASE_URL };
  const migration = await getMigrations(buildAuthOptions(config, pool));
  await migration.runMigrations();
  await pool.query(`CREATE TABLE IF NOT EXISTS finbridge_onboarding (
    user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  console.log("Auth schema migrated. Existing data was not reset.");
} finally { await pool.end(); }
