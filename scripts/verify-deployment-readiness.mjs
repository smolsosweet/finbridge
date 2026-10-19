import assert from "node:assert/strict";
import test from "node:test";
import { deploymentReadiness } from "../src/lib/deployment-readiness.ts";
import { privacyCopy } from "../src/lib/privacy-copy.ts";
const env = { BETTER_AUTH_URL: "https://finbridge.example.invalid", DATABASE_URL: "postgresql://app:synthetic-secret@db.example.invalid/app?sslmode=verify-full", BETTER_AUTH_SECRET: "synthetic-secret-".repeat(3), GEMINI_API_KEY: "synthetic-gemini-only", AUTH_EMAIL_MODE: "brevo", BREVO_API_KEY: "synthetic-brevo-only", AUTH_EMAIL_FROM: "sender@example.invalid", AI_QUOTA_SERVER_DAILY_POINTS: "300", AI_QUOTA_SERVER_DAILY_REQUESTS: "300", AI_QUOTA_SERVER_MINUTE_REQUESTS: "6" };
Object.assign(env, { GOOGLE_CLIENT_ID: "synthetic", GOOGLE_CLIENT_SECRET: "synthetic" });
test("deployment checks are secret-free and cannot equate configured variables with proven delivery", () => {
  const report = deploymentReadiness(env); assert.equal(report.ready, true);
  const output = JSON.stringify(report);
  for (const value of [env.DATABASE_URL, env.BETTER_AUTH_SECRET, env.GEMINI_API_KEY, env.BREVO_API_KEY, env.AUTH_EMAIL_FROM]) assert.ok(!output.includes(value));
  assert.ok(report.manualChecks.some(x => /mailbox/.test(x))); assert.equal(report.models.audio, "gemini-3.1-flash-lite");
  assert.equal(deploymentReadiness({ ...env, GEMINI_AUDIO_MODEL: "separate-audio-model" }).models.audio, "separate-audio-model");
  for (const change of [{ DATABASE_URL: "postgresql://app:secret@127.0.0.1/app" }, { BETTER_AUTH_URL: "http://example.invalid" }, { AI_QUOTA_SERVER_DAILY_POINTS: "" }, { FINBRIDGE_DEMO_MODE: "true" }, { FINBRIDGE_ENABLE_TRANSFER_SANDBOX: "true" }, { AUTH_EMAIL_MODE: "local" }, { SAFETY_EMAIL_ENABLED: "true", SAFETY_CRON_SECRET: "" }]) assert.equal(deploymentReadiness({ ...env, ...change }).ready, false);
});
test("all three languages disclose Gemini Free, manual entry and non-permanent account closure", () => {
  assert.deepEqual(Object.keys(privacyCopy).sort(), ["en", "vi", "zh"]);
  for (const sections of Object.values(privacyCopy)) { assert.equal(sections.length, 3); assert.match(sections[1].body, /Google Gemini/); assert.match(sections[1].body, /Gemini Free/); }
  assert.match(privacyCopy.en[1].body, /human reviewers/); assert.match(privacyCopy.en[2].body, /does not permanently erase/);
});
