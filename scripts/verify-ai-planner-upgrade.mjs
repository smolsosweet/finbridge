import assert from "node:assert/strict";
import test from "node:test";
import {
  parseVietnameseFinancialExpressions,
  normalizePlannerResponse,
  calculateScenario,
  cleanJsonText,
  validDateKey,
  getStartOfMonth,
  getEndOfMonth,
  getPriorMonthRange,
  getWeekRange,
  resolveRelativePeriod,
  findPreviousScenarioFromHistory,
  addDays,
} from "../src/lib/scenario-planner.ts";
import { answerFinancialQuery } from "../src/lib/financial-chat.ts";

const mockContext = {
  wallets: [
    { id: "wallet-vnd", name: "Ví chính", currency: "VND" },
    { id: "wallet-usd", name: "Visa USD", currency: "USD" },
  ],
  budgets: [
    { id: "b1", title: "Ăn uống", currency: "VND", category: "Food", wallet: "wallet-vnd" },
  ],
  fixedExpenses: [
    { id: "f1", budgetId: "b1", title: "Tiền trọ", category: "Food", dueDate: "2026-10-25", recurrence: "monthly", walletId: "wallet-vnd" },
  ],
  goals: [],
  categories: ["Food", "Transport", "Rent", "Salary"],
};

test("Vietnamese financial expressions: parses colloquial amounts, units, daily spending and relative dates", () => {
  // Test amounts and colloquial words
  const exp300k = parseVietnameseFinancialExpressions("nếu một ngày tôi dùng 300k thì cuối tháng còn tiền không", "2026-10-17");
  assert.equal(exp300k.detectedAmount, 300_000);
  assert.equal(exp300k.isDaily, true);
  assert.equal(exp300k.isEndOfMonth, true);
  assert.equal(exp300k.detectedCurrency, "VND");
  assert.equal(exp300k.intentHint, "scenario");

  const exp1Cu = parseVietnameseFinancialExpressions("mai chuyển 1 củ đóng tiền mạng", "2026-10-17");
  assert.equal(exp1Cu.detectedAmount, 1_000_000);
  assert.equal(exp1Cu.isTomorrow, true);

  const exp2CuRuoi = parseVietnameseFinancialExpressions("tháng này tiết kiệm được 2 củ rưỡi không", "2026-10-17");
  assert.equal(exp2CuRuoi.detectedAmount, 2_500_000);

  const exp5Lit = parseVietnameseFinancialExpressions("mỗi ngày tiêu 5 lít", "2026-10-17");
  assert.equal(exp5Lit.detectedAmount, 500_000);
  assert.equal(exp5Lit.isDaily, true);

  const exp50Tr = parseVietnameseFinancialExpressions("dự định mua xe 50 triệu", "2026-10-17");
  assert.equal(exp50Tr.detectedAmount, 50_000_000);

  const exp1Toi = parseVietnameseFinancialExpressions("mục tiêu 1 tỏi", "2026-10-17");
  assert.equal(exp1Toi.detectedAmount, 1_000_000_000);

  const exp500Nghin = parseVietnameseFinancialExpressions("chi 500 nghìn đi chợ", "2026-10-17");
  assert.equal(exp500Nghin.detectedAmount, 500_000);

  const expUsd = parseVietnameseFinancialExpressions("chi tiêu $150 ngày mai", "2026-10-17");
  assert.equal(expUsd.detectedAmount, 150);
  assert.equal(expUsd.detectedCurrency, "USD");
  assert.equal(expUsd.isTomorrow, true);
});

test("cleanJsonText: strips markdown code fences, leading text, and trailing commentary", () => {
  const fenced = "```json\n{\"intent\":\"scenario\",\"reply\":\"OK\"}\n```";
  assert.equal(cleanJsonText(fenced), "{\"intent\":\"scenario\",\"reply\":\"OK\"}");

  const wrapped = "Here is the plan:\n```json\n{\"intent\":\"scenario\"}\n```\nHope that helps!";
  assert.equal(cleanJsonText(wrapped), "{\"intent\":\"scenario\"}");

  const raw = "  {\"intent\":\"general_advice\"}  ";
  assert.equal(cleanJsonText(raw), "{\"intent\":\"general_advice\"}");
});

