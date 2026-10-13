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
  goals: [],
};
const query = (action, extra = {}) => ({ action, walletId: null, scope: "selected", periodStart: "2026-10-01", periodEnd: "2026-10-13", category: null, searchTerm: null, transactionType: null, ...extra });

test("computes wallet balances from recorded income, expenses and transfers only", () => {
  assert.match(answerFinancialQuery(query("balance"), state, "cash", "2026-10-13"), /₫1,019,500/);
  assert.match(answerFinancialQuery(query("balance", { walletId: "usd" }), state, "cash", "2026-10-13"), /\$515/);
  assert.doesNotMatch(answerFinancialQuery(query("balance", { walletId: "archived" }), state, "cash", "2026-10-13"), /Đã đóng/);
});

test("summarizes real transactions within the requested date range", () => {
  const answer = answerFinancialQuery(query("spending_summary"), state, "cash", "2026-10-13");
  assert.match(answer, /₫1,000,000 thu nhập/);
  assert.match(answer, /₫80,000 chi tiêu/);
  assert.match(answer, /3 giao dịch/);
});

test("ranks category spending deterministically and does not combine currencies", () => {
  const answer = answerFinancialQuery(query("top_category"), state, "cash", "2026-10-13");
  assert.match(answer, /Ăn uống — ₫50,000/);
  const all = answerFinancialQuery(query("top_category", { scope: "all" }), state, "cash", "2026-10-13");
  assert.match(all, /Food — \$5/);
});

test("transaction lookup returns only matching recorded rows", () => {
  const answer = answerFinancialQuery(query("transactions", { searchTerm: "cơm" }), state, "cash", "2026-10-13");
  assert.match(answer, /Cơm trưa/);
  assert.doesNotMatch(answer, /Tiền nhà/);
});

test("does not invent missing budgets or turn vague why questions into financial claims", () => {
  assert.match(answerFinancialQuery(query("budget_status"), state, "cash", "2026-10-13"), /chưa thấy ngân sách/);
  const explanation = answerFinancialQuery(query("explain"), state, "cash", "2026-10-13");
  assert.match(explanation, /Ăn uống là khoản chi lớn nhất/);
  assert.match(answerFinancialQuery(query("explain"), { ...state, transactions: [] }, "cash", "2026-10-13"), /chưa thấy giao dịch/);
});
