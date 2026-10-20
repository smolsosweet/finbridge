import { readAiQuotaConfig } from "./ai-quota";
import { DEFAULT_GEMINI_MODEL } from "./gemini-config";

export function deploymentReadiness(env: NodeJS.ProcessEnv, production = true) {
  const checks: Array<{ check: string; ok: boolean }> = [];
  const check = (name: string, ok: boolean) => checks.push({ check: name, ok });
  let origin: URL | undefined, db: URL | undefined;
  try { origin = new URL(env.BETTER_AUTH_URL || ""); } catch {}
  try { db = new URL(env.DATABASE_URL || ""); } catch {}
  const allowedProtocol = origin?.protocol === "https:" || (!production && origin?.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname));
  check("canonical auth origin", !!origin && !origin.username && !origin.password && !origin.search && !origin.hash && origin.pathname === "/" && allowedProtocol);
  check("PostgreSQL configured", !!db && ["postgres:", "postgresql:"].includes(db.protocol) && !!db.hostname && !!db.pathname.slice(1));
  if (production) {
    check("remote database", !!db && !["localhost", "127.0.0.1", "[::1]"].includes(db.hostname));
    check("database TLS verification", !!db && ["verify-full", "require"].includes(db.searchParams.get("sslmode") || ""));
  }
  check("auth secret configured", (env.BETTER_AUTH_SECRET?.length || 0) >= 32);
  // The current auth factory requires these even for email login.
  check("required Google auth configuration present", !!env.GOOGLE_CLIENT_ID?.trim() && !!env.GOOGLE_CLIENT_SECRET?.trim());
  check("Gemini configured", !!env.GEMINI_API_KEY?.trim());
  check("anonymous memory demo disabled", env.FINBRIDGE_DEMO_MODE !== "true");
  check("production transfer execution disabled", env.FINBRIDGE_ENABLE_TRANSFER_SANDBOX !== "true");
  check("Brevo production mail configured", env.AUTH_EMAIL_MODE === "brevo" && !!env.BREVO_API_KEY?.trim() && /^[^\s@]+@[^\s@]+$/.test(env.AUTH_EMAIL_FROM || ""));
  let quotaConfigured = true;
  try { readAiQuotaConfig(env); } catch { quotaConfigured = false; }
  check("shared AI quota values valid", quotaConfigured);
  if (env.SAFETY_EMAIL_ENABLED === "true") check("safety email worker secret configured", (env.SAFETY_CRON_SECRET?.length || 0) >= 32);
  const model = env.GEMINI_TRANSACTION_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  return { ready: checks.every(c => c.ok), checks, models: { text: model, audio: env.GEMINI_AUDIO_MODEL?.trim() || model }, manualChecks: ["Verify model RPM/TPM/RPD and Free/Paid project in AI Studio", "New mailbox receives verification and signs in", "Preview and production deployment SHA match intended release", "Scheduler and opted-in Brevo delivery if email alerts enabled", "Demo accounts can sign in from an external network", "Confirm third-party UI/asset permissions"] };
}
