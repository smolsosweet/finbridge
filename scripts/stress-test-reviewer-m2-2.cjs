// Independent Empirical Adversarial Stress Test Harness for Milestone 2
// Author: Reviewer M2-2
// Focus: Transactions Workspace, Form, Pickers, History Localization, Zero Leaks & Data Integrity
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const directory = path.resolve(__dirname, "../src/components/sites/rolly/replica");
const srcDir = path.resolve(__dirname, "../src");

const lucide = new Proxy({}, {
  get: (_, name) => {
    const IconComponent = (props) => React.createElement("span", { "data-icon": String(name), ...props });
    IconComponent.displayName = `Lucide.${String(name)}`;
    return IconComponent;
  },
});

function transpile(filePath) {
  return ts.transpileModule(fs.readFileSync(filePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
}

function compileFile(filePath, customResolver, instanceCache = new Map()) {
  if (instanceCache.has(filePath)) return instanceCache.get(filePath);

  const source = transpile(filePath);
  const result = { exports: {} };
  instanceCache.set(filePath, result.exports);
  const fileDir = path.dirname(filePath);

  const emptyCssProxy = new Proxy({}, {
    get: (_, prop) => (prop === "__esModule" ? true : prop === "default" ? emptyCssProxy : String(prop)),
  });

  const resolver = (name) => {
    if (customResolver) {
      const override = customResolver(name);
      if (override !== undefined) return override;
    }
    if (name === "react") return React;
    if (name === "react/jsx-runtime" || name === "react/jsx-dev-runtime") return require("react/jsx-runtime");
    if (name === "lucide-react") return lucide;
    if (name === "next/navigation") {
      return {
        useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
        useSearchParams: () => new URLSearchParams(),
      };
    }
    if (name.endsWith(".css") || name.endsWith(".module.css")) return emptyCssProxy;

    let targetPath = null;
    if (name.startsWith("@/")) {
      const target = path.join(srcDir, name.slice(2));
      for (const ext of ["", ".ts", ".tsx", ".js", ".cjs"]) {
        if (fs.existsSync(target + ext) && !fs.statSync(target + ext).isDirectory()) {
          targetPath = target + ext;
          break;
        }
      }
    } else if (name.startsWith(".")) {
      const target = path.resolve(fileDir, name);
      for (const ext of ["", ".ts", ".tsx", ".js", ".cjs"]) {
        if (fs.existsSync(target + ext) && !fs.statSync(target + ext).isDirectory()) {
          targetPath = target + ext;
          break;
        }
      }
    }

    if (targetPath && (targetPath.endsWith(".ts") || targetPath.endsWith(".tsx"))) {
      return compileFile(targetPath, customResolver, instanceCache);
    }
    return require(name);
  };

  new Function("require", "module", "exports", source)(resolver, result, result.exports);
  return result.exports;
}

const i18nModule = compileFile(path.join(srcDir, "lib/i18n.ts"));
const {
  resolveLanguage,
  resolveWalletDisplayName,
  isSentinelWalletName,
  normalizeWalletNameForStorage,
  resolveCategoryDisplayName,
  SYSTEM_CATEGORY_LABELS,
} = i18nModule;

const transactionsModule = compileFile(path.join(directory, "Transactions.tsx"));
const {
  TRANSACTION_FORM_I18N,
  normalizeRecurringUnit,
} = transactionsModule;

const dashboardModule = compileFile(path.join(directory, "Dashboard.tsx"));
const { DASHBOARD_I18N } = dashboardModule;

function unescapeHtml(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

let totalTests = 0;
let passedTests = 0;
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

console.log("=== ADVERSARIAL STRESS TEST: MILESTONE M2 (REVIEWER M2-2) ===\n");

// -----------------------------------------------------------------------------
// 1. DATA INTEGRITY & CATEGORY RESOLVER (resolveCategoryDisplayName)
// -----------------------------------------------------------------------------
console.log("--- 1. Data Integrity: Category Resolution & Preservation ---");

runTest("Default category 'Chưa được phân loại' resolves dynamically", () => {
  assert.equal(resolveCategoryDisplayName("Chưa được phân loại", "vi"), "Chưa được phân loại");
  assert.equal(resolveCategoryDisplayName("Chưa được phân loại", "en"), "Uncategorized");
  assert.equal(resolveCategoryDisplayName("Chưa được phân loại", "zh"), "未分类");
});

runTest("English input 'Uncategorized' resolves dynamically to active language", () => {
  assert.equal(resolveCategoryDisplayName("Uncategorized", "vi"), "Chưa được phân loại");
  assert.equal(resolveCategoryDisplayName("Uncategorized", "en"), "Uncategorized");
  assert.equal(resolveCategoryDisplayName("Uncategorized", "zh"), "未分类");
});

runTest("Default categories ('Thức ăn & Đồ uống', 'Mua sắm', 'Lương', 'Hóa đơn & Tiện ích') localize cleanly", () => {
  assert.equal(resolveCategoryDisplayName("Thức ăn & Đồ uống", "en"), "Food & Dining");
  assert.equal(resolveCategoryDisplayName("Thức ăn & Đồ uống", "zh"), "餐饮");
  assert.equal(resolveCategoryDisplayName("Mua sắm", "en"), "Shopping");
  assert.equal(resolveCategoryDisplayName("Mua sắm", "zh"), "购物");
  assert.equal(resolveCategoryDisplayName("Lương", "en"), "Salary");
  assert.equal(resolveCategoryDisplayName("Lương", "zh"), "工资");
  assert.equal(resolveCategoryDisplayName("Hóa đơn & Tiện ích", "en"), "Bills & Utilities");
  assert.equal(resolveCategoryDisplayName("Hóa đơn & Tiện ích", "zh"), "账单与公共事业");
  assert.equal(resolveCategoryDisplayName("Chuyển khoản nội bộ", "en"), "Internal Transfer");
  assert.equal(resolveCategoryDisplayName("Chuyển khoản nội bộ", "zh"), "内部转账");
});

runTest("Custom user category 'Đồ chơi công nghệ' is preserved verbatim in all languages", () => {
  assert.equal(resolveCategoryDisplayName("Đồ chơi công nghệ", "vi"), "Đồ chơi công nghệ");
  assert.equal(resolveCategoryDisplayName("Đồ chơi công nghệ", "en"), "Đồ chơi công nghệ");
  assert.equal(resolveCategoryDisplayName("Đồ chơi công nghệ", "zh"), "Đồ chơi công nghệ");
});

runTest("Custom categories with special characters, emojis, or foreign text preserved", () => {
  const custom = "🏎️ F1 Ticket VIP (Sepang 2026)";
  assert.equal(resolveCategoryDisplayName(custom, "vi"), custom);
  assert.equal(resolveCategoryDisplayName(custom, "en"), custom);
  assert.equal(resolveCategoryDisplayName(custom, "zh"), custom);
});

runTest("Empty, null, undefined or whitespace category respects fallbackLabel", () => {
  assert.equal(resolveCategoryDisplayName("", "en", "Fallback"), "Fallback");
  assert.equal(resolveCategoryDisplayName(null, "vi", "None"), "None");
  assert.equal(resolveCategoryDisplayName(undefined, "zh", "默认"), "默认");
  assert.equal(resolveCategoryDisplayName("   ", "en", "Fallback"), "Fallback");
});

// -----------------------------------------------------------------------------
// 2. WALLET DATA INTEGRITY & SENTINEL RESOLUTION
// -----------------------------------------------------------------------------
console.log("\n--- 2. Data Integrity: Wallets & Sentinel Resolution ---");

runTest("Custom wallet 'Ngân Hàng Bản Việt VIP 88' is preserved verbatim in all languages", () => {
  assert.equal(resolveWalletDisplayName("Ngân Hàng Bản Việt VIP 88", "vi"), "Ngân Hàng Bản Việt VIP 88");
  assert.equal(resolveWalletDisplayName("Ngân Hàng Bản Việt VIP 88", "en"), "Ngân Hàng Bản Việt VIP 88");
  assert.equal(resolveWalletDisplayName("Ngân Hàng Bản Việt VIP 88", "zh"), "Ngân Hàng Bản Việt VIP 88");
});

runTest("Sentinel wallet '.' resolves to canonical labels without mutating stored entity", () => {
  assert.equal(resolveWalletDisplayName(".", "vi"), "Ví chính");
  assert.equal(resolveWalletDisplayName(".", "en"), "Main wallet");
  assert.equal(resolveWalletDisplayName(".", "zh"), "主钱包");
});

runTest("Legacy sentinel display names map to canonical '.' on storage normalization", () => {
  assert.equal(normalizeWalletNameForStorage("."), ".");
  assert.equal(normalizeWalletNameForStorage("Ví chính"), ".");
  assert.equal(normalizeWalletNameForStorage("Main wallet"), ".");
  assert.equal(normalizeWalletNameForStorage("主钱包"), ".");
  assert.equal(normalizeWalletNameForStorage("  Ngân Hàng Bản Việt VIP 88  "), "Ngân Hàng Bản Việt VIP 88");
});

// -----------------------------------------------------------------------------
// 3. RECURRING UNIT NORMALIZATION (normalizeRecurringUnit)
// -----------------------------------------------------------------------------
console.log("\n--- 3. Recurring Unit Normalization ---");

runTest("normalizeRecurringUnit handles Vietnamese variants", () => {
  assert.equal(normalizeRecurringUnit("ngày"), "day");
  assert.equal(normalizeRecurringUnit("Ngày"), "day");
  assert.equal(normalizeRecurringUnit("tuần"), "week");
  assert.equal(normalizeRecurringUnit("Tuần"), "week");
  assert.equal(normalizeRecurringUnit("tháng"), "month");
  assert.equal(normalizeRecurringUnit("Tháng"), "month");
  assert.equal(normalizeRecurringUnit("năm"), "year");
  assert.equal(normalizeRecurringUnit("Năm"), "year");
});

runTest("normalizeRecurringUnit handles English and Chinese variants", () => {
  assert.equal(normalizeRecurringUnit("day"), "day");
  assert.equal(normalizeRecurringUnit("daily"), "day");
  assert.equal(normalizeRecurringUnit("week"), "week");
  assert.equal(normalizeRecurringUnit("monthly"), "month");
  assert.equal(normalizeRecurringUnit("year"), "year");
  assert.equal(normalizeRecurringUnit("每天"), "day");
  assert.equal(normalizeRecurringUnit("每周"), "week");
  assert.equal(normalizeRecurringUnit("每月"), "month");
  assert.equal(normalizeRecurringUnit("每年"), "year");
});

runTest("normalizeRecurringUnit falls back to 'month' on unknown or missing input", () => {
  assert.equal(normalizeRecurringUnit(undefined), "month");
  assert.equal(normalizeRecurringUnit(""), "month");
  assert.equal(normalizeRecurringUnit("invalid_unit"), "month");
});

// -----------------------------------------------------------------------------
// 4. TRANSACTION FORM ZERO LEAKS & LOCALIZATION (SSR)
// -----------------------------------------------------------------------------
console.log("\n--- 4. TransactionForm SSR & Zero Leak Audit ---");

const PROHIBITED_VIETNAMESE_IN_EN_ZH_STRICT = [
  "Chi phí",
  "Thu nhập",
  "Mục",
  "Số tiền",
  "Loại",
  "Chọn Ví",
  "Hình ảnh đính kèm",
  "Xóa giao dịch",
  "Thêm giao dịch",
  "Chỉnh sửa giao dịch",
  "Khoảng thời gian định kỳ",
  "Đơn vị thời gian",
  "Hủy bỏ",
  "Lưu",
  "Xác nhận",
];

const PROHIBITED_ENGLISH_IN_VI_ZH_STRICT = [
  "Expense",
  "Income",
  "Item",
  "Amount",
  "Category",
  "Wallet",
  "Attached image",
  "Delete transaction",
  "Add transaction",
  "Edit transaction",
  "Recurring interval",
  "Time unit",
  "Cancel",
  "Save",
  "Confirm",
];

function createMockStore(lang) {
  return {
    useAppState: () => ({
      settings: { language: lang },
      categories: ["Chưa được phân loại", "Thức ăn & Đồ uống", "Đồ chơi công nghệ"],
      categoryMeta: {
        "Chưa được phân loại": { type: "expense", icon: "❓", children: [] },
        "Thức ăn & Đồ uống": { type: "expense", icon: "🍔", children: ["Cà phê", "Nhà hàng"] },
        "Đồ chơi công nghệ": { type: "expense", icon: "💻", children: [] },
      },
      wallets: [
        { id: "w-sentinel", name: ".", currency: "VND", initial: 1000000, type: "cash" },
        { id: "w-custom", name: "Ngân Hàng Bản Việt VIP 88", currency: "VND", initial: 50000000, type: "cash" },
      ],
      transactions: [],
      recurring: [],
      receiptDraft: "",
    }),
    updateState: () => {},
  };
}

runTest("TransactionForm renders cleanly in Tiếng Việt without English leaks", () => {
  const customTx = compileFile(path.join(directory, "Transactions.tsx"), (name) => {
    if (name === "./store") return createMockStore("Tiếng Việt");
    return undefined;
  });
  const html = renderToStaticMarkup(React.createElement(customTx.TransactionForm, { navigate: () => {} }));
  const unescaped = unescapeHtml(html);

  // Must have Vietnamese
  assert.ok(unescaped.includes("Chi phí"), "Must have 'Chi phí'");
  assert.ok(unescaped.includes("Thu nhập"), "Must have 'Thu nhập'");
  assert.ok(unescaped.includes("Mục"), "Must have 'Mục'");
  assert.ok(unescaped.includes("Số tiền"), "Must have 'Số tiền'");
  assert.ok(unescaped.includes("Chọn Ví"), "Must have 'Chọn Ví'");
  assert.ok(unescaped.includes("Hình ảnh đính kèm"), "Must have 'Hình ảnh đính kèm'");
  assert.ok(unescaped.includes("Ví chính"), "Sentinel wallet '.' must render as 'Ví chính'");
  assert.ok(unescaped.includes("Ngân Hàng Bản Việt VIP 88"), "Custom wallet must render verbatim");
  assert.ok(unescaped.includes("Đồ chơi công nghệ"), "Custom category must render verbatim");
  assert.ok(unescaped.includes("Thức ăn & Đồ uống"), "System category must render in Vietnamese");

  // Prohibited English leaks
  for (const enWord of PROHIBITED_ENGLISH_IN_VI_ZH_STRICT) {
    const rx = new RegExp(`\\b${enWord}\\b`, "i");
    assert.doesNotMatch(unescaped, rx, `VI form leaked English word '${enWord}'`);
  }
});

runTest("TransactionForm renders cleanly in English without Vietnamese leaks", () => {
  const customTx = compileFile(path.join(directory, "Transactions.tsx"), (name) => {
    if (name === "./store") return createMockStore("English");
    return undefined;
  });
  const html = renderToStaticMarkup(React.createElement(customTx.TransactionForm, { navigate: () => {} }));
  const unescaped = unescapeHtml(html);

  // Must have English
  assert.ok(unescaped.includes("Expense"), "Must have 'Expense'");
  assert.ok(unescaped.includes("Income"), "Must have 'Income'");
  assert.ok(unescaped.includes("Item"), "Must have 'Item'");
  assert.ok(unescaped.includes("Amount"), "Must have 'Amount'");
  assert.ok(unescaped.includes("Wallet"), "Must have 'Wallet'");
  assert.ok(unescaped.includes("Attached image"), "Must have 'Attached image'");
  assert.ok(unescaped.includes("Main wallet"), "Sentinel wallet '.' must render as 'Main wallet'");
  assert.ok(unescaped.includes("Ngân Hàng Bản Việt VIP 88"), "Custom wallet must render verbatim");
  assert.ok(unescaped.includes("Đồ chơi công nghệ"), "Custom category must render verbatim");
  assert.ok(unescaped.includes("Food & Dining"), "System category must render as 'Food & Dining'");

  // Prohibited Vietnamese leaks
  for (const viWord of PROHIBITED_VIETNAMESE_IN_EN_ZH_STRICT) {
    assert.ok(!unescaped.includes(viWord), `EN form leaked Vietnamese phrase '${viWord}'`);
  }
});

runTest("TransactionForm renders cleanly in 中文 without Vietnamese leaks or English leaks", () => {
  const customTx = compileFile(path.join(directory, "Transactions.tsx"), (name) => {
    if (name === "./store") return createMockStore("中文");
    return undefined;
  });
  const html = renderToStaticMarkup(React.createElement(customTx.TransactionForm, { navigate: () => {} }));
  const unescaped = unescapeHtml(html);

  // Must have Chinese
  assert.ok(unescaped.includes("支出"), "Must have '支出'");
  assert.ok(unescaped.includes("收入"), "Must have '收入'");
  assert.ok(unescaped.includes("项目"), "Must have '项目'");
  assert.ok(unescaped.includes("金额"), "Must have '金额'");
  assert.ok(unescaped.includes("钱包"), "Must have '钱包'");
  assert.ok(unescaped.includes("附加图片"), "Must have '附加图片'");
  assert.ok(unescaped.includes("主钱包"), "Sentinel wallet '.' must render as '主钱包'");
  assert.ok(unescaped.includes("Ngân Hàng Bản Việt VIP 88"), "Custom wallet must render verbatim");
  assert.ok(unescaped.includes("Đồ chơi công nghệ"), "Custom category must render verbatim");
  assert.ok(unescaped.includes("餐饮"), "System category must render as '餐饮'");

  // Prohibited Vietnamese leaks
  for (const viWord of PROHIBITED_VIETNAMESE_IN_EN_ZH_STRICT) {
    assert.ok(!unescaped.includes(viWord), `ZH form leaked Vietnamese phrase '${viWord}'`);
  }
});

runTest("Recurring TransactionForm renders cleanly across EN, VI, ZH", () => {
  for (const lang of ["Tiếng Việt", "English", "中文"]) {
    const customTx = compileFile(path.join(directory, "Transactions.tsx"), (name) => {
      if (name === "./store") return createMockStore(lang);
      return undefined;
    });
    const html = renderToStaticMarkup(React.createElement(customTx.TransactionForm, { navigate: () => {}, recurring: true }));
    const unescaped = unescapeHtml(html);

    if (lang === "English") {
      assert.ok(unescaped.includes("Recurring interval"));
      assert.ok(unescaped.includes("Time unit"));
      assert.ok(unescaped.includes("Next scheduled date"));
      assert.ok(unescaped.includes("Confirm"));
      assert.ok(unescaped.includes("Cancel"));
      assert.ok(!unescaped.includes("Khoảng thời gian định kỳ"));
    } else if (lang === "中文") {
      assert.ok(unescaped.includes("周期频率"));
      assert.ok(unescaped.includes("时间单位"));
      assert.ok(unescaped.includes("下次计划日期"));
      assert.ok(unescaped.includes("确认"));
      assert.ok(unescaped.includes("取消"));
      assert.ok(!unescaped.includes("Khoảng thời gian định kỳ"));
    } else {
      assert.ok(unescaped.includes("Khoảng thời gian định kỳ"));
      assert.ok(unescaped.includes("Đơn vị thời gian"));
      assert.ok(unescaped.includes("Lịch trình tiếp theo Ngày"));
      assert.ok(unescaped.includes("Xác nhận"));
      assert.ok(unescaped.includes("Hủy bỏ"));
    }
  }
});

// -----------------------------------------------------------------------------
// 5. TRANSACTION HISTORY ZERO LEAKS & DATA INTEGRITY (SSR)
// -----------------------------------------------------------------------------
console.log("\n--- 5. TransactionHistory SSR, Leaks & Preservation ---");

function createHistoryMockStore(lang) {
  return {
    useAppState: () => ({
      settings: { language: lang, theme: "light" },
      categories: ["Chưa được phân loại", "Thức ăn & Đồ uống", "Đồ chơi công nghệ"],
      wallets: [
        { id: "w-sentinel", name: ".", currency: "VND", initial: 1000000, type: "cash" },
        { id: "w-custom", name: "Ngân Hàng Bản Việt VIP 88", currency: "VND", initial: 50000000, type: "cash" },
      ],
      transactions: [
        {
          id: "tx-hist-1",
          title: "Bàn phím cơ Custom HHKB",
          amount: 8500000,
          date: "2026-10-12",
          type: "expense",
          category: "Đồ chơi công nghệ",
          wallet: "w-custom",
          note: "Ghi chú tuyệt mật không được dịch",
          currency: "VND",
        },
        {
          id: "tx-hist-2",
          title: "Cà phê sáng",
          amount: 65000,
          date: "2026-10-12",
          type: "expense",
          category: "Thức ăn & Đồ uống",
          wallet: "w-sentinel",
          note: "Họp nhóm",
          currency: "VND",
        },
      ],
    }),
    updateState: () => {},
  };
}

runTest("TransactionHistory in English has zero leaks and strictly preserves custom entities", () => {
  const customHist = compileFile(path.join(directory, "TransactionHistory.tsx"), (name) => {
    if (name === "./store") return createHistoryMockStore("English");
    return undefined;
  });
  // Test with search active to verify Clear search button
  const htmlWithSearch = renderToStaticMarkup(React.createElement(customHist.TransactionHistory, { navigate: () => {}, defaultSearch: "abc" }));
  const unescapedWithSearch = unescapeHtml(htmlWithSearch);
  assert.ok(unescapedWithSearch.includes("Clear search"), "Clear search aria-label present when search is active");

  // Test without search to verify transaction rendering and custom entity preservation
  const html = renderToStaticMarkup(React.createElement(customHist.TransactionHistory, { navigate: () => {} }));
  const unescaped = unescapeHtml(html);

  // English copy present
  assert.ok(unescaped.includes("All categories"), "All categories present");
  assert.ok(unescaped.includes("Main wallet"), "Main wallet present for sentinel");
  assert.ok(unescaped.includes("Food & Dining"), "System category resolved to 'Food & Dining'");

  // Custom data preserved verbatim
  assert.ok(unescaped.includes("Ngân Hàng Bản Việt VIP 88"), "Custom wallet name preserved verbatim");
  assert.ok(unescaped.includes("Bàn phím cơ Custom HHKB"), "Custom title preserved verbatim");
  assert.ok(unescaped.includes("Đồ chơi công nghệ"), "Custom category preserved verbatim");
  assert.ok(unescaped.includes("Ghi chú tuyệt mật không được dịch"), "Custom note preserved verbatim");

  // Prohibited Vietnamese UI leaks
  const prohibitedVi = [
    "Xóa tìm kiếm",
    "Từ mọi ví trong kỳ",
    "Tất cả danh mục",
    "Khoảng thời gian",
    "Lịch sử giao dịch",
    "Chưa có giao dịch",
  ];
  for (const phrase of prohibitedVi) {
    assert.ok(!unescaped.includes(phrase), `EN TransactionHistory leaked Vietnamese phrase '${phrase}'`);
  }
});

runTest("TransactionHistory in Chinese has zero leaks and strictly preserves custom entities", () => {
  const customHist = compileFile(path.join(directory, "TransactionHistory.tsx"), (name) => {
    if (name === "./store") return createHistoryMockStore("中文");
    return undefined;
  });
  // Test with search active to verify Clear search button
  const htmlWithSearch = renderToStaticMarkup(React.createElement(customHist.TransactionHistory, { navigate: () => {}, defaultSearch: "abc" }));
  const unescapedWithSearch = unescapeHtml(htmlWithSearch);
  assert.ok(unescapedWithSearch.includes("清除搜索"), "Clear search present in Chinese when search is active");

  // Test without search to verify transaction rendering and custom entity preservation
  const html = renderToStaticMarkup(React.createElement(customHist.TransactionHistory, { navigate: () => {} }));
  const unescaped = unescapeHtml(html);

  // Chinese copy present
  assert.ok(unescaped.includes("全部类别"), "All categories present in Chinese");
  assert.ok(unescaped.includes("主钱包"), "Main wallet present in Chinese");
  assert.ok(unescaped.includes("餐饮"), "System category resolved to '餐饮'");

  // Custom data preserved verbatim
  assert.ok(unescaped.includes("Ngân Hàng Bản Việt VIP 88"), "Custom wallet name preserved verbatim");
  assert.ok(unescaped.includes("Bàn phím cơ Custom HHKB"), "Custom title preserved verbatim");
  assert.ok(unescaped.includes("Đồ chơi công nghệ"), "Custom category preserved verbatim");
  assert.ok(unescaped.includes("Ghi chú tuyệt mật không được dịch"), "Custom note preserved verbatim");

  // Prohibited leaks
  assert.ok(!unescaped.includes("Clear search"), "ZH History leaked English 'Clear search'");
  assert.ok(!unescaped.includes("Xóa tìm kiếm"), "ZH History leaked Vietnamese 'Xóa tìm kiếm'");
});

// -----------------------------------------------------------------------------
// 6. DASHBOARD DATE PICKERS, FLOW MODALS & QUICK SEARCH
// -----------------------------------------------------------------------------
console.log("\n--- 6. Dashboard Date Pickers, Period Selection & Modals ---");

runTest("DASHBOARD_I18N contains complete and valid keys across en, vi, zh", () => {
  assert.ok(DASHBOARD_I18N.vi, "Missing DASHBOARD_I18N.vi");
  assert.ok(DASHBOARD_I18N.en, "Missing DASHBOARD_I18N.en");
  assert.ok(DASHBOARD_I18N.zh, "Missing DASHBOARD_I18N.zh");

  const requiredKeys = [
    "periodModalTitle",
    "periodDay",
    "periodWeek",
    "periodMonth",
    "periodYear",
    "periodAllTime",
    "periodCustomRange",
    "pickDayModalTitle",
    "pickDayDesc",
    "today",
    "yesterday",
    "pickWeekModalTitle",
    "thisWeek",
    "previousWeek",
    "nextWeek",
    "pickMonthModalTitle",
    "monthNamesShort",
    "pickYearModalTitle",
    "pickCustomRangeModalTitle",
    "fromDate",
    "toDate",
    "period7dPast",
    "period30dPast",
    "thisMonth",
    "applyButton",
    "searchModalTitle",
    "searchPlaceholder",
    "searchButton",
    "clearSearchButton",
    "flowIncomeModalTitle",
    "flowExpenseModalTitle",
    "flowComparisonModalTitle",
    "donutIncomeBreakdown",
    "donutExpenseBreakdown",
    "donutTotalIncome",
    "donutTotalExpense",
    "donutNoIncomeTx",
    "donutNoExpenseTx",
    "transactionsHeading",
    "searchTransactionsAria",
  ];

  for (const lang of ["vi", "en", "zh"]) {
    for (const key of requiredKeys) {
      assert.ok(DASHBOARD_I18N[lang][key], `Missing ${key} in DASHBOARD_I18N.${lang}`);
    }
  }
});

runTest("Period picker translations in EN and ZH have zero Vietnamese leaks", () => {
  // EN check
  assert.equal(DASHBOARD_I18N.en.periodModalTitle, "Select time period");
  assert.equal(DASHBOARD_I18N.en.periodDay, "Day");
  assert.equal(DASHBOARD_I18N.en.periodWeek, "Week");
  assert.equal(DASHBOARD_I18N.en.periodMonth, "Month");
  assert.equal(DASHBOARD_I18N.en.periodYear, "Year");
  assert.equal(DASHBOARD_I18N.en.periodAllTime, "All time");
  assert.equal(DASHBOARD_I18N.en.periodCustomRange, "Custom range");

  // ZH check
  assert.equal(DASHBOARD_I18N.zh.periodModalTitle, "选择时间范围");
  assert.equal(DASHBOARD_I18N.zh.periodDay, "按日");
  assert.equal(DASHBOARD_I18N.zh.periodWeek, "按周");
  assert.equal(DASHBOARD_I18N.zh.periodMonth, "按月");
  assert.equal(DASHBOARD_I18N.zh.periodYear, "按年");
  assert.equal(DASHBOARD_I18N.zh.periodAllTime, "全部时间");
  assert.equal(DASHBOARD_I18N.zh.periodCustomRange, "自定义范围");
});

runTest("Quick date buttons ('Hôm nay', 'Tuần này', 'Tháng này') translate cleanly", () => {
  assert.equal(DASHBOARD_I18N.en.today, "Today");
  assert.equal(DASHBOARD_I18N.en.thisWeek, "This week");
  assert.equal(DASHBOARD_I18N.en.thisMonth, "This month");

  assert.equal(DASHBOARD_I18N.zh.today, "今天");
  assert.equal(DASHBOARD_I18N.zh.thisWeek, "本周");
  assert.equal(DASHBOARD_I18N.zh.thisMonth, "本月");

  assert.equal(DASHBOARD_I18N.vi.today, "Hôm nay");
  assert.equal(DASHBOARD_I18N.vi.thisWeek, "Tuần này");
  assert.equal(DASHBOARD_I18N.vi.thisMonth, "Tháng này");
});

// -----------------------------------------------------------------------------
// 7. INTEGRITY AUDIT: ANTI-CHEATING & IMPLEMENTATION AUTHENTICITY
// -----------------------------------------------------------------------------
console.log("\n--- 7. Integrity Audit: Implementation Authenticity ---");

runTest("resolveCategoryDisplayName handles unknown categories without crashing or fabricating", () => {
  const arbitraryKey = "RandomCategoryXYZ123";
  assert.equal(resolveCategoryDisplayName(arbitraryKey, "en"), arbitraryKey);
  assert.equal(resolveCategoryDisplayName(arbitraryKey, "vi"), arbitraryKey);
  assert.equal(resolveCategoryDisplayName(arbitraryKey, "zh"), arbitraryKey);
});

runTest("resolveLanguage handles edge case strings gracefully", () => {
  assert.equal(resolveLanguage("   VIETNAMESE   "), "vi");
  assert.equal(resolveLanguage("   ENGLISH (UK) "), "en");
  assert.equal(resolveLanguage("   ZH-HANS      "), "zh");
  assert.equal(resolveLanguage(null), "vi");
  assert.equal(resolveLanguage(undefined), "vi");
  assert.equal(resolveLanguage(""), "vi");
});

runTest("Date formatting formatLocalizedDate logic in Dashboard produces locale-appropriate strings", () => {
  // VI: DD/MM/YYYY
  // EN: M/D/YYYY
  // ZH: YYYY年M月D日
  // Test by rendering Dashboard in EN and ZH and checking date displays
  for (const lang of ["English", "中文", "Tiếng Việt"]) {
    const customDashboard = compileFile(path.join(directory, "Dashboard.tsx"), (name) => {
      if (name === "./store") {
        return {
          useAppState: () => ({
            settings: { language: lang },
            wallets: [{ id: "w-1", name: ".", currency: "VND", initial: 1000000, type: "cash" }],
            transactions: [
              { id: "tx-d-1", title: "Test", amount: 100, date: "2026-10-12", type: "expense", category: "Mua sắm", wallet: "w-1" },
            ],
          }),
          updateState: () => {},
          money: (val) => String(val),
        };
      }
      return undefined;
    });

    const html = renderToStaticMarkup(React.createElement(customDashboard.Dashboard, { navigate: () => {}, transactionsTab: true }));
    const unescaped = unescapeHtml(html);

    if (lang === "English") {
      assert.ok(unescaped.includes("10/12/2026"), "EN should display date as M/D/YYYY (10/12/2026)");
      assert.ok(!unescaped.includes("12/10/2026"), "EN should not display date as DD/MM/YYYY");
    } else if (lang === "中文") {
      assert.ok(unescaped.includes("2026年10月12日"), "ZH should display date as 2026年10月12日");
    } else {
      assert.ok(unescaped.includes("12/10/2026"), "VI should display date as 12/10/2026");
    }
  }
});

console.log(`\n========================================`);
console.log(`Summary: ${passedTests}/${totalTests} tests passed (${failures.length} failed)`);
console.log(`========================================\n`);

if (failures.length > 0) {
  process.exit(1);
} else {
  console.log("ALL ADVERSARIAL STRESS TESTS PASSED CLEANLY!");
  process.exit(0);
}
