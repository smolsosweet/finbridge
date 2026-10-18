// Real browser + isolated PostgreSQL. Seeded FX observations; no provider or bank calls.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { spawn, execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";
import { betterAuth } from "better-auth";
import { buildAuthOptions } from "../src/lib/auth-options.ts";
import { testPool, cleanupFinance, workspaceFixture } from "./workspace-fixtures.mjs";
import { workspaceRepository } from "../src/lib/workspace-repository.ts";
import { internationalTransferRepository, INTERNATIONAL_TRANSFER_SQL } from "../src/lib/international-transfer-repository.ts";
import { TRANSFER_VIEW_COPY } from "../src/components/transfers/transfer-copy.ts";
import { REFERENCE_COPY } from "../src/components/transfers/reference-copy.ts";
nextEnv.loadEnvConfig(process.cwd());
const db = new URL(process.env.AUTH_TEST_DATABASE_URL || "https://invalid.invalid");
if (!["localhost", "127.0.0.1"].includes(db.hostname) || db.pathname !== "/finbridge_auth_test") throw new Error("Isolated test database required");
const { chromium } = createRequire(import.meta.url)(process.env.SAFETY_PLAYWRIGHT_PATH || "C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const root = process.cwd(), directory = path.join(root, ".local", "international-transfers-ui-" + randomUUID());
mkdirSync(directory, { recursive: true });
for (const name of ["src", "public", "package.json", "package-lock.json", "tsconfig.json", "postcss.config.mjs"]) cpSync(path.join(root, name), path.join(directory, name), { recursive: true });
writeFileSync(path.join(directory, "next.config.ts"), `export default { devIndicators:false, turbopack:{root:${JSON.stringify(root)}} };`);
const port = 40000 + Math.floor(Math.random() * 1000), origin = `http://localhost:${port}`, secret = "synthetic-transfer-ui-secret-".repeat(3);
const pool = await testPool(); await pool.query(INTERNATIONAL_TRANSFER_SQL);
const referenceIds = [];
for (const currency of ["CNY", "USD", "AUD"]) {
  const id = randomUUID(); referenceIds.push(id);
  await pool.query("INSERT INTO finbridge_fx_observations(id,base,quote,rate,rate_date,fetched_at,source) VALUES($1,$2,'VND',3864.07,CURRENT_DATE,CURRENT_TIMESTAMP,'Frankfurter')", [id, currency]);
}
const auth = betterAuth(buildAuthOptions({ baseURL: origin, secret, databaseURL: db.href, clientId: "synthetic", clientSecret: "synthetic" }, pool, async () => {}));
const email = "transfer-ui-" + randomUUID() + "@example.invalid", password = "Synthetic-transfer-ui-password-2026";
const signup = await auth.api.signUpEmail({ body: { email, password, name: "Synthetic UI" } }), owner = signup.user.id;
await pool.query('UPDATE "user" SET "emailVerified"=true WHERE id=$1', [owner]);
const response = await auth.api.signInEmail({ body: { email, password }, asResponse: true }); assert.equal(response.status, 200);
const cookies = response.headers.getSetCookie().map(c => { const pair = c.split(";")[0], i = pair.indexOf("="); return { name: pair.slice(0, i), value: pair.slice(i + 1), url: origin }; });
const fixture = workspaceFixture(), date = new Date().toISOString().slice(0, 10);
await workspaceRepository(pool).save(owner, { revision: 0, mutationId: randomUUID(), data: fixture });
const baseline = (await workspaceRepository(pool).read(owner)).data;
await pool.query("INSERT INTO finbridge_onboarding(user_id,data) VALUES($1,$2)", [owner, JSON.stringify({ version: 1, displayName: "Synthetic UI", occupation: "student", language: "en", wallets: fixture.wallets.map(({ type, ...w }) => w), expenseCategories: ["Dining"], incomeCategories: ["Salary"], commitments: [], reserves: fixture.wallets.map(w => ({ walletId: w.id, amount: 0 })) })]);
const env = { ...process.env, NODE_ENV: "development", DATABASE_URL: db.href, BETTER_AUTH_URL: origin, BETTER_AUTH_SECRET: secret, GOOGLE_CLIENT_ID: "synthetic", GOOGLE_CLIENT_SECRET: "synthetic", AUTH_EMAIL_MODE: "", AUTH_EMAIL_FROM: "", BREVO_API_KEY: "", SMTP_HOST: "", SMTP_FROM: "", SAFETY_EMAIL_ENABLED: "false", FINBRIDGE_DEMO_MODE: "false" };
const server = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", directory, "-p", String(port)], { cwd: directory, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
let logs = "", browser, page; server.stdout.on("data", c => logs += c); server.stderr.on("data", c => logs += c);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  for (let i = 0; i < 120; i++) { if (/Ready in/.test(logs)) break; if (server.exitCode !== null) throw new Error("Test server stopped"); await pause(500); }
  const executablePath = process.env.CHROME_BIN || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } }); await context.addCookies(cookies);
  await context.addInitScript(() => { if (!localStorage.getItem("finbridge-preferred-language-v1")) localStorage.setItem("finbridge-preferred-language-v1", "en"); });
  await context.route("**/api/ai/**", route => route.fulfill({ status: 503, json: { error: "AI_NOT_CONFIGURED" } }));
  page = await context.newPage(); page.setDefaultTimeout(30000); const errors = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto(origin + "/app?tab=transfers", { timeout: 120000 });
  const referencePanel = page.getByRole("region", { name: REFERENCE_COPY.en.title, exact: true });
  await referencePanel.getByRole("button", { name: REFERENCE_COPY.en.calculate, exact: true }).waitFor({ state: "visible" });
  let droppedEstimate = false;
  await context.route("**/api/international-transfers/reference", async route => {
    if (route.request().method() === "POST" && !droppedEstimate) {
      droppedEstimate = true; const accepted = await route.fetch(); assert.equal(accepted.status(), 200);
      await route.fulfill({ status: 503, json: { error: "UNAVAILABLE" } });
    } else await route.continue();
  });
  await referencePanel.getByRole("button", { name: REFERENCE_COPY.en.calculate, exact: true }).click();
  await referencePanel.getByRole("button", { name: REFERENCE_COPY.en.retry, exact: true }).click();
  let estimateModal = page.getByRole("dialog", { name: REFERENCE_COPY.en.details, exact: true });
  await estimateModal.waitFor();
  assert.ok((await estimateModal.innerText()).includes("3,864,070"));
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM finbridge_transfer_estimates WHERE user_id=$1", [owner])).rows[0].n, 1);
  await page.screenshot({ path: path.join(directory, "reference-estimate-desktop.png") });
  await page.keyboard.press("Escape");
  await page.reload();
  await referencePanel.locator("summary").click();
  await referencePanel.getByRole("button").filter({ hasText: "3,864,070" }).click();
  estimateModal = page.getByRole("dialog", { name: REFERENCE_COPY.en.details, exact: true }); await estimateModal.waitFor();
  await page.keyboard.press("Escape");
  await page.getByText(REFERENCE_COPY.en.test, { exact: true }).click();
  await page.getByRole("button", { name: "Add education bill", exact: true }).first().click();
  let dialog = page.getByRole("dialog", { name: "Add education bill", exact: true });
  await dialog.getByLabel("Bill name", { exact: true }).fill("Synthetic October tuition");
  await dialog.getByLabel("Unique bill reference", { exact: true }).fill("SYNTHETIC-OCT-2026");
  await dialog.getByRole("button", { name: "Save bill", exact: true }).click(); await dialog.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Compare routes", exact: true }).click();
  await page.getByRole("heading", { name: "Bank A · simulated", exact: true }).waitFor();
  const bankB = page.locator("article").filter({ has: page.getByRole("heading", { name: "Bank B · reference", exact: true }) });
  assert.equal(await bankB.getByRole("button", { name: "Review this option", exact: true }).isDisabled(), true);
  await page.screenshot({ path: path.join(directory, "compare-desktop.png") });
  const bankA = page.locator("article").filter({ has: page.getByRole("heading", { name: "Bank A · simulated", exact: true }) });
  await bankA.getByRole("button", { name: "Review this option", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Review transfer", exact: true });
  assert.equal(await dialog.getByRole("button", { name: "Approve this draft", exact: true }).isDisabled(), true);
  assert.equal(await dialog.getByRole("button", { name: "Complete test transfer", exact: true }).count(), 0);
  await dialog.getByRole("checkbox").check(); await dialog.getByRole("button", { name: "Approve this draft", exact: true }).click();
  await dialog.getByRole("button", { name: "Complete test transfer", exact: true }).waitFor();
  await page.screenshot({ path: path.join(directory, "review-desktop.png") });
  let dropped = false;
  await context.route("**/api/international-transfers", async route => {
    const req = route.request();
    if (req.method() === "POST" && req.postDataJSON().action === "execute" && !dropped) {
      dropped = true; const accepted = await route.fetch(); assert.equal(accepted.status(), 200);
      await route.fulfill({ status: 503, json: { error: "UNAVAILABLE" } });
    } else await route.continue();
  });
  await dialog.getByRole("button", { name: "Complete test transfer", exact: true }).click();
  await dialog.getByRole("button", { name: "Retry", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Test transfer receipt", exact: true });
  await dialog.getByText("The test transfer is complete. No real payment was sent. This bill cannot be completed again.", { exact: true }).waitFor();
  const record = await internationalTransferRepository(pool).read(owner), completed = record.plans.filter(p => p.status === "completed");
  assert.equal(completed.length, 1); assert.equal(record.audit.filter(a => a.event === "completed").length, 1);
  assert.equal(record.accounts.find(a => a.id === "BANK_A").balance, 100000000 - completed[0].quote.total);
  const unchanged = (await workspaceRepository(pool).read(owner)).data;
  assert.deepEqual(unchanged.transactions, baseline.transactions); assert.deepEqual(unchanged.wallets, baseline.wallets);
  await page.screenshot({ path: path.join(directory, "receipt-desktop.png") });
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page.reload(); await page.getByText(REFERENCE_COPY.en.test, { exact: true }).click(); await page.getByRole("tab", { name: /^Transferred/ }).click(); await page.getByRole("button", { name: "Test transfer receipt", exact: true }).click();
  await page.getByRole("dialog", { name: "Test transfer receipt", exact: true }).waitFor(); await page.keyboard.press("Escape");
  await page.getByText("Payment controls", { exact: true }).click();
  await page.getByRole("button", { name: "Pause new transfers", exact: true }).click();
  await page.getByText(/Transfers paused\. Existing receipts are kept/).waitFor();
  await page.getByRole("button", { name: "Resume transfers", exact: true }).click();
  await page.getByRole("button", { name: "Pause new transfers", exact: true }).waitFor();
  const repo = internationalTransferRepository(pool);
  const mutate = command => repo.mutate(owner, { ...command, mutationId: randomUUID() });
  for (let i = 0; i < 12; i++) {
    // Fixture-only quota reset for this disposable user in finbridge_auth_test.
    await pool.query("UPDATE finbridge_transfer_controls SET requests=0 WHERE user_id=$1", [owner]);
    let result = await mutate({ action: "saveBill", bill: { schoolId: "shenzhen", title: `List fixture ${i}`, reference: `LIST-${i}`, amount: "1.00", dueDate: completed[0].bill.dueDate } });
    const b = result.bills.find(b => b.reference === `LIST-${i}`);
    if (i < 5) {
      result = await mutate({ action: "quote", id: b.id, version: b.version });
      const q = result.quotes.find(q => q.billId === b.id && q.provider === "ALIPAY");
      result = await mutate({ action: "draft", quoteId: q.id });
      const id = result.resultId;
      await mutate({ action: "approve", id, acknowledge: true });
      await mutate({ action: "execute", id });
    }
  }
  await pool.query("UPDATE finbridge_transfer_controls SET requests=0 WHERE user_id=$1", [owner]);
  await page.reload();
  await page.getByText(REFERENCE_COPY.en.test, { exact: true }).click();
  const rows = page.getByTestId("transfer-list").locator(":scope > article");
  for (const tab of [/^Not transferred/, /^Transferred/, /^Activity history/]) {
    await page.getByRole("tab", { name: tab }).click();
    assert.equal(await rows.count(), 5, "Every category starts at five rows");
    await page.getByRole("button", { name: /^Show more/ }).click();
    assert.ok(await rows.count() > 5 && await rows.count() <= 10);
    await page.getByRole("button", { name: "Show less", exact: true }).click();
    assert.equal(await rows.count(), 5);
    await page.screenshot({ path: path.join(directory, `list-${await page.getByTestId("transfer-list").getAttribute("data-view")}-desktop.png`) });
  }
  await page.getByRole("tab", { name: /^Transferred/ }).click();
  assert.equal(await rows.getByRole("button", { name: "Test transfer receipt", exact: true }).count(), 5);
  assert.ok(!(await page.getByTestId("transfer-list").innerText()).includes("Needs a new quote"));
  assert.ok(!(await page.getByTestId("transfer-list").innerText()).includes("Awaiting review"));
  await page.getByRole("tab", { name: /^Not transferred/ }).click();
  await page.getByRole("textbox", { name: "Search this list" }).fill("LIST-11");
  assert.equal(await rows.count(), 1);
  assert.ok((await rows.innerText()).includes("List fixture 11"));
  for (const language of [{ code: "vi", title: "Chuyển tiền quốc tế", receipt: "Biên nhận chuyển tiền thử" }, { code: "zh", title: "国际汇款", receipt: "测试汇款回执" }, { code: "en", title: "International transfers", receipt: "Test transfer receipt" }]) {
    await page.evaluate(code => localStorage.setItem("finbridge-preferred-language-v1", code), language.code);
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto(origin + "/app?tab=transfers");
    const copy = TRANSFER_VIEW_COPY[language.code];
    await page.getByRole("heading", { name: REFERENCE_COPY[language.code].title, exact: true }).waitFor();
    await page.getByText(REFERENCE_COPY[language.code].test, { exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(directory, `reference-${language.code}-mobile.png`) });
    for (const key of ["pending", "history", "completed"]) {
      await page.getByRole("tab", { name: new RegExp("^" + copy[key]) }).click();
      assert.equal(await rows.count(), 5);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Mobile list must not overflow");
      await page.screenshot({ path: path.join(directory, `${key}-${language.code}-mobile.png`) });
    }
    await page.getByRole("button", { name: language.receipt, exact: true }).first().waitFor();
    assert.ok((await page.locator("main").innerText()).includes(language.title));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Mobile layout must not overflow");
    await page.screenshot({ path: path.join(directory, "transfers-" + language.code + "-mobile.png") });
    await page.getByRole("button", { name: language.receipt, exact: true }).first().click();
    const modal = page.getByRole("dialog"); assert.ok(await modal.isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: path.join(directory, "receipt-" + language.code + "-mobile.png") }); await page.keyboard.press("Escape");
  }
  assert.deepEqual(errors, []); console.log("PASS: persisted FX estimate and snapshot; lost-response estimate retry; sandbox workflow; approval; single receipt; database reload; pause/resume; tracked wallets unchanged; three distinct lists; five-row batches; Show more/less; search; EN/VI/ZH; 390px bounds."); console.log("Screenshots:", directory);
} catch (e) { if (page) { await page.screenshot({ path: path.join(directory, "failure.png"), fullPage: true }); console.error((await page.locator("body").innerText()).slice(-3500)); } console.error("Evidence:", directory); console.error(logs.slice(-1800)); throw e; }
finally {
  if (browser) await browser.close();
  if (server.pid && process.platform === "win32") { try { execFileSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }); } catch {} } else server.kill();
  await pool.query("DELETE FROM finbridge_transfer_estimates WHERE user_id=$1", [owner]);
  await pool.query("DELETE FROM finbridge_transfer_estimate_limits WHERE user_id=$1", [owner]);
  await pool.query("DELETE FROM finbridge_fx_observations WHERE id=ANY($1::uuid[])", [referenceIds]);
  for (const table of ["finbridge_transfer_mutations", "finbridge_transfer_audit", "finbridge_transfer_plans", "finbridge_transfer_quotes", "finbridge_transfer_bills", "finbridge_transfer_accounts", "finbridge_transfer_controls", "finbridge_onboarding"]) await pool.query(`DELETE FROM ${table} WHERE user_id=$1`, [owner]);
  await cleanupFinance(pool, [owner]); await pool.end();
}