test("Date utilities: getEndOfMonth, validDateKey, and addDays calculate correctly", () => {
  assert.equal(getEndOfMonth("2026-10-17"), "2026-10-31");
  assert.equal(getEndOfMonth("2024-02-10"), "2024-02-29"); // leap year
  assert.equal(validDateKey("2026-10-31"), true);
  assert.equal(validDateKey("2026-02-30"), false); // invalid date
  assert.equal(addDays("2026-10-17", 1), "2026-10-18");
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
});

test("normalizePlannerResponse: handles daily_limit with omitted optional fields safely", () => {
  const input = {
    message: "nếu một ngày tôi dùng 300k thì cuối tháng còn tiền không",
    today: "2026-10-17",
    context: mockContext,
  };

  // Model output with omitted title, direction, percent, category
  const rawModelOutput = {
    intent: "scenario",
    reply: "Dưới đây là dự báo khi bạn chi tiêu tối đa 300.000 VND mỗi ngày đến cuối tháng.",
    scenarios: [
      {
        name: "Chi 300k/ngày đến cuối tháng",
        horizonEnd: "2026-10-31",
        actions: [
          {
            kind: "daily_limit",
            walletId: "wallet-vnd",
            amount: 300000,
            currency: "VND",
            startDate: "2026-10-17",
            endDate: "2026-10-31",
          },
        ],
      },
    ],
  };

  const normalized = normalizePlannerResponse(rawModelOutput, input);
  assert.equal(normalized.intent, "scenario");
  assert.equal(normalized.scenarios.length, 1);
  const sc = normalized.scenarios[0];
  assert.equal(sc.dailySpendingLimits?.length, 1);
  assert.equal(sc.dailySpendingLimits[0].amount, 300000);
  assert.equal(sc.dailySpendingLimits[0].walletId, "wallet-vnd");
  assert.equal(sc.dailySpendingLimits[0].currency, "VND");
  assert.equal(sc.dailySpendingLimits[0].startDate, "2026-10-17");
  assert.equal(sc.dailySpendingLimits[0].endDate, "2026-10-31");
});

test("normalizePlannerResponse: parses string amounts and normalizes string numbers", () => {
  const input = {
    message: "mai mua quà 500k",
    today: "2026-10-17",
    context: mockContext,
    selectedWalletId: "wallet-vnd",
  };

  const rawModelOutput = {
    intent: "scenario",
    scenarios: [
      {
        name: "Mua quà",
        actions: [
          {
            kind: "planned_change",
            title: "Quà tặng",
            amount: "500000", // string amount from model
            direction: "expense",
            date: "2026-10-18",
            currency: "VND",
          },
        ],
      },
    ],
  };

  const normalized = normalizePlannerResponse(rawModelOutput, input);
  assert.equal(normalized.scenarios[0].changes[0].amount, 500000);
  assert.equal(normalized.scenarios[0].changes[0].walletId, "wallet-vnd");
});

test("normalizePlannerResponse: routes financial query and extracts parameters", () => {
  const input = {
    message: "tháng này tôi đã tiêu bao nhiêu tiền ăn uống",
    today: "2026-10-17",
    context: mockContext,
  };

  const rawModelOutput = {
    intent: "financial_query",
    query: {
      action: "spending_summary",
      category: "Food",
      period: "this_month",
    },
  };

  const normalized = normalizePlannerResponse(rawModelOutput, input);
  assert.equal(normalized.intent, "financial_query");
  assert.equal(normalized.query?.action, "spending_summary");
  assert.equal(normalized.query?.category, "Food");
});

