# AI quota deployment and behavior

All seven Gemini routes require a verified signed-in account and a same-origin POST:
`assistant`, `transaction-drafts`, `receipt-drafts`, `speech-transcription`,
`scenario-planner`, `proactive-feed`, and `workspace-actions`.
An anonymous local demo can use manually tracked finance features, but cannot call Gemini.

## Accounting

PostgreSQL is the only quota store. No process memory fallback exists.
The SDK's custom HTTP transport reserves quota immediately before each external request.
Local validation, deterministic follow-up replies and SDK errors before transport do not consume points.
Every network attempt counts, including provider errors, timeouts, and ambiguous network errors.
SDK automatic retry is disabled (`attempts: 1`). A user-triggered retry is a new charge.

| Route | Points per provider request |
| --- | --- |
| Assistant, transaction drafts, scenarios, proactive feed, workspace actions | 1 |
| Speech transcription | 2 |
| Receipt drafts | 3 |

Every reservation checks five counters in one transaction: server daily points,
server daily request count, server minute request count, account daily points,
account minute points. Conditional UPSERTs refuse any increment above its ceiling.
If any check fails, the entire transaction rolls back, including earlier increments.
Transactions use a shared `gemini` control row lock followed by the five counters in that order.
The lock lasts only for the database transaction, never during the Gemini request.

Days follow **America/Los_Angeles**, including daylight saving transitions, matching
Gemini's Pacific midnight RPD reset. Minute windows are fixed UTC minutes; bursts
can straddle a minute boundary. Daily limits and the provider cooldown still apply.
Production time is obtained from PostgreSQL, not the browser or individual Vercel instances.

A cancellation after a successful reservation but before invoking transport releases all
five increments. Release is owner-scoped and idempotent through a reservation UUID.
Once transport is invoked, no refund is issued, even if delivery is uncertain.
A process crash after reservation can leave a conservative charge until window reset.
No automatic expiry refund can undercount a request that may already have reached Google.

Provider HTTP 429 persists a shared pause for at least the configured cooldown or
the provider's Retry-After, whichever is longer (up to 24 hours). New requests during
this pause cannot reach Gemini. Requests already dispatched cannot be recalled.
Daily provider quota exhaustion may need an administrator to lower the application
budget or wait for the provider reset; the short pause does not replenish provider quota.

## Configure before deploying

1. Check the actual model IDs and active RPM, TPM and RPD in the Google AI Studio
   project used by the production key. Limits are per project, not per key.
   Include any other app sharing that project in the budget.
2. Set these **required** server-only variables on Vercel Production and Preview:
   - `AI_QUOTA_SERVER_DAILY_POINTS`
   - `AI_QUOTA_SERVER_DAILY_REQUESTS`
   - `AI_QUOTA_SERVER_MINUTE_REQUESTS`
3. Optional variables: `AI_QUOTA_USER_DAILY_POINTS` (default 40),
   `AI_QUOTA_USER_MINUTE_POINTS` (default 6), `AI_QUOTA_COOLDOWN_SECONDS` (default 60).
   Each value must be a positive safe integer. A request costs its route's points;
   a minute budget smaller than a route cost prevents that route from running.
4. Use request limits below the actual RPM/RPD with headroom for other callers.
   Weighted points are an application allowance, **not an exact token/cost meter**.
   They do not prove compliance with TPM. The shared 429 pause handles provider rejection;
   strict token ceilings require separate token accounting and are outside this phase.
5. Inspect the intended target with `npm run ai:quota:migrate` (dry run).
   Apply only with `npm run ai:quota:migrate -- --apply --confirm-target=HOST:PORT/DATABASE`,
   using the exact host/database displayed (configured DATABASE_URL).
   Validate on an isolated Neon branch first, then the production target.
   `npm run auth:migrate` also includes the new tables.
6. Redeploy only after both the schema and production variables are ready.
   Missing variables, schema, or database availability cause AI to return 503 with
   a manual-entry message. No Gemini call is made. Other finance features are unaffected
   by quota-specific errors; general database outages can still affect saved finance data.

Do not copy arbitrary example limits into production without checking AI Studio.
The implementation cannot determine the private project's actual entitlement or billing tier.
The current work does not migrate Neon Production or change Vercel settings automatically.

## Competition profile selected on 2026-10-19

