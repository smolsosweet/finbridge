import { isDeepStrictEqual } from "node:util";
import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import type { AppState } from "../components/sites/rolly/replica/store";
import type { SafetyRule } from "./safety-model";
const base = `user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT, id TEXT NOT NULL, data JSONB NOT NULL, position INTEGER NOT NULL DEFAULT 0, deleted_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,id)`;
const walletFK = `FOREIGN KEY(user_id,wallet_id) REFERENCES finbridge_wallets(user_id,id) ON DELETE RESTRICT`;
const categoryFK = `FOREIGN KEY(user_id,category_id) REFERENCES finbridge_categories(user_id,id) ON DELETE RESTRICT`;
export const FINANCE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS finbridge_wallets (${base}, name TEXT NOT NULL, currency CHAR(3) NOT NULL, opening_balance NUMERIC(20,4) NOT NULL, wallet_type TEXT NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE);
CREATE TABLE IF NOT EXISTS finbridge_categories (${base}, name TEXT NOT NULL, category_type TEXT NOT NULL, icon TEXT NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE, listed BOOLEAN NOT NULL DEFAULT TRUE, UNIQUE(user_id,name));
CREATE TABLE IF NOT EXISTS finbridge_wallet_categories (${base}, wallet_id TEXT NOT NULL, category_id TEXT NOT NULL, ${walletFK}, ${categoryFK}, UNIQUE(user_id,wallet_id,category_id));
CREATE TABLE IF NOT EXISTS finbridge_category_children (${base}, category_id TEXT NOT NULL, name TEXT NOT NULL, ${categoryFK});
CREATE TABLE IF NOT EXISTS finbridge_transactions (${base}, wallet_id TEXT NOT NULL, target_wallet_id TEXT, category_id TEXT, title TEXT NOT NULL, amount NUMERIC(20,4) NOT NULL CHECK(amount>=0), direction TEXT NOT NULL CHECK(direction IN ('income','expense','transfer')), occurred_on DATE NOT NULL, ${walletFK}, ${categoryFK}, FOREIGN KEY(user_id,target_wallet_id) REFERENCES finbridge_wallets(user_id,id) ON DELETE RESTRICT);
CREATE TABLE IF NOT EXISTS finbridge_budgets (${base}, wallet_id TEXT NOT NULL, category_id TEXT, title TEXT NOT NULL, amount NUMERIC(20,4) NOT NULL, currency CHAR(3) NOT NULL, starts_on DATE NOT NULL, cycle TEXT NOT NULL, ${walletFK}, ${categoryFK});
CREATE TABLE IF NOT EXISTS finbridge_goals (${base}, title TEXT NOT NULL, goal_kind TEXT NOT NULL, target_amount NUMERIC(20,4) NOT NULL, saved_amount NUMERIC(20,4) NOT NULL, currency CHAR(3) NOT NULL);
CREATE TABLE IF NOT EXISTS finbridge_fixed_expenses (${base}, budget_id TEXT, wallet_id TEXT NOT NULL, category_id TEXT, title TEXT NOT NULL, amount NUMERIC(20,4) NOT NULL CHECK(amount>0), due_on DATE NOT NULL, recurrence TEXT NOT NULL, active BOOLEAN NOT NULL, ${walletFK}, ${categoryFK}, FOREIGN KEY(user_id,budget_id) REFERENCES finbridge_budgets(user_id,id) ON DELETE RESTRICT);
CREATE TABLE IF NOT EXISTS finbridge_recurring_transactions (${base}, wallet_id TEXT NOT NULL, amount NUMERIC(20,4) NOT NULL, direction TEXT NOT NULL, ${walletFK});
CREATE TABLE IF NOT EXISTS finbridge_preferences (${base}, preference_key TEXT NOT NULL, value JSONB NOT NULL, UNIQUE(user_id,preference_key));
CREATE TABLE IF NOT EXISTS finbridge_conversations (${base}, conversation_kind TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS finbridge_chat_messages (${base}, conversation_id TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('user','assistant')), body TEXT NOT NULL, FOREIGN KEY(user_id,conversation_id) REFERENCES finbridge_conversations(user_id,id) ON DELETE RESTRICT);
CREATE TABLE IF NOT EXISTS finbridge_transaction_drafts (${base}, conversation_id TEXT NOT NULL, FOREIGN KEY(user_id,conversation_id) REFERENCES finbridge_conversations(user_id,id) ON DELETE RESTRICT);
CREATE TABLE IF NOT EXISTS finbridge_categorization_rules (${base}, rule_text TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS finbridge_onboarding_drafts (${base});
CREATE TABLE IF NOT EXISTS finbridge_alert_rules (${base}, group_id TEXT, name TEXT NOT NULL, rule_kind TEXT NOT NULL, target_id TEXT NOT NULL, basis TEXT NOT NULL CHECK(basis IN ('actual','forecast')), threshold_unit TEXT NOT NULL CHECK(threshold_unit IN ('percent','amount')), threshold_value NUMERIC(20,4) NOT NULL, email_enabled BOOLEAN NOT NULL, active BOOLEAN NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE);
CREATE INDEX IF NOT EXISTS finbridge_transactions_period ON finbridge_transactions(user_id,wallet_id,occurred_on) WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS finbridge_fixed_expense_recipients (${base}, expense_id TEXT NOT NULL, bank_bin CHAR(6) NOT NULL, account_number TEXT NOT NULL, account_name TEXT NOT NULL, reference TEXT NOT NULL, preferred_app TEXT, FOREIGN KEY(user_id,expense_id) REFERENCES finbridge_fixed_expenses(user_id,id) ON DELETE RESTRICT);
ALTER TABLE finbridge_transactions ADD COLUMN IF NOT EXISTS fixed_expense_id TEXT;
ALTER TABLE finbridge_transactions ADD COLUMN IF NOT EXISTS fixed_due_on DATE;
ALTER TABLE finbridge_transactions ADD COLUMN IF NOT EXISTS payment_confirmation TEXT;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='finbridge_transactions'::regclass AND conname='finbridge_transactions_fixed_plan_fk') THEN
  ALTER TABLE finbridge_transactions ADD CONSTRAINT finbridge_transactions_fixed_plan_fk FOREIGN KEY(user_id,fixed_expense_id) REFERENCES finbridge_fixed_expenses(user_id,id) ON DELETE RESTRICT;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='finbridge_transactions'::regclass AND conname='finbridge_transactions_fixed_payment_check') THEN
  ALTER TABLE finbridge_transactions ADD CONSTRAINT finbridge_transactions_fixed_payment_check CHECK ((fixed_expense_id IS NULL AND fixed_due_on IS NULL AND payment_confirmation IS NULL) OR (fixed_expense_id IS NOT NULL AND fixed_due_on IS NOT NULL AND payment_confirmation='user' AND direction='expense'));
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS finbridge_bill_one_payment_per_occurrence ON finbridge_transactions(user_id,fixed_expense_id,fixed_due_on) WHERE fixed_expense_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS finbridge_budgets_wallet ON finbridge_budgets(user_id,wallet_id) WHERE deleted_at IS NULL;`;
const fingerprint = (value: string) => createHash("sha256").update(value).digest("hex");
const categoryId = (name: string) => name ? fingerprint(name) : null;
type Row = { id: string; data: unknown; position: number } & Record<string, unknown>;
async function upsert(client: PoolClient, owner: string, table: string, fields: Record<string, string>, rows: Row[], previous?: Row[]) {
  // SQL identifiers are static application constants. All user values are bound.
  const types = { id: "TEXT", data: "JSONB", position: "INTEGER", ...fields }, columns = Object.keys(types);
  // Release live unique keys before inserting replacements in this same revision.
  // The entire workspace save is transactional; removed rows remain recoverable.
  if (previous) {
    const nextIds = new Set(rows.map(row => row.id));
    const removed = previous.filter(row => !nextIds.has(row.id)).map(row => row.id);
    if (removed.length) await client.query(`UPDATE ${table} SET deleted_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND deleted_at IS NULL AND id=ANY($2::text[])`, [owner, removed]);
    const old = new Map(previous.map(row => [row.id, row]));
    rows = rows.filter(row => !isDeepStrictEqual(old.get(row.id), row));
  } else {
    // Initial import has no authoritative previous rows: retain full reconciliation.
    await client.query(`UPDATE ${table} SET deleted_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND deleted_at IS NULL AND NOT(id=ANY($2::text[]))`, [owner, rows.map(r => r.id)]);
  }
  if (!rows.length) return;
  await client.query(`INSERT INTO ${table}(user_id,${columns.join(",")}) SELECT $1,${columns.map(k => "r." + k).join(",")} FROM jsonb_to_recordset($2::jsonb) AS r(${Object.entries(types).map(([k, t]) => `${k} ${t}`).join(",")}) ON CONFLICT(user_id,id) DO UPDATE SET ${columns.filter(k => k !== "id").map(k => `${k}=EXCLUDED.${k}`).join(",")},deleted_at=NULL,updated_at=CURRENT_TIMESTAMP`, [owner, JSON.stringify(rows)]);
}
type FinanceTableWrite = { table: string; types: Record<string, string>; rows: Row[] };
function financeTableWrites(s: AppState) {
  const writes: FinanceTableWrite[] = [];
  const add = (table: string, types: Record<string, string>, rows: Row[]) => { writes.push({ table, types, rows }); };
  add("finbridge_wallets", { name: "TEXT", currency: "TEXT", opening_balance: "NUMERIC", wallet_type: "TEXT", archived: "BOOLEAN" }, s.wallets.map((w, position) => ({ id: w.id, data: w, position, name: w.name, currency: w.currency, opening_balance: w.initial, wallet_type: w.type, archived: !!w.archived })));
  const names = [...new Set([...s.categories, ...Object.keys(s.categoryMeta), ...s.transactions.map(t => t.category), ...s.goals.map(g => g.category), ...(s.fixedExpenses || []).map(e => e.category)])].filter(Boolean);
  add("finbridge_categories", { name: "TEXT", category_type: "TEXT", icon: "TEXT", archived: "BOOLEAN", listed: "BOOLEAN" }, names.map((name, position) => ({ id: categoryId(name)!, data: s.categoryMeta[name] || { children: [] }, position, name, category_type: s.categoryMeta[name]?.type || (s.transactions.some(t => t.category === name && t.type === "income") ? "income" : "expense"), icon: s.categoryMeta[name]?.icon || "", archived: !!s.categoryMeta[name]?.archived, listed: s.categories.includes(name) })));
  add("finbridge_category_children", { category_id: "TEXT", name: "TEXT" }, names.flatMap(name => [...new Set(s.categoryMeta[name]?.children || [])].map((child, position) => ({ id: fingerprint(name + "\0" + child), data: { name: child }, position, category_id: categoryId(name), name: child }))));
  add("finbridge_wallet_categories", { wallet_id: "TEXT", category_id: "TEXT" }, s.wallets.flatMap(w => (s.walletCategories?.[w.id] || s.categories).filter(name => names.includes(name)).map((name, position) => ({ id: fingerprint(w.id + "\0" + name), data: {}, position, wallet_id: w.id, category_id: categoryId(name) }))));
  add("finbridge_budgets", { wallet_id: "TEXT", category_id: "TEXT", title: "TEXT", amount: "NUMERIC", currency: "TEXT", starts_on: "DATE", cycle: "TEXT" }, s.goals.flatMap((g, position) => g.kind === "budget" ? [{ id: g.id, data: g, position, wallet_id: g.wallet, category_id: categoryId(g.category), title: g.title, amount: g.amount, currency: g.currency, starts_on: g.date.slice(0, 10), cycle: g.cycle }] : []));
  add("finbridge_goals", { title: "TEXT", goal_kind: "TEXT", target_amount: "NUMERIC", saved_amount: "NUMERIC", currency: "TEXT" }, s.goals.flatMap((g, position) => g.kind !== "budget" ? [{ id: g.id, data: g, position, title: g.title, goal_kind: g.kind, target_amount: g.amount, saved_amount: g.saved, currency: g.currency }] : []));
  add("finbridge_fixed_expenses", { budget_id: "TEXT", wallet_id: "TEXT", category_id: "TEXT", title: "TEXT", amount: "NUMERIC", due_on: "DATE", recurrence: "TEXT", active: "BOOLEAN" }, (s.fixedExpenses || []).map((e, position) => ({ id: e.id, data: e, position, budget_id: e.budgetId || null, wallet_id: s.goals.find(g => g.kind === "budget" && g.id === e.budgetId)?.wallet || e.walletId, category_id: categoryId(e.category), title: e.title, amount: e.amount, due_on: e.dueDate, recurrence: e.recurrence, active: e.active })));
  add("finbridge_fixed_expense_recipients", { expense_id: "TEXT", bank_bin: "TEXT", account_number: "TEXT", account_name: "TEXT", reference: "TEXT", preferred_app: "TEXT" }, (s.fixedExpenses || []).flatMap((e, position) => e.paymentRecipient ? [{ id: e.id, data: e.paymentRecipient, position, expense_id: e.id, bank_bin: e.paymentRecipient.bankBin, account_number: e.paymentRecipient.accountNumber, account_name: e.paymentRecipient.accountName, reference: e.paymentRecipient.reference, preferred_app: e.paymentRecipient.preferredApp || null }] : []));
  add("finbridge_transactions", { wallet_id: "TEXT", target_wallet_id: "TEXT", category_id: "TEXT", title: "TEXT", amount: "NUMERIC", direction: "TEXT", occurred_on: "DATE", fixed_expense_id: "TEXT", fixed_due_on: "DATE", payment_confirmation: "TEXT" }, s.transactions.map((t, position) => ({ id: t.id, data: t, position, wallet_id: t.wallet, target_wallet_id: t.type === "transfer" ? t.targetWallet || null : null, category_id: categoryId(t.category), title: t.title, amount: t.amount, direction: t.type, occurred_on: t.date.slice(0, 10), fixed_expense_id: t.fixedExpenseId || null, fixed_due_on: t.fixedExpenseDueDate || null, payment_confirmation: t.paymentConfirmation || null })));
  add("finbridge_recurring_transactions", { wallet_id: "TEXT", amount: "NUMERIC", direction: "TEXT" }, s.recurring.map((t, position) => ({ id: t.id, data: t, position, wallet_id: t.wallet, amount: t.amount, direction: t.type })));
  add("finbridge_preferences", { preference_key: "TEXT", value: "JSONB" }, Object.entries(s.settings).map(([name, value], position) => ({ id: name, data: {}, position, preference_key: name, value })));
  add("finbridge_conversations", { conversation_kind: "TEXT" }, [{ id: "transactions", data: { clarifyingDraftId: s.transactionChat?.clarifyingDraftId || null, activeDraftId: s.transactionChat?.activeDraftId || null, referencedCategories: s.transactionChat?.referencedCategories || [] }, position: 0, conversation_kind: "transactions" }, { id: "planning", data: {}, position: 1, conversation_kind: "planning" }]);
  add("finbridge_chat_messages", { conversation_id: "TEXT", role: "TEXT", body: "TEXT" }, [...(s.transactionChat?.messages || []).map((m, position) => ({ id: `transactions:${position}`, data: m, position, conversation_id: "transactions", role: m.role, body: m.text })), ...(s.planningChat || []).map((m, position) => ({ id: `planning:${position}`, data: m, position, conversation_id: "planning", role: m.role, body: m.text }))]);
  add("finbridge_transaction_drafts", { conversation_id: "TEXT" }, (s.transactionChat?.drafts || []).map((draft, position) => ({ id: draft.id, data: draft, position, conversation_id: "transactions" })));
  add("finbridge_categorization_rules", { rule_text: "TEXT" }, s.rules.map((rule, position) => ({ id: String(position), data: {}, position, rule_text: rule })));
  add("finbridge_onboarding_drafts", {}, s.onboardingDraft ? [{ id: "setup", data: s.onboardingDraft, position: 0 }] : []);
  // PostgreSQL receives JSON, where undefined properties do not exist. Compare
  // that same representation so absent optional fields do not trigger rewrites.
  return JSON.parse(JSON.stringify(writes)) as FinanceTableWrite[];
}
export async function writeFinanceTables(client: PoolClient, owner: string, s: AppState, previous?: AppState | null) {
  const old = new Map(previous ? financeTableWrites(previous).map(write => [write.table, write.rows]) : []);
  for (const write of financeTableWrites(s)) {
    if (previous && isDeepStrictEqual(old.get(write.table), write.rows)) continue;
    await upsert(client, owner, write.table, write.types, write.rows, previous ? old.get(write.table) : undefined);
  }
}
export async function writeAlertRules(client: PoolClient, owner: string, rules: SafetyRule[]) {
  await upsert(client, owner, "finbridge_alert_rules", { group_id: "TEXT", name: "TEXT", rule_kind: "TEXT", target_id: "TEXT", basis: "TEXT", threshold_unit: "TEXT", threshold_value: "NUMERIC", email_enabled: "BOOLEAN", active: "BOOLEAN", archived: "BOOLEAN" }, rules.map((r, position) => ({ id: r.id, data: r, position, group_id: r.groupId || null, name: r.name, rule_kind: r.kind, target_id: r.targetId, basis: r.basis, threshold_unit: r.unit, threshold_value: r.threshold, email_enabled: r.email, active: r.active, archived: !!r.archived })));
}
// Safety needs only these financial fields. Fetch them in one round trip instead
// of loading categories, chat histories, recipients and drafts individually.
export async function readSafetyFinanceTables(client: PoolClient, owner: string, fallback: AppState): Promise<AppState> {
  const result = await client.query<Pick<AppState, "wallets" | "transactions" | "goals" | "settings">>(`
    SELECT
      COALESCE((SELECT jsonb_agg(data || jsonb_build_object('id',id,'name',name,'currency',trim(currency),'initial',opening_balance,'archived',archived) ORDER BY position)
        FROM finbridge_wallets WHERE user_id=$1 AND deleted_at IS NULL), '[]'::jsonb) AS wallets,
      COALESCE((SELECT jsonb_agg((t.data - 'targetWallet') || jsonb_build_object('id',t.id,'amount',t.amount,'type',t.direction,'wallet',t.wallet_id,'category',COALESCE(c.name,''),'date',t.occurred_on::text)
        || CASE WHEN t.target_wallet_id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('targetWallet',t.target_wallet_id) END ORDER BY t.position)
        FROM finbridge_transactions t LEFT JOIN finbridge_categories c ON c.user_id=t.user_id AND c.id=t.category_id
        WHERE t.user_id=$1 AND t.deleted_at IS NULL), '[]'::jsonb) AS transactions,
      COALESCE((SELECT jsonb_agg(b.data || jsonb_build_object('id',b.id,'kind','budget','title',b.title,'amount',b.amount,'currency',trim(b.currency),'wallet',b.wallet_id,'category',COALESCE(c.name,''),'date',b.starts_on::text,'cycle',b.cycle) ORDER BY b.position)
        FROM finbridge_budgets b LEFT JOIN finbridge_categories c ON c.user_id=b.user_id AND c.id=b.category_id
        WHERE b.user_id=$1 AND b.deleted_at IS NULL), '[]'::jsonb) AS goals,
      COALESCE((SELECT jsonb_object_agg(preference_key,value) FROM finbridge_preferences WHERE user_id=$1 AND deleted_at IS NULL), '{}'::jsonb) AS settings
  `, [owner]);
  return { ...fallback, ...result.rows[0] };
}
export async function readFinanceTables(client: PoolClient, owner: string, fallback: AppState): Promise<AppState> {
  // Static queries retain the same authoritative columns, owner filters and ordering.
  // Batch on the existing transaction/client: Promise.all on one pg client would
  // still serialize network round trips. No data is shared or cached across users.
  const queries = [
    ["categories", "SELECT * FROM finbridge_categories WHERE user_id=$1 AND deleted_at IS NULL ORDER BY position"],
    ["links", "SELECT l.wallet_id,c.name FROM finbridge_wallet_categories l JOIN finbridge_categories c ON c.user_id=l.user_id AND c.id=l.category_id WHERE l.user_id=$1 AND l.deleted_at IS NULL ORDER BY l.position"],
    ["children", "SELECT category_id,name FROM finbridge_category_children WHERE user_id=$1 AND deleted_at IS NULL ORDER BY position"],
    ["transactions", `SELECT (t.data - 'fixedExpenseId' - 'fixedExpenseDueDate' - 'paymentConfirmation' - 'targetWallet') || jsonb_build_object('title',t.title,'amount',t.amount,'type',t.direction,'wallet',t.wallet_id,'category',COALESCE(c.name,''),'date',t.occurred_on::text || substring(COALESCE(t.data->>'date','') FROM 11)) || CASE WHEN t.target_wallet_id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('targetWallet',t.target_wallet_id) END || CASE WHEN t.fixed_expense_id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('fixedExpenseId',t.fixed_expense_id,'fixedExpenseDueDate',t.fixed_due_on::text,'paymentConfirmation',t.payment_confirmation) END AS data FROM finbridge_transactions t LEFT JOIN finbridge_categories c ON c.user_id=t.user_id AND c.id=t.category_id WHERE t.user_id=$1 AND t.deleted_at IS NULL ORDER BY t.position`],
    ["goals", `SELECT b.data || jsonb_build_object('kind','budget','title',b.title,'amount',b.amount,'currency',trim(b.currency),'wallet',b.wallet_id,'category',COALESCE(c.name,''),'date',b.starts_on::text,'cycle',b.cycle) AS data,b.position FROM finbridge_budgets b LEFT JOIN finbridge_categories c ON c.user_id=b.user_id AND c.id=b.category_id WHERE b.user_id=$1 AND b.deleted_at IS NULL UNION ALL SELECT data || jsonb_build_object('title',title,'kind',goal_kind,'amount',target_amount,'saved',saved_amount,'currency',trim(currency)),position FROM finbridge_goals WHERE user_id=$1 AND deleted_at IS NULL ORDER BY position`],
    ["fixedExpenses", `SELECT e.data || jsonb_build_object('title',e.title,'budgetId',COALESCE(e.budget_id,''),'walletId',e.wallet_id,'category',COALESCE(c.name,''),'amount',e.amount,'dueDate',e.due_on::text,'recurrence',e.recurrence,'active',e.active) AS data FROM finbridge_fixed_expenses e LEFT JOIN finbridge_categories c ON c.user_id=e.user_id AND c.id=e.category_id WHERE e.user_id=$1 AND e.deleted_at IS NULL ORDER BY e.position`],
    ["preferences", "SELECT preference_key,value FROM finbridge_preferences WHERE user_id=$1 AND deleted_at IS NULL"],
    ["recipients", "SELECT expense_id, data || jsonb_build_object('bankBin',trim(bank_bin),'accountNumber',account_number,'accountName',account_name,'reference',reference) || CASE WHEN preferred_app IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('preferredApp',preferred_app) END AS data FROM finbridge_fixed_expense_recipients WHERE user_id=$1 AND deleted_at IS NULL"],
    ["messages", "SELECT conversation_id,data || jsonb_build_object('role',role,'text',body) AS data FROM finbridge_chat_messages WHERE user_id=$1 AND deleted_at IS NULL ORDER BY position"],
    ["conversations", "SELECT id,data FROM finbridge_conversations WHERE user_id=$1 AND deleted_at IS NULL"],
    ["wallets", `SELECT data || jsonb_build_object('name',name,'currency',trim(currency),'initial',opening_balance,'type',wallet_type,'archived',archived) AS data FROM finbridge_wallets WHERE user_id=$1 AND deleted_at IS NULL ORDER BY position`],
    ["drafts", `SELECT data AS data FROM finbridge_transaction_drafts WHERE user_id=$1 AND deleted_at IS NULL ORDER BY position`],
    ["onboarding", `SELECT data AS data FROM finbridge_onboarding_drafts WHERE user_id=$1 AND deleted_at IS NULL ORDER BY position`],
    ["recurring", `SELECT data || jsonb_build_object('wallet',wallet_id,'amount',amount,'type',direction) AS data FROM finbridge_recurring_transactions WHERE user_id=$1 AND deleted_at IS NULL ORDER BY position`],
    ["rules", `SELECT to_jsonb(rule_text) AS data FROM finbridge_categorization_rules WHERE user_id=$1 AND deleted_at IS NULL ORDER BY position`],
  ] as const;
  const result = await client.query<{ sections: Record<string, import("pg").QueryResultRow[]> }>(
    `SELECT jsonb_build_object(${queries.map(([name, sql]) =>
      `'${name}', COALESCE((SELECT jsonb_agg(to_jsonb(finance_rows)) FROM (${sql}) finance_rows), '[]'::jsonb)`
    ).join(",")}) AS sections`, [owner],
  );
  if (!result.rows[0]?.sections) throw new Error("FINANCE_READ_UNAVAILABLE");
  const sections = result.rows[0].sections;
  const wallets = sections.wallets.map(r => r.data);
  const cats = sections.categories;
  const links = sections.links;
  const children = sections.children;
  const transactions = sections.transactions.map(r => r.data);
  const goals = sections.goals.map(r => r.data);
  const fixedExpenses = sections.fixedExpenses.map(r => r.data);
  const preferences = sections.preferences;
  const recipients = sections.recipients;
  for (const expense of fixedExpenses) expense.paymentRecipient = recipients.find(r => r.expense_id === expense.id)?.data;
  const messages = sections.messages;
  const drafts = sections.drafts.map(r => r.data);
  const conversations = sections.conversations;
  return { ...fallback, onboardingDraft: (sections.onboarding.map(r => r.data))[0], wallets, transactions, goals, fixedExpenses, recurring: sections.recurring.map(r => r.data), categories: cats.filter(c => c.listed).map(c => c.name), categoryMeta: Object.fromEntries(cats.map(c => [c.name, { ...c.data, type: c.category_type, icon: c.icon, archived: c.archived, children: children.filter(row => row.category_id === c.id).map(row => row.name) }])), walletCategories: Object.fromEntries(wallets.map(w => [w.id, links.filter(l => l.wallet_id === w.id).map(l => l.name)])), settings: Object.fromEntries(preferences.map(p => [p.preference_key, p.value])), rules: (sections.rules.map(r => r.data)).map(String), ...(fallback.transactionChat || messages.some(m => m.conversation_id === "transactions") ? { transactionChat: { messages: messages.filter(m => m.conversation_id === "transactions").map(m => m.data), drafts, clarifyingDraftId: conversations.find(c => c.id === "transactions")?.data.clarifyingDraftId || null, activeDraftId: conversations.find(c => c.id === "transactions")?.data.activeDraftId || null, referencedCategories: conversations.find(c => c.id === "transactions")?.data.referencedCategories || [] } } : {}), planningChat: messages.filter(m => m.conversation_id === "planning").map(m => m.data) };
}