test("normalizePlannerResponse: routes general advice without forcing empty scenario cards", () => {
  const input = {
    message: "làm sao để tôi tiết kiệm được nhiều tiền hơn mỗi tháng?",
    today: "2026-10-17",
    context: mockContext,
  };

  const rawModelOutput = {
    intent: "general_advice",
    reply: "Bạn có thể áp dụng quy tắc 50/30/20 và theo dõi chi tiêu cố định thường xuyên.",
  };

  const normalized = normalizePlannerResponse(rawModelOutput, input);
  assert.equal(normalized.intent, "general_advice");
  assert.equal(normalized.scenarios.length, 0);
  assert.match(normalized.reply, /50\/30\/20/);
});

test("normalizePlannerResponse: prompts clarification with walletChoices when wallet is ambiguous", () => {
  const input = {
    message: "chi 500k ngày mai",
    today: "2026-10-17",
    context: {
      ...mockContext,
      wallets: [
        { id: "w-vcb", name: "Vietcombank", currency: "VND" },
        { id: "w-momo", name: "Ví MoMo", currency: "VND" },
      ],
    },
    // selectedWalletId not provided and multiple wallets exist
  };

  const rawModelOutput = {
    intent: "clarification",
    clarification: "Bạn muốn mô phỏng khoản chi này trên ví nào?",
  };

  const normalized = normalizePlannerResponse(rawModelOutput, input);
  assert.equal(normalized.intent, "clarification");
  assert.equal(normalized.walletChoices.length, 2);
  assert.equal(normalized.walletChoices[0].id, "w-vcb");
  assert.equal(normalized.walletChoices[1].id, "w-momo");
});

test("normalizePlannerResponse: resilient fallback when model output is malformed or empty", () => {
  const input = {
    message: "nếu một ngày tôi dùng 300k thì cuối tháng còn tiền không",
    today: "2026-10-17",
    context: mockContext,
  };

  // Malformed or empty model output: null, garbage, or empty object
  const normalized = normalizePlannerResponse(null, input);
  assert.equal(normalized.intent, "scenario");
  assert.equal(normalized.scenarios.length, 1);
  const limit = normalized.scenarios[0].dailySpendingLimits?.[0];
  assert.equal(limit?.amount, 300000);
  assert.equal(limit?.walletId, "wallet-vnd");
  assert.equal(limit?.startDate, "2026-10-17");
  assert.equal(limit?.endDate, "2026-10-31");
});

test("calculateScenario: accurately forecasts daily spending limit, detects shortfall and computes safe cap", () => {
  const appState = {
    wallets: [
      { id: "w1", name: "Ví chính", currency: "VND", initial: 5_000_000, type: "cash" },
    ],
    transactions: [
      // Current balance = 5,000,000 - 1,000,000 = 4,000,000 VND
      { id: "t1", title: "Mua sắm", amount: 1_000_000, type: "expense", category: "Shopping", date: "2026-10-10", wallet: "w1", note: "" },
    ],
    goals: [],
    fixedExpenses: [
      // Upcoming rent: 1,500,000 due 2026-10-25
      { id: "f1", budgetId: "", title: "Tiền phòng", amount: 1_500_000, category: "Rent", dueDate: "2026-10-25", recurrence: "once", active: true, walletId: "w1" },
    ],
    categories: ["Shopping", "Rent"],
    settings: { language: "Tiếng Việt" },
  };

  // Available before daily spending: 4,000,000 - 1,500,000 = 2,500,000 VND.
  // Daily spending: 300,000 VND/day from 2026-10-17 to 2026-10-31 (15 days).
  // Total daily spend = 15 * 300,000 = 4,500,000 VND.
  // Projected balance = 4,000,000 - 1,500,000 - 4,500,000 = -2,000,000 VND (Shortfall = 2,000,000 VND).
  const scenario = {
    id: "sc-daily-300k",
    name: "Chi 300k/ngày",
    changes: [],
    dailySpendingLimits: [
      {
        walletId: "w1",
        amount: 300_000,
        currency: "VND",
        startDate: "2026-10-17",
        endDate: "2026-10-31",
      },
    ],
    horizonEnd: "2026-10-31",
    estimateSpending: false,
    assumptions: [],
  };

  const result = calculateScenario(appState, scenario, "2026-10-17");
  const w1Projection = result.wallets.find((w) => w.walletId === "w1");
  assert.ok(w1Projection);
  assert.equal(w1Projection.balanceNow, 4_000_000);
  assert.equal(w1Projection.projectedBalance, -1_700_000);
  assert.equal(w1Projection.shortfall, 1_700_000);

  // Safe daily limit = Math.floor(2,500,000 / 14) = 178,571 VND/day
  assert.ok(result.suggestions.some((s) => s.includes("consider a daily spending limit of at most 178571 VND/day.")));
  assert.ok(result.assumptions.some((a) => a.includes("User-specified daily spending limits replace")));
});

