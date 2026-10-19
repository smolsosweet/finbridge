# Chat spending plan

## Root causes verified before changes

The initial three regression tests failed against the previous implementation:

- Two bills of 200,000 and 300,000 against 1,000,000 produced balances of
  800,000 and 700,000, rather than cumulative balances of 800,000 and 500,000.
- A 700,000 budget with 100,000 recorded spending and a 300,000 unpaid bill
  allowed 50,000/day over 12 days instead of 25,000/day.
- Duplicate transaction identities were subtracted twice without indicating
  that the source data was inconsistent.

The previous chat plan also dropped out of `modelHistory`, showed only the next
occurrence of each bill, and did not clearly distinguish forecast spending from
forecast wallet balance. Paid fixed expenses could be extrapolated as if they
were flexible daily spending.

## Implementation

`financial-outlook.ts` contains the read-only `calculateSpendingPlan` calculation,
alongside the existing balance and budget helpers. It reads the current account's
existing `AppState`; there is no second financial store or database migration.
It reuses `budgetSummary`, `validFixedExpense`, and `unpaidOccurrences`.

For each active wallet separately:

- Current balance uses opening balance and unique recorded transactions through
  the supplied local calendar date. Same-currency transfers affect the correct
  source and destination. Missing cross-currency destination amounts prevent a
  trusted destination balance; no FX rate is invented.
- Bills include every unpaid occurrence through month-end, including arrears.
  Only an explicit confirmed transaction link marks an occurrence paid; a similar
  amount/date is not proof. Payment by a different wallet in the same currency
  clears the occurrence and charges only the actual paying wallet.
- Bill-only balances deduct cumulatively in deterministic date/ID order.
  These are explicitly distinguished from a forecast including flexible spending.
- Available cash = current balance - unpaid bills - protected reserve.
  Cash and budget daily ceilings use the remaining days **starting tomorrow** and
  round down to the wallet currency's minor unit. Overlapping budgets stay
  independent; they do not create additional money or a combined budget limit.
- Flexible spending uses month-to-date expense evidence after at least three
  elapsed days, excluding explicitly linked fixed payments (not entire categories).
  Otherwise, the previous three completed months can be used when at least two
  contain relevant expenses. This is an estimate, not a guarantee of complete
  transaction history.
- Month-end balance = current balance - unpaid bills - forecast flexible spending.
  Reserve stays in the wallet; subtracting it again is only for the separately
  labeled amount available outside the reserve.
- No reserve configuration means reserve-dependent capacity is **unknown**, not
  an invented reserve of zero. Missing pace/category evidence and inconsistent
  dates, duplicate IDs/links, invalid schedules, or unsafe totals disable affected
  trusted results. Persisted data is never silently repaired.
- Calculations use currency-specific minor units. Forecast base totals are
  rounded after aggregation, preventing a one-unit discrepancy per category.

`ChatSpendingPlan` renders the existing chat message in four sections:
overview, unpaid payments, month-end forecast, and next steps. Calculation inputs,
date ranges, reserve assumptions, and formulas are expandable. Every wallet keeps
its currency. EN/VI/ZH labels and compact responsive styles are included.

Only plan assumptions are attached to existing conversation metadata. The AI
assistant route accepts validated assumptions and returns a validated adjustment
for a spending percentage or reserve amount. The client resolves wallet/category
references against the current workspace and recalculates deterministically.
Multiple wallets require an explicit target. Changes never update transactions,
wallet balances, or the saved reserve setting. The existing clear-chat flow clears
the conversation and these assumptions.

## Verification

Run `npm run test:chat-plan` for calculation and actual-component rendering tests.
`scripts/verify-assistant-route.mjs` additionally exercises the real API handler
with a scripted model, including follow-up parameters, invalid assumptions,
origin/session/account guards, and provider failures. These tests use synthetic
in-memory data, never the application database or actual account records.

Provider output is mocked: passing tests do not establish that live Gemini
understands every paraphrase or is currently available. Static rendering verifies
structure and callbacks, not browser layout. Forecasts assume no new unrecorded
income and that unpaid obligations will be settled by month-end; the app does not
know whether an unlinked transaction paid a bill. More complex hypothetical
income/expense requests still use the existing scenario planner.

Verification in this workspace: the combined regression/route suite passes;
EN/VI/ZH localization has 38 passing tests and two pre-existing TODOs; TypeScript
and targeted ESLint pass. `npm run build -- --webpack` completes. The default
Turbopack build repeatedly aborts while spawning its PostCSS worker (child exits
before connecting, code 0), both inside and outside the execution sandbox. This
remains unresolved; the successful Webpack build is not a claim that Turbopack
or a production deployment has been verified.

## Files changed for this task

| File | Change |
| --- | --- |
| `src/lib/financial-outlook.ts` | Shared balance guards, cumulative bill balances, budget pace and read-only month-end plan |
| `src/lib/chat-local-plan.ts` | Grounded text compatibility and assumption-only follow-up history |
| `src/lib/transaction-drafts.ts` | Currency minor-unit formatting, including three-decimal currencies |
| `src/app/api/ai/assistant/route.ts` | Validated plan parameters and structured AI adjustment output |
| `src/components/sites/rolly/replica/store.ts` | Optional plan parameters on existing chat messages |
| `src/components/sites/rolly/replica/Transactions.tsx` | Plan button, plan rendering, contextual recalculation and wallet scoping |
| `src/components/sites/rolly/replica/ChatSpendingPlan.tsx` | Four-section localized plan presentation |
| `src/components/sites/rolly/replica/ChatSpendingPlan.module.css` | Scoped responsive styling |
| `scripts/verify-chat-spending-plan.mjs` | Calculation, context, isolation and persistence regression tests |
| `scripts/verify-chat-spending-plan-ui.mjs` | Actual component render and wallet-scoping tests |
| `scripts/verify-assistant-route.mjs` | Plan follow-up and invalid-input tests with scripted provider |
| `package.json` | Repeatable `test:chat-plan` command |
| `docs/CHAT_SPENDING_PLAN.md` | Root causes, formulas, verification and limits |

Other pre-existing working-tree changes were preserved.
