# Finn and International Transfers

## Audit and scope

The transfer tab already had authenticated reference-rate and sandbox repositories,
validated mutation handlers, account lifecycle checks and idempotency keys. The
assistant's intent schema, dispatcher and chat message renderer had no transfer
integration. Finn therefore could not use these existing functions through chat.

The integration reuses those repositories and endpoints; it adds no financial
tables, alternate account storage, payment integration, model or dependency.
Reference observations remain separate from fictional provider quotes and sandbox
funds. Tracked wallet balances and transactions are never changed by transfer chat.

## Supported operations

- Reference rates, source/date, conversion and saved estimate history.
- CNY, USD, AUD and VND; inverse/cross estimates require usable observations;
  cross estimates require the same observation date. Decimal arithmetic rounds
  only at the final result. Saved estimates retain the existing foreign-to-VND limit.
- Existing sandbox recipient directory, bills, balances, receipts and audit log.
- Create/edit/archive/restore bills, compare provider quotes, select an option,
  approve, complete or cancel a sandbox plan, pause/resume the sandbox.
- Missing details are collected through conversation and interactive choices.
  Reads/proposals never write. Writes use existing endpoints after confirmation;
  approval and completion each require the explicit sandbox acknowledgement.

## Reliability and permissions

Complex natural language uses the existing assistant model once for structured routing.
Explicit current-rate/conversion reads also have a conservative direct route;
missing currencies are clarified using the existing choices. Writes, mixed tasks,
historical/future rates and ambiguous input retain model orchestration.
Interactive choices call a read/proposal endpoint with no model call. The server
derives the owner from the session, checks origin/account headers and reads actual
records. Financial results are not accepted from the model. Conversation context
retains request parameters and entity references; it never authorizes a write.

Confirmation locks concurrent clicks, keeps the same mutation ID on manual retry,
verifies the canonical response, and rejects account changes. Unknown outcomes
retain their recovery key even after a later authentication failure; cancellation
and conversation reset are blocked while the outcome is unresolved. Completed
actions cannot be confirmed again from the card. Existing backend validation is
still authoritative for expiry, version changes, reserves and sandbox availability.

`FINBRIDGE_ENABLE_TRANSFER_SANDBOX` is unchanged. A disabled production sandbox
cannot quote/draft/approve/execute through Finn. No real payment is available.
The explicit localhost demo remains volatile; authenticated repository failures
never fall back to demo data.

## Verification and limitations

`npm run test:chat-transfers` exercises the real calculation/proposal helpers,
existing mutation handlers and isolated in-memory repositories, actual chat
confirmation handlers, card rendering in EN/VI/ZH and endpoint permission guards.
Assistant-route tests use scripted model output to verify routing and call count.

These tests do not establish live-model language coverage, real Frankfurter
availability, authenticated PostgreSQL integration, visual browser behavior or
Vercel deployment success. Those require separate environment verification.

## Live failure diagnosis, 2026-10-19

- The configured `gemini-3.1-flash-lite` metadata request succeeded and listed
  `generateContent`. A minimal synthetic generation returned HTTP 503 after
  1,043 ms, explicitly reporting high demand. This probe did not return 429.
- The existing Frankfurter CNY/VND, USD/VND and AUD/VND endpoints each returned
  HTTP 200, dated 2026-10-19. Public rates were available independently of the LLM.
- Previously all typed FX queries waited for model orchestration first. The new
  narrow read route avoids that unnecessary dependency and financial-workspace
  hydration; origin, session/account checks and repository lifecycle guards remain.
- An isolated localhost demo harness ran the actual assistant route against live
  public rates, with no API key or model calls: the reported CNY/VND question took
  247 ms; the 10,000,000 VND-to-CNY follow-up took 17 ms with warmed rate storage.
  These are harness measurements, not authenticated PostgreSQL or Vercel latency.
- `scripts/verify-transfer-read-live.mjs` is an explicitly manual public-data
  probe, excluded from offline regression scripts. It uses no real user account.
- Complex AI requests can still receive upstream 503 until provider availability
  recovers. No model replacement, timeout increase or automatic write retry was added.
