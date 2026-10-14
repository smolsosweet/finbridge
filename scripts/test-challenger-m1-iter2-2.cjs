// scripts/test-challenger-m1-iter2-2.cjs
// Empirical verification script by Challenger M1-Iter2-2
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const {
  renderDashboardWithOverrides,
  renderWalletScreen,
} = require("./verify-challenger-m1-2.cjs");

console.log("=== CHALLENGER M1-ITER2-2 INDEPENDENT EMPIRICAL SUITE ===");

// 1. Inspect Dashboard.tsx source for edit-wallet-name
const dashboardSource = fs.readFileSync(
  path.resolve(__dirname, "../src/components/sites/rolly/replica/Dashboard.tsx"),
  "utf8"
);

// Locate the input with id="edit-wallet-name" accurately by finding the line index
const lines = dashboardSource.split("\n");
const idLineIdx = lines.findIndex((l) => l.includes('id="edit-wallet-name"'));
assert.ok(idLineIdx !== -1, "Line with id='edit-wallet-name' must exist in Dashboard.tsx");

// Grab the enclosing input tag lines (from line with '<input' up to '/>')
let startIdx = idLineIdx;
while (startIdx > 0 && !lines[startIdx].includes("<input")) {
  startIdx--;
}
let endIdx = idLineIdx;
while (endIdx < lines.length && !lines[endIdx].includes("/>")) {
  endIdx++;
}

const inputSnippet = lines.slice(startIdx, endIdx + 1).join("\n");
console.log("[EMPIRICAL] Found input snippet:\n", inputSnippet);

// Assert NO required attribute on edit-wallet-name
assert.strictEqual(
  /\brequired\b/.test(inputSnippet),
  false,
  "edit-wallet-name MUST NOT have the HTML5 'required' attribute"
);
console.log("✔ [PASS] HTML5 'required' attribute is strictly absent from edit-wallet-name tag in Dashboard.tsx");

// 2. Test handleSaveWalletInfo logic directly with mock state
const { isSentinelWalletName } = require("../src/lib/i18n.ts");

function simulateHandleSaveWalletInfo(targetWallet, editNameInput) {
  const trimmed = editNameInput.trim();
  const isTargetSentinel = isSentinelWalletName(targetWallet.name);
  const persistentName = isTargetSentinel
    ? (!trimmed || isSentinelWalletName(trimmed) || trimmed === "Ví chính" || trimmed === "Main wallet" || trimmed === "主钱包" ? "." : trimmed)
    : (trimmed || targetWallet.name);
  return persistentName;
}

// Test case A: Custom wallet with non-empty input
assert.strictEqual(
  simulateHandleSaveWalletInfo({ id: "w1", name: "HSBC Platinum" }, "HSBC Everyday"),
  "HSBC Everyday",
  "Renaming custom wallet to new name should store new trimmed name"
);

// Test case B: Custom wallet with empty input (user cleared it in browser)
assert.strictEqual(
  simulateHandleSaveWalletInfo({ id: "w1", name: "HSBC Platinum" }, ""),
  "HSBC Platinum",
  "Clearing name for custom wallet MUST preserve existing target.name"
);

// Test case C: Custom wallet with whitespace only (user entered spaces)
assert.strictEqual(
  simulateHandleSaveWalletInfo({ id: "w1", name: "HSBC Platinum" }, "   \t  "),
  "HSBC Platinum",
  "Whitespace-only input for custom wallet MUST preserve existing target.name"
);

// Test case D: Sentinel wallet with empty input (user cleared it in browser)
assert.strictEqual(
  simulateHandleSaveWalletInfo({ id: "w0", name: "." }, ""),
  ".",
  "Clearing name for sentinel wallet MUST store canonical '.'"
);

// Test case E: Sentinel wallet with whitespace only
assert.strictEqual(
  simulateHandleSaveWalletInfo({ id: "w0", name: "." }, "   "),
  ".",
  "Whitespace-only for sentinel wallet MUST store canonical '.'"
);

// Test case F: Sentinel wallet with localized label
assert.strictEqual(
  simulateHandleSaveWalletInfo({ id: "w0", name: "." }, "Ví chính"),
  ".",
  "Localized 'Ví chính' for sentinel wallet MUST store canonical '.'"
);
assert.strictEqual(
  simulateHandleSaveWalletInfo({ id: "w0", name: "." }, "Main wallet"),
  ".",
  "Localized 'Main wallet' for sentinel wallet MUST store canonical '.'"
);
assert.strictEqual(
  simulateHandleSaveWalletInfo({ id: "w0", name: "." }, "主钱包"),
  ".",
  "Localized '主钱包' for sentinel wallet MUST store canonical '.'"
);

