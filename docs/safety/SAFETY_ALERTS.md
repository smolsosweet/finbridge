# Safety thresholds and alerts

Planning → Safety thresholds & alerts is the primary entry. Settings links to
notification preferences, and the shared header bell opens history. The editor
follows scope → threshold → notifications → review, in EN/VI/ZH.

## Conditions and calculations

- Budget actual/forecast spending reaches or exceeds a percentage or money threshold.
- Recorded wallet balance falls strictly below a positive monetary floor.
- Budgets inherit existing wallet, category, currency, anchor date and cycle.
- There is no FX conversion, real bank connection or automatic payment/blocking.
- Forecasts extrapolate total recorded spending pace. At least three elapsed days
  and a recorded expense are required while the period has remaining days.
  Scheduled bills are not added separately: reliable paid-occurrence matching is
  not in the current ledger. Scenario Planner's bill scenarios remain distinct;
  their results must not be presented as the same model as pace alerts.
- Future transactions, income and transfers do not count as actual expenses.
  Future income does not count toward current reserve balances. Unknown incoming
  FX destination amounts disable the affected reserve estimate.
- Currency precision, time zones and safe-integer checks precede comparisons.

## Source consent and persistence

`finbridge_safety` stores the account-owned revisioned rules and alert snapshot.
`finbridge_safety_events` retains alerts and queue state; `finbridge_safety_changes`
retains rule/source changes. Rules pause without hard deletion. PostgreSQL
`finbridge_safety_limits` bounds accepted updates to 60 per user per minute.

The user explicitly selects a publishing device. Snapshot fields include wallet
names/currencies/opening balances, minimal transaction amounts/dates/categories
and budget details. Notes, receipts, chats and unrelated settings are excluded.
This is **alert snapshot synchronization**, not full workspace synchronization or
an authoritative bank ledger. Switching the source replaces that snapshot without
merging or overwriting local ledgers on other devices. The publisher uses a source
identifier and optimistic revision checks; conflicts stop automatic publication
until the user reviews and reselects the source. Updates debounce after changes
and refresh every five minutes while open. Snapshots older than 24 hours suspend
background alert creation and pending stale emails. An open device is not proof
its manually recorded data is complete.

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
2. Open Planning → Safety thresholds & alerts, review source consent, choose the
   device and create a rule. In-app alerts do not require a mail provider.
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
local feature development. Push/SMS, digests, arbitrary recipients, full workspace
cloud sync, bill-payment matching and delivery webhooks are outside this version.

## Verification

- `npm run test:safety`: calculations, schemas, request boundary, redaction and
  email behavior (external network mocked).
- `npm run test:safety:postgres`: real PostgreSQL account isolation, revision/source
  conflicts, concurrent writes, migration, outbox and account closure. Refuses any
  database other than local `finbridge_auth_test`.
- UI: `node --no-warnings --experimental-strip-types --experimental-loader
  ./scripts/ts-extension-loader.mjs scripts/verify-safety-ui.mjs`. Uses a disposable
  test user and copied app under ignored `.local`, with desktop/mobile screenshots.
  Set `SAFETY_PLAYWRIGHT_PATH` to Playwright and optionally `CHROME_BIN`.
