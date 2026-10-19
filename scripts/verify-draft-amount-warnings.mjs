import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { draftAmountWarnings } from "../src/lib/draft-amount-warnings.ts";
import * as format from "../src/lib/scenario-format.ts";
import { createTimeoutTransactionDraft, editDraftById, removeDraftById, validateAndCommitDrafts, validateDraftForState } from "../src/lib/transaction-drafts.ts";
import { resolveUniqueCurrencyWallet } from "../src/lib/transaction-currency.ts";

const today = "2026-10-19";
const category = "Thức ăn & Đồ uống";
const draft = (patch = {}) => ({ id: "draft", title: "Ăn sáng", type: "expense", amount: 25_000, currency: "VND", category, date: today, wallet: "vnd", needsReview: [], ...patch });
const transaction = (id, amount, patch = {}) => ({ id, amount, title: "Ăn sáng", type: "expense", category, date: "2026-10-18", wallet: "vnd", note: "", ...patch });
const state = () => ({
  wallets: [{ id: "vnd", currency: "VND", name: "Vietinbank", initial: 10_000_000, type: "cash" }, { id: "cny", currency: "CNY", name: "Alipay", initial: 10_000, type: "cash" }],
  categories: [category], categoryMeta: { [category]: { type: "expense", icon: "", children: [] } },
  transactions: [20_000, 25_000, 25_000, 30_000, 35_000].map((amount, i) => transaction(String(i), amount)),
});
const warnings = (d, s = state()) => draftAmountWarnings(d, s, today);

test("detects high and low category outliers, leaving ordinary amounts alone", () => {
  assert.deepEqual(warnings(draft()), []);
  assert.deepEqual(warnings(draft({ amount: 100_000 })), [{ kind: "unusually_high", referenceAmount: 25_000, currency: "VND", category }]);
  assert.equal(warnings(draft({ amount: 1_000 }))[0].kind, "unusually_low");
  assert.equal(warnings(draft({ amount: 5_000 }))[0].kind, "unusually_low");
  assert.deepEqual(warnings(draft({ amount: 5_001 })), []);
});

test("10 million yuan preserves CNY and warns from actual balance even without category history", () => {
  const s = state(), before = structuredClone(s);
  const message = "ăn sáng 10 triệu nhân dân tệ";
  const raw = createTimeoutTransactionDraft(message, "batch", today, s);
  const parsed = validateDraftForState({ ...raw, wallet: resolveUniqueCurrencyWallet(message, s.wallets).walletId }, s);
  assert.equal(parsed.currency, "CNY"); assert.equal(parsed.amount, 10_000_000); assert.equal(parsed.wallet, "cny");
  assert.deepEqual(warnings(parsed, s), [{ kind: "exceeds_balance", referenceAmount: 10_000, currency: "CNY", category: null }]);
  assert.deepEqual(s, before);
  const saved = validateAndCommitDrafts(s, [parsed]);
  assert.deepEqual(saved.committed, [parsed.id]);
  assert.equal(saved.state.transactions.at(-1).amount, 10_000_000);
  assert.equal(saved.state.transactions.at(-1).wallet, "cny");
  assert.equal(saved.state.wallets.find(wallet => wallet.id === saved.state.transactions.at(-1).wallet).currency, "CNY");
  assert.deepEqual(validateAndCommitDrafts(saved.state, [parsed]).committed, []);
  assert.deepEqual(warnings(draft({ wallet: "cny", currency: "CNY", amount: 10 }), s), [], "VND history must not become a CNY price assumption");
});

test("scope is exact wallet, category and transaction type, not any available history", () => {
  const s = state();
  s.wallets.push({ ...s.wallets[0], id: "other" });
  for (const patch of [{ wallet: "other" }, { category: "Shopping" }, { type: "income" }, { category: null }, { newCategory: { name: category, type: "expense" } }]) {
    assert.deepEqual(warnings(draft({ amount: 100_000, ...patch }), s), []);
  }
  assert.deepEqual(warnings(draft({ wallet: null }), s), []);
  assert.deepEqual(warnings(draft({ currency: "CNY" }), s), []);
  const changed = editDraftById([draft({ amount: 100_000 })], "draft", { currency: "CNY", amount: 10 }, s)[0];
  assert.equal(changed.wallet, "cny"); assert.deepEqual(warnings(changed, s), []);
});

