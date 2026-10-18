// Authenticated UI checks use only disposable users in finbridge_auth_test.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawn, execFileSync } from "node:child_process";
import { cpSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import { betterAuth } from "better-auth";
import { buildAuthOptions } from "../src/lib/auth-options.ts";
import { testPool, cleanupFinance } from "./workspace-fixtures.mjs";
import { workspaceRepository } from "../src/lib/workspace-repository.ts";
import { safetyRepository } from "../src/lib/safety-repository.ts";
nextEnv.loadEnvConfig(process.cwd());
const db = new URL(process.env.AUTH_TEST_DATABASE_URL || "https://invalid.invalid");
if (!["localhost", "127.0.0.1"].includes(db.hostname) || db.pathname !== "/finbridge_auth_test") throw new Error("Only isolated finbridge_auth_test is allowed");
const playwrightPath = process.env.SAFETY_PLAYWRIGHT_PATH || "C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright";
const { chromium } = createRequire(import.meta.url)(playwrightPath);
const root = process.cwd(), directory = path.join(root, ".local", "planning-notifications-ui-" + randomUUID());
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

const date = new Date().toISOString().slice(0,10);
const workspace = {
 wallets:[{id:"bank",name:"Synthetic VND wallet",currency:"VND",initial:100000,type:"cash"},{id:"usd",name:"Synthetic USD wallet",currency:"USD",initial:1000,type:"cash"}],
 transactions:[{id:"overspend",title:"Synthetic dining",amount:125,type:"expense",wallet:"usd",category:"Housing",date,note:""}],goals:[{id:"budget-1",kind:"budget",title:"Synthetic housing budget",amount:100,saved:0,currency:"USD",wallet:"usd",category:"Housing",date:date.slice(0,7)+"-01",cycle:"monthly",direction:"",person:""}],
 fixedExpenses:[{id:"rent",budgetId:"",walletId:"bank",title:"Synthetic rent",amount:200000,category:"Housing",dueDate:date,recurrence:"once",active:true}],
 recurring:[],rules:[],categories:["Housing","Salary"],categoryMeta:{Housing:{type:"expense",icon:"",children:[]},Salary:{type:"income",icon:"",children:[]}},
 settings:{name:"Synthetic UI",language:"English",theme:"light",timeZone:"UTC",onboardingCompleted:date}
};
const setup={version:1,displayName:"Synthetic UI",occupation:"student",language:"en",wallets:workspace.wallets.map(({type,...w})=>w),expenseCategories:["Housing"],incomeCategories:["Salary"],commitments:[],reserves:workspace.wallets.map(w=>({walletId:w.id,amount:0}))};
await pool.query("INSERT INTO finbridge_onboarding(user_id,data) VALUES($1,$2)",[owner,JSON.stringify(setup)]);
await workspaceRepository(pool).save(owner,{revision:0,mutationId:randomUUID(),data:workspace});
const persistedPlanning=(await workspaceRepository(pool).read(owner)).data;
const env={...process.env,NODE_ENV:"development",DATABASE_URL:db.href,BETTER_AUTH_URL:origin,BETTER_AUTH_SECRET:secret,GOOGLE_CLIENT_ID:"synthetic",GOOGLE_CLIENT_SECRET:"synthetic",AUTH_EMAIL_MODE:"",AUTH_EMAIL_FROM:"",BREVO_API_KEY:"",SMTP_HOST:"",SMTP_FROM:"",SAFETY_EMAIL_ENABLED:"false",SAFETY_CRON_SECRET:"",FINBRIDGE_DEMO_MODE:"false"};
const server=spawn(process.execPath,[path.join(root,"node_modules/next/dist/bin/next"),"dev",directory,"-p",String(port)],{cwd:directory,env,windowsHide:true,stdio:["ignore","pipe","pipe"]});
let logs="";server.stdout.on("data",c=>logs+=c);server.stderr.on("data",c=>logs+=c);
let browser,page;const pause=ms=>new Promise(r=>setTimeout(r,ms));
try {
 for(let i=0;i<120;i++){if(/Ready in/.test(logs))break;if(server.exitCode!==null)throw new Error(logs.slice(-2000));await pause(500);}
 const executablePath=process.env.CHROME_BIN||["C:/Program Files (x86)/Google/Chrome/Application/chrome.exe","C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
 browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.addCookies(sessionCookies);
 await context.addInitScript(()=>{if(!localStorage.getItem("finbridge-preferred-language-v1"))localStorage.setItem("finbridge-preferred-language-v1","en");});
 // Keep deterministic explanations local; never call the AI provider during this UI check.
 await context.route("**/api/ai/proactive-feed",route=>route.fulfill({status:503,json:{error:"AI_NOT_CONFIGURED"}}));
 page=await context.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));page.setDefaultTimeout(30000);
 await page.goto(origin+"/app?tab=tools",{timeout:120000});
 const planningTabs=page.locator(".fb-planning-tabs");
 await planningTabs.getByRole("tab",{name:/^Budgets/}).waitFor();
 assert.equal(await planningTabs.getByRole("tab").count(),2);
 assert.equal(await planningTabs.getByRole("tab",{name:/^Budgets/}).getAttribute("aria-selected"),"true");
 assert.equal(await page.locator(".fb-alert-bell").count(),0);
 assert.equal(await page.locator(".fb-planning-segmented,.fb-planning-analysis,.fb-weekly-chart-card,.fb-scenario-planner,.fb-sandbox-controls").count(),0,"Planning only contains budget and fixed-expense management");
 assert.equal(await page.getByLabel("Select reporting month",{exact:true}).count(),0);
 assert.equal(await page.locator(".fb-safety-planning-link").count(),0,"Planning must not repeat the standalone safety entry");
 const sidebar=page.locator(".fb-sidebar-nav");
 await sidebar.getByRole("button",{name:"Safety thresholds",exact:true}).click();
 await page.waitForURL(/\/app\/safetyAlerts$/);
 await page.locator(".fb-header-page-copy>strong").filter({hasText:"Safety thresholds & alerts"}).waitFor();
 assert.equal(await sidebar.getByRole("button",{name:"Safety thresholds",exact:true}).getAttribute("aria-current"),"page");
 assert.equal(await sidebar.getByRole("button",{name:"Planning",exact:true}).getAttribute("aria-current"),null);
 await page.getByRole("button",{name:"Create alert",exact:true}).click();
 await page.getByRole("button",{name:"Back to Safety Thresholds",exact:true}).click();
 assert.equal(await page.locator(".fb-safety-planning-link").count(),0);
 await page.reload();
 await page.getByRole("button",{name:"Create alert",exact:true}).waitFor();
 assert.equal(await sidebar.getByRole("button",{name:"Safety thresholds",exact:true}).getAttribute("aria-current"),"page");
 await page.screenshot({path:path.join(directory,"safety-sidebar-desktop.png")});
 await sidebar.getByRole("button",{name:"Planning",exact:true}).click();
 await planningTabs.getByRole("tab",{name:/^Budgets/}).waitFor();
 await page.locator("#budget-budget-1").waitFor({state:"visible"});
 await planningTabs.getByRole("tab",{name:/^Fixed expenses/}).click();
 await page.locator("#fixed-rent").waitFor({state:"visible"});
 assert.equal(await page.getByRole("button",{name:"Create fixed expense",exact:true}).first().isEnabled(),true);
 assert.equal(await page.locator("#budget-budget-1").count(),0);
 await planningTabs.getByRole("tab",{name:/^Budgets/}).click();
 await page.locator("#budget-budget-1").waitFor({state:"visible"});
 assert.equal(await page.getByRole("button",{name:"Create budget",exact:true}).first().isEnabled(),true);
 const planningRecord=(await workspaceRepository(pool).read(owner)).data;
 assert.deepEqual(planningRecord.goals,persistedPlanning.goals,"Removing reports must preserve budgets");
 assert.deepEqual(planningRecord.fixedExpenses,persistedPlanning.fixedExpenses,"Removing reports must preserve planned bills");
 await page.screenshot({path:path.join(directory,"planning-management-desktop.png")});

 // The home chart must use persisted workspace transactions by default. Its
 // wallet shortcut must carry an explicit current-month filter into history.
 await page.goto(origin+"/app");
 let bell=page.getByRole("button",{name:/^Open notifications/});
 await bell.click();
 let homeNotifications = page.getByRole("dialog",{name:"Notifications",exact:true});
 assert.equal(await homeNotifications.locator("article").count(),2);
 await homeNotifications.getByRole("button",{name:"Close notifications",exact:true}).click();
 assert.equal(await page.getByTestId("home-attention").count(),0,"Home must not duplicate notification items");
 await page.getByLabel("Select account",{exact:true}).selectOption("usd");
 await page.locator(".fb-chart-bar-expense").waitFor({state:"visible"});
 assert.equal(await page.locator(".fb-env-badge").count(),0,"The live workspace chart must not be labelled simulated");
 await page.getByRole("button",{name:"Manage wallet Synthetic USD wallet",exact:true}).click();
 const walletDialog=page.getByRole("dialog",{name:"Manage wallet: Synthetic USD wallet",exact:true});
 await walletDialog.getByRole("button",{name:"View wallet transaction history",exact:true}).click();
 await page.waitForURL(url=>url.searchParams.get("tab")==="transactions"&&url.searchParams.get("wallet")==="usd"&&url.searchParams.get("type")==="all"&&url.searchParams.get("category")==="all");
 await page.getByRole("heading",{name:"Synthetic dining",exact:true}).waitFor({state:"visible"});
 await page.goto(origin+"/app/walletSettings?wallet=usd");
 const linkedWalletDialog=page.getByRole("dialog",{name:"Manage wallet: Synthetic USD wallet",exact:true});
 await linkedWalletDialog.waitFor({state:"visible"});
 await page.keyboard.press("Escape");
 await page.goto(origin+"/app?tab=tools");
 await planningTabs.getByRole("tab",{name:/^Budgets/}).waitFor();
 bell=page.getByRole("button",{name:/^Open notifications/});
 await bell.click();
 let dialog=page.getByRole("dialog",{name:"Notifications",exact:true});
 assert.equal(await dialog.locator("article").count(),2);
 let cash=dialog.locator("article").filter({has:page.getByRole("heading",{name:/Synthetic VND wallet/})});
 await cash.locator("summary").click();
 await cash.getByText("Cause",{exact:true}).waitFor();
 await cash.getByText("Suggested action",{exact:true}).waitFor();
 await cash.getByText(/Assumptions \/ limits:/).waitFor();
 assert.equal(await bell.getAttribute("aria-label"),"Open notifications, 1");
 await dialog.getByRole("button",{name:"Edit reserves",exact:true}).click();
 await dialog.getByLabel("Synthetic VND wallet · VND",{exact:true}).fill("75000");
 await dialog.getByRole("button",{name:"Save reserves",exact:true}).click();
 await cash.getByRole("button",{name:"Handled",exact:true}).click();
 assert.equal(await cash.getByRole("button",{name:"Handled",exact:true}).isDisabled(),true);
 async function saved(check){for(let i=0;i<80;i++){const row=(await pool.query("SELECT data FROM finbridge_workspaces WHERE user_id=$1",[owner])).rows[0];if(row&&check(row.data))return;await pause(150);}throw new Error("Expected settings were not saved");}
 await saved(s=>JSON.parse(s.settings.dismissedFinancialAlerts||"[]").length===1&&JSON.parse(s.settings.reserveByWallet||"{}").bank===75000);
 await dialog.getByRole("button",{name:"Close notifications",exact:true}).click();
 assert.equal(await bell.evaluate(el=>document.activeElement===el),true);
 await page.goto(origin+"/app");
 assert.equal(await page.getByTestId("home-attention").count(),0,"The notification center is the single alert inbox");
 bell=page.getByRole("button",{name:/^Open notifications/});
 await bell.click();
 homeNotifications=page.getByRole("dialog",{name:"Notifications",exact:true});
 await homeNotifications.getByRole("group",{name:"Filter notifications"}).getByRole("button",{name:/^Unread/}).click();
 await homeNotifications.getByRole("button",{name:/^Unread/}).click();
 await homeNotifications.getByRole("button",{name:"Close notifications",exact:true}).click();
 await bell.click();
 assert.equal(await homeNotifications.locator("article").count(),2,"The inbox includes read and handled notification records");
 await homeNotifications.getByRole("button",{name:"Close notifications",exact:true}).click();
 await page.goto(origin+"/app?tab=tools");
 await page.reload();
 await page.getByRole("button",{name:/^Open notifications/}).click();dialog=page.getByRole("dialog",{name:"Notifications",exact:true});
 cash=dialog.locator("article").filter({has:page.getByRole("heading",{name:/Synthetic VND wallet/})});
 await cash.locator("summary").click();
 assert.equal(await cash.getByRole("button",{name:"Handled",exact:true}).isDisabled(),true);
 await dialog.getByRole("button",{name:"Mark all as read",exact:true}).click();
 assert.equal(await page.getByRole("button",{name:"Open notifications",exact:true}).count(),1);
 await saved(s=>JSON.parse(s.settings.readFinancialAlertIds||"[]").length===2);
 await cash.getByRole("button",{name:"Open planning",exact:true}).click();
 await page.waitForURL(/plan=fixed#fixed-rent/);
 await page.locator("#fixed-rent").waitFor({state:"visible"});
 assert.equal(await page.getByRole("dialog",{name:"Notifications",exact:true}).count(),0);
 await page.goto(origin+"/app?tab=tools");
 await page.getByRole("button",{name:/^Open notifications/}).click();dialog=page.getByRole("dialog",{name:"Notifications",exact:true});
 const budget=dialog.locator("article").filter({has:page.getByRole("heading",{name:/Synthetic housing budget/})});
 await budget.locator("summary").click();
 await budget.getByRole("button",{name:"Open planning",exact:true}).click();
 await page.waitForURL(/#budget-budget-1/);
 await page.locator("#budget-budget-1").waitFor({state:"visible"});
 // Add real threshold events only after testing the existing financial feed.
 const safetyRepo=safetyRepository(pool), safetyDoc=await safetyRepo.read(owner);
 await safetyRepo.mutate(owner,safetyDoc.revision,"save",doc=>({...doc,rules:[
  {id:"ui-spend",name:"Synthetic budget threshold",kind:"budget",targetId:"budget-1",basis:"actual",unit:"percent",threshold:80,email:false,active:true},
  {id:"ui-reserve",name:"Synthetic reserve threshold",kind:"reserve",targetId:"bank",basis:"actual",unit:"amount",threshold:200000,email:false,active:true},
 ]}));
 await page.reload();
 bell=page.getByRole("button",{name:"Open notifications, 2",exact:true});await bell.waitFor();await bell.click();
 dialog=page.getByRole("dialog",{name:"Notifications",exact:true});
 assert.equal(await dialog.locator("article").count(),4,"Both sources belong in one center");
 await dialog.getByRole("group",{name:"Filter notifications"}).getByRole("button",{name:/^Unread/}).click();
 const thresholds=dialog.getByRole("region",{name:"Your threshold alerts",exact:true});
 assert.equal(await thresholds.locator("article").count(),2);
 const firstThreshold=thresholds.locator("article").first();await firstThreshold.locator("summary").click();
 assert.equal((await safetyRepo.read(owner)).events.filter(e=>e.read).length,0,"Unread-filter expansion must keep the item visible until explicit acknowledgement");
 await firstThreshold.getByRole("button",{name:"Mark as read",exact:true}).click();
 await page.getByRole("button",{name:"Open notifications, 1",exact:true}).waitFor();
 assert.equal((await safetyRepo.read(owner)).events.filter(e=>e.read).length,1);
 await context.route("**/api/safety",route=>route.request().method()==="POST"?route.fulfill({status:503,json:{error:"UNAVAILABLE"}}):route.continue());
 await dialog.getByRole("button",{name:"Mark all as read",exact:true}).click();
 await dialog.getByText("Some notifications could not be updated. Please try again.",{exact:true}).waitFor();
 assert.equal(await page.getByRole("button",{name:"Open notifications, 1",exact:true}).count(),1,"Failed read must not clear the badge");
 await context.unroute("**/api/safety");
 await dialog.getByRole("button",{name:"Mark all as read",exact:true}).click();
 await page.getByRole("button",{name:"Open notifications",exact:true}).waitFor();
 await dialog.getByText("You're all caught up.",{exact:true}).waitFor();
 const acknowledged=await safetyRepo.read(owner);assert.ok(acknowledged.events.every(e=>e.read));assert.ok(acknowledged.rules.every(r=>r.active));
 await dialog.getByRole("group",{name:"Filter notifications"}).getByRole("button",{name:/^All/}).click();
 await page.screenshot({path:path.join(directory,"unified-notifications-desktop.png")});
 await dialog.getByRole("button",{name:"View alert history",exact:true}).click();await page.waitForURL(/safetyAlerts\?view=history/);
 assert.equal(await page.locator(".fb-alert-bell").count(),0);assert.equal(await page.getByRole("button",{name:"Open notifications",exact:true}).count(),1);
 await page.getByRole("button",{name:"Open notifications",exact:true}).click();
 await page.getByRole("dialog",{name:"Notifications",exact:true}).getByRole("button",{name:"Alert settings",exact:true}).click();
 await page.waitForURL(/\/app\/safetyAlerts$/);
 for(const locale of [
  {code:"en",open:/^Open notifications/,title:"Notifications",close:"Close notifications",all:"Mark all as read",home:"Needs attention today",allAlerts:/View all alerts/,settings:"Settings",safety:"Safety thresholds & alerts",navSafety:"Safety thresholds",backHome:"Back to Home"},
  {code:"vi",open:/^Mở thông báo/,title:"Thông báo",close:"Đóng thông báo",all:"Đánh dấu tất cả đã đọc",home:"Cần chú ý hôm nay",allAlerts:/Xem tất cả cảnh báo/,settings:"Cài đặt",safety:"Ngưỡng an toàn & cảnh báo",navSafety:"Ngưỡng an toàn",backHome:"Quay lại Trang chủ"},
  {code:"zh",open:/^打开通知/,title:"通知",close:"关闭通知",all:"全部标为已读",home:"今日待处理",allAlerts:/查看所有提醒/,settings:"设置",safety:"安全阈值与提醒",navSafety:"安全阈值",backHome:"返回首页"},
 ]){
  await page.evaluate(code=>localStorage.setItem("finbridge-preferred-language-v1",code),locale.code);
  await page.setViewportSize({width:390,height:844});await page.goto(origin+"/app?tab=tools");
  await page.getByRole("button",{name:locale.open}).waitFor();
  const height=await page.evaluate(()=>document.documentElement.scrollHeight);
  await page.getByRole("button",{name:locale.open}).click();dialog=page.getByRole("dialog",{name:locale.title,exact:true});
  await dialog.locator("summary").first().click();
  const bounds=await dialog.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=391&&bounds.y+bounds.height<=844,JSON.stringify(bounds));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight),height);
  await page.screenshot({path:path.join(directory,"notifications-"+locale.code+"-mobile.png")});
  await page.keyboard.press("Escape");assert.equal(await dialog.count(),0);
  assert.equal(await planningTabs.getByRole("tab").count(),2);
  assert.equal(await page.locator(".fb-planning-segmented,.fb-planning-analysis,.fb-weekly-chart-card").count(),0);
  await page.screenshot({path:path.join(directory,"planning-"+locale.code+"-mobile.png")});
  await page.goto(origin+"/app");
  assert.equal(await page.getByTestId("home-attention").count(),0,"Home must not render a duplicate notification shortlist");
  const homeBell=page.getByRole("button",{name:locale.open});
  await homeBell.click();
  await page.getByRole("dialog",{name:locale.title,exact:true}).waitFor();
  await page.keyboard.press("Escape");
  const bottomNav=page.locator(".r-bottom-nav");
  assert.equal(await bottomNav.getByRole("button").count(),5,"Keep mobile navigation readable");
  await bottomNav.getByRole("button",{name:locale.settings,exact:true}).click();
  await page.getByRole("button",{name:locale.safety,exact:true}).click();
  await page.waitForURL(/\/app\/safetyAlerts$/);
  await page.locator(".fb-header-page-copy>strong").filter({hasText:locale.safety}).waitFor();
  await page.getByRole("tab",{name:locale.code==="vi"?"Quy tắc cảnh báo":locale.code==="zh"?"提醒规则":"Alert rules",exact:true}).waitFor();
  assert.ok((await sidebar.locator('[aria-current="page"]').textContent()).includes(locale.navSafety));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:path.join(directory,"safety-settings-"+locale.code+"-mobile.png")});
  await page.getByRole("button",{name:locale.backHome,exact:true}).click();
  await page.waitForURL(url=>url.pathname==="/app"&&!url.searchParams.has("tab"));
 }
 await page.evaluate(()=>localStorage.setItem("finbridge-preferred-language-v1","en"));await page.setViewportSize({width:320,height:568});await page.goto(origin+"/app?tab=tools");
 bell=page.getByRole("button",{name:/^Open notifications/});await bell.click();dialog=page.getByRole("dialog",{name:"Notifications",exact:true});
 const smallBounds=await dialog.boundingBox();assert.ok(smallBounds.x>=0&&smallBounds.x+smallBounds.width<=321&&smallBounds.y+smallBounds.height<=568,JSON.stringify(smallBounds));
 assert.equal(await dialog.getByRole("button",{name:"Mark all as read",exact:true}).isDisabled(),true);
 assert.equal(await bell.getAttribute("aria-label"),"Open notifications");
 await saved(s=>JSON.parse(s.settings.readFinancialAlertIds||"[]").length===2);
 await page.screenshot({path:path.join(directory,"notifications-small.png")});
 await page.keyboard.press("Escape");
 // Empty notification state still exposes reserve settings.
 const record=await workspaceRepository(pool).read(owner);record.data.fixedExpenses=[];record.data.goals=[];record.data.transactions=[];
 await workspaceRepository(pool).save(owner,{revision:record.revision,mutationId:randomUUID(),data:record.data});
 await page.reload();await page.getByRole("button",{name:"Open notifications",exact:true}).click();
 dialog=page.getByRole("dialog",{name:"Notifications",exact:true});
 await dialog.getByRole("group",{name:"Filter notifications"}).getByRole("button",{name:/^Unread/}).click();
 await dialog.getByText("You're all caught up.",{exact:true}).waitFor();
 await dialog.getByRole("button",{name:"Edit reserves",exact:true}).click();
 await dialog.getByRole("button",{name:"Save reserves",exact:true}).waitFor();
 await page.keyboard.press("Escape");
 // An independent bill can be created without any budget. Failed persistence
 // keeps the editor retryable and the retry must not create another record.
 await page.setViewportSize({width:1440,height:900});
 await page.goto(origin+"/app/fixedExpenses");
 await page.getByRole("button",{name:"Create fixed expense",exact:true}).first().click();
 dialog=page.getByRole("dialog",{name:"Create fixed expense",exact:true});
 await dialog.getByLabel("Name",{exact:true}).fill("Synthetic standalone retry");
 await dialog.getByLabel("Amount",{exact:true}).fill("1234");
 await dialog.getByLabel("Category",{exact:true}).selectOption("Housing");
 await context.route("**/api/workspace",route=>route.request().method()==="POST"?route.fulfill({status:503,json:{error:"WORKSPACE_UNAVAILABLE"}}):route.continue());
 await dialog.getByRole("button",{name:"Save plan",exact:true}).click();
 dialog=page.getByRole("dialog").filter({has:page.locator(".fb-planning-form")});
 await dialog.getByText(/Not saved to the server yet/).waitFor();
 assert.equal((await workspaceRepository(pool).read(owner)).data.fixedExpenses.length,0);
 await context.unroute("**/api/workspace");
 await dialog.getByRole("button",{name:"Save plan",exact:true}).click();
 await dialog.waitFor({state:"hidden"});
 const created=(await workspaceRepository(pool).read(owner)).data.fixedExpenses;
 assert.equal(created.length,1);assert.equal(created[0].budgetId,"");assert.equal(created[0].amount,1234);
 await page.reload();await page.getByRole("heading",{name:"Synthetic standalone retry",exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log("PASS: one notification inbox, read versus handled, persisted resolution, targeted wallet and planning destinations; one notification center with both sources; failed-read retry; Planning with only budgets and fixed expenses; reports removed without changing saved plans; EN/VI/ZH and 390px/320px bounds");
 console.log("Screenshots:",directory);
}catch(error){console.error(logs.slice(-2500));if(page){await page.screenshot({path:path.join(directory,"failure.png"),fullPage:true});console.error((await page.locator("body").innerText()).slice(-3500));console.error("Failure screenshot:",path.join(directory,"failure.png"));}throw error;}
finally{if(browser)await browser.close();if(server.pid&&process.platform==="win32"){try{execFileSync("taskkill",["/pid",String(server.pid),"/T","/F"],{windowsHide:true,stdio:"ignore"});}catch{}}else server.kill();await pause(500);await pool.query("DELETE FROM finbridge_onboarding WHERE user_id=$1",[owner]);await pool.query('DELETE FROM "session" WHERE "userId"=$1',[owner]);await pool.query('DELETE FROM "account" WHERE "userId"=$1',[owner]);await cleanupFinance(pool,[owner]);await pool.end();}
