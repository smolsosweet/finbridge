import "server-only";
import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { readAuthConfig } from "./auth-config";
import { buildAuthOptions } from "./auth-options";

function createAuth() {
  const config = readAuthConfig();
  if (!config) return null;
  const pool = new Pool({ connectionString: config.databaseURL, max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
  return betterAuth(buildAuthOptions(config, pool));
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  // Lazy initialization allows a build without injecting production secrets.
  return instance ?? (instance = createAuth());
}
