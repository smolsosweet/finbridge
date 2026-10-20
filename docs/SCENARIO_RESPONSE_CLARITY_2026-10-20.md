# Scenario response clarity — 2026-10-20

Branch: `codex/chatbot-local-test`, based on the pre-quota-integration snapshot.
This change does not enable anonymous production AI access or change main.

## Confirmed presentation defects

- One unforecastable category budget set `unavailableEstimates`, which suppressed
  the conclusion for an otherwise calculable wallet. Presentation now assesses
  balance, spending pace and requested reductions per wallet. Budget uncertainty
  is shown separately, with no unsupported over-budget forecast.
- Scenario figures used the UI language while the model's lead followed the
  user's question. A shared language resolver now chooses a clear dominant
  EN/VI/ZH question language, otherwise the UI setting. The API receives that
  preference, and a mismatched/undetectable optional model lead is omitted.

## Scope

No calculation or persistence functions were changed. Recorded balances, linked
bill payments, overdue occurrences, forecast pace, currency isolation, reserve
amounts, confirmation/funding checks and mutations retain their existing rules.
Answers start with the computed result, identify known purchases/bills, then
separate spendable cash from a reserve still included in the closing balance.
Insufficient wallet history, missing reduction history, invalid balances and
unrecorded bills are explained specifically. No model-generated totals are used.

## Regressions

Synthetic fixtures reproduce the supplied local and production figures:
- Local: 8,830,378 − 3,147,000 − 511,842 − 3,000,000 = 2,171,536 VND.
- Production-shaped: 9,592,756 − 3,000,000 − 223,984 − 3,000,000 = 3,368,772 VND.
  Reserve 3,000,000 stays in that balance; spendable cash is 368,772 VND.

The fixtures are not reads of production data. Tests cover reserve unset/zero,
paid/overdue/current/next-month bills, missing history, unrelated-wallet isolation,
daily assumptions, budget-only uncertainty, unknown balances, and mixed-language
questions/model leads. No application data was edited by these tests.

Language detection is conservative rather than universal: short or tied input
uses the UI language, and user-owned names are preserved. Predictions remain
estimates under the existing pace rules, not guarantees of future affordability
or proof of cash availability on every intermediate payment date.

Final checks: 128/128 offline regression tests passed; scoped ESLint, TypeScript
and `npm run build -- --webpack` passed. The initial typecheck found a stale
generated `.next/types` reference to main's release route after switching branches;
only that generated file was removed and route types regenerated. No source route
or database was deleted. No production deployment, authenticated database or full
live-model language coverage is claimed. Nothing was pushed.
