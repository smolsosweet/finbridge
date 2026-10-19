// Test-only snapshot before row-delta optimization, from a617d51.
import { isDeepStrictEqual } from "node:util";
import { createHash } from "node:crypto";
const fingerprint = (value) => createHash("sha256").update(value).digest("hex");
const categoryId = (name) => name ? fingerprint(name) : null;
async function upsert(client, owner, table, fields, rows) {
    // SQL identifiers are static application constants. All user values are bound.
    const types = { id: "TEXT", data: "JSONB", position: "INTEGER", ...fields }, columns = Object.keys(types);
    // Release live unique keys before inserting replacements in this same revision.
    // The entire workspace save is transactional; removed rows remain recoverable.
    await client.query(`UPDATE ${table} SET deleted_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND deleted_at IS NULL AND NOT(id=ANY($2::text[]))`, [owner, rows.map(r => r.id)]);
    await client.query(`INSERT INTO ${table}(user_id,${columns.join(",")}) SELECT $1,${columns.map(k => "r." + k).join(",")} FROM jsonb_to_recordset($2::jsonb) AS r(${Object.entries(types).map(([k, t]) => `${k} ${t}`).join(",")}) ON CONFLICT(user_id,id) DO UPDATE SET ${columns.filter(k => k !== "id").map(k => `${k}=EXCLUDED.${k}`).join(",")},deleted_at=NULL,updated_at=CURRENT_TIMESTAMP`, [owner, JSON.stringify(rows)]);
}
function financeTableWrites(s) {
    const writes = [];
    const add = (table, types, rows) => { writes.push({ table, types, rows }); };
    add("finbridge_wallets", { name: "TEXT", currency: "TEXT", opening_balance: "NUMERIC", wallet_type: "TEXT", archived: "BOOLEAN" }, s.wallets.map((w, position) => ({ id: w.id, data: w, position, name: w.name, currency: w.currency, opening_balance: w.initial, wallet_type: w.type, archived: !!w.archived })));
    const names = [...new Set([...s.categories, ...Object.keys(s.categoryMeta), ...s.transactions.map(t => t.category), ...s.goals.map(g => g.category), ...(s.fixedExpenses || []).map(e => e.category)])].filter(Boolean);
    add("finbridge_categories", { name: "TEXT", category_type: "TEXT", icon: "TEXT", archived: "BOOLEAN", listed: "BOOLEAN" }, names.map((name, position) => ({ id: categoryId(name), data: s.categoryMeta[name] || { children: [] }, position, name, category_type: s.categoryMeta[name]?.type || (s.transactions.some(t => t.category === name && t.type === "income") ? "income" : "expense"), icon: s.categoryMeta[name]?.icon || "", archived: !!s.categoryMeta[name]?.archived, listed: s.categories.includes(name) })));
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
    return JSON.parse(JSON.stringify(writes));
}
export async function legacyWriteFinanceTables(client, owner, s, previous) {
    const old = new Map(previous ? financeTableWrites(previous).map(write => [write.table, write.rows]) : []);
    for (const write of financeTableWrites(s)) {
        if (previous && isDeepStrictEqual(old.get(write.table), write.rows))
            continue;
        await upsert(client, owner, write.table, write.types, write.rows);
    }
}
