// Authenticated UI checks use only disposable users in finbridge_auth_test.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawn, execFileSync } from "node:child_process";
import { cpSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import { Pool } from "pg";
import { betterAuth } from "better-auth";
import { buildAuthOptions } from "../src/lib/auth-options.ts";
import { SAFETY_SQL } from "../src/lib/safety-repository.ts";
import { safetyFixture } from "./safety-fixtures.mjs";
import { testPool, cleanupFinance } from "./workspace-fixtures.mjs";
import { workspaceRepository } from "../src/lib/workspace-repository.ts";
nextEnv.loadEnvConfig(process.cwd());
const db = new URL(process.env.AUTH_TEST_DATABASE_URL || "https://invalid.invalid");
if (!["localhost", "127.0.0.1"].includes(db.hostname) || db.pathname !== "/finbridge_auth_test") throw new Error("Only isolated finbridge_auth_test is allowed");
const playwrightPath = process.env.SAFETY_PLAYWRIGHT_PATH || "C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright";
const { chromium } = createRequire(import.meta.url)(playwrightPath);
const root = process.cwd(), directory = path.join(root, ".local", "safety-ui-" + randomUUID());
mkdirSync(directory, { recursive: true });
for (const name of ["src", "public", "package.json", "package-lock.json", "tsconfig.json", "postcss.config.mjs"]) if (existsSync(path.join(root, name))) cpSync(path.join(root, name), path.join(directory, name), { recursive: true });
writeFileSync(path.join(directory, "next.config.ts"), `export default { devIndicators:false, turbopack:{root:${JSON.stringify(root)}} };`);
const port = 39000 + Math.floor(Math.random() * 1000), origin = `http://localhost:${port}`, secret = "synthetic-safety-ui-secret-".repeat(3);
const pool = await testPool();
const email = "safety-ui-" + randomUUID() + "@example.invalid", password = "Synthetic-safety-ui-password-2026";
const config = { baseURL: origin, secret, databaseURL: db.href, clientId: "synthetic", clientSecret: "synthetic" };
const auth = betterAuth(buildAuthOptions(config, pool, async () => {}));
const signup = await auth.api.signUpEmail({ body: { email, password, name: "Synthetic UI" } });
const owner = signup.user.id;
await pool.query('UPDATE "user" SET "emailVerified"=true WHERE id=$1', [owner]);
const response = await auth.api.signInEmail({ body: { email, password }, asResponse: true }); assert.equal(response.status, 200);
const sessionCookies = response.headers.getSetCookie().map(c => { const pair = c.split(";")[0], i = pair.indexOf("="); return { name: pair.slice(0, i), value: pair.slice(i + 1), url: origin }; });
const fixture = safetyFixture(), date = new Date().toISOString().slice(0, 10);
fixture.transactions[0].date = date; fixture.transactions[0].amount = 850; fixture.budgets[0].date = date.slice(0, 7) + "-01";
const setup = { version: 1, displayName: "Synthetic UI", occupation: "student", language: "en", wallets: fixture.wallets.map(({ archived, ...w }) => w), expenseCategories: ["Dining"], incomeCategories: ["Salary"], commitments: [], reserves: fixture.wallets.map(w => ({ walletId: w.id, amount: 100 })) };
await pool.query("INSERT INTO finbridge_onboarding(user_id,data) VALUES($1,$2)", [owner, JSON.stringify(setup)]);
const workspace = { wallets: fixture.wallets.map(w => ({ ...w, type: "cash" })), transactions: fixture.transactions.map(t => ({ ...t, title: "Synthetic dining", note: "" })), goals: fixture.budgets.map(b => ({ ...b, kind: "budget", saved: 0, direction: "", person: "" })), categories: ["Dining", "Salary"], categoryMeta: { Dining: { type: "expense", icon: "", children: [] } }, fixedExpenses: [], recurring: [], rules: [], settings: { name: "Synthetic UI", language: "English", theme: "light", onboardingCompleted: date } };

const env = { ...process.env, NODE_ENV: "development", DATABASE_URL: db.href, BETTER_AUTH_URL: origin, BETTER_AUTH_SECRET: secret, GOOGLE_CLIENT_ID: "synthetic", GOOGLE_CLIENT_SECRET: "synthetic", AUTH_EMAIL_MODE: "", AUTH_EMAIL_FROM: "", BREVO_API_KEY: "", SMTP_HOST: "", SMTP_FROM: "", SAFETY_EMAIL_ENABLED: "false", SAFETY_CRON_SECRET: "", FINBRIDGE_DEMO_MODE: "false" };
const server = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", directory, "-p", String(port)], { cwd: directory, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
let logs = ""; server.stdout.on("data", c => { logs += c; }); server.stderr.on("data", c => { logs += c; });
let browser, page;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  for (let i = 0; i < 120; i++) { if (/Ready in/.test(logs)) break; if (server.exitCode !== null) throw new Error(logs.slice(-3000)); await pause(500); }
  const executablePath = process.env.CHROME_BIN || ["C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); await context.addCookies(sessionCookies);
  await context.addInitScript(({owner,workspace}) => { const key = "finbridge-workspace-v1:" + encodeURIComponent(owner); if (!localStorage.getItem(key)) localStorage.setItem(key,JSON.stringify(workspace)); localStorage.setItem("finbridge-preferred-language","en"); }, {owner,workspace});
  page = await context.newPage(); const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.setDefaultTimeout(30000);
  await page.goto(origin + "/app/safetyAlerts", { timeout: 120000 });
  await page.getByRole("button", { name: "Import to database", exact: true }).click();
  await page.getByRole("heading", { name: "Safety thresholds & alerts", exact: true }).waitFor();
  await page.getByRole("heading", { name: "Start with a threshold that matters to you" }).waitFor();
  await page.screenshot({ path: path.join(directory, "desktop-empty.png"), fullPage: true });
  await page.getByRole("button", { name: "Create alert", exact: true }).first().click();
  await page.getByRole("heading", { name: "What would you like to monitor?", exact: true }).waitFor();
  await page.getByRole("combobox", { name: /^Choose scope/ }).selectOption("budget-1");
  await page.getByLabel("Alert name", { exact: true }).fill("Dining safety");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  assert.equal(await page.locator("fieldset").count(), 3);
  await page.screenshot({ path: path.join(directory, "desktop-threshold.png"), fullPage: true });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  assert.equal(await page.getByRole("checkbox").isDisabled(), true);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Activate alert", exact: true }).click();
  await page.getByRole("heading", { name: "Dining safety", exact: true }).waitFor();
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Dining safety", exact: true }) });
  await card.getByText("Spending threshold reached", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await card.getByText("Paused", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).waitFor();
  assert.ok((await pool.query("SELECT COUNT(*)::int AS n FROM finbridge_safety_events WHERE user_id=$1", [owner])).rows[0].n >= 1);
  await page.screenshot({ path: path.join(directory, "desktop-rules.png"), fullPage: true });
  await page.getByRole("tab", { name: /Alert history/ }).click();
  await page.getByRole("button", { name: "Mark all as read", exact: true }).click();
  await page.getByRole("button", { name: "Mark all as read", exact: true }).isDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [value, title] of [["Tiếng Việt", "Ngưỡng an toàn & cảnh báo"], ["中文", "安全阈值与提醒"], ["English", "Safety thresholds & alerts"]]) {
    await page.getByRole("combobox", { name: /Display language|Ngôn ngữ hiển thị|显示语言/ }).selectOption(value);
    await page.getByRole("heading", { name: title, exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "No horizontal overflow at 390px");
    assert.equal(await page.evaluate(() => [...document.querySelectorAll(".fb-home-header a, .fb-home-header button, .fb-home-header select")].every(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })), true, "Header controls are not clipped");
    await page.screenshot({ path: path.join(directory, "mobile-" + (value === "中文" ? "zh" : value === "English" ? "en" : "vi") + ".png"), fullPage: true });
  }
  await page.getByRole("tab", { name: "Alert rules", exact: true }).click();
  await page.getByRole("button", { name: "Create alert", exact: true }).first().click();
  await page.getByRole("button", { name: /Wallet reserve/ }).click();
  await page.getByRole("combobox", { name: /^Choose scope/ }).selectOption("bank");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.screenshot({ path: path.join(directory, "mobile-wizard.png"), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.getByRole("button", { name: "Choose theme", exact: true }).click();
  await page.screenshot({ path: path.join(directory, "mobile-dark.png"), fullPage: true });
  assert.deepEqual(errors, []);
  const second = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); await second.addCookies(sessionCookies);
  const secondPage = await second.newPage(); await secondPage.goto(origin + "/app/safetyAlerts");
  await secondPage.getByRole("heading", { name: "Dining safety", exact: true }).waitFor();
  assert.equal(await secondPage.evaluate(() => Object.keys(localStorage).some(k => k.startsWith("finbridge-workspace-v1:"))), false);
  await secondPage.goto(origin + "/app/createBudget");
  await secondPage.getByRole("button", { name: "Add category", exact: true }).click();
  await secondPage.getByLabel("New category name", { exact: true }).fill("Synthetic Books");
  await secondPage.getByRole("button", { name: "Add and select", exact: true }).click();
  // The global success banner is intentionally omitted after saving. Assert
  // durable storage directly instead of relying on that presentation detail.
  for (let attempt=0;attempt<80;attempt++) {
    if ((await pool.query("SELECT 1 FROM finbridge_categories WHERE user_id=$1 AND name='Synthetic Books' AND deleted_at IS NULL",[owner])).rowCount) break;
    await pause(150);
  }
  assert.equal((await pool.query("SELECT 1 FROM finbridge_categories WHERE user_id=$1 AND name='Synthetic Books'", [owner])).rowCount,1);
  assert.equal((await pool.query("SELECT 1 FROM finbridge_wallet_categories l JOIN finbridge_categories c ON c.user_id=l.user_id AND c.id=l.category_id WHERE l.user_id=$1 AND c.name='Synthetic Books' AND l.deleted_at IS NULL", [owner])).rowCount,1);
  await secondPage.reload();
  await secondPage.getByRole("option", { name: "Synthetic Books", exact: true }).waitFor({state:"attached"});
  assert.equal(await page.evaluate(owner => localStorage.getItem("finbridge-workspace-v1:" + encodeURIComponent(owner)),owner),JSON.stringify(workspace));
  await second.close();
  console.log("PASS: explicit local import with unchanged backup, new budget category in PostgreSQL, grouped actual/forecast alerts, second browser, EN/VI/ZH and 390px overflow");
  console.log("Screenshots:", directory);
} catch (e) { console.error(logs.slice(-2500)); if (page) { await page.screenshot({ path: path.join(directory, "failure.png"), fullPage: true }); console.error((await page.locator("main").innerText()).slice(0, 2500)); console.error("Failure screenshot:", path.join(directory, "failure.png")); } throw e; }
finally {
  if (browser) await browser.close();
  if (server.pid && process.platform === "win32") { try { execFileSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }); } catch { /* Already exited. */ } } else server.kill();
  await pause(1000);
  await pool.query("DELETE FROM finbridge_onboarding WHERE user_id=$1", [owner]);
  await pool.query('DELETE FROM "session" WHERE "userId"=$1', [owner]); await pool.query('DELETE FROM "account" WHERE "userId"=$1', [owner]); await cleanupFinance(pool, [owner]); await pool.end();
}
