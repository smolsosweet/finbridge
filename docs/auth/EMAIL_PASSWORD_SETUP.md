# Email login, registration and password recovery

Implemented on `feature/email-login`, based on `4582ae1`; merged into `main`
at `5029ec7`. The local app now runs from `D:\ai-website-cloner-codex`.

## What is implemented

- Login with email/password or Google; password visibility toggle.
- Registration with email, password and confirmation; the initial display name
  is derived from the email and can be customized during account setup.
- Passwords require 12–128 characters and are hashed by Better Auth (scrypt).
- Email verification is required before credential login. Registration never
  automatically authenticates an unverified account. Verification links expire
  after one hour; signup offers an explicit resend button, and login offers it
  after an unverified login attempt. Duplicate signup returns a generic response
  without creating an account or sending another email. Already verified users
  should log in or request a password reset.
- Password recovery sends a link valid for 30 minutes. Successful reset consumes
  the token and revokes existing sessions; the user signs in with the new password.
  Missing, expired or used links show a direct action to request a fresh link.
  A successful reset closes the password form. Links issued before account
  deletion cannot reset a replacement account registered with the same email.
- Existing Google users can establish a password via recovery sent to their
  Google email. This retains their user ID and browser workspace. An ordinary
  duplicate signup cannot claim or overwrite their account. Automatic social
  account linking remains disabled.
- Auth forms and messages are available in English, Vietnamese and Chinese.
  Changing the language also updates notices and errors already on screen.
- Account deletion now calls Better Auth's authenticated server endpoint. It
  removes the user, provider accounts and all sessions; PostgreSQL cascades the
  onboarding record. Deletion requires a session created within five minutes or
  the correct FinBridge password. A Google-only user with an older session must
  sign out and sign in again. Opening the confirmation dialog performs no writes.
  Only confirmed server deletion clears this account's browser workspace and
  setup draft, then returns to welcome. Other accounts and the unclaimed legacy
  backup are retained. Data on other devices and downloaded backups is not
  automatically removed.
- PostgreSQL stores users, provider accounts/password hashes, sessions and
  verification records. A migration adds `user.role`, default `user`, with
  client input disabled. Full RBAC/admin management is a future task.
- Wallets, transactions and budgets still live in per-account browser storage.
  This change does not add finance synchronization across devices.
  The old-workspace import notice is no longer displayed when signing in. An
  unclaimed legacy record remains on disk and is not automatically copied into
  any authenticated account.

## Real email (recommended: Brevo HTTP API)

Create a [Brevo account](https://www.brevo.com/) and select the Free plan.
As checked on 13 October 2026, it supports 300 email sends/day, including
transactional email. See [official plan details](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans).
Provider availability, account activation and inbox delivery must be tested;
this quota is not an uptime or inbox-placement guarantee.

1. Add and verify a sender in Brevo's sender settings (name: FinBridge).
   Use a domain you control and authenticate it for long-term use. A public
   Gmail address cannot authenticate the gmail.com domain; Brevo may rewrite
   its sender domain. Follow the provider's current verification instructions.
2. Create a server API key in SMTP & API -> API Keys. This is an API key, not
   an SMTP key. Keep it in local/server environment settings only.
3. In ignored `.env.local`, replace local mode with:

```dotenv
AUTH_EMAIL_MODE=brevo
BREVO_API_KEY=YOUR_PRIVATE_API_KEY
AUTH_EMAIL_FROM=your-verified-sender@example.com
```

4. Restart the app; register using an email inbox you control. Open the
   verification email, log in, then test Forgot password and its link. Check
   provider logs plus Inbox/Spam when delivery is delayed.

The adapter uses fixed `https://api.brevo.com/v3/smtp/email`, a 15-second timeout,
no redirects and no automatic retry. It sends only sender, recipient, fixed
subject and the verification/recovery link. It does not send financial data.
Never log or share keys, passwords or email-link tokens.

Sources: [send transactional email](https://developers.brevo.com/docs/send-a-transactional-email),
[register a sender](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email),
[domain authentication limits](https://help.brevo.com/hc/en-us/articles/16045394674066-Troubleshooting-Domain-authentication).

## Optional SMTP

Set `AUTH_EMAIL_MODE=smtp` and all of `SMTP_HOST`, `SMTP_PORT` (465 or 587),
`SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`. Port 465 uses TLS; port 587 requires
STARTTLS. The adapter rejects incomplete config and sender header injection.
SMTP is unsuitable for Render's free web service ports 25/465/587, which are
blocked. Use the HTTPS adapter there. [Render limitations](https://render.com/docs/free).

## Local development outbox

`AUTH_EMAIL_MODE=local` is explicitly development-only and requires a localhost
auth origin. It is refused in production. Messages are stored in ignored
`.local/mail-outbox/*.json`, never served in a browser route or printed to logs.
Open the local file privately to use its link. Anyone with access to those files
can use the links; never deploy or publish them. This is not delivery to an inbox.

The current checkout is in local mode until the user supplies real provider
credentials. Without a mail adapter, signup and recovery are disabled server-side;
existing verified password users and Google can still sign in.

## Deploying web app and database on Render

The Next.js web service and managed PostgreSQL are separate services, preferably
in the same region. Set `DATABASE_URL` on the app to the database's internal URL.
Set the production HTTPS `BETTER_AUTH_URL`, a stable `BETTER_AUTH_SECRET`, Google
credentials and the real email adapter variables. Add the production Google
callback URL. Run `npm run auth:migrate` against the new database before serving
traffic. The migration now uses the same auth schema options as the app.

Git pushes deploy code, not the local PostgreSQL cluster or its data. The local
cluster is now stored independently at `D:\finbridge-local-data\postgres`; see
[local database startup and backup](GOOGLE_LOGIN_SETUP.md).
Moving existing data requires a deliberate PostgreSQL dump/restore. Accounts
created locally therefore do not automatically appear on a newly provisioned DB.
Render Free PostgreSQL currently expires after 30 days; choose persistent paid
storage or another managed database for long-term accounts. Production backup,
restore and deployment testing remain to be done.

[Render PostgreSQL connections](https://render.com/docs/postgresql-creating-connecting),
[free database expiry](https://render.com/docs/free).

## Verification

- `npm run test:auth`: 16/16 passed, including local-mode restrictions, SMTP
  validation and stubbed Brevo HTTPS success/failure with no retry.
- `npm run test:auth:postgres`: 28/28 passed against the isolated local test DB.
  Covers OAuth, hashed passwords, verification requirement, identity preservation,
  duplicate signup, role escalation attempts, recovery replay/expiry, session
  revocation, absent delivery config and mail failure without authentication.
- `node scripts/verify-auth-form.cjs`: passed EN/VI/ZH rendering and real form
  handler checks for login, signup, recovery/reset and disabled-state gates.
- `node scripts/verify-settings.cjs`: passed, including logout.
- The initial SMTP-failure test assumed signup would return an error. Better
  Auth intentionally returns a generic signup response; the corrected test
  asserts no session, unverified status, blocked login and a working resend.
- The initial form test expected lowercase HTML `autocomplete`; React renders
  `autoComplete`. The test now checks the attribute case-insensitively.
- No live SMTP/Brevo delivery, Render deployment or new browser visual test is
  claimed. Google was tested live by the user before this email-login change.

Library reference: [Better Auth email/password](https://better-auth.com/docs/authentication/email-password).
