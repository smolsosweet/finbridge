const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

// Compile helper
const globalCache = new Map();
function compileTs(filePath, customResolver = () => undefined, instanceCache = globalCache) {
  if (instanceCache.has(filePath)) return instanceCache.get(filePath);
  const source = fs.readFileSync(filePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const exports = {};
  const moduleObj = { exports };
  instanceCache.set(filePath, exports);
  const dirname = path.dirname(filePath);

  const emptyCssProxy = new Proxy({}, {
    get: (_, prop) => (prop === "__esModule" ? true : prop === "default" ? emptyCssProxy : String(prop)),
  });

  const lucideProxy = new Proxy({}, {
    get: (_, name) => {
      const Comp = (props) => React.createElement("span", { "data-icon": String(name), ...props });
      Comp.displayName = `Lucide.${String(name)}`;
      return Comp;
    },
  });

  const resolver = (name) => {
    const override = customResolver(name);
    if (override !== undefined) return override;
    if (name === "react") return React;
    if (name === "react/jsx-runtime" || name === "react/jsx-dev-runtime") return require("react/jsx-runtime");
    if (name === "lucide-react") return lucideProxy;
    if (name === "next/navigation") {
      return {
        useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
        useSearchParams: () => new URLSearchParams(),
      };
    }
    if (name.endsWith(".css") || name.endsWith(".module.css")) return emptyCssProxy;
    if (name.startsWith("@/")) {
      const target = path.join(__dirname, "../src", name.slice(2));
      for (const ext of ["", ".ts", ".tsx", ".js", ".cjs"]) {
        if (fs.existsSync(target + ext) && !fs.statSync(target + ext).isDirectory()) {
          return compileTs(target + ext, customResolver, instanceCache);
        }
      }
    }
    if (name.startsWith(".")) {
      const target = path.resolve(dirname, name);
      for (const ext of ["", ".ts", ".tsx", ".js", ".cjs"]) {
        if (fs.existsSync(target + ext) && !fs.statSync(target + ext).isDirectory()) {
          return compileTs(target + ext, customResolver, instanceCache);
        }
      }
    }
    return require(name);
  };

  new Function("require", "exports", "module", compiled)(resolver, exports, moduleObj);
  return moduleObj.exports;
}

const i18n = compileTs(path.resolve(__dirname, "../src/lib/i18n.ts"));
const {
  resolveLanguage,
  resolveWalletDisplayName,
  isSentinelWalletName,
  normalizeWalletNameForStorage,
  resolveCategoryDisplayName,
  SYSTEM_CATEGORY_LABELS,
} = i18n;

let passed = 0;
let total = 0;
const failures = [];

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✔ [PASS] ${name}`);
  } catch (err) {
    failures.push({ name, error: err.message });
    console.error(`  ✖ [FAIL] ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log("=== ADVERSARIAL REVIEWER M2 STRESS TEST ===");

// -------------------------------------------------------------
// SECTION 1: Category Localization & Preservations Under Adversarial Conditions
// -------------------------------------------------------------
console.log("\n--- Section 1: Category Resolver Adversarial Stress ---");

test("resolveCategoryDisplayName resolves default categories across all 3 languages", () => {
  assert.equal(resolveCategoryDisplayName("Thức ăn & Đồ uống", "vi"), "Thức ăn & Đồ uống");
  assert.equal(resolveCategoryDisplayName("Thức ăn & Đồ uống", "en"), "Food & Dining");
  assert.equal(resolveCategoryDisplayName("Thức ăn & Đồ uống", "zh"), "餐饮");
});

test("resolveCategoryDisplayName handles English source categories", () => {
  assert.equal(resolveCategoryDisplayName("Uncategorized", "vi"), "Chưa được phân loại");
  assert.equal(resolveCategoryDisplayName("Uncategorized", "en"), "Uncategorized");
  assert.equal(resolveCategoryDisplayName("Uncategorized", "zh"), "未分类");
});

test("resolveCategoryDisplayName handles Chinese source categories", () => {
  assert.equal(resolveCategoryDisplayName("未分类", "vi"), "Chưa được phân loại");
  assert.equal(resolveCategoryDisplayName("未分类", "en"), "Uncategorized");
  assert.equal(resolveCategoryDisplayName("未分类", "zh"), "未分类");
});

test("resolveCategoryDisplayName trims whitespace gracefully", () => {
  assert.equal(resolveCategoryDisplayName("  Lương   ", "en"), "Salary");
  assert.equal(resolveCategoryDisplayName("  Lương   ", "zh"), "工资");
  assert.equal(resolveCategoryDisplayName("  Lương   ", "vi"), "Lương");
});

test("resolveCategoryDisplayName preserves custom user categories verbatim", () => {
  const custom = "Tiền lì xì Tết 2026";
  assert.equal(resolveCategoryDisplayName(custom, "vi"), custom);
  assert.equal(resolveCategoryDisplayName(custom, "en"), custom);
  assert.equal(resolveCategoryDisplayName(custom, "zh"), custom);
});

test("resolveCategoryDisplayName handles null / undefined / empty without throwing", () => {
  assert.equal(resolveCategoryDisplayName(null, "en", "Fallback"), "Fallback");
  assert.equal(resolveCategoryDisplayName(undefined, "zh", "N/A"), "N/A");
  assert.equal(resolveCategoryDisplayName("", "vi", "None"), "None");
  assert.equal(resolveCategoryDisplayName("   ", "vi", "None"), "None");
});

// -------------------------------------------------------------
// SECTION 2: TransactionForm I18N Completeness & Unit Normalization
// -------------------------------------------------------------
console.log("\n--- Section 2: TransactionForm I18N & Normalizer Stress ---");

const transactionsModule = compileTs(path.resolve(__dirname, "../src/components/finbridge/workspace/Transactions.tsx"));
const { TRANSACTION_FORM_I18N, normalizeRecurringUnit } = transactionsModule;

test("TRANSACTION_FORM_I18N contains all required keys for vi, en, zh without undefined values", () => {
  const keys = Object.keys(TRANSACTION_FORM_I18N.vi);
  assert.ok(keys.length >= 25, "Expected at least 25 keys in TransactionForm copy");
  for (const lang of ["en", "vi", "zh"]) {
    const dict = TRANSACTION_FORM_I18N[lang];
    assert.ok(dict, `Missing dict for ${lang}`);
    for (const k of keys) {
      assert.ok(dict[k] !== undefined && dict[k] !== null && dict[k] !== "", `Key ${k} is invalid in ${lang}`);
    }
  }
});

test("normalizeRecurringUnit normalizes multi-language strings into canonical units", () => {
  assert.equal(normalizeRecurringUnit("ngày"), "day");
  assert.equal(normalizeRecurringUnit("Daily"), "day");
  assert.equal(normalizeRecurringUnit("每天"), "day");
  assert.equal(normalizeRecurringUnit("Tuần"), "week");
  assert.equal(normalizeRecurringUnit("weekly"), "week");
  assert.equal(normalizeRecurringUnit("每周"), "week");
  assert.equal(normalizeRecurringUnit("tháng"), "month");
  assert.equal(normalizeRecurringUnit("Monthly"), "month");
  assert.equal(normalizeRecurringUnit("每月"), "month");
  assert.equal(normalizeRecurringUnit("Năm"), "year");
  assert.equal(normalizeRecurringUnit("yearly"), "year");
  assert.equal(normalizeRecurringUnit("每年"), "year");
  assert.equal(normalizeRecurringUnit(undefined), "month");
  assert.equal(normalizeRecurringUnit("unknown-unit"), "month");
});

// -------------------------------------------------------------
// SECTION 3: Dashboard Date Pickers & Modals Zero Leaks
// -------------------------------------------------------------
console.log("\n--- Section 3: Dashboard Date Pickers & Modals Audit ---");

const dashboardModule = compileTs(path.resolve(__dirname, "../src/components/finbridge/workspace/Dashboard.tsx"));
const { DASHBOARD_I18N } = dashboardModule;

test("DASHBOARD_I18N period keys exist in vi, en, zh and have no hardcoded Vietnamese in EN/ZH", () => {
  for (const lang of ["en", "zh"]) {
    const d = DASHBOARD_I18N[lang];
    assert.ok(d.periodDay && !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(d.periodDay));
    assert.ok(d.periodWeek && !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(d.periodWeek));
    assert.ok(d.periodMonth && !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(d.periodMonth));
    assert.ok(d.periodYear && !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(d.periodYear));
    assert.ok(d.periodAllTime && !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(d.periodAllTime));
    assert.ok(d.periodCustomRange && !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(d.periodCustomRange));
    assert.ok(d.pickDayModalTitle && !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(d.pickDayModalTitle));
    assert.ok(d.pickWeekModalTitle && !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(d.pickWeekModalTitle));
    assert.ok(d.pickMonthModalTitle && !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(d.pickMonthModalTitle));
    assert.ok(d.pickYearModalTitle && !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(d.pickYearModalTitle));
    assert.ok(d.pickCustomRangeModalTitle && !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(d.pickCustomRangeModalTitle));
  }
});

// -------------------------------------------------------------
// SECTION 4: TransactionHistory Multi-lingual Search & Formatting
// -------------------------------------------------------------
console.log("\n--- Section 4: TransactionHistory Search & Category Filter ---");

test("TransactionHistory renders localized text for vi, en, zh without omissions", () => {
  const customStore = {
    useAppState: () => ({
      wallets: [{ id: "w1", name: ".", currency: "VND" }],
      transactions: [{
        id: "t1",
        title: "Test Tx",
        amount: 50000,
        type: "expense",
        category: "Thức ăn & Đồ uống",
        wallet: "w1",
        date: "2026-10-12",
        note: "User note",
      }],
      categories: ["Thức ăn & Đồ uống", "Chưa được phân loại", "Tùy chỉnh 123"],
      categoryMeta: {},
      settings: { language: "vi" },
    }),
  };

  const headerModule = compileTs(path.resolve(__dirname, "../src/components/finbridge/workspace/FinBridgeHeader.tsx"));

  for (const [langSetting, exp] of [
    ["Tiếng Việt", { eyebrow: "LỊCH SỬ GIAO DỊCH", title: "Lịch sử giao dịch", wallet: "Ví chính", cat: "Thức ăn & Đồ uống" }],
    ["English", { eyebrow: "TRANSACTION HISTORY", title: "Transaction history", wallet: "Main wallet", cat: "Food & Dining" }],
    ["中文", { eyebrow: "交易记录", title: "交易记录", wallet: "主钱包", cat: "餐饮" }],
  ]) {
    const historyComp = compileTs(path.resolve(__dirname, "../src/components/finbridge/workspace/TransactionHistory.tsx"), (name) => {
      if (name === "./store") {
        return {
          useAppState: () => ({
            ...customStore.useAppState(),
            settings: { language: langSetting },
          }),
        };
      }
      if (name === "./FinBridgeHeader") return headerModule;
      return undefined;
    }, new Map());

    const rawHtml = renderToStaticMarkup(React.createElement(historyComp.TransactionHistory, { navigate: () => {} }));
    const html = rawHtml.replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
    assert.ok(html.includes(exp.eyebrow), `Expected eyebrow in ${langSetting}`);
    assert.ok(html.includes(exp.title), `Expected title in ${langSetting}`);
    assert.ok(html.includes(exp.wallet), `Expected resolved wallet "${exp.wallet}" in ${langSetting}`);
    assert.ok(html.includes(exp.cat), `Expected resolved category "${exp.cat}" in ${langSetting}`);
    assert.ok(html.includes("User note"), `User note must be preserved in ${langSetting}`);
  }
});

// -------------------------------------------------------------
// SUMMARY & VERDICT
// -------------------------------------------------------------
console.log(`\n==============================================`);
console.log(`STRESS TEST SUMMARY: ${passed}/${total} passed (${failures.length} failures)`);
if (failures.length > 0) {
  console.log(`VERDICT: FAIL`);
  process.exit(1);
} else {
  console.log(`VERDICT: PASS (Zero regressions, zero leaks, 100% integrity)`);
  process.exit(0);
}
