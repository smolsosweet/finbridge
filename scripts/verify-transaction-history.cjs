// Render the real component with isolated fixtures; no browser or persisted data writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { createRequire } = require("node:module");

const directory = path.resolve(__dirname, "../src/components/sites/rolly/replica");
const componentFile = path.join(directory, "TransactionHistory.tsx");
const localRequire = createRequire(componentFile);
const wallets = [
  { id: "bank", name: "Bank A Everyday", currency: "VND" },
  { id: "ali", name: "Alipay", currency: "CNY" },
  { id: "old", name: "Archived wallet", currency: "VND", archived: true },
];
const transactions = [
  ...Array.from({ length: 6 }, (_, i) => ({
    id: "expense-" + i, title: "Purchase " + i, amount: 100000, type: "expense",
    category: "Shopping", date: "2026-10-0" + (i + 1), wallet: "bank", note: "",
  })),
  { id: "salary", title: "Employer", amount: 5000000, type: "income", category: "Salary", date: "2026-10-07", wallet: "bank", note: "" },
  { id: "ali-income", title: "Alipay income", amount: 200, type: "income", category: "Salary", date: "2026-10-08", wallet: "ali", note: "" },
  { id: "transfer", title: "Move funds", amount: 50000, type: "transfer", category: "Transfer", date: "2026-10-09", wallet: "bank", targetWallet: "old", note: "" },
  { id: "ali-food", title: "Alipay lunch", amount: 30, type: "expense", category: "Food", date: "2026-10-10", wallet: "ali", note: "" },
];
const sample = [{ id: "sample", title: "Synthetic purchase", date: "2026-10-04", type: "expense", category: "Shopping", currency: "VND", amount: 120000 }];

