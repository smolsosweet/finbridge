# Chat availability audit — 2026-10-19

## Confirmed cause

The configured `gemini-3.1-flash-lite` advertises `generateContent`, but a
minimal real greeting request returned HTTP 503/high demand in 1,953 ms.
FX succeeds because its conservative read path uses the existing transfer
service directly. This is evidence of upstream generation unavailability,
not proof of depleted tokens or a database failure. Production logs were not
available, so the exact production failure remains unverified.

## Changes

- `assistant-resilience.ts`: whole-message greeting/identity responses without
  a model call; conservative transaction draft recovery on transient provider
  errors using existing amount, currency, category and draft validation helpers.
- `api/ai/assistant/route.ts`: integrates those paths after origin/session/owner
  validation. Draft recovery uses the authorized workspace, not client-supplied
  categories or wallets in authenticated mode. Explicit local demo remains isolated.
- `ChatTransferCard.tsx`: removes duplicate reference badge when it matches title.
- Offline tests cover reported phrases, VND/USD/CNY, multiple/missing wallets,
  categories, pending drafts, stable IDs, auth/quota failures, and no mutation.

Normal financial interpretation still uses the configured model. No model,
timeout, retry count, funding rules, API key, confirmation or save behavior changed.
Recovery creates only a reviewable draft; it never commits financial data.
Ambiguous questions, scenarios, edits, transfers and missing contextual answers
remain with the normal model path. This is outage resilience, not general NLP
coverage. No fallback on provider authentication failures or quota/rate limits.

## Verification

- 206/206 offline regression tests passed, including transaction funding,
  conversation, planning, fixed-expense lifecycle and transfers.
- Scoped ESLint and `npm run typecheck` passed.
- Manual `verify-assistant-resilience-live.mjs`: actual assistant route and real
  SDK, with synthetic authenticated workspace/auth/database adapters only.
  Greeting: 200, 17 ms, zero model calls. Breakfast: upstream 503 at 1,347 ms,
  recovered 200 draft at 1,381 ms, one model call, 10,000 VND with owned Food
  category and wallet. Synthetic workspace unchanged after both requests.
- No authenticated PostgreSQL, browser interaction or Vercel latency claim.
  Live probes are manual and excluded from offline regression commands.

Complex requests can still fail during the upstream outage. Verify deployed
commit/environment and sanitized request timing/error status in Vercel before
attributing production behavior. No push or deployment performed by this change.
