import type { BetterAuthOptions } from "better-auth";
import type { Pool } from "pg";
import type { readAuthConfig } from "./auth-config";
import type { SendAuthMail } from "./auth-mail";
import { hashPassword, verifyPassword } from "./password-security";

export function buildAuthOptions(config: NonNullable<ReturnType<typeof readAuthConfig>>, database: Pool, sendMail?: SendAuthMail) {
  return {
    appName: "FinBridge",
    baseURL: config.baseURL,
    secret: config.secret,
    trustedOrigins: [config.baseURL],
    database,
    user: { additionalFields: { role: { type: "string" as const, defaultValue: "user", required: true, input: false } } },
    emailAndPassword: {
      enabled: true, disableSignUp: !sendMail, requireEmailVerification: true,
      autoSignIn: false, minPasswordLength: 12, maxPasswordLength: 128,
      password: { hash: hashPassword, verify: verifyPassword },
      resetPasswordTokenExpiresIn: 1800, revokeSessionsOnPasswordReset: true,
      sendResetPassword: sendMail ? async ({ user, url }: { user: { email: string }; url: string }) => { await sendMail({ to: user.email, url, kind: "reset" }); } : undefined,
    },
    emailVerification: {
      expiresIn: 3600, sendOnSignUp: true, sendOnSignIn: false, autoSignInAfterVerification: false,
      sendVerificationEmail: sendMail ? async ({ user, url }: { user: { email: string }; url: string }) => { await sendMail({ to: user.email, url, kind: "verify" }); } : undefined,
    },
    socialProviders: { google: { clientId: config.clientId, clientSecret: config.clientSecret, prompt: "select_account" as const, includeGrantedScopes: false } },
    account: {
      encryptOAuthTokens: true,
      accountLinking: {
        enabled: true,
        trustedProviders: ["google"],
        requireLocalEmailVerified: true,
        allowDifferentEmails: false,
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, freshAge: 300, cookieCache: { enabled: false } },
    advanced: { cookiePrefix: "finbridge" },
    rateLimit: { enabled: true, window: 60, max: 30 },
    onAPIError: { errorURL: config.baseURL + "/login?error=oauth" },
    logger: { level: "error" as const, log: () => console.error("AUTH_PROVIDER_ERROR") },
  } satisfies BetterAuthOptions;
}
