# Safety thresholds and alerts

Planning → Safety thresholds & alerts is the primary entry. Settings links to
notification preferences. One shared header bell combines threshold event history
and current financial reminders, with All/Unread filters and a combined unread badge.
Reading an event affects only its read state; it does not resolve a condition, pause
a rule or record a payment. The center links to alert settings and full history. The editor
follows scope → threshold → notifications → review, in EN/VI/ZH.

## Conditions and calculations

- Budget actual/forecast spending reaches or exceeds a percentage or money threshold.
- Recorded wallet balance falls strictly below a positive monetary floor.
- Budgets inherit existing wallet, category, currency, anchor date and cycle.
- There is no FX conversion, real bank connection or automatic payment/blocking.
- Forecasts extrapolate total recorded spending pace. At least three elapsed days
  and a recorded expense are required while the period has remaining days.
  Scheduled bills are not added separately to the recorded spending pace.
  Bill payment tracking uses explicit user-confirmed occurrence links. Scenario Planner's bill scenarios remain distinct;
  their results must not be presented as the same model as pace alerts.
- Future transactions, income and transfers do not count as actual expenses.
  Future income does not count toward current reserve balances. Unknown incoming
  FX destination amounts disable the affected reserve estimate.
- Currency precision, time zones and safe-integer checks precede comparisons.

## Database persistence

Authenticated workspace records live in PostgreSQL business tables, including wallets,
categories, wallet assignments, transactions, budgets, fixed costs, preferences and chats.
See [database structure](../DATABASE.md). `finbridge_alert_rules` stores individual
conditions; several actual/forecast thresholds share one configuration group. Rule
edits commit atomically and removed conditions are archived.

`finbridge_safety` retains evaluation state; `finbridge_safety_events` retains alerts
and queue state; `finbridge_safety_changes` retains configuration history. Rule writes
are limited to 60 per account per minute. Alert snapshots are derived server-side
from database financial records on workspace save and during scheduled evaluation.
The client cannot upload an alternate snapshot or select a publishing device.
Database records do not expire after 24 hours; manually recorded data can still be
incomplete. The worker excludes notes, receipt images and chats from calculations.

## Alerts and email

Actual rules notify once per threshold per budget period. Simultaneously crossed
actual thresholds for one scope collapse to the highest threshold. Forecast and
reserve rules notify on a new breach, with a 24-hour cooldown. Unknown results
are not evidence of recovery. Marking read does not clear the risk. Historical
alerts retain their original evaluation timestamp after subsequent edits.

Email is opt-in per rule and goes only to the active user's current verified
account email. **It contains a generic reminder and ordinary protected link;
wallet/rule names, amounts, thresholds and forecasts are not sent to Brevo.**
Neither owner nor recipient comes from the request body. Queue states distinguish
pending, sending, provider-accepted, failed, cancelled and unknown. Acceptance
does not establish inbox delivery. Definite 429 responses retry at most three
attempts with 15-minute spacing. Timeouts, 5xx ambiguity and stale in-progress
claims become unknown and are not blindly resent. Exactly-once email delivery
is not claimed. In-app creation and source/rule updates commit atomically.
Before sending, the worker rechecks account status, email verification, rule,
period, threshold and freshness. Account locking prevents sends after completed
closure. A PostgreSQL advisory lock serializes worker invocations.

## Setup and rollout

1. Run `npm run auth:migrate`. New tables are additive/idempotent; no account or
   financial reset is performed.
2. Open Planning, choose Safety thresholds & alerts, then create a configuration with actual spending, forecast spending, or both. In-app alerts do not require a mail provider.
3. For email, configure existing verified Brevo sender variables:
   `AUTH_EMAIL_MODE=brevo`, `BREVO_API_KEY`, `AUTH_EMAIL_FROM`, and canonical HTTPS
   `BETTER_AUTH_URL`. Keep keys outside Git/browser bundles.
4. Set a separate random `SAFETY_CRON_SECRET` (at least 32 characters). Configure a
   hosting scheduler to POST `/api/internal/safety` with
   `Authorization: Bearer <SAFETY_CRON_SECRET>`, for example every five minutes.
   Setting the secret does not create a scheduler. Monitor failed invocations.
5. Set `SAFETY_EMAIL_ENABLED=true` after validating the scheduler and sender.
   It defaults off and does not bypass users' per-rule consent.
6. Verify application/database TLS, backups, provider quotas and monitoring, and
   review snapshot retention/privacy policy for the actual deployment.

Each invocation evaluates at most 50 accounts and sends at most 10 queued emails;
scheduling capacity must match usage. No real email or scheduler is enabled by
local feature development. Push/SMS, digests, arbitrary recipients, real-time
collaborative editing, automatic bank reconciliation and delivery webhooks are outside this version.

## Verification

- `npm run test:safety`: calculations, schemas, request boundary, redaction and
  email behavior (external network mocked).
- `npm run test:safety:postgres`: real PostgreSQL account isolation, revision
  conflicts, concurrent writes, migration, outbox and account closure. Refuses any
  database other than local `finbridge_auth_test`.
- UI: `node --no-warnings --experimental-strip-types --experimental-loader
  ./scripts/ts-extension-loader.mjs scripts/verify-safety-ui.mjs`. Uses a disposable
  test user and copied app under ignored `.local`, with desktop/mobile screenshots.
  Set `SAFETY_PLAYWRIGHT_PATH` to Playwright and optionally `CHROME_BIN`.
