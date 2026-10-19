# Data integrity, CI and feedback changes

Scope: requested priorities 1, 2, 3 and 5. AI provider safeguards (priority 4) remain assigned to the teammate. No bank settlement integration is added.

## Behavior

- Authenticated safety and international transfer APIs always use PostgreSQL. Configuration, session adapter and database failures return sanitized errors, never an in-memory success.
- Temporary repositories require an explicitly enabled localhost development demo. They are labelled as temporary. Sandbox state checks include quote and approval expiry, pause, bill revisions, minimum test reserve, immutable receipts and idempotent retries.
- Reference estimates use genuine Frankfurter observations, including in the local demo. A provider outage can display an existing observation with its original timestamp and freshness state. An absent/unknown observation cannot create an estimate. Sandbox payment fixtures remain synthetic and separate from reference estimates.
- Contact and both feature suggestion forms submit to `POST /api/feedback`. A receipt is shown only after PostgreSQL confirms storage. Errors retain input; retrying the same submission identifier cannot insert another record. Likes are personal preferences, not aggregated votes. Feature examples do not imply a committed roadmap.
- The feedback route requires a verified session, configured same origin, matching workspace header, strict JSON schema and a bounded request body. Database transactions enforce five new submissions per account per ten minutes across server instances. Existing identical retries remain available at the limit. Account closure blocks new submissions while retaining prior records.
- CI runs on pushes and pull requests to `main`: lint, TypeScript, business/onboarding tests, PostgreSQL regressions and production build. CI uses a disposable PostgreSQL service, synthetic credentials and the explicit `finbridge_auth_test` database.

## Migration before deployment

Run `npm run auth:migrate` against the intended deployment database before the new app serves traffic. It adds `finbridge_feedback` and `finbridge_feedback_limits` without resetting existing data. Local checks for this change use only `AUTH_TEST_DATABASE_URL` pointing to the dedicated localhost test database; the production database is not migrated by the test scripts.

Operators can review stored feedback using authorized database access:

```sql
SELECT id, user_id, kind, subject, message, status, created_at
FROM finbridge_feedback
ORDER BY created_at DESC
LIMIT 100;
```

`received` means stored. There is no email forwarding, reply SLA or support inbox UI in this change. Do not expose this operator query through an unauthenticated endpoint.

## Verification commands

```text
npm run lint
npm run typecheck
npm run test:business:unit
npm run test:business:postgres
npm run test:feedback:ui
npm run build
```

The onboarding suite includes PostgreSQL cases and therefore also needs the isolated test database. The UI suite uses disposable identities, a temporary app copy and headless Playwright; its browser runtime must be available locally. Provider error tests use scripted responses and do not assert live provider availability. Existing localization TODO cases remain reported as TODOs.

Small pre-existing lint blockers in language preference synchronization, wallet deep-link opening, safety pagination and transaction history imports were corrected so the CI gate can execute without disabling lint rules. The changes do not redesign those screens.
