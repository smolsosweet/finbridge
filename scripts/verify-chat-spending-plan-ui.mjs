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
import * as payments from "../src/lib/fixed-expense-payments.ts";

// Render the real component/calculations, pin the live clock to asOf and replace
// CSS names. This does not emulate browser layout or live Gemini.
const require = createRequire(import.meta.url), module = { exports: {} };
const code = ts.transpileModule(readFileSync("src/components/finbridge/workspace/ChatSpendingPlan.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function("require", "module", "exports", code)(name => {
  if (name === "@/lib/financial-outlook") return outlook;
  if (name === "@/lib/transaction-drafts") return drafts;
  if (name === "@/lib/i18n") return i18n;
  if (name === "@/lib/fixed-expense-payments") return payments;
  if (name === "./useFinancialDate") return { useFinancialDate: value => value };
  if (name.endsWith(".module.css")) return { default: new Proxy({}, { get: (_, key) => String(key) }) };
  return require(name);
}, module, module.exports);
const { ChatSpendingPlan } = module.exports;
const state = language => ({ wallets: [{ id: "vnd", name: "Cash", currency: "VND", initial: 1000000, type: "cash" }], transactions: [{ id: "food", title: "Lunch", amount: 190000, type: "expense", category: "Food", wallet: "vnd", date: "2026-10-19" }], goals: [], fixedExpenses: [{ id: "rent", title: "Rent", amount: 200000, category: "Food", walletId: "vnd", budgetId: "", dueDate: "2026-10-20", recurrence: "once", active: true }], categories: ["Food"], categoryMeta: { Food: { type: "expense", children: [] } }, settings: { language, reserveByWallet: '{"vnd":100000}' }, recurring: [], rules: [] });

