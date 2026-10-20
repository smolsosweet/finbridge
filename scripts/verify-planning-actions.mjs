import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as actions from "../src/lib/planning-actions.ts";
import { isClearlyNewTransaction } from "../src/lib/conversation-intent.ts";
import { fixedExpensePayment } from "../src/lib/fixed-expense-payments.ts";
import { workspaceSchema } from "../src/lib/workspace-model.ts";

const mockState = () => ({
  wallets: [
    { id: "vnd", name: "Vietinbank", currency: "VND", initial: 10000000, type: "cash" },
    { id: "usd", name: "USD Wallet", currency: "USD", initial: 1000, type: "cash" },
  ],
  transactions: [
    {
      id: "paid-oct",
      title: "Tiền điện",
      type: "expense",
      amount: 450000,
      wallet: "vnd",
      category: "Bills",
      date: "2026-10-05",
      note: "Thanh toán Tiền điện kỳ 2026-10-05",
      fixedExpenseId: "electric",
      fixedExpenseDueDate: "2026-10-05",
      paymentConfirmation: "user",
    },
  ],
  goals: [
    {
      id: "living",
      title: "Sinh hoạt",
      kind: "budget",
      amount: 7000000,
      saved: 0,
      currency: "VND",
      wallet: "vnd",
      date: "2026-10-01",
      cycle: "monthly",
      category: "Bills",
      direction: "",
      person: "",
    },
  ],
  fixedExpenses: [
    {
      id: "rent",
      title: "Tiền nhà",
      budgetId: "living",
      walletId: "vnd",
      amount: 3000000,
      category: "Bills",
      dueDate: "2026-10-20",
      recurrence: "monthly",
      active: true,
    },
    {
      id: "electric",
      title: "Tiền điện",
      budgetId: "living",
      walletId: "vnd",
      amount: 450000,
      category: "Bills",
      dueDate: "2026-10-05",
      recurrence: "monthly",
      active: true,
    },
    {
      id: "water",
      title: "Tiền nước",
      budgetId: "living",
      walletId: "vnd",
      amount: 150000,
      category: "Bills",
      dueDate: "2026-10-15",
      recurrence: "monthly",
      active: true,
    },
    {
      id: "paused_bill",
      title: "Phí dịch vụ chung cư",
      budgetId: "living",
      walletId: "vnd",
      amount: 200000,
      category: "Bills",
      dueDate: "2026-10-25",
      recurrence: "monthly",
      active: false,
    },
  ],
  categories: ["Bills"],
  categoryMeta: { Bills: { type: "expense", icon: "🧾", children: [] } },
  settings: { language: "Tiếng Việt" },
  recurring: [],
  rules: [],
});

test("bill payment intent recognition handles natural language and blocks accidental raw transaction drafts", () => {
  const s = mockState();
  const paymentPhrases = [
    "Tôi vừa đóng tiền nhà rồi",
    "Đánh dấu hóa đơn điện tháng này đã trả",
    "mình vừa trả tiền nước xong",
    "paid the rent",
    "pay electric bill",
    "已支付房租",
    "Tôi vừa đóng tiền nhà 3 triệu rồi",
  ];

  for (const phrase of paymentPhrases) {
    assert.equal(actions.isFixedExpensePaymentMessage(phrase, s), true, `Should recognize payment: ${phrase}`);
    assert.equal(isClearlyNewTransaction(phrase, s), false, `Should not treat as raw transaction: ${phrase}`);
  }

  // Non-payment messages
  assert.equal(actions.isFixedExpensePaymentMessage("mua đôi giày 500k", s), false);
  assert.equal(actions.isFixedExpensePaymentMessage("ăn trưa 50k", s), false);
});

