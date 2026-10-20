# Main integration — 2026-10-19

Integrated the current Finn changes with origin/main `b401868` (quota/security
hardening and transaction-history edit/delete actions).

Conflict resolution preserves request timing, transfer tools, financial planning,
draft recovery and the current model configuration alongside main's verified
account checks, bounded JSON/uploads/outputs and PostgreSQL quota transport.
All model attempts, including candidate fallback, go through `createQuotaGemini`.
No anonymous local-demo provider bypass remains in the merged AI routes.
Direct greetings/FX reads use no provider tokens but still require verified auth.

Current default is `gemini-3.5-flash-lite`; the assistant also retains the local
candidate fallback to `gemini-3.5-flash`. Existing Vercel environment variables
override the default. A successful external greeting with 3.5 Flash does not
establish full structured-output, OCR or conversation coverage for either model.

Verification after merge:
- 235/235 focused offline regression tests passed: quota/ownership, inputs,
  conversation, planning, transfers, funding, persistence and fixed-expense cycles.
- TypeScript passed; scoped AI-route ESLint had no errors (one existing unused
  `outputSchema` warning in transaction-drafts).
- Deployment-readiness unit tests and transaction-history render check passed.
- Full release runner and browser hardening checks could not start because
  `AUTH_TEST_DATABASE_URL` for isolated `finbridge_auth_test` is not configured.
  No alternate database was used. No production latency/DB verification claimed.

Deployment prerequisites inherited from main: apply AI quota schema migration,
configure the required `AI_QUOTA_SERVER_*` values, and verify model environment
variables in Vercel. Missing quota configuration/schema deliberately blocks
provider calls. Git push does not change Vercel environment variables or migrate
the production database. Refer to AI_QUOTAS.md and RELEASE_CHECKLIST_VI.md.
