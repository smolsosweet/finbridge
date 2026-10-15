import assert from "node:assert/strict";
import { test, after } from "node:test";
import fs from "node:fs";
import ts from "typescript";
import nextEnv from "@next/env";
import { Pool } from "pg";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { generateKeyPair, exportJWK, SignJWT } from "jose";

nextEnv.loadEnvConfig(process.cwd());
const databaseURL = process.env.AUTH_TEST_DATABASE_URL;
if (!databaseURL) throw new Error("AUTH_TEST_DATABASE_URL required; tests are not skipped.");
const db = new URL(databaseURL);
if (!["127.0.0.1", "localhost"].includes(db.hostname) || db.pathname !== "/finbridge_auth_test") throw new Error("Only the dedicated local finbridge_auth_test database is allowed.");
const pool = new Pool({ connectionString: databaseURL, max: 2 });
const source = ts.transpileModule(fs.readFileSync("src/lib/auth-options.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { buildAuthOptions } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const baseURL = "http://localhost:3011";
const config = { baseURL, secret: "synthetic-only-test-secret-" + "x".repeat(40), clientId: "synthetic-client", clientSecret: "synthetic-client-secret", databaseURL };
const mail = [];
let mailFailure = false;
const productionOptions = buildAuthOptions(config, pool, async (message) => { if (mailFailure) throw new Error("SYNTHETIC_MAIL_FAILURE"); mail.push(message); });
const migration = await getMigrations(productionOptions); await migration.runMigrations();
// Protocol cases isolate OAuth from burst protection; the final case tests the real limiter.
const auth = betterAuth({ ...productionOptions, rateLimit: { enabled: false } });
const handlerSource = ts.transpileModule(fs.readFileSync("src/lib/auth-handler.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { handleAuthRequest } = await import("data:text/javascript;base64," + Buffer.from(handlerSource).toString("base64"));
const tables = ['session', 'account', 'verification', 'user'];
// These are disposable fixtures in a database whose name and host were checked above.
for (const table of tables) await pool.query('DELETE FROM "' + table + '"');
const originalFetch = globalThis.fetch;
let providerCalls = 0, subject = "google-user-A", tokenFailure = false;
const keys = await generateKeyPair("RS256");
const jwk = await exportJWK(keys.publicKey); jwk.kid = "synthetic-test-key"; jwk.alg = "RS256";
globalThis.fetch = async (input, init) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url === "https://oauth2.googleapis.com/token") {
    providerCalls++;
    const params = new URLSearchParams(String(init?.body));
    assert.ok(params.get("code_verifier"), "PKCE verifier must be sent to Google");
    assert.equal(params.get("redirect_uri"), baseURL + "/api/auth/callback/google");
    if (tokenFailure) return Response.json({ error: "invalid_grant" }, { status: 400 });
    const idToken = await new SignJWT({ sub: subject, email: subject + "@example.invalid", email_verified: true, name: "Synthetic " + subject }).setProtectedHeader({ alg: "RS256", kid: jwk.kid }).setIssuer("https://accounts.google.com").setAudience(config.clientId).setIssuedAt().setExpirationTime("5m").sign(keys.privateKey);
    return Response.json({ access_token: "synthetic-access-token", token_type: "Bearer", expires_in: 300, id_token: idToken });
  }
  if (url === "https://www.googleapis.com/oauth2/v3/certs") return Response.json({ keys: [jwk] });
  throw new Error("Unexpected network request blocked in auth test");
};
function cookies(response) { return response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; "); }
function request(path, { method = "GET", cookie = "", origin = baseURL, body } = {}) {
  return handleAuthRequest(auth, new Request(baseURL + "/api/auth" + path, { method, headers: { ...(origin ? { origin } : {}), ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }), baseURL);
}
async function start() {
  const response = await request("/sign-in/social", { method: "POST", body: { provider: "google", callbackURL: "/app", errorCallbackURL: "/login?error=oauth" } });
  assert.equal(response.status, 200);
  return { response, cookie: cookies(response), url: new URL((await response.json()).url) };
}
async function signInAs(id) { subject = id; const flow = await start(); const response = await request("/callback/google?code=synthetic-code&state=" + flow.url.searchParams.get("state"), { cookie: flow.cookie }); assert.equal(response.status, 302); assert.ok(new URL(response.headers.get("location"), baseURL).pathname === "/app"); return { cookie: cookies(response), response }; }
async function session(cookie) { return (await request("/get-session", { cookie })).json(); }
async function counts() { const values = []; for (const table of ["user", "account", "session"]) values.push(Number((await pool.query('SELECT COUNT(*) AS n FROM "' + table + '"')).rows[0].n)); return values; }
let signed;
test("OAuth starts at Google with state, PKCE, minimal scopes and no account/session creation", async () => { const before = await counts(), flow = await start(); assert.equal(flow.url.hostname, "accounts.google.com"); assert.ok(flow.url.searchParams.get("state")); assert.equal(flow.url.searchParams.get("code_challenge_method"), "S256"); assert.deepEqual(new Set(flow.url.searchParams.get("scope").split(" ")), new Set(["openid", "email", "profile"])); assert.deepEqual(await counts(), before); assert.equal(providerCalls, 0); });
test("foreign origin is rejected with no provider call or account/session write", async () => { const before = await counts(); const response = await request("/sign-in/social", { method: "POST", origin: "https://attacker.invalid", body: { provider: "google", callbackURL: "/app" } }); assert.equal(response.status, 403); assert.deepEqual(await counts(), before); assert.equal(providerCalls, 0); });
test("foreign callback URL is rejected", async () => { const before = await counts(); const response = await request("/sign-in/social", { method: "POST", body: { provider: "google", callbackURL: "https://attacker.invalid" } }); assert.equal(response.status, 403); assert.deepEqual(await counts(), before); });
test("missing or forged OAuth state cannot create a session", async () => { const before = await counts(); await request("/callback/google?code=forged"); await request("/callback/google?code=forged&state=forged"); assert.deepEqual(await counts(), before); assert.equal(providerCalls, 0); });
test("state from another browser without its matching cookie is rejected", async () => { const before = await counts(), flow = await start(); const response = await request("/callback/google?code=synthetic-code&state=" + flow.url.searchParams.get("state")); assert.equal(response.status, 302); assert.deepEqual(await counts(), before); assert.equal(providerCalls, 0); });
test("cancelled Google consent returns to login without an account/session", async () => { const before = await counts(), flow = await start(); const response = await request("/callback/google?error=access_denied&state=" + flow.url.searchParams.get("state"), { cookie: flow.cookie }); assert.equal(response.status, 302); assert.equal(new URL(response.headers.get("location"), baseURL).pathname, "/login"); assert.deepEqual(await counts(), before); });
test("Google token exchange failure does not authenticate", async () => { const before = await counts(), flow = await start(); tokenFailure = true; try { const response = await request("/callback/google?code=invalid&state=" + flow.url.searchParams.get("state"), { cookie: flow.cookie }); assert.equal(response.status, 302); assert.equal(new URL(response.headers.get("location"), baseURL).pathname, "/login"); assert.deepEqual(await counts(), before); } finally { tokenFailure = false; } });
test("successful stubbed Google exchange persists user, account and HttpOnly session then redirects Home", async () => { signed = await signInAs("google-user-A"); const data = await session(signed.cookie); assert.equal(data.user.email, "google-user-a@example.invalid"); assert.equal(data.user.name, "Synthetic google-user-A"); assert.deepEqual(await counts(), [1, 1, 1]); assert.ok(signed.response.headers.getSetCookie().some((cookie) => /finbridge.session_token=/.test(cookie) && /HttpOnly/i.test(cookie) && /SameSite=Lax/i.test(cookie))); const account = (await pool.query('SELECT "accessToken" FROM "account"')).rows[0]; assert.notEqual(account.accessToken, "synthetic-access-token", "OAuth token must be encrypted at rest"); });
test("returning Google identity reuses its user and account", async () => { const first = await session(signed.cookie), next = await signInAs("google-user-A"); const data = await session(next.cookie); assert.equal(data.user.id, first.user.id); assert.deepEqual((await counts()).slice(0, 2), [1, 1]); });
test("another Google identity has a distinct user", async () => { const a = await session(signed.cookie), b = await signInAs("google-user-B"); assert.notEqual((await session(b.cookie)).user.id, a.user.id); assert.deepEqual((await counts()).slice(0, 2), [2, 2]); });
test("forged session cookie is not accepted", async () => { assert.equal(await session("finbridge.session_token=forged"), null); });
test("expired database session is rejected", async () => { const expiring = await signInAs("google-user-expired"); const data = await session(expiring.cookie); await pool.query('UPDATE "session" SET "expiresAt" = $1 WHERE id = $2', [new Date(0), data.session.id]); assert.equal(await session(expiring.cookie), null); });
test("logout revokes the database session and the old cookie no longer works", async () => { const response = await request("/sign-out", { method: "POST", cookie: signed.cookie, body: {} }); assert.equal(response.status, 200); assert.equal(await session(signed.cookie), null); });
test("missing Origin on a POST is rejected", async () => { const before = await counts(); const response = await request("/sign-in/social", { method: "POST", origin: "", body: { provider: "google", callbackURL: "/app" } }); assert.equal(response.status, 403); assert.deepEqual(await counts(), before); });
test("production rate limiter rejects repeated OAuth starts", async () => { const limited = betterAuth(productionOptions); const statuses = []; for (let i = 0; i < 4; i++) { const response = await handleAuthRequest(limited, new Request(baseURL + "/api/auth/sign-in/social", { method: "POST", headers: { origin: baseURL, "content-type": "application/json" }, body: JSON.stringify({ provider: "google", callbackURL: "/app" }) }), baseURL); statuses.push(response.status); } assert.deepEqual(statuses, [200, 200, 200, 429]); });
const emailBody = { name: "Synthetic Email User", email: "email-user@example.invalid", password: "Synthetic-password-123", callbackURL: "/login?verified=1" };
let emailCookie, emailUser;
test("email sign-up stores a hash and default user role, sends verification and creates no session", async () => {
  const before = await counts();
  const response = await request("/sign-up/email", { method: "POST", body: emailBody });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).token, null);
  const data = (await pool.query('SELECT id, role, "emailVerified" FROM "user" WHERE email = $1', [emailBody.email])).rows[0];
  emailUser = data.id; assert.equal(data.role, "user"); assert.equal(data.emailVerified, false);
  const credential = (await pool.query('SELECT password FROM "account" WHERE "userId" = $1 AND "providerId" = $2', [emailUser, "credential"])).rows[0];
  assert.ok(credential.password); assert.notEqual(credential.password, emailBody.password);
  assert.equal((await counts())[2], before[2]);
  assert.equal(mail.at(-1).kind, "verify"); assert.equal(mail.at(-1).to, emailBody.email);
});
test("unverified email cannot obtain a session, even with the correct password", async () => {
  const before = (await counts())[2];
  const response = await request("/sign-in/email", { method: "POST", body: emailBody });
  assert.equal(response.status, 403); assert.equal((await response.json()).code, "EMAIL_NOT_VERIFIED");
  assert.equal((await counts())[2], before);
});
test("unverified local accounts cannot be implicitly linked to Google", async () => {
  const before = await counts();
  subject = "email-user";
  const flow = await start();
  const response = await request("/callback/google?code=synthetic-code&state=" + flow.url.searchParams.get("state"), { cookie: flow.cookie });
  assert.equal(response.status, 302);
  assert.equal(new URL(response.headers.get("location"), baseURL).pathname, "/login");
  assert.deepEqual(await counts(), before);
});
test("verification link enables email login and uses the same workspace user identity", async () => {
  const link = new URL(mail.find((message) => message.to === emailBody.email && message.kind === "verify").url);
  const verified = await request(link.pathname.replace("/api/auth", "") + link.search);
  assert.equal(verified.status, 302); assert.ok(verified.headers.get("location").includes("/login"));
  const response = await request("/sign-in/email", { method: "POST", body: emailBody });
  assert.equal(response.status, 200); emailCookie = cookies(response);
  const data = await session(emailCookie); assert.equal(data.user.id, emailUser); assert.equal(data.user.role, "user");
});
test("a verified matching Google identity links to the existing user without creating a duplicate", async () => {
  const before = await counts();
  const google = await signInAs("email-user");
  const data = await session(google.cookie);
  assert.equal(data.user.id, emailUser);
  assert.deepEqual(await counts(), [before[0], before[1] + 1, before[2] + 1]);
  const providers = (await pool.query('SELECT "providerId" FROM "account" WHERE "userId" = $1 ORDER BY "providerId"', [emailUser])).rows.map((row) => row.providerId);
  assert.deepEqual(providers, ["credential", "google"]);
});
test("wrong password and unknown email return the same safe code and create no sessions", async () => {
  const before = (await counts())[2], codes = [];
  for (const email of [emailBody.email, "absent@example.invalid"]) {
    const response = await request("/sign-in/email", { method: "POST", body: { email, password: "Wrong-password-123" } });
    assert.equal(response.status, 401); codes.push((await response.json()).code);
  }
  assert.equal(codes[0], codes[1]); assert.equal((await counts())[2], before);
});
test("duplicate signup cannot replace password, identity or account ownership", async () => {
  const before = await counts();
  const response = await request("/sign-up/email", { method: "POST", body: { ...emailBody, password: "Attacker-password-123" } });
  assert.equal(response.status, 200); assert.deepEqual(await counts(), before);
  const login = await request("/sign-in/email", { method: "POST", body: { ...emailBody, password: "Attacker-password-123" } });
  assert.equal(login.status, 401);
});
test("client cannot self-assign admin at signup or update-user", async () => {
  const response = await request("/sign-up/email", { method: "POST", body: { ...emailBody, email: "forged-role@example.invalid", role: "admin", emailVerified: true } });
  assert.ok([200, 400].includes(response.status));
  const row = (await pool.query('SELECT role, "emailVerified" FROM "user" WHERE email = $1', ["forged-role@example.invalid"])).rows[0];
  if (row) { assert.equal(row.role, "user"); assert.equal(row.emailVerified, false); }
  await request("/update-user", { method: "POST", cookie: emailCookie, body: { role: "admin" } });
  assert.equal((await session(emailCookie)).user.role, "user");
});
test("short password and foreign-origin signup are rejected with zero account writes", async () => {
  const before = await counts();
  const short = await request("/sign-up/email", { method: "POST", body: { ...emailBody, email: "short@example.invalid", password: "12345678" } });
  assert.equal(short.status, 400);
  const foreign = await request("/sign-up/email", { method: "POST", origin: "https://attacker.invalid", body: { ...emailBody, email: "foreign@example.invalid" } });
  assert.equal(foreign.status, 403); assert.deepEqual(await counts(), before);
});
test("password-reset request is generic for existing and unknown addresses", async () => {
  const responses = [];
  for (const email of [emailBody.email, "absent@example.invalid"]) {
    const response = await request("/request-password-reset", { method: "POST", body: { email, redirectTo: "/reset-password" } });
    assert.equal(response.status, 200); responses.push(await response.json());
  }
  assert.deepEqual(responses[0], responses[1]); assert.equal(mail.at(-1).kind, "reset");
});
test("reset link changes the password, revokes sessions and cannot be replayed", async () => {
  const link = new URL(mail.at(-1).url);
  const callback = await request(link.pathname.replace("/api/auth", "") + link.search);
  assert.equal(callback.status, 302);
  const token = new URL(callback.headers.get("location")).searchParams.get("token");
  const body = { token, newPassword: "New-synthetic-password-456" };
  assert.equal((await request("/reset-password", { method: "POST", body })).status, 200);
  assert.equal(await session(emailCookie), null);
  assert.equal((await request("/reset-password", { method: "POST", body })).status, 400);
  assert.equal((await request("/sign-in/email", { method: "POST", body: emailBody })).status, 401);
  assert.equal((await request("/sign-in/email", { method: "POST", body: { ...emailBody, password: body.newPassword } })).status, 200);
});
test("forged and expired reset tokens do not change a password or create sessions", async () => {
  await request("/request-password-reset", { method: "POST", body: { email: emailBody.email, redirectTo: "/reset-password" } });
  const token = new URL(mail.at(-1).url).pathname.split("/").at(-1);
  await pool.query('UPDATE "verification" SET "expiresAt" = $1 WHERE identifier = $2', [new Date(0), "reset-password:" + token]);
  const before = await counts();
  const previous = (await pool.query('SELECT password FROM "account" WHERE "userId" = $1 AND "providerId" = $2', [emailUser, "credential"])).rows[0].password;
  for (const value of ["forged-token", token]) assert.equal((await request("/reset-password", { method: "POST", body: { token: value, newPassword: "Forged-password-123" } })).status, 400);
  assert.deepEqual(await counts(), before);
  assert.equal((await pool.query('SELECT password FROM "account" WHERE "userId" = $1 AND "providerId" = $2', [emailUser, "credential"])).rows[0].password, previous);
});
test("a Google-only account can add a password only through a valid email reset, preserving its user id", async () => {
  const email = "google-user-a@example.invalid";
  const before = (await pool.query('SELECT id FROM "user" WHERE email = $1', [email])).rows[0].id;
  await request("/request-password-reset", { method: "POST", body: { email, redirectTo: "/reset-password" } });
  const token = new URL(mail.at(-1).url).pathname.split("/").at(-1);
  const password = "Google-owner-password-123";
  assert.equal((await request("/reset-password", { method: "POST", body: { token, newPassword: password } })).status, 200);
  const login = await request("/sign-in/email", { method: "POST", body: { email, password } });
  assert.equal(login.status, 200); assert.equal((await session(cookies(login))).user.id, before);
});
test("mail-unconfigured server disables signup and reset while retaining verified email login", async () => {
  const unavailable = betterAuth({ ...buildAuthOptions(config, pool), rateLimit: { enabled: false } });
  const send = (path, body) => handleAuthRequest(unavailable, new Request(baseURL + "/api/auth" + path, { method: "POST", headers: { origin: baseURL, "content-type": "application/json" }, body: JSON.stringify(body) }), baseURL);
  const before = await counts();
  assert.notEqual((await send("/sign-up/email", { ...emailBody, email: "unavailable@example.invalid" })).status, 200);
  assert.notEqual((await send("/request-password-reset", { email: emailBody.email })).status, 200);
  assert.deepEqual(await counts(), before);
  assert.equal((await send("/sign-in/email", { ...emailBody, password: "New-synthetic-password-456" })).status, 200);
});
test("SMTP failure creates no authenticated session", async () => {
  const before = (await counts())[2]; mailFailure = true;
  // Better Auth intentionally keeps the signup response generic even on delivery failure.
  try { assert.equal((await request("/sign-up/email", { method: "POST", body: { ...emailBody, email: "mail-failure@example.invalid" } })).status, 200); }
  finally { mailFailure = false; }
  assert.equal((await counts())[2], before);
  assert.equal((await pool.query('SELECT "emailVerified" FROM "user" WHERE email = $1', ["mail-failure@example.invalid"])).rows[0].emailVerified, false);
  assert.equal((await request("/sign-in/email", { method: "POST", body: { email: "mail-failure@example.invalid", password: emailBody.password } })).status, 403);
  assert.equal((await request("/send-verification-email", { method: "POST", body: { email: "mail-failure@example.invalid", callbackURL: "/login" } })).status, 200);
  assert.equal(mail.at(-1).to, "mail-failure@example.invalid");
});

test("unverified duplicate signup sends no additional mail; explicit resend recovers verification", async () => {
  const body = { ...emailBody, email: "resend-user@example.invalid" };
  assert.equal((await request("/sign-up/email", { method: "POST", body })).status, 200);
  const sent = mail.length, before = await counts();
  assert.equal((await request("/sign-up/email", { method: "POST", body })).status, 200);
  assert.equal(mail.length, sent); assert.deepEqual(await counts(), before);
  assert.equal((await request("/send-verification-email", { method: "POST", body: { email: body.email, callbackURL: "/login?lang=vi&verified=1" } })).status, 200);
  assert.equal(mail.length, sent + 1); assert.equal(mail.at(-1).to, body.email);
});

test("deletion requires authentication and trusted origin; stale Google session is rejected", async () => {
  const before = await counts();
  assert.equal((await request("/delete-user", { method: "POST", body: {} })).status, 401);
  assert.deepEqual(await counts(), before);
  const user = await signInAs("delete-google");
  const data = await session(user.cookie);
  const protectedCounts = await counts();
  assert.equal((await request("/delete-user", { method: "POST", cookie: user.cookie, origin: "https://attacker.invalid", body: {} })).status, 403);
  assert.deepEqual(await counts(), protectedCounts);
  await pool.query('UPDATE "session" SET "createdAt" = $1 WHERE id = $2', [new Date(Date.now() - 360000), data.session.id]);
  const refused = await request("/delete-user", { method: "POST", cookie: user.cookie, body: {} });
  assert.equal(refused.status, 400); assert.equal((await refused.json()).code, "SESSION_EXPIRED");
  assert.deepEqual(await counts(), protectedCounts);
});

test("fresh Google deletion removes only its own identity and revokes all of its sessions", async () => {
  const prior = await counts(), user = await signInAs("delete-google");
  const data = await session(user.cookie);
  const other = (await pool.query('SELECT id FROM "user" WHERE email = $1', [emailBody.email])).rows[0].id;
  const response = await request("/delete-user", { method: "POST", cookie: user.cookie, body: { userId: other } });
  assert.equal(response.status, 200); assert.equal((await response.json()).message, "User deleted");
  assert.equal(await session(user.cookie), null);
  for (const table of ["session", "account"]) assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM "' + table + '" WHERE "userId" = $1', [data.user.id])).rows[0].n), 0);
  assert.equal((await pool.query('SELECT id FROM "user" WHERE id = $1', [other])).rowCount, 1);
  assert.equal((await counts())[0], prior[0] - 1);
});

test("email deletion checks the password, removes server setup, and allows signup with the same email", async () => {
  const body = { ...emailBody, email: "delete-email@example.invalid" };
  await request("/sign-up/email", { method: "POST", body });
  const link = new URL(mail.at(-1).url); await request(link.pathname.replace("/api/auth", "") + link.search);
  const login = await request("/sign-in/email", { method: "POST", body });
  const cookie = cookies(login), data = await session(cookie);
  await pool.query('CREATE TABLE IF NOT EXISTS finbridge_onboarding (user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE, data JSONB NOT NULL, completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  await pool.query("INSERT INTO finbridge_onboarding (user_id, data) VALUES ($1, $2)", [data.user.id, JSON.stringify({ synthetic: true })]);
  await pool.query('UPDATE "session" SET "createdAt" = $1 WHERE id = $2', [new Date(Date.now() - 360000), data.session.id]);
  const before = await counts();
  assert.equal((await request("/delete-user", { method: "POST", cookie, body: { password: "Wrong-password-123" } })).status, 400);
  assert.deepEqual(await counts(), before);
  assert.equal((await request("/delete-user", { method: "POST", cookie, body: { password: body.password } })).status, 200);
  assert.equal(await session(cookie), null);
  assert.equal((await pool.query('SELECT id FROM "user" WHERE id = $1', [data.user.id])).rowCount, 0);
  assert.equal((await pool.query('SELECT user_id FROM finbridge_onboarding WHERE user_id = $1', [data.user.id])).rowCount, 0);
  const sent = mail.length;
  assert.equal((await request("/sign-up/email", { method: "POST", body })).status, 200);
  assert.equal(mail.length, sent + 1);
  assert.notEqual((await pool.query('SELECT id FROM "user" WHERE email = $1', [body.email])).rows[0].id, data.user.id);
});

test("reset link for a deleted account cannot change a replacement account with the same email", async () => {
  const body = { ...emailBody, email: "replacement-reset@example.invalid" };
  await request("/sign-up/email", { method: "POST", body });
  const verify = new URL(mail.at(-1).url); await request(verify.pathname.replace("/api/auth", "") + verify.search);
  const login = await request("/sign-in/email", { method: "POST", body });
  await request("/request-password-reset", { method: "POST", body: { email: body.email, redirectTo: "/reset-password?lang=vi" } });
  const oldToken = new URL(mail.at(-1).url).pathname.split("/").at(-1);
  assert.equal((await request("/delete-user", { method: "POST", cookie: cookies(login), body: {} })).status, 200);
  await request("/sign-up/email", { method: "POST", body });
  const oldAttempt = await request("/reset-password", { method: "POST", body: { token: oldToken, newPassword: "Invalid-old-link-password-789" } });
  assert.equal(oldAttempt.status, 400);
  assert.ok(["INVALID_TOKEN", "USER_NOT_FOUND"].includes((await oldAttempt.json()).code));
  await request("/request-password-reset", { method: "POST", body: { email: body.email, redirectTo: "/reset-password?lang=vi" } });
  const newToken = new URL(mail.at(-1).url).pathname.split("/").at(-1);
  assert.equal((await request("/reset-password", { method: "POST", body: { token: newToken, newPassword: "Fresh-link-password-456" } })).status, 200);
});

async function verifiedEmailFixture(email) {
  const body = { name: "Synthetic acceptance user", email, password: "Synthetic-password-123", callbackURL: "/login" };
  assert.equal((await request("/sign-up/email", { method: "POST", body })).status, 200);
  const link = new URL(mail.at(-1).url);
  assert.equal((await request(link.pathname.replace("/api/auth", "") + link.search)).status, 302);
  const login = await request("/sign-in/email", { method: "POST", body });
  assert.equal(login.status, 200);
  return { body, cookie: cookies(login) };
}

test("logout revokes only the current session while another device remains signed in", async () => {
  const fixture = await verifiedEmailFixture("multi-device-logout@example.invalid");
  const second = await request("/sign-in/email", { method: "POST", body: fixture.body });
  const secondCookie = cookies(second);
  assert.notEqual((await session(fixture.cookie)).session.id, (await session(secondCookie)).session.id);
  assert.equal((await request("/sign-out", { method: "POST", cookie: fixture.cookie, body: {} })).status, 200);
  assert.equal(await session(fixture.cookie), null);
  assert.equal((await session(secondCookie)).user.email, fixture.body.email);
});

test("password reset revokes sessions on every device and preserves the user identity", async () => {
  const fixture = await verifiedEmailFixture("multi-device-reset@example.invalid");
  const first = await session(fixture.cookie);
  const second = await request("/sign-in/email", { method: "POST", body: fixture.body });
  const secondCookie = cookies(second);
  await request("/request-password-reset", { method: "POST", body: { email: fixture.body.email, redirectTo: "/reset-password?lang=vi" } });
  const link = new URL(mail.at(-1).url), callback = await request(link.pathname.replace("/api/auth", "") + link.search);
  const token = new URL(callback.headers.get("location")).searchParams.get("token");
  assert.equal((await request("/reset-password", { method: "POST", body: { token, newPassword: "New-synthetic-password-456" } })).status, 200);
  assert.equal(await session(fixture.cookie), null); assert.equal(await session(secondCookie), null);
  const login = await request("/sign-in/email", { method: "POST", body: { ...fixture.body, password: "New-synthetic-password-456" } });
  assert.equal(login.status, 200); assert.equal((await session(cookies(login))).user.id, first.user.id);
});

test("two concurrent saves using one reset token yield one success and one rejection", async () => {
  const fixture = await verifiedEmailFixture("concurrent-reset@example.invalid");
  await request("/request-password-reset", { method: "POST", body: { email: fixture.body.email, redirectTo: "/reset-password" } });
  const token = new URL(mail.at(-1).url).pathname.split("/").at(-1);
  const passwords = ["Concurrent-password-A-123", "Concurrent-password-B-456"];
  const responses = await Promise.all(passwords.map(newPassword => request("/reset-password", { method: "POST", body: { token, newPassword } })));
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 400]);
  const winner = responses.findIndex(r => r.status === 200), loser = 1 - winner;
  assert.equal((await request("/sign-in/email", { method: "POST", body: { ...fixture.body, password: passwords[winner] } })).status, 200);
  assert.equal((await request("/sign-in/email", { method: "POST", body: { ...fixture.body, password: passwords[loser] } })).status, 401);
});

test("expired verification links and forged tokens cannot activate an account", async () => {
  const email = "expired-verification@example.invalid";
  await request("/sign-up/email", { method: "POST", body: { ...emailBody, email } });
  const expired = await new SignJWT({ email }).setProtectedHeader({ alg: "HS256" }).setIssuedAt(Math.floor(Date.now()/1000)-7200).setExpirationTime(Math.floor(Date.now()/1000)-3600).sign(new TextEncoder().encode(config.secret));
  for (const token of ["forged", expired]) {
    const response = await request("/verify-email?token=" + token);
    assert.notEqual(response.status, 200);
    assert.equal((await pool.query('SELECT "emailVerified" FROM "user" WHERE email=$1', [email])).rows[0].emailVerified, false);
  }
});

test("foreign recovery and verification redirects are rejected without sending mail", async () => {
  const sent = mail.length, before = await counts();
  for (const [path, body] of [
    ["/request-password-reset", { email: emailBody.email, redirectTo: "https://attacker.invalid/reset" }],
    ["/send-verification-email", { email: emailBody.email, callbackURL: "https://attacker.invalid/verify" }],
  ]) assert.equal((await request(path, { method: "POST", body })).status, 403);
  assert.equal(mail.length, sent); assert.deepEqual(await counts(), before);
});

test("email login and recovery rate limits reject bursts for a stable client address", async () => {
  const limited = betterAuth(productionOptions);
  const send = (path, body) => handleAuthRequest(limited, new Request(baseURL + "/api/auth" + path, { method: "POST", headers: { origin: baseURL, "content-type": "application/json", "x-forwarded-for": "192.0.2.80" }, body: JSON.stringify(body) }), baseURL);
  for (const [path, body, allowedStatus] of [
    ["/sign-in/email", { email: "unknown-limit@example.invalid", password: "Wrong-password-123" }, 401],
    ["/request-password-reset", { email: "unknown-limit@example.invalid", redirectTo: "/reset-password" }, 200],
  ]) {
    const statuses = [];
    for (let i=0; i<4; i++) statuses.push((await send(path, body)).status);
    assert.deepEqual(statuses, [allowedStatus, allowedStatus, allowedStatus, 429]);
  }
});

test("disabling Google account linking still prevents access to an existing verified email account", async () => {
  const body = { ...emailBody, email: "linking-disabled@example.invalid" };
  assert.equal((await request("/sign-up/email", { method: "POST", body })).status, 200);
  const verify = new URL(mail.find((message) => message.to === body.email && message.kind === "verify").url);
  assert.equal((await request(verify.pathname.replace("/api/auth", "") + verify.search)).status, 302);
  const before = await counts();
  const linkingDisabled = betterAuth({ ...productionOptions, rateLimit: { enabled: false }, account: { ...productionOptions.account, accountLinking: { enabled: false } } });
  const disabledRequest = (path, { method = "GET", cookie = "", body: requestBody } = {}) => handleAuthRequest(linkingDisabled, new Request(baseURL + "/api/auth" + path, { method, headers: { origin: baseURL, ...(cookie ? { cookie } : {}), ...(requestBody ? { "content-type": "application/json" } : {}) }, ...(requestBody ? { body: JSON.stringify(requestBody) } : {}) }), baseURL);
  subject = "linking-disabled";
  const started = await disabledRequest("/sign-in/social", { method: "POST", body: { provider: "google", callbackURL: "/app", errorCallbackURL: "/login?error=oauth" } });
  const state = new URL((await started.json()).url).searchParams.get("state");
  const response = await disabledRequest("/callback/google?code=synthetic-code&state=" + state, { cookie: cookies(started) });
  assert.equal(response.status, 302);
  assert.equal(new URL(response.headers.get("location"), baseURL).pathname, "/login");
  assert.deepEqual(await counts(), before);
  assert.equal(await session(cookies(response)), null);
  const login = await request("/sign-in/email", { method: "POST", body: { ...body, password: emailBody.password } });
  assert.equal(login.status, 200);
});

after(async () => { globalThis.fetch = originalFetch; for (const table of tables) await pool.query('DELETE FROM "' + table + '"'); await pool.end(); });
