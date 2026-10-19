import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { hashPassword } from "./password-security";
import { parseWorkspace } from "./workspace-model";
import { writeFinanceTables, writeAlertRules } from "./finance-tables";
import { emptySafetyDocument, advanceSafety } from "./safety-model";
import { databaseSafety, saveSafety } from "./safety-repository";
import { onboardingSchema } from "./onboarding";

export const DEMO_ACCOUNTS_SQL = `CREATE TABLE IF NOT EXISTS finbridge_demo_accounts (
  user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE RESTRICT,
  seed_version INTEGER NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;
export function demoIdentity(slot: number) {
  if (![1, 2].includes(slot)) throw new Error("DEMO_SLOT_MUST_BE_1_OR_2");
  return { id: "finbridge-demo-judge-" + slot, email: "judge-" + slot + "@demo.finbridge.invalid", name: "FinBridge Demo " + slot };
}
export function demoWorkspace(now = new Date()) {
  const today = now.toISOString().slice(0, 10), month = today.slice(0, 7) + "-01";
  const due = new Date(now); due.setUTCDate(due.getUTCDate() + 3);
  return parseWorkspace({
    wallets: [{ id: "demo-vnd", name: "Demo VND", currency: "VND", initial: 20_000_000, type: "cash" }, { id: "demo-usd", name: "Demo USD", currency: "USD", initial: 800, type: "cash" }],
    categories: ["Meals", "Transport", "Rent", "Salary"],
    categoryMeta: Object.fromEntries(["Meals", "Transport", "Rent", "Salary"].map(name => [name, { type: name === "Salary" ? "income" : "expense", icon: "", children: [] }])),
    walletCategories: { "demo-vnd": ["Meals", "Transport", "Rent", "Salary"], "demo-usd": ["Meals", "Salary"] },
    transactions: [
      { id: "demo-income", title: "Synthetic salary", amount: 12_000_000, type: "income", wallet: "demo-vnd", category: "Salary", date: today, note: "Synthetic demo data" },
      { id: "demo-meal", title: "Synthetic meals this month", amount: 1_350_000, type: "expense", wallet: "demo-vnd", category: "Meals", date: today, note: "Synthetic demo data" },
      { id: "demo-transport", title: "Synthetic transport", amount: 180_000, type: "expense", wallet: "demo-vnd", category: "Transport", date: today, note: "Synthetic demo data" },
    ],
    goals: [{ id: "demo-budget", kind: "budget", title: "Demo meals budget", amount: 1_500_000, saved: 0, currency: "VND", wallet: "demo-vnd", category: "Meals", date: month, cycle: "monthly", direction: "", person: "" }],
    fixedExpenses: [{ id: "demo-rent", budgetId: "", walletId: "demo-vnd", title: "Synthetic rent", amount: 3_000_000, category: "Rent", dueDate: due.toISOString().slice(0, 10), recurrence: "monthly", intervalMonths: 1, reminderDays: 3, active: true }],
    recurring: [], rules: [],
    settings: { name: "FinBridge Demo", language: "English", theme: "light", timeZone: "Asia/Ho_Chi_Minh", onboardingCompleted: today },
    transactionChat: { messages: [], drafts: [], clarifyingDraftId: null }, planningChat: [],
  });
}
// Constant dependency order. Every delete is constrained by a registered demo owner.
const resetTables = [
  "finbridge_transfer_mutations", "finbridge_transfer_audit", "finbridge_transfer_plans", "finbridge_transfer_quotes", "finbridge_transfer_bills", "finbridge_transfer_accounts", "finbridge_transfer_controls",
  "finbridge_fixed_expense_recipients", "finbridge_transaction_drafts", "finbridge_chat_messages", "finbridge_conversations", "finbridge_onboarding_drafts", "finbridge_alert_rules",
  "finbridge_wallet_categories", "finbridge_category_children", "finbridge_recurring_transactions", "finbridge_transactions", "finbridge_fixed_expenses", "finbridge_budgets", "finbridge_goals", "finbridge_categories", "finbridge_wallets",
  "finbridge_preferences", "finbridge_categorization_rules", "finbridge_workspace_revisions", "finbridge_workspace_limits", "finbridge_workspaces",
  "finbridge_safety_events", "finbridge_safety_changes", "finbridge_safety_limits", "finbridge_safety", "finbridge_onboarding",
];
async function guard(client: PoolClient, owner: string) {
  if (![demoIdentity(1).id, demoIdentity(2).id].includes(owner)) throw new Error("NOT_A_REGISTERED_DEMO_ACCOUNT");
  const row = await client.query('SELECT u.id,u.email FROM "user" u JOIN finbridge_demo_accounts d ON d.user_id=u.id WHERE u.id=$1 FOR UPDATE OF u,d', [owner]);
  const slot = owner.endsWith("-1") ? 1 : 2;
  if (row.rows[0]?.email !== demoIdentity(slot).email) throw new Error("NOT_A_REGISTERED_DEMO_ACCOUNT");
  if ((await client.query("SELECT 1 FROM finbridge_account_lifecycle WHERE user_id=$1", [owner])).rowCount) throw new Error("DEMO_ACCOUNT_CLOSED");
}
async function seed(client: PoolClient, owner: string, now: Date) {
  const previous = await client.query("SELECT revision FROM finbridge_workspaces WHERE user_id=$1", [owner]);
  const revision = (previous.rows[0]?.revision || 0) + 1;
  for (const table of resetTables) await client.query("DELETE FROM " + table + " WHERE user_id=$1", [owner]);
  const data = demoWorkspace(now), encoded = JSON.stringify(data), mutation = randomUUID();
  await client.query("INSERT INTO finbridge_workspaces(user_id,revision,data) VALUES($1,$2,$3)", [owner, revision, encoded]);
  await writeFinanceTables(client, owner, data);
  await client.query("INSERT INTO finbridge_workspace_revisions(user_id,revision,mutation_id,content_hash,data) VALUES($1,$2,$3,$4,$5)", [owner, revision, mutation, createHash("sha256").update(encoded).digest("hex"), encoded]);
  const setup = onboardingSchema.parse({ version: 1, displayName: "FinBridge Demo", occupation: "student", language: "en",
    wallets: data.wallets.map(({ id, name, currency, initial }) => ({ id, name, currency, initial })), expenseCategories: ["Meals", "Transport", "Rent"], incomeCategories: ["Salary"],
    commitments: (data.fixedExpenses || []).map(e => ({ id: e.id, walletId: e.walletId!, title: e.title, amount: e.amount, category: e.category, dueDate: e.dueDate, intervalMonths: 1, monthPosition: "date", reminderDays: 3 })),
    reserves: data.wallets.map(w => ({ walletId: w.id, amount: 0 })) });
  await client.query("INSERT INTO finbridge_onboarding(user_id,data) VALUES($1,$2)", [owner, JSON.stringify(setup)]);
  const safety = databaseSafety(emptySafetyDocument(), data, now);
  safety.rules = [{ id: "demo-alert", name: "Demo meals threshold", kind: "budget", targetId: "demo-budget", basis: "actual", unit: "percent", threshold: 80, active: true, email: false }];
  await client.query("INSERT INTO finbridge_safety(user_id,document) VALUES($1,$2)", [owner, JSON.stringify(emptySafetyDocument())]);
  await writeAlertRules(client, owner, safety.rules);
  await saveSafety(client, owner, advanceSafety(safety, now));
  await client.query("UPDATE finbridge_demo_accounts SET reset_at=$2 WHERE user_id=$1", [owner, now]);
  // Invalidate cached workspaces through new login. Never reset AI quota or global counters.
  await client.query('UPDATE "session" SET "expiresAt"=CURRENT_TIMESTAMP WHERE "userId"=$1', [owner]);
}
export async function manageDemoAccount(pool: Pool, input: { action: "create" | "reset" | "rotate" | "lock"; slot: number; password?: string; now?: Date }) {
  const identity = demoIdentity(input.slot), now = input.now || new Date();
  if (["create", "rotate"].includes(input.action) && (!input.password || input.password.length < 12 || input.password.length > 128)) throw new Error("DEMO_PASSWORD_MUST_BE_12_TO_128_CHARACTERS");
  const passwordHash = input.password ? await hashPassword(input.password) : null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(17961019)");
    if (input.action === "create") {
      // No adoption, email overwrite, upsert, or verification of an existing real account.
      if ((await client.query('SELECT id FROM "user" WHERE id=$1 OR lower(email)=lower($2)', [identity.id, identity.email])).rowCount) throw new Error("DEMO_ALREADY_EXISTS");
      await client.query('INSERT INTO "user"(id,name,email,"emailVerified",role,"createdAt","updatedAt") VALUES($1,$2,$3,true,\'user\',$4,$4)', [identity.id, identity.name, identity.email, now]);
      await client.query('INSERT INTO "account"(id,"userId","accountId","providerId",password,"createdAt","updatedAt") VALUES($1,$2,$2,\'credential\',$3,$4,$4)', [randomUUID(), identity.id, passwordHash, now]);
      await client.query("INSERT INTO finbridge_demo_accounts(user_id) VALUES($1)", [identity.id]);
    }
    await guard(client, identity.id);
    if (input.action === "create" || input.action === "reset") await seed(client, identity.id, now);
    if (input.action === "rotate" || input.action === "lock") {
      await client.query('UPDATE "account" SET password=$2,"updatedAt"=$3 WHERE "userId"=$1 AND "providerId"=\'credential\'', [identity.id, input.action === "lock" ? null : passwordHash, now]);
      await client.query('UPDATE "session" SET "expiresAt"=CURRENT_TIMESTAMP WHERE "userId"=$1', [identity.id]);
    }
    await client.query("COMMIT"); return identity;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
