// Exercise the real Route Handler with a scripted provider and an isolated in-memory workspace.
// No network, API credentials, real accounts or app database are used.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
const fixture = globalThis.__finbridgeAssistantTest = { session: { user: { id: "owner" } }, calls: [], reads: [], output: null, error: null, data: null };
const stubs = {
  "@google/genai": `export const Type = { OBJECT:'OBJECT', STRING:'STRING', NUMBER:'NUMBER', ARRAY:'ARRAY' }; export const ThinkingLevel = { MINIMAL:'MINIMAL', LOW:'LOW' }; export class GoogleGenAI { models = { generateContent: async args => { const f=globalThis.__finbridgeAssistantTest; f.calls.push(args); if(f.error) throw f.error; return {text:typeof f.output==='string'?f.output:JSON.stringify(f.output)}; } }; }`,
  "@/lib/auth-session": `export async function getSession(){return globalThis.__finbridgeAssistantTest.session;}`,
  "@/lib/database": `export function database(){return {};}`,
  "@/lib/workspace-repository": `export function workspaceRepository(){return { read:async owner=>{ const f=globalThis.__finbridgeAssistantTest; f.reads.push(owner); return {data:f.data,revision:0}; } };}`,
};
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (stubs[specifier]) return { url: "finbridge-test:" + specifier, shortCircuit: true };
    if (specifier.startsWith("@/")) return { url: pathToFileURL(path.join(root, specifier.slice(2)) + ".ts").href, shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const candidate = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
      if (existsSync(candidate + ".ts")) return { url: pathToFileURL(candidate + ".ts").href, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith("finbridge-test:")) return { source: stubs[url.slice("finbridge-test:".length)], format: "module", shortCircuit: true };
    return next(url, context);
  },
});
const savedEnv = Object.fromEntries(["NODE_ENV", "FINBRIDGE_DEMO_MODE", "BETTER_AUTH_URL", "GEMINI_API_KEY"].map(k => [k, process.env[k]]));
process.env.NODE_ENV = "production"; process.env.FINBRIDGE_DEMO_MODE = "false";
process.env.BETTER_AUTH_URL = "https://finbridge.example.invalid"; process.env.GEMINI_API_KEY = "synthetic-test-key";
const { POST } = await import("../src/app/api/ai/assistant/route.ts");
const { POST: scenarioPOST } = await import("../src/app/api/ai/scenario-planner/route.ts");
test.after(() => { hooks.deregister(); for (const [key, value] of Object.entries(savedEnv)) if (value === undefined) delete process.env[key]; else process.env[key] = value; });

const state = () => ({ wallets: [{ id: "vnd", name: "Test wallet", currency: "VND", initial: 1_000_000, type: "cash" }], categories: ["Học phí", "Thức ăn & Đồ uống", "Mua sắm"], categoryMeta: Object.fromEntries(["Học phí", "Thức ăn & Đồ uống", "Mua sắm"].map(name => [name, { type: "expense", icon: "❓", children: [] }])), transactions: [], goals: [], fixedExpenses: [], recurring: [], settings: {}, rules: [] });
const response = (changes = {}) => ({ intent: "create_transaction", targetDraftId: null, draftPatch: null, categoryOperation: null, action: "none", actions: null, walletId: null, scope: "selected", periodStart: null, periodEnd: null, category: null, searchTerm: null, transactionType: null, percentage: null, deletionScope: "none", deletionAmount: null, deletionWalletId: null, deletionPeriodStart: null, deletionPeriodEnd: null, deletionCategory: null, deletionSearchTerm: null, deletionType: null, reply: "", drafts: [], ...changes });
const body = (message, extra = {}) => ({ batchId: randomUUID(), message, today: "2026-10-18", timeZone: "Asia/Ho_Chi_Minh", selectedWalletId: null, wallets: state().wallets.map(({ id, name, currency }) => ({ id, name, currency })), categories: state().categories.map(name => ({ name, type: "expense" })), history: [], pendingDrafts: [], activeDraftId: null, referencedCategories: [], ...extra });
const draft = (id, title, amount) => ({ id, title, amount, type: "expense", category: "Thức ăn & Đồ uống", wallet: "vnd", currency: "VND", date: "2026-10-18", needsReview: [] });
const modelDraft = (title, amount, category = "Mua sắm") => ({ title, amount, type: "expense", category, categoryConfidence: "confident", date: "2026-10-18", walletId: null, needsReview: [] });
const request = (input, owner = "owner", origin = process.env.BETTER_AUTH_URL) => new Request(process.env.BETTER_AUTH_URL + "/api/ai/assistant", { method: "POST", headers: { "content-type": "application/json", origin, "x-finbridge-workspace-owner": owner }, body: JSON.stringify(input) });

