# FinBridge security

Security fixes apply to the latest main.

## Reporting

Use GitHub's private [Report a vulnerability](https://github.com/smolsosweet/finbridge/security/advisories/new) form if enabled. Otherwise ask the maintainer for a private contact channel without publishing credentials, personal data or exploit details. Include the affected commit, impact and a synthetic reproduction.

## Current boundaries

Better Auth and PostgreSQL store accounts and sessions. Email accounts require verification. Deletion requires recent authentication or the correct password; reset revokes sessions.

Financial workspaces currently use account-scoped browser storage, without complete cross-device synchronization. Provider keys stay server-side.

Forwarded-IP trust in auth rate limiting remains a deployment concern. See [acceptance findings](docs/auth/AUTH_FLOW_ACCEPTANCE_2026-10-14.md). Live providers, production proxy behavior, restore and multi-instance operation require separate checks.

Do not run disposable database tests on user/production data or publish environment files, mail outboxes or backups.
