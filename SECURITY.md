# FinBridge security

Security fixes apply to the latest main.

## Reporting

Use GitHub's private [Report a vulnerability](https://github.com/smolsosweet/finbridge/security/advisories/new) form if enabled. Otherwise ask the maintainer for a private contact channel without publishing credentials, personal data or exploit details. Include the affected commit, impact and a synthetic reproduction.

## Current boundaries

Better Auth and PostgreSQL store accounts and sessions. Email accounts require verification. New email passwords use Argon2id; legacy scrypt hashes remain valid and are upgraded when a password is reset. Password reset links expire after 30 minutes and invalidate every active session.

## Account closure

The product label is **Close account**. It is a soft deactivation, never a hard deletion:

- It requires a session created in the last five minutes and the request must come from the configured origin.
- The server derives the target account from the signed session, never from a client supplied user id.
- Existing sessions and reset links are invalidated; OAuth and credential identifiers are retired and provider tokens are cleared.
- The user, financial records and an encrypted identity snapshot remain for audit. The original email and Google identity are released so that person can create a new, separate account.
- The Better Auth hard-delete endpoint is disabled.

Run `npm run auth:migrate` against PostgreSQL before the application begins serving requests. This creates the lifecycle table used by account closure without resetting existing data.

Signed-in financial workspaces, safety rules, reference estimates and sandbox payment records use server-side PostgreSQL scoped to the authenticated account. Browser state is a temporary working copy. API database failures return an error; they never silently switch authenticated users to an in-memory repository. Provider keys stay server-side.

Local demo mode requires development, an explicit `FINBRIDGE_DEMO_MODE=true` flag and localhost requests. Its device storage and temporary server memory are not production persistence. In-memory reference quotes still require a real provider observation; unavailable upstream data never becomes an invented Frankfurter rate.

Contact messages and feature suggestions are persisted in `finbridge_feedback` only after an authenticated, verified account submits a same-origin request. Submissions use idempotency identifiers and a database-backed limit of five new messages per ten minutes per account. A receipt means stored, not emailed or read by a support agent. Operators can review these records using authorized database access; there is no support inbox UI or email forwarding service. Feedback remains with other records after account closure for audit. Do not include passwords, API keys or bank credentials in feedback.

International payment execution is a sandbox with separate test balances. Reference FX estimates are real provider observations, not bank quotes or payment authorization. Real settlement requires a payment partner and operational review.

Forwarded-IP trust in auth rate limiting remains a deployment concern. See [acceptance findings](docs/auth/AUTH_FLOW_ACCEPTANCE_2026-10-14.md). Live providers, production proxy behavior, restore and multi-instance operation require separate checks.

Do not run disposable database tests on user/production data or publish environment files, mail outboxes or backups.