test("plan follow-ups retain validated assumptions and never create a financial mutation", async () => {
  const before = structuredClone(fixture.data);
  for (const message of ["giảm chi ăn uống 20%", "bớt tiền ăn 20 phần trăm", "cut food spending by 20 percent", "餐饮支出减少20%"] ) {
    fixture.output = response({ intent: "simulate_financial_scenario", planAdjustment: { walletId: "vnd", currency: "VND", category: "Thức ăn & Đồ uống", percent: 20, reserve: null, reset: false } });
    const res = await POST(request(body(message, { spendingPlan: { walletIds: ["vnd"], reserves: { vnd: 100000 } } })));
    const data = await res.json(); assert.equal(res.status, 200); assert.equal(data.planAdjustment.percent, 20); assert.deepEqual(data.drafts, []);
    assert.match(fixture.calls.at(-1).contents, /Spending plan context/);
  }
  fixture.output = response({ intent: "simulate_financial_scenario", planAdjustment: { walletId: "vnd", currency: "VND", category: null, percent: null, reserve: 300000, reset: false } });
  const res = await POST(request(body("giữ lại 300k dự phòng", { spendingPlan: { walletIds: ["vnd"], reductions: [{ walletId: "vnd", category: "Thức ăn & Đồ uống", percent: 20 }] } })));
  assert.equal((await res.json()).planAdjustment.reserve, 300000); assert.deepEqual(fixture.data, before);
});

test("plan assumptions reject impossible percentages and negative reserves before provider access", async () => {
  for (const spendingPlan of [{ reserves: { vnd: -1 } }, { reductions: [{ walletId: "vnd", category: "Food", percent: 101 }] }]) {
    const res = await POST(request(body("update plan", { spendingPlan }))); assert.equal(res.status, 400);
  }
  assert.equal(fixture.calls.length, 0);
});
test.beforeEach(() => { fixture.data = state(); fixture.calls = []; fixture.reads = []; fixture.output = response(); fixture.error = null; fixture.session = { user: { id: "owner" } }; });

test("real handler grounds education category and VND amount despite wrong model shopping category", async () => {
  fixture.output = response({ drafts: [modelDraft("học thêm", 100)] });
  const http = await POST(request(body("học thêm 100k"))), result = await http.json();
  assert.equal(http.status, 200); assert.equal(result.operationIntent, "create_transaction");
  assert.equal(result.drafts[0].amount, 100_000); assert.equal(result.drafts[0].currency, "VND"); assert.equal(result.drafts[0].category, "Học phí");
  assert.deepEqual(fixture.reads, ["owner"]); assert.equal(fixture.data.transactions.length, 0);
});

test("real handler retains clear food recognition despite overlapping category names", async () => {
  for (const name of ["ăn uông", "trong danh mục ăn uống luôn"]) {
    fixture.data.categories.push(name);
    fixture.data.categoryMeta[name] = { type: "expense", icon: "❓", children: [] };
  }
  const before = structuredClone(fixture.data);
  for (const category of ["Thức ăn & Đồ uống", "Mua sắm", null]) {
    fixture.output = response({ drafts: [{ ...modelDraft("ăn cơm", 25, category), categoryConfidence: category ? "confident" : "unknown" }] });
    const http = await POST(request(body("ăn cơm 25k"))), result = await http.json();
    assert.equal(http.status, 200);
    assert.equal(result.drafts[0].category, "Thức ăn & Đồ uống");
    assert.equal(result.drafts[0].amount, 25_000); assert.equal(result.drafts[0].currency, "VND");
    assert.equal(result.drafts[0].needsReview.includes("category"), false);
    assert.equal(result.drafts[0].date, "2026-10-18");
  }
  assert.deepEqual(fixture.data, before, "extraction never saves a transaction or changes categories");
});

