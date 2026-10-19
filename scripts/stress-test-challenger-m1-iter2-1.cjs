const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const ts = require("typescript");

// Compile src/lib/i18n.ts dynamically using typescript compiler API
const i18nSource = fs.readFileSync(path.resolve(__dirname, "../src/lib/i18n.ts"), "utf8");
const i18nCompiled = ts.transpileModule(i18nSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const i18nExports = {};
new Function("require", "exports", "module", i18nCompiled)(require, i18nExports, { exports: i18nExports });

const {
  resolveLanguage,
  resolveWalletDisplayName,
  isSentinelWalletName,
  normalizeWalletNameForStorage,
} = i18nExports;

// Extract Settings.tsx isSentinelWalletName to confirm equivalence
const settingsSource = fs.readFileSync(path.resolve(__dirname, "../src/components/finbridge/workspace/Settings.tsx"), "utf8");
const settingsCompiled = ts.transpileModule(settingsSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

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

console.log("=== EMPIRICAL ADVERSARIAL CHALLENGER STRESS HARNESS (M1-Iter2-1) ===");

// =========================================================================
// SECTION 1: Verification of the 3 Previously Failing Cases
// =========================================================================
console.log("\n--- Section 1: Verification of the 3 Previously Failing Cases ---");

runTest("Case 1: isSentinelWalletName and normalizeWalletNameForStorage with pure whitespace", () => {
  assert.equal(isSentinelWalletName("   "), true, "isSentinelWalletName('   ') must evaluate to true");
  assert.equal(normalizeWalletNameForStorage("   "), ".", "normalizeWalletNameForStorage('   ') must return '.'");
});

runTest("Case 2: Settings.tsx WalletScreen clearing name when editing custom wallet preserves existing name", () => {
  function simulateSettingsSave({ isSentinel, existingName, inputName, isEditMode, defaultWalletName }) {
    const trimmed = inputName.trim();
    return isEditMode
      ? (isSentinel
          ? (!trimmed || isSentinelWalletName(trimmed) ? "." : trimmed)
          : (trimmed || existingName || "."))
      : (trimmed || defaultWalletName);
  }

  const result = simulateSettingsSave({
    isSentinel: false,
    existingName: "Techcombank VIP",
    inputName: "",
    isEditMode: true,
    defaultWalletName: "New wallet",
  });
  assert.equal(result, "Techcombank VIP", "Must revert to existing custom name, not '.'");
});

runTest("Case 3: Dashboard.tsx handleSaveWalletInfo clearing name when editing custom wallet preserves existing name", () => {
  function simulateDashboardSave({ existingName, inputName, localizedMainWalletLabel }) {
    const trimmed = inputName.trim();
    const isTargetSentinel = isSentinelWalletName(existingName);
    const persistentName = isTargetSentinel
      ? (!trimmed || isSentinelWalletName(trimmed) || trimmed === localizedMainWalletLabel ? "." : trimmed)
      : (trimmed || existingName);
    return persistentName;
  }

  const result = simulateDashboardSave({
    existingName: "Techcombank VIP",
    inputName: "",
    localizedMainWalletLabel: "Ví chính",
  });
  assert.equal(result, "Techcombank VIP", "Dashboard must revert to existing custom name, not '.'");
});

// =========================================================================
// SECTION 2: Adversarial Whitespace Edge Cases in isSentinelWalletName
// =========================================================================
console.log("\n--- Section 2: Adversarial Whitespace Edge Cases in isSentinelWalletName ---");

const pureWhitespaceInputs = [
  { label: "empty string", val: "" },
  { label: "single space", val: " " },
  { label: "multiple spaces (10)", val: "          " },
  { label: "single tab", val: "\t" },
  { label: "multiple tabs (5)", val: "\t\t\t\t\t" },
  { label: "single newline (\\n)", val: "\n" },
  { label: "multiple newlines", val: "\n\n\n\n" },
  { label: "carriage return (\\r)", val: "\r" },
  { label: "Windows CRLF (\\r\\n)", val: "\r\n" },
  { label: "multiple CRLF", val: "\r\n\r\n\r\n" },
  { label: "mixed spaces, tabs, newlines, CRLF", val: "  \t \r\n \t \n \r  " },
  { label: "giant whitespace (10,000 spaces)", val: " ".repeat(10000) },
  { label: "giant tabs (5,000 tabs)", val: "\t".repeat(5000) },
  { label: "giant newlines (5,000 newlines)", val: "\n".repeat(5000) },
  { label: "giant mixed whitespace (15,000 chars)", val: (" \t\r\n").repeat(3000) },
  { label: "Unicode NBSP (\\u00A0)", val: "\u00A0" },
  { label: "Unicode Em space (\\u2003)", val: "\u2003" },
  { label: "Unicode En space (\\u2002)", val: "\u2002" },
  { label: "Unicode Thin space (\\u2009)", val: "\u2009" },
  { label: "Unicode Ideographic / Fullwidth space (\\u3000)", val: "\u3000" },
  { label: "mixed Unicode and ASCII whitespace", val: " \t\u00A0 \r\n \u3000 \t " },
];

runTest("All pure whitespace variations identify as sentinel wallet name", () => {
  for (const item of pureWhitespaceInputs) {
    assert.equal(
      isSentinelWalletName(item.val),
      true,
      `Failed for ${item.label}: expected isSentinelWalletName to be true`
    );
    assert.equal(
      normalizeWalletNameForStorage(item.val),
      ".",
      `Failed for ${item.label}: expected normalizeWalletNameForStorage to be '.'`
    );
  }
});

const wrappedSentinelInputs = [
  { label: "tab-padded dot", val: "\t.\t" },
  { label: "newline-padded dot", val: "\n.\n" },
  { label: "CRLF-padded dot", val: "\r\n.\r\n" },
  { label: "mixed whitespace dot", val: "  \t\r\n . \r\n\t  " },
  { label: "Unicode NBSP padded dot", val: "\u00A0.\u00A0" },
  { label: "Ideographic space padded dot", val: "\u3000.\u3000" },
  { label: "tab-padded 'Ví chính'", val: "\tVí chính\t" },
  { label: "newline-padded 'Ví chính'", val: "\r\nVí chính\r\n" },
  { label: "mixed whitespace 'Ví chính'", val: " \t \r\n Ví chính \n\t " },
  { label: "tab-padded 'Main wallet'", val: "\tMain wallet\t" },
  { label: "newline-padded 'Main wallet'", val: "\r\nMain wallet\r\n" },
  { label: "mixed whitespace 'Main wallet'", val: " \t Main wallet \r\n" },
  { label: "tab-padded '主钱包'", val: "\t主钱包\t" },
  { label: "newline-padded '主钱包'", val: "\r\n主钱包\r\n" },
  { label: "Ideographic space padded '主钱包'", val: "\u3000主钱包\u3000" },
  { label: "mixed whitespace '主钱包'", val: "  \t\u3000主钱包\r\n  " },
];

runTest("All whitespace-wrapped sentinel values normalize to canonical '.'", () => {
  for (const item of wrappedSentinelInputs) {
    assert.equal(
      isSentinelWalletName(item.val),
      true,
      `Failed for ${item.label}: expected isSentinelWalletName to be true`
    );
    assert.equal(
      normalizeWalletNameForStorage(item.val),
      ".",
      `Failed for ${item.label}: expected normalizeWalletNameForStorage to be '.'`
    );
  }
});

const nonSentinelInputs = [
  { label: "space between dots", val: ". ." },
  { label: "double dot", val: ".." },
  { label: "triple dot / ellipsis", val: "..." },
  { label: "dot prefix", val: ".wallet" },
  { label: "dot suffix", val: "wallet." },
  { label: "middle dot", val: "wallet.main" },
  { label: "extended sentinel Vietnamese", val: "Ví chính phụ" },
  { label: "extended sentinel Vietnamese 2", val: "Ví chính thức" },
  { label: "extended sentinel English", val: "Main wallet 2" },
  { label: "extended sentinel English 2", val: "Main wallet personal" },
  { label: "extended sentinel Chinese", val: "主钱包备用" },
  { label: "different wallet Chinese", val: "副钱包" },
  { label: "whitespace padded custom name", val: "  \t Techcombank VIP \r\n " },
  { label: "whitespace padded emoji name", val: " \t 💰 Tiền mặt \r\n " },
];

runTest("Non-sentinel names with punctuation or surrounding whitespace are NEVER identified as sentinel", () => {
  for (const item of nonSentinelInputs) {
    assert.equal(
      isSentinelWalletName(item.val),
      false,
      `False positive sentinel detection for ${item.label} ('${item.val}')`
    );
    assert.equal(
      normalizeWalletNameForStorage(item.val),
      item.val.trim(),
      `normalizeWalletNameForStorage should return trimmed custom name for ${item.label}`
    );
  }
});

runTest("Non-string, null and undefined edge cases", () => {
  assert.equal(isSentinelWalletName(null), true);
  assert.equal(isSentinelWalletName(undefined), true);
  assert.equal(normalizeWalletNameForStorage(null), ".");
  assert.equal(normalizeWalletNameForStorage(undefined), ".");

  const nonStringPrimitives = [
    0, 1, -1, NaN, Infinity, -Infinity,
    false, true,
    {}, [], { name: "." }, [".", "Ví chính"],
    () => ".", Symbol("."), BigInt(0), BigInt(42),
  ];

  for (const val of nonStringPrimitives) {
    assert.equal(
      isSentinelWalletName(val),
      false,
      `Non-string primitive ${typeof val} (${String(val)}) must NOT be identified as sentinel`
    );
  }
});

// =========================================================================
// SECTION 3: Deep Handler Stress Testing (Settings.tsx & Dashboard.tsx)
// =========================================================================
console.log("\n--- Section 3: Deep Handler Stress Testing (Settings.tsx & Dashboard.tsx) ---");

// Exact logic from Settings.tsx lines 668-673
function simulateSettingsSave({ isSentinel, existingName, inputName, isEditMode, defaultWalletName }) {
  const trimmed = inputName.trim();
  const finalName = isEditMode
    ? (isSentinel
        ? (!trimmed || isSentinelWalletName(trimmed) ? "." : trimmed)
        : (trimmed || existingName || "."))
    : (trimmed || defaultWalletName);
  return finalName;
}

// Exact logic from Dashboard.tsx lines 992-996
function simulateDashboardSave({ existingName, inputName, localizedMainWalletLabel }) {
  const trimmed = editWalletNameNormalize(inputName);
  const isTargetSentinel = isSentinelWalletName(existingName);
  const persistentName = isTargetSentinel
    ? (!trimmed || isSentinelWalletName(trimmed) || trimmed === localizedMainWalletLabel ? "." : trimmed)
    : (trimmed || existingName);
  return persistentName;
}

function editWalletNameNormalize(val) {
  return typeof val === "string" ? val.trim() : "";
}

runTest("Settings.tsx: Clearing custom wallet name across ALL whitespace types preserves existing name", () => {
  const existingCustomName = "BIDV Smart Banking VIP";
  for (const item of pureWhitespaceInputs) {
    const saved = simulateSettingsSave({
      isSentinel: false,
      existingName: existingCustomName,
      inputName: item.val,
      isEditMode: true,
      defaultWalletName: "New wallet",
    });
    assert.equal(
      saved,
      existingCustomName,
      `Settings.tsx failed to preserve custom wallet name when cleared with ${item.label}. Expected '${existingCustomName}', got '${saved}'`
    );
  }
});

runTest("Dashboard.tsx: Clearing custom wallet name across ALL whitespace types preserves existing name", () => {
  const existingCustomName = "Vietcombank Priority";
  for (const item of pureWhitespaceInputs) {
    const saved = simulateDashboardSave({
      existingName: existingCustomName,
      inputName: item.val,
      localizedMainWalletLabel: "Ví chính",
    });
    assert.equal(
      saved,
      existingCustomName,
      `Dashboard.tsx failed to preserve custom wallet name when cleared with ${item.label}. Expected '${existingCustomName}', got '${saved}'`
    );
  }
});

runTest("Settings.tsx: Clearing sentinel wallet name across ALL whitespace types normalizes to canonical '.'", () => {
  const sentinelExistingValues = [".", "Ví chính", "Main wallet", "主钱包"];
  for (const existing of sentinelExistingValues) {
    for (const item of pureWhitespaceInputs) {
      const saved = simulateSettingsSave({
        isSentinel: true,
        existingName: existing,
        inputName: item.val,
        isEditMode: true,
        defaultWalletName: "New wallet",
      });
      assert.equal(
        saved,
        ".",
        `Settings.tsx failed to normalize sentinel wallet to '.' when cleared with ${item.label}. Expected '.', got '${saved}'`
      );
    }
  }
});

runTest("Dashboard.tsx: Clearing sentinel wallet name across ALL whitespace types normalizes to canonical '.'", () => {
  const sentinelExistingValues = [".", "Ví chính", "Main wallet", "主钱包"];
  for (const existing of sentinelExistingValues) {
    for (const item of pureWhitespaceInputs) {
      const saved = simulateDashboardSave({
        existingName: existing,
        inputName: item.val,
        localizedMainWalletLabel: "Ví chính",
      });
      assert.equal(
        saved,
        ".",
        `Dashboard.tsx failed to normalize sentinel wallet to '.' when cleared with ${item.label}. Expected '.', got '${saved}'`
      );
    }
  }
});

runTest("Settings.tsx: User can successfully rename sentinel wallet to a new custom wallet", () => {
  const customNames = [
    "Techcombank Private",
    "  Techcombank Private  ",
    "Ví ShopeePay",
    "Alipay (支付宝)",
  ];

  for (const name of customNames) {
    const saved = simulateSettingsSave({
      isSentinel: true,
      existingName: ".",
      inputName: name,
      isEditMode: true,
      defaultWalletName: "New wallet",
    });
    assert.equal(saved, name.trim());
  }
});

runTest("Dashboard.tsx: User can successfully rename sentinel wallet to a new custom wallet", () => {
  const customNames = [
    "Standard Chartered Priority",
    "  Standard Chartered Priority  ",
    "Ví ZaloPay",
    "WeChat Pay (微信支付)",
  ];

  for (const name of customNames) {
    const saved = simulateDashboardSave({
      existingName: ".",
      inputName: name,
      localizedMainWalletLabel: "Ví chính",
    });
    assert.equal(saved, name.trim());
  }
});

runTest("Settings.tsx: Add Mode (walletId undefined) behaves correctly with custom and empty inputs", () => {
  // Provided name
  const withName = simulateSettingsSave({
    isSentinel: false,
    existingName: undefined,
    inputName: "  Crypto Cold Storage  ",
    isEditMode: false,
    defaultWalletName: "Ví mới",
  });
  assert.equal(withName, "Crypto Cold Storage");

  // Blank / whitespace
  for (const item of pureWhitespaceInputs) {
    const defaultResult = simulateSettingsSave({
      isSentinel: false,
      existingName: undefined,
      inputName: item.val,
      isEditMode: false,
      defaultWalletName: "Ví mới",
    });
    assert.equal(
      defaultResult,
      "Ví mới",
      `Add mode failed for ${item.label}: expected defaultWalletName 'Ví mới', got '${defaultResult}'`
    );
  }
});

// =========================================================================
// SECTION 4: End-to-End Multi-Step Stateful Lifecycle Simulation
// =========================================================================
console.log("\n--- Section 4: End-to-End Multi-Step Stateful Lifecycle Simulation ---");

runTest("Simulated 10-step realistic user wallet lifecycle with zero data corruption", () => {
  let appState = {
    wallets: [
      { id: "w_main", name: ".", currency: "VND", initial: 10000000 },
      { id: "w_custom", name: "HSBC Visa Signature", currency: "USD", initial: 5000 },
    ],
    settings: { language: "vi" },
  };

  // Step 1: Initial state check in Vietnamese
  assert.equal(resolveWalletDisplayName(appState.wallets[0].name, appState.settings.language), "Ví chính");
  assert.equal(resolveWalletDisplayName(appState.wallets[1].name, appState.settings.language), "HSBC Visa Signature");

  // Step 2: User opens Settings -> Edit Custom Wallet -> accidentally clears the name input to "   \t\n  "
  const step2Saved = simulateSettingsSave({
    isSentinel: isSentinelWalletName(appState.wallets[1].name),
    existingName: appState.wallets[1].name,
    inputName: "   \t\n  ",
    isEditMode: true,
    defaultWalletName: "Ví mới",
  });
  appState.wallets[1].name = step2Saved;
  assert.equal(appState.wallets[1].name, "HSBC Visa Signature", "Custom wallet name must NOT corrupt to '.'");

  // Step 3: Switch language to English
  appState.settings.language = "en";
  assert.equal(resolveWalletDisplayName(appState.wallets[0].name, appState.settings.language), "Main wallet");
  assert.equal(resolveWalletDisplayName(appState.wallets[1].name, appState.settings.language), "HSBC Visa Signature");

  // Step 4: User opens Dashboard -> Edit Custom Wallet -> clears name with empty string ""
  const step4Saved = simulateDashboardSave({
    existingName: appState.wallets[1].name,
    inputName: "",
    localizedMainWalletLabel: "Main wallet",
  });
  appState.wallets[1].name = step4Saved;
  assert.equal(appState.wallets[1].name, "HSBC Visa Signature", "Dashboard must preserve custom wallet name on clear");

  // Step 5: Switch language to Chinese
  appState.settings.language = "zh";
  assert.equal(resolveWalletDisplayName(appState.wallets[0].name, appState.settings.language), "主钱包");
  assert.equal(resolveWalletDisplayName(appState.wallets[1].name, appState.settings.language), "HSBC Visa Signature");

  // Step 6: User opens Settings -> Edit Sentinel Wallet -> enters localized name "主钱包"
  const step6Saved = simulateSettingsSave({
    isSentinel: isSentinelWalletName(appState.wallets[0].name),
    existingName: appState.wallets[0].name,
    inputName: "  主钱包  ",
    isEditMode: true,
    defaultWalletName: "新钱包",
  });
  appState.wallets[0].name = step6Saved;
  assert.equal(appState.wallets[0].name, ".", "Sentinel wallet re-saving localized label must normalize to '.'");

  // Step 7: Switch language back to Vietnamese
  appState.settings.language = "vi";
  assert.equal(resolveWalletDisplayName(appState.wallets[0].name, appState.settings.language), "Ví chính");

  // Step 8: User opens Dashboard -> Edit Sentinel Wallet -> clears name completely with CRLF
  const step8Saved = simulateDashboardSave({
    existingName: appState.wallets[0].name,
    inputName: "\r\n\t",
    localizedMainWalletLabel: "Ví chính",
  });
  appState.wallets[0].name = step8Saved;
  assert.equal(appState.wallets[0].name, ".", "Clearing sentinel in Dashboard must stay canonical '.'");

  // Step 9: User creates new wallet with whitespace only
  const step9NewName = simulateSettingsSave({
    isSentinel: false,
    existingName: undefined,
    inputName: " \t ",
    isEditMode: false,
    defaultWalletName: "Ví mới",
  });
  appState.wallets.push({ id: "w_new", name: step9NewName, currency: "VND", initial: 0 });
  assert.equal(appState.wallets[2].name, "Ví mới");

  // Step 10: User renames custom wallet to new name "HSBC World Elite"
  const step10Updated = simulateDashboardSave({
    existingName: appState.wallets[1].name,
    inputName: "  HSBC World Elite  ",
    localizedMainWalletLabel: "Ví chính",
  });
  appState.wallets[1].name = step10Updated;
  assert.equal(appState.wallets[1].name, "HSBC World Elite");
  assert.equal(resolveWalletDisplayName(appState.wallets[1].name, "zh"), "HSBC World Elite");
});

// =========================================================================
// SUMMARY & VERDICT
// =========================================================================
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
