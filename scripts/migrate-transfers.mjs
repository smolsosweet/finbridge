import nextEnv from "@next/env";
import { Pool } from "pg";
import { INTERNATIONAL_TRANSFER_SQL } from "../src/lib/international-transfer-repository.ts";
nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(INTERNATIONAL_TRANSFER_SQL);
  await client.query("COMMIT");
  console.log("Transfer and reference-rate tables ready. Existing records retained.");
} catch (error) { await client.query("ROLLBACK"); throw error; }
finally { client.release(); await pool.end(); }
