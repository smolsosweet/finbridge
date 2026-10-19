# Draft amount review

## Cause and integration

Transaction draft validation checked required fields, amount precision and currency/wallet compatibility, but did not compare an amount with category history or the tracked balance. The existing financial-chat anomaly query concerns saved transactions; it is not part of draft review.

`draftAmountWarnings()` derives review hints from the current draft and existing workspace state. `Transactions.tsx` renders `DraftAmountWarnings` immediately above the draft actions. This covers text, receipt, fallback and edited drafts without changing the extraction model, persistence schema, required-field validation or confirmation logic. No extra provider request is made.

## Evidence rules

- Compare positive, currency-precise amounts of the same transaction type, exact category and selected wallet in the preceding 90 days, including the cutoff day. Cutoff is the earlier of today and the draft date. Exclude future, invalid and duplicate-ID records, transfers and opposite-type refunds.
- Require at least five valid historical records. Flag an amount at least three times the median, or at most one fifth of the median. This is a review heuristic, not a market-price or fraud determination. A new, staged category has no established comparison history.
- Independently, an expense larger than the selected wallet's complete `trackedBalance()` as of today receives a balance warning. Use recorded income, expenses and same-currency transfers. Do not infer an incoming FX amount. A balance warning is distinct from a category anomaly and does not project future income or bills.
- Do not compare currencies or assume what breakfast should cost. Without enough history or a complete balance, absence of a warning is not proof of a normal transaction. Pending wallet selection must be resolved before wallet-specific evidence can be shown.
- Warnings do not alter the numeric amount, currency or any data. The existing explicit confirmation can still save an unusual but valid transaction exactly once. Editing automatically recomputes the hints; cancelling saves nothing.

## Verification

`npm run test:transaction-ai` includes draft warning regressions. Tests cover high/low/ordinary amounts, CNY parsing and persistence, insufficient history, wallet/category/type/currency isolation, date boundaries, invalid and duplicate records, refunds/transfers, unavailable FX balances, edits/cancellation/idempotent confirmation and localized server-rendered warning markup. SSR checks do not constitute browser layout or deployed Vercel verification.