test("calculateScenario: when obligations exceed balance, advises pausing non-essential daily spending", () => {
  const appState = {
    wallets: [
      { id: "w1", name: "Ví chính", currency: "VND", initial: 1_000_000, type: "cash" },
    ],
    transactions: [],
    goals: [],
    fixedExpenses: [
      { id: "f1", budgetId: "", title: "Nợ thẻ", amount: 2_000_000, category: "Debt", dueDate: "2026-10-25", recurrence: "once", active: true, walletId: "w1" },
    ],
    categories: ["Debt"],
    settings: { language: "Tiếng Việt" },
  };

  const scenario = {
    id: "sc-daily-100k",
    name: "Chi 100k/ngày",
    changes: [],
    dailySpendingLimits: [
      {
        walletId: "w1",
        amount: 100_000,
        currency: "VND",
        startDate: "2026-10-17",
        endDate: "2026-10-31",
      },
    ],
    horizonEnd: "2026-10-31",
    estimateSpending: false,
    assumptions: [],
  };

  const result = calculateScenario(appState, scenario, "2026-10-17");
  const w1Projection = result.wallets.find((w) => w.walletId === "w1");
  assert.ok(w1Projection);
  assert.equal(w1Projection.shortfall > 0, true);
  assert.ok(result.suggestions.some((s) => s.includes("Upcoming obligations leave no funds for flexible spending in Ví chính; pause non-essential daily spending")));
});

test("Relative date resolution: resolves natural date ranges and clamps end to today for historical actuals", () => {
  const today = "2026-10-17";

  const thisMonth = resolveRelativePeriod("chi tiêu tháng này thế nào", today);
  assert.equal(thisMonth.start, "2026-10-01");
  assert.equal(thisMonth.end, "2026-10-31");

  const lastMonth = resolveRelativePeriod("tháng trước tôi tiêu bao nhiêu", today);
  assert.equal(lastMonth.start, "2026-09-01");
  assert.equal(lastMonth.end, "2026-09-30");

  const thisWeek = resolveRelativePeriod("tuần này chi bao nhiêu", today);
  assert.ok(thisWeek.start && thisWeek.end);
  assert.ok(thisWeek.start <= today);

  const thirtyDays = resolveRelativePeriod("chi tiêu 30 ngày qua", today);
  assert.equal(thirtyDays.start, "2026-09-17");
  assert.equal(thirtyDays.end, "2026-10-17");

  // In financial query: when user asks about "tháng này", end is 2026-10-31,
  // but answerFinancialQuery clamps end to today (2026-10-17) for historical actions
  const appState = {
    wallets: [{ id: "w1", name: "Ví chính", currency: "VND", initial: 10_000_000, type: "cash" }],
    transactions: [
      { id: "t1", title: "Cơm trưa", amount: 50_000, type: "expense", category: "Food", date: "2026-10-10", wallet: "w1", note: "" },
    ],
    goals: [],
    fixedExpenses: [],
    categories: ["Food"],
    settings: { language: "Tiếng Việt" },
  };

  const query = {
    action: "spending_summary",
    periodStart: "2026-10-01",
    periodEnd: "2026-10-31", // End of month in future
    walletId: "w1",
    scope: "selected",
  };

  const answer = answerFinancialQuery(query, appState, "w1", today);
  // Must NOT prompt for start/end date
  assert.doesNotMatch(answer, /Khoảng ngày chưa hợp lệ/);
  assert.match(answer, /50[,.]000/);
});

