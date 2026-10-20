import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { protectTranslationText, restoreTranslationText, conversationTranslationKey, splitConversationText } from "../src/lib/conversation-translation.ts";
import { APP_UI_COPY, appUiText } from "../src/lib/app-ui-copy.ts";

test("all static display-copy entries have EN/ZH variants; custom names and currency data stay unchanged", () => {
  for (const [source, translations] of Object.entries(APP_UI_COPY)) {
    assert.equal(translations.length, 2);
    assert.ok(translations.every(value => typeof value === "string" && value.trim()));
    assert.equal(appUiText(source, "vi"), source);
    assert.equal(appUiText(source, "English"), translations[0]);
    assert.equal(appUiText(source, "中文"), translations[1]);
  }
  for (const name of ["Vietinbank", "Tiền sinh hoạt tháng 10", "Alipay", "CNY", "100.000 VND"]) assert.equal(appUiText(name, "en"), name);
  assert.equal(appUiText("Xóa hội thoại", "en"), "Clear conversation");
  assert.equal(appUiText("Xác nhận", "zh"), "确认");
});

test("translation protects exact balances, dates, names, percentages, URLs and multiple currencies", () => {
  const source = "Ví Vietinbank: **9.104.378 VND** − 3.000.000 VND, 20%, 2026-10-19. Alipay: 10,000.00 CNY, $25.50 USD. https://example.invalid/a?x=20";
  const input = protectTranslationText(source, ["Vietinbank", "Alipay"]);
  assert.doesNotMatch(input.text, /9\.104|3\.000|Vietinbank|Alipay|https:|\d/);
  const translated = restoreTranslationText(input.text.replace("Ví", "Wallet"), input);
  assert.equal(translated, source.replace("Ví", "Wallet"));
  assert.equal(source.startsWith("Ví"), true);
  assert.notEqual(conversationTranslationKey(source, "en"), conversationTranslationKey(source, "zh"));
});

test("altered/omitted/duplicated placeholders and invented numeric facts are rejected", () => {
  const input = protectTranslationText("Còn 3000000 VND ngày 2026-10-20");
  const token = input.text.match(/⟦FINN_[A-Z]+⟧/)[0];
  for (const bad of [input.text.replace(token, ""), input.text + token, input.text + " 999 VND", input.text.replace(token, "⟦FINN_UNKNOWN⟧")]) assert.throws(() => restoreTranslationText(bad, input));
  assert.throws(() => protectTranslationText("⟦FINN_A⟧"));
});

test("the đồng symbol must not consume the first letter of đô (dollars)", () => {
  const dollars = protectTranslationText("ăn sáng 100 đô");
  assert.deepEqual(dollars.values, ["100"]);
  assert.match(dollars.text, / đô$/);
  assert.equal(restoreTranslationText(dollars.text.replace("ăn sáng", "breakfast").replace("đô", "dollars"), dollars), "breakfast 100 dollars");
  assert.deepEqual(protectTranslationText("ăn sáng 100 đ").values, ["100 đ"]);
});

