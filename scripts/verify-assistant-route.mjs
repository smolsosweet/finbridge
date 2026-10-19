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
const fixture = globalThis.__finbridgeAssistantTest = { session: { user: { id: "owner", emailVerified: true } }, calls: [], reads: [], output: null, error: null, data: null };
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
const { POST: workspaceActionsPOST } = await import("../src/app/api/ai/workspace-actions/route.ts");
const { emptyWorkspaceAction, applyWorkspaceProposal } = await import("../src/lib/workspace-actions.ts");
test.after(() => { hooks.deregister(); for (const [key, value] of Object.entries(savedEnv)) if (value === undefined) delete process.env[key]; else process.env[key] = value; });

const state = () => ({ wallets: [{ id: "vnd", name: "Test wallet", currency: "VND", initial: 1_000_000, type: "cash" }], categories: ["Học phí", "Thức ăn & Đồ uống", "Mua sắm"], categoryMeta: Object.fromEntries(["Học phí", "Thức ăn & Đồ uống", "Mua sắm"].map(name => [name, { type: "expense", icon: "❓", children: [] }])), transactions: [], goals: [], fixedExpenses: [], recurring: [], settings: {}, rules: [] });
const response = (changes = {}) => ({ intent: "create_transaction", targetDraftId: null, draftPatch: null, categoryOperation: null, action: "none", actions: null, walletId: null, scope: "selected", periodStart: null, periodEnd: null, category: null, searchTerm: null, transactionType: null, percentage: null, deletionScope: "none", deletionAmount: null, deletionWalletId: null, deletionPeriodStart: null, deletionPeriodEnd: null, deletionCategory: null, deletionSearchTerm: null, deletionType: null, reply: "", drafts: [], ...changes });
const body = (message, extra = {}) => ({ batchId: randomUUID(), message, today: "2026-10-18", timeZone: "Asia/Ho_Chi_Minh", selectedWalletId: null, wallets: state().wallets.map(({ id, name, currency }) => ({ id, name, currency })), categories: state().categories.map(name => ({ name, type: "expense" })), history: [], pendingDrafts: [], activeDraftId: null, referencedCategories: [], ...extra });
const draft = (id, title, amount) => ({ id, title, amount, type: "expense", category: "Thức ăn & Đồ uống", wallet: "vnd", currency: "VND", date: "2026-10-18", needsReview: [] });
const modelDraft = (title, amount, category = "Mua sắm") => ({ title, amount, type: "expense", category, categoryConfidence: "confident", date: "2026-10-18", walletId: null, needsReview: [] });
const request = (input, owner = "owner", origin = process.env.BETTER_AUTH_URL) => new Request(process.env.BETTER_AUTH_URL + "/api/ai/assistant", { method: "POST", headers: { "content-type": "application/json", origin, "x-finbridge-workspace-owner": owner }, body: JSON.stringify(input) });
const creation = (kind, changes = {}) => ({ ...emptyWorkspaceAction(kind, randomUUID()), name: "Test creation", ...changes });
const creationRequest = (pending, message, extra = {}) => ({ batchId: pending.id, message, language: "vi", today: "2026-10-19", history: [], pending, ...extra });

test("a short budget amount answer advances the active question even when the provider has no patch", async () => {
  const action = { id: randomUUID(), kind: "budget", name: "Tiền sinh hoạt tháng 10", currency: "VND", walletType: null, initialBalance: null, creditLimit: null, amount: null, walletId: "vnd", budgetId: null, category: null, date: null, cycle: null, recurrence: null, intervalMonths: null, monthPosition: null, reminderDays: null };
  const pending = { id: randomUUID(), actions: [action], status: "collecting" };
  const before = structuredClone(fixture.data);
  fixture.output = { mode: "manage", actions: [] };
  const http = await workspaceActionsPOST(request({ batchId: pending.id, message: "10 triệu", language: "vi", today: "2026-10-19", history: [], pending }));
  const result = await http.json();
  assert.equal(http.status, 200);
  assert.equal(result.proposal.actions[0].amount, 10_000_000);
  assert.equal(result.proposal.actions[0].walletId, "vnd");
  assert.equal(result.proposal.actions[0].name, action.name);
  assert.equal(result.question.field, "date");
  assert.equal(fixture.calls.length, 0);
  assert.deepEqual(fixture.data, before);
});

