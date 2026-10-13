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
test("verification link enables email login and uses the same workspace user identity", async () => {
  const link = new URL(mail.find((message) => message.to === emailBody.email && message.kind === "verify").url);
  const verified = await request(link.pathname.replace("/api/auth", "") + link.search);
  assert.equal(verified.status, 302); assert.ok(verified.headers.get("location").includes("/login"));
  const response = await request("/sign-in/email", { method: "POST", body: emailBody });
  assert.equal(response.status, 200); emailCookie = cookies(response);
  const data = await session(emailCookie); assert.equal(data.user.id, emailUser); assert.equal(data.user.role, "user");
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

after(async () => { globalThis.fetch = originalFetch; for (const table of tables) await pool.query('DELETE FROM "' + table + '"'); await pool.end(); });
