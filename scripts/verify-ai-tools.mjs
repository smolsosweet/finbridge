import assert from "node:assert/strict";
import test from "node:test";
import {
  aiBusinessTools,
  checkUpcomingObligationsTool,
  executeAiTool,
  manageCategoriesTool,
  proposeWorkspaceEntityTool,
  queryFinancesTool,
  simulateScenarioTool,
  stageTransactionDraftsTool,
} from "../src/lib/ai-tools/index.ts";

function createMockState() {
  return {
    wallets: [
      { id: "wallet-vnd", name: "Ví Tiền Mặt", currency: "VND", initial: 5_000_000, type: "cash" },
      { id: "wallet-usd", name: "USD Savings", currency: "USD", initial: 1_000, type: "cash" },
      { id: "wallet-archived", name: "Ví Cũ", currency: "VND", initial: 0, type: "cash", archived: true },
    ],
    categories: ["Thức ăn & Đồ uống", "Mua sắm", "Lương", "Nhà cửa", "Chưa được phân loại"],
    categoryMeta: {
      "Thức ăn & Đồ uống": { type: "expense" },
      "Mua sắm": { type: "expense" },
      "Lương": { type: "income" },
      "Nhà cửa": { type: "expense" },
      "Chưa được phân loại": { type: "expense" },
    },
    transactions: [
      {
        id: "tx-1",
        wallet: "wallet-vnd",
        category: "Thức ăn & Đồ uống",
        type: "expense",
        amount: 50_000,
        date: "2026-10-15",
        title: "Ăn trưa",
      },
      {
        id: "tx-2",
        wallet: "wallet-usd",
        category: "Mua sắm",
        type: "expense",
        amount: 100,
        date: "2026-10-16",
        title: "Online book",
      },
    ],
    goals: [
      {
        id: "budget-1",
        kind: "budget",
        title: "Ngân sách ăn uống",
        amount: 2_000_000,
        saved: 0,
        currency: "VND",
        date: "2026-10-01",
        cycle: "monthly",
        category: "Thức ăn & Đồ uống",
        wallet: "wallet-vnd",
        direction: "",
        person: "",
      },
    ],
    fixedExpenses: [
      {
        id: "bill-rent",
        budgetId: "",
        title: "Tiền thuê nhà",
        amount: 3_000_000,
        walletId: "wallet-vnd",
        category: "Nhà cửa",
        dueDate: "2026-10-25",
        recurrence: "monthly",
        active: true,
      },
      {
        id: "bill-server",
        budgetId: "",
        title: "Cloud hosting",
        amount: 20,
        walletId: "wallet-usd",
        category: "Mua sắm",
        dueDate: "2026-10-22",
        recurrence: "monthly",
        active: true,
      },
    ],
    recurring: [],
    rules: [],
    settings: {},
  };
}