test("missing or ambiguous education categories cannot silently fall back to shopping", async () => {
  fixture.output = response({ drafts: [modelDraft("học thêm", 100)] });
  fixture.data.categories = ["Mua sắm"];
  const missing = await (await POST(request(body("học thêm 100k")))).json();
  assert.equal(missing.drafts[0].category, null);
  fixture.data.categories = ["Học phí", "Giáo dục", "Mua sắm"];
  fixture.data.categoryMeta["Giáo dục"] = { type: "expense", icon: "📚", children: [] };
  const ambiguous = await (await POST(request(body("học thêm 100k")))).json();
  assert.equal(ambiguous.drafts[0].category, null);
});

test("archived categories remain queryable for history but cannot be assigned to a new draft", async () => {
  fixture.data.categoryMeta["Học phí"].archived = true;
  fixture.output = response({ drafts: [modelDraft("học thêm", 100, "Học phí")] });
  const newDraft = await (await POST(request(body("học thêm 100k")))).json();
  assert.equal(newDraft.drafts[0].category, null);
  fixture.output = response({ intent: "query_financial_data", action: "transactions", category: "Học phí", periodStart: "2026-10-01", periodEnd: "2026-10-18" });
  const history = await (await POST(request(body("giao dịch học phí tháng này")))).json();
  assert.equal(history.category, "Học phí"); assert.equal(history.intent, "financial");
});

test("category follow-up repairs a repeated summary action and computes fresh server-owned category totals", async () => {
  fixture.data.transactions = [
    { id: "food", title: "Cơm", type: "expense", amount: 25_000, category: "Thức ăn & Đồ uống", wallet: "vnd", date: "2026-10-18", note: "" },
    { id: "clothes", title: "Áo", type: "expense", amount: 200_000, category: "Mua sắm", wallet: "vnd", date: "2026-10-17", note: "" },
    { id: "old", title: "Old", type: "expense", amount: 1_000_000, category: "Mua sắm", wallet: "vnd", date: "2026-09-01", note: "" },
  ];
  const before = structuredClone(fixture.data);
  fixture.output = response({ intent: "query_financial_data", action: "spending_summary", actions: ["spending_summary"], category: "Thức ăn & Đồ uống", walletId: "vnd" });
  const input = body("đã chi cho những danh mục nào", { history: [{ role: "assistant", text: "Previous financial result context (recalculate from current data; do not reuse prior amounts): action=spending_summary; category=unspecified; period=2026-10-01..2026-10-18; percentage=unspecified." }] });
  const http = await POST(request(input)), result = await http.json();
  assert.equal(http.status, 200); assert.equal(result.action, "category_breakdown");
  assert.deepEqual(result.actions, ["category_breakdown"]); assert.equal(result.category, null);
  assert.equal(result.periodStart, "2026-10-01");
  assert.match(result.financialAnswer, /Mua sắm: \*\*200,000 VND/);
  assert.match(result.financialAnswer, /Thức ăn & Đồ uống: \*\*25,000 VND/);
  assert.match(result.financialAnswer, /225,000 VND/); assert.doesNotMatch(result.financialAnswer, /1,225,000/);
  fixture.data.transactions[0].amount = 30_000;
  const refreshed = await (await POST(request(input))).json();
  assert.match(refreshed.financialAnswer, /230,000 VND/);
  fixture.data.transactions[0].amount = 25_000;
  assert.deepEqual(fixture.data, before);
});

test("scheduled-payment follow-up repairs a balance tool, resolves the authorized bill and leaves actual data unchanged", async () => {
  fixture.data.fixedExpenses = [{ id: "parking", title: "Tiền gửi xe", amount: 147000, walletId: "vnd", budgetId: "", category: "Mua sắm", dueDate: "2026-10-20", recurrence: "monthly", active: true }];
  const before = structuredClone(fixture.data);
  fixture.output = response({ intent: "query_financial_data", action: "balance", actions: ["balance"] });
  const http = await POST(request(body("sau khi đóng tiền gửi xe thì tôi còn bao nhiêu tiền"))), result = await http.json();
  assert.equal(http.status, 200);
  assert.equal(result.action, "balance_after_obligation");
  assert.equal(result.walletId, "vnd");
  assert.equal(result.searchTerm, "Tiền gửi xe");
  assert.match(result.financialAnswer, /853,000 VND/);
  assert.deepEqual(result.drafts, []);
  assert.deepEqual(fixture.data, before);
  assert.match(fixture.calls[0].contents, /nextDueDate/);
  assert.doesNotMatch(fixture.calls[0].contents, /853000|853,000/);
});

