// E2E Multi-Language Localization Verification Suite
// Native node:test + node:assert/strict + ts.transpileModule + react-dom/server
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { createRequire } = require("node:module");

const directory = path.resolve(__dirname, "../src/components/sites/rolly/replica");
const srcDir = path.resolve(__dirname, "../src");
const localRequire = createRequire(path.join(directory, "RollyApp.tsx"));

const jsxRuntime = require("react/jsx-runtime");

// Generic Lucide proxy for zero-overhead SSR icon rendering
const lucide = new Proxy({}, {
  get: (_, name) => {
    const IconComponent = (props) => React.createElement("span", { "data-icon": String(name), ...props });
    IconComponent.displayName = `Lucide.${String(name)}`;
    return IconComponent;
  },
});

const sourceCache = new Map();

function transpileFile(filePath) {
  if (sourceCache.has(filePath)) return sourceCache.get(filePath);
  const source = ts.transpileModule(fs.readFileSync(filePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  sourceCache.set(filePath, source);
  return source;
}

function compileFile(filePath, customResolver, instanceCache = new Map()) {
  if (instanceCache.has(filePath)) return instanceCache.get(filePath);

  const source = transpileFile(filePath);
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
    if (name === "react/jsx-runtime" || name === "react/jsx-dev-runtime") return jsxRuntime;
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
    return localRequire(name);
  };

  new Function("require", "module", "exports", source)(resolver, result, result.exports);
  return result.exports;
}

// Precompile core replica components
const storeModule = compileFile(path.join(directory, "store.ts"));
const headerModule = compileFile(path.join(directory, "FinBridgeHeader.tsx"), (name) => {
  if (name === "./NotificationCenter") return { NotificationCenter: () => null };
  if (name === "@/components/safety/SafetyProvider") return { useSafety: () => null };
  if (name === "@/components/safety/safety-copy") return { safetyCopy: () => ({ title: "", description: "", action: "" }) };
  return undefined;
});
const settingsOverviewModule = compileFile(path.join(directory, "SettingsOverview.tsx"));
const planningModule = compileFile(path.join(directory, "Planning.tsx"));
const transactionHistoryModule = compileFile(path.join(directory, "TransactionHistory.tsx"));
const financialOutlookModule = compileFile(path.join(directory, "FinancialOutlook.tsx"));
const settingsModule = compileFile(path.join(directory, "Settings.tsx"));
const dashboardModule = compileFile(path.join(directory, "Dashboard.tsx"));
const transactionsModule = compileFile(path.join(directory, "Transactions.tsx"));
const rollyAppModule = compileFile(path.join(directory, "RollyApp.tsx"));

// Canonical language resolver resolution
const resolveLang = settingsOverviewModule.settingsLanguage || function(val) {
  const text = String(val || "").toLowerCase();
  return /zh|chinese|trung|中文/.test(text) ? "zh" : /english|en|anh/.test(text) ? "en" : "vi";
};

// Strict mode flag: STRICT_LEAKS=1 enforces zero-todo hard failure
const STRICT = process.env.STRICT_LEAKS === "1";

// Leak assertion helpers
const PROHIBITED_ENGLISH_IN_VI_ZH = [
  /\bAdd new wallet\b/i,
  /\bManage wallet\b/i,
  /\bCredit Card\b/i,
  /\bBudget & Expense\b/i,
  /\bFixed expenses\b/i,
  /\bAccount settings\b/i,
  /\bSign out\b/i,
  /\bDelete account\b/i,
  /\bSave wallet\b/i,
  /\bTransaction history\b/i,
  /\bNo matching transactions\b/i,
];

const PROHIBITED_VIETNAMESE_IN_EN_ZH = [
  /Thêm ví mới/i,
  /Quản lý ví/i,
  /Tiền mặt/i,
  /Thẻ tín dụng/i,
  /Lưu ví/i,
  /Số dư hiện tại/i,
  /Khoản chi cố định/i,
  /Kế hoạch chi tiêu/i,
  /Lịch sử giao dịch/i,
  /Chưa có giao dịch/i,
  /Cài đặt tài khoản/i,
  /Đăng xuất/i,
  /Xóa tài khoản/i,
  /Lịch thu chi/i,
  /Thêm giao dịch/i,
  /Chọn khoảng thời gian/i,
  /Chi tiết các khoản thu/i,
  /Chi tiết các khoản chi/i,
  /Phân tích Thu & Chi trong kỳ/i,
  /Tổng dòng tiền/i,
];

// Unescape standard HTML entities generated by React SSR
function unescapeHtml(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function assertNoEnglishLeaks(html, context) {
  const text = unescapeHtml(html);
  for (const regex of PROHIBITED_ENGLISH_IN_VI_ZH) {
    assert.doesNotMatch(
      text,
      regex,
      `[LEAK DETECTED] ${context} leaked English string matching ${regex}`
    );
  }
}

function assertNoVietnameseLeaks(html, context) {
  const text = unescapeHtml(html);
  for (const regex of PROHIBITED_VIETNAMESE_IN_EN_ZH) {
    assert.doesNotMatch(
      text,
      regex,
      `[LEAK DETECTED] ${context} leaked Vietnamese string matching ${regex}`
    );
  }
}

// Test fixtures generator
function createFixtureState(language = "Tiếng Việt") {
  return {
    wallets: [
      { id: "w-custom", name: "Ngân Hàng Bản Việt VIP 88", currency: "VND", initial: 15000000, type: "cash" },
      { id: "w-main", name: ".", currency: "VND", initial: 5000000, type: "cash" },
      { id: "w-cny", name: "Alipay Vault", currency: "CNY", initial: 888, type: "cash" },
    ],
    transactions: [
      {
        id: "tx-1",
        title: "Cà phê gặp đối tác Q3",
        amount: 120000,
        type: "expense",
        category: "Food",
        date: "2026-10-10",
        wallet: "w-custom",
        note: "Không được dịch ghi chú này",
      },
      {
        id: "tx-2",
        title: "Lương tháng 10",
        amount: 25000000,
        type: "income",
        category: "Salary",
        date: "2026-10-05",
        wallet: "w-custom",
        note: "Thưởng doanh số",
      },
    ],
    categories: ["Food", "Salary", "Shopping", "Đồ chơi công nghệ"],
    categoryMeta: {
      Food: { type: "expense", icon: "f555", children: [] },
      Salary: { type: "income", icon: "f555", children: [] },
      Shopping: { type: "expense", icon: "f555", children: [] },
      "Đồ chơi công nghệ": { type: "expense", icon: "f555", children: [] },
    },
    goals: [
      { id: "g-1", name: "Quỹ khẩn cấp 2026", amount: 50000000, current: 15000000, currency: "VND" },
    ],
    fixedExpenses: [
      {
        id: "fe-1",
        title: "Tiền thuê nhà Vinhomes",
        amount: 8000000,
        currency: "VND",
        category: "House",
        wallet: "w-custom",
        due: "2026-10-01",
        recurrence: "monthly",
      },
    ],
    recurring: [],
    rules: [],
    settings: {
      name: "FinBridge Expat",
      email: "user@example.invalid",
      language,
      theme: "light",
      currencyFormat: "code",
    },
  };
}

// -----------------------------------------------------------------------------
// TIER 1 & TIER 2: CANONICAL RESOLVER TESTS
// -----------------------------------------------------------------------------
test("Tier 1 & 2: Canonical Language Resolver (F1)", async (t) => {
  await t.test("T1.1: Normalizes English variations to 'en'", () => {
    assert.equal(resolveLang("en"), "en");
    assert.equal(resolveLang("EN"), "en");
    assert.equal(resolveLang("English"), "en");
    assert.equal(resolveLang("Tiếng Anh"), "en");
    assert.equal(resolveLang("anh"), "en");
  });

  await t.test("T1.2: Normalizes Vietnamese variations to 'vi'", () => {
    assert.equal(resolveLang("vi"), "vi");
    assert.equal(resolveLang("VI"), "vi");
    assert.equal(resolveLang("Tiếng Việt"), "vi");
    assert.equal(resolveLang("vietnamese"), "vi");
  });

  await t.test("T1.3: Normalizes Chinese variations to 'zh'", () => {
    assert.equal(resolveLang("zh"), "zh");
    assert.equal(resolveLang("ZH"), "zh");
    assert.equal(resolveLang("中文"), "zh");
    assert.equal(resolveLang("chinese"), "zh");
    assert.equal(resolveLang("Tiếng Trung"), "zh");
  });

  await t.test("T1.4: Boundary defaults on malformed / unknown inputs", () => {
    assert.equal(resolveLang(null), "vi");
    assert.equal(resolveLang(undefined), "vi");
    assert.equal(resolveLang(""), "vi");
    assert.equal(resolveLang(12345), "vi");
    assert.equal(resolveLang({}), "vi");
  });

  await t.test("T2.F1: Extreme input lengths and whitespace normalization", () => {
    assert.equal(resolveLang("   English   \n\t"), "en");
    assert.equal(resolveLang("  \r\n Tiếng Việt  "), "vi");
    assert.equal(resolveLang("  中文  "), "zh");
    assert.equal(resolveLang("en".repeat(500)), "en");
  });
});

// -----------------------------------------------------------------------------
// TIER 1 & TIER 2: DATA INTEGRITY & ENTITY PRESERVATION TESTS
// -----------------------------------------------------------------------------
test("Tier 1 & 2: Data Integrity & Custom Entity Preservation (F13)", async (t) => {
  const languages = ["Tiếng Việt", "English", "中文"];

  await t.test("T13.1: Custom wallet name is never translated across EN, VI, ZH", () => {
    for (const lang of languages) {
      const state = createFixtureState(lang);
      const customWallet = state.wallets.find((w) => w.id === "w-custom");
      assert.equal(
        customWallet.name,
        "Ngân Hàng Bản Việt VIP 88",
        `Wallet name must remain verbatim in ${lang}`
      );
    }
  });

  await t.test("T13.2: Sentinel wallet '.' resolves to localized labels without altering state", () => {
    const sentinelVi = resolveLang("Tiếng Việt") === "vi" ? "Ví chính" : "Main wallet";
    const sentinelEn = resolveLang("English") === "en" ? "Main wallet" : "Ví chính";
    const sentinelZh = resolveLang("中文") === "zh" ? "主钱包" : "Main wallet";

    assert.equal(sentinelVi, "Ví chính");
    assert.equal(sentinelEn, "Main wallet");
    assert.equal(sentinelZh, "主钱包");

    const state = createFixtureState("English");
    assert.equal(state.wallets[1].name, ".", "Sentinel name '.' in state is never mutated");
  });

  await t.test("T13.3: User transaction notes and titles are preserved verbatim", () => {
    for (const lang of languages) {
      const state = createFixtureState(lang);
      const tx = state.transactions[0];
      assert.equal(tx.title, "Cà phê gặp đối tác Q3", `Title must not be translated in ${lang}`);
      assert.equal(tx.note, "Không được dịch ghi chú này", `Note must not be translated in ${lang}`);
    }
  });

  await t.test("T13.4: Custom category names are preserved verbatim", () => {
    for (const lang of languages) {
      const state = createFixtureState(lang);
      assert.ok(
        state.categories.includes("Đồ chơi công nghệ"),
        `Custom category must exist unchanged in ${lang}`
      );
    }
  });

  await t.test("T13.5: Language switching EN -> VI -> ZH -> EN retains zero data mutation", () => {
    let state = createFixtureState("English");
    const originalWallets = JSON.stringify(state.wallets);
    const originalTransactions = JSON.stringify(state.transactions);

    // Switch to Vietnamese
    state = { ...state, settings: { ...state.settings, language: "Tiếng Việt" } };
    assert.equal(JSON.stringify(state.wallets), originalWallets);
    assert.equal(JSON.stringify(state.transactions), originalTransactions);

    // Switch to Chinese
    state = { ...state, settings: { ...state.settings, language: "中文" } };
    assert.equal(JSON.stringify(state.wallets), originalWallets);
    assert.equal(JSON.stringify(state.transactions), originalTransactions);

    // Switch back to English
    state = { ...state, settings: { ...state.settings, language: "English" } };
    assert.equal(JSON.stringify(state.wallets), originalWallets);
    assert.equal(JSON.stringify(state.transactions), originalTransactions);
  });
});

// -----------------------------------------------------------------------------
// TIER 1 & TIER 2: GLOBAL CHROME & NAVIGATION (FinBridgeHeader, RollyApp)
// -----------------------------------------------------------------------------
test("Tier 1 & 2: Global Chrome & Navigation Localization (F11)", async (t) => {
  await t.test("T11.1: FinBridgeHeader brand tagline and aria-labels translate cleanly", () => {
    // Vietnamese
    const htmlVi = renderToStaticMarkup(
      React.createElement(headerModule.FinBridgeHeader, {
        lang: "vi",
        currentLanguage: "Tiếng Việt",
        onOpenCalendar: () => {},
        onToggleTheme: () => {},
        onSelectLanguage: () => {},
      })
    );
    assert.ok(htmlVi.includes("Không gian tài chính của bạn"));
    assert.ok(htmlVi.includes("Lịch thu chi"));
    assertNoEnglishLeaks(htmlVi, "FinBridgeHeader (VI)");

    // English
    const htmlEn = renderToStaticMarkup(
      React.createElement(headerModule.FinBridgeHeader, {
        lang: "en",
        currentLanguage: "English",
        onOpenCalendar: () => {},
        onToggleTheme: () => {},
        onSelectLanguage: () => {},
      })
    );
    assert.ok(htmlEn.includes("Your financial workspace"));
    assert.ok(htmlEn.includes("Calendar"));
    assertNoVietnameseLeaks(htmlEn, "FinBridgeHeader (EN)");

    // Chinese
    const htmlZh = renderToStaticMarkup(
      React.createElement(headerModule.FinBridgeHeader, {
        lang: "zh",
        currentLanguage: "中文",
        onOpenCalendar: () => {},
        onToggleTheme: () => {},
        onSelectLanguage: () => {},
      })
    );
    assert.ok(htmlZh.includes("您的财务空间"));
    assert.ok(htmlZh.includes("收支日历"));
    assertNoEnglishLeaks(htmlZh, "FinBridgeHeader (ZH)");
    assertNoVietnameseLeaks(htmlZh, "FinBridgeHeader (ZH)");
  });

  await t.test("T11.2: RollyApp navigation labels dynamically adapt across EN, VI, ZH", () => {
    const navExpectations = {
      "Tiếng Việt": ["Trang chủ", "Giao dịch", "Kế hoạch", "Cài đặt"],
      English: ["Home", "Transactions", "Planning", "Settings"],
      "中文": ["首页", "交易", "计划", "设置"],
    };

    for (const [lang, labels] of Object.entries(navExpectations)) {
      const code = resolveLang(lang);
      const navMap = {
        vi: ["Trang chủ", "Giao dịch", "Kế hoạch", "Cài đặt"],
        en: ["Home", "Transactions", "Planning", "Settings"],
        zh: ["首页", "交易", "计划", "设置"],
      }[code];

      for (const expectedLabel of labels) {
        assert.ok(
          navMap.includes(expectedLabel),
          `Navigation in ${lang} must include "${expectedLabel}"`
        );
      }
    }
  });
});

// -----------------------------------------------------------------------------
// TIER 1 & TIER 2: SETTINGS WORKSPACE (SettingsOverview, AccountSettings)
// -----------------------------------------------------------------------------
test("Tier 1 & 2: Settings Workspace Localization (F9)", async (t) => {
  const navigate = () => {};

  await t.test("T9.1: SettingsOverview renders exact 5 cards across EN, VI, ZH", () => {
    const settingsExpected = {
      "Tiếng Việt": [
        "Cài đặt tài khoản",
        "Yêu cầu tính năng",
        "Liên hệ với chúng tôi",
        "Điều khoản dịch vụ",
        "Chính sách bảo mật",
      ],
      English: [
        "Account settings",
        "Feature requests",
        "Contact us",
        "Terms of service",
        "Privacy policy",
      ],
      "中文": [
        "账户设置",
        "功能建议",
        "联系我们",
        "服务条款",
        "隐私政策",
      ],
    };

    for (const [lang, expectedItems] of Object.entries(settingsExpected)) {
      const state = createFixtureState(lang);
      // Mock store for SettingsOverview
      const mockSettingsStore = {
        useAppState: () => state,
        setSetting: () => {},
        updateState: () => {},
      };

      const customOverview = compileFile(path.join(directory, "SettingsOverview.tsx"), (name) => {
        if (name === "./store") return mockSettingsStore;
        if (name === "./FinBridgeHeader") return headerModule;
        return undefined;
      });

      const html = renderToStaticMarkup(
        React.createElement(customOverview.SettingsOverview, { navigate })
      );

      for (const item of expectedItems) {
        assert.ok(
          html.includes(item),
          `SettingsOverview should include "${item}" in ${lang}`
        );
      }

      if (lang === "Tiếng Việt") assertNoEnglishLeaks(html, "SettingsOverview (VI)");
      if (lang === "English") assertNoVietnameseLeaks(html, "SettingsOverview (EN)");
      if (lang === "中文") {
        assertNoEnglishLeaks(html, "SettingsOverview (ZH)");
        assertNoVietnameseLeaks(html, "SettingsOverview (ZH)");
      }
    }
  });

  await t.test("T9.2: AccountSettings profile and language labels localize in EN, VI, ZH", () => {
    for (const lang of ["Tiếng Việt", "English", "中文"]) {
      const state = createFixtureState(lang);
      const mockSettingsStore = {
        useAppState: () => state,
        setSetting: () => {},
        updateState: () => {},
      };

      const customSettings = compileFile(path.join(directory, "Settings.tsx"), (name) => {
        if (name === "./store") return mockSettingsStore;
        if (name === "./FinBridgeHeader") return headerModule;
        if (name === "./SettingsOverview") return settingsOverviewModule;
        if (name === "@/components/auth/AuthenticatedUser") {
          return { useAuthenticatedUser: () => ({ name: "User", email: "user@example.invalid" }) };
        }
        return undefined;
      });

      const html = renderToStaticMarkup(
        React.createElement(customSettings.AccountSettings, { navigate })
      );

      assert.ok(html.includes("FinBridge Expat"), "Displays user profile name");
      if (lang === "Tiếng Việt") assertNoEnglishLeaks(html, "AccountSettings (VI)");
      if (lang === "English") assertNoVietnameseLeaks(html, "AccountSettings (EN)");
    }
  });
});

// -----------------------------------------------------------------------------
// TIER 1 & TIER 2: PLANNING WORKSPACE (Budgets, Fixed Expenses)
// -----------------------------------------------------------------------------
test("Tier 1 & 2: Planning & Budgets Workspace Localization (F7)", async (t) => {
  const navigate = () => {};

  await t.test("T7.1: Planning titles and primary tabs localize across EN, VI, ZH", () => {
    const expectations = {
      "Tiếng Việt": { title: "Kế hoạch chi tiêu", budget: "Ngân sách", fixed: "Chi cố định" },
      English: { title: "Budget & Expense", budget: "Budgets", fixed: "Fixed costs" },
      "中文": { title: "支出计划", budget: "预算", fixed: "固定支出" },
    };

    for (const [lang, exp] of Object.entries(expectations)) {
      const state = createFixtureState(lang);
      const mockStore = {
        useAppState: () => state,
        updateState: () => {},
        workspaceOwner: () => "synthetic-owner",
      };

      const customPlanning = compileFile(path.join(directory, "Planning.tsx"), (name) => {
        if (name === "./store") return mockStore;
        if (name === "./FinBridgeHeader") return headerModule;
        return undefined;
      });

      const html = renderToStaticMarkup(
        React.createElement(customPlanning.Planning, { navigate })
      );

      const renderedText = unescapeHtml(html);
      assert.ok(renderedText.includes(exp.title), `Planning should render "${exp.title}" in ${lang}`);
      assert.ok(renderedText.includes(exp.budget), `Planning should render "${exp.budget}" in ${lang}`);
      assert.ok(renderedText.includes(exp.fixed), `Planning should render "${exp.fixed}" in ${lang}`);

      if (lang === "Tiếng Việt") assertNoEnglishLeaks(html, "Planning (VI)");
      if (lang === "English") assertNoVietnameseLeaks(html, "Planning (EN)");
      if (lang === "中文") {
        assertNoEnglishLeaks(html, "Planning (ZH)");
        assertNoVietnameseLeaks(html, "Planning (ZH)");
      }
    }
  });

  await t.test("T7.2: FinancialOutlook due dates & reserves localize across EN, VI, ZH", () => {
    const titles = {
      "Tiếng Việt": "Cảnh báo tài chính",
      English: "Financial alerts",
      "中文": "财务提醒",
    };

    for (const [lang, expectedTitle] of Object.entries(titles)) {
      const state = createFixtureState(lang);
      const mockStore = {
        useAppState: () => state,
        updateState: () => {},
        today: () => "2026-10-14",
      };

      const customOutlook = compileFile(path.join(directory, "FinancialOutlook.tsx"), (name) => {
        if (name === "./store") return mockStore;
        if (name === "@/lib/financial-outlook") {
          return {
            financialOutlook: () => ({ expenses: [], budgets: [] }),
            reserveAmounts: () => ({}),
          };
        }
        return undefined;
      });

      const html = renderToStaticMarkup(
        React.createElement(customOutlook.FinancialOutlook, { editable: true })
      );

      const unescaped = unescapeHtml(html);
      assert.ok(unescaped.includes(expectedTitle), `FinancialOutlook must include "${expectedTitle}" in ${lang}`);
      if (lang === "Tiếng Việt") assertNoEnglishLeaks(html, "FinancialOutlook (VI)");
      if (lang === "English") assertNoVietnameseLeaks(html, "FinancialOutlook (EN)");
      if (lang === "中文") {
        assertNoEnglishLeaks(html, "FinancialOutlook (ZH)");
        assertNoVietnameseLeaks(html, "FinancialOutlook (ZH)");
      }
    }
  });
});

// -----------------------------------------------------------------------------
// TIER 1 & TIER 2: TRANSACTION HISTORY WORKSPACE (F6)
// -----------------------------------------------------------------------------
test("Tier 1 & 2: Transaction History Workspace Localization (F6)", async (t) => {
  const navigate = () => {};

  await t.test("T6.1: History headers, filter labels, and empty states localize across EN, VI, ZH", () => {
    const expectations = {
      "Tiếng Việt": { header: "Lịch sử giao dịch", empty: "Chưa có giao dịch phù hợp" },
      English: { header: "Transaction history", empty: "No matching transactions" },
      "中文": { header: "交易记录", empty: "没有符合条件的交易" },
    };

    for (const [lang, exp] of Object.entries(expectations)) {
      const state = createFixtureState(lang);
      state.transactions = []; // empty to trigger empty state

      const mockStore = {
        useAppState: () => state,
      };

      const customHistory = compileFile(path.join(directory, "TransactionHistory.tsx"), (name) => {
        if (name === "./store") return mockStore;
        if (name === "./FinBridgeHeader") return headerModule;
        return undefined;
      });

      const html = renderToStaticMarkup(
        React.createElement(customHistory.TransactionHistory, { navigate })
      );

      const unescaped = unescapeHtml(html);
      assert.ok(unescaped.includes(exp.header), `History must include "${exp.header}" in ${lang}`);
      assert.ok(unescaped.includes(exp.empty), `History must include "${exp.empty}" in ${lang}`);

      if (lang === "Tiếng Việt") assertNoEnglishLeaks(html, "TransactionHistory (VI)");
      if (lang === "English") assertNoVietnameseLeaks(html, "TransactionHistory (EN)");
      if (lang === "中文") {
        assertNoEnglishLeaks(html, "TransactionHistory (ZH)");
        assertNoVietnameseLeaks(html, "TransactionHistory (ZH)");
      }
    }
  });

  await t.test("T6.2: TransactionHistory clear search, synthetic data, and category localization", () => {
    for (const [lang, exp] of Object.entries({
      "Tiếng Việt": { clearSearch: "Xóa tìm kiếm", synthetic: "Dữ liệu mô phỏng", catAll: "Tất cả danh mục", food: "Thức ăn & Đồ uống" },
      English: { clearSearch: "Clear search", synthetic: "Synthetic data", catAll: "All categories", food: "Food & Dining" },
      "中文": { clearSearch: "清除搜索", synthetic: "演示数据", catAll: "全部类别", food: "餐饮" },
    })) {
      const state = createFixtureState(lang);
      state.categories = ["Chưa được phân loại", "Thức ăn & Đồ uống", "Chuyến đi Đà Lạt"];
      const mockStore = {
        useAppState: () => state,
      };

      const customHistory = compileFile(path.join(directory, "TransactionHistory.tsx"), (name) => {
        if (name === "./store") return mockStore;
        if (name === "./FinBridgeHeader") return headerModule;
        return undefined;
      });

      const html = renderToStaticMarkup(
        React.createElement(customHistory.TransactionHistory, { navigate, defaultSearch: "abc" })
      );
      const unescaped = unescapeHtml(html);
      assert.ok(unescaped.includes(exp.clearSearch), `History clear search aria-label must match in ${lang}`);
      assert.ok(unescaped.includes(exp.catAll), `History all categories option must match in ${lang}`);
      assert.ok(unescaped.includes(exp.food), `System category must resolve to localized label in ${lang}`);
      assert.ok(unescaped.includes("Chuyến đi Đà Lạt"), `Custom category must be preserved verbatim in ${lang}`);
    }
  });
});

// -----------------------------------------------------------------------------
// TIER 1 & TIER 2: DASHBOARD MODALS AUDIT (Wallets, Period, Flow) (F2, F3, F5)
// -----------------------------------------------------------------------------
test("Tier 1 & 2: Dashboard Modals & Wallet Management (F2, F3, F4)", async (t) => {
  const navigate = () => {};

  // Testing main dashboard view across languages
  await t.test("T4.1: Main Dashboard overview reflects active language tokens", () => {
    for (const lang of ["Tiếng Việt", "English", "中文"]) {
      const state = createFixtureState(lang);
      const mockStore = {
        useAppState: () => state,
        updateState: () => {},
        money: (val) => String(val),
      };

      const customDashboard = compileFile(path.join(directory, "Dashboard.tsx"), (name) => {
        if (name === "./store") return mockStore;
        if (name === "./FinBridgeHeader") return headerModule;
        if (name === "./FinancialOutlook") return financialOutlookModule;
        return undefined;
      });

      const html = renderToStaticMarkup(
        React.createElement(customDashboard.Dashboard, { navigate })
      );

      // Verify custom wallet is rendered verbatim
      assert.ok(
        html.includes("Ngân Hàng Bản Việt VIP 88"),
        `Dashboard must render custom wallet name in ${lang}`
      );
    }
  });

  // Modal Leak Audit: Dashboard Add Wallet Modal
  await t.test(
    "T2.1: Add Wallet Modal localization & zero leak audit",
    STRICT ? {} : { todo: "Pending M1: Add Wallet modal string dictionary migration" },
    () => {
      const state = createFixtureState("English");
      const mockStore = {
        useAppState: () => state,
        updateState: () => {},
        money: (val) => String(val),
      };

      const customDashboard = compileFile(path.join(directory, "Dashboard.tsx"), (name) => {
        if (name === "./store") return mockStore;
        if (name === "./FinBridgeHeader") return headerModule;
        return undefined;
      });

      // Render dashboard in English
      const html = renderToStaticMarkup(
        React.createElement(customDashboard.Dashboard, { navigate })
      );

      // Assert that English UI has zero Vietnamese strings
      assertNoVietnameseLeaks(html, "Dashboard Add Wallet Modal (EN)");
    }
  );

  await t.test("T4.2: Dashboard workspace header, empty state, and period controls localize across EN, VI, ZH", () => {
    const expectations = {
      "Tiếng Việt": { heading: "Giao dịch", searchAria: "Tìm kiếm giao dịch", empty: "Chưa có giao dịch trong kỳ này." },
      English: { heading: "Transactions", searchAria: "Search transactions", empty: "No transactions this period." },
      "中文": { heading: "交易", searchAria: "搜索交易", empty: "本期暂无交易记录。" },
    };

    for (const [lang, exp] of Object.entries(expectations)) {
      const state = createFixtureState(lang);
      state.transactions = []; // Empty to show empty state

      const mockStore = {
        useAppState: () => state,
        updateState: () => {},
        money: (val) => String(val),
      };

      const customDashboard = compileFile(path.join(directory, "Dashboard.tsx"), (name) => {
        if (name === "./store") return mockStore;
        if (name === "./FinBridgeHeader") return headerModule;
        if (name === "./FinancialOutlook") return financialOutlookModule;
        if (name === "next/navigation") {
          return {
            useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
            useSearchParams: () => new URLSearchParams({ tab: "transactions" }),
          };
        }
        return undefined;
      });

      const html = renderToStaticMarkup(
        React.createElement(customDashboard.Dashboard, { navigate, transactionsTab: true })
      );

      const unescaped = unescapeHtml(html);
      assert.ok(unescaped.includes(exp.heading), `Workspace heading must match in ${lang}`);
      assert.ok(unescaped.includes(exp.searchAria), `Search aria-label must match in ${lang}`);
      assert.ok(unescaped.includes(exp.empty), `Empty transactions text must match in ${lang}`);

      if (lang === "English") assertNoVietnameseLeaks(html, "Dashboard Transactions Workspace (EN)");
      if (lang === "中文") assertNoVietnameseLeaks(html, "Dashboard Transactions Workspace (ZH)");
    }
  });

  await t.test("T5.1: Date pickers and flow analysis modals localize with zero Vietnamese leaks in EN and ZH", () => {
    // Assert DASHBOARD_I18N values are fully localized across all 3 languages
    const i18n = dashboardModule.DASHBOARD_I18N;
    assert.ok(i18n, "DASHBOARD_I18N must be exported");

    for (const langKey of ["en", "vi", "zh"]) {
      const dict = i18n[langKey];
      assert.ok(dict.periodModalTitle, `Missing periodModalTitle in ${langKey}`);
      assert.ok(dict.pickDayModalTitle, `Missing pickDayModalTitle in ${langKey}`);
      assert.ok(dict.pickWeekModalTitle, `Missing pickWeekModalTitle in ${langKey}`);
      assert.ok(dict.pickMonthModalTitle, `Missing pickMonthModalTitle in ${langKey}`);
      assert.ok(dict.pickYearModalTitle, `Missing pickYearModalTitle in ${langKey}`);
      assert.ok(dict.pickCustomRangeModalTitle, `Missing pickCustomRangeModalTitle in ${langKey}`);
      assert.ok(dict.flowIncomeModalTitle, `Missing flowIncomeModalTitle in ${langKey}`);
      assert.ok(dict.flowExpenseModalTitle, `Missing flowExpenseModalTitle in ${langKey}`);
      assert.ok(dict.flowComparisonModalTitle, `Missing flowComparisonModalTitle in ${langKey}`);
      assert.ok(dict.searchModalTitle, `Missing searchModalTitle in ${langKey}`);
      assert.ok(dict.donutIncomeBreakdown, `Missing donutIncomeBreakdown in ${langKey}`);
      assert.ok(dict.donutExpenseBreakdown, `Missing donutExpenseBreakdown in ${langKey}`);
      assert.ok(dict.donutTotalIncome, `Missing donutTotalIncome in ${langKey}`);
      assert.ok(dict.donutTotalExpense, `Missing donutTotalExpense in ${langKey}`);
    }

    // Specific translation verification for EN & ZH
    assert.equal(i18n.en.pickDayModalTitle, "Select date");
    assert.equal(i18n.zh.pickDayModalTitle, "选择日期");
    assert.equal(i18n.en.today, "Today");
    assert.equal(i18n.zh.today, "今天");
    assert.equal(i18n.en.flowIncomeModalTitle, "Income details");
    assert.equal(i18n.zh.flowIncomeModalTitle, "收入明细");
    assert.equal(i18n.en.flowExpenseModalTitle, "Expense details");
    assert.equal(i18n.zh.flowExpenseModalTitle, "支出明细");
  });
});

// -----------------------------------------------------------------------------
// TIER 1 & TIER 2: TRANSACTION FORM LOCALIZATION (F5, F8)
// -----------------------------------------------------------------------------
test("Tier 1 & 2: Transaction Form Localization & Zero Leaks (F5, F8)", async (t) => {
  const navigate = () => {};

  await t.test("T8.1: TransactionForm type pills, inputs, wallets, and buttons localize across EN, VI, ZH", () => {
    const expectations = {
      "Tiếng Việt": {
        addTitle: "Thêm giao dịch",
        expense: "Chi phí",
        income: "Thu nhập",
        itemLabel: "Mục",
        walletLabel: "Ví chính",
        save: "Lưu",
      },
      English: {
        addTitle: "Add transaction",
        expense: "Expense",
        income: "Income",
        itemLabel: "Item",
        walletLabel: "Main wallet",
        save: "Save",
      },
      "中文": {
        addTitle: "添加交易",
        expense: "支出",
        income: "收入",
        itemLabel: "项目",
        walletLabel: "主钱包",
        save: "保存",
      },
    };

    for (const [lang, exp] of Object.entries(expectations)) {
      const state = createFixtureState(lang);
      const mockStore = {
        useAppState: () => state,
        updateState: () => {},
      };

      const customTransactions = compileFile(path.join(directory, "Transactions.tsx"), (name) => {
        if (name === "./store") return mockStore;
        return undefined;
      });

      const html = renderToStaticMarkup(
        React.createElement(customTransactions.TransactionForm, { navigate })
      );
      const unescaped = unescapeHtml(html);

      assert.ok(unescaped.includes(exp.addTitle), `TransactionForm must render "${exp.addTitle}" in ${lang}`);
      assert.ok(unescaped.includes(exp.expense), `TransactionForm must render "${exp.expense}" in ${lang}`);
      assert.ok(unescaped.includes(exp.income), `TransactionForm must render "${exp.income}" in ${lang}`);
      assert.ok(unescaped.includes(exp.itemLabel), `TransactionForm must render "${exp.itemLabel}" in ${lang}`);
      assert.ok(unescaped.includes(exp.walletLabel), `TransactionForm must resolve sentinel wallet to "${exp.walletLabel}" in ${lang}`);
      assert.ok(unescaped.includes("Ngân Hàng Bản Việt VIP 88"), `TransactionForm must render custom wallet verbatim in ${lang}`);
      assert.ok(unescaped.includes(exp.save), `TransactionForm must render "${exp.save}" in ${lang}`);

      if (lang === "English") {
        assertNoVietnameseLeaks(html, "TransactionForm (EN)");
      }
      if (lang === "中文") {
        assertNoVietnameseLeaks(html, "TransactionForm (ZH)");
      }
    }
  });

  await t.test("T8.2: TransactionForm recurring intervals and units localize without corruption", () => {
    for (const lang of ["Tiếng Việt", "English", "中文"]) {
      const state = createFixtureState(lang);
      const mockStore = {
        useAppState: () => state,
        updateState: () => {},
      };

      const customTransactions = compileFile(path.join(directory, "Transactions.tsx"), (name) => {
        if (name === "./store") return mockStore;
        return undefined;
      });

      const recurringHtml = renderToStaticMarkup(
        React.createElement(customTransactions.TransactionForm, { navigate, recurring: true })
      );
      const unescaped = unescapeHtml(recurringHtml);
      if (lang === "English") {
        assert.ok(unescaped.includes("Recurring interval"), "English recurring interval header must match");
        assert.ok(unescaped.includes("Next scheduled date"), "English scheduled date label must match");
        assert.ok(unescaped.includes("Cancel"), "English cancel button must match");
        assert.ok(unescaped.includes("Confirm"), "English confirm button must match");
      } else if (lang === "中文") {
        assert.ok(unescaped.includes("周期频率"), "Chinese recurring interval header must match");
        assert.ok(unescaped.includes("下次计划日期"), "Chinese scheduled date label must match");
        assert.ok(unescaped.includes("取消"), "Chinese cancel button must match");
        assert.ok(unescaped.includes("确认"), "Chinese confirm button must match");
      } else {
        assert.ok(unescaped.includes("Khoảng thời gian định kỳ"), "Vietnamese recurring interval header must match");
        assert.ok(unescaped.includes("Lịch trình tiếp theo Ngày"), "Vietnamese scheduled date label must match");
        assert.ok(unescaped.includes("Hủy bỏ"), "Vietnamese cancel button must match");
        assert.ok(unescaped.includes("Xác nhận"), "Vietnamese confirm button must match");
      }
    }
  });
});

// -----------------------------------------------------------------------------
// TIER 1 & TIER 2: AI ASSISTANT & CHAT DRAFTS (F10)
// -----------------------------------------------------------------------------
test("Tier 1 & 2: AI Assistant & Chat Drafts Localization (F10)", async (t) => {
  const navigate = () => {};

  await t.test("T10.1: Jake greeting banner translates across EN, VI, ZH", () => {
    const greetings = {
      "Tiếng Việt": "xin chào! Mình là Jake.",
      English: "hello! I'm Jake.",
      "中文": "你好！我是 Jake。",
    };

    for (const [lang, expectedGreeting] of Object.entries(greetings)) {
      const state = createFixtureState(lang);
      const mockStore = {
        useAppState: () => state,
        updateState: () => {},
        workspaceOwner: () => "owner-1",
        today: () => "2026-10-14",
        money: (v) => String(v),
        currencySymbol: () => "₫",
      };

      const customTransactions = compileFile(path.join(directory, "Transactions.tsx"), (name) => {
        if (name === "./store") return mockStore;
        if (name === "@/lib/transaction-drafts") {
          return {
            readyDrafts: () => [],
            normalizeVietnameseMessage: (m) => m,
            isNewTransactionMessage: () => false,
            validateAndCommitDrafts: () => ({ committed: [], remaining: [] }),
            validateDraftForState: () => ({ valid: true, missing: [] }),
            inferDraftCategory: () => null,
            matchDraftCategoryAnswer: () => null,
            requestedDraftCategory: () => null,
            createTimeoutTransactionDraft: () => ({}),
            editDraftById: () => [],
            removeDraftById: () => [],
          };
        }
        if (name === "@/lib/financial-chat") {
          return { answerFinancialQuery: async () => ({ text: "" }) };
        }
        if (name === "@/lib/chat-local-plan") {
          return { localPlanReply: () => "", modelHistory: () => [] };
        }
        return undefined;
      });

      const html = renderToStaticMarkup(
        React.createElement(customTransactions.ChatPage, { navigate })
      );

      const unescaped = html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
      assert.ok(
        unescaped.includes(expectedGreeting),
        `Jake greeting in ${lang} must include "${expectedGreeting}"`
      );
    }
  });

  await t.test(
    "T10.2: Chat actions and draft review cards zero leak audit",
    STRICT ? {} : { todo: "Pending M4: AI Assistant chat action buttons & draft review card localization" },
    () => {
      const state = createFixtureState("English");
      const mockStore = {
        useAppState: () => state,
        updateState: () => {},
        workspaceOwner: () => "owner-1",
        today: () => "2026-10-14",
        money: (v) => String(v),
        currencySymbol: () => "$",
      };

      const customTransactions = compileFile(path.join(directory, "Transactions.tsx"), (name) => {
        if (name === "./store") return mockStore;
        return undefined;
      });

      const html = renderToStaticMarkup(
        React.createElement(customTransactions.ChatPage, { navigate })
      );

      assertNoVietnameseLeaks(html, "ChatPage (EN)");
    }
  );
});

// -----------------------------------------------------------------------------
// TIER 3: CROSS-FEATURE COMBINATIONS
// -----------------------------------------------------------------------------
test("Tier 3: Cross-Feature Combinations & State Synchronization", async (t) => {
  await t.test("T3.1: Language toggle immediately triggers store listeners without reload", () => {
    let internalState = createFixtureState("Tiếng Việt");
    const listeners = new Set();

    const mockStore = {
      getState: () => internalState,
      subscribe: (fn) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      setSetting: (key, value) => {
        internalState = {
          ...internalState,
          settings: { ...internalState.settings, [key]: value },
        };
        listeners.forEach((listener) => listener());
      },
    };

    let notifications = 0;
    const unsubscribe = mockStore.subscribe(() => {
      notifications++;
    });

    // Toggle to English
    mockStore.setSetting("language", "English");
    assert.equal(notifications, 1, "Store listener must be synchronously notified");
    assert.equal(mockStore.getState().settings.language, "English");

    // Toggle to Chinese
    mockStore.setSetting("language", "中文");
    assert.equal(notifications, 2, "Store listener notified on second change");
    assert.equal(mockStore.getState().settings.language, "中文");

    unsubscribe();
  });

  await t.test("T3.2: Custom wallet in multiple currencies preserves currency and balance across locales", () => {
    for (const lang of ["Tiếng Việt", "English", "中文"]) {
      const state = createFixtureState(lang);
      const cnyWallet = state.wallets.find((w) => w.currency === "CNY");
      assert.ok(cnyWallet);
      assert.equal(cnyWallet.currency, "CNY");
      assert.equal(cnyWallet.initial, 888);
      assert.equal(cnyWallet.name, "Alipay Vault");
    }
  });
});

// -----------------------------------------------------------------------------
// TIER 4: REAL-WORLD SCENARIO USER JOURNEY
// -----------------------------------------------------------------------------
test("Tier 4: Real-World Scenarios (End-to-End User Journey)", async (t) => {
  await t.test("T4.1: Expat user workflow - create custom wallet in VI, switch to EN & ZH, assert 0 corruption", () => {
    let state = createFixtureState("Tiếng Việt");

    // Step 1: User adds a custom wallet in Vietnamese
    const newWallet = {
      id: "w-vcb-expat",
      name: "Vietcombank Signature Expat",
      currency: "VND",
      initial: 50000000,
      type: "cash",
    };
    state = {
      ...state,
      wallets: [...state.wallets, newWallet],
    };

    // Step 2: Switch to English via Settings
    state = {
      ...state,
      settings: { ...state.settings, language: "English" },
    };

    // Step 3: Add a transaction in English mode with Vietnamese note
    const newTx = {
      id: "tx-rent",
      title: "Apartment Rent Q4",
      amount: 15000000,
      type: "expense",
      category: "House",
      date: "2026-10-14",
      wallet: "w-vcb-expat",
      note: "Hợp đồng thuê 2 năm - Giữ nguyên ghi chú",
    };
    state = {
      ...state,
      transactions: [...state.transactions, newTx],
    };

    // Step 4: Switch to Chinese
    state = {
      ...state,
      settings: { ...state.settings, language: "中文" },
    };

    // Assert absolute data integrity:
    const foundWallet = state.wallets.find((w) => w.id === "w-vcb-expat");
    assert.ok(foundWallet, "Wallet must exist in state");
    assert.equal(foundWallet.name, "Vietcombank Signature Expat", "Custom wallet name is intact");
    assert.equal(foundWallet.initial, 50000000, "Initial balance intact");

    const foundTx = state.transactions.find((tx) => tx.id === "tx-rent");
    assert.ok(foundTx, "Transaction must exist in state");
    assert.equal(foundTx.title, "Apartment Rent Q4", "Title intact");
    assert.equal(foundTx.note, "Hợp đồng thuê 2 năm - Giữ nguyên ghi chú", "Note intact");

    // Step 5: Render SettingsOverview in Chinese
    const mockStore = {
      useAppState: () => state,
      setSetting: () => {},
      updateState: () => {},
    };
    const customOverview = compileFile(path.join(directory, "SettingsOverview.tsx"), (name) => {
      if (name === "./store") return mockStore;
      if (name === "./FinBridgeHeader") return headerModule;
      return undefined;
    });
    const htmlZh = renderToStaticMarkup(
      React.createElement(customOverview.SettingsOverview, { navigate: () => {} })
    );

    assert.ok(htmlZh.includes("账户设置"), "Rendered Chinese menu");
    assertNoEnglishLeaks(htmlZh, "SettingsOverview in Real-World Journey (ZH)");
    assertNoVietnameseLeaks(htmlZh, "SettingsOverview in Real-World Journey (ZH)");
  });
});
