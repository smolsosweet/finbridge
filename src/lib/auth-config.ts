export function readAuthConfig(env: NodeJS.ProcessEnv = process.env) {
  const required = ["BETTER_AUTH_URL", "BETTER_AUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "DATABASE_URL"] as const;
  if (required.some((key) => !env[key]?.trim())) return null;
  const url = new URL(env.BETTER_AUTH_URL!);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash || (url.protocol !== "https:" && !(url.protocol === "http:" && local && env.NODE_ENV !== "production"))) {
    throw new Error("BETTER_AUTH_URL must be an HTTPS origin (HTTP localhost is development-only).");
  }
  if (env.BETTER_AUTH_SECRET!.length < 32) throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");
  return { baseURL: url.origin, secret: env.BETTER_AUTH_SECRET!, clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET!, databaseURL: env.DATABASE_URL! };
}