test("long conversation explanations are batched without losing source content", () => {
  const source = "Số dư: 9000000 VND, ngày 2026-10-20.\n".repeat(1000);
  const chunks = splitConversationText(source);
  assert.ok(chunks.length > 1); assert.equal(chunks.join(""), source);
  assert.ok(chunks.every(chunk => chunk.length <= 10001));
  for (const chunk of chunks) assert.equal(restoreTranslationText(protectTranslationText(chunk).text, protectTranslationText(chunk)), chunk);
});

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
const fixture = globalThis.__translationTest = { session: { user: { id: "owner" } }, calls: [], mode: "success", quotaRoute: null };
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@google/genai" || ["@/lib/ai-access", "@/lib/ai-quota-gemini", "@/lib/ai-quota", "@/lib/ai-request"].includes(specifier)) return { url: "translation-test:" + specifier, shortCircuit: true };
    if (specifier.startsWith("@/")) return { url: pathToFileURL(path.join(root, specifier.slice(2)) + ".ts").href, shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const candidate = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
      if (existsSync(candidate + ".ts")) return { url: pathToFileURL(candidate + ".ts").href, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === "translation-test:@google/genai") return { format: "module", shortCircuit: true, source: `export const Type={OBJECT:'OBJECT',ARRAY:'ARRAY',STRING:'STRING'};` };
    if (url === "translation-test:@/lib/ai-access") return { format: "module", shortCircuit: true, source: "export async function requireAiSession(req){if(req.headers.get('origin')!==process.env.BETTER_AUTH_URL)return Response.json({error:'INVALID_ORIGIN'},{status:403});return globalThis.__translationTest.session||Response.json({error:'UNAUTHENTICATED'},{status:401});}" };
    if (url === "translation-test:@/lib/ai-quota-gemini") return { format: "module", shortCircuit: true, source: `export function createQuotaGemini(key,owner,route){const f=globalThis.__translationTest;f.quotaRoute=route;return {models:{generateContent:async args=>{f.calls.push(args);if(f.mode==='failure')throw new Error('synthetic failure');const texts=JSON.parse(args.contents.slice(args.contents.indexOf('[{')));return {text:JSON.stringify({texts:texts.map(item=>({...item,text:item.text.replace('Số dư','Balance')+(f.mode==='tamper'?' 999 USD':'')}))})};}}};}` };
    if (url === "translation-test:@/lib/ai-quota") return { format: "module", shortCircuit: true, source: "export function aiQuotaErrorResponse(){return null;}" };
    if (url === "translation-test:@/lib/ai-request") return { format: "module", shortCircuit: true, source: "export async function readAiJson(req){try{return {value:await req.json()};}catch{return Response.json({error:'INVALID_JSON'},{status:400});}}" };
    return next(url, context);
  },
});
const previous = Object.fromEntries(["NODE_ENV", "BETTER_AUTH_URL", "GEMINI_API_KEY"].map(key => [key, process.env[key]]));
process.env.NODE_ENV = "production"; process.env.BETTER_AUTH_URL = "https://finbridge.example.invalid"; process.env.GEMINI_API_KEY = "synthetic-test-key";
const { POST } = await import("../src/app/api/ai/translate-conversation/route.ts");
test.after(() => { hooks.deregister(); delete globalThis.__translationTest; for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
const payload = () => ({ language: "en", texts: [{ id: "one", text: "Số dư Vietinbank: 9000000 VND" }], names: ["Vietinbank"] });
const request = (value = payload(), owner = "owner", origin = process.env.BETTER_AUTH_URL) => new Request(process.env.BETTER_AUTH_URL + "/api/ai/translate-conversation", { method: "POST", headers: { origin, "content-type": "application/json", "x-finbridge-workspace-owner": owner }, body: JSON.stringify(value) });

test("real translation handler is read-only, batches texts in one model call and restores exact facts", async () => {
  const input = payload(), before = structuredClone(input); fixture.calls = [];
  const http = await POST(request(input)), result = await http.json();
  assert.equal(http.status, 200); assert.match(http.headers.get("cache-control"), /no-store/);
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.quotaRoute, "translate-conversation");
  assert.equal(result.texts[0].text, "Balance Vietinbank: 9000000 VND");
  assert.doesNotMatch(fixture.calls[0].contents, /9000000|Vietinbank/);
  assert.equal(fixture.calls[0].tools, undefined); assert.deepEqual(input, before);
});

test("origin, session, account and payload guards reject before calling the model", async () => {
  fixture.calls = [];
  assert.equal((await POST(request(payload(), "other"))).status, 409);
  assert.equal((await POST(request(payload(), "owner", "https://evil.invalid"))).status, 403);
  fixture.session = null; assert.equal((await POST(request())).status, 401); fixture.session = { user: { id: "owner" } };
  for (const value of [{ ...payload(), language: "fr" }, { ...payload(), texts: Array(13).fill(payload().texts[0]) }, { ...payload(), action: "delete_transactions" }]) assert.equal((await POST(request(value))).status, 400);
  assert.equal(fixture.calls.length, 0);
});

test("provider failures and factual translation drift return no replacement or mutations", async () => {
  for (const mode of ["failure", "tamper"]) {
    fixture.mode = mode; fixture.calls = [];
    const http = await POST(request()), result = await http.json();
    assert.equal(http.status, 503); assert.equal(result.error, "TRANSLATION_UNAVAILABLE");
    assert.equal(result.texts, undefined); assert.equal(fixture.calls.length, 1);
  }
  fixture.mode = "success";
});