test("insufficient or invalid history never establishes a category norm", () => {
  const s = state(); s.transactions.pop();
  s.transactions.push(transaction("future", 1, { date: "2026-10-20" }), transaction("old", 1, { date: "2026-07-20" }), transaction("invalid-date", 1, { date: "2026-02-30" }), transaction("refund", 1, { type: "income" }), transaction("transfer", 1, { type: "transfer" }), transaction("zero", 0), transaction("negative", -1), transaction("nan", NaN), transaction("fraction", 0.5));
  assert.deepEqual(warnings(draft({ amount: 100_000 }), s), []);
  s.transactions.push({ ...s.transactions[0] });
  assert.deepEqual(warnings(draft({ amount: 100_000 }), s), []);
});

test("date window includes day 90 and today but excludes records after a historical draft", () => {
  const s = state(); s.transactions[0].date = "2026-07-21";
  assert.equal(warnings(draft({ amount: 100_000 }), s)[0].kind, "unusually_high");
  s.transactions[0].date = "2026-07-20";
  assert.deepEqual(warnings(draft({ amount: 100_000 }), s), []);
  assert.deepEqual(warnings(draft({ amount: 100_000, date: "2026-10-17" })), []);
  assert.deepEqual(warnings(draft({ date: "2026-02-30" })), []);
});

test("balance uses actual income, refunds and same-currency transfers, with no FX assumptions", () => {
  const s = state(); s.transactions = [transaction("expense", 100), transaction("refund", 20, { type: "income" }), transaction("out", 10, { type: "transfer", targetWallet: "other" }), transaction("in", 40, { type: "transfer", wallet: "other", targetWallet: "vnd" })];
  s.wallets.push({ ...s.wallets[0], id: "other" }); s.wallets[0].initial = 100;
  assert.equal(warnings(draft({ amount: 51 }), s)[0].referenceAmount, 50);
  assert.deepEqual(warnings(draft({ amount: 50 }), s), []);
  s.transactions.push(transaction("fx", 10, { wallet: "cny", type: "transfer", targetWallet: "vnd" }));
  assert.deepEqual(warnings(draft({ amount: 51 }), s), [], "incomplete balance cannot support a definite insufficient-balance warning");
});

test("edits recompute, cancellation changes no data, and confirmation saves the original amount exactly once", () => {
  const s = state(), before = structuredClone(s), d = draft({ amount: 10_000_000 });
  assert.equal(warnings(d, s).length, 2);
  const edited = editDraftById([d], d.id, { amount: 25_000 }, s)[0];
  assert.deepEqual(warnings(edited, s), []);
  assert.deepEqual(removeDraftById([d], d.id), []); assert.deepEqual(s, before);
  const result = validateAndCommitDrafts(s, [d]);
  assert.deepEqual(result.committed, [d.id]);
  assert.equal(result.state.transactions.at(-1).amount, 10_000_000);
  assert.equal(result.state.transactions.at(-1).wallet, "vnd");
  assert.deepEqual(warnings(d, result.state), []);
  assert.deepEqual(validateAndCommitDrafts(result.state, [d]).committed, []);
});

test("CNY precision and even-sample median are respected; missing/invalid amounts are left to validation", () => {
  const s = state(); s.transactions = [10, 10, 10, 20, 20, 20].map((amount, i) => transaction(String(i), amount, { wallet: "cny" }));
  assert.equal(warnings(draft({ amount: 0.01, wallet: "cny", currency: "CNY" }), s)[0].referenceAmount, 15);
  for (const amount of [null, NaN, Infinity, 0, -1, 0.001]) assert.deepEqual(warnings(draft({ amount, wallet: "cny", currency: "CNY" }), s), []);
});

test("warning UI renders localized evidence, escapes user categories, and never replaces confirmation controls", () => {
  const require = createRequire(import.meta.url), module = { exports: {} };
  const code = ts.transpileModule(readFileSync("src/components/sites/rolly/replica/DraftAmountWarnings.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", code)(id => id.includes("scenario-format") ? format : id.endsWith(".module.css") ? { default: { warning: "warning" } } : require(id), module, module.exports);
  for (const language of ["vi", "en", "zh"]) {
    const html = renderToStaticMarkup(React.createElement(module.exports.DraftAmountWarnings, { language, warnings: [{ kind: "unusually_high", category: "<script>bad</script>", currency: "CNY", referenceAmount: 10 }] }));
    assert.match(html, /role="status"/); assert.match(html, /CNY/); assert.doesNotMatch(html, /<script>|disabled|Gemini/);
  }
  assert.equal(renderToStaticMarkup(React.createElement(module.exports.DraftAmountWarnings, { language: "vi", warnings: [] })), "");
  const source = readFileSync("src/components/sites/rolly/replica/Transactions.tsx", "utf8");
  assert.match(source, /<DraftAmountWarnings warnings=\{draftAmountWarnings\(draft, state, today\(\)\)\}/);
});
