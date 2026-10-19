// Uses only disposable identities in the explicitly named local test database.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawn, execFileSync } from "node:child_process";
import { cpSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { buildAuthOptions } from "../src/lib/auth-options.ts";
import { testPool, cleanupFinance, workspaceFixture } from "./workspace-fixtures.mjs";
import { workspaceRepository } from "../src/lib/workspace-repository.ts";

const pool = await testPool();
const root = process.cwd(), directory = path.join(root, ".local", "feedback-ui-" + randomUUID());
mkdirSync(directory, { recursive: true });
for (const name of ["src", "public", "package.json", "package-lock.json", "tsconfig.json", "postcss.config.mjs"]) cpSync(path.join(root, name), path.join(directory, name), { recursive: true });
writeFileSync(path.join(directory, "next.config.ts"), `export default { devIndicators:false, turbopack:{root:${JSON.stringify(root)}} };`);
const port = 40000 + Math.floor(Math.random() * 1000), origin = `http://localhost:${port}`, secret = "synthetic-feedback-secret-".repeat(3);
const config = { baseURL: origin, secret, databaseURL: process.env.AUTH_TEST_DATABASE_URL, clientId: "synthetic", clientSecret: "synthetic" };
const auth = betterAuth(buildAuthOptions(config, pool, async () => {}));
const email = "feedback-" + randomUUID() + "@example.invalid", password = "Synthetic-feedback-password-2026";
const signup = await auth.api.signUpEmail({ body: { email, password, name: "Synthetic UI" } }), owner = signup.user.id;
await pool.query('UPDATE "user" SET "emailVerified"=true WHERE id=$1', [owner]);
const response = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
assert.equal(response.status, 200);
const cookies = response.headers.getSetCookie().map(c => { const pair = c.split(";")[0], i = pair.indexOf("="); return { name: pair.slice(0, i), value: pair.slice(i + 1), url: origin }; });
const date = new Date().toISOString().slice(0, 10), workspace = workspaceFixture();
workspace.settings = { ...workspace.settings, name: "Synthetic UI", language: "English", theme: "light", timeZone: "UTC", onboardingCompleted: date };
await workspaceRepository(pool).save(owner, { revision: 0, mutationId: randomUUID(), data: workspace });
const setup = { version: 1, displayName: "Synthetic UI", occupation: "student", language: "en", wallets: [{ id: "bank", name: "Bank", currency: "USD", initial: 2000 }], expenseCategories: ["Dining"], incomeCategories: ["Salary"], commitments: [], reserves: [{ walletId: "bank", amount: 0 }] };
await pool.query("INSERT INTO finbridge_onboarding(user_id,data) VALUES($1,$2)", [owner, JSON.stringify(setup)]);
const env = { ...process.env, NODE_ENV: "development", DATABASE_URL: config.databaseURL, BETTER_AUTH_URL: origin, BETTER_AUTH_SECRET: secret, GOOGLE_CLIENT_ID: "synthetic", GOOGLE_CLIENT_SECRET: "synthetic", AUTH_EMAIL_MODE: "", AUTH_EMAIL_FROM: "", BREVO_API_KEY: "", SMTP_HOST: "", SMTP_FROM: "", SAFETY_EMAIL_ENABLED: "false", GEMINI_API_KEY: "", GOOGLE_API_KEY: "", FINBRIDGE_DEMO_MODE: "false" };
const server = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", directory, "-p", String(port)], { cwd: directory, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
let logs = "", browser, page;
server.stdout.on("data", c => { logs += c; }); server.stderr.on("data", c => { logs += c; });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  for (let i = 0; i < 120 && !/Ready in/.test(logs); i++) { if (server.exitCode !== null) throw new Error("Test server stopped"); await pause(250); }
  const { chromium } = createRequire(import.meta.url)(process.env.SAFETY_PLAYWRIGHT_PATH || "C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
  const executablePath = ["C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  page = await context.newPage(); const errors = []; page.on("pageerror", error => errors.push(error.message));

  await context.addCookies(cookies);
  await context.addInitScript(() => localStorage.setItem("finbridge-preferred-language-v1", "en"));
  const sent = [];
  let failNext = true;
  await page.route("**/api/feedback", async route => {
    sent.push(route.request().postDataJSON());
    if (failNext) { failNext = false; await route.fulfill({ status: 503, json: { error: "FEEDBACK_UNAVAILABLE" } }); }
    else await route.continue();
  });
  await page.goto(origin + "/app?tab=settings", { timeout: 120000 });
  await page.getByRole("button", { name: "Contact us", exact: true }).click();
  const subject = page.getByPlaceholder("e.g., Feature idea, bug report...");
  const message = page.getByPlaceholder("Write your message for the FinBridge team...");
  await subject.fill("Synthetic contact"); await message.fill("Synthetic persistent contact");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Could not send" }).waitFor();
  assert.equal(await message.inputValue(), "Synthetic persistent contact");
  assert.equal(Number((await pool.query("SELECT count(*) n FROM finbridge_feedback WHERE user_id=$1", [owner])).rows[0].n), 0);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.getByText("Saved in the system. Reference:", { exact: false }).waitFor();
  assert.equal(sent[0].mutationId, sent[1].mutationId, "failed response retry must reuse the submission ID");
  let saved = (await pool.query("SELECT id,kind,subject,message FROM finbridge_feedback WHERE user_id=$1", [owner])).rows;
  assert.equal(saved.length, 1); assert.equal(saved[0].kind, "contact"); assert.equal(saved[0].message, "Synthetic persistent contact");
  await page.screenshot({ path: path.join(directory, "contact-saved.png") });
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  await page.getByRole("button", { name: "Feature requests", exact: true }).click();
  await page.getByRole("button", { name: "Suggest another feature", exact: true }).click();
  await page.getByPlaceholder("Describe the feature you would like...").fill("Synthetic feature modal");
  await page.getByRole("button", { name: "Submit suggestion", exact: true }).click();
  await page.getByText("Saved in the system. Reference:", { exact: false }).waitFor();
  assert.equal(Number((await pool.query("SELECT count(*) n FROM finbridge_feedback WHERE user_id=$1 AND kind='feature'", [owner])).rows[0].n), 1);
  await page.setViewportSize({ width: 390, height: 900 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(directory, "feature-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + "/app/featureRequest", { timeout: 120000 });
  await page.getByRole("button", { name: "Suggest another feature", exact: true }).click();
  await page.getByPlaceholder("Describe the feature you would like...").fill("Synthetic feature page");
  await page.getByRole("button", { name: "Submit suggestion", exact: true }).click();
  await page.getByText("Saved in the system. Reference:", { exact: false }).waitFor();
  await page.reload();
  saved = (await pool.query("SELECT kind,message FROM finbridge_feedback WHERE user_id=$1 ORDER BY created_at", [owner])).rows;
  assert.deepEqual(saved.map(r => r.message), ["Synthetic persistent contact", "Synthetic feature modal", "Synthetic feature page"]);
  // Minimal lint repairs must retain route-driven wallet dialogs and language preference hydration.
  await page.goto(origin + "/app/walletSettings?wallet=bank", { timeout: 120000 });
  await page.getByRole("dialog", { name: "Manage wallet: Synthetic bank", exact: true }).waitFor();
  const anonymous = await browser.newContext();
  const welcomePage = await anonymous.newPage();
  welcomePage.on("pageerror", error => errors.push(error.message));
  await welcomePage.goto(origin, { timeout: 120000 });
  await welcomePage.getByRole("button", { name: "Select language", exact: true }).click();
  await welcomePage.getByRole("option", { name: "Tiếng Việt", exact: true }).click();
  await welcomePage.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  await welcomePage.getByRole("heading", { name: "Tạo tài khoản", exact: true }).waitFor();
  await welcomePage.reload();
  await welcomePage.getByRole("heading", { name: "Tạo tài khoản", exact: true }).waitFor();
  await anonymous.close();
  assert.deepEqual(errors, []);
  console.log("PASS: failed contact keeps text and never reports success; retry reuses ID and persists once; both feature forms persist; reload retains all records; mobile fits; no browser errors.");
  console.log("Screenshots:", directory);
} catch (error) {
  if (page) await page.screenshot({ path: path.join(directory, "failure.png") });
  console.error("UI check artifacts:", directory); throw error;
} finally {
  if (browser) await browser.close();
  if (server.pid && process.platform === "win32") { try { execFileSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }); } catch { /* Already stopped. */ } } else server.kill();
  await pause(300);
  await pool.query("DELETE FROM finbridge_onboarding WHERE user_id=$1", [owner]);
  await pool.query('DELETE FROM "session" WHERE "userId"=$1', [owner]); await pool.query('DELETE FROM "account" WHERE "userId"=$1', [owner]);
  await cleanupFinance(pool, [owner]); await pool.end();
}
