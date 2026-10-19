# Finn conversational responses

## Verified causes

- `/api/ai/assistant` interpreted an intent, then transaction chat called
  `/api/ai/scenario-planner` for a second provider interpretation. A normal
  forecast could pay two provider latencies and encounter two opportunities for
  a timeout or busy response.
- The general-chat branch displayed free text directly. A completed synchronous
  response could claim it was still calculating despite no background job.
- `financial-chat.ts` wrapped most query results with the same report headings.
- The deterministic prior-scenario parser expected a history marker different
  from the marker actually emitted by transaction chat. It now accepts both and
  preserves the scenario wallet scope.
- `calculateScenario()` enumerated unpaid bills starting tomorrow, omitting
  overdue/today obligations. It excluded entire fixed-expense categories from
  spending pace, even when transactions were unrelated to confirmed bill payments.
- Scenario balances included future transactions and assumed a cross-currency
  transfer's source amount was also its destination amount. Current-balance
  explanatory totals also included future transactions while the main balance did not.

## Implementation

- Keep the configured model, provider timeout and single-attempt retry policy.
  A validated `scenarioPlan` shares the intent response's existing provider call.
  Its parameters contain assumptions/actions, never calculated balances.
- Server calculations use the authenticated account's existing workspace snapshot.
  No parallel store or browser storage assumptions. The local demo uses its existing
  client-side deterministic engine. Legacy scenario responses retain their endpoint fallback.
- Validate currency/wallet ownership, currency precision, dates, missing amounts
  and reductions before normalizing a scenario. Unresolved parameters produce a
  clarification, not a guessed financial result.
- Preserve only assumptions/entity metadata in conversation history. A new baseline
  has no hypothetical purchase; changes are retained only when the interpreted
  request references that scenario. Recalculate from current records.
- Use the existing tracked-balance function and as-of ledger. Include all unpaid
  occurrences through the scenario horizon, including overdue ones; exclude only
  user-confirmed linked bill payments from flexible-spending pace.
- Keep current-balance inputs separate from future bills, flexible forecasts and
  hypothetical changes. Maintain independent wallet currencies and report uncertain
  balances/history rather than claiming affordability.
- Select compact/conversational or detailed layout from validated presentation
  hints. Numerical prose is rendered from deterministic results. Scenario answers
  show the conclusion, figures, period and optional baseline comparison; calculation
  details expand on demand. No unverified free-form financial narrative is trusted.
- All analysis remains read-only. Transaction, category and workspace creation
  confirmations retain their existing guards.

## Verification and limits

- Final targeted run after conversational wording refinement: 222 tests passed, zero failures. TypeScript typecheck and
  ESLint for changed application sources passed; `git diff --check` passed.
- Regression coverage includes the real route with a scripted provider, financial
  calculations, follow-ups, overdue and paid occurrences, scoped currencies,
  missing history, errors, UI rendering and non-mutation.
- `verify-assistant-live.mjs` is opt-in. It calls the actual configured provider
  through the real route, with an isolated synthetic workspace and no database.
  It does not log API keys, prompts, account data or provider response bodies.
- Live testing confirmed that upstream HTTP 503 busy responses can still occur;
  no confirmed quota error was observed in this run. Three sequential synthetic
  purchase/baseline/short-follow-up requests later passed with one provider call
  each, approximately 1.8–3.1 seconds. This is not a production latency guarantee.
- No production deployment, database integration or exhaustive language coverage
  is established by these tests. Existing complex-scenario limitations remain;
  insufficient data and unsupported parameters must still be surfaced honestly.

## Conversational wording refinement

- The same interpretation call can supply a neutral contextual lead with one
  `{{answer}}` slot. Runtime guards reject literal amounts, dates, affordability
  claims, action claims and waiting promises; verified software inserts the
  financial conclusion. The provider does not write unchecked financial facts.
- Lead with the actual projected amount, wallet and readable date. Explain
  current money, unpaid bills, living expenses and the proposed purchase in
  separate lines. Name affected budgets and their calculated shortfalls.
- Calculation output now carries a component breakdown from the engine. The
  expanded explanation separates bills, hypothetical income/expense, daily
  limits and adjusted categories, rather than hiding them as a net adjustment.
  No financial formula or recorded data changes for this presentation refinement.
