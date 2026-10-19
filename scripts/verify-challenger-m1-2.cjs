// Challenger M1-2: Empirical Verification Script for Add Wallet, Manage Wallet & WalletScreen
// Native node:test + node:assert/strict + ts.transpileModule + react-dom/server

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { createRequire } = require("node:module");

const directory = path.resolve(__dirname, "../src/components/finbridge/workspace");
const srcDir = path.resolve(__dirname, "../src");
const localRequire = createRequire(path.join(directory, "FinBridgeApp.tsx"));
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

// Prohibited English phrases that must never leak in Vietnamese or Chinese UI
const PROHIBITED_ENGLISH_IN_VI_ZH = [
  /\bAdd New Wallet\b/i,
  /\bManage wallet\b/i,
  /\bCreate a wallet to allocate funds\b/i,
  /\bWallet type\b/i,
  /\bCredit Card\b/i,
  /\bWallet name\b/i,
  /\bInitial balance\b/i,
  /\bUnsettled balance\b/i,
  /\bCredit limit\b/i,
  /\bSave wallet\b/i,
  /\bEdit Wallet\b/i,
  /\bWallet info\b/i,
  /\bManage categories\b/i,
  /\bLocked \(transactions exist\b/i,
  /\bCurrency unit\b/i,
  /\bReconcile actual balance\b/i,
  /\bAdjust actual balance\b/i,
  /\bConfirm adjustment\b/i,
  /\bWallet security operations\b/i,
  /\bReactivate this wallet\b/i,
  /\bUnlink wallet\b/i,
  /\bPermanently delete this wallet\b/i,
  /\bExpense Categories\b/i,
  /\bIncome Categories\b/i,
  /\bChoose icon\b/i,
  /\bClose icon picker\b/i,
  /\bHousing & Bills\b/i,
  /\bFood & Dining\b/i,
  /\bTransportation & Travel\b/i,
  /\bHealth & Personal Care\b/i,
  /\bElectronics & Tech\b/i,
  /\bMoney & Work\b/i,
  /\bEntertainment & Leisure\b/i,
  /\bFamily & Education\b/i,
  /\bUncategorized\b/i,
  />\s*Hidden\s*</i,
  /\bSave changes\b/i,
];

// Prohibited Vietnamese phrases that must never leak in English or Chinese UI
const PROHIBITED_VIETNAMESE_IN_EN_ZH = [
  /Thêm ví mới/i,
  /Quản lý ví/i,
  /Tạo ví để phân bổ tài chính/i,
  /Loại ví/i,
  /Tiền mặt/i,
  /Thẻ tín dụng/i,
  /Tên ví/i,
  /Số dư ban đầu/i,
  /Số dư chưa thanh toán/i,
  /Hạn mức tín dụng/i,
  /Lưu ví/i,
  /Chỉnh sửa ví/i,
  /Thông tin ví/i,
  /Quản lý danh mục/i,
  /Đã khóa \(đã phát sinh giao dịch/i,
  /Đơn vị tiền tệ/i,
  /Khớp số dư thực tế/i,
  /Điều chỉnh số dư thực tế/i,
  /Xác nhận điều chỉnh/i,
  /Thao tác bảo mật ví/i,
  /Kích hoạt lại ví này/i,
  /Hủy liên kết ví/i,
  /Xóa vĩnh viễn ví này/i,
  /Danh mục Chi phí/i,
  /Danh mục Thu nhập/i,
  /Chọn biểu tượng/i,
  /Đóng bảng icon/i,
  /Nhà & Hóa đơn/i,
  /Đồ ăn & Đồ uống/i,
  /Giao thông vận tải & Du lịch/i,
  /Sức khỏe & Chăm sóc cá nhân/i,
  /Điện tử & Công nghệ/i,
  /Tiền bạc và công việc/i,
  /Vui chơi & Giải trí/i,
  /Gia đình & Giáo dục/i,
  /Chưa được phân loại/i,
  /Đã ẩn/i,
  /Lưu thay đổi/i,
  /Ví chính/i,
  /Ví mới/i,
];

function unescapeHtml(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanHtmlForLeakCheck(html) {
  // Strip CSS class names and aria-hidden="true" to prevent false positives on standard HTML syntax
  return unescapeHtml(html)
    .replace(/class="[^"]*"/g, "")
    .replace(/className="[^"]*"/g, "")
    .replace(/aria-hidden="[^"]*"/g, "");
}

function assertNoEnglishLeaks(html, context) {
  const text = cleanHtmlForLeakCheck(html);
  for (const regex of PROHIBITED_ENGLISH_IN_VI_ZH) {
    assert.doesNotMatch(
      text,
      regex,
      `[LEAK DETECTED] ${context} leaked English string matching ${regex}`
    );
  }
}

function assertNoVietnameseLeaks(html, context) {
  const text = cleanHtmlForLeakCheck(html);
  for (const regex of PROHIBITED_VIETNAMESE_IN_EN_ZH) {
    assert.doesNotMatch(
      text,
      regex,
      `[LEAK DETECTED] ${context} leaked Vietnamese string matching ${regex}`
    );
  }
}

function createFixtureState(language = "Tiếng Việt") {
  return {
    wallets: [
      { id: "w-custom", name: "Ngân Hàng Bản Việt VIP 88", currency: "VND", initial: 15000000, type: "cash" },
      { id: "w-main", name: ".", currency: "VND", initial: 5000000, type: "cash" },
      { id: "w-cny", name: "Alipay Vault", currency: "CNY", initial: 888, type: "cash" },
      { id: "w-archived", name: "Thẻ phụ cũ", currency: "VND", initial: 100000, type: "credit", archived: true },
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
    categories: ["Food", "Salary", "Shopping", "Chưa được phân loại", "Đồ chơi công nghệ"],
    categoryMeta: {
      Food: { type: "expense", icon: "f555", children: [] },
      Salary: { type: "income", icon: "f555", children: [] },
      Shopping: { type: "expense", icon: "f555", children: [], archived: true },
      "Chưa được phân loại": { type: "expense", icon: "f555", children: [] },
      "Đồ chơi công nghệ": { type: "expense", icon: "f555", children: [] },
    },
    goals: [],
    fixedExpenses: [],
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

// Custom hook interceptor to control Dashboard internal state
function makeDashboardReact(overrides = {}) {
  let hookIndex = 0;
  return {
    ...React,
    useState(initial) {
      const idx = hookIndex++;
      let val = typeof initial === "function" ? initial() : initial;
      if (idx in overrides) {
        val = overrides[idx];
      }
      return [val, () => {}];
    },
    useRef: (init) => ({ current: init || null }),
    useCallback: (fn) => fn,
    useEffect: () => {},
  };
}

// Hook Index Dictionary for Dashboard.tsx:
const DASHBOARD_HOOKS = {
  walletId: 0,
  period: 1,
  month: 2,
  year: 3,
  day: 4,
  from: 5,
  to: 6,
  type: 7,
  dashboardSource: 8,
  dashboardType: 9,
  dashboardCategory: 10,
  dashboardWeek: 11,
  focusedBucketKey: 12,
  search: 13,
  modal: 14,
  calendarLedgerOpen: 15,
  newWalletName: 16,
  newWalletAmount: 17,
  newWalletCurrency: 18,
  newWalletType: 19,
  newWalletLimit: 20,
  editingWalletId: 21,
  manageWalletTab: 22,
  editWalletName: 23,
  editWalletType: 24,
  editWalletCurrency: 25,
  editWalletInitial: 26,
  editWalletLimit: 27,
  isReconciling: 28,
  newActualBalance: 29,
  catType: 30,
  newCatName: 31,
  newCatIcon: 32,
  isPickingIcon: 33,
  iconPickerTarget: 34,
  editingCatName: 35,
  editCatTitle: 36,
  editCatIcon: 37,
  overviewHeight: 38,
  selectedDonutCurrency: 39,
};

function renderDashboardWithOverrides(state, overrides) {
  const mockStore = {
    useAppState: () => state,
    updateState: () => {},
    money: (v) => String(v),
  };
  const testReact = makeDashboardReact(overrides);
  const customDashboard = compileFile(path.join(directory, "Dashboard.tsx"), (name) => {
    if (name === "react") return testReact;
    if (name === "./store") return mockStore;
    if (name === "./FinBridgeHeader") {
      return { FinBridgeHeader: () => React.createElement("header", null, "FinBridgeHeader") };
    }
    if (name === "./FinancialOutlook") {
      return { FinancialOutlook: () => React.createElement("div", null, "FinancialOutlook") };
    }
    return undefined;
  }, new Map());

  return renderToStaticMarkup(
    React.createElement(customDashboard.Dashboard, { navigate: () => {} })
  );
}

function renderWalletScreen(state, walletId) {
  const mockStore = {
    useAppState: () => state,
    updateState: () => {},
    money: (v) => String(v),
  };
  const customSettings = compileFile(path.join(directory, "Settings.tsx"), (name) => {
    if (name === "./store") return mockStore;
    if (name === "./FinBridgeHeader") {
      return { FinBridgeHeader: () => React.createElement("header", null, "FinBridgeHeader") };
    }
    if (name === "./SettingsOverview") {
      return {
        SettingsOverview: () => null,
        settingsLanguage: (val) => {
          const text = String(val || "").toLowerCase();
          return /zh|chinese|trung|中文/.test(text) ? "zh" : /english|en|anh/.test(text) ? "en" : "vi";
        },
      };
    }
    return undefined;
  }, new Map());

  return renderToStaticMarkup(
    React.createElement(customSettings.WalletScreen, {
      screen: "wallet",
      walletId,
      navigate: () => {},
    })
  );
}

// -----------------------------------------------------------------------------
// SUITE 1: WALLETSCREEN (Settings.tsx)
// -----------------------------------------------------------------------------
test("Challenger M1-2: WalletScreen in Settings.tsx", async (t) => {
  const languages = ["Tiếng Việt", "English", "中文"];

  await t.test("WS.1: Add Mode (walletId undefined) localized rendering & leak audit", () => {
    for (const lang of languages) {
      const state = createFixtureState(lang);
      const html = renderWalletScreen(state, undefined);

      if (lang === "Tiếng Việt") {
        assert.ok(html.includes("Thêm ví mới"), "VI Add Title");
        assert.ok(html.includes("Tên ví"), "VI Wallet Name Label");
        assert.ok(html.includes("placeholder=\"Ví mới\""), "VI Default Name Placeholder");
        assert.ok(html.includes("Tiền tệ"), "VI Currency Label");
        assert.ok(html.includes("VND (Việt Nam Đồng)"), "VI Currency VND");
        assert.ok(html.includes("Số dư ban đầu"), "VI Initial Balance Label");
        assert.ok(html.includes("Lưu ví"), "VI Save Wallet Button");
        assert.ok(html.includes("Quay lại"), "VI Back Button");
        assertNoEnglishLeaks(html, `WalletScreen Add Mode (VI)`);
      } else if (lang === "English") {
        assert.ok(html.includes("Add New Wallet"), "EN Add Title");
        assert.ok(html.includes("Wallet name"), "EN Wallet Name Label");
        assert.ok(html.includes("placeholder=\"New wallet\""), "EN Default Name Placeholder");
        assert.ok(html.includes("Currency"), "EN Currency Label");
        assert.ok(html.includes("VND (Vietnamese Dong)"), "EN Currency VND");
        assert.ok(html.includes("Initial balance"), "EN Initial Balance Label");
        assert.ok(html.includes("Save wallet"), "EN Save Wallet Button");
        assert.ok(html.includes("Back"), "EN Back Button");
        assertNoVietnameseLeaks(html, `WalletScreen Add Mode (EN)`);
      } else if (lang === "中文") {
        assert.ok(html.includes("添加新钱包"), "ZH Add Title");
        assert.ok(html.includes("钱包名称"), "ZH Wallet Name Label");
        assert.ok(html.includes("placeholder=\"新钱包\""), "ZH Default Name Placeholder");
        assert.ok(html.includes("货币"), "ZH Currency Label");
        assert.ok(html.includes("VND (越南盾)"), "ZH Currency VND");
        assert.ok(html.includes("初始余额"), "ZH Initial Balance Label");
        assert.ok(html.includes("保存钱包"), "ZH Save Wallet Button");
        assert.ok(html.includes("返回"), "ZH Back Button");
        assertNoEnglishLeaks(html, `WalletScreen Add Mode (ZH)`);
        assertNoVietnameseLeaks(html, `WalletScreen Add Mode (ZH)`);
      }
    }
  });

  await t.test("WS.2: Edit Mode Custom Wallet preserves user name verbatim", () => {
    for (const lang of languages) {
      const state = createFixtureState(lang);
      const html = renderWalletScreen(state, "w-custom");

      // Custom name verbatim across EN, VI, ZH
      assert.ok(html.includes("value=\"Ngân Hàng Bản Việt VIP 88\""), `Verbatim custom name in ${lang}`);

      if (lang === "Tiếng Việt") {
        assert.ok(html.includes("Chỉnh sửa ví"), "VI Edit Title");
        assertNoEnglishLeaks(html, `WalletScreen Edit Custom (VI)`);
      } else if (lang === "English") {
        assert.ok(html.includes("Edit Wallet"), "EN Edit Title");
        assertNoVietnameseLeaks(html, `WalletScreen Edit Custom (EN)`);
      } else if (lang === "中文") {
        assert.ok(html.includes("编辑钱包"), "ZH Edit Title");
        assertNoEnglishLeaks(html, `WalletScreen Edit Custom (ZH)`);
        assertNoVietnameseLeaks(html, `WalletScreen Edit Custom (ZH)`);
      }
    }
  });

  await t.test("WS.3: Edit Mode Sentinel Wallet '.' never leaks literal dot and shows localized placeholder", () => {
    for (const lang of languages) {
      const state = createFixtureState(lang);
      const html = renderWalletScreen(state, "w-main");

      // Literal dot must NOT be present as an input value
      assert.ok(!html.includes('value="."'), `Literal "." must not leak in value for ${lang}`);
      assert.ok(html.includes('value=""'), `Input value should be empty so placeholder shows for ${lang}`);

      if (lang === "Tiếng Việt") {
        assert.ok(html.includes('placeholder="Ví chính"'), "VI Main Wallet Placeholder");
        assertNoEnglishLeaks(html, `WalletScreen Edit Sentinel (VI)`);
      } else if (lang === "English") {
        assert.ok(html.includes('placeholder="Main wallet"'), "EN Main Wallet Placeholder");
        assertNoVietnameseLeaks(html, `WalletScreen Edit Sentinel (EN)`);
      } else if (lang === "中文") {
        assert.ok(html.includes('placeholder="主钱包"'), "ZH Main Wallet Placeholder");
        assertNoEnglishLeaks(html, `WalletScreen Edit Sentinel (ZH)`);
        assertNoVietnameseLeaks(html, `WalletScreen Edit Sentinel (ZH)`);
      }
    }
  });
});

// -----------------------------------------------------------------------------
// SUITE 2: DASHBOARD ADD WALLET MODAL
// -----------------------------------------------------------------------------
test("Challenger M1-2: Add Wallet Modal in Dashboard.tsx", async (t) => {
  const languages = ["Tiếng Việt", "English", "中文"];

  await t.test("D.ADD.1: Cash Type modal localized rendering & zero leaks", () => {
    for (const lang of languages) {
      const state = createFixtureState(lang);
      const html = renderDashboardWithOverrides(state, {
        [DASHBOARD_HOOKS.modal]: "addWallet",
        [DASHBOARD_HOOKS.newWalletType]: "cash",
      });

      if (lang === "Tiếng Việt") {
        assert.ok(html.includes("Thêm ví mới"), "VI Modal Title");
        assert.ok(html.includes("Tạo ví để phân bổ tài chính"), "VI Desc");
        assert.ok(html.includes("Loại ví"), "VI Type Label");
        assert.ok(html.includes("Tiền mặt"), "VI Cash Type");
        assert.ok(html.includes("Thẻ tín dụng"), "VI Credit Type");
        assert.ok(html.includes("Tên ví"), "VI Name Label");
        assert.ok(html.includes("Ví tiêu dùng, Techcombank"), "VI Placeholder");
        assert.ok(html.includes("Đơn vị tiền tệ"), "VI Currency Label");
        assert.ok(html.includes("VND (Việt Nam Đồng)"), "VI Currency Option");
        assert.ok(html.includes("Số dư ban đầu"), "VI Initial Balance Label");
        assert.ok(html.includes("Hủy"), "VI Cancel Button");
        assert.ok(html.includes("Lưu ví"), "VI Save Button");
        assertNoEnglishLeaks(html, "Dashboard Add Wallet Modal Cash (VI)");
      } else if (lang === "English") {
        assert.ok(html.includes("Add New Wallet"), "EN Modal Title");
        assert.ok(html.includes("Create a wallet to allocate funds"), "EN Desc");
        assert.ok(html.includes("Wallet type"), "EN Type Label");
        assert.ok(html.includes("Cash"), "EN Cash Type");
        assert.ok(html.includes("Credit Card"), "EN Credit Type");
        assert.ok(html.includes("Wallet name"), "EN Name Label");
        assert.ok(html.includes("E.g., Daily spending, Techcombank"), "EN Placeholder");
        assert.ok(html.includes("Currency"), "EN Currency Label");
        assert.ok(html.includes("VND (Vietnamese Dong)"), "EN Currency Option");
        assert.ok(html.includes("Initial balance"), "EN Initial Balance Label");
        assert.ok(html.includes("Cancel"), "EN Cancel Button");
        assert.ok(html.includes("Save wallet"), "EN Save Button");
        assertNoVietnameseLeaks(html, "Dashboard Add Wallet Modal Cash (EN)");
      } else if (lang === "中文") {
        assert.ok(html.includes("添加新钱包"), "ZH Modal Title");
        assert.ok(html.includes("创建钱包以分配财务"), "ZH Desc");
        assert.ok(html.includes("钱包类型"), "ZH Type Label");
        assert.ok(html.includes("现金"), "ZH Cash Type");
        assert.ok(html.includes("信用卡"), "ZH Credit Type");
        assert.ok(html.includes("钱包名称"), "ZH Name Label");
        assert.ok(html.includes("例如：日常消费、招商银行"), "ZH Placeholder");
        assert.ok(html.includes("货币单位"), "ZH Currency Label");
        assert.ok(html.includes("VND (越南盾)"), "ZH Currency Option");
        assert.ok(html.includes("初始余额"), "ZH Initial Balance Label");
        assert.ok(html.includes("取消"), "ZH Cancel Button");
        assert.ok(html.includes("保存钱包"), "ZH Save Button");
        assertNoEnglishLeaks(html, "Dashboard Add Wallet Modal Cash (ZH)");
        assertNoVietnameseLeaks(html, "Dashboard Add Wallet Modal Cash (ZH)");
      }
    }
  });

  await t.test("D.ADD.2: Credit Type modal localized fields & placeholders", () => {
    for (const lang of languages) {
      const state = createFixtureState(lang);
      const html = renderDashboardWithOverrides(state, {
        [DASHBOARD_HOOKS.modal]: "addWallet",
        [DASHBOARD_HOOKS.newWalletType]: "credit",
      });

      if (lang === "Tiếng Việt") {
        assert.ok(html.includes("Số dư chưa thanh toán"), "VI Unsettled Balance Label");
        assert.ok(html.includes("Hạn mức tín dụng"), "VI Credit Limit Label");
        assert.ok(html.includes("Ví dụ: 50,000,000"), "VI Credit Limit Placeholder");
        assertNoEnglishLeaks(html, "Dashboard Add Wallet Modal Credit (VI)");
      } else if (lang === "English") {
        assert.ok(html.includes("Unsettled balance"), "EN Unsettled Balance Label");
        assert.ok(html.includes("Credit limit"), "EN Credit Limit Label");
        assert.ok(html.includes("E.g., 50,000,000"), "EN Credit Limit Placeholder");
        assertNoVietnameseLeaks(html, "Dashboard Add Wallet Modal Credit (EN)");
      } else if (lang === "中文") {
        assert.ok(html.includes("未结算余额"), "ZH Unsettled Balance Label");
        assert.ok(html.includes("信用额度"), "ZH Credit Limit Label");
        assert.ok(html.includes("例如：50,000,000"), "ZH Credit Limit Placeholder");
        assertNoEnglishLeaks(html, "Dashboard Add Wallet Modal Credit (ZH)");
        assertNoVietnameseLeaks(html, "Dashboard Add Wallet Modal Credit (ZH)");
      }
    }
  });
});

// -----------------------------------------------------------------------------
// SUITE 3: DASHBOARD MANAGE WALLET MODAL
// -----------------------------------------------------------------------------
test("Challenger M1-2: Manage Wallet Modal in Dashboard.tsx", async (t) => {
  const languages = ["Tiếng Việt", "English", "中文"];

  await t.test("D.MNG.1: Details Tab with Transactions (Locked currency & balance, Reconcile card, Danger Zone soft-delete)", () => {
    for (const lang of languages) {
      const state = createFixtureState(lang);
      // editingWalletId = w-custom (has 2 transactions)
      const html = renderDashboardWithOverrides(state, {
        [DASHBOARD_HOOKS.modal]: "manageWallet",
        [DASHBOARD_HOOKS.editingWalletId]: "w-custom",
        [DASHBOARD_HOOKS.manageWalletTab]: "details",
        [DASHBOARD_HOOKS.editWalletName]: "Ngân Hàng Bản Việt VIP 88",
        [DASHBOARD_HOOKS.editWalletCurrency]: "VND",
        [DASHBOARD_HOOKS.editWalletInitial]: "15000000",
        [DASHBOARD_HOOKS.isReconciling]: false,
      });

      // Target wallet custom name verbatim in title
      assert.ok(html.includes("Ngân Hàng Bản Việt VIP 88"), `Target wallet name in title for ${lang}`);

      if (lang === "Tiếng Việt") {
        assert.ok(html.includes("Quản lý ví:"), "VI Modal Title Prefix");
        assert.ok(html.includes("Thông tin ví"), "VI Info Tab");
        assert.ok(html.includes("Quản lý danh mục"), "VI Categories Tab");
        assert.ok(html.includes("Đã khóa (đã phát sinh giao dịch)"), "VI Locked Badge");
        assert.ok(html.includes("Không thể đổi tiền tệ khi đã có giao dịch"), "VI Locked Currency Helper");
        assert.ok(html.includes("Điều chỉnh số dư thực tế"), "VI Reconcile Highlight / Trigger");
        assert.ok(html.includes("Khớp số dư thực tế"), "VI Reconcile Title");
        assert.ok(html.includes("Số dư sổ sách hiện tại:"), "VI Current Book Prefix");
        assert.ok(html.includes("Đóng"), "VI Close Button");
        assert.ok(html.includes("Lưu thay đổi"), "VI Save Changes Button");
        assert.ok(html.includes("Thao tác bảo mật ví"), "VI Danger Zone Header");
        assert.ok(html.includes("Ví này đã ghi nhận 2 giao dịch"), "VI Danger Zone Desc Has Txs");
        assert.ok(html.includes("Hủy liên kết ví (Lưu trữ)"), "VI Unlink Button");
        assertNoEnglishLeaks(html, "Manage Wallet Details Has Txs (VI)");
      } else if (lang === "English") {
        assert.ok(html.includes("Manage wallet:"), "EN Modal Title Prefix");
        assert.ok(html.includes("Wallet info"), "EN Info Tab");
        assert.ok(html.includes("Manage categories"), "EN Categories Tab");
        assert.ok(html.includes("Locked (transactions exist)"), "EN Locked Badge");
        assert.ok(html.includes("Currency cannot be changed once transactions exist"), "EN Locked Currency Helper");
        assert.ok(html.includes("Reconcile actual balance"), "EN Reconcile Highlight / Title");
        assert.ok(html.includes("Adjust actual balance"), "EN Reconcile Trigger");
        assert.ok(html.includes("Current book balance:"), "EN Current Book Prefix");
        assert.ok(html.includes("Close"), "EN Close Button");
        assert.ok(html.includes("Save changes"), "EN Save Changes Button");
        assert.ok(html.includes("Wallet security operations"), "EN Danger Zone Header");
        assert.ok(html.includes("This wallet has recorded 2 transactions"), "EN Danger Zone Desc Has Txs");
        assert.ok(html.includes("Unlink wallet (Archive)"), "EN Unlink Button");
        assertNoVietnameseLeaks(html, "Manage Wallet Details Has Txs (EN)");
      } else if (lang === "中文") {
        assert.ok(html.includes("管理钱包:"), "ZH Modal Title Prefix");
        assert.ok(html.includes("钱包信息"), "ZH Info Tab");
        assert.ok(html.includes("分类管理"), "ZH Categories Tab");
        assert.ok(html.includes("已锁定（已发生交易）"), "ZH Locked Badge");
        assert.ok(html.includes("已有交易记录时无法更改货币"), "ZH Locked Currency Helper");
        assert.ok(html.includes("核对实际余额"), "ZH Reconcile Highlight / Title");
        assert.ok(html.includes("调整实际余额"), "ZH Reconcile Trigger");
        assert.ok(html.includes("当前账面余额："), "ZH Current Book Prefix");
        assert.ok(html.includes("关闭"), "ZH Close Button");
        assert.ok(html.includes("保存更改"), "ZH Save Changes Button");
        assert.ok(html.includes("钱包安全操作"), "ZH Danger Zone Header");
        assert.ok(html.includes("此钱包已记录 2 笔交易"), "ZH Danger Zone Desc Has Txs");
        assert.ok(html.includes("解绑钱包（归档）"), "ZH Unlink Button");
        assertNoEnglishLeaks(html, "Manage Wallet Details Has Txs (ZH)");
        assertNoVietnameseLeaks(html, "Manage Wallet Details Has Txs (ZH)");
      }
    }
  });

  await t.test("D.MNG.2: Details Tab with NO Transactions (Unlocked initial balance, Permanent Delete)", () => {
    for (const lang of languages) {
      const state = createFixtureState(lang);
      // w-cny has 0 transactions
      const html = renderDashboardWithOverrides(state, {
        [DASHBOARD_HOOKS.modal]: "manageWallet",
        [DASHBOARD_HOOKS.editingWalletId]: "w-cny",
        [DASHBOARD_HOOKS.manageWalletTab]: "details",
        [DASHBOARD_HOOKS.editWalletName]: "Alipay Vault",
        [DASHBOARD_HOOKS.editWalletCurrency]: "CNY",
        [DASHBOARD_HOOKS.editWalletInitial]: "888",
        [DASHBOARD_HOOKS.isReconciling]: false,
      });

      if (lang === "Tiếng Việt") {
        assert.ok(html.includes("Ví chưa có giao dịch nào, bạn có thể tự do điều chỉnh"), "VI Unlocked Helper");
        assert.ok(html.includes("Ví này chưa có giao dịch nào. Bạn có thể xóa vĩnh viễn"), "VI Danger Zone No Txs");
        assert.ok(html.includes("Xóa vĩnh viễn ví này"), "VI Permanent Delete Button");
        assertNoEnglishLeaks(html, "Manage Wallet Details No Txs (VI)");
      } else if (lang === "English") {
        assert.ok(html.includes("No transactions in this wallet yet; you can freely adjust"), "EN Unlocked Helper");
        assert.ok(html.includes("This wallet has no transactions. You can permanently delete"), "EN Danger Zone No Txs");
        assert.ok(html.includes("Permanently delete this wallet"), "EN Permanent Delete Button");
        assertNoVietnameseLeaks(html, "Manage Wallet Details No Txs (EN)");
      } else if (lang === "中文") {
        assert.ok(html.includes("此钱包尚无交易记录，您可以自由调整初始余额"), "ZH Unlocked Helper");
        assert.ok(html.includes("此钱包尚无交易记录。您可以将其从系统中永久删除"), "ZH Danger Zone No Txs");
        assert.ok(html.includes("永久删除此钱包"), "ZH Permanent Delete Button");
        assertNoEnglishLeaks(html, "Manage Wallet Details No Txs (ZH)");
        assertNoVietnameseLeaks(html, "Manage Wallet Details No Txs (ZH)");
      }
    }
  });

  await t.test("D.MNG.3: Details Tab with Archived Wallet (Banner & Reactivate Button)", () => {
    for (const lang of languages) {
      const state = createFixtureState(lang);
      // w-archived is archived: true
      const html = renderDashboardWithOverrides(state, {
        [DASHBOARD_HOOKS.modal]: "manageWallet",
        [DASHBOARD_HOOKS.editingWalletId]: "w-archived",
        [DASHBOARD_HOOKS.manageWalletTab]: "details",
        [DASHBOARD_HOOKS.editWalletName]: "Thẻ phụ cũ",
        [DASHBOARD_HOOKS.editWalletType]: "credit",
      });

      if (lang === "Tiếng Việt") {
        assert.ok(html.includes("Ví đang ở trạng thái hủy liên kết (đã lưu trữ)"), "VI Archived Banner Title");
        assert.ok(html.includes("Kích hoạt lại ví này"), "VI Reactivate Button");
        assertNoEnglishLeaks(html, "Manage Wallet Archived (VI)");
      } else if (lang === "English") {
        assert.ok(html.includes("This wallet is currently unlinked (archived)"), "EN Archived Banner Title");
        assert.ok(html.includes("Reactivate this wallet"), "EN Reactivate Button");
        assertNoVietnameseLeaks(html, "Manage Wallet Archived (EN)");
      } else if (lang === "中文") {
        assert.ok(html.includes("此钱包处于已解绑状态（已归档）"), "ZH Archived Banner Title");
        assert.ok(html.includes("重新激活此钱包"), "ZH Reactivate Button");
        assertNoEnglishLeaks(html, "Manage Wallet Archived (ZH)");
        assertNoVietnameseLeaks(html, "Manage Wallet Archived (ZH)");
      }
    }
  });

  await t.test("D.MNG.4: Details Tab Sentinel Wallet '.' resolves to localized name in header", () => {
    for (const lang of languages) {
      const state = createFixtureState(lang);
      const sentinelLabel = lang === "Tiếng Việt" ? "Ví chính" : lang === "English" ? "Main wallet" : "主钱包";
      const html = renderDashboardWithOverrides(state, {
        [DASHBOARD_HOOKS.modal]: "manageWallet",
        [DASHBOARD_HOOKS.editingWalletId]: "w-main",
        [DASHBOARD_HOOKS.manageWalletTab]: "details",
        [DASHBOARD_HOOKS.editWalletName]: sentinelLabel,
      });

      assert.ok(html.includes(sentinelLabel), `Sentinel label "${sentinelLabel}" rendered in ${lang}`);
      assert.ok(!html.includes('value="."'), `Literal "." must not leak in value for ${lang}`);

      if (lang === "Tiếng Việt") assertNoEnglishLeaks(html, "Manage Wallet Sentinel (VI)");
      if (lang === "English") assertNoVietnameseLeaks(html, "Manage Wallet Sentinel (EN)");
      if (lang === "中文") {
        assertNoEnglishLeaks(html, "Manage Wallet Sentinel (ZH)");
        assertNoVietnameseLeaks(html, "Manage Wallet Sentinel (ZH)");
      }
    }
  });

  await t.test("D.MNG.5: Reconcile Form Open (Actual balance label, placeholder, confirm button)", () => {
    for (const lang of languages) {
      const state = createFixtureState(lang);
      const html = renderDashboardWithOverrides(state, {
        [DASHBOARD_HOOKS.modal]: "manageWallet",
        [DASHBOARD_HOOKS.editingWalletId]: "w-custom",
        [DASHBOARD_HOOKS.manageWalletTab]: "details",
        [DASHBOARD_HOOKS.isReconciling]: true,
        [DASHBOARD_HOOKS.newActualBalance]: "16000000",
      });

      if (lang === "Tiếng Việt") {
        assert.ok(html.includes("Số dư thực tế trong ví / tài khoản ngân hàng (VND)"), "VI Reconcile Actual Label");
        assert.ok(html.includes("Nhập số dư thực tế hiện tại"), "VI Reconcile Actual Placeholder");
        assert.ok(html.includes("Xác nhận điều chỉnh"), "VI Confirm Adjustment Button");
        assertNoEnglishLeaks(html, "Manage Wallet Reconcile Form (VI)");
      } else if (lang === "English") {
        assert.ok(html.includes("Actual balance in wallet / bank account (VND)"), "EN Reconcile Actual Label");
        assert.ok(html.includes("Enter current actual balance"), "EN Reconcile Actual Placeholder");
        assert.ok(html.includes("Confirm adjustment"), "EN Confirm Adjustment Button");
        assertNoVietnameseLeaks(html, "Manage Wallet Reconcile Form (EN)");
      } else if (lang === "中文") {
        assert.ok(html.includes("钱包/银行账户中的实际余额 (VND)"), "ZH Reconcile Actual Label");
        assert.ok(html.includes("输入当前实际余额"), "ZH Reconcile Actual Placeholder");
        assert.ok(html.includes("确认调整"), "ZH Confirm Adjustment Button");
        assertNoEnglishLeaks(html, "Manage Wallet Reconcile Form (ZH)");
        assertNoVietnameseLeaks(html, "Manage Wallet Reconcile Form (ZH)");
      }
    }
  });

  await t.test("D.MNG.6: Category Manager Tab (Type toggles, add form, uncategorized label, tooltips)", () => {
    for (const lang of languages) {
      const state = createFixtureState(lang);
      const html = renderDashboardWithOverrides(state, {
        [DASHBOARD_HOOKS.modal]: "manageWallet",
        [DASHBOARD_HOOKS.editingWalletId]: "w-custom",
        [DASHBOARD_HOOKS.manageWalletTab]: "categories",
        [DASHBOARD_HOOKS.catType]: "expense",
      });

      if (lang === "Tiếng Việt") {
        assert.ok(html.includes("Danh mục Chi phí"), "VI Cat Tab Expense");
        assert.ok(html.includes("Danh mục Thu nhập"), "VI Cat Tab Income");
        assert.ok(html.includes("Nhập tên danh mục chi tiêu mới..."), "VI Cat Input Placeholder");
        assert.ok(html.includes("Thêm"), "VI Cat Add Button");
        assert.ok(html.includes("Chưa được phân loại"), "VI Uncategorized Category");
        assert.ok(html.includes("Đã ẩn"), "VI Archived Category Badge");
        assert.ok(html.includes("Khôi phục"), "VI Restore Button Text");
        assertNoEnglishLeaks(html, "Manage Wallet Categories Tab (VI)");
      } else if (lang === "English") {
        assert.ok(html.includes("Expense Categories"), "EN Cat Tab Expense");
        assert.ok(html.includes("Income Categories"), "EN Cat Tab Income");
        assert.ok(html.includes("Enter new expense category name..."), "EN Cat Input Placeholder");
        assert.ok(html.includes("Add"), "EN Cat Add Button");
        assert.ok(html.includes("Uncategorized"), "EN Uncategorized Category");
        assert.ok(html.includes("Hidden"), "EN Archived Category Badge");
        assert.ok(html.includes("Restore"), "EN Restore Button Text");
        assertNoVietnameseLeaks(html, "Manage Wallet Categories Tab (EN)");
      } else if (lang === "中文") {
        assert.ok(html.includes("支出分类"), "ZH Cat Tab Expense");
        assert.ok(html.includes("收入分类"), "ZH Cat Tab Income");
        assert.ok(html.includes("输入新支出分类名称..."), "ZH Cat Input Placeholder");
        assert.ok(html.includes("添加"), "ZH Cat Add Button");
        assert.ok(html.includes("未分类"), "ZH Uncategorized Category");
        assert.ok(html.includes("已隐藏"), "ZH Archived Category Badge");
        assert.ok(html.includes("恢复"), "ZH Restore Button Text");
        assertNoEnglishLeaks(html, "Manage Wallet Categories Tab (ZH)");
        assertNoVietnameseLeaks(html, "Manage Wallet Categories Tab (ZH)");
      }
    }
  });

  await t.test("D.MNG.7: Category Manager Tab — Inline Edit Category", () => {
    for (const lang of languages) {
      const state = createFixtureState(lang);
      const html = renderDashboardWithOverrides(state, {
        [DASHBOARD_HOOKS.modal]: "manageWallet",
        [DASHBOARD_HOOKS.editingWalletId]: "w-custom",
        [DASHBOARD_HOOKS.manageWalletTab]: "categories",
        [DASHBOARD_HOOKS.catType]: "expense",
        [DASHBOARD_HOOKS.editingCatName]: "Food",
        [DASHBOARD_HOOKS.editCatTitle]: "Food",
      });

      if (lang === "Tiếng Việt") {
        assert.ok(html.includes("title=\"Chọn biểu tượng\""), "VI Edit Icon Title");
        assert.ok(html.includes("title=\"Lưu thay đổi\""), "VI Save Edit Title");
        assert.ok(html.includes("title=\"Hủy\""), "VI Cancel Edit Title");
        assertNoEnglishLeaks(html, "Manage Wallet Inline Edit Cat (VI)");
      } else if (lang === "English") {
        assert.ok(html.includes("title=\"Choose icon\""), "EN Edit Icon Title");
        assert.ok(html.includes("title=\"Save changes\""), "EN Save Edit Title");
        assert.ok(html.includes("title=\"Cancel\""), "EN Cancel Edit Title");
        assertNoVietnameseLeaks(html, "Manage Wallet Inline Edit Cat (EN)");
      } else if (lang === "中文") {
        assert.ok(html.includes("title=\"选择图标\""), "ZH Edit Icon Title");
        assert.ok(html.includes("title=\"保存更改\""), "ZH Save Edit Title");
        assert.ok(html.includes("title=\"取消\""), "ZH Cancel Edit Title");
        assertNoEnglishLeaks(html, "Manage Wallet Inline Edit Cat (ZH)");
        assertNoVietnameseLeaks(html, "Manage Wallet Inline Edit Cat (ZH)");
      }
    }
  });

  await t.test("D.MNG.8: Category Manager Tab — Emoji Picker Modal & Group Names", () => {
    for (const lang of languages) {
      const state = createFixtureState(lang);
      const html = renderDashboardWithOverrides(state, {
        [DASHBOARD_HOOKS.modal]: "manageWallet",
        [DASHBOARD_HOOKS.editingWalletId]: "w-custom",
        [DASHBOARD_HOOKS.manageWalletTab]: "categories",
        [DASHBOARD_HOOKS.catType]: "expense",
        [DASHBOARD_HOOKS.isPickingIcon]: true,
        [DASHBOARD_HOOKS.iconPickerTarget]: "new",
      });

      if (lang === "Tiếng Việt") {
        assert.ok(html.includes("Chọn biểu tượng cho danh mục mới"), "VI Emoji Picker Header");
        assert.ok(html.includes("aria-label=\"Đóng bảng icon\""), "VI Close Picker Aria");
        assert.ok(html.includes("Nhà &amp; Hóa đơn") || html.includes("Nhà & Hóa đơn"), "VI Group Housing");
        assert.ok(html.includes("Đồ ăn &amp; Đồ uống") || html.includes("Đồ ăn & Đồ uống"), "VI Group Food");
        assert.ok(html.includes("Giao thông vận tải &amp; Du lịch") || html.includes("Giao thông vận tải & Du lịch"), "VI Group Transport");
        assert.ok(html.includes("Sức khỏe &amp; Chăm sóc cá nhân") || html.includes("Sức khỏe & Chăm sóc cá nhân"), "VI Group Health");
        assert.ok(html.includes("Điện tử &amp; Công nghệ") || html.includes("Điện tử & Công nghệ"), "VI Group Tech");
        assert.ok(html.includes("Tiền bạc và công việc"), "VI Group Money");
        assert.ok(html.includes("Vui chơi &amp; Giải trí") || html.includes("Vui chơi & Giải trí"), "VI Group Fun");
        assert.ok(html.includes("Gia đình &amp; Giáo dục") || html.includes("Gia đình & Giáo dục"), "VI Group Family");
        assert.ok(html.includes("Khác"), "VI Group Other");
        assertNoEnglishLeaks(html, "Manage Wallet Emoji Picker (VI)");
      } else if (lang === "English") {
        assert.ok(html.includes("Choose icon for new category"), "EN Emoji Picker Header");
        assert.ok(html.includes("aria-label=\"Close icon picker\""), "EN Close Picker Aria");
        assert.ok(html.includes("Housing &amp; Bills") || html.includes("Housing & Bills"), "EN Group Housing");
        assert.ok(html.includes("Food &amp; Dining") || html.includes("Food & Dining"), "EN Group Food");
        assert.ok(html.includes("Transportation &amp; Travel") || html.includes("Transportation & Travel"), "EN Group Transport");
        assert.ok(html.includes("Health &amp; Personal Care") || html.includes("Health & Personal Care"), "EN Group Health");
        assert.ok(html.includes("Electronics &amp; Tech") || html.includes("Electronics & Tech"), "EN Group Tech");
        assert.ok(html.includes("Money &amp; Work") || html.includes("Money & Work"), "EN Group Money");
        assert.ok(html.includes("Entertainment &amp; Leisure") || html.includes("Entertainment & Leisure"), "EN Group Fun");
        assert.ok(html.includes("Family &amp; Education") || html.includes("Family & Education"), "EN Group Family");
        assert.ok(html.includes("Other"), "EN Group Other");
        assertNoVietnameseLeaks(html, "Manage Wallet Emoji Picker (EN)");
      } else if (lang === "中文") {
        assert.ok(html.includes("为新分类选择图标"), "ZH Emoji Picker Header");
        assert.ok(html.includes("aria-label=\"关闭图标面板\""), "ZH Close Picker Aria");
        assert.ok(html.includes("住房与账单"), "ZH Group Housing");
        assert.ok(html.includes("餐饮美食"), "ZH Group Food");
        assert.ok(html.includes("交通出行与旅游"), "ZH Group Transport");
        assert.ok(html.includes("健康与个人护理"), "ZH Group Health");
        assert.ok(html.includes("数码与科技"), "ZH Group Tech");
        assert.ok(html.includes("财务与工作"), "ZH Group Money");
        assert.ok(html.includes("休闲与娱乐"), "ZH Group Fun");
        assert.ok(html.includes("家庭与教育"), "ZH Group Family");
        assert.ok(html.includes("其他"), "ZH Group Other");
        assertNoEnglishLeaks(html, "Manage Wallet Emoji Picker (ZH)");
        assertNoVietnameseLeaks(html, "Manage Wallet Emoji Picker (ZH)");
      }
    }
  });
});

// -----------------------------------------------------------------------------
// SUITE 4: ADVERSARIAL STRESS TESTING (Boundary, Extreme Values & Dynamic Switching)
// -----------------------------------------------------------------------------
test("Challenger M1-2: Adversarial Boundary & Stress Harness", async (t) => {
  const languages = ["Tiếng Việt", "English", "中文"];

  await t.test("ADV.1: XSS and extreme length in custom wallet names", () => {
    const maliciousName = "<script>alert('xss')</script> & 'quoted'";
    const veryLongName = "BankOfFinBridge_".repeat(25);

    for (const name of [maliciousName, veryLongName]) {
      for (const lang of languages) {
        const state = createFixtureState(lang);
        state.wallets.push({
          id: "w-adv",
          name,
          currency: "USD",
          initial: 1000,
          type: "cash",
        });

        // Test in WalletScreen Edit Mode
        const wsHtml = renderWalletScreen(state, "w-adv");
        assert.ok(unescapeHtml(wsHtml).includes(name.slice(0, 20)), `WalletScreen preserves extreme name in ${lang}`);

        // Test in Manage Wallet Modal
        const mngHtml = renderDashboardWithOverrides(state, {
          [DASHBOARD_HOOKS.modal]: "manageWallet",
          [DASHBOARD_HOOKS.editingWalletId]: "w-adv",
          [DASHBOARD_HOOKS.manageWalletTab]: "details",
          [DASHBOARD_HOOKS.editWalletName]: name,
        });
        assert.ok(unescapeHtml(mngHtml).includes(name.slice(0, 20)), `Manage Wallet preserves extreme name in ${lang}`);
      }
    }
  });

  await t.test("ADV.2: Standard sentinel names ('.', ' . ', '', null, undefined) resolve safely to localized defaults", () => {
    const validSentinels = [".", " . ", "", null, undefined];
    for (const raw of validSentinels) {
      for (const lang of languages) {
        const state = createFixtureState(lang);
        state.wallets[1].name = raw; // sentinel slot

        const html = renderWalletScreen(state, "w-main");
        const expectedPlaceholder = lang === "Tiếng Việt" ? "Ví chính" : lang === "English" ? "Main wallet" : "主钱包";
        assert.ok(
          html.includes(`placeholder="${expectedPlaceholder}"`),
          `Sentinel "${raw}" must fall back to "${expectedPlaceholder}" in ${lang}`
        );
      }
    }
  });

  await t.test("ADV.2B: Whitespace-only sentinel edge case ('   ') analysis", () => {
    // White-box edge case exploration:
    // When name is "   " (whitespace without dots/letters), isSentinelWalletName returns false
    // because `if (!name)` checks truthiness before trimming.
    // However, on save, normalizeWalletNameForStorage("   ") successfully normalizes to "."
    const { isSentinelWalletName, normalizeWalletNameForStorage } = compileFile(path.join(srcDir, "lib/i18n.ts"));
    assert.equal(normalizeWalletNameForStorage("   "), ".", "normalizeWalletNameForStorage trims before check and saves canonical '.'");
    assert.equal(isSentinelWalletName("."), true, "Canonical '.' is sentinel");
    assert.equal(isSentinelWalletName(" . "), true, "Trimmed ' . ' is sentinel");
    assert.equal(isSentinelWalletName(""), true, "Empty string is sentinel");
  });

  await t.test("ADV.3: Dynamic runtime language switching across EN -> VI -> ZH -> EN", () => {
    let state = createFixtureState("English");
    let htmlEn = renderDashboardWithOverrides(state, {
      [DASHBOARD_HOOKS.modal]: "addWallet",
      [DASHBOARD_HOOKS.newWalletType]: "cash",
    });
    assert.ok(htmlEn.includes("Add New Wallet"));
    assertNoVietnameseLeaks(htmlEn, "Dynamic Switch Step 1 (EN)");

    // Switch to Vietnamese
    state = { ...state, settings: { ...state.settings, language: "Tiếng Việt" } };
    let htmlVi = renderDashboardWithOverrides(state, {
      [DASHBOARD_HOOKS.modal]: "addWallet",
      [DASHBOARD_HOOKS.newWalletType]: "cash",
    });
    assert.ok(htmlVi.includes("Thêm ví mới"));
    assertNoEnglishLeaks(htmlVi, "Dynamic Switch Step 2 (VI)");

    // Switch to Chinese
    state = { ...state, settings: { ...state.settings, language: "中文" } };
    let htmlZh = renderDashboardWithOverrides(state, {
      [DASHBOARD_HOOKS.modal]: "addWallet",
      [DASHBOARD_HOOKS.newWalletType]: "cash",
    });
    assert.ok(htmlZh.includes("添加新钱包"));
    assertNoEnglishLeaks(htmlZh, "Dynamic Switch Step 3 (ZH)");
    assertNoVietnameseLeaks(htmlZh, "Dynamic Switch Step 3 (ZH)");

    // Switch back to English
    state = { ...state, settings: { ...state.settings, language: "English" } };
    let htmlEn2 = renderDashboardWithOverrides(state, {
      [DASHBOARD_HOOKS.modal]: "addWallet",
      [DASHBOARD_HOOKS.newWalletType]: "cash",
    });
    assert.ok(htmlEn2.includes("Add New Wallet"));
    assertNoVietnameseLeaks(htmlEn2, "Dynamic Switch Step 4 (EN)");
  });

  await t.test("ADV.4: Confirmation dialog and alert template dictionaries verification", () => {
    const dashboardModule = compileFile(path.join(directory, "Dashboard.tsx"));
    const DASHBOARD_I18N = dashboardModule.DASHBOARD_I18N;

    for (const lang of ["en", "vi", "zh"]) {
      const dict = DASHBOARD_I18N[lang];
      assert.ok(dict, `Dictionary for ${lang} must exist`);

      // 1. Min one active wallet alert
      assert.ok(typeof dict.minOneActiveWalletAlert === "string");
      // 2. Delete wallet confirm
      const delConfirm = dict.deleteWalletConfirmNoTxs("TestWallet");
      assert.ok(delConfirm.includes("TestWallet"));
      // 3. Archive wallet confirm
      const arcConfirm = dict.archiveWalletConfirmHasTxs("TestWallet", 5);
      assert.ok(arcConfirm.includes("TestWallet") && arcConfirm.includes("5"));
      // 4. Cat name exists alert
      assert.ok(typeof dict.catNameExistsAlert === "string");
      // 5. System default alert
      assert.ok(typeof dict.catCannotDeleteSystemDefaultAlert === "string");
      // 6. Reactivate confirm
      assert.ok(dict.catReactivateConfirm("Food").includes("Food"));
      // 7. Delete confirm no txs
      assert.ok(dict.catDeleteConfirmNoTxs("Food").includes("Food"));
      // 8. Soft delete confirm has txs
      const softConfirm = dict.catSoftDeleteConfirmHasTxs("Food", 10);
      assert.ok(softConfirm.includes("Food") && softConfirm.includes("10"));
      // 9. Reassign delete confirm
      const reassignConfirm = dict.catReassignDeleteConfirm("Food", 10);
      assert.ok(reassignConfirm.includes("Food") && reassignConfirm.includes("10"));

      // Zero leak audit on dialog templates
      const combinedText = [
        dict.minOneActiveWalletAlert,
        delConfirm,
        arcConfirm,
        dict.catNameExistsAlert,
        dict.catCannotDeleteSystemDefaultAlert,
        dict.catReactivateConfirm("Food"),
        dict.catDeleteConfirmNoTxs("Food"),
        softConfirm,
        reassignConfirm,
      ].join(" ");

      if (lang === "vi") {
        assertNoEnglishLeaks(combinedText, "Dialogs (VI)");
      } else if (lang === "en") {
        assertNoVietnameseLeaks(combinedText, "Dialogs (EN)");
      } else if (lang === "zh") {
        assertNoEnglishLeaks(combinedText, "Dialogs (ZH)");
        assertNoVietnameseLeaks(combinedText, "Dialogs (ZH)");
      }
    }
  });
});

module.exports = {
  renderDashboardWithOverrides,
  renderWalletScreen,
};

