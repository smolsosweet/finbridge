// Isolated model and real-component handler checks; no browser or localStorage writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { createRequire } = require("node:module");
const directory = path.resolve(__dirname, "../src/components/sites/rolly/replica");
const requireLocal = createRequire(path.join(directory, "Planning.tsx"));
function compile(file, resolve = requireLocal) {
  const source = ts.transpileModule(fs.readFileSync(path.join(directory, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const result = { exports: {} };
  new Function("require", "module", "exports", source)(resolve, result, result.exports);
  return result.exports;
}
const weeks = compile("chartWeek.ts");
const model = compile("planningModel.ts", (name) => name === "./chartWeek" ? weeks : requireLocal(name));
const header = compile("FinBridgeHeader.tsx", name => name === "@/components/safety/SafetyProvider" ? { useSafety: () => null } : name === "@/components/safety/safety-copy" ? compile("../../../safety/safety-copy.ts") : name === "./NotificationCenter" ? { NotificationCenter: () => null } : requireLocal(name));
const setupCopy = compile("../../../../lib/setup-copy.ts");
const paymentsModel = compile("../../../../lib/fixed-expense-payments.ts", (name) => name === "../components/sites/rolly/replica/planningModel" ? model : requireLocal(name));
const outlookModel = compile("../../../../lib/financial-outlook.ts", (name) => name === "../components/sites/rolly/replica/planningModel" ? model : name === "./fixed-expense-payments" ? paymentsModel : requireLocal(name));
const safetyCopy = compile("../../../safety/safety-copy.ts");
const budgetCategories = compile("../../../../lib/budget-categories.ts");
const scenarioModel = compile("../../../../lib/scenario-planner.ts", name => name === "../components/sites/rolly/replica/planningModel" ? model : name === "./fixed-expense-payments" ? paymentsModel : requireLocal(name));
const outlookUI = compile("FinancialOutlook.tsx", (name) => {
  if (name === "@/lib/financial-outlook") return outlookModel;
  if (name === "@/lib/notification-center") return { notificationDestination: () => "", notificationReadIds: () => [], markNotificationRead: () => {} };
  if (name === "@/lib/proactive-alerts") return { detectProactiveAlerts: () => [], readDismissedAlertIds: () => [] };
  if (name.endsWith(".module.css")) return { default: new Proxy({}, { get: (_, key) => String(key) }) };
  if (name === "./store") return { useAppState: () => state, updateState: update => { state = update(state); }, today: () => "2026-10-13" };
  return requireLocal(name);
});
const wallets = [{ id: "bank", name: "Bank", currency: "VND" }, { id: "ali", name: "Alipay", currency: "CNY" }];
const budget = { id: "budget", kind: "budget", title: "Living costs", amount: 10000000, saved: 999999, currency: "VND", date: "2026-10-01", cycle: "monthly", category: "", wallet: "bank", direction: "", person: "" };
const expense = { id: "rent", budgetId: "budget", title: "Rent", amount: 3000000, category: "Rent", dueDate: "2026-10-10", recurrence: "monthly", active: true };
const transactions = [
  { id: "rent-paid", type: "expense", title: "Rent paid", category: "Rent", amount: 3000000, wallet: "bank", date: "2026-10-10" },
  { id: "food", type: "expense", title: "Lunch", category: "Food", amount: 100000, wallet: "bank", date: "2026-10-11" },
  { id: "move", type: "transfer", title: "Move", category: "Transfer", amount: 9000000, wallet: "bank", targetWallet: "ali", date: "2026-10-11" },
  { id: "refund", type: "expense", title: "Refund", category: "Food", amount: -50000, wallet: "bank", date: "2026-10-12" },
  { id: "cny", type: "expense", title: "CNY food", category: "Food", amount: 200, wallet: "ali", date: "2026-10-12" },
];
let state = { wallets, goals: [budget], fixedExpenses: [expense], transactions, categories: ["Rent", "Food", "Salary"], categoryMeta: { Salary: { type: "income" } }, settings: { language: "English" } };
let summary = model.budgetSummary(state, budget, "2026-10-13");
assert.equal(summary.actual, 3100000, "negative expense rows are invalid and excluded from spending totals");
assert.equal(summary.planned, 3000000);
assert.equal(summary.remaining, 6900000, "planned expenses are not added to actual spending");
assert.equal(summary.allocationRemaining, 7000000);
assert.equal(model.budgetSummary(state, { ...budget, category: "Rent" }, "2026-10-13").actual, 3000000);
assert.deepEqual(model.budgetWindow({ ...budget, date: "2026-01-31" }, "2026-02-28"), { start: "2026-02-28", end: "2026-03-30" });
assert.deepEqual(model.plannedOccurrences({ ...expense, dueDate: "2026-01-31" }, "2026-02-01", "2026-03-31"), ["2026-02-28", "2026-03-31"]);
assert.deepEqual(model.plannedOccurrences({ ...expense, recurrence: "weekly", dueDate: "2026-10-02" }, "2026-10-01", "2026-10-31"), ["2026-10-02", "2026-10-09", "2026-10-16", "2026-10-23", "2026-10-30"]);
assert.equal(model.validFixedExpense(state, { ...expense, budgetId: "foreign" }), false);
assert.equal(model.validFixedExpense(state, { ...expense, dueDate: "2026-02-30" }), false);
assert.equal(model.validFixedExpense(state, { ...expense, amount: NaN }), false);
assert.equal(model.validFixedExpense({ ...state, goals: [{ ...budget, category: "Food" }] }, expense), false);
assert.equal(model.validFixedExpense({ ...state, wallets: [{ ...wallets[0], archived: true }] }, expense), false);
assert.equal(model.validFixedExpense({ ...state, goals: [{ ...budget, currency: "CNY" }] }, expense), false);
assert.equal(model.validBudget(state, { ...budget, category: "Salary" }), false);
assert.equal(model.budgetSummary({ ...state, fixedExpenses: [{ ...expense, active: false }] }, budget, "2026-10-13").planned, 0);

let cursor = 0, slots = [];
const testReact = { ...React, useEffect() {}, useRef(initial) { const index=cursor++; if (!(index in slots)) slots[index]={current:initial}; return slots[index]; }, useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial; return [slots[index], (next) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }]; } };
const component = compile("Planning.tsx", (name) => {
  if (name === "react") return testReact;
  if (name === "./planningModel") return model;
  if (name === "./FinancialOutlook") return outlookUI;
  if (name === "@/lib/fixed-expense-payments") return paymentsModel;
  if (name === "@/lib/setup-copy") return setupCopy;
  if (name === "@/lib/scenario-planner") return scenarioModel;
  if (name === "@/lib/budget-categories") return budgetCategories;
  if (name === "@/components/safety/safety-copy") return safetyCopy;
  if (name === "@/components/payments/FixedExpenseActions") return { FixedExpenseActions: () => null };
  if (name === "./chartWeek") return weeks;
  if (name === "./FinBridgeHeader") return header;
  if (name === "./CalendarLedgerModal") return { CalendarLedgerModal: () => null };
  if (name === "next/navigation") return { useSearchParams: () => new URLSearchParams() };
  if (name === "./Ui") return { Modal: ({ children }) => React.createElement("div", { role: "dialog" }, children) };
  if (name === "./store") return { useAppState: () => state, workspaceOwner: () => "synthetic", workspacePersistence: () => "browser", flushWorkspace: async () => {}, getWorkspaceState: () => state, updateState: (update) => { state = update(state); } };
  return requireLocal(name);
}).Planning;
let props = { navigate: () => {} };
function render() { cursor = 0; return renderToStaticMarkup(React.createElement(component, props)); }
function tree() { cursor = 0; return component(props); }
function find(node, predicate) { if (!React.isValidElement(node)) return undefined; if (predicate(node)) return node; for (const child of React.Children.toArray(node.props.children)) { const value = find(child, predicate); if (value) return value; } }
function set(label, value) {
  const wrapper = find(tree(), (node) => node.type === "label" && React.Children.toArray(node.props.children)[0] === label);
  const field = find(tree(), (node) => (node.type === "input" || node.type === "select") && node.props["aria-label"] === label) || find(wrapper, (node) => node.type === "input" || node.type === "select");
  const handler = field.props.onInput || field.props.onChange;
  handler({ target: { value }, currentTarget: { value } });
}
async function main() {
const snapshot = JSON.stringify(transactions);
let html = render();
assert.match(html, /fb-brand-mark/);
assert.doesNotMatch(html, /Challenges|Lend|Borrow|Debts|r-mascot|empty_list/);
state.settings.language = "Tiếng Việt"; assert.match(render().replace(/&amp;/g, "&"), /Ngân sách & Chi cố định/);
state.settings.language = "中文"; assert.match(render(), /固定支出/);
state.settings.language = "English";
// Test the real creation handlers; there are no financial writes.
const today = weeks.localDateKey(new Date());
state = { ...state, goals: [], fixedExpenses: [] }; slots = []; props = { navigate: () => {}, initialForm: "budget" };
render(); set("Name", "Monthly essentials"); set("Amount", "8000000");
await find(tree(), (node) => node.type === "form" && node.props.className?.includes("fb-planning-form")).props.onSubmit({ preventDefault() {} });
assert.equal(state.goals.length, 1); assert.equal(state.goals[0].currency, "VND");
const createdBudget = state.goals[0];
slots = []; props = { navigate: () => {}, initialTab: "fixed", initialForm: "fixed" };
render(); set("Linked budget (optional)", createdBudget.id); set("Name", "Phone plan"); set("Amount", "250000"); set("Category", "Food");
await find(tree(), (node) => node.type === "form" && node.props.className?.includes("fb-planning-form")).props.onSubmit({ preventDefault() {} });
assert.equal(state.fixedExpenses.length, 1);
assert.equal(state.fixedExpenses[0].budgetId, state.goals[0].id);
assert.equal(state.fixedExpenses[0].dueDate, today);
assert.equal(JSON.stringify(state.transactions), snapshot);
assert.equal(JSON.stringify(state.wallets), JSON.stringify(wallets));
// A parent removed while the form is open causes rejection with zero writes.
slots = []; props = { navigate: () => {}, initialTab: "fixed", initialForm: "fixed" };
render(); set("Linked budget (optional)", createdBudget.id); set("Name", "Another bill"); set("Amount", "100000"); set("Category", "Food");
const staleSubmit = await find(tree(), (node) => node.type === "form" && node.props.className?.includes("fb-planning-form")).props.onSubmit;
state = { ...state, goals: [] };
await staleSubmit({ preventDefault() {} });
assert.equal(state.fixedExpenses.length, 1);
assert.equal(JSON.stringify(state.transactions), snapshot);
// Edit and pause modify only a plan, with no duplicate plan or financial entry.
state = { ...state, goals: [createdBudget] }; slots = []; props = { navigate: () => {}, initialTab: "fixed" };
render();
find(tree(), (node) => node.type === "button" && node.props.children === "Edit").props.onClick();
set("Name", "Phone plan updated"); set("Amount", "300000");
await find(tree(), (node) => node.type === "form" && node.props.className?.includes("fb-planning-form")).props.onSubmit({ preventDefault() {} });
assert.equal(state.fixedExpenses.length, 1);
assert.equal(state.fixedExpenses[0].amount, 300000);
find(tree(), (node) => node.type === "button" && node.props.children === "Pause").props.onClick();
assert.equal(state.fixedExpenses[0].active, false);
assert.equal(model.budgetSummary(state, createdBudget, today).planned, 0);
find(tree(), (node) => node.type === "button" && node.props.children === "Resume").props.onClick();
assert.equal(state.fixedExpenses[0].active, true);
state = { ...state, goals: [createdBudget, { ...createdBudget, id: "cny-budget", title: "CNY living costs", wallet: "ali", currency: "CNY", category: "Food" }] };
find(tree(), (node) => node.type === "button" && node.props.children === "Edit").props.onClick();
set("Linked budget (optional)", "cny-budget");
assert.equal(find(tree(), (node) => node.type === "input" && node.props["aria-label"] === "Amount").props.value, "", "changing currency never reuses an unconverted amount");
await find(tree(), (node) => node.type === "form" && node.props.className?.includes("fb-planning-form")).props.onSubmit({ preventDefault() {} });
assert.equal(state.fixedExpenses[0].budgetId, createdBudget.id);
assert.equal(JSON.stringify(state.transactions), snapshot);
assert.equal(JSON.stringify(state.wallets), JSON.stringify(wallets));
console.log("PASS: actual spending, no double counting, wallet/currency isolation, recurring dates, invalid/stale parents, VI/EN/ZH UI, create/edit/pause/resume and zero financial writes.");

}
main().catch(error => { console.error(error); process.exitCode = 1; });
