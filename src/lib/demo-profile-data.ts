import type { AppState, Transaction } from "../components/finbridge/workspace/store";
import { parseWorkspace } from "./workspace-model";
import { advanceSafety, emptySafetyDocument, safetyDate, type SafetyRule } from "./safety-model";
import { databaseSafety } from "./safety-repository";

const timeZone = "Asia/Ho_Chi_Minh";
const expenseCategories = ["Food", "Transport", "Rent", "Utilities", "Groceries", "Shopping", "Health", "Education", "Entertainment", "Subscriptions"];
const incomeCategories = ["Salary", "Freelance", "Interest"];
const dateKey = (date: Date) => date.toISOString().slice(0, 10);
export function demoDateRange(now = new Date()) {
  const today = safetyDate(now, timeZone), [year, month] = today.split("-").map(Number);
  return { start: dateKey(new Date(Date.UTC(year, month - 2, 1))), end: today };
}

export function populatedDemoWorkspace(now = new Date()): AppState {
  const { start, end } = demoDateRange(now), transactions: Transaction[] = [];
  const categories = [...expenseCategories, ...incomeCategories];
  const nextDue = (day: number) => {
    const [year, month, currentDay] = end.split("-").map(Number);
    return dateKey(new Date(Date.UTC(year, month - 1 + (currentDay > day ? 1 : 0), day)));
  };
  const fixedExpenses = [
    { id: "demo-rent", title: "Apartment rent", amount: 4_000_000, category: "Rent", day: 3 },
    { id: "demo-electricity", title: "Electricity and water", amount: 680_000, category: "Utilities", day: 12 },
    { id: "demo-internet", title: "Home internet", amount: 220_000, category: "Utilities", day: 15 },
    { id: "demo-gym", title: "Gym membership", amount: 350_000, category: "Health", day: 18 },
  ].map(({ day, ...bill }) => ({ ...bill, budgetId: "", walletId: "demo-bank", dueDate: nextDue(day), recurrence: "monthly" as const, intervalMonths: 1, monthPosition: "date" as const, reminderDays: 3, active: true }));
  const add = (date: string, code: string, title: string, amount: number, category: string, wallet: string, type: Transaction["type"] = "expense", extra: Partial<Transaction> = {}) => {
    transactions.push({ id: `demo-${date}-${code}`, title, amount, category, wallet, type, date, note: "Synthetic judge demo; no real bank activity.", ...extra });
  };
  for (const cursor = new Date(start + "T12:00:00Z"); dateKey(cursor) <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = dateKey(cursor), day = cursor.getUTCDate(), weekday = cursor.getUTCDay();
    add(date, "food", ["Breakfast and lunch", "Dinner with friends", "Meals at work"][day % 3], 110_000 + day % 4 * 15_000, "Food", "demo-cash");
    add(date, "transport", weekday === 0 || weekday === 6 ? "Weekend bus and taxi" : "Commute to work", 25_000 + day % 3 * 5_000, "Transport", "demo-bank");
    if (day % 7 === 0) add(date, "groceries", "Weekly groceries", 320_000 + day % 3 * 25_000, "Groceries", "demo-bank");
    if (weekday === 6) add(date, "entertainment", "Cinema or weekend activity", 145_000, "Entertainment", "demo-cash");
    if (day === 2) add(date, "cash-withdrawal", "Move funds to cash wallet", 5_000_000, "", "demo-bank", "transfer", { targetWallet: "demo-cash" });
    if (day === 5) add(date, "salary", "Monthly salary", 22_000_000, "Salary", "demo-bank", "income");
    if (day === 15) add(date, "freelance", "Freelance design project", 3_800_000, "Freelance", "demo-bank", "income");
    if (day === 6) add(date, "subscription", "Cloud storage subscription", 12.99, "Subscriptions", "demo-usd");
    if (day === 9) add(date, "course", "Mandarin course payment", 850, "Education", "demo-cny");
    if (day === 10) add(date, "cny-income", "Synthetic tutoring income", 600, "Freelance", "demo-cny", "income");
    if (day % 5 === 0) add(date, "cny-food", "Campus cafe", 28.5 + day % 3, "Food", "demo-cny");
    if (day === 11) add(date, "health", "Pharmacy and check-up", 420_000, "Health", "demo-bank");
    if (day === 16) add(date, "books", "Technical books", 24.5, "Education", "demo-usd");
    if (day === 18) add(date, "usd-income", "Synthetic project payout", 180, "Freelance", "demo-usd", "income");
    if (day === 22) add(date, "shopping", "Household essentials", 650_000, "Shopping", "demo-bank");
    if (day === 25) add(date, "savings", "Move funds to emergency wallet", 2_000_000, "", "demo-bank", "transfer", { targetWallet: "demo-savings" });
    if (day === 28) add(date, "interest", "Synthetic savings interest", 95_000, "Interest", "demo-savings", "income");
    for (const [index, paymentDay] of [3, 12, 15, 18].entries()) {
      const bill = fixedExpenses[index];
      if (day === paymentDay) add(date, bill.id, bill.title, bill.amount, bill.category, bill.walletId, "expense", { fixedExpenseId: bill.id, fixedExpenseDueDate: date, paymentConfirmation: "user" });
    }
  }
  const budget = (id: string, title: string, amount: number, wallet: string, category: string, currency = "VND") => ({ id, kind: "budget", title, amount, saved: 0, currency, wallet, category, date: start, cycle: "monthly", direction: "", person: "" });
  return parseWorkspace({
    wallets: [
      { id: "demo-bank", name: "Daily bank wallet", currency: "VND", initial: 45_000_000, type: "cash" },
      { id: "demo-cash", name: "Cash wallet", currency: "VND", initial: 3_000_000, type: "cash" },
      { id: "demo-savings", name: "Emergency savings", currency: "VND", initial: 25_000_000, type: "cash" },
      { id: "demo-usd", name: "USD travel wallet", currency: "USD", initial: 1_200, type: "cash" },
      { id: "demo-cny", name: "CNY study wallet", currency: "CNY", initial: 5_000, type: "cash" },
    ],
    categories,
    categoryMeta: Object.fromEntries(categories.map((name, index) => [name, { type: incomeCategories.includes(name) ? "income" : "expense", icon: ["🍜", "🚌", "🏠", "💡", "🛒", "🛍️", "💊", "📚", "🎬", "☁️", "💼", "💻", "💰"][index], children: name === "Food" ? ["Breakfast", "Lunch", "Dinner"] : name === "Transport" ? ["Bus", "Taxi"] : [] }])),
    walletCategories: Object.fromEntries(["demo-bank", "demo-cash", "demo-savings", "demo-usd", "demo-cny"].map(id => [id, categories])),
    transactions,
    goals: [budget("demo-food-budget", "Monthly meals", 3_000_000, "demo-cash", "Food"), budget("demo-transport-budget", "Monthly transport", 800_000, "demo-bank", "Transport"), budget("demo-grocery-budget", "Monthly groceries", 1_500_000, "demo-bank", "Groceries"), budget("demo-study-budget", "Study expenses", 1_200, "demo-cny", "Education", "CNY")],
    fixedExpenses,
    recurring: [], rules: [],
    settings: { name: "demo_with_data", language: "English", theme: "light", timeZone, occupation: "employee", onboardingCompleted: end, reserveByWallet: JSON.stringify({ "demo-bank": 10_000_000, "demo-cash": 8_000_000, "demo-savings": 20_000_000, "demo-usd": 500, "demo-cny": 2_000 }) },
    transactionChat: { messages: [], drafts: [], clarifyingDraftId: null }, planningChat: [],
  });
}

