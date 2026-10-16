export function safetyFixture() {
  return { wallets: [{ id: "bank", name: "Synthetic bank", currency: "USD", initial: 2000, archived: false }, { id: "ali", name: "Synthetic Alipay", currency: "CNY", initial: 500, archived: false }], transactions: [{ id: "expense-1", amount: 500, type: "expense", wallet: "bank", category: "Dining", date: "2026-10-05" }], budgets: [{ id: "budget-1", title: "Monthly dining", amount: 1000, currency: "USD", wallet: "bank", category: "Dining", date: "2026-10-01", cycle: "monthly" }], language: "en", timeZone: "UTC" };
}
export const ruleFixture = () => ({ id: "rule-1", name: "Synthetic alert", kind: "budget", targetId: "budget-1", basis: "actual", unit: "percent", threshold: 80, email: false, active: true });
