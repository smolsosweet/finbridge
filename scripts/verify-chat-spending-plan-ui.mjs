import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as outlook from "../src/lib/financial-outlook.ts";
import * as drafts from "../src/lib/transaction-drafts.ts";
import * as i18n from "../src/lib/i18n.ts";

// Render the actual component with actual calculations. Only CSS module class
// names are replaced; this does not emulate browser layout or live Gemini.
const require = createRequire(import.meta.url), module = { exports: {} };
const code = ts.transpileModule(readFileSync("src/components/sites/rolly/replica/ChatSpendingPlan.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function("require", "module", "exports", code)(name => {
  if (name === "@/lib/financial-outlook") return outlook;
  if (name === "@/lib/transaction-drafts") return drafts;
  if (name === "@/lib/i18n") return i18n;
  if (name.endsWith(".module.css")) return { default: new Proxy({}, { get: (_, key) => String(key) }) };
  return require(name);
}, module, module.exports);
const { ChatSpendingPlan } = module.exports;
const state = language => ({ wallets: [{ id: "vnd", name: "Cash", currency: "VND", initial: 1000000, type: "cash" }], transactions: [{ id: "food", title: "Lunch", amount: 190000, type: "expense", category: "Food", wallet: "vnd", date: "2026-10-19" }], goals: [], fixedExpenses: [{ id: "rent", title: "Rent", amount: 200000, category: "Food", walletId: "vnd", budgetId: "", dueDate: "2026-10-20", recurrence: "once", active: true }], categories: ["Food"], categoryMeta: { Food: { type: "expense", children: [] } }, settings: { language, reserveByWallet: '{"vnd":100000}' }, recurring: [], rules: [] });

test("real plan renders requested section order, explicit currencies and expandable sources in all app languages", () => {
  for (const [lang, headings] of [["vi", ["Tổng quan ngân sách", "Khoản cần thanh toán", "Dự báo cuối tháng", "Gợi ý hành động"]], ["en", ["Budget overview", "Payments due", "Month-end forecast", "Next steps"]], ["zh", ["预算概览", "待付款项", "月末预测", "行动建议"]]]) {
    const html = renderToStaticMarkup(React.createElement(ChatSpendingPlan, { state: state(lang), asOf: "2026-10-19", options: {} }));
    let previous = -1; for (const heading of headings) { const index = html.indexOf(heading); assert.ok(index > previous, heading); previous = index; }
    assert.match(html, /VND/); assert.match(html, /<details>/); assert.match(html, /610[.,]000/); assert.match(html, /490[.,]000/); assert.doesNotMatch(html, /NaN|undefined|Infinity/);
  }
});

test("unknown history is visible and malformed restored parameters cannot crash rendering", () => {
  const s = state("en"); s.transactions = []; const html = renderToStaticMarkup(React.createElement(ChatSpendingPlan, { state: s, asOf: "2026-10-19", options: {} }));
  assert.match(html, /Unknown/); assert.match(html, /Insufficient history/);
  assert.match(renderToStaticMarkup(React.createElement(ChatSpendingPlan, { state: s, asOf: "2026-10-19", options: { reserves: { vnd: -1 } } })), /role="alert"/);
});

test("wallet scoping callback changes assumptions only, never real financial state", () => {
  const s = state("en"); s.wallets.push({ ...s.wallets[0], id: "second" }); const before = structuredClone(s); let selected;
  const tree = ChatSpendingPlan({ state: s, asOf: "2026-10-19", options: {}, onScope: options => { selected = options; } });
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "button" && !selected) node.props.onClick();
    React.Children.forEach(node.props?.children, visit);
  }
  visit(tree); assert.deepEqual(selected, { walletIds: ["vnd"] }); assert.deepEqual(s, before);
});

test("three-decimal currency amounts are not silently rounded to cents in the actual view", () => {
  const s = state("en"); s.wallets[0].currency = "KWD"; s.wallets[0].initial = 2.005; s.transactions = [{ ...s.transactions[0], amount: 0.001 }]; s.fixedExpenses = []; s.settings.reserveByWallet = '{"vnd":0.003}';
  const html = renderToStaticMarkup(React.createElement(ChatSpendingPlan, { state: s, asOf: "2026-10-19", options: {} }));
  assert.match(html, /2[.,]004 KWD/); assert.match(html, /0[.,]003 KWD/);
});
