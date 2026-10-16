# Local verification - 2026-10-16

Branch: `feature/safety-alerts`. Checks used disposable fixtures in the isolated
`finbridge_auth_test` database; no real mail was sent.

| Check | Result |
| --- | --- |
| Workspace validation, category scope, retries and in-flight edits | 4 passed |
| Relational workspace persistence, owner FKs, concurrent writes, soft retention, closure | 11 passed |
| Safety calculations, boundaries and generic email provider stubs | 16 passed |
| Database-backed grouped alerts, revision conflicts, outbox and closure | 13 passed |
| Auth unit / PostgreSQL | 19 / 44 passed |
| Onboarding | 22 passed |
| Localization | 38 passed, 2 pre-existing TODO cases |
| Scenario planner | 11 passed |
| Settings script | Passed |
| TypeScript / production build | Passed |
| ESLint on new workspace/safety modules and API | Passed |

178 individual cases passed. Existing localization TODO cases are not claimed as
verified. Full repository ESLint has existing findings and is not all-green.

Authenticated Chrome checks covered explicit browser-to-database import with an
unchanged original backup, account-owned records in a second browser with no local
financial workspace, adding a new budget category and reloading it from PostgreSQL,
three actual/forecast conditions in one configuration, history/read state,
pause/resume, disabled unconfigured email, EN/VI/ZH, dark/light rendering and 390px
horizontal overflow/header clipping. Desktop and mobile screenshots were inspected.

The local app database was backed up using pg_dump before additive migration;
pg_restore successfully read the backup catalog. The new business tables exist in
`finbridge_auth` at localhost:5434. Existing browser records still require their
owner's explicit import. No user data was reset or synthetic transactions inserted
into that app database.

No Render deployment, real scheduled email, provider delivery webhook, production
load test, disaster restore drill or security certification was performed. Revisions
are retained for recovery/audit but are not a substitute for independent backups.

## Fixed-bill workflow update

Nine additional QR/payment model checks and eight payment PostgreSQL checks pass.
Planning's create/edit/pause/resume harness was updated for the current module
dependencies and targets its actual form instead of the scenario chat form.
The payment browser check covers local QR reading, saved recipient editing,
bank-app capabilities, no automatic payment confirmation, save-failure retry,
linking existing expenses without a second debit and EN/VI/ZH mobile dialogs.
Bank-app navigation is intercepted in tests; no real transfer or bank verification
is claimed. See [fixed-bill behavior](../FIXED_BILL_PAYMENTS.md).