The owner supplied this AI Studio snapshot. Values after the slash are limits;
values before it are observed usage, not a second allowance.

| Model | RPM limit | TPM limit | RPD limit |
| --- | --- | --- | --- |
| Gemini 3.1 Flash Lite | 15 | 250,000 | 500 |
| Gemini 3.5 Flash Lite | 15 | 250,000 | 500 |

The code defaults to `gemini-3.1-flash-lite`; no model override was found in
`.env.local`. This does not establish the model override configured on Vercel.
Antigravity is a separate product/category and is not used to size FinBridge's allowance.
The snapshot does not establish Free/Paid billing status; check that separately for privacy disclosures.

The selected deployment profile, also supplied in `.env.example`, is:

```dotenv
AI_QUOTA_SERVER_DAILY_POINTS=300
AI_QUOTA_SERVER_DAILY_REQUESTS=300
AI_QUOTA_SERVER_MINUTE_REQUESTS=6
AI_QUOTA_USER_DAILY_POINTS=60
AI_QUOTA_USER_MINUTE_POINTS=6
AI_QUOTA_COOLDOWN_SECONDS=60
```

This permits at most 300 one-point requests per app day, with fewer requests when
audio/receipts consume additional points. The user allowance is shared by everyone
signed into that account. A user can spend 60 points/day, including two receipts
or three audio requests within a fixed minute. A chat interaction that calls multiple
routes consumes each provider request separately.

The server minute ceiling is deliberately 6: adjacent fixed-minute bursts can admit
up to 12 app requests in a rolling minute, below the reported 15 RPM. Other callers
sharing the Google project can still consume the remaining allowance. App counters
cannot see usage incurred before this deployment or by another application.
Do not add the two model quotas together or enable automatic model fallback on that assumption.
TPM remains a separate provider limit; these request/point budgets do not guarantee it.

Quota day rollover is Pacific midnight: during 21-24 October 2026 this is 14:00
in Vietnam/Thailand (UTC+7). The implementation follows daylight saving changes
automatically and should not be replaced by a hard-coded UTC offset.

## Responses and UI

Quota denial or provider pause returns HTTP 429, Retry-After seconds, no-store and
`manualEntryAvailable: true`. Quota infrastructure/configuration failure returns 503.
Messages support English, Vietnamese and Chinese through `x-finbridge-language`
(fallback: Accept-Language). UI keeps typed input and existing manual entry forms.
Proactive feed retains the deterministic alerts when AI explanation is unavailable.
Scenario quota errors are returned before deterministic fallback so the limitation is visible.

## Metadata and tests

The tables contain account IDs, route names, counters, windows and reservation IDs only.
Prompts, financial amounts, files, email addresses and API tokens are never stored there.
On successful quota reservations, expired counters and reservations older than seven days
are removed. If no AI requests succeed, cleanup waits until the next successful reservation.

`npm run test:ai-quota` exercises boundaries and real routes/SDK with synthetic DB/provider
stubs and no network. `npm run test:ai-quota:postgres` uses only the existing explicitly
guarded **local finbridge_auth_test** database. Cloud URLs and app database names are
rejected before connecting. Never put Neon Production into test environment variables.

PostgreSQL acceptance includes 50 simultaneous callers with one place left, owner isolation,
rollback of global counters on account denial, weighted points, minute/day resets,
idempotent owner-scoped refunds, provider cooldown across accounts and missing schema.
These suites are included in the CI business checks. Streamed body limits,
client image sizing, output caps and security headers are described in AI_INPUT_SECURITY.md.

## Local verification — 2026-10-19

| Check | Result |
| --- | --- |
| AI quota unit + all seven real routes with real SDK and stubbed transport | 12 passed |
| Isolated local PostgreSQL quota acceptance | 9 passed |
| Existing conversation and assistant regression | 45 passed |
| TypeScript | Passed |
| ESLint | 0 errors, 32 existing warnings |
| Production build | Passed |

These are local results with synthetic provider data, not a production Gemini smoke test.
This table records the initial quota-only local acceptance. Subsequent local commits
and full-suite results are tracked in LOCAL_RELEASE_RESULTS.md. No production schema
migration, Vercel configuration edit, push or deployment was performed. The budget
still needs to be applied to Vercel together with the schema migration before deploying.