test("current balance after a hypothetical question inherits the wallet but never subtracts the bill", async () => {
  fixture.output = response({ intent: "query_financial_data", action: "balance", actions: ["balance"] });
  const history = [{ role: "assistant", text: 'Previous financial result context (recalculate from current data; do not reuse prior amounts): action=balance_after_obligation; category=unspecified; period=default..default; percentage=unspecified; walletId="vnd"; scope=selected; bill="Tiền gửi xe".' }];
  const http = await POST(request(body("hiện tại tôi còn bao nhiêu", { history }))), result = await http.json();
  assert.equal(http.status, 200);
  assert.equal(result.action, "balance");
  assert.equal(result.walletId, "vnd");
  assert.match(result.financialAnswer, /1,000,000 VND/);
});

test("a wrongly interpreted correction cannot overwrite an existing draft when the message is a new purchase", async () => {
  fixture.output = response({ intent: "answer_clarification", targetDraftId: "bread", draftPatch: { title: "nước", amount: 20_000 } });
  const old = draft("bread", "bánh mì", 10_000);
  const result = await (await POST(request(body("tôi mua nước 20k", { pendingDrafts: [old], activeDraftId: old.id })))).json();
  assert.equal(result.operationIntent, "create_transaction"); assert.equal(result.drafts.length, 1);
  assert.notEqual(result.drafts[0].id, old.id); assert.equal(result.drafts[0].amount, 20_000);
  assert.equal(old.title, "bánh mì");
});

test("bread then water retain separate stable draft IDs and retries retain their identity", async () => {
  fixture.output = response({ drafts: [modelDraft("bánh mì", 10)] });
  const first = await (await POST(request(body("tôi mua bánh mì 10k")))).json();
  fixture.output = response({ drafts: [modelDraft("nước", 20)] });
  const input = body("tôi mua nước 20k", { pendingDrafts: first.drafts, activeDraftId: first.drafts[0].id });
  const second = await (await POST(request(input))).json(), retry = await (await POST(request(input))).json();
  assert.notEqual(first.drafts[0].id, second.drafts[0].id); assert.equal(second.drafts[0].id, retry.drafts[0].id);
  assert.equal(first.drafts[0].amount, 10_000); assert.equal(second.drafts[0].amount, 20_000);
  assert.equal(second.drafts[0].category, "Thức ăn & Đồ uống"); assert.equal(first.drafts[0].title, "bánh mì");
});

test("corrections patch only one explicitly grounded draft and retain all unmentioned fields", async () => {
  const bread = draft("bread", "bánh mì", 10_000), water = draft("water", "nước", 20_000);
  fixture.output = response({ intent: "update_pending_transaction", targetDraftId: "bread", draftPatch: { amount: 12_000 } });
  const input = body("sửa bánh mì thành 12k", { pendingDrafts: [bread, water] });
  const result = await (await POST(request(input))).json();
  assert.equal(result.targetDraftId, "bread"); assert.deepEqual(result.drafts, [{ ...bread, amount: 12_000 }]);
  assert.equal(water.amount, 20_000);
  fixture.output.targetDraftId = "water";
  const ambiguous = await (await POST(request({ ...input, message: "tôi nhầm, sửa thành 12k" }))).json();
  assert.equal(ambiguous.targetDraftId, null); assert.deepEqual(ambiguous.drafts, []);
});

test("category-management boundary blocks a provider misclassification as transaction deletion", async () => {
  fixture.output = response({ intent: "delete_transactions", deletionScope: "all", reply: "" });
  const result = await (await POST(request(body("xóa danh mục Học phí")))).json();
  assert.notEqual(result.intent, "delete_transactions"); assert.equal(result.deletion.scope, "none"); assert.deepEqual(result.drafts, []);
});

