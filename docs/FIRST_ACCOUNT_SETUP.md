# First-account setup and spending guidance

## Flow

Welcome → Create account / existing login → verified email or Google session →
seven setup steps → workspace. `/onboarding` redirects to the appropriate auth/app
entry; the old marketing slides are removed. English is the default, with VI/ZH
available in setup. A Google account is created by the existing OAuth flow; email
signup still requires email verification.

Setup covers preferred name, optional occupation (never assumed to be Student), manually tracked wallets and opening
balances/currencies, separate expense/income categories (including custom names),
recurring fixed costs and per-wallet reserves. Travel appears once. A fixed cost
may exist before a budget; it can later be linked to a compatible budget in
Planning. No budget ceiling is invented from a fixed bill amount.

## Persistence and access

Run `npm run auth:migrate` against the intended database. This adds
`finbridge_onboarding`, keyed to the authenticated server user with a unique
primary key and a foreign key to the auth user. GET never creates a completion;
POST requires a session and the configured origin, validates a closed payload,
and preserves the first completion on replay/concurrent requests.

Existing users without a record see setup once too. Existing transactions,
budgets and unselected wallets are preserved. Existing wallet types are kept, and
wallets with recorded transactions retain their currencies. Legacy-copy/backup
controls remain available before setup when eligible. Completing setup is not payment
approval and creates zero actual expenses. Opening balances are opening balances,
not current balances; imported history is retained. Negative opening balances
are permitted for overdrafts rather than forcing fabricated zero balances.
Reserves remain non-negative; fixed costs must be positive. Rehydration is idempotent.

Authenticated drafts, completed setup and subsequent financial edits now persist in PostgreSQL. Wallets, categories, budgets, transactions, preferences and chats have account-owned business tables. Existing account-owned browser records require an explicit one-time import. See [database structure](DATABASE.md).

## Forecasts and AI boundary

Due-date/reserve notices appear in Home and Planning while the application is
open. They are not scheduled push/email delivery; external reminders need a
background job, delivery provider, consent and timezone policy. Reminders use the
selected lead time, first due date, month-start/month-end position and recurrence
interval. Month ends are recomputed for each occurrence, including leap years.

Forecasts are conditional: if a bill remains unpaid, subtract its amount from the
tracked balance in the same wallet. There is no bank reconciliation or automatic
paid-bill match. No future income or FX rate is predicted. Transfers into a
different currency without a destination amount disable that wallet's forecast.
Each bill is an individual scenario, not a combined forecast of all bills.

Budget pacing compares recorded spending through today against the elapsed part
of the budget's own cycle. It shows a labeled linear estimate at the current
pace and `(limit - spending) / remaining days` as a suggested daily ceiling,
rounded down to the currency's minor unit (whole VND/JPY, cents for CNY/USD).
It does not debit money or change budget limits.

Gemini retains its existing intent-routing responsibilities. Budget questions
use the locally computed spending guidance; the chat also has a View spending
plan button that works without Gemini. Preferred-name greetings and these new
planning results are stored in the account database. Planning chat messages carry `localOnly`
and are excluded from subsequent model history, including after restoration.
No new onboarding name or financial-planning payload is sent to Gemini.

## Verification

`npm run test:onboarding` runs schema/merge, recurrence, reserves, pacing,
history-filtering, complete-form, retry/double-click and repository/endpoint
checks. PostgreSQL tests require `AUTH_TEST_DATABASE_URL` pointing to the named
local `finbridge_auth_test` database; fixtures use isolated generated user IDs.
They must not be run against production.

Existing `test:auth`, `test:auth:postgres`, `test:transaction-ai`, auth-form,
settings and planning checks remain applicable. The old Jack assertion is updated
to the approved Jake name; the planning harness loads the new real outlook
component. No previous financial assertions are removed.
