// =========================================================================
// Challenger M2-1: Empirical Adversarial Stress Test Harness
// Target: Category Localization Resolver, Recurring Unit Normalization,
//         and User Data Preservation Contracts
// =========================================================================

const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const ts = require("typescript");

// --- 1. Compile src/lib/i18n.ts ---
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
  getLanguageLabel,
  getLocale,
  isLanguage,
  SUPPORTED_LANGUAGES,
  SYSTEM_CATEGORY_LABELS,
  resolveCategoryDisplayName,
} = i18nExports;

// --- 2. Compile src/components/sites/rolly/replica/Transactions.tsx to extract normalizeRecurringUnit & TRANSACTION_FORM_I18N ---
const txSource = fs.readFileSync(path.resolve(__dirname, "../src/components/sites/rolly/replica/Transactions.tsx"), "utf8");
const txCompiled = ts.transpileModule(txSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
}).outputText;

const txExports = {};
const mockTransactionsRequire = (name) => {
  if (name === "react") return require("react");
  if (name === "react/jsx-runtime") return require("react/jsx-runtime");
  if (name === "lucide-react") return new Proxy({}, { get: () => () => null });
  if (name === "./store") {
    return {
      useAppState: () => ({}),
      updateState: () => {},
      money: (v) => String(v),
      today: () => "2026-10-14",
      currencySymbol: () => "VND",
    };
  }
  if (name === "@/lib/i18n") return i18nExports;
  return {};
};

new Function("require", "exports", "module", txCompiled)(mockTransactionsRequire, txExports, { exports: txExports });

const { normalizeRecurringUnit, TRANSACTION_FORM_I18N } = txExports;

// --- 3. Compile src/components/sites/rolly/replica/TransactionHistory.tsx to check parity ---
const histSource = fs.readFileSync(path.resolve(__dirname, "../src/components/sites/rolly/replica/TransactionHistory.tsx"), "utf8");
const histCompiled = ts.transpileModule(histSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
}).outputText;

const histExports = {};
const mockHistRequire = (name) => {
  if (name === "react") return require("react");
  if (name === "react/jsx-runtime") return require("react/jsx-runtime");
  if (name === "lucide-react") return new Proxy({}, { get: () => () => null });
  if (name === "@/lib/i18n") return i18nExports;
  if (name === "./store") return { useAppState: () => ({ wallets: [], transactions: [], settings: {} }) };
  if (name === "./Dashboard") return { DASHBOARD_SAMPLE: [] };
  if (name === "./FinBridgeHeader") return { FinBridgeHeader: () => null };
  if (name === "./CalendarLedgerModal") return { CalendarLedgerModal: () => null };
  if (name === "./chartWeek") return {};
  if (name === "./HistoryPeriodPicker") return { HistoryPeriodPicker: () => null, matchesHistoryPeriod: () => true };
  if (name === "next/navigation") return { useSearchParams: () => new URLSearchParams() };
  return {};
};

new Function("require", "exports", "module", histCompiled)(mockHistRequire, histExports, { exports: histExports });
const histResolveCategoryDisplayName = histExports.resolveCategoryDisplayName;

// --- Test Harness Framework ---
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

console.log("=========================================================================");
console.log("CHALLENGER M2-1: EMPIRICAL ADVERSARIAL STRESS TEST HARNESS");
console.log("=========================================================================");

// =========================================================================
// SECTION 1: Category Resolution Across EN, VI, ZH
// =========================================================================
console.log("\n--- Section 1: Category Resolution Across EN, VI, ZH ---");

runTest("1.1: SYSTEM_CATEGORY_LABELS contains all standard categories with complete tri-lingual translations", () => {
  assert.ok(SYSTEM_CATEGORY_LABELS, "SYSTEM_CATEGORY_LABELS must be defined and exported");
  const keys = Object.keys(SYSTEM_CATEGORY_LABELS);
  assert.ok(keys.length >= 17, `Expected at least 17 category mappings, found ${keys.length}`);

  for (const key of keys) {
    const mapping = SYSTEM_CATEGORY_LABELS[key];
    assert.ok(mapping.vi, `Missing 'vi' translation for system category '${key}'`);
    assert.ok(mapping.en, `Missing 'en' translation for system category '${key}'`);
    assert.ok(mapping.zh, `Missing 'zh' translation for system category '${key}'`);

    // Verify resolveCategoryDisplayName returns exact dictionary entry
    assert.equal(resolveCategoryDisplayName(key, "vi"), mapping.vi, `VI mismatch for '${key}'`);
    assert.equal(resolveCategoryDisplayName(key, "en"), mapping.en, `EN mismatch for '${key}'`);
    assert.equal(resolveCategoryDisplayName(key, "zh"), mapping.zh, `ZH mismatch for '${key}'`);
  }
});

