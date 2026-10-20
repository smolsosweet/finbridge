import nextEnv from "@next/env";
import { Pool } from "pg";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { DEMO_ACCOUNTS_SQL, demoIdentity, manageDemoAccount } from "../src/lib/demo-accounts.ts";

nextEnv.loadEnvConfig(process.cwd());
const args = process.argv.slice(2), option = name => args.find(x => x.startsWith(name + "="))?.slice(name.length + 1);
const action = option("--action"), slot = Number(option("--slot")), identity = demoIdentity(slot);
if (!["create", "reset", "rotate", "lock"].includes(action)) throw Error("Choose --action=create|reset|rotate|lock");
if (!process.env.DEMO_DATABASE_URL) throw Error("Set DEMO_DATABASE_URL explicitly. DATABASE_URL is never used by this tool.");
const url = new URL(process.env.DEMO_DATABASE_URL), target = url.host + url.pathname;
console.log(JSON.stringify({ action, target, userId: identity.id, email: identity.email, profile: identity.name, applied: false }));
if (args.includes("--apply")) {
  if (option("--confirm-target") !== target || option("--confirm-user") !== identity.id) throw Error("Confirm exact target and demo user ID before applying.");
  const password = ["create", "rotate"].includes(action) ? randomBytes(24).toString("base64url") : undefined;
  // Reserve an exclusive, ignored file BEFORE committing credentials to the DB.
  let credentialPath;
  if (password) {
    mkdirSync(".local", { recursive: true }); credentialPath = ".local/judge-credentials-" + Date.now() + "-" + slot + ".json";
    writeFileSync(credentialPath, JSON.stringify({ ...identity, password, note: "Private. Share only with judges. This file can remain if the DB operation fails; verify success below." }, null, 2), { flag: "wx", mode: 0o600 });
  }
  const pool = new Pool({ connectionString: process.env.DEMO_DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  try {
    await pool.query(DEMO_ACCOUNTS_SQL);
    await manageDemoAccount(pool, { action, slot, password });
    console.log(JSON.stringify({ applied: true, userId: identity.id, credentialPath: credentialPath || null }));
  } catch { console.error("DEMO_OPERATION_FAILED. No account data transaction was committed. Check the guarded target/schema; do not print connection strings."); process.exitCode = 1; }
  finally { await pool.end(); }
}
