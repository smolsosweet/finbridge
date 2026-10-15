import "server-only";
import { Pool } from "pg";
import { readAuthConfig } from "./auth-config";

let pool: Pool | undefined;

export function database() {
  const config = readAuthConfig();
  if (!config) throw new Error("AUTH_NOT_CONFIGURED");
  return pool ??= new Pool({ connectionString: config.databaseURL, max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
}