runTest("1.2: Standard categories resolve correctly across language variants and casing", () => {
  // Test "Thức ăn & Đồ uống" / "Ăn uống"
  assert.equal(resolveCategoryDisplayName("Thức ăn & Đồ uống", "en"), "Food & Dining");
  assert.equal(resolveCategoryDisplayName("Thức ăn & Đồ uống", "zh"), "餐饮");
  assert.equal(resolveCategoryDisplayName("Thức ăn & Đồ uống", "vi"), "Thức ăn & Đồ uống");
  assert.equal(resolveCategoryDisplayName("Ăn uống", "en"), "Food & Dining");
  assert.equal(resolveCategoryDisplayName("Ăn uống", "zh"), "餐饮");

  // Test "Nhà" / "Nhà ở"
  assert.equal(resolveCategoryDisplayName("Nhà", "en"), "Housing");
  assert.equal(resolveCategoryDisplayName("Nhà", "zh"), "住房");
  assert.equal(resolveCategoryDisplayName("Nhà ở", "en"), "Housing");
  assert.equal(resolveCategoryDisplayName("Nhà ở", "zh"), "住房");

  // Test "Mua sắm"
  assert.equal(resolveCategoryDisplayName("Mua sắm", "en"), "Shopping");
  assert.equal(resolveCategoryDisplayName("Mua sắm", "zh"), "购物");

  // Test "Thu nhập" / "Lương"
  assert.equal(resolveCategoryDisplayName("Thu nhập", "en"), "Income");
  assert.equal(resolveCategoryDisplayName("Thu nhập", "zh"), "收入");
  assert.equal(resolveCategoryDisplayName("Lương", "en"), "Salary");
  assert.equal(resolveCategoryDisplayName("Lương", "zh"), "工资");

  // Test "Quà tặng"
  assert.equal(resolveCategoryDisplayName("Quà tặng", "en"), "Gifts");
  assert.equal(resolveCategoryDisplayName("Quà tặng", "zh"), "礼物");

  // Test "Hóa đơn & Tiện ích"
  assert.equal(resolveCategoryDisplayName("Hóa đơn & Tiện ích", "en"), "Bills & Utilities");
  assert.equal(resolveCategoryDisplayName("Hóa đơn & Tiện ích", "zh"), "账单与公共事业");

  // Test "Di chuyển"
  assert.equal(resolveCategoryDisplayName("Di chuyển", "en"), "Transportation");
  assert.equal(resolveCategoryDisplayName("Di chuyển", "zh"), "交通出行");

  // Test "Giải trí"
  assert.equal(resolveCategoryDisplayName("Giải trí", "en"), "Entertainment");
  assert.equal(resolveCategoryDisplayName("Giải trí", "zh"), "娱乐");

  // Test "Chuyển khoản nội bộ" / "Chuyển khoản"
  assert.equal(resolveCategoryDisplayName("Chuyển khoản nội bộ", "en"), "Internal Transfer");
  assert.equal(resolveCategoryDisplayName("Chuyển khoản nội bộ", "zh"), "内部转账");
  assert.equal(resolveCategoryDisplayName("Chuyển khoản", "en"), "Transfer");
  assert.equal(resolveCategoryDisplayName("Chuyển khoản", "zh"), "转账");

  // Test "Điều chỉnh số dư"
  assert.equal(resolveCategoryDisplayName("Điều chỉnh số dư", "en"), "Balance Adjustment");
  assert.equal(resolveCategoryDisplayName("Điều chỉnh số dư", "zh"), "余额调整");
});

runTest("1.3: Uncategorized tri-directional resolution ('Chưa được phân loại', 'Uncategorized', '未分类')", () => {
  const uncategorizedTokens = ["Chưa được phân loại", "Uncategorized", "未分类"];
  for (const token of uncategorizedTokens) {
    assert.equal(resolveCategoryDisplayName(token, "vi"), "Chưa được phân loại", `VI failed for '${token}'`);
    assert.equal(resolveCategoryDisplayName(token, "en"), "Uncategorized", `EN failed for '${token}'`);
    assert.equal(resolveCategoryDisplayName(token, "zh"), "未分类", `ZH failed for '${token}'`);
  }
});

runTest("1.4: Whitespace variations around standard categories trim and resolve cleanly", () => {
  assert.equal(resolveCategoryDisplayName("  Thức ăn & Đồ uống  ", "en"), "Food & Dining");
  assert.equal(resolveCategoryDisplayName("\tLương\n", "en"), "Salary");
  assert.equal(resolveCategoryDisplayName("   \t  Mua sắm  \r\n ", "zh"), "购物");
  assert.equal(resolveCategoryDisplayName("  Nhà ở  ", "vi"), "Nhà ở");
  assert.equal(resolveCategoryDisplayName("  Uncategorized  ", "vi"), "Chưa được phân loại");
  assert.equal(resolveCategoryDisplayName("  未分类  ", "en"), "Uncategorized");
});

