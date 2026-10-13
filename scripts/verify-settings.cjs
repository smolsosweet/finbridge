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
  wallets: [
    { id: "bank", name: "Bank", initial: 1000000, currency: "VND", type: "cash" },
    { id: "ali", name: "Alipay", initial: 500, currency: "CNY", type: "cash" },
    { id: "old", name: "Old wallet", initial: 10, currency: "USD", type: "cash", archived: true },
  ],
  transactions: [
    { id: "salary", type: "income", amount: 500000, wallet: "bank", date: "2026-10-01", category: "Salary" },
    { id: "food", type: "expense", amount: 200000, wallet: "bank", date: "2026-10-02", category: "Food" },
  ],
  categories: ["Food", "Salary"],
  categoryMeta: { Food: { type: "expense", icon: "f555", children: [] } },
  goals: [],
  fixedExpenses: [],
  recurring: [],
  rules: [],
  settings: {
    name: "cincin",
    email: "cinderellagr01@gmail.com",
    language: "Tiếng Việt",
    theme: "light",
  },
};

let writes = 0, cursor = 0, slots = [], destination = "";
let signOutCalls = 0, signOutFails = false, route = "", refreshes = 0;
const testReact = {
  ...React,
  useState(initial) {
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
    return [slots[index], (next) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
  },
  useEffect() {},
  useRef: () => ({ current: null }),
  useCallback: (fn) => fn,
};

const store = {
  useAppState: () => state,
  money: (value) => String(value),
  updateState(update) { writes++; state = update(state); },
  setSetting(key, value) { writes++; state.settings[key] = value; },
};
const header = compile("FinBridgeHeader.tsx");
const ui = {
  Icon: () => React.createElement("span"),
  Field: ({ label, children }) => React.createElement("label", null, label, children),
  PageHeader: ({ title, children }) => React.createElement("header", null, title, children),
  Toggle: () => null,
  EmptyState: () => null,
  Modal: ({ children, onClose }) => React.createElement("section", { role: "dialog" }, React.createElement("button", { onClick: onClose }, "Close"), children),
};

const overview = compile("SettingsOverview.tsx", (name) => {
  if (name === "react") return testReact;
  if (name === "./store") return store;
  if (name === "./FinBridgeHeader") return header;
  if (name === "./CalendarLedgerModal") return { CalendarLedgerModal: () => null };
  if (name === "./Ui") return ui;
  return localRequire(name);
});

function resolve(name) {
  if (name === "react") return testReact;
  if (name === "./store") return store;
  if (name === "./FinBridgeHeader") return header;
  if (name === "./SettingsOverview") return overview;
  if (name === "./Ui") return ui;
  if (name === "next/navigation") return { useSearchParams: () => new URLSearchParams(), useRouter: () => ({ replace: (next) => { route = next; }, refresh: () => { refreshes++; } }) };
  if (name === "@/lib/sign-out") return { async signOutGoogle() { signOutCalls++; if (signOutFails) throw new Error("SIGN_OUT_FAILED"); } };
  if (name === "./Tools") return { CurrencySelect: () => null };
  return localRequire(name);
}

function find(node, predicate) {
  if (!React.isValidElement(node)) return undefined;
  if (predicate(node)) return node;
  for (const child of React.Children.toArray(node.props.children)) {
    const match = find(child, predicate);
    if (match) return match;
  }
}

const navigate = (value) => { destination = value; };
const snapshot = JSON.stringify(state);

// 1. Verify SettingsOverview renders unified header and 5 items without any 3D mascot
for (const [language, expected] of [
  ["Tiếng Việt", ["Cài đặt tài khoản", "Yêu cầu tính năng", "Liên hệ với chúng tôi", "Điều khoản dịch vụ", "Chính sách bảo mật"]],
  ["English", ["Account settings", "Feature requests", "Contact us", "Terms of service", "Privacy policy"]],
  ["中文", ["账户设置", "功能建议", "联系我们", "服务条款", "隐私政策"]],
]) {
  state.settings.language = language;
  const html = renderToStaticMarkup(React.createElement(overview.SettingsOverview, { navigate }));
  for (const item of expected) {
    assert.ok(html.includes(item), `SettingsOverview should include "${item}" in ${language}`);
  }
  // Verify unified intro banner is present
  assert.match(html, /fb-home-intro fb-settings-header/, "Unified intro banner must be present");
  assert.match(html, /fb-eyebrow/, "Eyebrow must be present");
  // Verify mascot and unwanted items are NOT present
  assert.doesNotMatch(html, /mascot|Cheerleader/i, "3D Mascot must be completely removed");
  assert.doesNotMatch(html, /Premium/, "Rolly Premium should be removed");
}

// 2. Navigation tests from SettingsOverview
state.settings.language = "Tiếng Việt";
const root = overview.SettingsOverview({ navigate });
// Clicking account card
find(root, (node) => node.props && node.props["aria-label"] === "Cài đặt tài khoản").props.onClick();
assert.equal(destination, "accountSettings");

// Clicking feature requests card
find(root, (node) => node.props && node.props["aria-label"] === "Yêu cầu tính năng").props.onClick();
assert.equal(destination, "featureRequest");

// 3. Verify AccountSettings renders Image 2 requirements
const settings = compile("Settings.tsx", resolve);
slots = []; cursor = 0;
const accountHtml = renderToStaticMarkup(React.createElement(settings.AccountSettings, { navigate }));
// Profile card
assert.ok(accountHtml.includes("cincin"), "Profile card should render display name");
assert.ok(accountHtml.includes("cinderellagr01@gmail.com"), "Profile card should render email");
// Options
assert.ok(accountHtml.includes("Định dạng số tiền"), "Should include currency format");
assert.ok(accountHtml.includes("Nhắc nhở thông báo"), "Should include notification reminders");
assert.ok(accountHtml.includes("Đổi tài khoản"), "Should include switch account");
assert.ok(accountHtml.includes("Đăng xuất"), "Should include logout");
assert.ok(accountHtml.includes("Xóa tài khoản"), "Should include delete account");

// Verify removed items are NOT in AccountSettings
assert.doesNotMatch(accountHtml, /Tính cách của FinBridge|Tính cách của Rolly/, "Personality should be removed");
assert.doesNotMatch(accountHtml, /Mục tiêu tài chính/, "Goals should be removed");
assert.doesNotMatch(accountHtml, /Cấu hình trang chủ/, "Homepage config should be removed");
assert.doesNotMatch(accountHtml, /Xuất CSV|Nhập CSV/, "CSV should be removed");
assert.doesNotMatch(accountHtml, /Chế độ thêm giao dịch thủ công/, "Manual mode should be removed");

// 4. Test language change in AccountSettings
slots = []; cursor = 0;
const accountTree = settings.AccountSettings({ navigate });
find(accountTree, (node) => node.type === "select").props.onChange({ target: { value: "English" } });
assert.equal(state.settings.language, "English");

// 5. Zero financial writes
assert.equal(JSON.stringify(state.wallets), JSON.stringify(JSON.parse(snapshot).wallets));
assert.equal(JSON.stringify(state.transactions), JSON.stringify(JSON.parse(snapshot).transactions));

process.stdout.write("PASS: Unified SettingsOverview (no mascot, matching intro banner & cards), AccountSettings Image-2 profile/format/reminders/auth, zero financial writes.\n");

async function verifyLogout() {
  const financialBefore = JSON.stringify({ wallets: state.wallets, transactions: state.transactions });
  const writesBefore = writes;
  for (const [language, label] of [["English", "Sign out"], ["Tiếng Việt", "Đăng xuất"], ["中文", "退出登录"]]) {
    state.settings.language = language;
    slots = []; cursor = 0;
    const props = { navigate };
    const accountRender = () => { cursor = 0; return settings.AccountSettings(props); };
    const logoutRow = find(accountRender(), (node) => node.type === "button" && node.props.className === "fb-account-opt-row " && node.props.children[1]?.props.children[0]?.props.children === label);
    assert.ok(logoutRow, `Localized logout in account settings: ${language}`);
    const callsBefore = signOutCalls;
    logoutRow.props.onClick();
    assert.equal(signOutCalls, callsBefore, "Opening confirmation must not revoke the session");
    const confirm = () => find(accountRender(), (node) => node.type === "button" && node.props.className === "r-primary" && node.props.children === label);
    assert.ok(confirm());
    signOutFails = true; route = "";
    confirm().props.onClick();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(route, "", "Failed sign-out must keep the current page");
    assert.ok(find(accountRender(), (node) => node.props.role === "alert"));
    signOutFails = false;
    const refreshBefore = refreshes;
    confirm().props.onClick();
    assert.ok(find(accountRender(), (node) => node.type === "button" && node.props.className === "r-primary" && node.props.disabled));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(route, "/");
    assert.equal(refreshes, refreshBefore + 1);
    assert.equal(signOutCalls, callsBefore + 2);
  }
  assert.equal(writes, writesBefore);
  assert.equal(JSON.stringify({ wallets: state.wallets, transactions: state.transactions }), financialBefore);
  process.stdout.write("PASS: account logout confirmation, server sign-out call, welcome redirect, failure handling and VI/EN/ZH labels; zero financial writes.\n");
}
verifyLogout().catch((error) => { console.error(error); process.exitCode = 1; });
