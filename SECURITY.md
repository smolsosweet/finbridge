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

Financial workspaces currently use account-scoped browser storage, without complete cross-device synchronization. Provider keys stay server-side. Browser storage is not an appropriate long-term store for financial records in a public deployment; migrate it to server-side, authorized storage before treating FinBridge as a production financial service.

Forwarded-IP trust in auth rate limiting remains a deployment concern. See [acceptance findings](docs/auth/AUTH_FLOW_ACCEPTANCE_2026-10-14.md). Live providers, production proxy behavior, restore and multi-instance operation require separate checks.

Do not run disposable database tests on user/production data or publish environment files, mail outboxes or backups.