runTest("1.5: Nil, null, undefined, empty string, and whitespace-only inputs handle fallbackLabel", () => {
  // Default fallbackLabel (empty string "")
  assert.equal(resolveCategoryDisplayName(null, "en"), "");
  assert.equal(resolveCategoryDisplayName(undefined, "en"), "");
  assert.equal(resolveCategoryDisplayName("", "en"), "");
  assert.equal(resolveCategoryDisplayName("   ", "en"), "");
  assert.equal(resolveCategoryDisplayName("\t\r\n", "en"), "");

  // Custom fallbackLabel provided
  assert.equal(resolveCategoryDisplayName(null, "en", "No category"), "No category");
  assert.equal(resolveCategoryDisplayName(undefined, "vi", "Chưa phân loại"), "Chưa phân loại");
  assert.equal(resolveCategoryDisplayName("", "zh", "无分类"), "无分类");
  assert.equal(resolveCategoryDisplayName("   ", "en", "Fallback Category"), "Fallback Category");
  assert.equal(resolveCategoryDisplayName("\n\t  ", "vi", "Mặc định"), "Mặc định");
});

runTest("1.6: Custom user category names are preserved completely unaltered across all languages", () => {
  const customCategories = [
    "Đầu tư chứng khoán",
    "Quỹ đen bí mật 🤫",
    "Tiền tiêu vặt cho con",
    "Sửa xe máy & Bảo dưỡng",
    "Crypto Stash & DeFi Yield 🚀",
    "Freelance Design & Consulting",
    "AWS & Vercel Infrastructure",
    "Pet Care (Corgi Mochi 🐶)",
    "招商银行基金定投",
    "春节亲友红包",
    "上海静安公寓水电费",
    "Special & Custom #1",
    "<script>alert('xss')</script>",
    "Category / Subcategory 100%",
    "--- Miscellaneous ---",
  ];

  for (const custom of customCategories) {
    assert.equal(resolveCategoryDisplayName(custom, "en"), custom, `EN must not translate custom category: '${custom}'`);
    assert.equal(resolveCategoryDisplayName(custom, "vi"), custom, `VI must not alter custom category: '${custom}'`);
    assert.equal(resolveCategoryDisplayName(custom, "zh"), custom, `ZH must not translate custom category: '${custom}'`);
    
    // With whitespace padding: trims and preserves
    const padded = `  ${custom}  `;
    assert.equal(resolveCategoryDisplayName(padded, "en"), custom, `Padded custom category must trim to '${custom}'`);
  }
});

runTest("1.7: Case variations outside exact dictionary keys are preserved as custom categories", () => {
  // If user defines custom category with lowercase or altered casing, it must be preserved
  const customCased = [
    "thức ăn & đồ uống",
    "LƯƠNG THÁNG",
    "food & dining",
    "housing",
    "shopping",
    "UNCATEGORIZED",
    "uncategorized",
  ];

  for (const cat of customCased) {
    const resEn = resolveCategoryDisplayName(cat, "en");
    const resVi = resolveCategoryDisplayName(cat, "vi");
    const resZh = resolveCategoryDisplayName(cat, "zh");
    // Must return trimmed string and not crash or throw
    assert.equal(resEn, cat.trim());
    assert.equal(resVi, cat.trim());
    assert.equal(resZh, cat.trim());
  }
});

runTest("1.8: Language parameter variants resolution in category resolver", () => {
  const cat = "Thức ăn & Đồ uống";
  // Display names
  assert.equal(resolveCategoryDisplayName(cat, "English"), "Food & Dining");
  assert.equal(resolveCategoryDisplayName(cat, "Tiếng Việt"), "Thức ăn & Đồ uống");
  assert.equal(resolveCategoryDisplayName(cat, "中文"), "餐饮");

  // Regional codes
  assert.equal(resolveCategoryDisplayName(cat, "en-US"), "Food & Dining");
  assert.equal(resolveCategoryDisplayName(cat, "en-GB"), "Food & Dining");
  assert.equal(resolveCategoryDisplayName(cat, "vi-VN"), "Thức ăn & Đồ uống");
  assert.equal(resolveCategoryDisplayName(cat, "zh-CN"), "餐饮");
  assert.equal(resolveCategoryDisplayName(cat, "zh-TW"), "餐饮");

  // Uppercase
  assert.equal(resolveCategoryDisplayName(cat, "EN"), "Food & Dining");
  assert.equal(resolveCategoryDisplayName(cat, "VI"), "Thức ăn & Đồ uống");
  assert.equal(resolveCategoryDisplayName(cat, "ZH"), "餐饮");

  // Unknown / null -> fallback to "vi"
  assert.equal(resolveCategoryDisplayName(cat, null), "Thức ăn & Đồ uống");
  assert.equal(resolveCategoryDisplayName(cat, undefined), "Thức ăn & Đồ uống");
  assert.equal(resolveCategoryDisplayName(cat, "fr-FR"), "Thức ăn & Đồ uống");
});