function createMockContext(overrides = {}) {
  return {
    userId: "user-test-123",
    state: createMockState(),
    today: "2026-10-19",
    timeZone: "Asia/Ho_Chi_Minh",
    language: "vi",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. query_finances tests
// ---------------------------------------------------------------------------
test("query_finances: reads balance deterministically for owned wallet", async () => {
  const context = createMockContext();
  const result = await queryFinancesTool.execute(
    { action: "balance", walletId: "wallet-vnd", scope: "selected" },
    context
  );

  assert.equal(result.action, "balance");
  assert.equal(result.walletId, "wallet-vnd");
  assert.match(result.answerText, /4[.,]950[.,]000/); // 5M initial - 50k tx
});

test("query_finances: rejects unauthorized or non-existent wallet", async () => {
  const context = createMockContext();
  await assert.rejects(
    async () => {
      await queryFinancesTool.execute(
        { action: "balance", walletId: "foreign-wallet-999", scope: "selected" },
        context
      );
    },
    /WALLET_NOT_FOUND/
  );
});

test("query_finances: rejects archived wallet", async () => {
  const context = createMockContext();
  await assert.rejects(
    async () => {
      await queryFinancesTool.execute(
        { action: "balance", walletId: "wallet-archived", scope: "selected" },
        context
      );
    },
    /WALLET_NOT_FOUND/
  );
});

test("query_finances: validates date range (rejects start > end)", async () => {
  const context = createMockContext();
  await assert.rejects(
    async () => {
      await queryFinancesTool.execute(
        {
          action: "spending_summary",
          periodStart: "2026-10-25",
          periodEnd: "2026-10-10",
        },
        context
      );
    },
    /INVALID_DATE_RANGE/
  );
});

// ---------------------------------------------------------------------------
// 2. simulate_scenario tests
// ---------------------------------------------------------------------------
test("simulate_scenario: calculates projected balances and shortfalls safely", async () => {
  const context = createMockContext();
  const result = await simulateScenarioTool.execute(
    {
      name: "Mua laptop",
      changes: [
        {
          title: "MacBook Pro",
          amount: 10_000_000,
          direction: "expense",
          walletId: "wallet-vnd",
          category: "Mua sắm",
        },
      ],
    },
    context
  );

  assert.equal(result.name, "Mua laptop");
  // calculateScenario isolates projected results to touched wallets
  assert.equal(result.wallets.length, 1);
  const vndWallet = result.wallets[0];
  assert.equal(vndWallet.walletId, "wallet-vnd");
  assert.equal(vndWallet.currency, "VND");
  // 4.95M balance - 10M laptop - 3M rent -> deficit
  assert.equal(result.hasShortfall, true);
  assert.ok(vndWallet.shortfall > 0);
});

test("simulate_scenario: rejects non-existent wallet in changes", async () => {
  const context = createMockContext();
  await assert.rejects(
    async () => {
      await simulateScenarioTool.execute(
        {
          name: "Chi tiêu ảo",
          changes: [
            {
              title: "Khoản chi lạ",
              amount: 500_000,
              direction: "expense",
              walletId: "wallet-does-not-exist",
            },
          ],
        },
        context
      );
    },
    /WALLET_NOT_FOUND/
  );
});

// ---------------------------------------------------------------------------
// 3. check_upcoming_obligations tests
// ---------------------------------------------------------------------------
test("check_upcoming_obligations: inspects unpaid bills with isolated currencies", async () => {
  const context = createMockContext();
  const result = await checkUpcomingObligationsTool.execute(
    { daysAhead: 30 },
    context
  );

  assert.equal(result.totalBillsCount, 2);
  // Currency isolation verification: VND and USD must never be merged
  assert.equal(result.totalUnpaidByCurrency["VND"], 3_000_000);
  assert.equal(result.totalUnpaidByCurrency["USD"], 20);
  assert.equal(Object.keys(result.totalUnpaidByCurrency).length, 2);

  const rent = result.bills.find((b) => b.title === "Tiền thuê nhà");
  assert.ok(rent);
  assert.equal(rent.currency, "VND");
  assert.equal(rent.isOverdue, false);
});

test("check_upcoming_obligations: rejects invalid date bounds", async () => {
  const context = createMockContext();
  await assert.rejects(
    async () => {
      await checkUpcomingObligationsTool.execute(
        { periodStart: "2026-11-01", periodEnd: "2026-10-01" },
        context
      );
    },
    /INVALID_DATE_RANGE/
  );
});

// ---------------------------------------------------------------------------
// 4. stage_transaction_drafts tests
// ---------------------------------------------------------------------------
test("stage_transaction_drafts: stages drafts without writing to state", async () => {
  const context = createMockContext();
  const initialTxCount = context.state.transactions.length;

  const result = await stageTransactionDraftsTool.execute(
    {
      items: [
        {
          title: "Ăn bún bò",
          amount: 45_000,
          currency: "VND",
          type: "expense",
        },
      ],
    },
    context
  );

  // Safety guarantee 1: Flag explicitly marks uncommitted state
  assert.equal(result.isCommittedToDatabase, false);
  assert.equal(result.totalDrafts, 1);
  assert.equal(result.drafts[0].amount, 45_000);
  assert.equal(result.drafts[0].wallet, "wallet-vnd");
  assert.equal(result.drafts[0].category, "Thức ăn & Đồ uống");

  // Safety guarantee 2: Absolute immutability of underlying ledger
  assert.equal(
    context.state.transactions.length,
    initialTxCount,
    "Staging drafts MUST NOT mutate the database or state transactions"
  );
});

test("stage_transaction_drafts: strictly isolates currency and detects mismatch", async () => {
  const context = createMockContext();
  const result = await stageTransactionDraftsTool.execute(
    {
      items: [
        {
          title: "Mua phần mềm USD trên ví VND",
          amount: 50,
          currency: "USD",
          walletId: "wallet-vnd", // Wallet currency is VND, requested is USD
        },
      ],
    },
    context
  );

  assert.equal(result.totalDrafts, 1);
  const draft = result.drafts[0];
  // Conflict must prevent wallet assignment and require review
  assert.equal(draft.wallet, null);
  assert.ok(draft.needsReview.includes("wallet"));
});

test("stage_transaction_drafts: flags missing amount for user review", async () => {
  const context = createMockContext();
  const result = await stageTransactionDraftsTool.execute(
    {
      items: [
        {
          title: "Đi ăn phở chưa biết giá",
          type: "expense",
        },
      ],
    },
    context
  );

  assert.equal(result.readyCount, 0);
  assert.ok(result.drafts[0].needsReview.includes("amount"));
});

// ---------------------------------------------------------------------------
// 5. manage_categories tests
// ---------------------------------------------------------------------------
test("manage_categories: previews impact without mutating categories", async () => {
  const context = createMockContext();
  const initialCategoriesCount = context.state.categories.length;

  const result = await manageCategoriesTool.execute(
    {
      operation: "rename_category",
      sources: ["Mua sắm"],
      target: "Mua sắm cá nhân",
    },
    context
  );

  assert.equal(result.isCommittedToDatabase, false);
  assert.equal(result.requiresUserConfirmation, true);
  assert.ok(result.fingerprint);
  // Impact preview matches mock state: 1 tx uses "Mua sắm"
  assert.equal(result.impact.transactions, 1);

  // Safety guarantee: AppState categories remain untouched
  assert.equal(context.state.categories.length, initialCategoriesCount);
  assert.ok(context.state.categories.includes("Mua sắm"));
  assert.ok(!context.state.categories.includes("Mua sắm cá nhân"));
});

test("manage_categories: protects default system category from deletion", async () => {
  const context = createMockContext();
  await assert.rejects(
    async () => {
      await manageCategoriesTool.execute(
        {
          operation: "delete_category",
          sources: ["Chưa được phân loại"],
        },
        context
      );
    },
    /PROTECTED_CATEGORY/
  );
});

// ---------------------------------------------------------------------------
// 6. propose_workspace_entity tests
// ---------------------------------------------------------------------------
test("propose_workspace_entity: asks clarifying questions when information is incomplete", async () => {
  const context = createMockContext();
  const result = await proposeWorkspaceEntityTool.execute(
    {
      kind: "wallet",
      name: "Ví Ngân Hàng Mới",
      // Missing currency, walletType, initialBalance
    },
    context
  );

  assert.equal(result.status, "collecting");
  assert.equal(result.isCommittedToDatabase, false);
  assert.ok(result.question);
  assert.equal(result.question.field, "currency");
  assert.ok(result.question.choices.length > 0);
});

test("propose_workspace_entity: sets status to review when all fields are valid", async () => {
  const context = createMockContext();
  const initialWalletsCount = context.state.wallets.length;

  const result = await proposeWorkspaceEntityTool.execute(
    {
      kind: "wallet",
      name: "Ví Tiết Kiệm Techcombank",
      currency: "VND",
      walletType: "cash",
      initialBalance: 10_000_000,
    },
    context
  );

  assert.equal(result.status, "review");
  assert.equal(result.requiresUserConfirmation, true);
  assert.equal(result.isCommittedToDatabase, false);

  // Safety guarantee: Wallets collection not mutated
  assert.equal(context.state.wallets.length, initialWalletsCount);
});

test("propose_workspace_entity: rejects unauthorized parent wallet for budget", async () => {
  const context = createMockContext();
  await assert.rejects(
    async () => {
      await proposeWorkspaceEntityTool.execute(
        {
          kind: "budget",
          name: "Ngân sách lậu",
          walletId: "unowned-wallet-404",
        },
        context
      );
    },
    /Unauthorized: Wallet with id "unowned-wallet-404"/
  );
});

// ---------------------------------------------------------------------------
// 7. Dispatcher tests (executeAiTool)
// ---------------------------------------------------------------------------
test("executeAiTool: safely dispatches known tool and encapsulates result", async () => {
  const context = createMockContext();
  const response = await executeAiTool(
    "query_finances",
    { action: "balance", walletId: "wallet-vnd" },
    context
  );

  assert.equal(response.success, true);
  assert.equal(response.toolName, "query_finances");
  assert.equal(response.isCommittedToDatabase, false);
  assert.ok(response.data);
});

test("executeAiTool: handles unknown tool gracefully without crashing", async () => {
  const context = createMockContext();
  const response = await executeAiTool("non_existent_tool", {}, context);

  assert.equal(response.success, false);
  assert.equal(response.isCommittedToDatabase, false);
  assert.match(response.error, /Unknown AI tool/);
});

test("executeAiTool: safely catches internal validation errors", async () => {
  const context = createMockContext();
  const response = await executeAiTool(
    "query_finances",
    { action: "balance", walletId: "invalid-id" },
    context
  );

  assert.equal(response.success, false);
  assert.equal(response.isCommittedToDatabase, false);
  assert.match(response.error, /WALLET_NOT_FOUND/);
});
