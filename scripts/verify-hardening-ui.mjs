import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { testPool, cleanupFinance } from "./workspace-fixtures.mjs";
import { DEMO_ACCOUNTS_SQL, demoIdentity, manageDemoAccount } from "../src/lib/demo-accounts.ts";
import { ONBOARDING_SQL } from "../src/lib/onboarding-repository.ts";
import { INTERNATIONAL_TRANSFER_SQL } from "../src/lib/international-transfer-repository.ts";

const pool = await testPool(), identity = demoIdentity(1), owners = [identity.id];
await pool.query(DEMO_ACCOUNTS_SQL); await pool.query(ONBOARDING_SQL); await pool.query(INTERNATIONAL_TRANSFER_SQL);
await manageDemoAccount(pool, { action: "create", slot: 1, password: "Synthetic-browser-password-only-2026" });
const port = 42000 + Math.floor(Math.random() * 500), origin = "http://localhost:" + port, root = process.cwd();
const env = { ...process.env, NODE_ENV: "test", DATABASE_URL: process.env.AUTH_TEST_DATABASE_URL, BETTER_AUTH_URL: origin, BETTER_AUTH_SECRET: "synthetic-browser-secret-".repeat(3),
  GOOGLE_CLIENT_ID: "synthetic", GOOGLE_CLIENT_SECRET: "synthetic", AUTH_EMAIL_MODE: "", AUTH_EMAIL_FROM: "", BREVO_API_KEY: "", SMTP_HOST: "", SMTP_FROM: "",
  GEMINI_API_KEY: "", GOOGLE_API_KEY: "", FINBRIDGE_DEMO_MODE: "false", FINBRIDGE_ENABLE_TRANSFER_SANDBOX: "false", SAFETY_EMAIL_ENABLED: "false" };
const server = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start", "-p", String(port)], { cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
let logs = "", browser;
server.stdout.on("data", chunk => { logs += chunk; }); server.stderr.on("data", chunk => { logs += chunk; });
const directory = ".local/release-verification"; mkdirSync(directory, { recursive: true });
const checks = [];
try {
  for (let i = 0; i < 120; i++) {
    if (/Ready in/.test(logs)) break;
    if (server.exitCode !== null) throw Error("Test server stopped");
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  const { chromium } = createRequire(import.meta.url)(process.env.SAFETY_PLAYWRIGHT_PATH || "C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
  const executablePath = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}), args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(), policyErrors = [];
  page.on("console", msg => { if (/Refused to|violates.*Content Security Policy/i.test(msg.text())) policyErrors.push(msg.text()); });
  const response = await page.goto(origin + "/login?lang=en");
  assert.equal(response.status(), 200);
  const headers = response.headers();
  assert.equal(headers["x-frame-options"], "DENY"); assert.equal(headers["x-content-type-options"], "nosniff");
  assert.match(headers["permissions-policy"], /microphone=\(self\)/);
  checks.push("production HTTP headers");
  const expected = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const release = execFileSync(process.execPath, ["scripts/check-release.mjs", "--url=" + origin, "--sha=" + expected], { cwd: root, encoding: "utf8", windowsHide: true });
  assert.ok(JSON.parse(release).checks.every(check => check.ok));
  checks.push("clean build SHA, public pages and anonymous denial on all seven routes");
  await page.getByRole("heading", { name: "Log in now" }).waitFor();
  const allows = await page.evaluate(() => {
    const policy = document.permissionsPolicy || document.featurePolicy;
    return { microphone: policy?.allowsFeature("microphone"), camera: policy?.allowsFeature("camera") };
  });
  assert.equal(allows.microphone, true); assert.equal(allows.camera, true);
  checks.push("first-party microphone and camera allowed by browser policy");
  await page.locator('input[type="email"]').fill(identity.email);
  await page.locator('input[type="password"]').fill("Synthetic-browser-password-only-2026");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL("**/app", { timeout: 30_000 });
  await page.getByText("Demo VND", { exact: true }).first().waitFor({ timeout: 30_000 });
  checks.push("email/password demo login and database workspace hydration");
  await page.goto(origin + "/app?tab=settings");
  await page.getByRole("button", { name: "Privacy policy", exact: true }).click();
  await page.getByText(/This demo uses Gemini Free:/).waitFor();
  await page.getByText(/does not permanently erase financial history/).waitFor();
  await page.screenshot({ path: directory + "/privacy-desktop.png", fullPage: true });
  checks.push("privacy renders Free tier and retention disclosures");
  assert.deepEqual(policyErrors, []);
  checks.push("no enforced CSP violations in login/workspace/privacy");
  await context.close();
  const narrow = await browser.newContext({ viewport: { width: 390, height: 844 } }), mobile = await narrow.newPage();
  await mobile.goto(origin + "/login?lang=vi");
  assert.equal(await mobile.locator('input[type="email"]').isVisible(), true);
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await mobile.screenshot({ path: directory + "/login-mobile.png", fullPage: true, animations: "disabled" });
  checks.push("mobile login has no horizontal overflow");
  console.log(JSON.stringify({ browserChecks: checks.length, checks }));
} finally {
  if (browser) await browser.close();
  server.kill(); await new Promise(resolve => { if (server.exitCode !== null) resolve(); else server.once("close", resolve); });
  writeFileSync(directory + "/hardening-server.log", logs);
  await pool.query("DELETE FROM finbridge_demo_accounts WHERE user_id=$1", [identity.id]);
  await pool.query("DELETE FROM finbridge_onboarding WHERE user_id=$1", [identity.id]);
  for (const table of ["session", "account"]) await pool.query('DELETE FROM "' + table + '" WHERE "userId"=$1', [identity.id]);
  await cleanupFinance(pool, owners); await pool.end();
}