- Money/date formatting is shared between the short answer and its calculation
  details. New tests verify equation reconciliation and safe varied lead wording.
- Latest opt-in live run: all three synthetic requests passed, one provider call
  each, approximately 1.9–2.6 seconds. Historical saved replies are not rewritten;
  the new wording applies to new requests.

## Changed files

- `src/app/api/ai/assistant/route.ts`: one-call interpretation and server calculations.
- `src/lib/assistant-response.ts`: strict interpretation/presentation validation.
- `src/lib/scenario-planner.ts`: as-of balances, scope, history, bills and pace.
- `src/lib/scenario-answer.ts`: verified conclusions, figures and comparisons.
- `src/lib/scenario-format.ts`, `src/lib/scenario-explanation.ts`: consistent
  money/date formatting and explicit calculation components.
- `src/lib/financial-chat.ts`: adaptable headings and consistent balance inputs.
- `src/components/sites/rolly/replica/Transactions.tsx`: consume embedded scenario results.
- `src/components/sites/rolly/replica/FinancialChatAnswer.tsx`: expandable calculations.
- `scripts/verify-assistant-responses.mjs`, `scripts/verify-assistant-route.mjs`,
  `scripts/verify-scenario-planner.mjs`: regression tests.
- `scripts/verify-assistant-live.mjs`: opt-in live provider checks.
- `package.json`: include the new unit regressions in `test:conversation`.
- This audit document.

## Planning deletion and everyday financial language

- Added separate `delete_budget` and `delete_fixed_expense` interpretations.
  Explicit planning objects cannot fall through to transaction deletion, even
  if the provider returns the wrong transaction intent. Candidate references
  come from the authenticated workspace; a local demo uses its existing state.
- Budget query results now carry real entity IDs in conversation metadata, so
  “this budget” can refer to the previously displayed budget. Financial-context
  metadata retains its existing date, wallet and bill-reference format.
- Missing/ambiguous targets show actual selectable records. Named targets show
  just the matching review items. Unknown or foreign IDs never select a different
  record automatically. An unnamed request is never upgraded to delete-all.
- `PlanningDeletionCard.tsx` provides checkbox selection, explicit confirmation,
  cancellation, saving/error states and retry. Its metadata uses the existing
  account-owned conversation and workspace persistence, not a parallel store.
- `planning-deletion.ts` is shared with Planning CRUD. Budget deletion detaches
  linked schedules and preserves their original wallet. Schedule deletion keeps
  recorded payments. Neither operation changes transaction history or balances.
- Confirmation rechecks record signatures. Changed records require a fresh
  review. A persisted/applied flag and the existing idempotent workspace writer
  prevent repeating a deletion when a save is retried after a network failure.
- Anomaly replies distinguish insufficient history from an evaluated negative
  finding. Ordinary answers no longer expose sample-count, lookback or threshold
  parameters. Findings explain the actual amount versus typical prior spending
  in plain language without claiming fraud.
- Budget summaries list named budgets separately, avoid summing overlapping
  limits, and subtract only unpaid commitments rather than deducting paid bills
  again. The summary now distinguishes a remaining budget limit from wallet cash.
- Verification: 241 targeted tests passed, including confirmation/cancellation,
  foreign and stale targets, retry after timeout, persistence metadata, actual
  card rendering, anomaly evidence and paid-bill budget calculations. Typecheck
  and ESLint for changed chat/business sources passed. Planning has an existing
  unused-variable lint warning in its fixed-expense rendering.
- Live synthetic-provider checks passed for budget listing, “delete this budget”,
  unnamed fixed-expense selection, named bill deletion, and the anomaly question.
  Each used one provider call (approximately 1.8–2.1 seconds). No actual account
  records were deleted. A production/database confirmation or browser-click end
  to end test was not performed; no production deployment was made.

Additional files: `src/lib/planning-deletion.ts`,
`src/lib/conversation-intent.ts`, `src/lib/chat-local-plan.ts`,
`src/lib/fixed-expense-payments.ts` (narrower read-only input type),
`src/components/sites/rolly/replica/PlanningDeletionCard.tsx`, `Planning.tsx`,
`Transactions.tsx`, `store.ts`, and `scripts/verify-planning-deletion.mjs`.
