import assert from "node:assert/strict";
import test from "node:test";
import { answerFinancialQuery, resolveFinancialFollowup } from "../src/lib/financial-chat.ts";
import { financialConversationEntities, resolveObligationReference } from "../src/lib/financial-obligation-query.ts";
import { modelHistory } from "../src/lib/chat-local-plan.ts";

const today = "2026-10-19";
const state = () => ({
  wallets: [{ id: "vnd", name: "Test wallet", currency: "VND", initial: 10_000_000, type: "cash" }],
  transactions: [{ id: "spent", wallet: "vnd", type: "expense", amount: 895622, title: "Recorded spending", category: "Other", date: today, note: "" }],
  goals: [], settings: { language: "Tiếng Việt" },
  fixedExpenses: [{ id: "parking", walletId: "vnd", budgetId: "", title: "Tiền gửi xe", amount: 147000, category: "Other", dueDate: "2026-10-20", recurrence: "monthly", active: true }],
});
const query = (changes = {}) => ({ action: "balance_after_obligation", walletId: "vnd", scope: "selected", periodStart: null, periodEnd: null, category: null, searchTerm: "Tiền gửi xe", transactionType: null, ...changes });

test("hypothetical payment subtracts exact minor units without altering actual balance or workspace", () => {
  const data = state(), before = structuredClone(data);
  const answer = answerFinancialQuery(query(), data, "vnd", today);
  assert.match(answer, /8,957,378 VND/);
  assert.match(answer, /2026-10-20/);
  assert.match(answer, /Chưa ghi nhận thanh toán/);
  const current = answerFinancialQuery(query({ action: "balance", searchTerm: null }), data, "vnd", today);
  assert.match(current, /9,104,378 VND/);
  assert.deepEqual(data, before);
});

test("confirmed occurrence is not deducted again or silently replaced with next month's bill", () => {
  const data = state();
  data.transactions.push({ id: "paid", wallet: "vnd", type: "expense", amount: 147000, title: "Parking payment", category: "Other", date: today, note: "", fixedExpenseId: "parking", fixedExpenseDueDate: "2026-10-20", paymentConfirmation: "user" });
  const answer = answerFinancialQuery(query(), data, "vnd", today);
  assert.match(answer, /đã được xác nhận thanh toán/);
  assert.match(answer, /8,957,378 VND/);
  assert.doesNotMatch(answer, /8,810,378|2026-11-20/);
});

test("missing, ambiguous, inconsistent and foreign currency data ask instead of inventing a balance", () => {
  const data = state();
  assert.match(answerFinancialQuery(query({ searchTerm: null }), data, "vnd", today), /khoản nào/);
  data.fixedExpenses.push({ ...data.fixedExpenses[0], id: "duplicate" });
  assert.match(answerFinancialQuery(query(), data, "vnd", today), /nhiều khoản/);
  data.fixedExpenses.pop();
  data.transactions.push({ ...data.transactions[0] });
  assert.match(answerFinancialQuery(query(), data, "vnd", today), /chưa nhất quán/);
});

test("bill references and wallet survive history without including previous computed amounts", () => {
  const data = state();
  const history = modelHistory([{ role: "assistant", text: "SECRET old amount 123456789", localOnly: true, financialContext: { action: "balance_after_obligation", walletId: "vnd", scope: "selected", searchTerm: "Tiền gửi xe" } }]);
  assert.doesNotMatch(JSON.stringify(history), /123456789|SECRET/);
  const resolved = resolveObligationReference("sau khi trả khoản đó còn bao nhiêu", query({ searchTerm: null, walletId: null, scope: "all" }), data, history);
  assert.equal(resolved.searchTerm, "Tiền gửi xe");
  assert.equal(resolved.walletId, "vnd");
  const current = resolveFinancialFollowup("hiện tại tôi còn bao nhiêu", query({ action: "balance", searchTerm: null, walletId: null }), history);
  assert.equal(current.action, "balance");
  assert.equal(current.walletId, "vnd");
  const all = resolveFinancialFollowup("số dư tất cả ví", query({ action: "balance", searchTerm: null, walletId: null, scope: "all" }), history);
  assert.equal(all.walletId, null);
});

test("conditional balance safety guard supports Vietnamese, English and Chinese", () => {
  for (const message of ["sau khi đóng tiền gửi xe thì tôi còn bao nhiêu tiền", "nếu trả tiền gửi xe thì còn bao nhiêu", "after paying parking, what's left?", "支付停车费后还有多少钱"]) {
    assert.equal(resolveFinancialFollowup(message, query({ action: "balance", actions: ["balance"] })).action, "balance_after_obligation");
  }
});

test("duplicate bill names across wallets remain ambiguous and explicit currency stays isolated", () => {
  const data = state();
  data.wallets.push({ id: "usd", name: "USD wallet", currency: "USD", initial: 1000, type: "cash" });
  data.fixedExpenses.push({ ...data.fixedExpenses[0], id: "usd-parking", walletId: "usd", amount: 10.25 });
  const all = query({ walletId: null, scope: "all" });
  assert.match(answerFinancialQuery(all, data, "", today), /nhiều khoản/);
  const reference = resolveObligationReference("sau khi trả Tiền gửi xe", all, data, []);
  assert.equal(reference.walletId, null);
  assert.match(answerFinancialQuery(query({ walletId: "usd" }), data, "usd", today), /989.75 USD/);
});

test("overdue one-time bills are included and invalid dates do not produce a result", () => {
  const data = state();
  data.fixedExpenses[0].recurrence = "once";
  data.fixedExpenses[0].dueDate = "2026-10-18";
  assert.match(answerFinancialQuery(query(), data, "vnd", today), /8,957,378 VND/);
  assert.match(answerFinancialQuery(query({ periodStart: "2026-02-30" }), data, "vnd", today), /chưa hợp lệ/);
  assert.equal(financialConversationEntities(data, today)[0].nextDueDate, null);
});