test("bill payment resolves correct expense, due period, and prepares preview proposal", () => {
  const s = mockState();
  const asOf = "2026-10-19";

  // 1. Rent payment (upcoming/due tomorrow: 2026-10-20)
  const resRent = actions.prepareFixedExpensePayment(s, "Tôi vừa đóng tiền nhà rồi", asOf, randomUUID());
  assert.ok(resRent.proposal, "Proposal must be created");
  assert.equal(resRent.proposal.expenseId, "rent");
  assert.equal(resRent.proposal.expenseTitle, "Tiền nhà");
  assert.equal(resRent.proposal.amount, 3000000);
  assert.equal(resRent.proposal.dueDate, "2026-10-20");
  assert.equal(resRent.proposal.walletId, "vnd");
  assert.equal(resRent.proposal.walletName, "Vietinbank");
  assert.equal(resRent.proposal.alreadyPaid, false);
  assert.equal(resRent.proposal.status, "pending");

  // 2. Overdue payment (water was due 2026-10-15 and unpaid)
  const resWater = actions.prepareFixedExpensePayment(s, "Đã đóng tiền nước", asOf, randomUUID());
  assert.ok(resWater.proposal);
  assert.equal(resWater.proposal.expenseId, "water");
  assert.equal(resWater.proposal.dueDate, "2026-10-15");
  assert.equal(resWater.proposal.alreadyPaid, false);

  // 3. Already paid occurrence (electric 2026-10-05 was paid)
  const resElec = actions.prepareFixedExpensePayment(s, "Đánh dấu hóa đơn điện 2026-10-05 đã trả", asOf, randomUUID());
  assert.ok(resElec.proposal);
  assert.equal(resElec.proposal.expenseId, "electric");
  assert.equal(resElec.proposal.dueDate, "2026-10-05");
  assert.equal(resElec.proposal.alreadyPaid, true);

  // 4. Paused bill prevents payment proposal and clarifies to user
  const resPaused = actions.prepareFixedExpensePayment(s, "đã trả phí dịch vụ chung cư", asOf, randomUUID());
  assert.equal(resPaused.proposal, undefined);
  assert.match(resPaused.clarification || "", /đang tạm dừng/);
});

test("bill payment execution is strictly idempotent and prevents duplicate payments", () => {
  const s = mockState();
  const asOf = "2026-10-19";
  const { proposal } = actions.prepareFixedExpensePayment(s, "Tôi vừa đóng tiền nhà rồi", asOf, randomUUID());
  assert.ok(proposal);

  const initialTxCount = s.transactions.length;
  // Apply payment once
  const next = actions.applyFixedExpensePayment(s, proposal, asOf);
  assert.equal(next.transactions.length, initialTxCount + 1);
  const paidTx = next.transactions[next.transactions.length - 1];
  assert.equal(paidTx.fixedExpenseId, "rent");
  assert.equal(paidTx.fixedExpenseDueDate, "2026-10-20");
  assert.equal(paidTx.paymentConfirmation, "user");
  assert.equal(paidTx.amount, 3000000);
  assert.equal(paidTx.wallet, "vnd");

  // Check occurrence payment helper recognizes it as paid
  assert.ok(fixedExpensePayment(next, "rent", "2026-10-20"));

  // Apply payment again with the same occurrence -> must be strictly idempotent
  const proposal2 = { ...proposal, id: randomUUID() };
  const doublePay = actions.applyFixedExpensePayment(next, proposal2, asOf);
  assert.equal(doublePay.transactions.length, initialTxCount + 1, "Duplicate payment must NOT add extra transaction");

  // Validates schema
  assert.equal(workspaceSchema.safeParse(next).success, true);
});

