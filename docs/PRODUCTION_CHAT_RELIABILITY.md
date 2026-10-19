# Production chat reliability

## Evidence and limits

The supplied production log lists `POST /api/workspace` as HTTP 200. It does not
include durations or the failed request's response body. This does **not** prove
a quota error, a payload rejection, or a failed database commit. The client has a
20-second save timeout; a server finishing after the browser aborts is one
possible explanation for a visible failure alongside HTTP 200. Live Vercel
runtime logs, account state and provider latency were not accessed directly.

The following problems were reproduced independently with synthetic fixtures:

1. An OCR file admitted by the 5 MB upload check can create a data URL longer
   than the workspace's 3,000,000-character image limit.
2. Duplicating a permitted image on both a transaction and its chat message can
   create a request over Vercel's documented 4.5 MB Function payload limit.
3. A definitive HTTP 400 left the rejected snapshot in the writer; retrying after
   a correction resent the invalid version instead of the corrected one.
4. Changing only a chat message executed 32 SQL write statements across finance
   tables. The differential writer now executes two statements for that fixture,
   both against chat messages. This is a query-count result, not a measured
   production latency improvement.
5. Before every AI request, the client waited for chat-history persistence even
   though that same history is included in the AI request.

Vercel reference: https://vercel.com/docs/functions/limitations

## Changes

- `workspace-payload.ts`: lossless gzip transport when supported, a bounded wire
  size, typed non-JSON/platform errors, validated acknowledgements, and removal
  of duplicate chat images only when the canonical transaction contains the
  identical image. No financial fields or original saved receipts are removed.
- `workspace-handler.ts` / workspace route: bounded gzip decoding (existing
  12 MB decoded cap), small opt-in save acknowledgements, opt-in compressed
  responses, request IDs and auth/handler/total timing. Logs contain no account
  IDs, amounts, credentials or request bodies. Existing origin, owner, session,
  revision, validation and idempotency checks remain enforced.
- `workspace-writer.ts`: definite rejection allows a corrected snapshot; unknown
  network/timeout/5xx outcomes retain the original mutation ID and payload.
  Analysis waits for financial writes, not unrelated chat-only saves.
- `finance-tables.ts` / repository: derive the same table rows as before, compare
  with the authoritative previous workspace, and upsert only changed tables in
  the existing order and transaction. Chat-only changes do not recalculate
  safety snapshots. This is an optimization of the existing store, not a new
  persistence system.
- `DatabaseWorkspace`, store and `SafetyProvider`: wire the existing writer into
  analysis flushing; retain the general saved event and refresh safety on a
  financial-save event, not on every conversational message. Periodic polling,
  safety mutations and actual financial changes still refresh safety.
- `receipt-image.ts`: preserve small originals unchanged. Prepare larger images
  within a bounded JPEG payload, keeping aspect ratio, using a 2560-pixel long
  edge first, then smaller fallbacks if necessary. An unsuccessful preparation
  retains the file for retry. Existing persisted images are not recompressed.
- `Transactions.tsx` / `pending-draft-policy.ts`: existing unfinished drafts block
  a new transaction before extraction, after model interpretation, on OCR entry,
  and in timeout fallback. Text remains available for resending; it is never
  automatically submitted after confirmation. Corrections and Q&A remain
  available. Existing restored batches can still be resolved individually.
- Confirmation uses the same stable transaction IDs. A definite rejection rolls
  back only that attempt's optimistic records; an unknown acknowledgement keeps
  the draft locked against editing/cancellation until its save is checked again.
  It never claims that a server-side commit was undone when its outcome is unknown.
- Draft monetary precision now matches the database guard, preventing a demo-only
  acceptance of fractional VND or other unsupported minor units. Invalid drafts
  cannot persist an orphan temporary category.

## Verification

`npm run test:production-chat` exercises synthetic failure/retry fixtures,
compressed request/response handling, origin/owner protections, decompression
bounds, acknowledgement validation, query counts, pending-draft gating, currency
precision and optimistic rollback. Image/browser primitives are scripted in unit
tests; this is not a live OCR accuracy or browser-layout test.

Verification results: the combined conversation, scenario, planning, payment,
workspace and production-chat suite passes **148/148 tests**. Localization has
**38 passes and two pre-existing TODOs**. TypeScript, targeted ESLint and
`git diff --check` pass; `npm run build -- --webpack` completes successfully.
The previously observed default Turbopack worker failure is not claimed resolved.
Real SQL integration tests require
`AUTH_TEST_DATABASE_URL` targeting the isolated local `finbridge_auth_test`;
that variable is absent in this environment, so no application/production database
was substituted. Production transport, deployment version, live database timings
and live Gemini/OCR accuracy still need verification after deployment.

No prompts, semantic category training/ranking, model selection, financial
formulas, saved categories, budgets, wallets or historical transactions were
replaced. Large aggregate workspaces still have finite transport limits; this
change is not an object-storage migration or an unlimited-attachment feature.
