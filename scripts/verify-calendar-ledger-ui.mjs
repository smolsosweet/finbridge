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
const root = process.cwd(), directory = path.join(root, ".local", "calendar-ledger-" + randomUUID());
mkdirSync(directory, { recursive: true });
for (const name of ["src", "public", "package.json", "package-lock.json", "tsconfig.json", "postcss.config.mjs"]) cpSync(path.join(root, name), path.join(directory, name), { recursive: true });
writeFileSync(path.join(directory, "next.config.ts"), `export default { devIndicators:false, turbopack:{root:${JSON.stringify(root)}} };`);
const port = 40000 + Math.floor(Math.random() * 1000), origin = `http://localhost:${port}`, secret = "synthetic-refinements-secret-".repeat(3);
const config = { baseURL: origin, secret, databaseURL: process.env.AUTH_TEST_DATABASE_URL, clientId: "synthetic", clientSecret: "synthetic" };
const auth = betterAuth(buildAuthOptions(config, pool, async () => {}));
const email = "refinements-" + randomUUID() + "@example.invalid", password = "Synthetic-refinements-password-2026";
const signup = await auth.api.signUpEmail({ body: { email, password, name: "Synthetic UI" } }), owner = signup.user.id;
await pool.query('UPDATE "user" SET "emailVerified"=true WHERE id=$1', [owner]);
const response = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
assert.equal(response.status, 200);
const cookies = response.headers.getSetCookie().map(c => { const pair = c.split(";")[0], i = pair.indexOf("="); return { name: pair.slice(0, i), value: pair.slice(i + 1), url: origin }; });
const date = new Date().toISOString().slice(0, 10), workspace = workspaceFixture();
workspace.settings = { ...workspace.settings, name: "Synthetic UI", language: "English", theme: "light", timeZone: "UTC", onboardingCompleted: date };
workspace.wallets.push({id:"bank2",name:"Second USD wallet",currency:"USD",initial:0,type:"cash"});
workspace.transactions[0].date = date + "T23:45:00+07:00";
workspace.transactions.push(
  {...workspace.transactions[0],id:"decimal-a",title:"Decimal expense A",amount:0.1,date},
  {...workspace.transactions[0],id:"decimal-b",title:"Decimal expense B",amount:0.2,date},
  {...workspace.transactions[0],id:"income",title:"Salary received",amount:1200,type:"income",category:"Salary",date},
  {...workspace.transactions[0],id:"cny-expense",title:"CNY recorded expense",amount:12.75,wallet:"ali",date},
  {...workspace.transactions[0],id:"transfer",title:"Internal wallet transfer",amount:100,type:"transfer",targetWallet:"bank2",date}
);
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
  await context.addInitScript(() => localStorage.setItem("finbridge-preferred-language", "en"));
  await page.goto(origin + "/app?tab=planning", {timeout:120000});
  async function openCalendar() {
    await page.getByRole("button",{name:"Calendar",exact:true}).click();
    await page.getByRole("dialog",{name:"Calendar Ledger",exact:true}).waitFor();
  }
  await openCalendar();
  const dialog = page.getByRole("dialog",{name:"Calendar Ledger",exact:true});
  await dialog.locator('.fb-cal-day-cell').filter({has:page.locator('.fb-cal-day-num')}).first().waitFor();
  await dialog.locator('.fb-cal-day-cell[aria-label^="' + date + ':"]').click();
  assert.equal(await dialog.locator(".fb-cal-tx-card").count(),5,"timestamp expense must appear with four other USD records");
  await dialog.getByText("Synthetic dining",{exact:true}).waitFor();
  assert.equal(await dialog.locator(".fb-cal-summary-item.exp b").textContent().then(value=>value.replaceAll("−","-")),"-850.3 USD","unpaid fixed expenses and transfers must be excluded");
  assert.equal(await dialog.locator(".fb-cal-summary-item.inc b").textContent().then(value=>value.replaceAll("−","-")),"+1,200 USD");
  await dialog.locator(".fb-cal-tx-card.transfer small").filter({hasText:"Wallet transfer"}).waitFor();
  assert.match(await dialog.locator(".fb-cal-tx-card.transfer small").textContent().then(value=>value.replaceAll("−","-")),/Second USD wallet/);
  await dialog.getByRole("combobox",{name:"Currency",exact:true}).selectOption("CNY");
  assert.equal(await dialog.locator(".fb-cal-tx-card").count(),1);
  assert.equal(await dialog.locator(".fb-cal-summary-item.exp b").textContent().then(value=>value.replaceAll("−","-")),"-12.75 CNY");
  assert.equal(await dialog.locator('.fb-cal-day-cell[aria-label^="' + date + ':"] .exp').textContent().then(value=>value.replaceAll("−","-")),"-12.75");
  await dialog.getByRole("combobox",{name:"Currency",exact:true}).selectOption("USD");
  await page.screenshot({path:path.join(directory,"calendar-recorded.png")});
  const chosenDate = date.slice(0,8) + "02";
  await dialog.locator('.fb-cal-day-cell[aria-label^="' + chosenDate + ':"]').click();
  await dialog.getByRole("button",{name:/Add transaction for this date/}).click();
  await page.waitForURL(/\/app\/addTransaction\?date=/);
  assert.equal(await page.locator('input[type="date"]').inputValue(),chosenDate);
  await page.getByRole("textbox",{name:"Item",exact:true}).fill("Calendar persisted transaction");
  await page.getByRole("spinbutton",{name:"Amount",exact:true}).fill("12.34");
  const saved = page.waitForResponse(r=>new URL(r.url()).pathname==="/api/workspace" && r.request().method()==="POST" && r.ok());
  await page.getByRole("button",{name:"Save",exact:true}).click();
  await saved;
  let stored = await workspaceRepository(pool).read(owner);
  let transaction = stored.data.transactions.find(t=>t.title==="Calendar persisted transaction");
  assert.ok(transaction); assert.equal(transaction.date,chosenDate); assert.equal(transaction.amount,12.34);
  assert.equal((await pool.query("SELECT amount::text FROM finbridge_transactions WHERE user_id=$1 AND id=$2 AND deleted_at IS NULL",[owner,transaction.id])).rows[0].amount,"12.3400");
  await page.reload(); await openCalendar();
  await dialog.locator('.fb-cal-day-cell[aria-label^="' + chosenDate + ':"]').click();
  await dialog.getByText("Calendar persisted transaction",{exact:true}).waitFor();
  assert.equal(await dialog.locator(".fb-cal-summary-item.exp b").textContent().then(value=>value.replaceAll("−","-")),"-862.64 USD");
  await dialog.getByRole("button",{name:"Close",exact:true}).click();
  await page.goto(origin + "/app/editTransaction?id=" + transaction.id);
  await page.getByRole("spinbutton",{name:"Amount",exact:true}).fill("22.34");
  const edited = page.waitForResponse(r=>new URL(r.url()).pathname==="/api/workspace" && r.request().method()==="POST" && r.ok());
  await page.getByRole("button",{name:"Save",exact:true}).click(); await edited;
  await page.reload(); await openCalendar();
  assert.equal(await dialog.locator(".fb-cal-summary-item.exp b").textContent().then(value=>value.replaceAll("−","-")),"-872.64 USD");
  // Simulate deletion through the same repository used by the authenticated API.
  stored = await workspaceRepository(pool).read(owner);
  stored.data.transactions = stored.data.transactions.filter(t=>t.id!==transaction.id);
  await workspaceRepository(pool).save(owner,{revision:stored.revision,mutationId:randomUUID(),data:stored.data});
  await page.reload(); await openCalendar();
  assert.equal(await dialog.locator(".fb-cal-summary-item.exp b").textContent().then(value=>value.replaceAll("−","-")),"-850.3 USD");
  assert.equal((await pool.query("SELECT deleted_at IS NOT NULL AS deleted FROM finbridge_transactions WHERE user_id=$1 AND id=$2",[owner,transaction.id])).rows[0].deleted,true);
  stored = await workspaceRepository(pool).read(owner); stored.data.transactions=[];
  await workspaceRepository(pool).save(owner,{revision:stored.revision,mutationId:randomUUID(),data:stored.data});
  await page.reload(); await openCalendar();
  assert.equal(await dialog.locator(".fb-cal-summary-item.exp b").textContent().then(value=>value.replaceAll("−","-")),"-0 USD");
  assert.equal(await dialog.locator(".fb-cal-tx-card").count(),0);
  await dialog.getByText("No transactions on this day.",{exact:true}).waitFor();
  for(let i=0;i<3;i++) await dialog.getByRole("button",{name:"Previous month",exact:true}).click();
  assert.equal(await dialog.locator(".fb-cal-summary-item.exp b").textContent().then(value=>value.replaceAll("−","-")),"-0 USD","empty accounts must never fall back to sample records");
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(directory,"calendar-empty-mobile.png")});
  assert.deepEqual(errors,[]);
  console.log("PASS: calendar reads persisted PostgreSQL transactions; timestamps, decimal currencies, transfers and unpaid bills; add for selected day; edit/reload/delete; empty ledger never shows sample data; mobile layout.");
  console.log("Artifacts:",directory);
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

