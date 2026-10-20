# Local release verification - 2026-10-19

Repository: D:/ai-website-cloner-codex. Branch: feature/ai-postgres-quota.
Base main: ac411b342867b5fbdc4854b7610b591b068ae016.
No push, merge or deployment is part of this local preparation.

| Gate | Result |
| --- | --- |
| Full business unit gate, including conversation/AI/receipt regressions | 370 passed |
| Full PostgreSQL gate, including quota/demo/conversation persistence | 107 passed |
| ESLint | 0 errors, 32 existing warnings |
| TypeScript | Passed |
| Production build | Passed |
| Browser checks on built app | Login, DB hydration, privacy, headers, media permissions, responsive login passed; final clean SHA smoke recorded below via local runner |
| Local application configuration + READ ONLY DB/schema check | Ready; no missing tables |
| Existing remote main CI | Success for ac411b3; run 39224786894 |

Detailed machine-generated results/logs are in ignored .local/release-verification.
The full runner is npm run verify:release. It refuses any database other than explicitly
named local finbridge_auth_test for tests. Resume a failed or newly affected step with
-- --from=SCRIPT_NAME; earlier accepted results are retained in its JSON report.
The extra browser suite is local: it uses the production build with NODE_ENV=test to
permit the synthetic localhost HTTP auth origin. It does not establish HTTPS, Google
OAuth or provider delivery on Vercel. All provider responses in unit/route tests are
synthetic; no live Gemini or Brevo calls were made by those suites.

The initial browser run correctly found the local test harness had used NODE_ENV=production
with an HTTP auth origin, so the login button was disabled by the production HTTPS guard.
The harness now uses test mode; the production guard was not weakened. The browser run
then passed. The upload timeout test also caught a cancellation/timeout race; that was
fixed before the full unit gate. These failed attempts are not counted as passes.

## Local application preparation

Only the additive quota migration was applied to 127.0.0.1:5434/finbridge_auth.
It did not reset existing accounts, financial data or counters. Six quota variables
and the selected audio model were added to ignored .env.local. Both text and audio
resolve to gemini-3.1-flash-lite locally. Existing credentials were preserved.

Two synthetic judge accounts were provisioned in that local application DB:
finbridge-demo-judge-1 and finbridge-demo-judge-2. Strong random passwords are in
ignored .local/judge-credentials-*.json; never commit or include them in public docs.
The default seed uses English, two wallets, three transactions, a budget, upcoming
rent and an in-app alert. Email reminders are off. Tests use separate disposable
accounts in finbridge_auth_test and clean those up.

## External evidence still required

- Preview Neon branch and production quota migration; Vercel variables/model values.
- Preview/production deployment SHA and alias check, provider timing for all seven routes.
- Actual new-mailbox signup, verification email receipt and login on Vercel.
- Scheduler secrets/variable activation, opt-in test and actual Brevo delivery.
- Production judge accounts and login from another network.
- Permission/license evidence for retained Rolly assets and interface provenance.

Vercel UI access reached Login; no authenticated Vercel/Neon session is available in
this tooling. No cloud settings or production records were changed. Gemini Free was
confirmed by the owner, and EN/VI/ZH privacy now discloses its processing terms and
retained data after closure. Missing rights evidence is recorded in PROVENANCE_REVIEW.md.

## Local commits

| Commit | Feature |
| --- | --- |
| a9f1f9b | Shared PostgreSQL quota for seven AI routes |
| 97835ac | Streaming body limits, output caps, browser headers |
| 650edf6 | Guarded judge account creation/reset/rotate/lock |
| 80b5942 | Explicitly enabled external email scheduler |
| 7d072ce | Gemini Free privacy, retention, third-party ownership wording |
| Commit containing this document | Release identity, readiness checks, full validation gates and operator checklist |