test("real plan renders requested section order, explicit currencies and expandable sources in all app languages", () => {
  for (const [lang, headings] of [["vi", ["Số dư hiện tại", "Khoản cần thanh toán", "Tiền dự phòng và số tiền có thể chi", "Dự báo cuối tháng", "Ngân sách từng danh mục", "Cách tính &amp; dữ liệu"]], ["en", ["Current balance", "Payments due", "Reserve and available spending", "Month-end forecast", "Category budgets", "Calculations &amp; sources"]], ["zh", ["当前余额", "待付款项", "备用金与可花金额", "月末预测", "分类预算", "计算方法与数据"]]]) {
    const s = state(lang); s.goals = [{ id: "budget", kind: "budget", title: "Food budget", amount: 700000, currency: "VND", date: "2026-10-01", cycle: "monthly", category: "Food", wallet: "vnd" }];
    const html = renderToStaticMarkup(React.createElement(ChatSpendingPlan, { state: s, asOf: "2026-10-19", options: {} }));
    let previous = -1; for (const heading of headings) { const index = html.indexOf(heading); assert.ok(index > previous, heading); previous = index; }
    assert.match(html, /VND/); assert.match(html, /<details>/); assert.match(html, /610[.,]000/); assert.match(html, /490[.,]000/); assert.doesNotMatch(html, /NaN|undefined|Infinity/);
    assert.match(html, /<progress[^>]*aria-label="/);
    assert.doesNotMatch(html, /<details[^>]*\bopen(?:=|>)/);
  }
});

test("unknown history is visible and malformed restored parameters cannot crash rendering", () => {
  const s = state("en"); s.transactions = []; const html = renderToStaticMarkup(React.createElement(ChatSpendingPlan, { state: s, asOf: "2026-10-19", options: {} }));
  assert.match(html, /Unknown/); assert.match(html, /not enough flexible-spending history/);
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

test("overdue bills have text, dates and cumulative balances; the total is not deducted twice", () => {
  const s = state("vi");
  s.fixedExpenses.push({ ...s.fixedExpenses[0], id: "internet", title: "Internet", amount: 239000, dueDate: "2026-10-17" });
  const html = renderToStaticMarkup(React.createElement(ChatSpendingPlan, { state: s, asOf: "2026-10-19", options: {} }));
  assert.match(html, /Tổng tiền chưa thanh toán/);
  assert.match(html, /439[.,]000 VND/);
  assert.match(html, /class="overdue"/);
  assert.match(html, /Quá hạn/);
  assert.match(html, /<time dateTime="2026-10-17">17\/10\/2026<\/time>/);
  assert.match(html, /571[.,]000 VND/);
  assert.match(html, /371[.,]000 VND/);
  assert.match(html, /251[.,]000 VND/);
});

test("reserve absence and explicit zero are distinct; missing history provides a next step", () => {
  const s = state("vi"); delete s.settings.reserveByWallet;
  let html = renderToStaticMarkup(React.createElement(ChatSpendingPlan, { state: s, asOf: "2026-10-19", options: {} }));
  assert.match(html, /Số tiền có thể chi mỗi ngày/);
  assert.doesNotMatch(html, /Trần chi linh hoạt/);
  assert.match(html, /Chưa đặt tiền dự phòng nên Finn chưa tính/);
  assert.match(html, /Hãy nhắn số tiền và tiền tệ/);
  s.settings.reserveByWallet = '{"vnd":0}';
  html = renderToStaticMarkup(React.createElement(ChatSpendingPlan, { state: s, asOf: "2026-10-19", options: {} }));
  assert.doesNotMatch(html, /Chưa đặt tiền dự phòng nên Finn chưa tính/);
  assert.match(html, /50[.,]833 VND/);
  s.transactions = [];
  html = renderToStaticMarkup(React.createElement(ChatSpendingPlan, { state: s, asOf: "2026-10-19", options: {} }));
  assert.match(html, /Hãy ghi nhận thêm giao dịch/);
});

test("budget progress shows actual spending, limit and percentage, including over-budget status", () => {
  const s = state("en");
  s.goals = [{ id: "budget", kind: "budget", title: "Food budget", amount: 100000, currency: "VND", date: "2026-10-01", cycle: "monthly", category: "Food", wallet: "vnd" }];
  const html = renderToStaticMarkup(React.createElement(ChatSpendingPlan, { state: s, asOf: "2026-10-19", options: {} }));
  assert.match(html, /190% used/);
  assert.match(html, /aria-valuetext="190[.,]000 VND \/ 100[.,]000 VND · 190%"/);
  assert.match(html, /value="100000" max="100000"/);
  assert.match(html, /Recorded spending exceeds the limit/);
  assert.match(html, /-290[.,]000 VND/);
});

test("CNY without history keeps a calculable daily amount separate from an unknown forecast", () => {
  const s = state("en"); s.wallets = [{ id: "cny", name: "Alipay", currency: "CNY", initial: 10000, type: "cash" }]; s.transactions = []; s.fixedExpenses = []; s.settings.reserveByWallet = '{"cny":300}';
  const html = renderToStaticMarkup(React.createElement(ChatSpendingPlan, { state: s, asOf: "2026-10-19", options: {} }));
  assert.match(html, /808.33 CNY/);
  assert.match(html, /9,700.00 CNY/);
  assert.match(html, /Record more transactions/);
  assert.match(html, /<dt>Projected balance<\/dt><dd>Unknown<\/dd>/);
  assert.doesNotMatch(html, /VND|USD|NaN/);
});

test("month-end explains the missing daily amount and the view remains read-only", () => {
  const s = state("vi"), before = structuredClone(s);
  const html = renderToStaticMarkup(React.createElement(ChatSpendingPlan, { state: s, asOf: "2026-10-31", options: {} }));
  assert.match(html, /không còn ngày tiếp theo/);
  assert.deepEqual(s, before);
});

test("occurrence labels distinguish reminder boundaries and payment history from the next cycle", () => {
  const s = state("vi"), bill = s.fixedExpenses[0]; bill.recurrence = "monthly"; bill.reminderDays = 0;
  for (const [asOf, label] of [["2026-10-19", "Chưa đến hạn"], ["2026-10-20", "Đến hạn hôm nay"], ["2026-10-21", "Quá hạn"]]) {
    const html = renderToStaticMarkup(React.createElement(ChatSpendingPlan, { state: s, asOf, options: {} }));
    assert.match(html, new RegExp(label));
  }
  bill.reminderDays = 2;
  const soon = renderToStaticMarkup(React.createElement(ChatSpendingPlan, { state: s, asOf: "2026-10-19", options: {} }));
  assert.match(soon, /Sắp đến hạn/);
  const paid = payments.recordFixedExpensePayment(s, bill.id, { dueDate: "2026-10-20", paidOn: "2026-10-20", amount: bill.amount, walletId: "vnd", note: "", transactionId: "paid" }, "2026-10-20");
  const html = renderToStaticMarkup(React.createElement(ChatSpendingPlan, { state: paid, asOf: "2026-10-20", options: {} }));
  assert.match(html, /Đã thanh toán/);
  assert.match(html, /Kỳ tiếp theo.*20\/11\/2026/);
  assert.doesNotMatch(html, /Quá hạn/);
});
