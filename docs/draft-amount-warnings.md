# Draft amount review

## Cause and integration

Transaction draft validation checked required fields, amount precision and currency/wallet compatibility, but did not compare an amount with category history or the tracked balance. The existing financial-chat anomaly query concerns saved transactions; it is not part of draft review.

`draftAmountWarnings()` derives review hints from the current draft and existing workspace state. `Transactions.tsx` renders `DraftAmountWarnings` immediately above the draft actions. This covers text, receipt, fallback and edited drafts without changing the extraction model, persistence schema, required-field validation or confirmation logic. No extra provider request is made.

## Evidence rules

- Compare positive, currency-precise amounts of the same transaction type, exact category and selected wallet in the preceding 90 days, including the cutoff day. Cutoff is the earlier of today and the draft date. Exclude future, invalid and duplicate-ID records, transfers and opposite-type refunds.
- Require at least five valid historical records. Flag an amount at least three times the median, or at most one fifth of the median. This is a review heuristic, not a market-price or fraud determination. A new, staged category has no established comparison history.
- Independently, an expense larger than the selected wallet's available funds as of today receives a funding warning and is blocked by the funding guard described below. Use recorded income, expenses and same-currency transfers. Do not infer an incoming FX amount. A balance warning is distinct from a category anomaly and does not project future income or bills.
- Do not compare currencies or assume what breakfast should cost. Without enough history or a complete balance, absence of a warning is not proof of a normal transaction. Pending wallet selection must be resolved before wallet-specific evidence can be shown.
- Warnings do not alter the numeric amount, currency or any data. The existing explicit confirmation can still save a category outlier with sufficient verified funds exactly once. Editing automatically recomputes the hints; cancelling saves nothing.

## Insufficient-funds policy (updated at the user's request)

`transaction-funding.ts` now separates a category review hint from a blocking funds check. All wallet types use the existing as-of tracked balance. A credit limit is not recorded money and is never added to this balance or used to enable confirmation. The saved wallet type and limit are unchanged. Incomplete balances block confirmation rather than assuming zero or an exchange rate. The workspace timezone determines the date; future income is excluded.

The draft card disables confirmation and gives the available amount and exact shortfall. The confirmation handler checks the latest store snapshot; `validateAndCommitDrafts` checks cumulative expenses for the entire batch before staging categories or transactions. Pending income does not fund another draft. Correcting the amount/wallet recomputes eligibility; a saved ID is not charged twice.

At the authenticated persistence boundary, `workspaceRepository.save` runs `validateNewExpenseFunding` after revision, planning and fixed-payment checks, within the locked transaction. New expenses in an established workspace cannot overdraw available funds, even if the UI is bypassed. Unchanged existing deficits, edits to historical transactions, and the separate initial historical-import/bootstrap flow are not rewritten or retroactively rejected. This is not a global ban on all historically negative data. New overdrawn expense saves return HTTP 422 `INSUFFICIENT_FUNDS`; unverifiable funds return `BALANCE_UNAVAILABLE`. Both preserve the draft and use the existing definite-rejection rollback, with no automatic write retry.

`scripts/verify-transaction-funding.mjs` covers insufficient/exact funds, batch overspend, category rollback, editing, actual versus pending/future income, credit limits, currency/transfer isolation, legacy/import behavior, duplicate confirmation and timezone boundaries. Real PostgreSQL tests still require the named isolated test database; unit checks do not establish production persistence success.

## Verification

`npm run test:transaction-ai` includes draft warning regressions. Tests cover high/low/ordinary amounts, CNY parsing and persistence, insufficient history, wallet/category/type/currency isolation, date boundaries, invalid and duplicate records, refunds/transfers, unavailable FX balances, edits/cancellation/idempotent confirmation and localized server-rendered warning markup. SSR checks do not constitute browser layout or deployed Vercel verification.