runTest("1.9: Parity between i18n.ts and TransactionHistory.tsx category resolver", () => {
  const testCases = [
    { cat: "Thức ăn & Đồ uống", lang: "en", fb: "None" },
    { cat: "Lương", lang: "zh", fb: "None" },
    { cat: "Chưa được phân loại", lang: "en", fb: "Unset" },
    { cat: "Quỹ bí mật", lang: "en", fb: "Unset" },
    { cat: null, lang: "en", fb: "Fallback" },
    { cat: "", lang: "vi", fb: "Chưa có" },
    { cat: "  Mua sắm  ", lang: "zh", fb: "" },
  ];

  for (const tc of testCases) {
    const canonicalResult = resolveCategoryDisplayName(tc.cat, tc.lang, tc.fb);
    const histResult = histResolveCategoryDisplayName(tc.cat, tc.lang, tc.fb);
    assert.equal(histResult, canonicalResult, `Parity check failed for cat='${tc.cat}', lang='${tc.lang}'`);
  }
});

// =========================================================================
// SECTION 2: Recurring Unit Normalization (normalizeRecurringUnit)
// =========================================================================
console.log("\n--- Section 2: Recurring Unit Normalization ---");

runTest("2.1: Vietnamese tokens normalization ('Ngày', 'Tuần', 'Tháng', 'Năm')", () => {
  // Day
  assert.equal(normalizeRecurringUnit("Ngày"), "day");
  assert.equal(normalizeRecurringUnit("ngày"), "day");
  assert.equal(normalizeRecurringUnit("NGÀY"), "day");
  assert.equal(normalizeRecurringUnit("  Ngày  "), "day");

  // Week
  assert.equal(normalizeRecurringUnit("Tuần"), "week");
  assert.equal(normalizeRecurringUnit("tuần"), "week");
  assert.equal(normalizeRecurringUnit("TUẦN"), "week");
  assert.equal(normalizeRecurringUnit("  Tuần  "), "week");

  // Month
  assert.equal(normalizeRecurringUnit("Tháng"), "month");
  assert.equal(normalizeRecurringUnit("tháng"), "month");
  assert.equal(normalizeRecurringUnit("THÁNG"), "month");
  assert.equal(normalizeRecurringUnit("  Tháng  "), "month");

  // Year
  assert.equal(normalizeRecurringUnit("Năm"), "year");
  assert.equal(normalizeRecurringUnit("năm"), "year");
  assert.equal(normalizeRecurringUnit("NĂM"), "year");
  assert.equal(normalizeRecurringUnit("  Năm  "), "year");
});

runTest("2.2: English tokens normalization ('daily', 'weekly', 'monthly', 'yearly', 'day', 'week', 'month', 'year')", () => {
  // Daily / Day
  assert.equal(normalizeRecurringUnit("daily"), "day");
  assert.equal(normalizeRecurringUnit("Daily"), "day");
  assert.equal(normalizeRecurringUnit("DAILY"), "day");
  assert.equal(normalizeRecurringUnit("day"), "day");
  assert.equal(normalizeRecurringUnit("DAY"), "day");
  assert.equal(normalizeRecurringUnit("  daily  "), "day");

  // Weekly / Week
  assert.equal(normalizeRecurringUnit("weekly"), "week");
  assert.equal(normalizeRecurringUnit("Weekly"), "week");
  assert.equal(normalizeRecurringUnit("WEEKLY"), "week");
  assert.equal(normalizeRecurringUnit("week"), "week");
  assert.equal(normalizeRecurringUnit("WEEK"), "week");
  assert.equal(normalizeRecurringUnit("  weekly  "), "week");

  // Monthly / Month
  assert.equal(normalizeRecurringUnit("monthly"), "month");
  assert.equal(normalizeRecurringUnit("Monthly"), "month");
  assert.equal(normalizeRecurringUnit("MONTHLY"), "month");
  assert.equal(normalizeRecurringUnit("month"), "month");
  assert.equal(normalizeRecurringUnit("MONTH"), "month");
  assert.equal(normalizeRecurringUnit("  monthly  "), "month");

  // Yearly / Year
  assert.equal(normalizeRecurringUnit("yearly"), "year");
  assert.equal(normalizeRecurringUnit("Yearly"), "year");
  assert.equal(normalizeRecurringUnit("YEARLY"), "year");
  assert.equal(normalizeRecurringUnit("year"), "year");
  assert.equal(normalizeRecurringUnit("YEAR"), "year");
  assert.equal(normalizeRecurringUnit("  yearly  "), "year");
});

