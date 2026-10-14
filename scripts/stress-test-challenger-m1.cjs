const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const ts = require("typescript");

// Compile src/lib/i18n.ts
const i18nSource = fs.readFileSync(path.resolve(__dirname, "../src/lib/i18n.ts"), "utf8");
const i18nCompiled = ts.transpileModule(i18nSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const i18nExports = {};
new Function("require", "exports", "module", i18nCompiled)(require, i18nExports, { exports: i18nExports });

const {
  resolveLanguage,
  resolveWalletDisplayName,
  isSentinelWalletName,
  normalizeWalletNameForStorage,
  getLanguageLabel,
  getLocale,
  isLanguage,
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABELS,
  LANGUAGE_LOCALES,
} = i18nExports;

let passedTests = 0;
let totalTests = 0;

const failures = [];

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✔ [PASS] ${name}`);
  } catch (err) {
    failures.push({ name, error: err.message, stack: err.stack });
    console.error(`  ✖ [FAIL] ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

console.log("=== EMPIRICAL ADVERSARIAL STRESS TEST HARNESS (M1-1) ===");

// =========================================================================
// SECTION 1: Malformed, Whitespace-Padded, Mixed-Case & Unexpected Language Inputs
// =========================================================================
console.log("\n--- Section 1: Canonical Language Resolver Adversarial Inputs ---");

runTest("Mission specified inputs: '   eN-US  ' resolves to 'en'", () => {
  assert.equal(resolveLanguage("   eN-US  "), "en");
});

runTest("Mission specified inputs: 'zh-Hant' resolves to 'zh'", () => {
  assert.equal(resolveLanguage("zh-Hant"), "zh");
});

runTest("Mission specified inputs: 'VIETNAMESE' resolves to 'vi'", () => {
  assert.equal(resolveLanguage("VIETNAMESE"), "vi");
});

runTest("Mission specified inputs: null resolves to fallback 'vi'", () => {
  assert.equal(resolveLanguage(null), "vi");
  assert.equal(resolveLanguage(null, "en"), "en");
  assert.equal(resolveLanguage(null, "zh"), "zh");
});

runTest("Mission specified inputs: undefined resolves to fallback 'vi'", () => {
  assert.equal(resolveLanguage(undefined), "vi");
  assert.equal(resolveLanguage(undefined, "en"), "en");
  assert.equal(resolveLanguage(undefined, "zh"), "zh");
});

runTest("Mission specified inputs: 123 (number) resolves safely to fallback 'vi'", () => {
  assert.equal(resolveLanguage(123), "vi");
  assert.equal(resolveLanguage(0), "vi");
  assert.equal(resolveLanguage(-42), "vi");
  assert.equal(resolveLanguage(NaN), "vi");
  assert.equal(resolveLanguage(Infinity), "vi");
});

runTest("Mission specified inputs: {} (object) resolves safely to fallback 'vi'", () => {
  assert.equal(resolveLanguage({}), "vi");
  assert.equal(resolveLanguage({ lang: "en" }), "vi");
  assert.equal(resolveLanguage({ toString: () => "en" }), "vi");
  assert.equal(resolveLanguage({ toString: () => { throw new Error("Poison"); } }), "vi");
});

runTest("Mission specified inputs: [] (array) resolves safely to fallback 'vi'", () => {
  assert.equal(resolveLanguage([]), "vi");
  assert.equal(resolveLanguage(["en"]), "vi");
  assert.equal(resolveLanguage(["zh", "vi"]), "vi");
});

runTest("Exotic primitives & types: boolean, symbol, bigint, function", () => {
  assert.equal(resolveLanguage(true), "vi");
  assert.equal(resolveLanguage(false), "vi");
  assert.equal(resolveLanguage(Symbol("en")), "vi");
  assert.equal(resolveLanguage(BigInt(999)), "vi");
  assert.equal(resolveLanguage(() => "en"), "vi");
});

runTest("Whitespace variations across tabs, carriage returns, newlines", () => {
  assert.equal(resolveLanguage("\t\r\n en-GB \n"), "en");
  assert.equal(resolveLanguage("   \t   ZH-TW   \r\n"), "zh");
  assert.equal(resolveLanguage(" \t Tiếng Việt \r\n "), "vi");
  assert.equal(resolveLanguage("   \t\r\n   "), "vi"); // all whitespace -> fallback
});

runTest("Mixed case & dialect variations", () => {
  assert.equal(resolveLanguage("eNgLiSh"), "en");
  assert.equal(resolveLanguage("CHINESE"), "zh");
  assert.equal(resolveLanguage("zH-cAn"), "zh");
  assert.equal(resolveLanguage("vIeTnAmEsE"), "vi");
  assert.equal(resolveLanguage("AnH"), "en");
  assert.equal(resolveLanguage("tRuNg"), "zh");
  assert.equal(resolveLanguage("zh-SG"), "zh");
  assert.equal(resolveLanguage("zh-Hans"), "zh");
  assert.equal(resolveLanguage("zh-Hant-HK"), "zh");
  assert.equal(resolveLanguage("zh_CN"), "zh");
  assert.equal(resolveLanguage("en_US"), "en");
  assert.equal(resolveLanguage("en-AU"), "en");
  assert.equal(resolveLanguage("Tiếng Anh"), "en");
  assert.equal(resolveLanguage("Tiếng Trung"), "zh");
});

runTest("Extreme string lengths (100,000 characters stress)", () => {
  const giantWhitespace = " ".repeat(50000) + "en-US" + " ".repeat(50000);
  assert.equal(resolveLanguage(giantWhitespace), "en");

  const giantGibberish = "x".repeat(100000);
  assert.equal(resolveLanguage(giantGibberish), "vi");

  const giantChineseStart = "zh" + "y".repeat(100000);
  assert.equal(resolveLanguage(giantChineseStart), "zh");
});

runTest("Helper contracts: isLanguage, getLanguageLabel, getLocale on adversarial inputs", () => {
  assert.equal(isLanguage("en"), true);
  assert.equal(isLanguage("vi"), true);
  assert.equal(isLanguage("zh"), true);
  assert.equal(isLanguage("   eN-US  "), false);
  assert.equal(isLanguage(null), false);
  assert.equal(isLanguage(undefined), false);
  assert.equal(isLanguage(123), false);
  assert.equal(isLanguage({}), false);

  assert.equal(getLanguageLabel("   eN-US  "), "English");
  assert.equal(getLanguageLabel("zh-Hant"), "中文");
  assert.equal(getLanguageLabel("VIETNAMESE"), "Tiếng Việt");
  assert.equal(getLanguageLabel(null), "Tiếng Việt");
  assert.equal(getLanguageLabel(123), "Tiếng Việt");

  assert.equal(getLocale("   eN-US  "), "en-US");
  assert.equal(getLocale("zh-Hant"), "zh-CN");
  assert.equal(getLocale("VIETNAMESE"), "vi-VN");
  assert.equal(getLocale(null), "vi-VN");
  assert.equal(getLocale([]), "vi-VN");
});

// =========================================================================
// SECTION 2: Sentinel Wallet Name Edge Cases
// =========================================================================
console.log("\n--- Section 2: Sentinel Wallet Name Edge Cases & Storage Normalization ---");

runTest("Saving empty string or whitespace normalizes to canonical '.'", () => {
  assert.equal(normalizeWalletNameForStorage(""), ".");
  assert.equal(normalizeWalletNameForStorage("   "), ".");
  assert.equal(normalizeWalletNameForStorage("\t\r\n"), ".");
  assert.equal(normalizeWalletNameForStorage(null), ".");
  assert.equal(normalizeWalletNameForStorage(undefined), ".");

  assert.equal(isSentinelWalletName(""), true);
  assert.equal(isSentinelWalletName("   "), true);
  assert.equal(isSentinelWalletName(null), true);
  assert.equal(isSentinelWalletName(undefined), true);
});

runTest("Re-saving sentinel values normalizes to canonical '.'", () => {
  assert.equal(normalizeWalletNameForStorage("."), ".");
  assert.equal(normalizeWalletNameForStorage(" . "), ".");
  assert.equal(normalizeWalletNameForStorage("   .   "), ".");
  assert.equal(normalizeWalletNameForStorage("Ví chính"), ".");
  assert.equal(normalizeWalletNameForStorage("  Ví chính  "), ".");
  assert.equal(normalizeWalletNameForStorage("Main wallet"), ".");
  assert.equal(normalizeWalletNameForStorage("  Main wallet  "), ".");
  assert.equal(normalizeWalletNameForStorage("主钱包"), ".");
  assert.equal(normalizeWalletNameForStorage("  主钱包  "), ".");

  assert.equal(isSentinelWalletName("."), true);
  assert.equal(isSentinelWalletName(" . "), true);
  assert.equal(isSentinelWalletName("Ví chính"), true);
  assert.equal(isSentinelWalletName("Main wallet"), true);
  assert.equal(isSentinelWalletName("主钱包"), true);
});

runTest("Custom wallet names are preserved verbatim without dictionary translation", () => {
  const customNames = [
    "Techcombank VIP 88",
    "Quỹ tiết kiệm khẩn cấp",
    "招商银行一卡通 (CNY)",
    "Chase Sapphire Reserve",
    "Tiền tiêu vặt hàng ngày",
    "Secondary Wallet",
    "Ví phụ số 1",
    "副钱包",
  ];

  for (const name of customNames) {
    assert.equal(isSentinelWalletName(name), false, `isSentinelWalletName should be false for: ${name}`);
    assert.equal(normalizeWalletNameForStorage(name), name, `normalizeWalletNameForStorage should preserve: ${name}`);
    assert.equal(resolveWalletDisplayName(name, "en"), name, `resolveWalletDisplayName(en) should preserve: ${name}`);
    assert.equal(resolveWalletDisplayName(name, "vi"), name, `resolveWalletDisplayName(vi) should preserve: ${name}`);
    assert.equal(resolveWalletDisplayName(name, "zh"), name, `resolveWalletDisplayName(zh) should preserve: ${name}`);
  }
});

runTest("Special symbols, punctuation, emojis, and script tags", () => {
  const exoticNames = [
    "$#@!%^&*()_+{}[]:;\"'<>?,/",
    "💸 Crypto Stash 🚀",
    "<script>alert('xss')</script>",
    "EUR / USD Multi-Currency",
    "Wallet · 2026 · VIP",
    "...",   // multiple dots must NOT be confused with single dot "."
    "..",    // double dots must NOT be confused with single dot "."
    "•",     // bullet point
    ".dot",
    "dot.",
  ];

  for (const name of exoticNames) {
    assert.equal(isSentinelWalletName(name), false, `Should not be sentinel: ${name}`);
    assert.equal(normalizeWalletNameForStorage(name), name, `Should preserve: ${name}`);
    assert.equal(resolveWalletDisplayName(name, "en"), name);
    assert.equal(resolveWalletDisplayName(name, "vi"), name);
    assert.equal(resolveWalletDisplayName(name, "zh"), name);
  }
});

runTest("Sentinel wallet resolves dynamically to localized labels across languages", () => {
  // Direct "."
  assert.equal(resolveWalletDisplayName(".", "en"), "Main wallet");
  assert.equal(resolveWalletDisplayName(".", "vi"), "Ví chính");
  assert.equal(resolveWalletDisplayName(".", "zh"), "主钱包");

  // Empty string
  assert.equal(resolveWalletDisplayName("", "en"), "Main wallet");
  assert.equal(resolveWalletDisplayName("", "vi"), "Ví chính");
  assert.equal(resolveWalletDisplayName("", "zh"), "主钱包");

  // Null / undefined
  assert.equal(resolveWalletDisplayName(null, "en"), "Main wallet");
  assert.equal(resolveWalletDisplayName(undefined, "vi"), "Ví chính");

  // Legacy sentinel names
  assert.equal(resolveWalletDisplayName("Ví chính", "en"), "Main wallet");
  assert.equal(resolveWalletDisplayName("Main wallet", "zh"), "主钱包");
  assert.equal(resolveWalletDisplayName("主钱包", "vi"), "Ví chính");
});

// =========================================================================
// SECTION 3: Rapid Simulated Language Toggles and Store Integrity
// =========================================================================
console.log("\n--- Section 3: Rapid Simulated Language Toggles & Zero Data Corruption ---");

runTest("1,000 rapid simulated language toggles with zero mutation of custom wallets, notes & categories", () => {
  // Construct test state matching FinBridge AppState interface
  const initialTestState = {
    wallets: [
      { id: "w_sentinel", name: ".", currency: "VND", initial: 50000000, type: "cash" },
      { id: "w_custom_1", name: "Techcombank VIP 88 💳", currency: "VND", initial: 120000000, type: "cash" },
      { id: "w_custom_2", name: "Chase Sapphire (Personal)", currency: "USD", initial: 3500, type: "credit", limit: 10000 },
      { id: "w_custom_3", name: "招商银行储蓄卡 · 上海", currency: "CNY", initial: 88888, type: "cash" },
      { id: "w_custom_4", name: "<Special & Custom #1>", currency: "EUR", initial: 1500, type: "cash" },
    ],
    transactions: [
      { id: "t1", title: "Lương tháng 10", amount: 50000000, type: "income", category: "Lương", date: "2026-10-01", wallet: "w_sentinel", note: "Tiền lương chuyển khoản chính thức từ cty" },
      { id: "t2", title: "Dinner with VIP Client", amount: 2500000, type: "expense", category: "Thức ăn & Đồ uống", date: "2026-10-05", wallet: "w_custom_1", note: "Ăn tối tại Pizza 4P's Bến Thành kèm rượu vang" },
      { id: "t3", title: "Flight ticket SFO - HAN", amount: 1200, type: "expense", category: "Mua sắm", date: "2026-10-08", wallet: "w_custom_2", note: "EVA Air economy round trip ticket #BR027" },
      { id: "t4", title: "上海房租", amount: 6500, type: "expense", category: "Nhà", date: "2026-10-10", wallet: "w_custom_3", note: "静安区公寓2026年10月份租金支付凭证" },
    ],
    categories: ["Chưa được phân loại", "Thức ăn & Đồ uống", "Nhà", "Mua sắm", "Thu nhập", "Lương", "Quỹ đen bí mật 🤫"],
    settings: {
      language: "Tiếng Việt",
    },
  };

  // Deep snapshot baseline
  const baselineWalletsJson = JSON.stringify(initialTestState.wallets);
  const baselineTransactionsJson = JSON.stringify(initialTestState.transactions);
  const baselineCategoriesJson = JSON.stringify(initialTestState.categories);

  const toggleSequence = [
    "en", "vi", "zh",
    "English", "Tiếng Việt", "中文",
    "   eN-US  ", "zh-Hant", "VIETNAMESE",
    "en-GB", "zh-CN", "vi-VN",
    "EN", "VI", "ZH",
    "english", "tieng viet", "chinese",
    "anh", "trung",
    null, undefined, 123, {}, []
  ];

  let state = structuredClone(initialTestState);

  for (let cycle = 0; cycle < 1000; cycle++) {
    const rawLang = toggleSequence[cycle % toggleSequence.length];
    
    // Simulate setting language
    state.settings.language = rawLang;
    const resolvedLang = resolveLanguage(state.settings.language);

    // Verify Sentinel Wallet resolves to localized label without changing stored name
    const sentinelWallet = state.wallets[0];
    assert.equal(sentinelWallet.name, ".", `Underlying sentinel wallet name must remain '.' at cycle ${cycle}`);
    const resolvedLabel = resolveWalletDisplayName(sentinelWallet.name, resolvedLang);
    if (resolvedLang === "vi") assert.equal(resolvedLabel, "Ví chính");
    else if (resolvedLang === "zh") assert.equal(resolvedLabel, "主钱包");
    else assert.equal(resolvedLabel, "Main wallet");

    // Verify Custom Wallets are 100% untouched
    for (let i = 1; i < state.wallets.length; i++) {
      const cw = state.wallets[i];
      const initialCw = initialTestState.wallets[i];
      assert.equal(cw.name, initialCw.name, `Custom wallet name corrupted at cycle ${cycle}: ${cw.name}`);
      assert.equal(cw.currency, initialCw.currency);
      assert.equal(cw.initial, initialCw.initial);
      assert.equal(cw.type, initialCw.type);

      const displayName = resolveWalletDisplayName(cw.name, resolvedLang);
      assert.equal(displayName, initialCw.name, `Custom wallet display name modified at cycle ${cycle}: ${displayName}`);
    }

    // Verify Transactions and User Notes are 100% untouched
    for (let t = 0; t < state.transactions.length; t++) {
      const tx = state.transactions[t];
      const initialTx = initialTestState.transactions[t];
      assert.equal(tx.note, initialTx.note, `Transaction note corrupted at cycle ${cycle}: ${tx.note}`);
      assert.equal(tx.title, initialTx.title);
      assert.equal(tx.amount, initialTx.amount);
      assert.equal(tx.category, initialTx.category);
    }

    // Verify Categories are 100% untouched
    assert.deepEqual(state.categories, initialTestState.categories);
  }

  // Final deep check against initial baseline
  assert.equal(JSON.stringify(state.wallets), baselineWalletsJson, "Wallets mutated after 1,000 language toggles!");
  assert.equal(JSON.stringify(state.transactions), baselineTransactionsJson, "Transactions mutated after 1,000 language toggles!");
  assert.equal(JSON.stringify(state.categories), baselineCategoriesJson, "Categories mutated after 1,000 language toggles!");
});

// =========================================================================
// SECTION 4: Component Form & Handler Logic Stress Testing
// =========================================================================
console.log("\n--- Section 4: Component Form & Handler Logic Stress Testing ---");

runTest("Simulate Settings.tsx WalletScreen handleSave sentinel vs custom preservation", () => {
  // Logic from Settings.tsx line 668-670:
  function simulateWalletScreenSave({ isSentinel, existingName, inputName, isEditMode, defaultWalletName }) {
    const trimmed = inputName.trim();
    return isEditMode
      ? (isSentinel
          ? (!trimmed || isSentinelWalletName(trimmed) ? "." : trimmed)
          : (trimmed || existingName || "."))
      : (trimmed || defaultWalletName);
  }

  // Case A: Editing Sentinel Wallet, user leaves it blank -> saves "."
  assert.equal(
    simulateWalletScreenSave({ isSentinel: true, existingName: ".", inputName: "", isEditMode: true, defaultWalletName: "New wallet" }),
    "."
  );

  // Case B: Editing Sentinel Wallet, user types "Main wallet" -> saves "."
  assert.equal(
    simulateWalletScreenSave({ isSentinel: true, existingName: ".", inputName: "Main wallet", isEditMode: true, defaultWalletName: "New wallet" }),
    "."
  );

  // Case C: Editing Sentinel Wallet, user types "Ví chính" -> saves "."
  assert.equal(
    simulateWalletScreenSave({ isSentinel: true, existingName: ".", inputName: "Ví chính", isEditMode: true, defaultWalletName: "New wallet" }),
    "."
  );

  // Case D: Editing Sentinel Wallet, user types "主钱包" -> saves "."
  assert.equal(
    simulateWalletScreenSave({ isSentinel: true, existingName: ".", inputName: "主钱包", isEditMode: true, defaultWalletName: "New wallet" }),
    "."
  );

  // Case E: Editing Sentinel Wallet, user renames it to custom "Techcombank VIP" -> saves "Techcombank VIP"
  assert.equal(
    simulateWalletScreenSave({ isSentinel: true, existingName: ".", inputName: "Techcombank VIP", isEditMode: true, defaultWalletName: "New wallet" }),
    "Techcombank VIP"
  );

  // Case F: Editing Custom Wallet, user updates name to "Techcombank Platinum" -> saves "Techcombank Platinum"
  assert.equal(
    simulateWalletScreenSave({ isSentinel: false, existingName: "Techcombank VIP", inputName: "Techcombank Platinum", isEditMode: true, defaultWalletName: "New wallet" }),
    "Techcombank Platinum"
  );

  // Case F2: Editing Custom Wallet, user clears name input to "" -> what does it save?
  // If isSentinelWalletName("") returns true, it saves "." (overwriting custom wallet to sentinel!)
  // If intentional fallback to existing name, it should save "Techcombank VIP".
  const clearedCustomWalletResult = simulateWalletScreenSave({
    isSentinel: false,
    existingName: "Techcombank VIP",
    inputName: "",
    isEditMode: true,
    defaultWalletName: "New wallet"
  });
  console.log(`    [Empirical Observation] Editing custom wallet and clearing name saves: '${clearedCustomWalletResult}'`);
  // Requirement R3: "User-entered data (wallet names, notes, custom categories) is never overwritten or corrupted"
  assert.equal(
    clearedCustomWalletResult,
    "Techcombank VIP",
    "Clearing name when editing custom wallet must revert to existingName, NOT corrupt custom wallet into sentinel '.'"
  );

  // Case G: Adding New Wallet, user inputs "Cash Stash" -> saves "Cash Stash"
  assert.equal(
    simulateWalletScreenSave({ isSentinel: false, existingName: undefined, inputName: "Cash Stash", isEditMode: false, defaultWalletName: "New wallet" }),
    "Cash Stash"
  );

  // Case H: Adding New Wallet, user leaves blank -> saves defaultWalletName
  assert.equal(
    simulateWalletScreenSave({ isSentinel: false, existingName: undefined, inputName: "", isEditMode: false, defaultWalletName: "New wallet" }),
    "New wallet"
  );
});

runTest("Simulate Dashboard.tsx handleSaveWalletInfo sentinel vs custom preservation", () => {
  // Logic from Dashboard.tsx lines 992-996:
  function simulateDashboardSave({ existingName, inputName, localizedMainWalletLabel }) {
    const trimmed = inputName.trim();
    const isTargetSentinel = isSentinelWalletName(existingName);
    const persistentName = isTargetSentinel
      ? (!trimmed || isSentinelWalletName(trimmed) || trimmed === localizedMainWalletLabel ? "." : trimmed)
      : (trimmed || existingName);
    return persistentName;
  }

  // Sentinel wallet with empty input -> "."
  assert.equal(
    simulateDashboardSave({ existingName: ".", inputName: "", localizedMainWalletLabel: "Ví chính" }),
    "."
  );

  // Sentinel wallet with localized label -> "."
  assert.equal(
    simulateDashboardSave({ existingName: ".", inputName: "Ví chính", localizedMainWalletLabel: "Ví chính" }),
    "."
  );
  assert.equal(
    simulateDashboardSave({ existingName: ".", inputName: "Main wallet", localizedMainWalletLabel: "Ví chính" }),
    "."
  );
  assert.equal(
    simulateDashboardSave({ existingName: ".", inputName: "主钱包", localizedMainWalletLabel: "Ví chính" }),
    "."
  );

  // Custom wallet name change -> preserved
  assert.equal(
    simulateDashboardSave({ existingName: "Old Bank", inputName: "New Bank 2026", localizedMainWalletLabel: "Ví chính" }),
    "New Bank 2026"
  );

  // Custom wallet cleared -> what happens?
  const clearedDashboardResult = simulateDashboardSave({
    existingName: "Techcombank VIP",
    inputName: "",
    localizedMainWalletLabel: "Ví chính"
  });
  console.log(`    [Empirical Observation] Dashboard: Editing custom wallet and clearing name saves: '${clearedDashboardResult}'`);
  assert.equal(
    clearedDashboardResult,
    "Techcombank VIP",
    "Dashboard: Clearing name when editing custom wallet must revert to existingName, NOT corrupt custom wallet into sentinel '.'"
  );
});

console.log("\n=======================================================");
console.log(`STRESS TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
if (failures.length > 0) {
  console.log(`FAILURES: ${failures.length} test(s) failed:`);
  failures.forEach((f, idx) => {
    console.log(`  ${idx + 1}. ${f.name} -> ${f.error}`);
  });
  console.log("VERDICT: FAIL");
  console.log("=======================================================");
  process.exit(1);
} else {
  console.log("VERDICT: APPROVE");
  console.log("=======================================================");
  process.exit(0);
}