function compile(file, resolve) {
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const result = { exports: {} };
  new Function("require", "module", "exports", compiled)(resolve, result, result.exports);
  return result.exports;
}
const weeks = compile(path.join(directory, "chartWeek.ts"), localRequire);
const header = compile(path.join(directory, "FinBridgeHeader.tsx"), localRequire);
const periods = compile(path.join(directory, "HistoryPeriodPicker.tsx"), (name) => {
  if (name === "./chartWeek") return weeks;
  if (name === "./Ui") return { Modal: () => null };
  return localRequire(name);
});
let query = "";
let language = "English";
let input = transactions;
let controlled = false;
let cursor = 0;
const slots = [];
const testReact = {
  ...React,
  useState(initial) {
    if (!controlled) return React.useState(initial);
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
    return [slots[index], (next) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
  },
};
const state = () => ({ wallets, transactions: input, settings: { language } });
const component = compile(componentFile, (name) => {
  if (name === "./Dashboard") return { DASHBOARD_SAMPLE: sample };
  if (name === "./CalendarLedgerModal") return { CalendarLedgerModal: () => null };
  if (name === "./FinBridgeHeader") return header;
  if (name === "./store") return { useAppState: state };
  if (name === "./chartWeek") return weeks;
  if (name === "./HistoryPeriodPicker") return periods;
  if (name === "react") return testReact;
  if (name === "next/navigation") return { useSearchParams: () => new URLSearchParams(query) };
  return localRequire(name);
}).TransactionHistory;
const render = () => { cursor = 0; return renderToStaticMarkup(React.createElement(component, { navigate: () => {} })); };
const rowCount = (html) => (html.match(/<article /g) || []).length;

let html = render();
assert.equal(rowCount(html), 5, "page size stays at five");
assert.match(html, /\+5,000,000 VND/);
assert.match(html, /\+200 CNY/, "income stays separated by currency");
assert.match(html, /−30 CNY/, "expense is a separate CNY row");
assert.match(html, /600,000 VND/, "transfers do not inflate expenses");
assert.ok(html.indexOf("Alipay lunch") < html.indexOf("Move funds"), "newest first");
assert.doesNotMatch(html, /99%|Automatically categorized|empty_list|r-mascot/, "missing metadata is not invented");

query = "wallet=bank&type=income";
html = render();
assert.equal(rowCount(html), 1);
assert.match(html, /Employer/);
assert.doesNotMatch(html, /<h3>Alipay income/);

query = "from=2026-10-03&to=2026-10-04&type=expense";
html = render();
assert.equal(rowCount(html), 2, "date boundaries are inclusive");
assert.match(html, /200,000 VND/);

query = "from=2026-10-08&to=2026-10-01";
assert.equal(rowCount(render()), 0, "invalid range returns no records");

query = "source=sample&wallet=bank";
html = render();
assert.equal(rowCount(html), 1);
assert.match(html, /Synthetic Data/);
assert.match(html, /120,000 VND/);
assert.match(html, /Bank A Everyday/);
query = "source=sample&wallet=ali";
assert.equal(rowCount(render()), 0, "sample is not falsely assigned to another wallet");

query = "";
input = [{ ...transactions[6], occurredAt: "2026-10-11T12:19:00", classification: { method: "automatic", confidence: .99, reason: "Matched an employer income rule." } }];
html = render();
assert.match(html, /12:19:00/);
assert.match(html, /99%/);
assert.match(html, /Matched an employer income rule/);

input = [];
assert.equal(rowCount(render()), 0);
assert.match(render(), /No matching transactions/);
language = "Tiếng Việt";
assert.match(render(), /Lịch sử giao dịch/);
language = "中文";
assert.match(render(), /交易记录/);
assert.equal(transactions.length, 10, "fixtures and stored records are not modified");

// Exercise the real component event handlers using controlled hook state.
input = transactions; language = "English"; query = ""; controlled = true;
function tree() { cursor = 0; return component({ navigate: () => {} }); }
function find(node, predicate) {
  if (!React.isValidElement(node)) return undefined;
  if (predicate(node)) return node;
  for (const child of React.Children.toArray(node.props.children)) {
    const result = find(child, predicate);
    if (result) return result;
  }
}
function select(label) {
  const element = find(tree(), (node) => node.type === "label" && React.Children.toArray(node.props.children).some((child) => React.isValidElement(child) && child.type === "span" && child.props.children === label));
  return find(element, (node) => node.type === "select");
}
const categoryOptions = () => React.Children.toArray(select("Category").props.children).flatMap((node) => React.isValidElement(node) ? [node.props.value] : []);
assert.deepEqual(categoryOptions(), ["all", "Food", "Salary", "Shopping", "Transfer"], "all-wallet categories are deduplicated");
find(tree(), (node) => node.type === "button" && node.props["aria-label"] === "Next page").props.onClick();
assert.equal(rowCount(render()), 5);
assert.match(render(), /Showing 6–10/);
select("Source wallet").props.onChange({ target: { value: "bank" } });
assert.deepEqual(categoryOptions(), ["all", "Salary", "Shopping", "Transfer"], "wallet categories contain income and expense categories");
assert.match(render(), /Showing 1–5/, "filter change resets pagination");
select("Category").props.onChange({ target: { value: "Shopping" } });
assert.match(render(), /−600,000 VND/);
assert.match(render(), /\+0 VND/);
select("Source wallet").props.onChange({ target: { value: "ali" } });
assert.deepEqual(categoryOptions(), ["all", "Food", "Salary"]);
assert.match(render(), /\+200 CNY/);
assert.match(render(), /−30 CNY/);
assert.doesNotMatch(render(), /600,000 VND/, "currency rows follow wallet filter");
select("Transaction type").props.onChange({ target: { value: "income" } });
assert.deepEqual(categoryOptions(), ["all", "Salary"], "categories filter by transaction type");
assert.equal(rowCount(render()), 1);
assert.match(render(), /−0 CNY/, "zero expense still has a currency row");
const picker = find(tree(), (node) => node.type === periods.HistoryPeriodPicker);
picker.props.onChange({ ...picker.props.value, kind: "day", day: "2026-10-10" });
assert.equal(rowCount(render()), 0);
assert.match(render(), /\+0 CNY/);
assert.match(render(), /−0 CNY/);
assert.ok(find(tree(), (node) => node.type === "button" && node.props["aria-label"] === "Add transaction"));
assert.doesNotMatch(render(), /Add in chat/);
assert.match(render(), /fb-brand-mark/);
const period = { kind: "month", day: "2026-10-12", month: 9, year: 2026, from: "2026-10-03", to: "2026-10-04" };
assert.equal(periods.matchesHistoryPeriod("2026-09-30", period), false);
assert.equal(periods.matchesHistoryPeriod("2026-10-31", period), true);
assert.equal(periods.matchesHistoryPeriod("2025-10-12", { ...period, kind: "year" }), false);
assert.equal(periods.matchesHistoryPeriod("2026-10-18", { ...period, kind: "week" }), true);
assert.equal(periods.matchesHistoryPeriod("2026-10-19", { ...period, kind: "week" }), false);
assert.equal(periods.matchesHistoryPeriod("2026-10-03", { ...period, kind: "custom" }), true);
console.log("PASS: 10 isolated transactions; filter handlers, categories by wallet, deduplication, aligned currency totals, zero rows, pagination, logo/FAB, date-period boundaries and VI/EN/ZH render.");
