# Chat and transaction-save performance

Baseline: `a617d51`. Branch: `codex/production-chat-save-performance`.

## Confirmed costs before changes

- Chat: the frontend waits for relevant financial saves, then calls `/api/ai/assistant`. The route checks origin/session/account, loads the account-owned workspace, calls the configured Gemini model once for normal interpretation, validates the result and performs deterministic calculations. Settings and some explicit field replies already have zero-model paths. A routed creation or legacy scenario fallback can still make a second request. No model/prompt/orchestration feature was removed.
- Both AI reads and transaction saves hydrate the financial workspace through **15 sequential SQL reads**. Save does this after acquiring the workspace revision lock. Network round-trip latency therefore adds to both user-visible operations.
- `writeFinanceTables` already skips unchanged tables, but previously rewrote all rows of a changed table. Adding one transaction to a synthetic 1,000-transaction workspace emitted two statements and **1,001 transaction rows**, even though only one row changed. Conversation edits had the same issue within their table.
- The module-scoped PostgreSQL pool already exists (`max:5`); SDK retries already use one attempt. These configurations are unchanged. Confirmation still waits for actual server acknowledgement; no optimistic success or automatic write retry was introduced.
- Local demo bypasses authentication/database; production does not. This difference is established by code, but there are no production timings in this task proving the dominant source of Vercel latency. Cold start, provider latency, DB region, pool contention and actual platform limits need hosting-side evidence.

## Changes

1. `finance-tables.ts`: batch the same fifteen static, owner-filtered SELECTs into one SQL JSONB envelope using the existing connection and transaction. Keep authoritative column overrides, ordering, soft-delete filters and state assembly. This is **one hydration query**, not one query for an entire authenticated request. Full histories and receipt content are still read; their total transfer size has not been reduced.
2. Within established workspace revisions, write only changed/new rows and soft-delete only removed IDs. Retain position changes, restore-by-ID behavior, JSON normalization and atomic statement order. Initial import without previous relational data still reconciles the full tables. `writeAlertRules` retains its existing full reconciliation. No database migration or new data source/cache is required.
3. `ai-request-timing.ts` and the six AI routes: request-local auth, workspace, model and financial-calculation durations, model-call counts, generated request correlation ID, private/no-store responses and `Server-Timing`. Existing JSON response bodies, statuses, prompts, configured model, cancellation and deadlines remain intact.
4. `workspace-repository.ts` and `/api/workspace`: add timings for pool acquisition, hydration, typed-row writes and safety refresh. The outer route already reports auth and total time; its logs/headers now include these details. Read/write validation, account lifecycle checks, revision locks, mutation-ID/hash replay handling and insufficient-funds checks remain in their existing order.

Timing logs contain only static stage/route names, generated request IDs, statuses, counts and durations. They never receive messages, wallet/transaction names, amounts, user IDs, keys, cookies or DB URLs. Nested workspace sub-stages overlap the outer workspace duration; do not sum every timing as if independent. Model duration includes network/provider wait. Time before handler execution, client-side preparation/upload and frontend queuing are not included.

The database change is request-scoped and uses the current repeatable-read/write transaction. There is no financial cache or cross-account memoization. No increased pool size or parallel reads on the same pg client are used; those would either increase connection pressure or still serialize network operations.

## Verification

- Baseline common regression suite: **221 passed**.
- Same suite after changes: **221 passed**; with ten new performance/equivalence tests: **231 passed**.
- `npm run typecheck`: passed.
- Scoped ESLint: zero errors; one pre-existing unused `outputSchema` warning in `transaction-drafts/route.ts`.
- Production build verification uses `npm run build -- --webpack`; this is a local build, not Vercel deployment/runtime verification.

Synthetic checks:

| Operation | Before | After |
| --- | --- | --- |
| Relational hydration queries | 15 | 1 |
| Add one expense to 1,000 existing expenses | 2 write statements / 1,001 rows | 1 write statement / 1 row |
| Artificial 8 ms/query hydration benchmark, median of five runs | approximately 230–235 ms | approximately 15–16 ms |

The synthetic elapsed times include Windows timer scheduling and JavaScript work. They demonstrate the removed round trips, **not actual PostgreSQL or Vercel response latency**. Memory tests compare row payloads and soft-deletion effects against the pre-change implementations; they do not execute PostgreSQL constraints or query plans. Original readers/writers are test-only fixtures under `scripts/fixtures/`.

Run unit performance checks with `npm run test:chat-performance`. Existing suites continue testing actual draft-button disable logic, confirmed/repeated saves, insufficient funds, currency handling, contexts, budgets, bills, tools, relative deletion, settings and ownership guards.

Real PostgreSQL integration was attempted and could not start because `AUTH_TEST_DATABASE_URL` is absent. No app/production database was used. `npm run test:finance-performance:postgres` contains batched-reader parity, foreign-account checks and delta insert/edit/delete/reorder/conversation parity. It requires only the named isolated local `finbridge_auth_test`, enforced by `testPool`; configure that test database and also run the existing workspace, bill-payment and safety PostgreSQL suites before releasing the shared reader/writer.

## Production verification needed

- Check deployed commit, Vercel function region/duration and PostgreSQL region/connection mode. Do not print credentials.
- Capture one slow `/api/ai/assistant` and one slow `/api/workspace` in Network/Vercel Logs, including response time, HTTP status, generated request ID and `Server-Timing`. A request for this information was sent to the user during implementation; no response was yet available.
- Compare equivalent authenticated workloads before/after (same account snapshot, question, history and concurrency); separate warm p50/p95 and cold requests. Verify that the deploy actually contains this branch before attributing any behavior to it.
- If `model` dominates, SQL optimization alone will not fix the whole delay. If `pool` dominates, inspect connection contention. If `hydrate` or `write` dominates, inspect region/network, execution plans and payload sizes. Keep safety refresh transactional; its cost is now visible rather than silently bypassed.
- Verify actual persistence and fresh reload, not just HTTP 200. Exercise repeat confirmation, declined insufficient-funds writes, receipt saves, contextual questions, fixed-bill confirmation, account switching and concurrent revision conflict.

No production speed-up, successful production persistence, commit, push or deploy is implied by the local checks. Each optimization is independently reversible without a data migration.
