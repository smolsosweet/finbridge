import { randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import { Pool } from "pg";
import { initializeAccountLifecycle } from "../src/lib/account-lifecycle.ts";
import { SAFETY_SQL } from "../src/lib/safety-repository.ts";
import { WORKSPACE_SQL } from "../src/lib/workspace-repository.ts";
import { FINANCE_TABLES_SQL } from "../src/lib/finance-tables.ts";
export const financeTables = ["finbridge_fixed_expense_recipients", "finbridge_alert_rules", "finbridge_onboarding_drafts", "finbridge_transaction_drafts", "finbridge_chat_messages", "finbridge_conversations", "finbridge_preferences", "finbridge_categorization_rules", "finbridge_recurring_transactions", "finbridge_transactions", "finbridge_fixed_expenses", "finbridge_budgets", "finbridge_goals", "finbridge_category_children", "finbridge_wallet_categories", "finbridge_categories", "finbridge_wallets", "finbridge_workspace_revisions", "finbridge_workspace_limits", "finbridge_workspaces", "finbridge_safety_events", "finbridge_safety_changes", "finbridge_safety_limits", "finbridge_safety", "finbridge_account_lifecycle"];
export async function testPool() {
  nextEnv.loadEnvConfig(process.cwd());
  const connectionString = process.env.AUTH_TEST_DATABASE_URL;
  if (!connectionString) throw new Error("AUTH_TEST_DATABASE_URL required");
  const url = new URL(connectionString);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/finbridge_auth_test") throw new Error("Only isolated finbridge_auth_test is allowed");
  const pool = new Pool({ connectionString, max: 4 });
  await initializeAccountLifecycle(pool);
  await pool.query(SAFETY_SQL); await pool.query(WORKSPACE_SQL); await pool.query(FINANCE_TABLES_SQL);
  return pool;
}
export async function syntheticUser(pool) {
  const id = "finance-test-" + randomUUID();
  await pool.query('INSERT INTO "user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$2,$3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)', [id, "Synthetic finance test", id + "@example.invalid"]);
  return id;
}
export async function cleanupFinance(pool, owners) {
  for (const table of financeTables) await pool.query(`DELETE FROM ${table} WHERE user_id=ANY($1::text[])`, [owners]);
  await pool.query('DELETE FROM "user" WHERE id=ANY($1::text[])', [owners]);
}
export function workspaceFixture() {
  const date = new Date().toISOString().slice(0,10);
  return { wallets: [{ id: "bank", name: "Synthetic bank", currency: "USD", initial: 2000, type: "cash" }, { id: "ali", name: "Synthetic Alipay", currency: "CNY", initial: 500, type: "cash" }], transactions: [{ id: "expense-1", title: "Synthetic dining", amount: 850, type: "expense", wallet: "bank", category: "Dining", date, note: "" }], goals: [{ id: "budget-1", kind: "budget", title: "Monthly dining", amount: 1000, saved: 0, currency: "USD", wallet: "bank", category: "Dining", date: date.slice(0,7)+"-01", cycle: "monthly", direction: "", person: "" }], categories: ["Dining", "Salary"], categoryMeta: { Dining: { type: "expense", icon: "", children: ["Coffee"] }, Salary: { type: "income", icon: "", children: [] } }, walletCategories: { bank: ["Dining", "Salary"], ali: ["Salary"] }, fixedExpenses: [{id:"rent",budgetId:"budget-1",title:"Synthetic commitment",category:"Dining",amount:50,dueDate:date,recurrence:"monthly",active:true}], recurring: [], rules: ["Synthetic rule"], settings: {name:"Synthetic",language:"English",timeZone:"UTC",theme:"light",onboardingCompleted:date}, transactionChat: {messages:[{role:"user",text:"Synthetic chat"}],drafts:[],clarifyingDraftId:null}, planningChat:[{role:"assistant",text:"Synthetic plan"}] };
}