test("Compound query: answers 'Tháng này tôi tiêu nhiều nhất vào khoản nào? Có gì bất thường không?' in one unified answer", () => {
  const today = "2026-10-17";
  const message = "Tháng này tôi tiêu nhiều nhất vào khoản nào? Có gì bất thường không?";

  const parsed = parseVietnameseFinancialExpressions(message, today);
  assert.deepEqual(parsed.actionHints, ["top_category", "anomalies"]);
  assert.equal(parsed.intentHint, "financial_query");
  assert.equal(parsed.periodStart, "2026-10-01");
  assert.equal(parsed.periodEnd, "2026-10-31");

  const appState = {
    wallets: [{ id: "w1", name: "Ví chính", currency: "VND", initial: 20_000_000, type: "cash" }],
    transactions: [
      { id: "t1", title: "Cơm trưa", amount: 1_200_000, type: "expense", category: "Ăn uống", date: "2026-10-05", wallet: "w1", note: "" },
      { id: "t2", title: "Trà sữa", amount: 300_000, type: "expense", category: "Ăn uống", date: "2026-10-08", wallet: "w1", note: "" },
      { id: "t3", title: "Xăng xe", amount: 200_000, type: "expense", category: "Di chuyển", date: "2026-10-09", wallet: "w1", note: "" },
      // Prior months history to test anomaly detection
      { id: "t4", title: "Cơm", amount: 1_000_000, type: "expense", category: "Ăn uống", date: "2026-09-10", wallet: "w1", note: "" },
      { id: "t5", title: "Cơm", amount: 1_000_000, type: "expense", category: "Ăn uống", date: "2026-08-10", wallet: "w1", note: "" },
      { id: "t6", title: "Xăng", amount: 180_000, type: "expense", category: "Di chuyển", date: "2026-09-15", wallet: "w1", note: "" },
    ],
    goals: [],
    fixedExpenses: [],
    categories: ["Ăn uống", "Di chuyển"],
    settings: { language: "Tiếng Việt" },
  };

  const normalized = normalizePlannerResponse(null, {
    message,
    today,
    context: {
      wallets: [{ id: "w1", name: "Ví chính", currency: "VND" }],
      budgets: [],
      fixedExpenses: [],
      goals: [],
      categories: ["Ăn uống", "Di chuyển"],
    },
  });

  assert.equal(normalized.intent, "financial_query");
  assert.ok(normalized.query);
  assert.deepEqual(normalized.query.actions, ["top_category", "anomalies"]);

  const answer = answerFinancialQuery(normalized.query, appState, "w1", today);
  // Answers both questions
  assert.match(answer, /1\./);
  assert.match(answer, /2\./);
  assert.match(answer, /Ăn uống/);
  assert.match(answer, /1[,.]500[,.]000/); // 1.2M + 0.3M
  // No date error
  assert.doesNotMatch(answer, /Khoảng ngày chưa hợp lệ/);
});