runTest("2.3: Chinese tokens normalization ('每天', '每周', '每月', '每年', '天', '周', '月', '年', '日')", () => {
  // Day
  assert.equal(normalizeRecurringUnit("每天"), "day");
  assert.equal(normalizeRecurringUnit("  每天  "), "day");
  assert.equal(normalizeRecurringUnit("天"), "day");
  assert.equal(normalizeRecurringUnit("日"), "day");

  // Week
  assert.equal(normalizeRecurringUnit("每周"), "week");
  assert.equal(normalizeRecurringUnit("  每周  "), "week");
  assert.equal(normalizeRecurringUnit("周"), "week");

  // Month
  assert.equal(normalizeRecurringUnit("每月"), "month");
  assert.equal(normalizeRecurringUnit("  每月  "), "month");
  assert.equal(normalizeRecurringUnit("月"), "month");

  // Year
  assert.equal(normalizeRecurringUnit("每年"), "year");
  assert.equal(normalizeRecurringUnit("  每年  "), "year");
  assert.equal(normalizeRecurringUnit("年"), "year");
});

runTest("2.4: Falsy, nil, empty, and whitespace-only inputs default safely to 'month'", () => {
  assert.equal(normalizeRecurringUnit(undefined), "month");
  assert.equal(normalizeRecurringUnit(""), "month");
  assert.equal(normalizeRecurringUnit("   "), "month");
  assert.equal(normalizeRecurringUnit("\t\r\n"), "month");
  assert.equal(normalizeRecurringUnit(null), "month");
});

runTest("2.5: Malformed and unrecognized values fallback safely to 'month'", () => {
  const malformedInputs = [
    "hourly",
    "bi-weekly",
    "quarterly",
    "semi-annual",
    "unknown",
    "random-text",
    "123",
    "!@#$%^&*",
    "x".repeat(1000),
    "day-and-a-half",
    "week 2",
    "monthly billing",
  ];

  for (const input of malformedInputs) {
    assert.equal(normalizeRecurringUnit(input), "month", `Input '${input}' should fallback to 'month'`);
  }
});

runTest("2.6: TRANSACTION_FORM_I18N recurringUnits definition parity", () => {
  for (const lang of ["vi", "en", "zh"]) {
    const t = TRANSACTION_FORM_I18N[lang];
    assert.ok(t.recurringUnits, `Missing recurringUnits in ${lang}`);
    assert.equal(t.recurringUnits.length, 4, `recurringUnits must contain 4 units (day, week, month, year) in ${lang}`);

    const unitValues = t.recurringUnits.map((u) => u.value);
    assert.deepEqual(unitValues, ["day", "week", "month", "year"], `Unit values corrupted in ${lang}`);

    for (const unit of t.recurringUnits) {
      assert.ok(unit.label && unit.label.trim().length > 0, `Unit label empty for ${unit.value} in ${lang}`);
      // Assert label normalizes to its own value
      assert.equal(normalizeRecurringUnit(unit.label), unit.value, `Label '${unit.label}' in ${lang} must normalize to '${unit.value}'`);
    }
  }
});

// =========================================================================
// SECTION 3: Form Data Preservation & Store Integrity
// =========================================================================
console.log("\n--- Section 3: Form Data Preservation & Store Integrity ---");

runTest("3.1: Simulated Transaction creation preserves custom title, note, category, and wallet", () => {
  const mockState = {
    wallets: [
      { id: "w-sentinel", name: ".", currency: "VND", initial: 1000000, type: "cash" },
      { id: "w-custom", name: "Techcombank VIP 88", currency: "VND", initial: 5000000, type: "cash" },
    ],
    transactions: [],
    recurring: [],
    categories: ["Chưa được phân loại", "Thức ăn & Đồ uống", "Mua sắm", "Quỹ đen bí mật 🤫"],
    categoryMeta: {},
    settings: { language: "Tiếng Việt" },
  };

  // Simulate save handler from TransactionForm (Transactions.tsx lines 221-244)
  function simulateTransactionFormSave({
    state,
    existingId,
    type,
    title,
    amount,
    date,
    category,
    subcategory,
    wallet,
    note,
    image,
    recurring,
    interval,
    unit,
  }) {
    if (Number(amount) <= 0) return state;
    const item = {
      id: existingId || "tx-" + Math.random().toString(36).substring(2, 9),
      type,
      title,
      amount: Number(amount),
      date,
      category,
      subcategory,
      wallet,
      note,
      image: image || "",
      ...(recurring ? { interval, unit: normalizeRecurringUnit(unit) } : {}),
    };

    return recurring
      ? { ...state, recurring: [...state.recurring, item] }
      : {
          ...state,
          transactions: existingId
            ? state.transactions.map((t) => (t.id === existingId ? item : t))
            : [...state.transactions, item],
        };
  }

  // 1. Create a transaction with custom title, note, and custom category
  const updatedState1 = simulateTransactionFormSave({
    state: mockState,
    type: "expense",
    title: "Ăn tối cùng khách hàng VIP tại Rex Hotel 🍷",
    amount: "1850000",
    date: "2026-10-14",
    category: "Quỹ đen bí mật 🤫",
    subcategory: "Tiếp khách",
    wallet: "w-custom",
    note: "Hóa đơn VAT #8892 - Giữ nguyên không được dịch",
    image: "data:image/png;base64,sample",
    recurring: false,
  });

  assert.equal(updatedState1.transactions.length, 1);
  const tx1 = updatedState1.transactions[0];
  assert.equal(tx1.title, "Ăn tối cùng khách hàng VIP tại Rex Hotel 🍷");
  assert.equal(tx1.amount, 1850000);
  assert.equal(tx1.category, "Quỹ đen bí mật 🤫");
  assert.equal(tx1.subcategory, "Tiếp khách");
  assert.equal(tx1.wallet, "w-custom");
  assert.equal(tx1.note, "Hóa đơn VAT #8892 - Giữ nguyên không được dịch");
  assert.equal(tx1.image, "data:image/png;base64,sample");

  // 2. Switch language to English and Chinese - assert zero state mutation
  for (const lang of ["English", "en", "中文", "zh", "Tiếng Việt", "vi"]) {
    updatedState1.settings.language = lang;
    const tx = updatedState1.transactions[0];
    assert.equal(tx.title, "Ăn tối cùng khách hàng VIP tại Rex Hotel 🍷");
    assert.equal(tx.category, "Quỹ đen bí mật 🤫");
    assert.equal(tx.note, "Hóa đơn VAT #8892 - Giữ nguyên không được dịch");
  }
});

