# Budgets and fixed expenses

The Money Tools tab exposes two linked views: Budgets and Fixed expenses.
The FinBridge header and theme are shared with transaction history. Challenges,
loans and debts are removed from the active tools navigation; their saved
records are retained.

## Business meaning

- A budget is a spending limit for one wallet, an optional expense category
  and a recurring period anchored to its start date.
- A fixed expense belongs to exactly one budget. It inherits the budget's
  wallet and currency. Category-specific budgets constrain the expense category.
- The first planned payment date must not precede the budget start date.
- Fixed expenses can be one-off, weekly, monthly or yearly. Month-end and
  leap-day schedules clamp to a valid date while retaining the original anchor.
- Planning, editing and pausing fixed expenses do not create transactions,
  debit wallets or change balances.
- Actual spending comes from recorded expenses matching the budget's wallet,
  category and period. Transfers and income are excluded; recorded refunds
  reduce net expense.

## Amounts on a budget card

- **Actual spending**: recorded expense in the period.
- **Remaining limit**: budget limit minus actual spending.
- **Planned fixed expenses**: scheduled occurrences in that period, including
  occurrences earlier in the period. This is a plan total, not an unpaid total.
- **Limit not allocated to fixed expenses**: budget limit minus planned fixed
  expenses. This is an allocation measure, not current wallet liquidity.

Actual spending and planned fixed expenses are not added together. There is no
automatic matching between a plan and a recorded payment, no paid/unpaid claim,
and no execution of a payment. The existing chat workflow records actual
transactions. The budget card links to filtered history for those records.

## Existing data

Existing budget goals remain in the goals collection. Their saved value is not
used as a substitute for actual spending. Fixed expenses use a new optional
fixedExpenses collection in the same browser store. Existing saves without
that collection load as an empty collection.

Savings goals are retained and shown in a collapsed legacy-data section.
They are not automatically reinterpreted as expenses.

These are local browser planning records. This change does not integrate the
old FinBridge backend, banking connections or real payments.

## Verification

Run node scripts/verify-planning.cjs for isolated model and real-component
handler checks, and node scripts/verify-transaction-history.cjs for history
regression coverage. Run npm run check for lint, typecheck and build.
