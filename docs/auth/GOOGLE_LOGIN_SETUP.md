# Google sign-in setup (feature/google-login)

## Current local checkout

- Branch: `main` (Google and email login have both been merged).
- Checkout: `D:\ai-website-cloner-codex`.
- App: http://localhost:3000/
- First visit: Jake welcome screen. Returning-user link opens login.
- Google callback succeeds -> /app (Home). Valid returning sessions skip welcome.
- Email/password registration, verification and recovery are now documented in
  [email setup](EMAIL_PASSWORD_SETUP.md). Apple is not included.
- Accounts and sessions: PostgreSQL, not a simulated login.
- Authenticated financial records now use account-owned PostgreSQL business tables.
  See [database structure and migration](../DATABASE.md). Administrative RBAC is not implemented.

## Local database already prepared on this machine

A dedicated PostgreSQL 17 cluster is stored at `D:\finbridge-local-data\postgres`, bound ONLY
to 127.0.0.1:5434. The existing PostgreSQL service on 5432 was not changed.
New databases: `finbridge_auth` and `finbridge_auth_test`.
The app role is not a superuser. App credentials and the signing secret were
generated locally and written only to ignored `.env.local`; no secret is in Git.
Google credentials were configured locally and the user confirmed successful
Google login. A new checkout must supply its own ignored credentials.

To restart this dedicated local cluster after reboot (PowerShell):

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe' -D 'D:\finbridge-local-data\postgres' -l 'D:\finbridge-local-data\postgres.log' -o '-h 127.0.0.1 -p 5434' -w start
```

The database was moved out of the temporary login worktree after a clean shutdown.
Logical dumps, a verified cold copy and both local environment files are preserved
under `D:\finbridge-local-data\backups\before-worktree-removal`. This directory
contains private data and credentials; do not upload it or commit it to Git.
The connection remains `127.0.0.1:5434`, so `.env.local` needs no database URL change.
All rows in both databases matched their pre-move checksums, and the 28 auth
PostgreSQL integration tests passed against the isolated test database after moving.

Alternatively, a new machine can use `compose.auth.yml` with a locally supplied
`FINBRIDGE_LOCAL_DB_PASSWORD`, then fill `.env.local` from `.env.example`.
Do not run Docker on port 5434 while the native local cluster is running.

## Google configuration — user action required

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Choose/create the intended project. Configure Google Auth Platform's branding,
   audience and contact information for FinBridge. If in testing mode, add the
   accounts that will test the app to Test users.
3. Create an OAuth client of type **Web application**.
4. Set the authorized JavaScript origin to `http://localhost:3000`.
5. Set the authorized redirect URI to
   `http://localhost:3000/api/auth/callback/google` exactly. You may retain the
   old localhost:3011 callback for another development server.
6. In this checkout's ignored `.env.local`, fill:
   `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
   Keep the generated secret and database URL. Do not paste secrets into chat.
7. Restart the Next.js server:

```powershell
Set-Location D:\ai-website-cloner-codex
npm run auth:migrate
npm run dev -- --port 3000
```

8. Open /. Choose language if needed, then Returning user -> Continue with Google.
   Select your Google account. After success, Home opens.
9. Refresh Home, then use Settings -> Account settings -> Sign out.
   Reopening /app without a session must return to Jack.
10. Sign in with a second test account; it gets a separate local workspace.

Google creates a FinBridge account on first successful sign-in; there is no
separate Google signup form. Requested scopes are only openid, email, profile.

[Official provider setup](https://better-auth.com/docs/authentication/google)
and [Next.js integration](https://better-auth.com/docs/integrations/next).

## Existing device data

See [data preservation](../AUTH_DATA_PRESERVATION.md). The old
`rolly-replica-v2` record is never deleted/overwritten or auto-assigned. When a
valid old record exists on the SAME origin and a signed-in account has no saved
workspace, the app offers backup, explicitly confirmed copy, or keep for later.
Different localhost ports have different browser storage.

## Future Render deployment

Google login was pushed to main at 4582ae1; email login was merged at 5029ec7.
Nothing has been deployed. Create/use the intended NEXT.JS
service and persistent Render PostgreSQL database, not the old shared Java demo.
At deployment time, configure:

- `DATABASE_URL`: persistent PostgreSQL connection URL.
- `BETTER_AUTH_URL`: exact HTTPS origin of the new FinBridge service.
- `BETTER_AUTH_SECRET`: independently generated secret, at least 32 characters.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: Google credentials for this service.

Add that HTTPS origin and `https://YOUR-DOMAIN/api/auth/callback/google` to the
OAuth client's allowed URLs. Run `npm run auth:migrate` as a pre-deploy command;
then use `npm run build` and `npm run start -- --hostname 0.0.0.0 --port $PORT`.
Never set AUTH_TEST_DATABASE_URL to a public/app database.

The session is validated in the server layout on every workspace render.
Cookie existence alone is not authorization. Expired/revoked/forged sessions
cannot open Home. Session cookies are HttpOnly/SameSite Lax; HTTPS enables Secure.
OAuth tokens are encrypted at rest; email account linking is disabled.
All auth POSTs require the configured origin. The library's memory rate limiter
is a demo safeguard, not distributed abuse prevention or future RBAC.

Financial APIs with database ownership and role checks are still a separate
task before a multi-user production finance deployment.
