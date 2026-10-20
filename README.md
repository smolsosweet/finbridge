# FinBridge

FinBridge is a multilingual personal finance workspace for wallets, transactions, budgets and recurring bills across currencies. English is the default; Vietnamese and Chinese are also available.

## Features

- Google sign-in, verified email/password accounts, recovery, logout and soft account closure.
- First-account setup: preferred name, wallets, opening balances, categories, fixed costs and reserves.
- Cash-flow summaries per currency, weekly charts per wallet and filtered transaction history.
- Budgets linked to fixed expenses, due-date guidance and reserve warnings.
- [Fixed-bill payments](docs/FIXED_BILL_PAYMENTS.md): local VietQR reading, editable saved recipients, bank-app handoff and user-confirmed expense recording per occurrence.
- [Safety thresholds and alerts](docs/safety/SAFETY_ALERTS.md): actual/forecast budget rules, wallet floors, protected history and optional private email reminders.
- Gemini-assisted transaction entry and financial scenario planning, with review before recording changes.
- [International education-payment sandbox](docs/INTERNATIONAL_TRANSFERS.md): compare example routes, review costs and recipients, approve a test transfer and retain account-owned receipts.

Wallets are manually tracked. The application does not connect to banks, move real money or convert wallet balances between currencies.

## Data and security

PostgreSQL stores authenticated financial workspaces in relational tables: wallets, categories and wallet assignments, transactions, budgets, goals, fixed expenses, recurring entries, preferences, onboarding drafts, conversations and alert rules/history. Account-scoped foreign keys, transactional saves, revision checks and idempotency protect writes. Removed business records are soft deleted; workspace revisions retain earlier versions. See [database structure and pgAdmin](docs/DATABASE.md).

Existing account-owned browser records are offered for a one-time explicit import; the original stays unchanged. Authenticated edits no longer write the financial workspace to browser storage. Language preference and the explicit local demo still use browser storage. Devices load current records when opening the app; concurrent edits cause a visible conflict instead of silent merging.

Email needs a configured Brevo HTTPS or SMTP sender. Local outbox mode is development-only. Secrets belong in ignored environment files or hosting settings.

All Gemini calls use [shared PostgreSQL AI quotas](docs/AI_QUOTAS.md). Set the required global budgets from the actual AI Studio project limits and migrate the quota schema before deploying. Unconfigured quotas block AI calls; manual entry remains available.

See [AI upload/browser security](docs/AI_INPUT_SECURITY.md), [judge account provisioning](docs/DEMO_ACCOUNTS.md), [email scheduler setup](docs/safety/SCHEDULER.md) and the [release checklist (Vietnamese)](docs/RELEASE_CHECKLIST_VI.md). The demo uses Gemini Free; only synthetic data should be submitted to AI. Account closure disables access and retains financial history; there is no automatic financial purge schedule.

Forwarded-IP trust in auth rate limiting remains open before public deployment. See [auth acceptance](docs/auth/AUTH_FLOW_ACCEPTANCE_2026-10-14.md). Local tests do not establish production security or provider availability.

## Local setup

Requirements: Node.js 24+, npm and PostgreSQL.

1. Run `npm ci`.
2. Copy `.env.example` to ignored `.env.local`; supply auth, Google and database settings.
3. Start PostgreSQL, then run `npm run auth:migrate`.
4. Run `npm run dev` and open http://localhost:3000.

Set `BETTER_AUTH_URL` to the app origin and register its `/api/auth/callback/google` in Google OAuth. Configure real email before testing signup/recovery.

On the current Windows machine, PostgreSQL runs separately on port 5434. See [database startup](docs/auth/GOOGLE_LOGIN_SETUP.md). A Git clone does not include credentials or database contents.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development |
| `npm run build` / `npm start` | Build / serve production |
| `npm run typecheck` / `npm run lint` | Static checks |
| `npm run auth:migrate` | Database schema |
| `npm run test:auth` | Auth unit tests |
| `npm run test:auth:postgres` | Isolated database tests |
| `npm run test:workspace` | Workspace validation and retry/conflict behavior |
| `npm run test:workspace:postgres` | Relational finance persistence and account isolation |
| `npm run test:onboarding` | First-account setup |
| `npm run test:localization` | Wallet/transaction language checks |
| `npm run test:transaction-ai` | AI transaction fixtures |
| `npm run test:scenario-planner` | Scenario planning |
| `npm run test:transfers` / `npm run test:transfers:postgres` | International transfer calculations, lifecycle and database isolation |
| `npm run test:transfers:ui` | Isolated browser approval and receipt workflow |

Database tests require `AUTH_TEST_DATABASE_URL` targeting local `finbridge_auth_test`. Never run them against app/production data.

## Documentation and provenance

- [Deploy web and PostgreSQL on Render (Vietnamese)](docs/DEPLOY_RENDER_VI.md)
- [Google login and PostgreSQL](docs/auth/GOOGLE_LOGIN_SETUP.md)
- [Email recovery and Render](docs/auth/EMAIL_PASSWORD_SETUP.md)
- [First-account setup](docs/FIRST_ACCOUNT_SETUP.md)
- [Auth acceptance](docs/auth/AUTH_FLOW_ACCEPTANCE_2026-10-14.md)
- [Data preservation](docs/AUTH_DATA_PRESERVATION.md)
- [Security](SECURITY.md) and [third-party notices](THIRD_PARTY_NOTICES.md)

Routes are in `src/app`, auth/setup in `src/components/auth`, and services in `src/lib`. Active finance UI lives in `src/components/finbridge/workspace`; public UI assets live in `public/finbridge`. See [path migration](docs/FINBRIDGE_PATH_MIGRATION.md) for old URL and browser-data compatibility.

The original scaffold used the MIT-licensed AI Website Cloner Template. Its copyright and [LICENSE](LICENSE) remain; UI prototype provenance is recorded in [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md).
