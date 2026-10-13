# Google login verification

Branch: feature/google-login. Base: main 765dd33. Changes are LOCAL and uncommitted.
No push or deploy. Google OAuth credentials are not configured.

## Final results

- Unit/data preservation tests: 12/12 passed, no skips.
- PostgreSQL/OAuth protocol tests: 15/15 passed, no skips.
  Google HTTP responses are stubbed inside the test process. The database,
  Better Auth handlers, OAuth state/PKCE, token encryption and session persistence
  are real. This is NOT a live Google login result.
- Existing transaction-history component verification: passed.
- Existing planning component verification: passed.
- Lint/typecheck/production build: passed (final command recorded below).
- Real Google account login, Render and real phone: NOT verified.

## Browser automation

In-app browser, local server :3011:
- Jack welcome defaults to English; returning-user link opens login.
- Back returns to welcome.
- VI language choice leads to VI login.
- ZH language choice leads to ZH login.
- Anonymous /app redirects to welcome.
- Desktop visual inspection and mobile simulation at 390x844 and 360x800.
- ZH login at 360px: DOM scrollWidth=360, viewport=360 (no horizontal overflow).
- Missing Google credentials disable the button and show a clear unavailable state.
- Screenshots were viewed through the browser tool. Saving JPEG evidence to this
  new worktree was blocked by filesystem EPERM, so no saved images are claimed.
- No browser account login was attempted and no private document/data was uploaded.

## Initial failures (retained history)

First protocol run: 4/13 passed, 9 failures.
- One exposed a missing application-level same-origin check for unauthenticated
  OAuth-start POSTs. Added the origin guard; foreign/missing origins now fail closed.
- The other eight were cascading fixture failures after the library's default
  OAuth-start burst limiter fired. Protocol tests now isolate rate limiting;
  a separate test uses unchanged production limits and gets 200,200,200,429.
Second run: 14/15 passed, 1 fixture expectation failure: Better Auth normalizes
emails to lowercase. Corrected the expected fixture email.
Final protocol run: 15/15 passed.

A migration-script CommonJS named-import error was corrected before migration
succeeded. An initial navigation lint warning was corrected using Next.js router.

## Scope and residual limits

No Java Policy Guard/Sandbox files were edited. Home, transaction and planning
calculation code/CSS were not modified. The settings file changes only wire
actual sign-out, router calls and its failure message. The account UI update
from origin/main at 61224d4 has now been integrated into feature/google-login;
the Settings.tsx conflict was resolved using the updated UI and the real
Google sign-out handler.

Accounts/session data is in PostgreSQL; finance data is still local. The new
storage key separates accounts logically; it does not secure a browser controlled
by another person. Legacy data is preserved with opt-in copy, no auto migration.
RBAC and finance ownership in server APIs remain future work.

Dependency audit discovered inherited critical issues. Next.js and ESLint Next
were patched 16.3.5 -> 16.3.8. Compatible proxy-addr/sharp updates removed the
remaining critical finding. Final audit: 13 findings (11 high, 2 moderate,
0 critical); not a security certification and not a clean audit. Broader template
dependency cleanup remains before public deployment.

Commands: npm run check; npm run test:auth; npm run test:auth:postgres;
node scripts/verify-transaction-history.cjs; node scripts/verify-planning.cjs.

## Account UI integration follow-up

Updated the login worktree to origin/main 61224d4. The original login changes
remain recoverable in the stash named google-login-before-account-ui-update.
Sign-out is located in Account tab -> Account settings -> Sign out. Confirmation
calls the authentication service, clears workspace memory, then returns to Jack.
The session watcher also redirects to Jack so it cannot race the sign-out
handler to the login page. Failure keeps the current page and displays a safe
localized error; the confirmation button is disabled while the request runs.

Verification after integration: settings component checks pass, including
VI/EN/ZH sign-out labels, confirmation, success/failure and zero financial
writes; 12/12 auth unit tests and 15/15 stubbed Google/PostgreSQL protocol tests
pass (including database session revocation). Lint, typecheck and production
build pass. Git reports no unmerged files; no conflict markers remain in Settings.
The user separately reported a successful real Google login before integration.
No real browser logout is claimed for this follow-up.
