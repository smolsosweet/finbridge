# Finn intent/workflow audit — 2026-10-20

Branch: `codex/chatbot-local-test`. Main, model configuration, quota rules and
production deployment were not changed. Existing scenario-response edits remain.

## Causes found before editing

1. The read-tool vocabulary exposed `transactions` (list) and `top_category`
   (category aggregate), but no individual maximum operation.
2. Both client and API intercepted a generic transaction-deletion question with
   a fixed request for more details. The matching helper intentionally returned
   no matches without a filter; no separate read-only browsing step existed.
3. A category command was either complete or invalid. Missing names/type or merge
   sources/destination had no typed continuation state. The prompt even required
   `categoryOperation=null` when fields were missing. Category-list buttons only
   changed referenced names; they did not advance a workflow.

## Implementation

- `financial-chat.ts`, `ai-tools/query-finances.ts`, assistant schema and existing
  planner query validation: add `largest_transaction`, deterministic maximum,
  ties, actual date/category/type/wallet filtering and separate currency ranking.
  With no requested period, rank recorded history through today and label dates.
- `category-dialogue.ts`: typed missing-field inspection, actual eligible choices,
  name/type/source/destination collection and revalidation before each choice.
  Completion uses existing `prepareCategoryOperation`; confirmation/persistence
  still use the original fingerprint and workspace writer, not a new datastore.
- Assistant route: use the existing structured model response for semantic
  routing, preserve pending parameters and displayed option order, and return
  owned deletion candidate IDs. Exact existing shortcuts stay deterministic.
- Transactions UI: remove the generic-deletion dead end; show actual choices with
  nothing selected. Integrate category choice buttons, cancellation and existing
  impact/confirmation UI. Authenticated reads cannot fall back to local totals.
- `chat-local-plan.ts`/store: preserve typed category context including cancellation
  in existing chat storage. No financial totals are sent back as authoritative input.
- `transaction-deletion.ts`: separate read-only candidate selection from matching;
  unspecified requests browse at most 50 recent records, none preselected. Preserve
  latest/explicit-all scopes. Delete-all requires explicit user wording in addition
  to model classification; every deletion still requires the existing confirmation.

For authenticated sessions, source data comes from the account-owned repository.
Caller-supplied categories, IDs and pending commands do not grant access. Foreign
or stale choices fail validation; invalid wallet/category filters do not broaden
deletion candidates. The already-existing explicit localhost demo remains isolated
and uses its browser data, not production/account data. It is not production auth.

## Verification and latency

- 217/217 offline regressions passed across route orchestration, actual JSX choice
  handlers, tool inputs, context, ownership, cancellation, mutation guards, currency,
  funding, scenarios, persistence errors and transfer UI.
- Static checks: TypeScript and scoped ESLint passed.
- Final `npm run build -- --webpack` passed, including TypeScript and route generation.
- Manual `verify-finn-language-live.mjs`: actual configured Gemini and route,
  synthetic auth/repository only, no real account data or writes. Eight of eight
  paraphrases/follow-ups passed, including a misspelling, English superlative,
  category-name continuation, merge destination and cancellation. The phrases were
  not inserted as examples into the prompt or matched by new phrase regexes.
- Eight successful provider requests each used one model call; observed route
  times were 1.60–3.13 seconds. Category choice clicks use zero model calls; exact
  generic deletion and retained category shortcuts also use zero. No model change
  or extra orchestration round was introduced. Existing provider fallback remains.

No same-input live before/after latency baseline was captured, so no speedup is
claimed. Extra bounded parameter/option context can affect token latency. No Vercel,
real-account PostgreSQL or browser end-to-end claim; JSX handlers were exercised
directly. These eight probes demonstrate examples, not universal language coverage.

## Limits and integration

Broad deletion browsing initially shows 50 recent records; narrow by date/title
for older records. New language input still depends on provider availability and
model interpretation; ambiguous choices are shown rather than authorizing changes.
For ordinals beyond the 50 supplied category options, the model is instructed to
ask for a name/button instead of guessing. Existing user confirmation remains
essential to reviewing model-selected category references.

When moving these commits to main, follow the migrated `components/finbridge`
paths and retain main's verified-session, input limits and PostgreSQL quota wrapper.
Do not replace those guards with this branch's historical local demo routing.
