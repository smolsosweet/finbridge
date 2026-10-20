# Judge accounts and repeatable synthetic data

The provisioner creates only two reserved identities: finbridge-demo-judge-1 / -2,
with demo_no_data@demo.finbridge.invalid / demo_with_data@demo.finbridge.invalid. These are
deliberately non-deliverable addresses for administrator-provisioned demo login;
they cannot test signup, email verification or password-reset delivery. Verification
is explicitly granted by this private provisioning operation, never by a public route.

Use normal signup with a new mailbox separately to test Brevo delivery.

| Slot | Display name | Seed |
| --- | --- | --- |
| 1 | demo_no_data | Verified account only; no workspace, onboarding, financial rows or alerts. First login opens the normal setup wizard. |
| 2 | demo_with_data | Five wallets in VND/USD/CNY, thirteen categories, daily activity from the first day of the previous calendar month through today in Asia/Ho_Chi_Minh, four budgets, four fixed bills with recorded payments, six thresholds and historical in-app alerts. |

All seeded records are synthetic. Email consent is off for every threshold because
the demo addresses cannot receive mail. Chat histories and AI drafts start empty;
no Gemini requests, fake bank confirmations or real transfers are generated.
The original judge-1/judge-2 identities are not automatically adopted or renamed.
An existing ID/email collision is rejected for administrator review.

## Prepare

Complete the app schema migration against the intended target first. The tool only
adds its small registration table, not the rest of the application schema.
Set DEMO_DATABASE_URL in your private environment. It never falls back to DATABASE_URL.
Use `.env.local` (Git-ignored) for the private URL; do not paste it into reports.
Inspect the schema and reserved identities with read-only queries first:

    npm run demo:inspect

For a read-only plan:

    npm run demo:accounts -- --action=create --slot=1

The plan prints the sanitized host/database and reserved owner ID. Apply only with
both exact confirmations (replace HOST:PORT/DATABASE with the displayed target):

    npm run demo:accounts -- --action=create --slot=1 --apply --confirm-target=HOST:PORT/DATABASE --confirm-user=finbridge-demo-judge-1

Repeat with slot=2 and confirm-user=finbridge-demo-judge-2. Do this on an isolated
Neon Preview branch before the application database. Nothing is provisioned merely
by deploying the web app. No production accounts were created by local tests.

A generated strong password is written to a unique ignored .local/judge-credentials-*.json
before the DB transaction. The password is never printed or committed. Keep the
file private; a file can remain after a failed operation, so check applied:true.
Deliver credentials only through the competition's designated private channel.

## Reset, rotate and lock

Use the same command and confirmations with --action=reset, rotate or lock.
Reset only accepts a registered reserved owner with the expected synthetic email.
An existing real account can never be adopted or marked verified by the tool.
Creation/reset is one DB transaction, including normalized finance tables and onboarding.

Reset restores the slot's own profile: slot 1 returns to an unconfigured empty
account; slot 2 rebuilds its history for the current two calendar months. It clears only that demo owner's
sandbox transfer plans/history/accounts, allowing a fresh one-time sandbox opening
balance on next use if sandbox is enabled. It also expires that owner's sessions,
so sign in again and reload. Close other tabs before resetting.

AI quotas, global limits, other users and real payment integrations are never reset.
Email alert consent starts off. Concurrent judges sharing an account also share data
and quota. Prefer one account per reviewer and reset only between review sessions.

Rotate issues a new password and expires sessions. Lock removes the credential password
and expires sessions after judging; it preserves financial data. Reserved demo accounts
do not have Google credentials or a deliverable password-reset mailbox.

npm run test:demo:postgres proves creation/login, reset isolation, sandbox reset,
quota preservation, anti-adoption guards, password rotation/lock and repeatable quota
migration on the guarded local finbridge_auth_test DB only.

## Production login verification

After both creates report `applied:true`, pass their two private credential paths:

    npm run demo:verify -- --credentials=.local/judge-credentials-FIRST-1.json --credentials=.local/judge-credentials-SECOND-2.json

The default target is https://finbridge-orcin-phi.vercel.app. An explicit
FINBRIDGE_BASE_URL may select another canonical HTTPS origin. This command really
signs in with email/password, checks each session's owner/verification, reads its
workspace/onboarding/alerts, checks the other owner's header is rejected, then
signs out. It prints counts and account names only, never passwords, tokens,
cookies, full records or connection strings. It does not call Gemini or send mail.
This API check leaves the empty account unconfigured; opening its app in a browser
can create the standard starter workspace as part of the normal setup flow.

## Verification recorded on 2026-10-20

The new production Neon target was inspected read-only before provisioning: all
required tables existed and neither reserved demo identity was present. Both
guarded create operations then committed successfully.

Real email/password login against the production Vercel origin passed for both
accounts. Verified sessions matched their owners, a foreign workspace-owner header
was rejected with HTTP 409, and both verification sessions were signed out.

| Profile | Wallets | Transactions | Categories | Budgets | Fixed bills | Thresholds | Alerts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| demo_no_data | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| demo_with_data | 5 | 152 | 13 | 4 | 4 | 6 | 8 |

The populated history covers 2026-09-01 through 2026-10-20. Threshold email
consent is off; alerts are in-app only. These checks did not exercise the browser
UI, Gemini or email delivery. Seven guarded local PostgreSQL demo tests,
TypeScript typecheck and targeted lint passed. Private credential files remain
under the ignored `.local/` directory and are not part of this report or Git.
