import type { BetterAuthOptions } from "better-auth";
import type { Pool } from "pg";
import type { readAuthConfig } from "./auth-config";

export function buildAuthOptions(config: NonNullable<ReturnType<typeof readAuthConfig>>, database: Pool) {
  return {
    appName: "FinBridge",
    baseURL: config.baseURL,
    secret: config.secret,
    trustedOrigins: [config.baseURL],
    database,
    emailAndPassword: { enabled: false },
    socialProviders: { google: { clientId: config.clientId, clientSecret: config.clientSecret, prompt: "select_account" as const, includeGrantedScopes: false } },
    account: { encryptOAuthTokens: true, accountLinking: { enabled: false } },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
    advanced: { cookiePrefix: "finbridge" },
    rateLimit: { enabled: true, window: 60, max: 30 },
    onAPIError: { errorURL: config.baseURL + "/login?error=oauth" },
    logger: { level: "error" as const, log: () => console.error("AUTH_PROVIDER_ERROR") },
  } satisfies BetterAuthOptions;
}