test("wallet choice then shorthand amount then date advance one budget without losing prior fields", async () => {
  let pending = { id: randomUUID(), actions: [creation("budget", { name: "Tiền sinh hoạt tháng 10" })], status: "collecting" };
  for (const [message, field] of [["Test wallet · VND", "amount"], ["số tiền là 10 triệu nhé", "date"], ["ngày mai", "cycle"], ["Hàng tháng", "category"], ["Tất cả danh mục chi", null]]) {
    const http = await workspaceActionsPOST(request(creationRequest(pending, message))), result = await http.json();
    assert.equal(http.status, 200, message);
    assert.equal(result.question?.field || null, field, message);
    assert.equal(result.proposal.id, pending.id);
    assert.equal(result.proposal.actions[0].id, pending.actions[0].id);
    pending = result.proposal;
  }
  assert.equal(pending.status, "review");
  assert.equal(pending.actions[0].amount, 10_000_000);
  assert.equal(pending.actions[0].date, "2026-10-20");
  assert.equal(pending.actions[0].walletId, "vnd");
  assert.equal(pending.actions[0].name, "Tiền sinh hoạt tháng 10");
  assert.equal(fixture.calls.length, 0);
  assert.equal(fixture.data.goals.length, 0);
  const confirmed = applyWorkspaceProposal(fixture.data, pending, "vi");
  assert.equal(confirmed.goals.length, 1);
  assert.equal(confirmed.goals[0].amount, 10_000_000);
  assert.equal(confirmed.goals[0].wallet, "vnd");
  assert.equal(applyWorkspaceProposal(confirmed, pending, "vi").goals.length, 1);
});

test("short numeric replies work for wallet opening balance, credit limit and fixed expense too", async () => {
  const cases = [
    [creation("wallet", { currency: "VND", walletType: "cash" }), "10 triệu", "initialBalance", 10_000_000],
    [creation("wallet", { currency: "USD", walletType: "cash" }), "0", "initialBalance", 0],
    [creation("wallet", { currency: "USD", walletType: "credit", initialBalance: 0 }), "1,500 USD", "creditLimit", 1500],
    [creation("fixed_expense", { budgetId: "", walletId: "vnd", currency: "VND" }), "1,5 triệu", "amount", 1_500_000],
  ];
  for (const [action, message, field, value] of cases) {
    const pending = { id: randomUUID(), actions: [action], status: "collecting" };
    const http = await workspaceActionsPOST(request(creationRequest(pending, message))), result = await http.json();
    assert.equal(http.status, 200, message);
    assert.equal(result.proposal.actions[0][field], value, message);
  }
  assert.equal(fixture.calls.length, 0);
  assert.equal(fixture.data.wallets.length, 1);
  assert.equal(fixture.data.fixedExpenses.length, 0);
});

test("invalid amounts and mismatched currencies preserve the pending action with actionable errors", async () => {
  const pending = { id: randomUUID(), actions: [creation("budget", { currency: "VND", walletId: "vnd" })], status: "collecting" };
  const before = structuredClone(pending);
  for (const [message, error] of [["0", "INVALID_NUMBER"], ["-10 triệu", "INVALID_NUMBER"], ["1,5 VND", "INVALID_NUMBER"], ["10 USD", "CURRENCY_MISMATCH"]]) {
    const http = await workspaceActionsPOST(request(creationRequest(pending, message))), result = await http.json();
    assert.equal(http.status, 422, message);
    assert.equal(result.error, error);
  }
  assert.deepEqual(pending, before);
  assert.equal(fixture.calls.length, 0);
});

