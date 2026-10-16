import assert from "node:assert/strict";
import test from "node:test";
import { answerFinancialQuery } from "../src/lib/financial-chat.ts";

const state = {
  wallets: [
    { id: "cash", name: "Ví tiền mặt", currency: "VND", initial: 100_000 },
    { id: "usd", name: "USD", currency: "USD", initial: 20 },
    { id: "archived", name: "Đã đóng", currency: "VND", initial: 1_000_000, archived: true },
  ],
  transactions: [
    { id: "1", title: "Cơm trưa", amount: 50_000, type: "expense", category: "Ăn uống", date: "2026-10-05", wallet: "cash" },
    { id: "2", title: "Tiền nhà", amount: 30_000, type: "expense", category: "Nhà", date: "2026-10-07", wallet: "cash" },
    { id: "3", title: "Lương", amount: 1_000_000, type: "income", category: "Lương", date: "2026-10-10", wallet: "cash" },
    { id: "4", title: "Chuyển vào USD", amount: 500, type: "transfer", category: "Chuyển khoản", date: "2026-10-11", wallet: "cash", targetWallet: "usd" },
    { id: "5", title: "Coffee", amount: 5, type: "expense", category: "Food", date: "2026-10-11", wallet: "usd" },
  ],
  goals: [], fixedExpenses: [], settings: { language: "Tiếng Việt" },
};
const query = (action, extra = {}) => ({ action, walletId: null, scope: "selected", periodStart: "2026-10-01", periodEnd: "2026-10-13", category: null, searchTerm: null, transactionType: null, ...extra });

test("computes wallet balances and never converts cross-currency transfers", () => {
  assert.match(answerFinancialQuery(query("balance"), state, "cash", "2026-10-13"), /₫1,019,500/);
  const usd = answerFinancialQuery(query("balance", { walletId: "usd" }), state, "cash", "2026-10-13");
  assert.match(usd, /\$15/);
  assert.match(usd, /số dư chưa đầy đủ/);
  assert.doesNotMatch(answerFinancialQuery(query("balance", { walletId: "archived" }), state, "cash", "2026-10-13"), /Đã đóng/);
});

test("summarizes recorded transactions in range, separately by wallet and currency", () => {
  const answer = answerFinancialQuery(query("spending_summary"), state, "cash", "2026-10-13");
  assert.match(answer, /thu ₫1,000,000/);
  assert.match(answer, /chi ₫80,000/);
  assert.match(answer, /\(3\)/);
  const all = answerFinancialQuery(query("spending_summary", { scope: "all" }), state, "cash", "2026-10-13");
  assert.match(all, /₫80,000/);
  assert.match(all, /\$5/);
});

test("ranks categories per wallet without comparing foreign currencies", () => {
  const answer = answerFinancialQuery(query("top_category"), state, "cash", "2026-10-13");
  assert.match(answer, /Ăn uống: ₫50,000/);
  const all = answerFinancialQuery(query("top_category", { scope: "all" }), state, "cash", "2026-10-13");
  assert.match(all, /Food: \$5/);
});

test("transaction lookup only returns matching real rows", () => {
  const answer = answerFinancialQuery(query("transactions", { searchTerm: "cơm" }), state, "cash", "2026-10-13");
  assert.match(answer, /Cơm trưa/);
  assert.doesNotMatch(answer, /Tiền nhà/);
});

test("does not invent budgets or causes when source data is missing", () => {
  assert.match(answerFinancialQuery(query("budget_status"), state, "cash", "2026-10-13"), /Chưa thấy ngân sách/);
  assert.match(answerFinancialQuery(query("explain"), state, "cash", "2026-10-13"), /Ăn uống: ₫50,000/);
  assert.match(answerFinancialQuery(query("explain"), { ...state, transactions: [] }, "cash", "2026-10-13"), /Chưa có giao dịch/);
  assert.match(answerFinancialQuery(query("spending_summary"), { ...state, transactions: [] }, "cash", "2026-10-13"), /Chưa có giao dịch phù hợp/);
});

test("reports budget spending, scheduled expenses and due dates without mixing it with wallet balance", () => {
  const withBudget = {
    ...state,
    goals: [{ id: "b1", kind: "budget", title: "Ăn uống", amount: 200_000, saved: 0, currency: "VND", date: "2026-10-01", cycle: "monthly", category: "Ăn uống", wallet: "cash", direction: "", person: "" }],
    fixedExpenses: [{ id: "f1", budgetId: "b1", walletId: "cash", title: "Bữa ăn đã lên lịch", amount: 20_000, category: "Ăn uống", dueDate: "2026-10-20", recurrence: "once", active: true }],
  };
  const answer = answerFinancialQuery(query("budget_status"), withBudget, "cash", "2026-10-13");
  assert.match(answer, /Hạn mức ₫200,000/);
  assert.match(answer, /Đã chi ₫50,000/);
  assert.match(answer, /Chi cố định dự kiến ₫20,000/);
  assert.match(answer, /2026-10-20/);
  assert.match(answer, /Hạn mức ngân sách không phải số dư ví/);
});

test("ignores malformed amounts and uses the selected UI language", () => {
  const inconsistent = { ...state, transactions: [...state.transactions, { id: "bad", title: "Broken", amount: Number.NaN, type: "expense", category: "Ăn uống", date: "2026-10-12", wallet: "cash" }] };
  const vi = answerFinancialQuery(query("balance"), inconsistent, "cash", "2026-10-13");
  assert.match(vi, /Bỏ qua giao dịch sai số tiền: 1/);
  assert.match(vi, /₫1,019,500/);
  const en = answerFinancialQuery(query("spending_summary", { scope: "all" }), { ...state, settings: { language: "English" } }, "cash", "2026-10-13");
  assert.match(en, /CONCLUSION/);
  assert.doesNotMatch(en, /Kết luận|Tổng hợp thu chi/);
  const zh = answerFinancialQuery(query("balance"), { ...state, settings: { language: "中文" } }, "cash", "2026-10-13");
  assert.match(zh, /结论/);
});
