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
import QRCode from "qrcode";
import { buildTransferQr } from "../src/lib/bank-transfer.ts";
import { testPool, cleanupFinance } from "./workspace-fixtures.mjs";
import { workspaceRepository } from "../src/lib/workspace-repository.ts";
nextEnv.loadEnvConfig(process.cwd());
const db = new URL(process.env.AUTH_TEST_DATABASE_URL || "https://invalid.invalid");
if (!["localhost", "127.0.0.1"].includes(db.hostname) || db.pathname !== "/finbridge_auth_test") throw new Error("Only isolated finbridge_auth_test is allowed");
const playwrightPath = process.env.SAFETY_PLAYWRIGHT_PATH || "C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright";
const { chromium } = createRequire(import.meta.url)(playwrightPath);
const root = process.cwd(), directory = path.join(root, ".local", "bill-ui-" + randomUUID());
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
 wallets:[{id:"bank",name:"Synthetic VND wallet",currency:"VND",initial:3000000,type:"cash"},{id:"usd",name:"Synthetic USD wallet",currency:"USD",initial:1000,type:"cash"}],
 transactions:[{id:"already-logged",title:"Synthetic internet already logged",amount:30000,type:"expense",wallet:"bank",category:"Housing",date,note:"Synthetic existing entry"}],goals:[{id:"budget-1",kind:"budget",title:"Synthetic housing budget",amount:1000000,saved:0,currency:"VND",wallet:"bank",category:"Housing",date:date.slice(0,7)+"-01",cycle:"monthly",direction:"",person:""}],
 fixedExpenses:[{id:"rent",budgetId:"budget-1",walletId:"bank",title:"Synthetic rent",amount:200000,category:"Housing",dueDate:date,recurrence:"once",active:true},{id:"insurance",budgetId:"",walletId:"bank",title:"Synthetic insurance",amount:50000,category:"Housing",dueDate:date,recurrence:"monthly",active:true},{id:"internet",budgetId:"",walletId:"bank",title:"Synthetic internet",amount:30000,category:"Housing",dueDate:date,recurrence:"once",active:true}],
 recurring:[],rules:[],categories:["Housing","Salary"],categoryMeta:{Housing:{type:"expense",icon:"",children:[]},Salary:{type:"income",icon:"",children:[]}},
 settings:{name:"Synthetic UI",language:"English",theme:"light",timeZone:"UTC",onboardingCompleted:date}
};
const setup={version:1,displayName:"Synthetic UI",occupation:"student",language:"en",wallets:workspace.wallets.map(({type,...w})=>w),expenseCategories:["Housing"],incomeCategories:["Salary"],commitments:[],reserves:workspace.wallets.map(w=>({walletId:w.id,amount:0}))};
await pool.query("INSERT INTO finbridge_onboarding(user_id,data) VALUES($1,$2)",[owner,JSON.stringify(setup)]);
await workspaceRepository(pool).save(owner,{revision:0,mutationId:randomUUID(),data:workspace});
const env={...process.env,NODE_ENV:"development",DATABASE_URL:db.href,BETTER_AUTH_URL:origin,BETTER_AUTH_SECRET:secret,GOOGLE_CLIENT_ID:"synthetic",GOOGLE_CLIENT_SECRET:"synthetic",AUTH_EMAIL_MODE:"",AUTH_EMAIL_FROM:"",BREVO_API_KEY:"",SMTP_HOST:"",SMTP_FROM:"",SAFETY_EMAIL_ENABLED:"false",SAFETY_CRON_SECRET:"",FINBRIDGE_DEMO_MODE:"false"};
const server=spawn(process.execPath,[path.join(root,"node_modules/next/dist/bin/next"),"dev",directory,"-p",String(port)],{cwd:directory,env,windowsHide:true,stdio:["ignore","pipe","pipe"]});
let logs="";server.stdout.on("data",c=>logs+=c);server.stderr.on("data",c=>logs+=c);
let browser,page;const pause=ms=>new Promise(r=>setTimeout(r,ms));
try{
 for(let i=0;i<120;i++){if(/Ready in/.test(logs))break;if(server.exitCode!==null)throw new Error(logs.slice(-2000));await pause(500);}
 const executablePath=process.env.CHROME_BIN||["C:/Program Files (x86)/Google/Chrome/Application/chrome.exe","C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
 browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies(sessionCookies);
 await context.addInitScript(()=>localStorage.setItem("finbridge-preferred-language","en"));
 const catalog={banks:[{bin:"970415",code:"ICB",name:"VietinBank"},{bin:"970436",code:"VCB",name:"Vietcombank"}],apps:[{id:"mb",name:"MB Bank",autofill:true},{id:"vcb",name:"VCB Digibank",autofill:false}],platform:"android",fallback:false};
 await context.route("**/api/bank-catalog?*",route=>route.fulfill({json:catalog}));
 await context.route("https://dl.vietqr.io/**",route=>route.abort());
 page=await context.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));page.setDefaultTimeout(30000);
 await page.goto(origin+"/app/fixedExpenses",{timeout:120000});
 const rent=page.locator("article.fb-fixed-card").filter({has:page.getByRole("heading",{name:"Synthetic rent",exact:true})});
 await rent.getByRole("button",{name:"Pay through bank",exact:true}).click();
 let dialog=page.getByRole("dialog",{name:"Prepare bank transfer",exact:true});
 const recipient={bankBin:"970415",accountNumber:"0000000000",accountName:"SYNTHETIC TEST",reference:"Synthetic rent"};
 const image=await QRCode.toBuffer(buildTransferQr(recipient,220000,recipient.reference),{width:500,margin:4});
 await dialog.getByLabel("Upload bank QR image",{exact:true}).setInputFiles({name:"synthetic-qr.png",mimeType:"image/png",buffer:image});
 await dialog.getByLabel("Recipient account number",{exact:true}).inputValue().then(value=>{if(value!=="0000000000")return dialog.getByLabel("Recipient account number",{exact:true}).waitFor();});
 await page.waitForFunction(()=>document.querySelector('input[autocomplete="off"]')?.value==="0000000000");
 assert.equal(await dialog.getByLabel("Transfer amount",{exact:true}).inputValue(),"220000");
 await dialog.getByText(/QR amount differs/).waitFor();
 await dialog.getByLabel("Bank app to pay with",{exact:true}).selectOption("vcb");
 await dialog.getByText(/supports opening only/).waitFor();
 await dialog.getByLabel("Bank app to pay with",{exact:true}).selectOption("mb");
 await dialog.getByRole("button",{name:"Save recipient for this bill",exact:true}).click();
 await dialog.getByText("Recipient saved for this bill.",{exact:true}).waitFor();
 assert.equal((await pool.query("SELECT preferred_app FROM finbridge_fixed_expense_recipients WHERE user_id=$1 AND expense_id='rent'",[owner])).rows[0].preferred_app,"mb");
 await dialog.getByRole("button",{name:"Cancel",exact:true}).click();
 await page.reload();
 await rent.getByRole("button",{name:"Pay through bank",exact:true}).click();dialog=page.getByRole("dialog",{name:"Prepare bank transfer",exact:true});
 assert.equal(await dialog.getByLabel("Recipient account number",{exact:true}).inputValue(),"0000000000");
 assert.equal(await dialog.getByLabel("Bank app to pay with",{exact:true}).inputValue(),"mb");
 assert.equal(await dialog.getByLabel("Transfer amount",{exact:true}).inputValue(),"200000");
 await dialog.getByLabel("Recipient account number",{exact:true}).fill("0000000001");
 await dialog.getByRole("button",{name:"Save recipient for this bill",exact:true}).click();
 await dialog.getByText("Recipient saved for this bill.",{exact:true}).waitFor();
 await dialog.getByRole("checkbox").check();
 assert.ok(await dialog.getByRole("checkbox").evaluate(el=>el.getBoundingClientRect().width<=24),"Review checkbox stays compact");
 await dialog.getByRole("img",{name:"QR for the reviewed transfer details"}).waitFor();
 const link=dialog.getByRole("link",{name:"Open bank app",exact:true});const parsed=new URL(await link.getAttribute("href"));assert.equal(parsed.origin,"https://dl.vietqr.io");assert.equal(parsed.searchParams.get("ba"),"0000000001@icb");assert.equal(parsed.searchParams.get("am"),"200000");
 await page.screenshot({path:path.join(directory,"desktop-transfer.png"),fullPage:false});
 // Exercise the in-app handoff state without opening a real bank or provider URL.
 await link.evaluate(el=>el.addEventListener("click",event=>event.preventDefault()));
 await link.click();
 assert.equal((await pool.query("SELECT 1 FROM finbridge_transactions WHERE user_id=$1 AND fixed_expense_id IS NOT NULL AND deleted_at IS NULL",[owner])).rowCount,0);
 await dialog.getByRole("button",{name:"Already paid",exact:true}).click();
 dialog=page.getByRole("dialog",{name:"Record a payment",exact:true});
 await dialog.getByRole("button",{name:"Confirm payment recorded",exact:true}).click();
 await dialog.getByText("Expense recorded for this occurrence.",{exact:true}).waitFor();
 await dialog.getByText(/not been reconciled with a bank/).waitFor();
 await dialog.getByRole("button",{name:"Close",exact:true}).click();
 assert.equal((await pool.query("SELECT 1 FROM finbridge_transactions WHERE user_id=$1 AND fixed_expense_id='rent' AND deleted_at IS NULL",[owner])).rowCount,1);
 await page.reload();
 assert.equal(await rent.getByRole("button",{name:"Already paid",exact:true}).isDisabled(),true);
 await page.screenshot({path:path.join(directory,"desktop-recorded.png"),fullPage:true});
 await page.goto(origin+"/app?tab=tools");
 assert.equal(await page.getByRole("button",{name:"Add fixed expense",exact:true}).count(),0,"Budget card does not create another bill");
 await page.setViewportSize({width:390,height:844});
 for(const [language,pay,title,cancel] of [["Tiếng Việt","Thanh toán qua ngân hàng","Chuẩn bị chuyển khoản","Hủy"],["中文","通过银行付款","准备银行转账","取消"],["English","Pay through bank","Prepare bank transfer","Cancel"]]){
   await page.goto(origin+"/app/fixedExpenses");
   await page.locator(".fb-home-header select").selectOption(language);
   const insurance=page.locator("article.fb-fixed-card").filter({has:page.getByRole("heading",{name:"Synthetic insurance",exact:true})});
   await insurance.getByRole("button",{name:pay,exact:true}).click();
   const modal=page.getByRole("dialog",{name:title,exact:true});
   const cancelButton=modal.getByRole("button",{name:cancel,exact:true});await cancelButton.scrollIntoViewIfNeeded();assert.equal(await cancelButton.isVisible(),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.screenshot({path:path.join(directory,"mobile-"+(language==="English"?"en":language==="中文"?"zh":"vi")+".png"),fullPage:true});
   await cancelButton.click();
 }
 // A rejected write must stay retryable, without a false success or a second expense.
 const insurance=page.locator("article.fb-fixed-card").filter({has:page.getByRole("heading",{name:"Synthetic insurance",exact:true})});
 await insurance.getByRole("button",{name:"Already paid",exact:true}).click();
 await context.route("**/api/workspace",async route=>route.request().method()==="POST"?route.fulfill({status:503,json:{error:"WORKSPACE_UNAVAILABLE"}}):route.continue());
 dialog=page.getByRole("dialog",{name:"Record a payment",exact:true});await dialog.getByRole("button",{name:"Confirm payment recorded",exact:true}).click();
 await dialog.getByRole("button",{name:"Retry saving",exact:true}).waitFor();assert.equal(await dialog.getByText("Expense recorded for this occurrence.",{exact:true}).count(),0);
 await context.unroute("**/api/workspace");await dialog.getByRole("button",{name:"Retry saving",exact:true}).click();
 await dialog.getByText("Expense recorded for this occurrence.",{exact:true}).waitFor();
 assert.equal((await pool.query("SELECT 1 FROM finbridge_transactions WHERE user_id=$1 AND fixed_expense_id='insurance' AND deleted_at IS NULL",[owner])).rowCount,1);
 await dialog.getByRole("button",{name:"Close",exact:true}).click();
 const internet=page.locator("article.fb-fixed-card").filter({has:page.getByRole("heading",{name:"Synthetic internet",exact:true})});
 await internet.getByRole("button",{name:"Already paid",exact:true}).click();dialog=page.getByRole("dialog",{name:"Record a payment",exact:true});
 await dialog.getByLabel("Link an existing expense (optional)",{exact:true}).selectOption("already-logged");
 await dialog.getByRole("button",{name:"Confirm payment recorded",exact:true}).click();await dialog.getByText("Expense recorded for this occurrence.",{exact:true}).waitFor();
 assert.equal((await pool.query("SELECT 1 FROM finbridge_transactions WHERE user_id=$1 AND deleted_at IS NULL",[owner])).rowCount,3);
 assert.equal((await pool.query("SELECT fixed_expense_id FROM finbridge_transactions WHERE user_id=$1 AND id='already-logged'",[owner])).rows[0].fixed_expense_id,"internet");
 assert.deepEqual(errors,[]);console.log("PASS: local QR decoding/review, recipient save/edit/reload, supported/unsupported autofill, handoff without payment, single recorded expense, save-failure retry, EN/VI/ZH and 390px dialogs");console.log("Screenshots:",directory);
}catch(error){console.error(logs.slice(-2500));if(page){await page.screenshot({path:path.join(directory,"failure.png"),fullPage:true});console.error((await page.locator("body").innerText()).slice(-3500));console.error("Failure screenshot:",path.join(directory,"failure.png"));}throw error;}
finally{if(browser)await browser.close();if(server.pid&&process.platform==="win32"){try{execFileSync("taskkill",["/pid",String(server.pid),"/T","/F"],{windowsHide:true,stdio:"ignore"});}catch{}}else server.kill();await pause(500);await pool.query("DELETE FROM finbridge_onboarding WHERE user_id=$1",[owner]);await pool.query('DELETE FROM "session" WHERE "userId"=$1',[owner]);await pool.query('DELETE FROM "account" WHERE "userId"=$1',[owner]);await cleanupFinance(pool,[owner]);await pool.end();}