test("Follow-up scenarios: updating 300k/day to 200k/day retains wallet and recalculates correctly", () => {
  const today = "2026-10-17";
  const appState = {
    wallets: [{ id: "w1", name: "Ví chính", currency: "VND", initial: 10_000_000, type: "cash" }],
    transactions: [],
    goals: [],
    fixedExpenses: [],
    categories: [],
    settings: { language: "Tiếng Việt" },
  };

  // Turn 1 scenario
  const history = [
    { role: "user", text: "Nếu tôi tiêu 300k một ngày cho đến cuối tháng thì sao?" },
    {
      role: "assistant",
      text: 'Previous hypothetical scenario parameters: [{"name":"Giới hạn chi 300.000 ₫/ngày","changes":[],"dailySpendingLimits":[{"amount":300000,"walletId":"w1","currency":"VND","startDate":"2026-10-18","endDate":"2026-10-31"}],"horizonEnd":"2026-10-31","estimateSpending":false}]',
    },
  ];

  // Turn 2 follow-up
  const followUpMessage = "đổi thành 200k/ngày";
  const normalized = normalizePlannerResponse(null, {
    message: followUpMessage,
    today,
    history,
    context: {
      wallets: [{ id: "w1", name: "Ví chính", currency: "VND" }],
      budgets: [],
      fixedExpenses: [],
      goals: [],
      categories: [],
    },
  });

  assert.equal(normalized.intent, "scenario");
  assert.equal(normalized.scenarios.length, 1);
  const sc200 = normalized.scenarios[0];
  assert.equal(sc200.dailySpendingLimits?.[0]?.amount, 200_000);
  assert.equal(sc200.dailySpendingLimits?.[0]?.walletId, "w1");
  assert.equal(sc200.horizonEnd, "2026-10-31");

  // Calculate Scenario 1 (300k/day)
  const sc300 = {
    id: "sc300",
    name: "Chi 300k/ngày",
    changes: [],
    dailySpendingLimits: [{ amount: 300_000, walletId: "w1", currency: "VND", startDate: "2026-10-18", endDate: "2026-10-31" }],
    horizonEnd: "2026-10-31",
    estimateSpending: false,
    assumptions: [],
  };
  const res300 = calculateScenario(appState, sc300, today);

  // Calculate Scenario 2 (200k/day)
  const res200 = calculateScenario(appState, sc200, today);

  // 14 days from 2026-10-18 to 2026-10-31
  // Spend difference = (300k - 200k) * 14 = 1,400,000 VND
  const bal300 = res300.wallets[0].projectedBalance;
  const bal200 = res200.wallets[0].projectedBalance;
  assert.equal(bal200 - bal300, 1_400_000);
});

test("Follow-up scenarios: updating tuition expense preserves daily limit and wallet", () => {
  const today = "2026-10-17";
  const history = [
    { role: "user", text: "Nếu tôi đóng học phí 5 triệu ngày 20 và chi 300k/ngày thì sao?" },
    {
      role: "assistant",
      text: 'Previous hypothetical scenario parameters: [{"name":"Kịch bản tài chính","changes":[{"title":"Học phí","amount":5000000,"direction":"expense","walletId":"w1","currency":"VND","date":"2026-10-20","category":"Education"}],"dailySpendingLimits":[{"amount":300000,"walletId":"w1","currency":"VND","startDate":"2026-10-18","endDate":"2026-10-31"}],"horizonEnd":"2026-10-31","estimateSpending":false}]',
    },
  ];

  const followUpMessage = "đổi học phí thành 4 triệu";
  const normalized = normalizePlannerResponse(null, {
    message: followUpMessage,
    today,
    history,
    context: {
      wallets: [{ id: "w1", name: "Ví chính", currency: "VND" }],
      budgets: [],
      fixedExpenses: [],
      goals: [],
      categories: ["Education"],
    },
  });

  assert.equal(normalized.intent, "scenario");
  const sc = normalized.scenarios[0];
  assert.equal(sc.changes[0]?.amount, 4_000_000);
  assert.equal(sc.changes[0]?.walletId, "w1");
  assert.equal(sc.dailySpendingLimits?.[0]?.amount, 300_000);
  assert.equal(sc.dailySpendingLimits?.[0]?.walletId, "w1");
});