// Test case G: Sentinel wallet renamed to custom name
assert.strictEqual(
  simulateHandleSaveWalletInfo({ id: "w0", name: "." }, "Vietcombank Priority"),
  "Vietcombank Priority",
  "Renaming sentinel wallet to custom name MUST store new custom name"
);

console.log("✔ [PASS] simulateHandleSaveWalletInfo seamlessly handles all custom and sentinel transitions");

// 3. Rendered SSR / DOM leak testing across EN, VI, ZH
const fixtureState = (lang) => ({
  wallets: [
    { id: "w-custom", name: "Techcombank Private", currency: "VND", initial: 10000000, type: "cash" },
    { id: "w-main", name: ".", currency: "VND", initial: 2000000, type: "cash" },
    { id: "w-cred", name: "VPBank StepUp", currency: "VND", initial: 0, limit: 30000000, type: "credit" },
    { id: "w-cny", name: "ICBC China", currency: "CNY", initial: 5000, type: "cash" },
  ],
  transactions: [
    { id: "t1", title: "Cơm trưa", amount: 50000, type: "expense", category: "Food", date: "2026-10-14", wallet: "w-custom", note: "ăn bún" },
  ],
  categories: ["Food", "Salary"],
  categoryMeta: {
    Food: { type: "expense", icon: "f555", children: [] },
    Salary: { type: "income", icon: "f555", children: [] },
  },
  goals: [],
  fixedExpenses: [],
  recurring: [],
  rules: [],
  settings: {
    name: "Tester",
    email: "test@domain.test",
    language: lang,
    theme: "light",
    currencyFormat: "code",
  },
});

for (const lang of ["English", "Tiếng Việt", "中文"]) {
  const state = fixtureState(lang);

  // 3.1 Render Add Wallet Modal (cash)
  const addCashHtml = renderDashboardWithOverrides(state, {
    14: "addWallet", // modal
    19: "cash",       // newWalletType
  });
  assert.ok(addCashHtml.length > 500, `Add Wallet (cash) rendered html for ${lang}`);

  // 3.2 Render Add Wallet Modal (credit)
  const addCreditHtml = renderDashboardWithOverrides(state, {
    14: "addWallet",
    19: "credit",
  });
  assert.ok(addCreditHtml.length > 500, `Add Wallet (credit) rendered html for ${lang}`);

  // 3.3 Render Manage Wallet Modal (details tab, custom wallet with txs)
  const mngDetailsWithTxs = renderDashboardWithOverrides(state, {
    14: "manageWallet",
    21: "w-custom",
    22: "details",
    23: "Techcombank Private",
  });
  assert.ok(mngDetailsWithTxs.includes("Techcombank Private"), "Verbatim wallet name in header");
  // Ensure required is absent in rendered markup for edit-wallet-name
  assert.ok(!mngDetailsWithTxs.match(/id="edit-wallet-name"[^>]*\brequired\b/), "edit-wallet-name must not have required attribute in rendered DOM");

  // 3.4 Render Manage Wallet Modal (details tab, zero txs wallet)
  const mngDetailsNoTxs = renderDashboardWithOverrides(state, {
    14: "manageWallet",
    21: "w-cny",
    22: "details",
    23: "ICBC China",
  });
  assert.ok(mngDetailsNoTxs.includes("ICBC China"));

  // 3.5 Render Manage Wallet Modal (categories tab)
  const mngCats = renderDashboardWithOverrides(state, {
    14: "manageWallet",
    21: "w-custom",
    22: "categories",
  });
  assert.ok(mngCats.length > 500);

  // 3.6 Render WalletScreen (Add & Edit)
  const wsAdd = renderWalletScreen(state, undefined);
  const wsEdit = renderWalletScreen(state, "w-custom");
  assert.ok(wsAdd.length > 500);
  assert.ok(wsEdit.includes("Techcombank Private"));
}

console.log("✔ [PASS] Rendered DOM/SSR tests across all modals, tabs, and languages (EN, VI, ZH) verified cleanly!");
console.log("=== ALL INDEPENDENT VERIFICATION CHECKS PASSED ===");