test("category commands return validated previews and cannot access another account's category", async () => {
  fixture.output = response({ intent: "rename_category", categoryOperation: { operation: "rename_category", sources: ["Học phí"], target: "Giáo dục", type: null } });
  const result = await (await POST(request(body("đổi tên Học phí thành Giáo dục")))).json();
  assert.equal(result.categoryOperation.target, "Giáo dục"); assert.equal(fixture.data.categories.includes("Giáo dục"), false);
  fixture.output.categoryOperation.sources = ["Foreign account category"];
  const forged = body("đổi tên danh mục", { categories: [{ name: "Foreign account category", type: "expense" }] });
  const rejected = await (await POST(request(forged))).json(); assert.equal(rejected.categoryOperation, null);
  assert.equal(fixture.calls.at(-1).contents.includes('"name":"Foreign account category"'), false);
});

test("pending new category is valid conversation context and unknown patch categories stay unresolved", async () => {
  const pending = { ...draft("pending", "học thêm", 100_000), category: null, newCategory: { name: "Test new category", type: "expense" } };
  fixture.output = response({ intent: "answer_clarification", targetDraftId: "pending", draftPatch: { category: "Not owned category" } });
  const http = await POST(request(body("chọn danh mục khác", { pendingDrafts: [pending], activeDraftId: "pending" }))), result = await http.json();
  assert.equal(http.status, 200); assert.equal(result.drafts[0].category, null); assert.equal(result.drafts[0].needsReview.includes("category"), true);
});

test("scenario routing uses server-owned financial records and deterministic calculations without mutation", async () => {
  const before = structuredClone(fixture.data);
  fixture.output = { intent: "scenario", reply: "", clarification: null, scenarios: [{ id: "test", name: "Tuition", changes: [{ title: "Tuition", amount: 100_000, direction: "expense", walletId: "vnd", currency: "VND", date: "2026-10-19", category: "Học phí" }], horizonEnd: "2026-10-19", estimateSpending: false, assumptions: [] }] };
  const input = { message: "Nếu ngày mai tôi đóng học phí 100k thì sao?", preferredLanguage: "vi", today: "2026-10-18", timeZone: "Asia/Ho_Chi_Minh", history: [], selectedWalletId: "vnd", context: { wallets: state().wallets.map(({ id, name, currency }) => ({ id, name, currency })), budgets: [], fixedExpenses: [], goals: [], categories: ["Foreign category"] } };
  const http = await scenarioPOST(request(input)), result = await http.json();
  assert.equal(http.status, 200); assert.equal(result.calculations.length, 1);
  assert.equal(result.calculations[0].wallets[0].balanceNow, 1_000_000);
  assert.equal(result.calculations[0].wallets[0].projectedBalance, 900_000);
  assert.equal(result.calculations[0].wallets[0].currency, "VND");
  assert.deepEqual(fixture.data, before);
});

test("handler rejects invalid origins, account changes and missing sessions before provider access", async () => {
  assert.equal((await POST(request(body("hello"), "owner", "https://attacker.invalid"))).status, 403);
  assert.equal((await POST(request(body("hello"), "other"))).status, 409);
  fixture.session = null;
  assert.equal((await POST(request(body("hello")))).status, 401); assert.equal(fixture.calls.length, 0);
});

test("provider API failures are actionable, disclose no provider name, and never produce mutations", async () => {
  for (const [status, name, expected, code] of [[429, "Error", 429, "AI_QUOTA_OR_RATE_LIMIT"], [503, "Error", 503, "AI_BUSY"], [401, "Error", 502, "AI_CONFIGURATION_ERROR"], [undefined, "TimeoutError", 504, "AI_TIMEOUT"]]) {
    fixture.error = Object.assign(new Error("Synthetic failure"), { status, name });
    const http = await POST(request(body("hello"))), result = await http.json();
    assert.equal(http.status, expected); assert.equal(result.error, code); assert.doesNotMatch(result.message, /gemini|api key|AI Studio/i);
    assert.equal(fixture.data.transactions.length, 0);
  }
  fixture.error = null; fixture.output = "invalid-json";
  assert.equal((await POST(request(body("hello")))).status, 502);
});
