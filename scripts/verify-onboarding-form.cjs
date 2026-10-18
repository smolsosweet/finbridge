const assert = require("node:assert/strict"), { test } = require("node:test");
const fs = require("node:fs"), ts = require("typescript"), React = require("react"), { renderToStaticMarkup } = require("react-dom/server");
function compile(file, resolve = require) {
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} }; new Function("require", "module", "exports", output)(resolve, module, module.exports); return module.exports;
}
const setup = compile("src/lib/onboarding.ts"), copy = compile("src/lib/setup-copy.ts"), authCopy = compile("src/lib/auth-copy.ts");
let slots = [], cursor = 0, storage = new Map(), requests = [], completed = [], status = 200, props, routes = [], signOuts = 0, signOutFails = false;
const fakeReact = { ...React, useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; }, useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; }, useEffect(effect) { effect(); } };
const { OnboardingWizard } = compile("src/components/auth/OnboardingWizard.tsx", name => {
  if (name === "react") return fakeReact;
  if (name === "@/components/sites/rolly/replica/store") return { workspacePersistence: () => "browser", getWorkspaceState: () => props.state, updateState: () => {} };
  if (name === "@/lib/onboarding") return setup;
  if (name === "@/components/FinBridgeMascot") return compile("src/components/FinBridgeMascot.tsx");
  if (name === "@/lib/setup-copy") return copy;
  if (name === "@/lib/auth-copy") return authCopy;
  if (name === "@/lib/currency-format") return compile("src/lib/currency-format.ts");
  if (name === "@/lib/language-preference") return { rememberPreferredLanguage() {} };
  if (name === "@/lib/sign-out") return { signOutGoogle: async () => { signOuts++; if (signOutFails) throw new Error("SIGN_OUT_FAILED"); } };
  if (name === "next/navigation") return { useRouter: () => ({ replace: path => routes.push(path) }) };
  if (name.includes("LanguageSelector")) return { LanguageSelector: ({ value, onChange }) => React.createElement("button", { "data-lang": value, type: "button", onClick: () => onChange?.("en") }, value) };
  if (name.endsWith(".module.css")) return { default: new Proxy({}, { get: (_, key) => String(key) }) };
  return require(name);
});
function find(node, predicate) { if (!React.isValidElement(node)) return; if (predicate(node)) return node; for (const child of React.Children.toArray(node.props.children)) { const result = find(child, predicate); if (result) return result; } }
function text(node) { if (typeof node === "string" || typeof node === "number") return String(node); return React.isValidElement(node) ? React.Children.toArray(node.props.children).map(text).join("") : ""; }
function tree() { cursor = 0; return OnboardingWizard(props); }
function fill(label, value) { const container = find(tree(), n => n.type === "label" && text(n).startsWith(label)); const field = find(container, n => n.type === "input" || n.type === "select"); assert.ok(field, label); field.props.onChange({ target: { value, valueAsNumber: Number(value) } }); }
function click(label) { const button = find(tree(), n => n.type === "button" && text(n) === label); assert.ok(button, label); button.props.onClick(); }
async function submit() { const form = find(tree(), n => n.type === "form"); await form.props.onSubmit({ preventDefault() {} }); }
const fresh = { wallets: [{ id: "default", name: ".", currency: "USD", initial: 0, type: "cash" }], transactions: [], goals: [], categories: [], categoryMeta: {}, fixedExpenses: [], settings: { language: "English" } };
function reset(language = "English") {
  slots = []; cursor = 0; requests = []; completed = []; status = 200; storage = new Map(); routes = []; signOuts = 0; signOutFails = false;
  global.localStorage = { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) };
  global.fetch = async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return Response.json(status === 200 ? { profile: { data: JSON.parse(options.body), completedAt: "2026-10-14T00:00:00Z" } } : { error: "OFFLINE" }, { status }); };
  props = { userId: "synthetic-user", name: "Synthetic", state: { ...fresh, settings: { language } }, onComplete: profile => completed.push(profile) };
}
test("actual setup UI renders EN/VI/ZH and does not contain the old introduction slides", () => {
  for (const [lang, language] of [["en", "English"], ["vi", "Tiếng Việt"], ["zh", "中文"]]) { reset(language); const html = renderToStaticMarkup(tree()); assert.match(html, new RegExp('lang="' + lang + '"')); assert.ok(html.includes(copy.SETUP_COPY[lang].name)); assert.doesNotMatch(html, /365-Day|Disappears Before|Rolly understands/); }
});
test("setup has a safe exit that signs out and returns to welcome without deleting the draft", async () => {
  reset(); fill("What should Finn call you?", "Draft name"); tree();
  const exit = find(tree(), n => n.type === "button" && text(n) === "Sign out"); assert.ok(exit);
  await exit.props.onClick();
  assert.equal(signOuts, 1); assert.deepEqual(routes, ["/?lang=en"]);
  assert.ok(storage.get("finbridge-setup-draft:synthetic-user"));
});
test("setup shows a clear error when sign-out cannot complete", async () => {
  reset(); signOutFails = true;
  const exit = find(tree(), n => n.type === "button" && text(n) === "Sign out"); await exit.props.onClick();
  assert.equal(signOuts, 1); assert.deepEqual(routes, []);
  assert.ok(find(tree(), n => n.props.role === "alert" && text(n).includes("Could not sign out")));
});
test("seven-step workflow saves two currencies, custom categories, quarterly tuition and reserves exactly once", async () => {
  reset(); fill("What should Finn call you?", "Synthetic preferred name"); await submit(); click("Full-time employee"); await submit();
  fill("Wallet name", "Techcombank"); fill("Currency", "VND"); fill("Opening balance", "50000000"); click("Add another wallet");
  fill("Wallet name", "Alipay"); fill("Currency", "CNY"); fill("Opening balance", "2000"); await submit();
  click("Education"); click("Dining"); fill("New category name", "Books"); click("Add category"); await submit(); click("Salary"); await submit();
  click("Yes"); fill("Expense name", "Tuition"); fill("Amount", "30000000"); fill("Expense category", "Education"); fill("First due date", "2026-10-15"); fill("Payment timing", "end"); fill("Repeat every (months)", "3"); fill("Remind me before (days)", "7"); click("Add expense"); await submit();
  fill("Minimum reserve · Techcombank", "25000000"); fill("Minimum reserve · Alipay", "500");
  await Promise.all([submit(), submit()]);
  assert.equal(requests.length, 1); assert.equal(completed.length, 1);
  const data = requests[0].body; assert.equal(data.occupation, "employee"); assert.deepEqual(data.wallets.map(w => w.currency), ["VND", "CNY"]);
  assert.equal(data.commitments[0].dueDate, "2026-10-31"); assert.equal(data.commitments[0].intervalMonths, 3); assert.equal(data.commitments[0].reminderDays, 7);
  assert.ok(data.expenseCategories.includes("Books")); assert.deepEqual(data.reserves.map(r => r.amount), [25000000, 500]); assert.ok(setup.onboardingSchema.safeParse(data).success);
});
test("invalid wallet/category steps cannot advance or call the server", async () => {
  reset(); await submit(); await submit(); await submit();
  assert.ok(find(tree(), n => n.props.role === "alert")); assert.equal(requests.length, 0); assert.equal(completed.length, 0);
});
test("fixed expenses cannot exceed the selected wallet opening balance", async () => {
  reset(); fill("What should Finn call you?", "Synthetic"); await submit(); await submit(); fill("Wallet name", "Cash"); fill("Opening balance", "200000"); await submit(); click("Dining"); await submit(); click("Salary"); await submit();
  click("Yes"); fill("Expense name", "Rent"); fill("Amount", "200001"); fill("Expense category", "Dining"); fill("First due date", "2026-10-15"); click("Add expense");
  assert.ok(find(tree(), n => n.props.role === "alert" && text(n).includes("cannot exceed its opening balance")));
  assert.equal(find(tree(), n => n.type === "button" && text(n) === "Add expense").props.disabled, true);
  fill("Amount", "200000"); click("Add expense"); await submit(); await submit();
  assert.equal(requests.length, 1); assert.equal(requests[0].body.commitments[0].amount, 200000);
});
test("Continue automatically saves the current expense exactly once", async () => {
  reset(); fill("What should Finn call you?", "Synthetic"); await submit(); await submit(); fill("Wallet name", "Cash"); fill("Opening balance", "200000"); await submit(); click("Dining"); await submit(); click("Salary"); await submit();
  click("Yes"); fill("Expense name", "Rent"); fill("Amount", "50000"); fill("Expense category", "Dining"); fill("First due date", "2026-10-15");
  const next = find(tree(), n => n.type === "button" && text(n) === "Continue");
  assert.equal(next.props.disabled, false);
  await submit(); await submit();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.commitments.length, 1);
  assert.equal(requests[0].body.commitments[0].title, "Rent");
});
test("missing fixed-expense fields show specific errors without saving or advancing", async () => {
  reset(); fill("What should Finn call you?", "Synthetic"); await submit(); await submit(); fill("Wallet name", "Cash"); fill("Opening balance", "200000"); await submit(); click("Dining"); await submit(); click("Salary"); await submit();
  click("Yes"); fill("Expense name", "Rent"); click("Add expense");
  assert.ok(find(tree(), n => n.props.role === "alert" && text(n).includes("Enter an amount greater than 0")));
  fill("Amount", "200000"); await submit();
  assert.ok(find(tree(), n => n.props.role === "alert" && text(n).includes("Choose an expense category")));
  fill("Expense category", "Dining"); await submit();
  assert.ok(find(tree(), n => n.props.role === "alert" && text(n).includes("Choose a valid first due date")));
  assert.equal(requests.length, 0);
  fill("First due date", "2026-10-24"); await submit(); await submit();
  assert.equal(requests[0].body.commitments.length, 1);
});
test("custom categories reuse the existing name regardless of capitalization", async () => {
  reset(); fill("What should Finn call you?", "Synthetic"); await submit(); await submit(); fill("Wallet name", "Cash"); fill("Opening balance", "200000"); await submit();
  fill("New category name", "Di chuyển"); click("Add category");
  fill("New category name", "di chuyển"); click("Add category"); await submit(); click("Salary"); await submit();
  click("Yes"); fill("Expense name", "Di chuyển"); fill("Amount", "200000"); fill("Expense category", "__finbridge_other_expense_category__"); fill("Other expense category", "  dI chuYển  "); fill("First due date", "2026-10-24"); await submit(); await submit();
  assert.deepEqual(requests[0].body.expenseCategories, ["Di Chuyển"]);
  assert.equal(requests[0].body.commitments[0].category, "Di Chuyển");
});
test("a custom fixed-expense category is added to the onboarding profile", async () => {
  reset(); fill("What should Finn call you?", "Synthetic"); await submit(); await submit(); fill("Wallet name", "Cash"); fill("Opening balance", "200000"); await submit(); click("Dining"); await submit(); click("Salary"); await submit();
  click("Yes"); fill("Expense name", "Club fee"); fill("Amount", "50000"); fill("Expense category", "__finbridge_other_expense_category__"); fill("Other expense category", "Professional membership"); fill("First due date", "2026-10-15"); click("Add expense"); await submit(); await submit();
  assert.deepEqual(requests[0].body.expenseCategories, ["Dining", "Professional Membership"]);
  assert.equal(requests[0].body.commitments[0].category, "Professional Membership");
});
test("a server failure keeps the draft for a retry and does not complete setup", async () => {
  reset(); fill("What should Finn call you?", "Synthetic"); await submit(); await submit(); fill("Wallet name", "Cash"); await submit(); click("Dining"); await submit(); click("Salary"); await submit(); await submit(); status = 503; await submit();
  assert.equal(completed.length, 0); assert.ok(find(tree(), n => n.props.role === "alert")); assert.ok(storage.get("finbridge-setup-draft:synthetic-user"));
  status = 200; await submit(); assert.equal(completed.length, 1);
});