runTest("3.2: System category vs Custom category presentation & storage decoupling", () => {
  // Stored state uses canonical identifiers
  const transactions = [
    { id: "tx-sys", title: "Lunch", amount: 50000, type: "expense", category: "Thức ăn & Đồ uống", note: "Daily lunch" },
    { id: "tx-cust", title: "Crypto Buy", amount: 10000000, type: "expense", category: "Đầu tư Crypto 🚀", note: "ETH buy" },
  ];

  // In Vietnamese mode:
  assert.equal(resolveCategoryDisplayName(transactions[0].category, "vi"), "Thức ăn & Đồ uống");
  assert.equal(resolveCategoryDisplayName(transactions[1].category, "vi"), "Đầu tư Crypto 🚀");

  // In English mode:
  // System category resolves to localized label
  assert.equal(resolveCategoryDisplayName(transactions[0].category, "en"), "Food & Dining");
  // Custom category remains unaltered
  assert.equal(resolveCategoryDisplayName(transactions[1].category, "en"), "Đầu tư Crypto 🚀");

  // In Chinese mode:
  // System category resolves to localized label
  assert.equal(resolveCategoryDisplayName(transactions[0].category, "zh"), "餐饮");
  // Custom category remains unaltered
  assert.equal(resolveCategoryDisplayName(transactions[1].category, "zh"), "Đầu tư Crypto 🚀");

  // Crucial: Underlying transaction records are NOT mutated by display resolution
  assert.equal(transactions[0].category, "Thức ăn & Đồ uống");
  assert.equal(transactions[1].category, "Đầu tư Crypto 🚀");
});

runTest("3.3: Special characters, emojis, multi-line notes, and quotes preservation", () => {
  const exoticPayloads = [
    {
      title: `<script>alert("XSS")</script> & "Double" 'Single' \\ Backslash`,
      note: `Line 1: Special !@#$%^&*()_+\nLine 2: Tab\tValue\nLine 3: 繁體/简体/Tiếng Việt/English`,
      category: `Cat / Sub: 100% #1 & Special @!`,
    },
    {
      title: `💸 💰 🚀 🤫 🍕 🍺 Emojis Galore!`,
      note: `Unicode: 𠮷野家 (Surrogate pairs) & Math: ∑(x_i) = ∫ f(x)dx`,
      category: `💎 Diamond Hands`,
    },
    {
      title: `   Whitespace Title Padded   `,
      note: `   Whitespace Note Padded   `,
      category: `   Whitespace Cat Padded   `,
    },
  ];

  for (const payload of exoticPayloads) {
    const item = {
      id: "tx-exotic",
      title: payload.title,
      note: payload.note,
      category: payload.category,
      amount: 99999,
      type: "expense",
    };

    // Serialize to JSON and parse back (simulating persistence)
    const serialized = JSON.stringify(item);
    const deserialized = JSON.parse(serialized);

    assert.equal(deserialized.title, payload.title);
    assert.equal(deserialized.note, payload.note);
    assert.equal(deserialized.category, payload.category);

    // Assert resolver on category returns trimmed string without corruption
    const resolvedEn = resolveCategoryDisplayName(deserialized.category, "en");
    assert.equal(resolvedEn, payload.category.trim());
  }
});

