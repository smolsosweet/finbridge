# Conversation and interface localization

## Cause

The selected language already changed many dictionaries, but saved conversation text was rendered verbatim. Several chat, tool, category, settings and auxiliary-page labels were Vietnamese literals. Some assistant routing also preferred the language detected in a new message over an explicit UI selection.

## Changes

- `src/lib/app-ui-copy.ts` and `useAppUiText.ts`: synchronous EN/VI/ZH display copy. Stored values, IDs, select values and user-defined names are unchanged.
- `Transactions.tsx`: current UI language is sent explicitly; labels, built-in category labels, wallet aliases and conversation display follow that selection.
- `assistant/route.ts`: an explicit language wins over detection, including deterministic financial-answer formatting. This creates only a display copy of settings, never a saved settings change.
- `useConversationLanguage.ts`: original conversation text and calculation details remain saved and supplied to tools. Translations are display-only, cached in component memory for the current account/language, with cancellation and an explicit retry after errors. Long messages are split into bounded batches. Standard UI/status copy uses dictionaries, not model calls.
- `translate-conversation/route.ts`: origin, session, account-owner and strict payload checks; a single model call per bounded translation batch; no financial tools, database writes or automatic retries. Numeric values, dates, currency codes, URLs and supplied names use placeholders. Missing, duplicated or changed placeholders, and extra numeric/currency facts, reject the response. Logs contain timing only.
- The document language updates for accessibility. Original messages remain available in an expandable disclosure.

## Verification

- Strict localization suite: 40 passed, no TODOs/skips in this run.
- Combined conversation, translation, assistant, scenario, transaction and spending-plan regression suite: 194 passed.
- TypeScript passed; scoped ESLint had no errors (10 pre-existing warnings in other modified components).
- Production webpack build passed.
- Live local browser: switched English → Chinese → English. Historical text translated, action/plan cards switched language, existing draft and transaction amounts remained present. No transaction was confirmed or deleted during testing.

## Limits

Static interface text switches immediately. Historical free-text translation depends on the configured AI service and may take time; on failure the original stays visible with a localized retry message. User-created names and descriptions remain source data, not renamed records. Translations are not used to authorize actions, recalculate finances or replace conversation context. Vercel deployment was not performed or tested.