test("complex replies retain structured model orchestration and empty patches no longer repeat a question", async () => {
  const action = creation("budget", { currency: "VND", walletId: "vnd" });
  const pending = { id: randomUUID(), actions: [action], status: "collecting" };
  fixture.output = { mode: "manage", actions: [{ kind: "budget", id: action.id, amount: 10000000, date: "2026-10-19", cycle: "monthly", category: "" }] };
  let http = await workspaceActionsPOST(request(creationRequest(pending, "cho mình 10 triệu, từ hôm nay, hàng tháng, tất cả danh mục")));
  let result = await http.json();
  assert.equal(http.status, 200);
  assert.equal(result.proposal.status, "review");
  assert.equal(result.proposal.actions[0].name, action.name);
  assert.equal(fixture.calls.length, 1);
  fixture.output = { mode: "manage", actions: [] };
  http = await workspaceActionsPOST(request(creationRequest(pending, "mình chưa biết phải ghi sao nữa")));
  result = await http.json();
  assert.equal(http.status, 422);
  assert.equal(result.error, "ACTION_REPLY_NOT_UNDERSTOOD");
  assert.equal(fixture.data.goals.length, 0);
});

test("numeric follow-up changes only the operation that owns the active question", async () => {
  const complete = creation("budget", { walletId: "vnd", currency: "VND", amount: 100000, date: "2026-10-19", cycle: "monthly", category: "" });
  const waiting = creation("budget", { name: "Second budget", walletId: "vnd", currency: "VND" });
  const pending = { id: randomUUID(), actions: [complete, waiting], status: "collecting" };
  const http = await workspaceActionsPOST(request(creationRequest(pending, "10 triệu"))), result = await http.json();
  assert.equal(http.status, 200);
  assert.deepEqual(result.proposal.actions[0], complete);
  assert.equal(result.proposal.actions[1].amount, 10_000_000);
  assert.equal(fixture.data.goals.length, 0);
});

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
test.beforeEach(() => { fixture.data = state(); fixture.calls = []; fixture.reads = []; fixture.output = response(); fixture.error = null; fixture.session = { user: { id: "owner", emailVerified: true } }; });

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

test("an explicit edit keeps the existing draft ID, full new title and currency suffix despite a wrong model amount", async () => {
  fixture.data.wallets.push({ id: "cny", name: "CNY test wallet", currency: "CNY", initial: 100000, type: "cash" });
  fixture.data.wallets.push({ id: "usd", name: "USD test wallet", currency: "USD", initial: 100000, type: "cash" });
  const old = draft("breakfast", "ăn sang", 10000);
  for (const [message, title, currency, wallet] of [["Sửa bản nháp này: n sáng 10k tệ", "ăn sáng", "CNY", "cny"], ["Sửa bản nháp này: ăn sáng 10 nghìn tệ", "ăn sáng", "CNY", "cny"], ["Sửa bản nháp này: ăn tối 10k đô", "ăn tối", "USD", "usd"]]) {
    fixture.output = response({ intent: "update_pending_transaction", targetDraftId: old.id, draftPatch: { title, amount: 10, currency: "VND" } });
    const http = await POST(request(body(message, { pendingDrafts: [old], activeDraftId: old.id }))), result = await http.json();
    assert.equal(http.status, 200);
    assert.equal(result.intent, "clarification");
    assert.equal(result.drafts[0].id, old.id);
    assert.equal(result.drafts[0].title, title);
    assert.equal(result.drafts[0].amount, 10000);
    assert.equal(result.drafts[0].currency, currency);
    assert.equal(result.drafts[0].wallet, wallet);
    assert.equal(result.drafts[0].date, old.date);
    assert.equal(fixture.data.transactions.length, 0);
    assert.equal(old.currency, "VND");
  }
});

