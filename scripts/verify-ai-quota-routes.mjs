import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { AiQuotaError, AI_ROUTE_COST } from "../src/lib/ai-quota.ts";

// Exercise every real route AND the real Gemini SDK with only DB and transport stubbed.
// No network, app credentials, or production database is used.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
const fixture = globalThis.__finbridgeQuotaTest = { session: null, quotaError: null, reservations: [], pauses: [], calls: 0 };
const state = { wallets: [{ id: "wallet", name: "Synthetic wallet", currency: "USD", type: "cash", initial: 500 }], categories: ["Dining"], categoryMeta: { Dining: { type: "expense" } }, transactions: [], goals: [], fixedExpenses: [], recurring: [], rules: [], settings: {} };
fixture.state = state;
const quotaUrl = pathToFileURL(path.join(root, "lib/ai-quota.ts")).href;
const stubs = {
  "@/lib/auth-session": `export async function getSession(){ return globalThis.__finbridgeQuotaTest.session; }`,
  "@/lib/database": `export function database(){ return {}; }`,
  "@/lib/workspace-repository": `export function workspaceRepository(){ return {read:async()=>({data:globalThis.__finbridgeQuotaTest.state})}; }`,
  "quota-repository": `export function aiQuotaRepository(){return {
    reserve:async(owner,route)=>{ const f=globalThis.__finbridgeQuotaTest; if(f.quotaError)throw f.quotaError; f.reservations.push({owner,route}); return {id:'test',owner}; },
    release:async()=>{}, pause:async seconds=>{globalThis.__finbridgeQuotaTest.pauses.push(seconds);}
  };}`,
};
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (stubs[specifier]) return { url: "quota-test:" + specifier, shortCircuit: true };
    if (specifier === "./ai-quota-repository" && context.parentURL?.endsWith("ai-quota-gemini.ts")) return { url: "quota-test:quota-repository", shortCircuit: true };
    if (specifier === "@/lib/ai-quota") return { url: quotaUrl, shortCircuit: true };
    if (specifier.startsWith("@/")) return { url: pathToFileURL(path.join(root, specifier.slice(2)) + ".ts").href, shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const candidate = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
      if (existsSync(candidate + ".ts")) return { url: pathToFileURL(candidate + ".ts").href, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith("quota-test:")) return { source: stubs[url.slice(11)], format: "module", shortCircuit: true };
    return next(url, context);
  },
});
const keys = ["BETTER_AUTH_URL", "GEMINI_API_KEY", "AI_QUOTA_SERVER_DAILY_POINTS", "AI_QUOTA_SERVER_DAILY_REQUESTS", "AI_QUOTA_SERVER_MINUTE_REQUESTS", "AI_QUOTA_COOLDOWN_SECONDS"];
const saved = Object.fromEntries(keys.map(k => [k, process.env[k]])), originalFetch = globalThis.fetch;
Object.assign(process.env, { BETTER_AUTH_URL: "https://finbridge.example.invalid", GEMINI_API_KEY: "synthetic-quota-only", AI_QUOTA_SERVER_DAILY_POINTS: "100", AI_QUOTA_SERVER_DAILY_REQUESTS: "100", AI_QUOTA_SERVER_MINUTE_REQUESTS: "10", AI_QUOTA_COOLDOWN_SECONDS: "60" });
const routes = Object.fromEntries(await Promise.all(Object.keys(AI_ROUTE_COST).map(async route => [route, (await import(`../src/app/api/ai/${route}/route.ts`)).POST])));
test.after(() => { hooks.deregister(); globalThis.fetch = originalFetch; delete globalThis.__finbridgeQuotaTest; for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v; });
test.beforeEach(() => {
  fixture.session = { user: { id: "owner", emailVerified: true } }; fixture.quotaError = null; fixture.reservations = []; fixture.pauses = []; fixture.calls = 0;
  globalThis.fetch = async () => { fixture.calls++; return Response.json({ candidates: [{ content: { parts: [{ text: "{}" }], role: "model" }, finishReason: "STOP" }] }); };
});
const common = { today: "2026-10-21", timeZone: "UTC", defaultWalletId: "wallet", wallets: state.wallets.map(({ id, name, currency }) => ({ id, name, currency })), categories: [{ name: "Dining", type: "expense" }] };
const inputs = {
  assistant: { ...common, defaultWalletId: undefined, batchId: "00000000-0000-4000-8000-000000000001", message: "hello", selectedWalletId: null, history: [] },
  "transaction-drafts": { ...common, batchId: "00000000-0000-4000-8000-000000000002", message: "spent ten dollars" },
  "receipt-drafts": { ...common, imageDataUrl: "data:image/png;base64," + "A".repeat(120) },
  "speech-transcription": { mimeType: "audio/webm", audioBase64: "A".repeat(120) },
  "scenario-planner": { today: common.today, timeZone: common.timeZone, message: "hello", preferredLanguage: "en", history: [], context: { wallets: common.wallets, budgets: [], fixedExpenses: [], goals: [], categories: ["Dining"] } },
  "proactive-feed": { language: "en", alerts: [{ id: "a", kind: "negative-balance", problem: "test", figures: "test", when: "test", cause: "test", priority: "high", suggestedAction: "test", assumptions: "test" }] },
  "workspace-actions": { batchId: "00000000-0000-4000-8000-000000000003", message: "create a wallet", language: "en", today: common.today, history: [], pending: null },
};
function request(route, { origin = process.env.BETTER_AUTH_URL, owner = "owner", language = "en" } = {}) {
  return new Request(process.env.BETTER_AUTH_URL + "/api/ai/" + route, { method: "POST", headers: { origin, "content-type": "application/json", "x-finbridge-workspace-owner": owner, "x-finbridge-language": language }, body: JSON.stringify(inputs[route]) });
}
test("all seven routes reject missing sessions, unverified accounts, wrong origin and stale account headers before Gemini", async () => {
  for (const [route, POST] of Object.entries(routes)) {
    assert.equal((await POST(request(route, { origin: "https://attacker.invalid" }))).status, 403, route);
    assert.equal((await POST(request(route, { origin: "" }))).status, 403, route);
    assert.equal((await POST(request(route, { owner: "other" }))).status, 409, route);
    fixture.session = null; assert.equal((await POST(request(route))).status, 401, route);
    fixture.session = { user: { id: "owner", emailVerified: false } }; assert.equal((await POST(request(route))).status, 401, route);
    fixture.session.user.emailVerified = true;
  }
  assert.equal(fixture.calls, 0); assert.equal(fixture.reservations.length, 0);
});
test("all seven routes fail closed on shared quota denial and DB errors, with EN/VI/ZH and Retry-After", async () => {
  for (const [route, POST] of Object.entries(routes)) {
    for (const language of ["en", "vi", "zh"]) {
      for (const [code, status] of [["AI_QUOTA_EXCEEDED", 429], ["AI_QUOTA_UNAVAILABLE", 503]]) {
        fixture.quotaError = new AiQuotaError(code, 45);
        const response = await POST(request(route, { language })), body = await response.json();
        assert.equal(response.status, status, `${route} ${code}`); assert.equal(body.error, code);
        assert.equal(response.headers.get("retry-after"), "45"); assert.equal(body.manualEntryAvailable, true);
      }
    }
  }
  assert.equal(fixture.calls, 0);
});
test("real Gemini SDK transport uses the authenticated owner and route exactly once", async () => {
  for (const [route, POST] of Object.entries(routes)) {
    const before = fixture.calls;
    await POST(request(route));
    assert.equal(fixture.calls, before + 1, route);
    assert.deepEqual(fixture.reservations.at(-1), { owner: "owner", route });
  }
});
test("provider 429 records shared cooldown without retry and returns 429 for every route", async () => {
  globalThis.fetch = async () => { fixture.calls++; return new Response(null, { status: 429, headers: { "retry-after": "80" } }); };
  for (const [route, POST] of Object.entries(routes)) {
    const response = await POST(request(route));
    assert.equal(response.status, 429, route); assert.equal(response.headers.get("retry-after"), "80");
  }
  assert.equal(fixture.calls, 7); assert.deepEqual(fixture.pauses, Array(7).fill(80));
});
test("unconfigured quotas block real SDK network access without a RAM fallback", async () => {
  const previous = process.env.AI_QUOTA_SERVER_DAILY_POINTS;
  delete process.env.AI_QUOTA_SERVER_DAILY_POINTS;
  try {
    const response = await routes["speech-transcription"](request("speech-transcription"));
    assert.equal(response.status, 503); assert.equal((await response.json()).error, "AI_QUOTA_NOT_CONFIGURED"); assert.equal(fixture.calls, 0);
  } finally { process.env.AI_QUOTA_SERVER_DAILY_POINTS = previous; }
});