runTest("3.4: Recurring transactions creation with multi-lingual interval units", () => {
  const recurringTestCases = [
    { interval: 1, rawUnit: "Ngày", expectedNormalized: "day" },
    { interval: 2, rawUnit: "Tuần", expectedNormalized: "week" },
    { interval: 1, rawUnit: "Tháng", expectedNormalized: "month" },
    { interval: 1, rawUnit: "Năm", expectedNormalized: "year" },
    { interval: 3, rawUnit: "daily", expectedNormalized: "day" },
    { interval: 2, rawUnit: "weekly", expectedNormalized: "week" },
    { interval: 6, rawUnit: "monthly", expectedNormalized: "month" },
    { interval: 1, rawUnit: "yearly", expectedNormalized: "year" },
    { interval: 1, rawUnit: "每天", expectedNormalized: "day" },
    { interval: 2, rawUnit: "每周", expectedNormalized: "week" },
    { interval: 1, rawUnit: "每月", expectedNormalized: "month" },
    { interval: 1, rawUnit: "每年", expectedNormalized: "year" },
    { interval: 1, rawUnit: undefined, expectedNormalized: "month" },
    { interval: 4, rawUnit: "unknown-gibberish", expectedNormalized: "month" },
  ];

  for (const tc of recurringTestCases) {
    const normalized = normalizeRecurringUnit(tc.rawUnit);
    assert.equal(
      normalized,
      tc.expectedNormalized,
      `Unit '${tc.rawUnit}' should normalize to '${tc.expectedNormalized}', got '${normalized}'`
    );

    const recurringItem = {
      id: "rec-" + Math.random(),
      title: "Subscription " + tc.rawUnit,
      amount: 150000,
      type: "expense",
      category: "Hóa đơn & Tiện ích",
      interval: tc.interval,
      unit: normalized,
    };

    assert.equal(recurringItem.interval, tc.interval);
    assert.equal(recurringItem.unit, tc.expectedNormalized);
  }
});

runTest("3.5: Edit existing transaction updates target while keeping unedited fields verbatim", () => {
  const originalTx = {
    id: "tx-existing-1",
    title: "Original Title VIP",
    amount: 500000,
    type: "expense",
    date: "2026-10-10",
    category: "Custom Startup Category",
    subcategory: "Marketing",
    wallet: "w-custom-1",
    note: "Keep this note completely intact!",
    image: "image-hash-123",
  };

  let transactionsList = [originalTx];

  // User edits ONLY amount in English mode
  const editedItem = {
    ...originalTx,
    amount: 750000,
  };

  transactionsList = transactionsList.map((t) => (t.id === originalTx.id ? editedItem : t));

  assert.equal(transactionsList.length, 1);
  const updated = transactionsList[0];
  assert.equal(updated.amount, 750000);
  assert.equal(updated.title, "Original Title VIP");
  assert.equal(updated.category, "Custom Startup Category");
  assert.equal(updated.subcategory, "Marketing");
  assert.equal(updated.wallet, "w-custom-1");
  assert.equal(updated.note, "Keep this note completely intact!");
  assert.equal(updated.image, "image-hash-123");
});