test("changing a draft to a currency without a wallet cannot retain its old VND wallet", async () => {
  const old = draft("breakfast", "ăn sang", 10000);
  fixture.output = response({ intent: "update_pending_transaction", targetDraftId: old.id, draftPatch: { amount: 10000, currency: "VND" } });
  const http = await POST(request(body("Sửa bản nháp này: ăn sáng 10k tệ", { pendingDrafts: [old], activeDraftId: old.id }))), result = await http.json();
  assert.equal(http.status, 200);
  assert.equal(result.drafts[0].currency, "CNY");
  assert.equal(result.drafts[0].wallet, null);
  assert.ok(result.drafts[0].needsReview.includes("wallet"));
  assert.equal(fixture.data.transactions.length, 0);
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

test("forecast interpretation and calculations complete in one provider call without a second workspace read", async () => {
  fixture.data.settings.language="Tiếng Việt";
  fixture.data.transactions=[{id:"food",title:"Cơm",amount:25000,type:"expense",wallet:"vnd",category:"Thức ăn & Đồ uống",date:"2026-10-18",note:""}];
  const before=structuredClone(fixture.data);
  for(const message of ["nếu tôi chi như hiện tại thì cuối tháng còn dư tiền không", "xài đà này tới hết tháng ổn hông", "Will my money last this month?", "这个月按现在的速度花钱够吗？", "ok", "tôi đợi nãy giờ"]) {
    fixture.calls=[];fixture.reads=[];
    fixture.output=response({intent:"simulate_financial_scenario",scenarioPlan:{name:"Theo nhịp hiện tại",walletId:"vnd",horizonEnd:"2026-10-31",estimateSpending:true,actions:[]},presentation:{detail:"standard",layout:"conversation"}});
    const http=await POST(request(body(message))), result=await http.json();
    assert.equal(http.status,200);assert.equal(fixture.calls.length,1);assert.deepEqual(fixture.reads,["owner"]);
    assert.equal(result.scenarioResponse.scenarios.length,1);assert.equal(result.calculations[0].wallets[0].balanceNow,975000);
    assert.equal(result.calculations[0].wallets[0].projectedBalance,956944);
    assert.equal(result.scenarioResponse.scenarios[0].changes.length,0);
    assert.match(fixture.calls[0].contents,/no background task/);
    assert.deepEqual(fixture.data,before);
  }
});

test("shoe scenario carries one explicit hypothetical expense and a separately calculated baseline", async () => {
  fixture.calls=[];
  fixture.output=response({intent:"simulate_financial_scenario",scenarioPlan:{name:"Mua giày",walletId:"vnd",horizonEnd:"2026-10-31",estimateSpending:true,actions:[{kind:"change",title:"Giày",amount:3000000,direction:"expense",percent:null,walletId:"vnd",currency:"VND",category:"Mua sắm",date:"2026-10-19",startDate:null,endDate:null}]}});
  const result=await (await POST(request(body("nếu tui mua giày 3 triệu thì cuối tháng còn đủ tiền sài không")))).json();
  assert.equal(fixture.calls.length,1);
  assert.equal(result.baselines[0].wallets[0].projectedBalance-result.calculations[0].wallets[0].projectedBalance,3000000);
  assert.equal(result.drafts.length,0);assert.equal(fixture.data.transactions.length,0);
});

test("a completed general response cannot pretend a later background calculation is still running", async () => {
  fixture.data.settings.language="Tiếng Việt";
  fixture.output=response({intent:"general_finance_question",reply:"Đang tính toán số dư của bạn. Vui lòng đợi trong giây lát."});
  const result=await (await POST(request(body("tôi đợi nãy giờ")))).json();
  assert.doesNotMatch(result.reply,/Đang tính toán|Vui lòng đợi/);assert.match(result.reply,/chưa tính được/);
});

test("fixed-expense deletion cannot fall through to transaction matching even after a wrong provider intent", async () => {
  fixture.data.fixedExpenses=[{id:"internet",title:"Tiền mạng",walletId:"vnd",budgetId:"",amount:239000,category:"Mua sắm",dueDate:"2026-10-20",recurrence:"monthly",active:true},{id:"rent",title:"Tiền nhà",walletId:"vnd",budgetId:"",amount:3000000,category:"Mua sắm",dueDate:"2026-10-20",recurrence:"monthly",active:true}];
  const before=structuredClone(fixture.data);
  fixture.output=response({intent:"delete_transactions",deletionScope:"all"});
  const generic=await (await POST(request(body("tôi muốn xóa chi phí cố định")))).json();
  assert.equal(generic.operationIntent,"delete_fixed_expense");assert.equal(generic.planningDeletion.targets.length,2);assert.deepEqual(generic.planningDeletion.selectedIds,[]);assert.equal(generic.drafts.length,0);
  const named=await (await POST(request(body("tôi muốn xóa chi phí Tiền mạng")))).json();
  assert.equal(named.operationIntent,"delete_fixed_expense");assert.deepEqual(named.planningDeletion.selectedIds,["internet"]);assert.equal(named.planningDeletion.status,"pending");
  assert.deepEqual(fixture.data,before);
});

test("budget references are grounded in the account and can be resolved by a contextual deletion", async () => {
  fixture.data.goals=[{id:"living",kind:"budget",title:"Sinh hoạt",amount:7000000,saved:0,currency:"VND",date:"2026-10-01",cycle:"monthly",category:"",wallet:"vnd",direction:"",person:""}];
  fixture.output=response({intent:"query_financial_data",action:"budget_status",walletId:"vnd"});
  const listed=await (await POST(request(body("hiện tại có ngân sách gì")))).json();
  assert.deepEqual(listed.financialEntities,[{kind:"budget",id:"living",title:"Sinh hoạt"}]);
  fixture.output=response({intent:"delete_budget",planningDeletion:{kind:"budget",ids:["living"],searchTerm:null,scope:"matching"}});
  const result=await (await POST(request(body("xóa ngân sách này",{history:[{role:"assistant",text:`Previous planning entity references: ${JSON.stringify(listed.financialEntities)}`}],planningContext:{goals:[{...fixture.data.goals[0],id:"foreign",title:"Foreign budget"}],fixedExpenses:[]}})))).json();
  assert.deepEqual(result.planningDeletion.selectedIds,["living"]);assert.equal(result.planningDeletion.targets[0].title,"Sinh hoạt");assert.equal(result.planningDeletion.targets.some(t=>t.id==="foreign"),false);
  assert.equal(fixture.data.goals.length,1);assert.equal(fixture.data.transactions.length,0);
});

test("a model cannot silently turn an unnamed budget request into delete-all", async () => {
  fixture.data.goals=["a","b"].map(id=>({id,kind:"budget",title:id,amount:1000,saved:0,currency:"VND",date:"2026-10-01",cycle:"monthly",category:"",wallet:"vnd",direction:"",person:""}));
  fixture.output=response({intent:"delete_budget",planningDeletion:{kind:"budget",ids:["a","b"],searchTerm:null,scope:"all"}});
  const generic=await (await POST(request(body("tôi muốn xóa ngân sách")))).json();assert.deepEqual(generic.planningDeletion.selectedIds,[]);
  const all=await (await POST(request(body("xóa tất cả ngân sách")))).json();assert.deepEqual(all.planningDeletion.selectedIds,["a","b"]);assert.equal(fixture.data.goals.length,2);
});

test("foreign target IDs return a safe account-owned selection rather than a forged confirmation", async () => {
  fixture.output=response({intent:"delete_fixed_expense",planningDeletion:{kind:"fixed_expense",ids:["foreign"],searchTerm:null,scope:"matching"}});
  const result=await (await POST(request(body("remove that recurring bill")))).json();assert.equal(result.operationIntent,"delete_fixed_expense");assert.deepEqual(result.planningDeletion.targets,[]);assert.deepEqual(result.planningDeletion.selectedIds,[]);
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