test("Missing history vs user-defined limits: does not warn missing history for wallets with daily limits", () => {
  const today = "2026-10-17";
  const appState = {
    wallets: [{ id: "w1", name: "Ví chính", currency: "VND", initial: 10_000_000, type: "cash" }],
    transactions: [], // No transaction history
    goals: [],
    fixedExpenses: [],
    categories: [],
    settings: { language: "Tiếng Việt" },
  };

  // Scenario with user-defined daily spending limit and estimateSpending: true
  const scenario = {
    id: "sc1",
    name: "Chi 200k/ngày",
    changes: [],
    dailySpendingLimits: [{ amount: 200_000, walletId: "w1", currency: "VND", startDate: "2026-10-18", endDate: "2026-10-31" }],
    horizonEnd: "2026-10-31",
    estimateSpending: true,
    assumptions: [],
  };

  const result = calculateScenario(appState, scenario, today);
  // Should NOT warn about missing history for w1 because w1 has a user-defined daily limit!
  assert.equal(result.unavailableEstimates.length, 0);
  assert.equal(result.confidence, "user-defined");
});

test("Pace forecast explanations: accurately reflects current-month pace vs historical average", () => {
  const today = "2026-10-17";
  const appState = {
    wallets: [{ id: "w1", name: "Ví chính", currency: "VND", initial: 10_000_000, type: "cash" }],
    transactions: [
      // Current month transaction
      { id: "t1", title: "Cơm", amount: 100_000, type: "expense", category: "Food", date: "2026-10-10", wallet: "w1", note: "" },
    ],
    goals: [],
    fixedExpenses: [],
    categories: ["Food"],
    settings: { language: "Tiếng Việt" },
  };

  const scenario = {
    id: "sc-pace",
    name: "Dự báo cuối tháng",
    changes: [],
    horizonEnd: "2026-10-31",
    estimateSpending: true,
    assumptions: [],
  };

  const result = calculateScenario(appState, scenario, today);
  // Spending estimate basis is current-month-pace
  assert.equal(result.estimatedSpending[0]?.basis, "current-month-pace");
  // Assumptions should explain current-month pace, NOT historical average
  assert.ok(result.assumptions.some((a) => a.includes("Flexible spending uses this month's recorded daily pace.")));
  assert.ok(result.assumptions.some((a) => a.includes("Projected daily spending is based on your pace so far this month")));
  assert.ok(!result.assumptions.some((a) => a.includes("Historical projections use the previous three complete months only")));
});

test("Tuition + fixed costs: distinct labeling, no double counting, and clean math", () => {
  const today = "2026-10-17";
  const appState = {
    wallets: [{ id: "w1", name: "Ví chính", currency: "VND", initial: 10_000_000, type: "cash" }],
    transactions: [],
    goals: [],
    fixedExpenses: [
      // Active fixed expense: Rent 2,000,000 VND due 2026-10-25
      { id: "f1", budgetId: "", title: "Tiền trọ", amount: 2_000_000, category: "Rent", dueDate: "2026-10-25", recurrence: "monthly", active: true, walletId: "w1" },
    ],
    categories: ["Education", "Rent"],
    settings: { language: "Tiếng Việt" },
  };

  const scenario = {
    id: "sc-tuition",
    name: "Học phí 5 triệu",
    changes: [
      // Hypothetical tuition 5,000,000 VND on 2026-10-20
      { title: "Học phí", amount: 5_000_000, direction: "expense", walletId: "w1", currency: "VND", date: "2026-10-20", category: "Education" },
    ],
    horizonEnd: "2026-10-31",
    estimateSpending: false,
    assumptions: [],
  };

  const result = calculateScenario(appState, scenario, today);
  // Scheduled rent is in plannedBills
  assert.equal(result.plannedBills.length, 1);
  assert.equal(result.plannedBills[0].title, "Tiền trọ");
  assert.equal(result.plannedBills[0].amount, 2_000_000);

  // Projected balance: 10,000,000 - 5,000,000 (tuition) - 2,000,000 (rent) = 3,000,000 VND
  assert.equal(result.wallets[0].projectedBalance, 3_000_000);
  assert.equal(result.wallets[0].shortfall, 0);
});

