const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const directory = path.resolve(__dirname, "../src/components/sites/rolly/replica");
const srcDir = path.resolve(__dirname, "../src");

const VI_CHAR_REGEX = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const PROHIBITED_ENGLISH_IN_VI_ZH = [
  /\bAdd new wallet\b/i,
  /\bManage wallet\b/i,
  /\bCredit Card\b/i,
  /\bSpending plan\b/i,
  /\bFixed expenses\b/i,
  /\bAccount settings\b/i,
  /\bSign out\b/i,
  /\bDelete account\b/i,
  /\bSave wallet\b/i,
  /\bTransaction history\b/i,
  /\bNo matching transactions\b/i,
  /\bReconcile actual balance\b/i,
  /\bWallet security operations\b/i,
  /\bInitial balance\b/i,
  /\bUnsettled balance\b/i,
];

const PROHIBITED_VIETNAMESE_IN_EN_ZH = [
  /Thêm ví mới/i,
  /Quản lý ví/i,
  /Tiền mặt/i,
  /Thẻ tín dụng/i,
  /Lưu ví/i,
  /Số dư hiện tại/i,
  /Số dư ban đầu/i,
  /Khớp số dư thực tế/i,
  /Thao tác bảo mật ví/i,
  /Hủy liên kết ví/i,
  /Xóa vĩnh viễn ví/i,
  /Danh mục Chi phí/i,
  /Danh mục Thu nhập/i,
  /Thông tin ví/i,
  /Quản lý danh mục/i,
];