test("pause and resume fixed expense toggles active state and preserves transaction history", () => {
  const s = mockState();
  // 1. Pause rent
  assert.equal(actions.isFixedExpenseStatusMessage("Tạm dừng khoản chi tiền nhà", s), "pause");
  const pausePrep = actions.prepareFixedExpenseStatus(s, "Tạm dừng khoản chi tiền nhà", randomUUID());
  assert.ok(pausePrep.proposal);
  assert.equal(pausePrep.proposal.expenseId, "rent");
  assert.equal(pausePrep.proposal.action, "pause");
  assert.equal(pausePrep.proposal.targetActive, false);

  const pausedState = actions.applyFixedExpenseStatus(s, pausePrep.proposal);
  const pausedRent = pausedState.fixedExpenses?.find(e => e.id === "rent");
  assert.equal(pausedRent?.active, false);
  // Transaction history is untouched
  assert.deepEqual(pausedState.transactions, s.transactions);

  // 2. Resume paused bill
  assert.equal(actions.isFixedExpenseStatusMessage("Tiếp tục khoản chi phí dịch vụ chung cư", s), "resume");
  const resumePrep = actions.prepareFixedExpenseStatus(pausedState, "Tiếp tục phí dịch vụ chung cư", randomUUID());
  assert.ok(resumePrep.proposal);
  assert.equal(resumePrep.proposal.expenseId, "paused_bill");
  assert.equal(resumePrep.proposal.action, "resume");
  assert.equal(resumePrep.proposal.targetActive, true);

  const resumedState = actions.applyFixedExpenseStatus(pausedState, resumePrep.proposal);
  const resumedBill = resumedState.fixedExpenses?.find(e => e.id === "paused_bill");
  assert.equal(resumedBill?.active, true);
  assert.deepEqual(resumedState.transactions, s.transactions);

  // 3. Disambiguation when multiple bills match generic word
  s.fixedExpenses?.push({
    id: "rent2",
    title: "Tiền nhà cơ sở 2",
    budgetId: "living",
    walletId: "vnd",
    amount: 2500000,
    category: "Bills",
    dueDate: "2026-10-22",
    recurrence: "monthly",
    active: true,
  });
  const disambig = actions.prepareFixedExpenseStatus(s, "Tạm dừng tiền nhà", randomUUID());
  assert.equal(disambig.proposal, undefined);
  assert.ok(disambig.disambiguation && disambig.disambiguation.length >= 2);
});

test("edit budget and fixed expense supports amount and rename modifications with validation", () => {
  const s = mockState();

  // 1. Edit budget limit
  assert.equal(actions.isPlanningEditMessage("Sửa hạn mức ngân sách Sinh hoạt thành 8 triệu", s), "budget");
  const budgetPrep = actions.preparePlanningEdit(s, "Sửa hạn mức ngân sách Sinh hoạt thành 8 triệu", randomUUID());
  assert.ok(budgetPrep.proposal);
  assert.equal(budgetPrep.proposal.kind, "budget");
  assert.equal(budgetPrep.proposal.targetId, "living");
  assert.equal(budgetPrep.proposal.changes.amount?.from, 7000000);
  assert.equal(budgetPrep.proposal.changes.amount?.to, 8000000);

  const budgetUpdated = actions.applyPlanningEdit(s, budgetPrep.proposal);
  assert.equal(budgetUpdated.goals.find(g => g.id === "living")?.amount, 8000000);

  // 2. Edit fixed expense amount
  assert.equal(actions.isPlanningEditMessage("Sửa tiền nhà thành 3.5 triệu", s), "fixed_expense");
  const expensePrep = actions.preparePlanningEdit(s, "Sửa tiền nhà thành 3500000", randomUUID());
  assert.ok(expensePrep.proposal);
  assert.equal(expensePrep.proposal.kind, "fixed_expense");
  assert.equal(expensePrep.proposal.targetId, "rent");
  assert.equal(expensePrep.proposal.changes.amount?.to, 3500000);

  const expenseUpdated = actions.applyPlanningEdit(s, expensePrep.proposal);
  assert.equal(expenseUpdated.fixedExpenses?.find(e => e.id === "rent")?.amount, 3500000);

  // 3. Rename budget
  const renameBudget = actions.preparePlanningEdit(s, "Đổi tên ngân sách Sinh hoạt thành Chi tiêu gia đình", randomUUID());
  assert.ok(renameBudget.proposal);
  assert.equal(renameBudget.proposal.changes.title?.to, "Chi tiêu gia đình");
  const renamedBudgetState = actions.applyPlanningEdit(s, renameBudget.proposal);
  assert.equal(renamedBudgetState.goals.find(g => g.id === "living")?.title, "Chi tiêu gia đình");

  // 4. Missing target name or amount asks for clarification
  const missingAmount = actions.preparePlanningEdit(s, "Sửa ngân sách Sinh hoạt", randomUUID());
  assert.equal(missingAmount.proposal, undefined);
  assert.match(missingAmount.clarification || "", /đặt hạn mức mới/);
});

