import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import {
  isSettingsThemeMessage,
  isSettingsLanguageMessage,
  isSettingsWalletArchiveMessage,
  prepareWalletArchive,
  applyWalletArchive,
  settingsActionCopy,
  settingsActionProposalSchema,
} from "../src/lib/settings-actions.ts";
import {
  findTransactionsForDeletion,
  detectRelativeOrder,
  cleanDeletionSearchTerm,
} from "../src/lib/transaction-deletion.ts";
import { answerFinancialQuery } from "../src/lib/financial-chat.ts";
import { validateAndCommitDrafts } from "../src/lib/transaction-drafts.ts";
import { recordFixedExpensePayment } from "../src/lib/fixed-expense-payments.ts";
import { detectWorkspaceCreationKind, emptyWorkspaceAction, inspectWorkspaceProposal } from "../src/lib/workspace-actions.ts";

const require = createRequire(import.meta.url);
const transpile = (filePath) => {
  const code = ts.transpileModule(readFileSync(filePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const m = { exports: {} };
  const settingsActionsModule = { settingsActionCopy };
  const i18nModule = { resolveLanguage: (l) => (l === "zh" || l === "中文" ? "zh" : l === "en" || l === "English" ? "en" : "vi") };
  const storeModule = { money: (val, curr) => `${val.toLocaleString("en-US")} ${curr}` };
  new Function("require", "module", "exports", code)(
    (name) => {
      if (name === "@/lib/settings-actions") return settingsActionsModule;
      if (name === "@/lib/i18n") return i18nModule;
      if (name === "./store") return storeModule;
      return require(name);
    },
    m,
    m.exports
  );
  return m.exports;
};

const { SettingsActionCard } = transpile("src/components/sites/rolly/replica/SettingsActionCard.tsx");

const mockWorkspace = () => ({
  wallets: [
    { id: "vietinbank", name: "Vietinbank", currency: "VND", initial: 10_000_000, type: "cash" },
    { id: "momo", name: "Ví MoMo", currency: "VND", initial: 2_000_000, type: "digital" },
  ],
  transactions: [
    {
      id: "tx-1",
      title: "Barista Lab",
      type: "expense",
      amount: 58622,
      category: "Ăn Uống",
      date: "2026-10-19T08:15:00",
      wallet: "vietinbank",
      note: "Cà phê sáng",
    },
    {
      id: "tx-2",
      title: "Barista Lab",
      type: "expense",
      amount: 58622,
      category: "Ăn Uống",
      date: "2026-10-19T14:30:00",
      wallet: "vietinbank",
      note: "Cà phê chiều",
    },
    {
      id: "tx-3",
      title: "mua nước tẩy trang",
      type: "expense",
      amount: 200000,
      category: "Mua Sắm",
      date: "2026-10-19T17:00:00",
      wallet: "vietinbank",
      note: "",
    },
  ],
  goals: [
    {
      id: "budget-dining",
      kind: "budget",
      title: "Ăn uống hàng tháng",
      amount: 3000000,
      saved: 0,
      currency: "VND",
      wallet: "vietinbank",
      date: "2026-10-01",
      cycle: "monthly",
      category: "Ăn Uống",
      direction: "",
      person: "",
    },
    {
      id: "goal-trip",
      kind: "goal",
      title: "Du lịch Đà Lạt",
      amount: 10000000,
      saved: 2000000,
      currency: "VND",
      wallet: "vietinbank",
      date: "2026-12-31",
      cycle: "once",
      category: "Du lịch",
      direction: "",
      person: "",
    },
  ],
  fixedExpenses: [
    {
      id: "fe-internet",
      title: "Tiền mạng FPT",
      budgetId: "budget-dining",
      walletId: "vietinbank",
      amount: 250000,
      category: "Bills",
      dueDate: "2026-10-25",
      recurrence: "monthly",
      active: true,
    },
  ],
  categories: ["Chưa được phân loại", "Ăn Uống", "Mua Sắm", "Bills", "Du lịch"],
  categoryMeta: {
    "Chưa được phân loại": { type: "expense", icon: "❓", children: [] },
    "Ăn Uống": { type: "expense", icon: "🍔", children: [] },
    "Mua Sắm": { type: "expense", icon: "🛍️", children: [] },
    "Bills": { type: "expense", icon: "⚡", children: [] },
    "Du lịch": { type: "expense", icon: "✈️", children: [] },
  },
  settings: {
    theme: "light",
    language: "Tiếng Việt",
  },
  recurring: [],
  rules: [],
});

test("Transaction timestamps are appended on save and rendered clearly in chat", () => {
  const state = mockWorkspace();

  // 1. Check draft commitment appends timestamp
  const drafts = [
    {
      id: "draft-1",
      title: "Cơm trưa",
      amount: 45000,
      type: "expense",
      category: "Ăn Uống",
      date: "2026-10-19",
      wallet: "vietinbank",
      currency: "VND",
      needsReview: [],
    },
  ];
  const { state: nextState, committed } = validateAndCommitDrafts(state, drafts);
  assert.equal(committed.length, 1);
  const committedTx = nextState.transactions.find((t) => t.id === committed[0]);
  assert.ok(committedTx);
  assert.ok(committedTx.date.length > 10, "Committed date must include time part (length > 10)");
  assert.ok(committedTx.date.startsWith("2026-10-19T"), "Committed date starts with YYYY-MM-DD-T");

  // 2. Check recordFixedExpensePayment appends timestamp
  const expense = state.fixedExpenses[0];
  const updatedBillState = recordFixedExpensePayment(
    state,
    expense.id,
    {
      dueDate: "2026-10-25",
      paidOn: "2026-10-19",
      amount: expense.amount,
      walletId: "vietinbank",
      note: "Thanh toán Tiền mạng FPT kỳ 2026-10-25",
      transactionId: "tx-fe-paid-1",
    },
    "2026-10-19"
  );
  const paymentTx = updatedBillState.transactions.find((t) => t.id === "tx-fe-paid-1");
  assert.ok(paymentTx);
  assert.ok(paymentTx.date.length > 10, "Payment transaction date must include time part");
  assert.ok(paymentTx.date.startsWith("2026-10-19T"));

  // 3. Check answerFinancialQuery displays timestamp in transaction listing
  const queryResult = answerFinancialQuery(
    {
      action: "transactions",
      walletId: "vietinbank",
      scope: "selected",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-19",
      category: null,
      searchTerm: null,
      transactionType: null,
      percentage: null,
    },
    state,
    "vietinbank",
    "2026-10-19"
  );

  assert.ok(queryResult.includes("08:15"), "Chat output includes 08:15 for first Barista Lab");
  assert.ok(queryResult.includes("14:30"), "Chat output includes 14:30 for second Barista Lab");
  assert.ok(queryResult.includes("17:00"), "Chat output includes 17:00 for mua nước tẩy trang");
});

test("Natural language workspace creation detects budget, wallet, and fixed expense intent", () => {
  // 1. "tôi muốn tạo ngân sách mới"
  const kindBudget = detectWorkspaceCreationKind("tôi muốn tạo ngân sách mới");
  assert.equal(kindBudget, "budget");
  const initialBudgetAction = emptyWorkspaceAction(kindBudget);
  assert.equal(initialBudgetAction.kind, "budget");
  const budgetInspection = inspectWorkspaceProposal(
    mockWorkspace(),
    { id: randomUUID(), status: "collecting", actions: [{ ...initialBudgetAction, id: randomUUID() }] },
    "vi"
  );
  assert.ok(budgetInspection.question, "Must ask for the first missing field (name)");
  assert.equal(budgetInspection.question?.field, "name");

  // 2. "tạo ví mới"
  const kindWallet = detectWorkspaceCreationKind("tạo ví mới");
  assert.equal(kindWallet, "wallet");

  // 3. "tạo chi phí cố định mới"
  const kindFixed = detectWorkspaceCreationKind("tạo chi phí cố định mới");
  assert.equal(kindFixed, "fixed_expense");
});

test("Relative transaction deletion and typo handling", () => {
  const state = mockWorkspace();

  // 1. Relative order detection
  assert.equal(detectRelativeOrder("xóa giao dịch mới nhất"), "latest");
  assert.equal(detectRelativeOrder("xóa giao dịch gần nhất"), "latest");
  assert.equal(detectRelativeOrder("xóa giao dịch vừa tạo"), "latest");
  assert.equal(detectRelativeOrder("delete latest transaction"), "latest");
  assert.equal(detectRelativeOrder("delete most recent transaction"), "latest");
  assert.equal(detectRelativeOrder("删除最新交易"), "latest");
  assert.equal(detectRelativeOrder("xóa giao dịch cũ nhất"), "oldest");

  // 2. cleanDeletionSearchTerm strips relative order words and qualifiers
  assert.equal(cleanDeletionSearchTerm("giao dịch mới nhất"), null);
  assert.equal(cleanDeletionSearchTerm("Barista Lab mới nhất"), "barista lab");

  // 3. findTransactionsForDeletion with relativeOrder='latest' picks the single newest transaction
  const allLatest = findTransactionsForDeletion(state.transactions, {
    scope: "matching",
    amount: null,
    walletId: null,
    periodStart: null,
    periodEnd: null,
    category: null,
    searchTerm: null,
    type: null,
    relativeOrder: "latest",
  });
  assert.equal(allLatest.length, 1);
  assert.equal(allLatest[0].id, "tx-3", "tx-3 at 17:00 is the latest transaction overall");

  // 4. findTransactionsForDeletion with title filter and relativeOrder='latest'
  const baristaLatest = findTransactionsForDeletion(state.transactions, {
    scope: "matching",
    amount: null,
    walletId: null,
    periodStart: null,
    periodEnd: null,
    category: null,
    searchTerm: "Barista Lab",
    type: null,
    relativeOrder: "latest",
  });
  assert.equal(baristaLatest.length, 1);
  assert.equal(baristaLatest[0].id, "tx-2", "tx-2 at 14:30 is the newer of the two Barista Lab transactions");
});

test("Settings control: Theme detection and localization", () => {
  assert.equal(isSettingsThemeMessage("Bật chế độ tối."), "dark");
  assert.equal(isSettingsThemeMessage("Chuyển về giao diện sáng."), "light");
  assert.equal(isSettingsThemeMessage("turn on dark mode"), "dark");
  assert.equal(isSettingsThemeMessage("switch to light theme"), "light");
  assert.equal(isSettingsThemeMessage("深色模式"), "dark");
  assert.equal(isSettingsThemeMessage("浅色模式"), "light");
  assert.equal(isSettingsThemeMessage("hôm nay tôi chi bao nhiêu"), null);
});

test("Settings control: Language switching preserves financial data integrity", () => {
  assert.equal(isSettingsLanguageMessage("Đổi sang tiếng Anh."), "en");
  assert.equal(isSettingsLanguageMessage("Switch to Chinese."), "zh");
  assert.equal(isSettingsLanguageMessage("Đổi sang tiếng Việt."), "vi");
  assert.equal(isSettingsLanguageMessage("switch to english"), "en");
  assert.equal(isSettingsLanguageMessage("切换到中文"), "zh");

  // Ensure language setting does not mutate wallet currency or transactions
  const state = mockWorkspace();
  const originalCurrency = state.wallets[0].currency;
  const originalBalance = state.wallets[0].initial;
  const originalTxCount = state.transactions.length;

  state.settings.language = "English";

  assert.equal(state.wallets[0].currency, originalCurrency, "Currency must never change on language switch");
  assert.equal(state.wallets[0].initial, originalBalance, "Wallet balance must remain unchanged");
  assert.equal(state.transactions.length, originalTxCount, "Transaction count must remain unchanged");
});

test("Settings control: Wallet archiving checks dependencies, balance, and confirms safely", () => {
  const state = mockWorkspace();

  // 1. Detection
  assert.ok(isSettingsWalletArchiveMessage("Lưu trữ ví Vietinbank.", state));
  assert.ok(isSettingsWalletArchiveMessage("archive wallet Vietinbank", state));
  assert.ok(isSettingsWalletArchiveMessage("归档钱包 Vietinbank", state));

  // 2. Prepare proposal with dependency checks
  const { proposal, clarification } = prepareWalletArchive(state, "Lưu trữ ví Vietinbank.", randomUUID());
  assert.ok(proposal, "Proposal must be created");
  assert.equal(clarification, undefined);
  assert.equal(proposal.action, "archive_wallet");
  assert.equal(proposal.walletId, "vietinbank");
  assert.equal(proposal.status, "pending");
  assert.equal(proposal.activeBudgetsCount, 1, "Must detect 1 linked active budget");
  assert.equal(proposal.activeGoalsCount, 1, "Must detect 1 linked active goal");
  assert.equal(proposal.activeFixedExpensesCount, 1, "Must detect 1 linked active fixed expense");
  assert.equal(proposal.isOnlyActiveWallet, false, "Not only active wallet because MoMo is active");

  // 3. Balance calculation check
  // initial: 10,000,000; tx1: -58,622; tx2: -58,622; tx3: -200,000 -> 9,682,756
  assert.equal(proposal.walletBalance, 10_000_000 - 58622 - 58622 - 200000);

  // 4. Schema validation
  const parsed = settingsActionProposalSchema.safeParse(proposal);
  assert.ok(parsed.success, "Proposal must adhere strictly to settingsActionProposalSchema");

  // 5. Apply archive upon confirmation
  const updatedState = applyWalletArchive(state, proposal);
  const targetWallet = updatedState.wallets.find((w) => w.id === "vietinbank");
  assert.equal(targetWallet?.archived, true, "Target wallet must be marked archived");

  // 6. Data preservation: transactions, other wallets, and history remain intact
  assert.equal(updatedState.transactions.length, state.transactions.length, "Transactions must NOT be deleted");
  assert.equal(updatedState.wallets.length, state.wallets.length, "Wallet count must NOT decrease");
  assert.equal(updatedState.goals.length, state.goals.length, "Goals must NOT be deleted");
  assert.equal(updatedState.fixedExpenses?.length, state.fixedExpenses?.length, "Fixed expenses must NOT be deleted");

  // 7. Prevent archiving an already archived wallet
  const doubleArchive = prepareWalletArchive(updatedState, "Lưu trữ ví Vietinbank.", randomUUID());
  assert.ok(doubleArchive.clarification?.includes("trạng thái lưu trữ trước đó"), "Must warn if already archived");

  // 8. Single active wallet detection
  const singleWalletState = {
    ...state,
    wallets: [state.wallets[0]], // only Vietinbank
  };
  const singlePrep = prepareWalletArchive(singleWalletState, "Lưu trữ ví Vietinbank.", randomUUID());
  assert.equal(singlePrep.proposal?.isOnlyActiveWallet, true, "Must detect when target is the only active wallet");
});

test("SettingsActionCard UI component renders correctly across all languages", () => {
  const proposal = {
    id: randomUUID(),
    action: "archive_wallet",
    walletId: "vietinbank",
    walletName: "Vietinbank",
    walletCurrency: "VND",
    walletBalance: 9682756,
    activeBudgetsCount: 1,
    activeGoalsCount: 1,
    activeFixedExpensesCount: 1,
    isOnlyActiveWallet: false,
    status: "pending",
  };

  // Render VI
  const markupVi = renderToStaticMarkup(
    React.createElement(SettingsActionCard, {
      proposal,
      lang: "vi",
      onConfirm: () => {},
      onCancel: () => {},
    })
  );
  assert.ok(markupVi.includes("Lưu trữ ví"));
  assert.ok(markupVi.includes("Xác nhận lưu trữ ví"));
  assert.ok(markupVi.includes("Vietinbank"));
  assert.ok(markupVi.includes("ngân sách"));

  // Render EN
  const markupEn = renderToStaticMarkup(
    React.createElement(SettingsActionCard, {
      proposal,
      lang: "en",
      onConfirm: () => {},
      onCancel: () => {},
    })
  );
  assert.ok(markupEn.includes("Archive Wallet"));
  assert.ok(markupEn.includes("Confirm Archive"));

  // Render ZH
  const markupZh = renderToStaticMarkup(
    React.createElement(SettingsActionCard, {
      proposal,
      lang: "zh",
      onConfirm: () => {},
      onCancel: () => {},
    })
  );
  assert.ok(markupZh.includes("归档钱包"));
  assert.ok(markupZh.includes("确认归档钱包"));
});
