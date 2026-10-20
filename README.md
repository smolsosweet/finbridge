# FinBridge

FinBridge is a multilingual personal finance workspace for wallets, transactions, budgets and recurring bills across currencies. English is the default; Vietnamese and Chinese are also available.

## Quick access for judges

**Use the hosted application for evaluation. No installation or database setup is required.**

| Resource | Link |
| --- | --- |
| Live application | [Open FinBridge](https://finbridge-orcin-phi.vercel.app) |
| Email/password login | [Sign in](https://finbridge-orcin-phi.vercel.app/login) |
| Source repository | [smolsosweet/finbridge](https://github.com/smolsosweet/finbridge) |
| Source download | [Download main as ZIP](https://github.com/smolsosweet/finbridge/archive/refs/heads/main.zip) |
| Deployed version | [Release metadata](https://finbridge-orcin-phi.vercel.app/api/release) |

### Suggested evaluation walkthrough

- Inspect the dashboard, wallet/currency filters and transaction history.
- Add a synthetic transaction, reload, then edit/delete it and check the balance.
- Inspect budgets, fixed expenses, reserve thresholds and historical alerts. Marking an alert read does not mean a bill was paid.
- Ask the AI assistant for one short synthetic transaction draft; review it before confirming the save. AI depends on the configured provider and shared quota.
- If enabled, create an education sandbox bill, compare example quotes, review/approve a plan, execute the simulation and inspect its receipt. Server checks enforce quote and approval expiry.

Use synthetic data only. The sandbox moves no real money. Email-provider acceptance is not proof of inbox delivery; opening a bank app or QR code is not proof of payment.

## Download the source

Requirements: **Node.js 24+** and npm. Full authenticated operation additionally requires PostgreSQL.

With Git:

```bash
git clone https://github.com/smolsosweet/finbridge.git
cd finbridge
npm ci
```

Without Git: [download the ZIP](https://github.com/smolsosweet/finbridge/archive/refs/heads/main.zip), extract it, open a terminal inside `finbridge-main` (the directory containing `package.json`), and run `npm ci`.

A clone/ZIP contains neither production credentials nor production database records. The hosted judge accounts do not automatically exist in a local database.

## Local demonstration without a database

Use a **fresh checkout** for this limited development mode. It uses device storage and temporary server memory, without authenticated database persistence, Google login, live email delivery or anonymous Gemini access.

1. Install dependencies using the steps above.
2. Create a new `.env.local` in the project root containing only:

   ```dotenv
   FINBRIDGE_DEMO_MODE=true
   ```

3. Run:

   ```bash
   npm run dev -- --port 3000
   ```

4. Open [http://localhost:3000/app](http://localhost:3000/app). No judge password is required in this local mode.

This mode requires `next dev` on localhost and is disabled in production builds. Do not overwrite an existing environment file or connect this demonstration to the hosted database. For the full judged experience, use the live application above.

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

Email needs a configured Brevo HTTPS or SMTP sender. Opted-in safety email may include rule/target names, financial amounts, thresholds, currency and period. Local outbox mode is development-only. Secrets belong in ignored environment files or hosting settings.

All Gemini calls use [shared PostgreSQL AI quotas](docs/AI_QUOTAS.md). Set the required global budgets from the actual AI Studio project limits and migrate the quota schema before deploying. Unconfigured quotas block AI calls; manual entry remains available.

See [AI upload/browser security](docs/AI_INPUT_SECURITY.md), [judge account provisioning](docs/DEMO_ACCOUNTS.md), [email scheduler setup](docs/safety/SCHEDULER.md) and the [release checklist (Vietnamese)](docs/RELEASE_CHECKLIST_VI.md). The demo uses Gemini Free; only synthetic data should be submitted to AI. Account closure disables access and retains financial history; there is no automatic financial purge schedule.

Forwarded-IP trust in auth rate limiting remains open before public deployment. See [auth acceptance](docs/auth/AUTH_FLOW_ACCEPTANCE_2026-10-14.md). Local tests do not establish production security or provider availability.

## Local setup with PostgreSQL and authentication

Use your own PostgreSQL application database and role; PostgreSQL 17 is used by CI. Keep application, automated-test and production databases separate.

### 1. Configure the environment

After `npm ci`, copy `.env.example` to `.env.local`:

```powershell
# Windows PowerShell
Copy-Item .env.example .env.local
```

```bash
# macOS / Linux
cp .env.example .env.local
```

Edit these settings before starting the app:

| Variable | Local value / purpose |
| --- | --- |
| `BETTER_AUTH_URL` | `http://localhost:3000`. Update the example file's different port to match this guide. |
| `BETTER_AUTH_SECRET` | Your own random secret of at least 32 characters. |
| `DATABASE_URL` | Your local application database connection string; replace the example role, password, port and database. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Your own OAuth credentials. The current auth configuration requires both variables, including for email/password login. |
| `AUTH_EMAIL_MODE` | `local` in development: verification/reset messages are saved in `.local/mail-outbox/`, not emailed. |
| `FINBRIDGE_DEMO_MODE` | Leave unset or set to `false` for authenticated operation. |
| `GEMINI_API_KEY`, `AI_QUOTA_*` | Needed for AI calls. Set required global budgets from your own provider allowance. |
| `SAFETY_EMAIL_ENABLED` | Keep `false` until you configure and verify a real sender and scheduler. |

Generate your auth secret locally:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

For Google sign-in, register `http://localhost:3000/api/auth/callback/google` in your own OAuth project. Keep `.env.local`, mail-outbox files and generated passwords private.

### 2. Initialize the schema

Confirm `DATABASE_URL` targets your intended local application database, then run:

```bash
npm run auth:migrate
```

Expected completion: `FinBridge schema migrated. Existing data was not reset.` This initializes the auth and application schemas; it does not import hosted demo users or records.

### 3. Start and sign in

```bash
npm run dev -- --port 3000
```

Open [http://localhost:3000](http://localhost:3000), register your own account, open its verification URL from the private `.local/mail-outbox/` JSON file in your browser, then sign in. Local outbox mode does not deliver email to an inbox.

To provision local empty/populated judge profiles, follow [Demo accounts](docs/DEMO_ACCOUNTS.md), with `DEMO_DATABASE_URL` explicitly pointing to your **local** database. The tool generates separate local passwords. Hosted demo credentials are not copied automatically.

For a production-style build, use `npm run build` followed by `npm start` with suitable runtime settings. Anonymous demo and local outbox modes are development-only; production authentication mail needs a supported real sender. See [email setup](docs/auth/EMAIL_PASSWORD_SETUP.md).

On Windows, use `npm.cmd` instead of `npm` if PowerShell blocks `npm.ps1` under its execution policy.

## Hosted deployment

The live application uses **Vercel + Neon PostgreSQL**. Store server-only secrets in hosting environment settings; keep Production and Preview database targets separate.

1. Configure the intended database, canonical `BETTER_AUTH_URL`, auth secret and Google OAuth callback.
2. Initialize the schema against the confirmed target before enabling dependent features.
3. Configure email, Gemini and shared AI quotas for the features you intend to enable, using actual provider limits.
4. Enable the clearly labelled transfer sandbox if needed. Configure only one email scheduler and verify delivery separately.
5. Deploy, compare `/api/release` with the intended commit, then check login, save/reload and a sandbox receipt. Preserve a compatible prior deployment for rollback.

See [AI quotas](docs/AI_QUOTAS.md), [scheduler setup](docs/safety/SCHEDULER.md) and the [release checklist](docs/RELEASE_CHECKLIST_VI.md). Historical checklists contain dated examples; current code and verified deployment settings take precedence.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development |
| `npm run build` / `npm start` | Build / serve production |
| `npm run typecheck` / `npm run lint` | Static checks |
| `npm run test:business:unit` | Business unit suites |
| `npm run test:business:postgres` | Business PostgreSQL suites against the isolated local test database |
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

Test commands are not a claim that every suite or production workflow has passed. The submission test report records actual results, known gaps and remaining checks.

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