export function populatedDemoSafety(data: AppState, now = new Date()) {
  let doc = databaseSafety(emptySafetyDocument(), data, now);
  const groupId = "c28c6581-9931-4a7b-9230-9b8c6bac0979";
  const rule = (id: string, name: string, kind: SafetyRule["kind"], targetId: string, threshold: number, basis: SafetyRule["basis"] = "actual"): SafetyRule => ({ id, name, kind, targetId, threshold, basis, unit: kind === "reserve" ? "amount" : "percent", active: true, email: false });
  doc.rules = [
    { ...rule("demo-food-80", "Meals budget alerts", "budget", "demo-food-budget", 80), groupId },
    { ...rule("demo-food-100", "Meals budget alerts", "budget", "demo-food-budget", 100), groupId },
    { ...rule("demo-food-forecast", "Meals budget alerts", "budget", "demo-food-budget", 100, "forecast"), groupId },
    rule("demo-transport-80", "Transport reaches eighty percent", "budget", "demo-transport-budget", 80),
    rule("demo-cash-floor", "Cash below reserve floor", "reserve", "demo-cash", 8_000_000),
    rule("demo-bank-floor", "Bank wallet reserve floor", "reserve", "demo-bank", 10_000_000),
  ];
  const { start, end } = demoDateRange(now);
  for (const cursor = new Date(start + "T05:00:00Z"); dateKey(cursor) < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) doc = advanceSafety(doc, cursor);
  doc = advanceSafety(doc, now);
  return doc;
}