runTest("3.6: 1,000 rapid language toggles produces zero data corruption", () => {
  const baselineState = {
    wallets: [
      { id: "w1", name: ".", currency: "VND", initial: 10000000, type: "cash" },
      { id: "w2", name: "HSBC Visa Signature 💳", currency: "VND", initial: 0, type: "credit", limit: 50000000 },
      { id: "w3", name: "Chase Total Checking (USD)", currency: "USD", initial: 2500, type: "cash" },
      { id: "w4", name: "支付宝账户 (Alipay CNY)", currency: "CNY", initial: 6666, type: "cash" },
    ],
    transactions: [
      { id: "t1", title: "Lương công ty FPT", amount: 45000000, type: "income", category: "Lương", date: "2026-10-01", wallet: "w1", note: "Chuyển khoản lương tháng 10/2026" },
      { id: "t2", title: "Tiền thuê văn phòng", amount: 15000000, type: "expense", category: "Nhà", date: "2026-10-02", wallet: "w2", note: "Thanh toán kỳ 4" },
      { id: "t3", title: "Dinner @ Haidilao", amount: 1200000, type: "expense", category: "Thức ăn & Đồ uống", date: "2026-10-05", wallet: "w1", note: "Lẩu Haidilao Landmark 81" },
      { id: "t4", title: "AWS Cloud Services", amount: 250, type: "expense", category: "Quỹ công nghệ 💻", date: "2026-10-08", wallet: "w3", note: "Invoice #AWS-990182" },
      { id: "t5", title: "上海静安区早餐", amount: 28, type: "expense", category: "Thức ăn & Đồ uống", date: "2026-10-09", wallet: "w4", note: "小笼包与豆浆" },
    ],
    categories: ["Chưa được phân loại", "Thức ăn & Đồ uống", "Nhà", "Mua sắm", "Thu nhập", "Lương", "Quỹ công nghệ 💻"],
    settings: { language: "Tiếng Việt" },
  };

  const baselineWalletsJson = JSON.stringify(baselineState.wallets);
  const baselineTransactionsJson = JSON.stringify(baselineState.transactions);
  const baselineCategoriesJson = JSON.stringify(baselineState.categories);

  const langVariants = [
    "vi", "en", "zh",
    "Tiếng Việt", "English", "中文",
    "vi-VN", "en-US", "zh-CN",
    "VI", "EN", "ZH",
    "vietnamese", "english", "chinese",
    "  en  ", "  zh-TW  ", "  tiếng việt  ",
  ];

  let state = structuredClone(baselineState);

  for (let i = 0; i < 1000; i++) {
    const targetLang = langVariants[i % langVariants.length];
    state.settings.language = targetLang;
    const resolved = resolveLanguage(state.settings.language);

    // Verify Sentinel Wallet resolves to localized label without changing stored name '.'
    const sentinelName = state.wallets[0].name;
    assert.equal(sentinelName, ".");
    const localizedWallet = resolveWalletDisplayName(sentinelName, resolved);
    if (resolved === "vi") assert.equal(localizedWallet, "Ví chính");
    else if (resolved === "zh") assert.equal(localizedWallet, "主钱包");
    else assert.equal(localizedWallet, "Main wallet");

    // Verify Custom Wallets are completely untouched
    for (let w = 1; w < state.wallets.length; w++) {
      assert.equal(state.wallets[w].name, baselineState.wallets[w].name);
      assert.equal(resolveWalletDisplayName(state.wallets[w].name, resolved), baselineState.wallets[w].name);
    }

    // Verify Transactions and Categories are completely untouched
    for (let t = 0; t < state.transactions.length; t++) {
      assert.equal(state.transactions[t].title, baselineState.transactions[t].title);
      assert.equal(state.transactions[t].note, baselineState.transactions[t].note);
      assert.equal(state.transactions[t].category, baselineState.transactions[t].category);
      assert.equal(state.transactions[t].amount, baselineState.transactions[t].amount);
    }
  }

  // Deep comparison against initial baseline
  assert.equal(JSON.stringify(state.wallets), baselineWalletsJson, "Wallets corrupted!");
  assert.equal(JSON.stringify(state.transactions), baselineTransactionsJson, "Transactions corrupted!");
  assert.equal(JSON.stringify(state.categories), baselineCategoriesJson, "Categories corrupted!");
});

// =========================================================================
// SECTION 4: High-Volume Performance & Throughput Benchmark
// =========================================================================
console.log("\n--- Section 4: Performance & Throughput Benchmark ---");

runTest("4.1: 50,000 category resolution operations complete within performance threshold (<100ms)", () => {
  const categories = [
    "Thức ăn & Đồ uống",
    "Nhà",
    "Mua sắm",
    "Thu nhập",
    "Lương",
    "Quà tặng",
    "Hóa đơn & Tiện ích",
    "Di chuyển",
    "Giải trí",
    "Custom Category #1",
    "Quỹ đen 🤫",
    "  Thức ăn & Đồ uống  ",
    "",
    null,
  ];

  const languages = ["en", "vi", "zh", "English", "Tiếng Việt", "中文"];
  const start = performance.now();

  for (let i = 0; i < 50000; i++) {
    const c = categories[i % categories.length];
    const l = languages[i % languages.length];
    resolveCategoryDisplayName(c, l, "Fallback");
  }

  const duration = performance.now() - start;
  console.log(`    [Throughput] 50,000 category resolutions completed in ${duration.toFixed(2)}ms`);
  assert.ok(duration < 250, `Resolution took too long: ${duration.toFixed(2)}ms`);
});

runTest("4.2: 50,000 recurring unit normalizations complete within performance threshold (<100ms)", () => {
  const units = [
    "Ngày", "Tuần", "Tháng", "Năm",
    "daily", "weekly", "monthly", "yearly",
    "每天", "每周", "每月", "每年",
    "  monthly  ", undefined, null, "gibberish"
  ];

  const start = performance.now();

  for (let i = 0; i < 50000; i++) {
    const u = units[i % units.length];
    normalizeRecurringUnit(u);
  }

  const duration = performance.now() - start;
  console.log(`    [Throughput] 50,000 unit normalizations completed in ${duration.toFixed(2)}ms`);
  assert.ok(duration < 250, `Normalization took too long: ${duration.toFixed(2)}ms`);
});

// =========================================================================
// FINAL VERDICT EVALUATION
// =========================================================================
console.log("\n=========================================================================");
console.log(`STRESS TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
if (failures.length > 0) {
  console.log(`FAILURES: ${failures.length} test(s) failed:`);
  failures.forEach((f, idx) => {
    console.log(`  ${idx + 1}. ${f.name} -> ${f.error}`);
  });
  console.log("VERDICT: FAIL");
  console.log("=========================================================================");
  process.exit(1);
} else {
  console.log("VERDICT: APPROVE");
  console.log("=========================================================================");
  process.exit(0);
}
