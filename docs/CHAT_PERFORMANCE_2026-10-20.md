# Chat and workspace performance audit — 20 October 2026

Work is local on `codex/chatbot-local-test`, based on b61b724 as requested.
The branch predates the latest main auth/quota/path migration. This report does
not authorize deploying the old branch over main or dropping main's guards.
The earlier uncommitted spoken-amount changes were retained.

## Evidence and limits

No Vercel log connector, deployment token or isolated PostgreSQL test URL is
available in this session. Production latency, cold-start duration, database
region and network RTT are unknown. The previously supplied 401 logs stopped
before the model and cannot explain successful production request latency.

The existing code already batches 15 financial sections in one SQL call,
writes changed rows only, deduplicates safety refreshes and polls once/minute.
An analysis waits for financial saves but not chat-only autosaves. Those paths
were retained. Auth and owned reads are dependencies; pg calls within the same
transaction/client would still serialize under Promise.all.

Confirmed removable work:

- AI endpoints loaded persisted chat messages, pending drafts and onboarding
  twice: the base JSON snapshot and the relational hydration. The request already
  supplies bounded conversation/clarification parameters. Financial analysis
  uses wallets, transactions, categories, budgets, goals, expenses and settings.
- Successful saves used UPDATE RETURNING * and parsed the whole workspace again,
  even though the canonical input was already validated and the HTTP response
  usually contained only an acknowledgement.
- A creation first recognized by the general assistant triggered another API,
  auth/read and model interpretation to extract the same utterance.

## Changes

- `workspaceRepository.readForAnalysis` projects out conversation/onboarding
  fields and uses the same account lock, lifecycle check, repeatable-read
  transaction and financial queries. Full workspace reads and save validation
  remain complete. No cache or alternate data source was introduced.
- Finance hydration excludes four conversation sections for analysis only:
  15 → 11 subqueries, still **one batched SQL round trip**. All financial values,
  ordering, payment links and owner/soft-delete filters are retained.
- Save UPDATE returns revision/timestamp only. The repository returns the same
  canonical input data after COMMIT; revision history, safety refresh, locking,
  validation, idempotency and error handling remain in the transaction.
- The assistant can include a validated creation proposal from its original
  extraction. The existing card consumes it without another request. Stable IDs
  match the creation planner. Existing endpoints/required response fields remain;
  `workspaceProposal` is an additive optional response field. Legacy responses,
  unavailable extraction and explicit local demo retain the previous fallback.
- Provider testing exposed missing fields in the initial optional schema. The
  final schema requires every creation field, using null only when unknown.
  A typed category clarification is also kept with its existing pending category
  instead of being dropped into transaction correction.
- Request-local pg query counts and durations are added without logging SQL,
  parameters, identities or data. Proxies never modify pooled-client methods.
  Server-Timing includes total time. Database counts cover workspace repository
  calls; separate authentication queries are included in auth duration, not in
  this counter. Nested stages overlap and must not be added together.

Streaming is not enabled: these APIs return validated structured JSON and
deterministic results. Partial JSON cannot be adopted safely by the current
contract. Existing loading, confirmation and save acknowledgement UI is retained.

## Measurements

These are synthetic fixtures and provider smoke tests, **not Vercel benchmarks**.

| Same fixture/path | Before | After |
| --- | ---: | ---: |
| Creation through assistant + creation planner: model calls | 2 | 1 |
| Same creation: owned repository reads | 2 | 1 |
| Hydrated analysis state with synthetic 32 KB chat | 33,561 bytes | 1,299 bytes |
| SQL save result with synthetic 32 KB chat | 32,294 bytes | 54 bytes |
| Production AI/CRUD p50/p95 | unavailable | unavailable |

The inherited 15→1 SQL batching benchmark is not an improvement from this patch.
Artificial sleeps or local suite durations do not establish production speedup.
Two full-schema creation probes against the configured real provider succeeded
with one model call each, about 2.4 and 2.3 seconds in a later full probe. Auth
and database were synthetic adapters. There is no comparable live before sample.
The full language probe initially had one category-follow-up routing failure;
after adding the structured-context guard, that two-turn sequence passed again.
This is evidence for those examples, not universal language coverage.
The final full provider probe returned 8/10 successes; the other two returned
upstream HTTP 503 after the existing candidate fallback (two provider attempts).
No new retries or model changes were added to hide those availability failures.

## Verification and production follow-up

Before: 78 focused tests passed. The expanded suite exercises creation reuse,
actual frontend branch handlers, financial parity, commit acknowledgement,
concurrent timing isolation, timeout/retry, funding, payments, forecasts and
ownership. The persistence test's relative database import was corrected to use
its existing stub, avoiding accidental production module initialization.
The PostgreSQL parity case is added but cannot run without
AUTH_TEST_DATABASE_URL pointing only to local finbridge_auth_test.
Final checks: 231/231 offline regression tests, TypeScript, scoped ESLint and
webpack production build passed. No PostgreSQL or production latency test ran.

Changed performance files:

- `src/lib/finance-tables.ts`, `src/lib/workspace-repository.ts`: analysis read
  projection and smaller SQL save response.
- `src/lib/ai-request-timing.ts`, `src/app/api/workspace/route.ts`: counters,
  database timings and total Server-Timing.
- `src/app/api/ai/assistant/route.ts`, `scenario-planner/route.ts`,
  `workspace-actions/route.ts`: analysis reads and creation extraction reuse.
- `src/lib/workspace-action-id.ts`: shared stable proposal IDs.
- `src/components/sites/rolly/replica/Transactions.tsx`: consume the validated
  proposal in the existing card.
- `scripts/verify-request-performance.mjs`, `verify-chat-performance.mjs`,
  `verify-assistant-route.mjs`, `verify-finn-language-live.mjs`,
  `verify-persistence-routes.mjs`, `verify-finance-read-postgres.mjs`, and
  `package.json`: regression coverage and reproducible checks. Run
  `npm run test:chat-performance` for the focused offline performance checks.

After review/integration, use the same verified test account and data on Vercel:
record 10–20 warm and fresh-instance samples for chat, contextual creations,
transaction confirmation, budget edit/delete and receipt confirmation. Capture
Network end-to-end duration plus X-FinBridge-Request-Id and Server-Timing, then
correlate auth/pool/database/model/write/safety stages and databaseCalls in logs.
Compare p50/p95 for the same requests, deployment/model and database region.
Use platform invocation initialization logs to assess cold starts; route timing
alone does not measure time before invocation. Investigate region/pool pressure
only with evidence. Check commits from a second device to verify conflicts.

No production speedup, actual database execution, Vercel deployment, real-user
mutation or bank/payment connectivity is claimed by this local patch.