test("natural confirmation and cancellation replies match correctly across languages", () => {
  for (const text of ["xác nhận", "xác nhận thanh toán", "đồng ý", "đúng rồi", "ok", "yes", "confirm", "luu", "确认", "同意", "是的"]) {
    assert.equal(actions.planningActionConfirmationReply(text), "confirm", `Must confirm: ${text}`);
  }

  for (const text of ["hủy", "hủy bỏ", "cancel", "no", "không", "thôi", "bỏ qua", "取消", "不用"]) {
    assert.equal(actions.planningActionConfirmationReply(text), "cancel", `Must cancel: ${text}`);
  }

  assert.equal(actions.planningActionConfirmationReply("nếu chi 500k thì sao"), null);
});

test("real UI cards render preview details, confirm/cancel buttons, and localize in VI, EN, and ZH", () => {
  const require = createRequire(import.meta.url);
  const s = mockState();

  // Transpile cards
  const transpile = (filePath) => {
    const code = ts.transpileModule(readFileSync(filePath, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const m = { exports: {} };
    const drafts = { formatTransactionMoney: (amount, currency) => `${amount} ${currency}` };
    new Function("require", "module", "exports", code)(
      (name) => (name === "@/lib/planning-actions" ? actions : name === "@/lib/transaction-drafts" ? drafts : require(name)),
      m,
      m.exports
    );
    return m.exports;
  };

  const { FixedExpensePaymentCard } = transpile("src/components/finbridge/workspace/FixedExpensePaymentCard.tsx");
  const { FixedExpenseStatusCard } = transpile("src/components/finbridge/workspace/FixedExpenseStatusCard.tsx");
  const { PlanningEditCard } = transpile("src/components/finbridge/workspace/PlanningEditCard.tsx");

  for (const language of ["vi", "en", "zh"]) {
    // 1. Payment Card
    const payProp = actions.prepareFixedExpensePayment(s, "Tôi vừa đóng tiền nhà rồi", "2026-10-19", randomUUID()).proposal;
    assert.ok(payProp);
    const payHtml = renderToStaticMarkup(
      React.createElement(FixedExpensePaymentCard, {
        proposal: payProp,
        language,
        busy: false,
        onConfirm() {},
        onCancel() {},
      })
    );
    assert.match(payHtml, /Tiền nhà/);
    assert.match(payHtml, /Vietinbank/);
    assert.match(payHtml, /r-primary/);
    assert.match(payHtml, /r-secondary/);

    // 2. Status Card
    const statusProp = actions.prepareFixedExpenseStatus(s, "Tạm dừng tiền nhà", randomUUID()).proposal;
    assert.ok(statusProp);
    const statusHtml = renderToStaticMarkup(
      React.createElement(FixedExpenseStatusCard, {
        proposal: statusProp,
        language,
        busy: false,
        onConfirm() {},
        onCancel() {},
      })
    );
    assert.match(statusHtml, /Tiền nhà/);
    assert.match(statusHtml, /r-primary/);

    // 3. Edit Card
    const editProp = actions.preparePlanningEdit(s, "Sửa ngân sách Sinh hoạt thành 8 triệu", randomUUID()).proposal;
    assert.ok(editProp);
    const editHtml = renderToStaticMarkup(
      React.createElement(PlanningEditCard, {
        proposal: editProp,
        language,
        busy: false,
        onConfirm() {},
        onCancel() {},
      })
    );
    assert.match(editHtml, /Sinh hoạt/);
    assert.match(editHtml, /r-primary/);
  }
});
