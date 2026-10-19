# Judge accounts and repeatable synthetic data

The provisioner creates only two reserved identities: finbridge-demo-judge-1 / -2,
with judge-1@demo.finbridge.invalid / judge-2@demo.finbridge.invalid. These are
deliberately non-deliverable addresses for administrator-provisioned demo login;
they cannot test signup, email verification or password-reset delivery. Verification
is explicitly granted by this private provisioning operation, never by a public route.

Use normal signup with a new mailbox separately to test Brevo delivery.

## Prepare

Complete the app schema migration against the intended target first. The tool only
adds its small registration table, not the rest of the application schema.
Set DEMO_DATABASE_URL in your private environment. It never falls back to DATABASE_URL.
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

Reset restores two manually tracked wallets, salary/expense records, a monthly budget,
a bill due in three days and an in-app budget alert. It clears only that demo owner's
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
