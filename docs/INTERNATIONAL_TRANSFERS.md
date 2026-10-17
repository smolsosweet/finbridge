# International education-payment sandbox

Open **International transfers** in the sidebar, or `/app?tab=transfers`.
This ports the guided education-payment workflow from the original Java
FinBridge project into the authenticated Next.js workspace. It does not run
the old public/shared Java service or send account data to it.

## User journey

1. Add a bill: fictional receiving school, title, amount the school must receive,
   due date and unique reference. The fictional school directory supplies the
   recipient, bank, routing code and receiving account.
2. Compare three example channels by total cost or expected arrival time.
   A lower Bank B reference rate is displayed but cannot be selected. Alipay
   is available only for the China example corridor.
3. Review the exact recipient and cost breakdown, test source balance,
   remaining balance, reserve and due-date risk. Tick the acknowledgement,
   then approve the draft.
4. Separately complete the **test** transfer. A receipt remains accessible
   from its bill and transfer history, including after signing out/reloading.

The interface supports EN/VI/ZH. Custom bill titles/references and fictional
institution names are preserved verbatim. Lists use search and pagination;
details open in a dialog. Controls and the activity log are collapsed initially.

## Explicit simulation boundary

- Supported example routes: Vietnam/VND to China/CNY, United States/USD and
  Australia/AUD. The schools and banks are fictional records.
- Rates/fees come from the original project's synthetic fixtures. Refreshing
  a quote changes its validity window, not its example rate. These are not
  live quotes, actual channel capabilities, settlement commitments or advice.
- Two account-owned test balances start once at 100,000,000 VND each. They
  persist in PostgreSQL; the reserve is 3,000,000 VND per test source account.
- Completed simulations debit only these test balances. Tracked wallets,
  budgets, expenses and bank-app handoff flows are unchanged. No live bank
  request, currency conversion, account verification or real transfer occurs.
- The old Java bounded AI tuition agent, delegated low-risk transfers and
  shared admin/demo reset tools are not connected to this module. Every
  education simulation requires the user's explicit approval.

## Calculations and lifecycle

The user specifies the destination amount. Decimal-string input is validated
to at most two fractional digits. BigInt rational arithmetic rounds each VND
component half-up to whole VND:

`total = converted amount + currency conversion fee + transfer fee`.

The receiving amount is not reduced by these displayed fees. For 20,000 CNY
on the Bank A fixture: 70,400,000 + 140,800 + 220,000 = 70,760,800 VND.

Quote validity is five minutes, approval validity two minutes, both enforced
by server time at the exact expiry boundary. Approval never extends a quote.
The browser countdown uses the server time offset and cannot authorize a
payment. Arrival uses calendar days plus a one-day safety buffer; weekends,
holidays and provider cutoffs are not modelled. Dates use UTC for deterministic
sandbox calculations and localized labels in the UI.

Editing or archiving a bill invalidates pending plans. Refreshing quotes
invalidates old quotes and pending approvals. Pausing blocks draft approval
and completion; resume requires fresh approval. Cancel only cancels a pending
plan; it does not cancel its bill or undo a receipt. Completed bills cannot be
edited, archived or completed a second time. Unsupported channels, stale or
overdue bills, expired quotes and insufficient reserve fail closed.

## Persistence and authorization

Run `npm run auth:migrate` before serving the new API. The additive migration
creates these account-owned tables without resetting existing data:

| Table | Purpose |
| --- | --- |
| `finbridge_transfer_controls` | Pause state, serialized mutation lock, rate window |
| `finbridge_transfer_accounts` | Opening and current test balances |
| `finbridge_transfer_bills` | Versioned education bills, archive flag |
| `finbridge_transfer_quotes` | Server-generated quote snapshots and validity |
| `finbridge_transfer_plans` | Immutable bill/quote evidence, approval and receipt |
| `finbridge_transfer_mutations` | Idempotency key, content hash and result reference |
| `finbridge_transfer_audit` | Transactional activity history |

All reads/writes are scoped by the server session. Each request also carries
the existing workspace-owner header to detect a stale tab after switching
accounts. POST requires the configured origin and JSON content type, uses a
bounded 8 KB body, strict schemas and parameterized SQL. Client-supplied
prices, bank accounts, statuses, receipt fields or owner IDs are rejected.
Unverified/closed accounts cannot access the repository.

The per-user control row serializes mutations. Test balance updates, plan
completion, receipt, audit and idempotency result commit in one transaction.
A partial unique index permits only one completed plan per bill. A repeated
completion returns the existing receipt. Reusing an idempotency key with a
different command fails. A lost response can be retried with the same key.
Thirty accepted mutations per minute are allowed per user. Rejected requests
are not a full distributed abuse limiter; infrastructure rate limiting is
still needed for an internet-facing deployment.

Business records are retained, including cancelled/invalidated drafts and
old quotes. Account closure revokes access while preserving records. The UI
loads 200 recent plans and always retrieves all completed bill receipts;
all records remain in the database. Up to 100 bills are supported per account.
Audit rows are an activity trail, not a cryptographically tamper-proof ledger.
Only the backend database role should access these tables in production;
TLS, backups and privilege restrictions follow the existing deployment setup.

## Verification

`npm run test:transfers` checks exact money arithmetic, route eligibility,
expiry, reserve boundaries, schema tampering, authorization and body size.

`npm run test:transfers:postgres` uses only local `finbridge_auth_test` and
disposable users. It verifies isolation, concurrent duplicate completion,
one debit/receipt, stale bills/quotes, pause/resume, closed accounts and replay.

`npm run test:transfers:ui` starts an isolated Next.js server and tests the real
browser approval flow, lost-response retry, DB reload, unchanged tracked
wallets, receipt, pause/resume and EN/VI/ZH at 390px. It never contacts AI,
email providers or banks. Screenshots are under ignored `.local/`.

Verified locally on 2026-10-17: TypeScript, production build, the nine transfer
unit tests, the PostgreSQL workflow (including two distinct concurrent bills),
and the browser workflow pass. Existing localization checks report 38 passes
and two pre-existing TODOs. ESLint passes for all new transfer files and the
updated app shell. Full-repository lint currently reports 20 errors in
unchanged authentication, Planning and transaction components; it is not a
passing project-wide gate. No production bank or transfer provider was tested.
