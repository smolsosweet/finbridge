// Exercise real React components and handlers with isolated data; no browser storage writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { createRequire } = require("node:module");
const directory = path.resolve(__dirname, "../src/components/sites/rolly/replica");
const localRequire = createRequire(path.join(directory, "Settings.tsx"));
function compile(file, resolve = localRequire) {
  const source = ts.transpileModule(fs.readFileSync(path.join(directory, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const result = { exports: {} };
  new Function("require", "module", "exports", source)(resolve, result, result.exports);
  return result.exports;
}
let state = {
  wallets: [{ id: "bank", name: "Bank", initial: 1000000, currency: "VND", type: "cash" }, { id: "ali", name: "Alipay", initial: 500, currency: "CNY", type: "cash" }, { id: "old", name: "Old wallet", initial: 10, currency: "USD", type: "cash", archived: true }],
  transactions: [{ id: "salary", type: "income", amount: 500000, wallet: "bank", date: "2026-10-01", category: "Salary" }, { id: "food", type: "expense", amount: 200000, wallet: "bank", date: "2026-10-02", category: "Food" }, { id: "transfer", type: "transfer", amount: 50, wallet: "ali", targetWallet: "old", date: "2026-10-03", category: "Transfer" }],
  categories: ["Food", "Salary"], categoryMeta: { Food: { type: "expense", icon: "f555", children: [] } }, goals: [], fixedExpenses: [], recurring: [], rules: [],
  settings: { name: ".", language: "English", theme: "light", personality: "", goal: "", less: "" },
};
let writes = 0, cursor = 0, slots = [], destination = "";
const testReact = { ...React, useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial; return [slots[index], (next) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }]; }, useEffect() {}, useRef: () => ({ current: null }), useCallback: (fn) => fn };
const store = { useAppState: () => state, money: (value) => String(value), updateState(update) { writes++; state = update(state); }, setSetting(key, value) { writes++; state.settings[key] = value; } };
const header = compile("FinBridgeHeader.tsx");
const ui = { Icon: () => React.createElement("span"), Field: ({ label, children }) => React.createElement("label", null, label, children), PageHeader: ({ title, children }) => React.createElement("header", null, title, children), Toggle: () => null, EmptyState: () => null, Modal: ({ children, onClose }) => React.createElement("section", { role: "dialog" }, React.createElement("button", { onClick: onClose }, "Close"), children) };
const overview = compile("SettingsOverview.tsx", (name) => name === "react" ? testReact : name === "./store" ? store : name === "./FinBridgeHeader" ? header : name === "./CalendarLedgerModal" ? { CalendarLedgerModal: () => null } : name === "./Ui" ? ui : localRequire(name));
const weeks = compile("chartWeek.ts");
function resolve(name) {
  if (name === "react") return testReact;
  if (name === "./store") return store;
  if (name === "./FinBridgeHeader") return header;
  if (name === "./SettingsOverview") return overview;
  if (name === "./Ui") return ui;
  if (name === "next/navigation") return { useSearchParams: () => new URLSearchParams() };
  if (name === "./chartWeek") return weeks;
  if (name === "./CalendarLedgerModal") return { CalendarLedgerModal: () => null };
  if (name === "./Categories") return { categoryIcon: () => "", iconGroups: [] };
  if (name === "./Tools") return { CurrencySelect: () => null };
  return localRequire(name);
}
function find(node, predicate) { if (!React.isValidElement(node)) return undefined; if (predicate(node)) return node; for (const child of React.Children.toArray(node.props.children)) { const match = find(child, predicate); if (match) return match; } }
const navigate = (value) => { destination = value; };
const snapshot = JSON.stringify(state);
for (const [language, title] of [["English", "Account &amp; settings"], ["Tiếng Việt", "Tài khoản &amp; cài đặt"], ["中文", "账户与设置"]]) {
  state.settings.language = language;
  const html = renderToStaticMarkup(React.createElement(overview.SettingsOverview, { navigate }));
  assert.ok(html.includes(title)); assert.match(html, /fb-brand-mark/);
  assert.doesNotMatch(html, /r-mascot|r-robot|Premium|featureRequest|support|terms|privacy/);
}
state.settings.language = "English";
const root = overview.SettingsOverview({ navigate });
find(root, (node) => node.props.className === "fb-settings-card").props.onClick(); assert.equal(destination, "walletSettings");
find(root, (node) => node.props.className === "fb-settings-card" && node.props.children[1].props.children[0].props.children === "Account settings").props.onClick(); assert.equal(destination, "accountSettings");
let managed = "";
const directoryProps = { state, navigate, onManage: (id) => { managed = id; } };
const html = renderToStaticMarkup(React.createElement(overview.WalletSettingsDirectory, directoryProps));
assert.match(html, /1,300,000 VND/); assert.match(html, /450 CNY/); assert.match(html, /60 USD/); assert.match(html, /Archived/);
find(overview.WalletSettingsDirectory(directoryProps), (node) => node.props["aria-label"] === "Manage wallet Alipay").props.onClick(); assert.equal(managed, "ali");
slots = []; cursor = 0;
const dashboard = compile("Dashboard.tsx", resolve).Dashboard;
const dashboardProps = { walletSettingsMode: true, navigate };
function tree() { cursor = 0; return dashboard(dashboardProps); }
find(tree(), (node) => node.type === overview.WalletSettingsDirectory).props.onManage("ali");
cursor = 0;
const manager = renderToStaticMarkup(React.createElement(dashboard, dashboardProps));
assert.match(manager, /role="dialog"/); assert.match(manager, /value="Alipay"/); assert.match(manager, /450 CNY/);
find(tree(), (node) => node.type === ui.Modal).props.onClose();
cursor = 0; assert.doesNotMatch(renderToStaticMarkup(React.createElement(dashboard, dashboardProps)), /role="dialog"/);
assert.equal(writes, 0); assert.equal(JSON.stringify(state), snapshot);
const settings = compile("Settings.tsx", resolve);
assert.equal(settings.settingRows.length, 2);
slots = []; cursor = 0;
const account = renderToStaticMarkup(React.createElement(settings.AccountSettings, { navigate }));
assert.match(account, /fb-brand-mark/); assert.match(account, /中文/); assert.doesNotMatch(account, /r-mascot|r-robot/);
slots = []; cursor = 0;
const accountTree = settings.AccountSettings({ navigate });
find(accountTree, (node) => node.type === "select").props.onChange({ target: { value: "中文" } });
assert.equal(state.settings.language, "中文"); assert.equal(writes, 1);
assert.equal(JSON.stringify(state.wallets), JSON.stringify(JSON.parse(snapshot).wallets));
assert.equal(JSON.stringify(state.transactions), JSON.stringify(JSON.parse(snapshot).transactions));
process.stdout.write("PASS: settings groups, VI/EN/ZH overview, navigation, multi-wallet balances, same Home wallet manager open/close, language setting, zero financial writes.\n");
