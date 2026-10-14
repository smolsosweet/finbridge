# Authentication acceptance test — 2026-10-14

Source: `main` commit `4eb9f1b` (`feat: polish auth and onboarding responsive layout and language selector`).
This report was prepared on the isolated verification branch `feature/auth-flow-verification`.

## Result

The normal lifecycle works against an isolated PostgreSQL test database with synthetic accounts:

| Workflow | Result |
| --- | --- |
| Email/password sign-in and sign-out | Pass |
| Google OAuth callback and account-linking protection | Pass with a protocol stub |
| Password recovery and session revocation | Pass |
| Account deletion, workspace cleanup, and re-registering the email | Pass |
| Account isolation after switching users | Pass |

No user account or production database was accessed. Two browser fixtures (`@example.invalid`) were removed after the test.

## Evidence

| Check | Result |
| --- | --- |
| `npm run test:auth` | 18/18 passed |
| PostgreSQL auth regression suite | 40/40 passed, including 7 cases added for this verification |
| `node scripts/verify-auth-form.cjs` | Passed |
| `node scripts/verify-settings.cjs` | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed |

The added PostgreSQL cases cover current-session sign-out, reset across two devices, concurrent reset-token consumption, forged and expired verification tokens, untrusted recovery redirects, route rate limiting with a stable client address, and Google account takeover prevention for an existing email/password account.

Browser acceptance checks used a separate local app on `127.0.0.1:3012`, a dedicated test database, local test mail, and synthetic Google tokens. They checked failed and successful sign-in, account settings identity, cancellation of deletion, logout plus Back/direct-route protection, password reset with the old password rejected and new password accepted, switching users without data leakage, deletion effects, and mobile layout at 390 × 844. The login and recovery forms had no horizontal overflow; recovery CTA remained visible.

## Security finding before public deployment

**P1 — forwarded client IP is trusted by the current rate limiter.**

Better Auth accepts `X-Forwarded-For` by default. In a direct local ingress probe, five failed requests from one supplied address produced `401, 401, 401, 429, 429`; changing the supplied address for each request produced five `401` responses. A caller can therefore evade this application-level rate limit if the ingress forwards an attacker-controlled header unchanged.

This does not prove Render has the same exposure: its proxy may overwrite or sanitize the header. It does mean the app cannot yet claim brute-force protection until the deployed proxy behavior is verified and the application is configured to trust only its actual proxy path. Do not disable all IP headers without a replacement, because that could turn the limit into a shared global bucket for all users.

Recommended next change: configure trusted proxy/header handling for Render, retain a server-side abuse budget keyed independently of a client-supplied header, then repeat this probe on the deployed service.

## Usability follow-ups

1. The English account dialogs still use the shared Vietnamese dialog label (`Tùy chọn`) and close-button label (`Đóng hộp thoại`). Translate these through the common modal component.
2. Email/password and Google accounts intentionally do not auto-link. This blocks takeover, but the OAuth failure message should direct users with an existing password account to password sign-in or recovery.
3. A stale Google session correctly requires the user to sign out and sign back in before deletion. Keep that freshness guard; a direct “sign in again” action in the dialog would make the safe path clearer.

## Limits of this run

This run did not perform live Google consent, real Brevo delivery, a Render deployment test, physical-device testing, or multi-instance production rate-limit validation. The test mail and OAuth provider were stubs. The in-memory limiter also resets when an application instance restarts.