// 1. Inspect DASHBOARD_I18N dictionary parity and leak absence
const dashSource = fs.readFileSync(path.join(directory, "Dashboard.tsx"), "utf8");
const dashCompiled = ts.transpileModule(dashSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

const dashModule = { exports: {} };
const fakeRequire = (name) => {
  if (name === "react") return React;
  if (name === "react/jsx-runtime") return require("react/jsx-runtime");
  if (name === "lucide-react") return new Proxy({}, { get: () => () => null });
  if (name.includes("i18n")) return require("../src/lib/i18n.ts");
  return {};
};
// We can use a resolver that loads i18n
const i18nSource = fs.readFileSync(path.resolve(srcDir, "lib/i18n.ts"), "utf8");
const i18nCompiled = ts.transpileModule(i18nSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const i18nExports = {};
new Function("require", "exports", "module", i18nCompiled)(fakeRequire, i18nExports, { exports: i18nExports });

const resolver = (name) => {
  if (name === "react") return React;
  if (name === "react/jsx-runtime") return require("react/jsx-runtime");
  if (name === "lucide-react") return new Proxy({}, { get: () => () => null });
  if (name === "@/lib/i18n") return i18nExports;
  if (name.includes("Categories")) return { categoryIcon: () => null, iconGroups: [] };
  if (name.includes("chartWeek")) return { calendarWeek: () => ({ start: "2026-10-12", end: "2026-10-18", days: [] }), localDateKey: () => "2026-10-14", shiftCalendarWeek: () => "2026-10-12" };
  if (name.includes("SettingsOverview")) return { WalletSettingsDirectory: () => null };
  if (name.includes("CalendarLedgerModal")) return { CalendarLedgerModal: () => null };
  if (name.includes("FinBridgeHeader")) return { FinBridgeHeader: () => null };
  if (name.includes("FinancialOutlook")) return { FinancialOutlook: () => null };
  return {};
};

new Function("require", "module", "exports", dashCompiled)(resolver, dashModule, dashModule.exports);
const { DASHBOARD_I18N } = dashModule.exports;

assert.ok(DASHBOARD_I18N, "DASHBOARD_I18N must be exported");
assert.equal(typeof DASHBOARD_I18N.vi, "object", "VI dictionary exists");
assert.equal(typeof DASHBOARD_I18N.en, "object", "EN dictionary exists");
assert.equal(typeof DASHBOARD_I18N.zh, "object", "ZH dictionary exists");

const viKeys = Object.keys(DASHBOARD_I18N.vi);
const enKeys = Object.keys(DASHBOARD_I18N.en);
const zhKeys = Object.keys(DASHBOARD_I18N.zh);
assert.equal(viKeys.length, enKeys.length, "VI and EN key counts must match");
assert.equal(viKeys.length, zhKeys.length, "VI and ZH key counts must match");

// Test EN dictionary for Vietnamese leaks
for (const [k, v] of Object.entries(DASHBOARD_I18N.en)) {
  if (typeof v === "string") {
    assert.ok(!VI_CHAR_REGEX.test(v), `EN dictionary key "${k}" has Vietnamese characters: "${v}"`);
  } else if (typeof v === "function") {
    const rendered = v("SampleWallet", 5);
    assert.ok(!VI_CHAR_REGEX.test(rendered), `EN dictionary function "${k}" output has Vietnamese: "${rendered}"`);
  } else if (typeof v === "object" && v !== null) {
    for (const [sk, sv] of Object.entries(v)) {
      if (typeof sv === "string" && sk !== "VND") { // VND label may be "VND (Vietnamese Dong)" which is English, not Vietnamese chars
        assert.ok(!VI_CHAR_REGEX.test(sv), `EN subkey "${k}.${sk}" has Vietnamese characters: "${sv}"`);
      }
    }
  }
}

// Test ZH dictionary for Vietnamese leaks
for (const [k, v] of Object.entries(DASHBOARD_I18N.zh)) {
  if (typeof v === "string") {
    assert.ok(!VI_CHAR_REGEX.test(v), `ZH dictionary key "${k}" has Vietnamese characters: "${v}"`);
  } else if (typeof v === "function") {
    const rendered = v("SampleWallet", 5);
    assert.ok(!VI_CHAR_REGEX.test(rendered), `ZH dictionary function "${k}" output has Vietnamese: "${rendered}"`);
  } else if (typeof v === "object" && v !== null) {
    for (const [sk, sv] of Object.entries(v)) {
      if (typeof sv === "string") {
        assert.ok(!VI_CHAR_REGEX.test(sv), `ZH subkey "${k}.${sk}" has Vietnamese characters: "${sv}"`);
      }
    }
  }
}

// 2. Test R1 & R2: Full SSR Render of Modal Add Wallet & Modal Manage Wallet
// Using controlled useState to force modal="addWallet" and modal="manageWallet"
function renderDashboardWithModal(lang, forcedModal, editingWalletId = "w-custom") {
  const customStore = {
    useAppState: () => ({
      wallets: [
        { id: "w-sentinel", name: ".", currency: "VND", initial: 1000000, type: "cash" },
        { id: "w-custom", name: "Ngân Hàng Bản Việt VIP 88", currency: "VND", initial: 5000000, type: "cash" },
        { id: "w-credit", name: "Thẻ Tín Dụng HSBC Platinum", currency: "USD", initial: 0, limit: 5000, type: "credit" },
      ],
      transactions: [
        { id: "t1", wallet: "w-custom", date: "2026-10-14", amount: 200000, type: "expense", category: "Ăn uống", title: "Cơm trưa", note: "Ghi chú không đổi" },
      ],
      categories: ["Ăn uống", "Lương", "Chưa được phân loại"],
      categoryMeta: {
        "Ăn uống": { type: "expense", icon: "🍔", children: [] },
        "Lương": { type: "income", icon: "💰", children: [] },
      },
      settings: { language: lang, manual: true },
    }),
    updateState: () => {},
    money: (v) => String(v),
  };

  let callIndex = 0;
  const modalReact = {
    ...React,
    useState(initial) {
      callIndex++;
      // Call 15: modal
      if (callIndex === 15) {
        return [forcedModal, () => {}];
      }
      // Call 22: editingWalletId
      if (callIndex === 22 && forcedModal === "manageWallet") {
        return [editingWalletId, () => {}];
      }
      // Call 23: manageWalletTab
      if (callIndex === 23 && forcedModal === "manageWallet") {
        return ["details", () => {}];
      }
      const val = typeof initial === "function" ? initial() : initial;
      return [val, () => {}];
    },
    useEffect: () => {},
    useRef: () => ({ current: null }),
    useCallback: (fn) => fn,
  };

  const modalResolver = (name) => {
    if (name === "react") return modalReact;
    if (name === "react/jsx-runtime") return require("react/jsx-runtime");
    if (name === "lucide-react") {
      return new Proxy({}, {
        get: (_, n) => (p) => React.createElement("span", { "data-icon": String(n), ...p }),
      });
    }
    if (name === "./store") return customStore;
    if (name === "@/lib/i18n") return i18nExports;
    if (name === "./FinBridgeHeader") return { FinBridgeHeader: () => null };
    if (name === "./FinancialOutlook") return { FinancialOutlook: () => null };
    if (name === "./CalendarLedgerModal") return { CalendarLedgerModal: () => null };
    if (name.includes("Categories")) return { categoryIcon: () => null, iconGroups: [["Nhà & Hóa đơn", ["🏠", "💡"]]] };
    if (name.includes("chartWeek")) return { calendarWeek: () => ({ start: "2026-10-12", end: "2026-10-18", days: [] }), localDateKey: () => "2026-10-14", shiftCalendarWeek: () => "2026-10-12" };
    if (name.includes("SettingsOverview")) return { WalletSettingsDirectory: () => null };
    if (name === "next/navigation") {
      return {
        useSearchParams: () => new URLSearchParams(),
        useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
      };
    }
    if (name === "./Ui") {
      return {
        Modal: ({ title, children }) => React.createElement("div", { className: "modal-root", "data-title": title },
          React.createElement("h1", null, title),
          children
        ),
        Icon: () => null,
        EmptyState: () => null,
      };
    }
    return {};
  };

  const localMod = { exports: {} };
  new Function("require", "module", "exports", dashCompiled)(modalResolver, localMod, localMod.exports);
  const DashboardComp = localMod.exports.Dashboard;

  return renderToStaticMarkup(React.createElement(DashboardComp, { navigate: () => {} }));
}

// Run test on Add Wallet Modal in VI, EN, ZH
for (const lang of ["Tiếng Việt", "English", "中文"]) {
  const fullHtml = renderDashboardWithModal(lang, "addWallet");
  assert.ok(fullHtml.includes("fb-add-wallet-form"), `Must render Add Wallet form in ${lang}`);

  // Sanitize user entities from background dashboard before checking UI leaks
  const sanitized = fullHtml
    .replace(/Ngân Hàng Bản Việt VIP 88/g, "")
    .replace(/Thẻ Tín Dụng HSBC Platinum/g, "")
    .replace(/Ghi chú không đổi/g, "");

  if (lang === "English") {
    for (const rule of PROHIBITED_VIETNAMESE_IN_EN_ZH) {
      assert.ok(!rule.test(sanitized), `Add Wallet Modal (EN) leaked Vietnamese: ${rule}`);
    }
    assert.ok(fullHtml.includes("Add New Wallet"), "Must render English title");
    assert.ok(fullHtml.includes("Save wallet"), "Must render English save button");
    assert.ok(fullHtml.includes("Wallet type"), "Must render English wallet type");
    assert.ok(fullHtml.includes("Cash"), "Must render English cash option");
    assert.ok(fullHtml.includes("Credit Card"), "Must render English credit card option");
  }

  if (lang === "Tiếng Việt") {
    assert.ok(fullHtml.includes("Thêm ví mới"), "Must render Vietnamese title");
    assert.ok(fullHtml.includes("Lưu ví"), "Must render Vietnamese save button");
    assert.ok(fullHtml.includes("Loại ví"), "Must render Vietnamese wallet type");
    assert.ok(fullHtml.includes("Tiền mặt"), "Must render Vietnamese cash option");
    assert.ok(fullHtml.includes("Thẻ tín dụng"), "Must render Vietnamese credit card option");
  }

  if (lang === "中文") {
    for (const rule of PROHIBITED_VIETNAMESE_IN_EN_ZH) {
      assert.ok(!rule.test(sanitized), `Add Wallet Modal (ZH) leaked Vietnamese: ${rule}`);
    }
    assert.ok(fullHtml.includes("添加新钱包"), "Must render Chinese title");
    assert.ok(fullHtml.includes("保存钱包"), "Must render Chinese save button");
    assert.ok(fullHtml.includes("钱包类型"), "Must render Chinese wallet type");
    assert.ok(fullHtml.includes("现金"), "Must render Chinese cash option");
    assert.ok(fullHtml.includes("信用卡"), "Must render Chinese credit card option");
  }
}

// Run test on Manage Wallet Modal in VI, EN, ZH (Details tab)
for (const lang of ["Tiếng Việt", "English", "中文"]) {
  const fullHtml = renderDashboardWithModal(lang, "manageWallet", "w-custom");
  assert.ok(fullHtml.includes("fb-manage-wallet-modal"), `Must render Manage Wallet modal in ${lang}`);

  // Custom wallet name MUST be preserved verbatim!
  assert.ok(fullHtml.includes("Ngân Hàng Bản Việt VIP 88"), `Custom wallet name must remain verbatim in ${lang}`);

  const sanitized = fullHtml
    .replace(/Ngân Hàng Bản Việt VIP 88/g, "")
    .replace(/Thẻ Tín Dụng HSBC Platinum/g, "")
    .replace(/Ghi chú không đổi/g, "");

  if (lang === "English") {
    assert.ok(fullHtml.includes("Manage wallet: Ngân Hàng Bản Việt VIP 88"), "Title must have English prefix + verbatim name");
    assert.ok(fullHtml.includes("Wallet info"), "Must show English tab title");
    assert.ok(fullHtml.includes("Manage categories"), "Must show English categories tab title");
    assert.ok(fullHtml.includes("Save changes"), "Must show English save changes button");
    assert.ok(fullHtml.includes("Wallet security operations"), "Must show English danger zone title");
    assert.ok(fullHtml.includes("Locked (transactions exist)"), "Must show English locked badge");
    assert.ok(fullHtml.includes("Reconcile actual balance"), "Must show English reconcile button");
    for (const rule of PROHIBITED_VIETNAMESE_IN_EN_ZH) {
      assert.ok(!rule.test(sanitized), `Manage Wallet Modal (EN) leaked Vietnamese: ${rule}`);
    }
  }

  if (lang === "Tiếng Việt") {
    assert.ok(fullHtml.includes("Quản lý ví: Ngân Hàng Bản Việt VIP 88"), "Title must have Vietnamese prefix");
    assert.ok(fullHtml.includes("Thông tin ví"), "Must show Vietnamese tab title");
    assert.ok(fullHtml.includes("Quản lý danh mục"), "Must show Vietnamese categories tab title");
    assert.ok(fullHtml.includes("Lưu thay đổi"), "Must show Vietnamese save changes button");
    assert.ok(fullHtml.includes("Thao tác bảo mật ví"), "Must show Vietnamese danger zone title");
    assert.ok(fullHtml.includes("Đã khóa (đã phát sinh giao dịch)"), "Must show Vietnamese locked badge");
    assert.ok(fullHtml.includes("Khớp số dư thực tế"), "Must show Vietnamese reconcile title");
  }

  if (lang === "中文") {
    assert.ok(fullHtml.includes("管理钱包: Ngân Hàng Bản Việt VIP 88"), "Title must have Chinese prefix");
    assert.ok(fullHtml.includes("钱包信息"), "Must show Chinese tab title");
    assert.ok(fullHtml.includes("分类管理"), "Must show Chinese categories tab title");
    assert.ok(fullHtml.includes("保存更改"), "Must show Chinese save changes button");
    assert.ok(fullHtml.includes("钱包安全操作"), "Must show Chinese danger zone title");
    assert.ok(fullHtml.includes("已锁定（已发生交易）"), "Must show Chinese locked badge");
    assert.ok(fullHtml.includes("核对实际余额"), "Must show Chinese reconcile title");
    for (const rule of PROHIBITED_VIETNAMESE_IN_EN_ZH) {
      assert.ok(!rule.test(sanitized), `Manage Wallet Modal (ZH) leaked Vietnamese: ${rule}`);
    }
  }
}

// Run test on Sentinel wallet "." display in Manage Wallet Modal
for (const [lang, expectedLabel] of [["Tiếng Việt", "Ví chính"], ["English", "Main wallet"], ["中文", "主钱包"]]) {
  const fullHtml = renderDashboardWithModal(lang, "manageWallet", "w-sentinel");
  assert.ok(fullHtml.includes(expectedLabel), `Sentinel wallet must display "${expectedLabel}" in ${lang}`);
  // Literal "." should NOT be visible as title
  assert.ok(!fullHtml.includes("Quản lý ví: ."), "Should not show raw dot in VI");
  assert.ok(!fullHtml.includes("Manage wallet: ."), "Should not show raw dot in EN");
  assert.ok(!fullHtml.includes("管理钱包: ."), "Should not show raw dot in ZH");
}

// 3. Test Settings.tsx WalletScreen
const settingsSource = fs.readFileSync(path.join(directory, "Settings.tsx"), "utf8");
const settingsCompiled = ts.transpileModule(settingsSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function renderWalletScreen(lang, walletId = "w-custom") {
  const customStore = {
    useAppState: () => ({
      wallets: [
        { id: "w-sentinel", name: ".", currency: "VND", initial: 1000000, type: "cash" },
        { id: "w-custom", name: "Ngân Hàng Bản Việt VIP 88", currency: "VND", initial: 5000000, type: "cash" },
      ],
      settings: { language: lang },
    }),
    updateState: () => {},
  };

  const sResolver = (name) => {
    if (name === "react") return React;
    if (name === "react/jsx-runtime") return require("react/jsx-runtime");
    if (name === "lucide-react") return new Proxy({}, { get: () => () => null });
    if (name === "./store") return customStore;
    if (name === "./FinBridgeHeader") return { FinBridgeHeader: () => null };
    if (name === "./SettingsOverview") return { settingsLanguage: (l) => l === "English" || l === "en" ? "en" : l === "中文" || l === "zh" ? "zh" : "vi" };
    return {};
  };

  const localMod = { exports: {} };
  new Function("require", "module", "exports", settingsCompiled)(sResolver, localMod, localMod.exports);
  const WalletScreenComp = localMod.exports.WalletScreen;

  return renderToStaticMarkup(React.createElement(WalletScreenComp, {
    screen: "walletDetailsEdit",
    walletId,
    navigate: () => {},
  }));
}

for (const lang of ["Tiếng Việt", "English", "中文"]) {
  const html = renderWalletScreen(lang, "w-custom");
  assert.ok(html.includes("Ngân Hàng Bản Việt VIP 88"), `WalletScreen must render custom name in ${lang}`);

  if (lang === "English") {
    assert.ok(html.includes("Edit Wallet"), "WalletScreen must render English Edit Wallet title");
    assert.ok(html.includes("Wallet name"), "WalletScreen must render English Wallet name label");
    assert.ok(html.includes("Currency"), "WalletScreen must render English Currency label");
    assert.ok(html.includes("Initial balance"), "WalletScreen must render English Initial balance label");
    assert.ok(html.includes("Save wallet"), "WalletScreen must render English Save wallet button");
    for (const rule of PROHIBITED_VIETNAMESE_IN_EN_ZH) {
      const sanitized = html.replace(/Ngân Hàng Bản Việt VIP 88/g, "");
      assert.ok(!rule.test(sanitized), `WalletScreen (EN) leaked Vietnamese: ${rule}`);
    }
  }

  if (lang === "Tiếng Việt") {
    assert.ok(html.includes("Chỉnh sửa ví"), "WalletScreen must render Vietnamese Edit Wallet title");
    assert.ok(html.includes("Tên ví"), "WalletScreen must render Vietnamese Wallet name label");
    assert.ok(html.includes("Tiền tệ"), "WalletScreen must render Vietnamese Currency label");
    assert.ok(html.includes("Số dư ban đầu"), "WalletScreen must render Vietnamese Initial balance label");
    assert.ok(html.includes("Lưu ví"), "WalletScreen must render Vietnamese Save wallet button");
  }

  if (lang === "中文") {
    assert.ok(html.includes("编辑钱包"), "WalletScreen must render Chinese Edit Wallet title");
    assert.ok(html.includes("钱包名称"), "WalletScreen must render Chinese Wallet name label");
    assert.ok(html.includes("货币"), "WalletScreen must render Chinese Currency label");
    assert.ok(html.includes("初始余额"), "WalletScreen must render Chinese Initial balance label");
    assert.ok(html.includes("保存钱包"), "WalletScreen must render Chinese Save wallet button");
    for (const rule of PROHIBITED_VIETNAMESE_IN_EN_ZH) {
      const sanitized = html.replace(/Ngân Hàng Bản Việt VIP 88/g, "");
      assert.ok(!rule.test(sanitized), `WalletScreen (ZH) leaked Vietnamese: ${rule}`);
    }
  }
}

// Test sentinel placeholder in WalletScreen
for (const [lang, expectedPlaceholder] of [["Tiếng Việt", "Ví chính"], ["English", "Main wallet"], ["中文", "主钱包"]]) {
  const html = renderWalletScreen(lang, "w-sentinel");
  assert.ok(html.includes(`placeholder="${expectedPlaceholder}"`), `WalletScreen sentinel placeholder must be "${expectedPlaceholder}" in ${lang}`);
}

// 4. Test Category Manager Tab inside Manage Wallet Modal
function renderCategoryManagerTab(lang) {
  const customStore = {
    useAppState: () => ({
      wallets: [{ id: "w-1", name: "Main", currency: "VND", initial: 0, type: "cash" }],
      transactions: [{ id: "tx-1", wallet: "w-1", date: "2026-10-14", amount: 100, type: "expense", category: "Chưa được phân loại" }],
      categories: ["Ăn uống", "Chưa được phân loại"],
      categoryMeta: {
        "Ăn uống": { type: "expense", icon: "🍔", children: [] },
        "Chưa được phân loại": { type: "expense", icon: "🏷️", children: [] },
      },
      settings: { language: lang, manual: true },
    }),
    updateState: () => {},
    money: (v) => String(v),
  };

  let callIndex = 0;
  const modalReact = {
    ...React,
    useState(initial) {
      callIndex++;
      if (callIndex === 15) return ["manageWallet", () => {}];
      if (callIndex === 22) return ["w-1", () => {}];
      if (callIndex === 23) return ["categories", () => {}];
      const val = typeof initial === "function" ? initial() : initial;
      return [val, () => {}];
    },
    useEffect: () => {},
    useRef: () => ({ current: null }),
    useCallback: (fn) => fn,
  };

  const modalResolver = (name) => {
    if (name === "react") return modalReact;
    if (name === "react/jsx-runtime") return require("react/jsx-runtime");
    if (name === "lucide-react") return new Proxy({}, { get: (_, n) => (p) => React.createElement("span", { "data-icon": String(n), ...p }) });
    if (name === "./store") return customStore;
    if (name === "@/lib/i18n") return i18nExports;
    if (name === "./FinBridgeHeader") return { FinBridgeHeader: () => null };
    if (name === "./FinancialOutlook") return { FinancialOutlook: () => null };
    if (name === "./CalendarLedgerModal") return { CalendarLedgerModal: () => null };
    if (name.includes("Categories")) return { categoryIcon: () => null, iconGroups: [["Nhà & Hóa đơn", ["🏠", "💡"]]] };
    if (name.includes("chartWeek")) return { calendarWeek: () => ({ start: "2026-10-12", end: "2026-10-18", days: [] }), localDateKey: () => "2026-10-14", shiftCalendarWeek: () => "2026-10-12" };
    if (name.includes("SettingsOverview")) return { WalletSettingsDirectory: () => null };
    if (name === "next/navigation") return { useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }) };
    if (name === "./Ui") {
      return {
        Modal: ({ title, children }) => React.createElement("div", { className: "modal-root" }, children),
        Icon: () => null,
        EmptyState: () => null,
      };
    }
    return {};
  };

  const localMod = { exports: {} };
  new Function("require", "module", "exports", dashCompiled)(modalResolver, localMod, localMod.exports);
  const DashboardComp = localMod.exports.Dashboard;
  return renderToStaticMarkup(React.createElement(DashboardComp, { navigate: () => {} }));
}

// Verify Category Manager across EN, VI, ZH
for (const lang of ["Tiếng Việt", "English", "中文"]) {
  const html = renderCategoryManagerTab(lang);
  assert.ok(html.includes("fb-cat-manage-box"), `Category Manager must render in ${lang}`);

  if (lang === "English") {
    assert.ok(html.includes("Expense Categories"), "Must show English Expense Categories tab");
    assert.ok(html.includes("Income Categories"), "Must show English Income Categories tab");
    assert.ok(html.includes("Uncategorized"), "Must localize system category 'Chưa được phân loại' to 'Uncategorized'");
    assert.ok(html.includes("Add"), "Must show English Add button");
  }

  if (lang === "Tiếng Việt") {
    assert.ok(html.includes("Danh mục Chi phí"), "Must show Vietnamese Expense Categories tab");
    assert.ok(html.includes("Danh mục Thu nhập"), "Must show Vietnamese Income Categories tab");
    assert.ok(html.includes("Chưa được phân loại"), "Must show Vietnamese category 'Chưa được phân loại'");
    assert.ok(html.includes("Thêm"), "Must show Vietnamese Add button");
  }

  if (lang === "中文") {
    assert.ok(html.includes("支出分类"), "Must show Chinese Expense Categories tab");
    assert.ok(html.includes("收入分类"), "Must show Chinese Income Categories tab");
    assert.ok(html.includes("未分类"), "Must localize system category 'Chưa được phân loại' to '未分类'");
    assert.ok(html.includes("添加"), "Must show Chinese Add button");
  }
}

// 5. Adversarial Edge Case Testing for Sentinel & Normalization
const { isSentinelWalletName, resolveWalletDisplayName, normalizeWalletNameForStorage } = i18nExports;

// Near-sentinel names MUST NOT be treated as sentinel
assert.equal(isSentinelWalletName("Main wallet 2"), false);
assert.equal(isSentinelWalletName("Ví chính của tôi"), false);
assert.equal(isSentinelWalletName("主钱包（企业）"), false);
assert.equal(isSentinelWalletName("Main"), false);
assert.equal(isSentinelWalletName("."), true);
assert.equal(isSentinelWalletName(" . "), true);
assert.equal(isSentinelWalletName("Ví chính"), true);
assert.equal(isSentinelWalletName("Main wallet"), true);
assert.equal(isSentinelWalletName("主钱包"), true);

// normalizeWalletNameForStorage
assert.equal(normalizeWalletNameForStorage("Main wallet 2"), "Main wallet 2");
assert.equal(normalizeWalletNameForStorage("Ví chính của tôi"), "Ví chính của tôi");
assert.equal(normalizeWalletNameForStorage("."), ".");
assert.equal(normalizeWalletNameForStorage(" . "), ".");
assert.equal(normalizeWalletNameForStorage("Ví chính"), ".");
assert.equal(normalizeWalletNameForStorage("Main wallet"), ".");
assert.equal(normalizeWalletNameForStorage("主钱包"), ".");
assert.equal(normalizeWalletNameForStorage("   "), ".");
assert.equal(normalizeWalletNameForStorage(null), ".");
assert.equal(normalizeWalletNameForStorage(undefined), ".");

console.log("PASS: All Milestone 1 independent adversarial and leak checks PASSED with 100% success!");
