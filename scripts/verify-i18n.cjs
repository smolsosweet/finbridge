const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const ts = require("typescript");

const source = fs.readFileSync(path.resolve(__dirname, "../src/lib/i18n.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exportsObj = {};
new Function("require", "exports", "module", compiled)(require, exportsObj, { exports: exportsObj });
const {
  resolveLanguage,
  resolveWalletDisplayName,
  isSentinelWalletName,
  normalizeWalletNameForStorage,
  getLanguageLabel,
  getLocale,
  isLanguage,
} = exportsObj;

// 1. Test resolveLanguage input matrix
assert.equal(resolveLanguage("en"), "en");
assert.equal(resolveLanguage("EN"), "en");
assert.equal(resolveLanguage("en-US"), "en");
assert.equal(resolveLanguage("English"), "en");
assert.equal(resolveLanguage("english"), "en");
assert.equal(resolveLanguage("anh"), "en");

assert.equal(resolveLanguage("vi"), "vi");
assert.equal(resolveLanguage("VI"), "vi");
assert.equal(resolveLanguage("vi-VN"), "vi");
assert.equal(resolveLanguage("Tiếng Việt"), "vi");
assert.equal(resolveLanguage("tieng viet"), "vi");
assert.equal(resolveLanguage("vietnamese"), "vi");

assert.equal(resolveLanguage("zh"), "zh");
assert.equal(resolveLanguage("ZH"), "zh");
assert.equal(resolveLanguage("zh-CN"), "zh");
assert.equal(resolveLanguage("中文"), "zh");
assert.equal(resolveLanguage("chinese"), "zh");
assert.equal(resolveLanguage("trung"), "zh");

// Fallback behavior
assert.equal(resolveLanguage(undefined), "vi");
assert.equal(resolveLanguage(null), "vi");
assert.equal(resolveLanguage(""), "vi");
assert.equal(resolveLanguage("fr"), "vi");
assert.equal(resolveLanguage("fr", "en"), "en");

// 2. Type guard
assert.equal(isLanguage("en"), true);
assert.equal(isLanguage("vi"), true);
assert.equal(isLanguage("zh"), true);
assert.equal(isLanguage("fr"), false);
assert.equal(isLanguage(null), false);

// 3. Locale & Labels
assert.equal(getLanguageLabel("en"), "English");
assert.equal(getLanguageLabel("vi"), "Tiếng Việt");
assert.equal(getLanguageLabel("zh"), "中文");
assert.equal(getLocale("en"), "en-US");
assert.equal(getLocale("vi"), "vi-VN");
assert.equal(getLocale("zh"), "zh-CN");

// 4. Test Data Integrity: Sentinel wallet vs Custom wallet
assert.equal(isSentinelWalletName("."), true);
assert.equal(isSentinelWalletName("Ví chính"), true);
assert.equal(isSentinelWalletName("Main wallet"), true);
assert.equal(isSentinelWalletName("主钱包"), true);
assert.equal(isSentinelWalletName(""), true);
assert.equal(isSentinelWalletName(null), true);
assert.equal(isSentinelWalletName("Techcombank"), false);

assert.equal(resolveWalletDisplayName(".", "en"), "Main wallet");
assert.equal(resolveWalletDisplayName(".", "vi"), "Ví chính");
assert.equal(resolveWalletDisplayName(".", "zh"), "主钱包");

// Custom wallet names must remain 100% verbatim
assert.equal(resolveWalletDisplayName("Techcombank", "en"), "Techcombank");
assert.equal(resolveWalletDisplayName("Techcombank", "vi"), "Techcombank");
assert.equal(resolveWalletDisplayName("Techcombank", "zh"), "Techcombank");
assert.equal(resolveWalletDisplayName("Tiền tiêu vặt", "en"), "Tiền tiêu vặt");
assert.equal(resolveWalletDisplayName("Savings 2026", "zh"), "Savings 2026");

// 5. Test normalizeWalletNameForStorage
assert.equal(normalizeWalletNameForStorage("."), ".");
assert.equal(normalizeWalletNameForStorage("Ví chính"), ".");
assert.equal(normalizeWalletNameForStorage("Main wallet"), ".");
assert.equal(normalizeWalletNameForStorage("主钱包"), ".");
assert.equal(normalizeWalletNameForStorage(""), ".");
assert.equal(normalizeWalletNameForStorage(null), ".");
assert.equal(normalizeWalletNameForStorage("Techcombank"), "Techcombank");
assert.equal(normalizeWalletNameForStorage("  Chase Freedom  "), "Chase Freedom");

console.log("PASS: F1 Canonical Language Resolver & F13 Data Integrity Contract verified.");