test("Budget projections: calculates actuals, commitments, hypothetical spend and flexible allowance", () => {
  const today = "2026-10-17";
  const appState = {
    wallets: [{ id: "w1", name: "Ví chính", currency: "VND", initial: 10_000_000, type: "cash" }],
    transactions: [
      // Actual spend: 1,500,000 VND
      { id: "t1", title: "Cơm gia đình", amount: 1_500_000, type: "expense", category: "Food", date: "2026-10-10", wallet: "w1", note: "" },
    ],
    goals: [
      // Budget: 6,000,000 VND for Food
      { id: "b1", kind: "budget", title: "Ăn uống tháng 10", amount: 6_000_000, currency: "VND", category: "Food", wallet: "w1", date: "2026-10-01", cycle: "monthly", saved: 0, direction: "", person: "" },
    ],
    fixedExpenses: [
      // Fixed expense in this budget: 1,000,000 VND due 2026-10-25
      { id: "f1", budgetId: "b1", title: "Thực phẩm định kỳ", amount: 1_000_000, category: "Food", dueDate: "2026-10-25", recurrence: "monthly", active: true, walletId: "w1" },
    ],
    categories: ["Food"],
    settings: { language: "Tiếng Việt" },
  };

  const scenario = {
    id: "sc-party",
    name: "Tiệc sinh nhật 500k",
    changes: [
      // Hypothetical food expense: 500,000 VND on 2026-10-22
      { title: "Tiệc sinh nhật", amount: 500_000, direction: "expense", walletId: "w1", currency: "VND", date: "2026-10-22", category: "Food" },
    ],
    horizonEnd: "2026-10-31",
    estimateSpending: false,
    assumptions: [],
  };

  const result = calculateScenario(appState, scenario, today);
  const b1 = result.budgets[0];
  assert.ok(b1);
  // Actual remaining: 6M - 1.5M = 4.5M
  assert.equal(b1.actualRemaining, 4_500_000);
  // After scenario: 4.5M - 0.5M = 4.0M
  assert.equal(b1.afterScenario, 4_000_000);
  // Planned fixed amount: 1.0M
  assert.equal(b1.plannedAmount, 1_000_000);
  // Projected spend: 1.5M (actual) + 1.0M (fixed) + 0.5M (scenario) = 3.0M
  assert.equal(b1.projectedSpend, 3_000_000);
  // Projected remaining: 6.0M - 3.0M = 3.0M
  assert.equal(b1.projectedRemaining, 3_000_000);
});

test("Multi-currency wallet isolation: simulates without currency conversion or cross-pollution", () => {
  const today = "2026-10-17";
  const appState = {
    wallets: [
      { id: "w-vnd", name: "Ví VND", currency: "VND", initial: 10_000_000, type: "cash" },
      { id: "w-usd", name: "Ví USD", currency: "USD", initial: 500, type: "bank" },
    ],
    transactions: [],
    goals: [],
    fixedExpenses: [],
    categories: ["Tech"],
    settings: { language: "Tiếng Việt" },
  };

  // Scenario affects only VND wallet
  const scenario = {
    id: "sc-vnd",
    name: "Mua đồ VND",
    changes: [
      { title: "Bàn phím", amount: 2_000_000, direction: "expense", walletId: "w-vnd", currency: "VND", date: "2026-10-20", category: "Tech" },
    ],
    horizonEnd: "2026-10-31",
    estimateSpending: false,
    assumptions: [],
  };

  const result = calculateScenario(appState, scenario, today);
  const vndProj = result.wallets.find((w) => w.walletId === "w-vnd");
  const usdProj = result.wallets.find((w) => w.walletId === "w-usd");
  assert.ok(vndProj);
  assert.equal(vndProj.projectedBalance, 8_000_000);
  assert.equal(vndProj.currency, "VND");

  // USD wallet is untouched
  assert.ok(!usdProj || usdProj.projectedBalance === 500);
  assert.ok(result.assumptions.some((a) => a.includes("Each wallet is projected in its own currency")));
});

