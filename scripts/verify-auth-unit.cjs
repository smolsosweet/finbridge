const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
function compile(relative, resolve = require) {
  const source = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, "../", relative), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const result = { exports: {} };
  new Function("require", "module", "exports", source)(resolve, result, result.exports);
  return result.exports;
}
const storage = compile("src/lib/workspace-storage.ts");
const config = compile("src/lib/auth-config.ts");
const copy = compile("src/lib/auth-copy.ts");
const languagePreference = compile("src/lib/language-preference.ts");
const mail = compile("src/lib/auth-mail.ts");
test("account deactivation clears only the closed owner's local data after server confirmation", async () => {
  const previousStorage = global.localStorage, previousFetch = global.fetch;
  const entries = new Map([[storage.userWorkspaceKey("A"), "A-data"], [storage.userWorkspaceKey("B"), "B-data"], [storage.LEGACY_WORKSPACE_KEY, "legacy"], ["finbridge-setup-draft:A", "A-draft"]]);
  let owner = "A", cleared = false, requests = 0, signedOut = 0, response = new Response(JSON.stringify({ code: "RECENT_LOGIN_REQUIRED" }), { status: 403 });
  global.localStorage = { removeItem: key => entries.delete(key) };
  global.fetch = async (url, options) => { requests++; assert.equal(url, "/api/account/deactivate"); assert.equal(options.method, "POST"); return response; };
  const helper = compile("src/lib/deactivate-account.ts", name => {
    if (name === "./auth-client") return { authClient: { async signOut() { signedOut++; } } };
    if (name === "./workspace-storage") return storage;
    if (name === "@/components/sites/rolly/replica/store") return { flushWorkspace: async () => {}, workspaceOwner: () => owner, clearUserWorkspace: id => { assert.equal(id, "A"); cleared = true; } };
    return require(name);
  });
  try {
    await assert.rejects(() => helper.deactivateAccount("B")); assert.equal(requests, 0);
    await assert.rejects(() => helper.deactivateAccount("A"), /RECENT_LOGIN_REQUIRED/); assert.equal(cleared, false); assert.equal(entries.get(storage.userWorkspaceKey("A")), "A-data");
    response = new Response(JSON.stringify({ success: true }), { status: 200 });
    await helper.deactivateAccount("A"); assert.equal(cleared, true); assert.equal(signedOut, 1); assert.equal(entries.has(storage.userWorkspaceKey("A")), false); assert.equal(entries.has("finbridge-setup-draft:A"), false);
    assert.equal(entries.get(storage.userWorkspaceKey("B")), "B-data"); assert.equal(entries.get(storage.LEGACY_WORKSPACE_KEY), "legacy");
  } finally { global.localStorage = previousStorage; global.fetch = previousFetch; }
});
test("Brevo requires a key and a verified-sender address shape; unknown modes are rejected", () => {
  assert.throws(() => mail.readMailConfig({ AUTH_EMAIL_MODE: "brevo" }));
  assert.throws(() => mail.readMailConfig({ AUTH_EMAIL_MODE: "unknown" }));
  assert.throws(() => mail.readMailConfig({ AUTH_EMAIL_MODE: "brevo", BREVO_API_KEY: "synthetic", AUTH_EMAIL_FROM: "sender\r\n@example.invalid" }));
  assert.equal(mail.readMailConfig({ AUTH_EMAIL_MODE: "brevo", BREVO_API_KEY: "synthetic", AUTH_EMAIL_FROM: "sender@example.invalid" }).mode, "brevo");
});
test("Brevo sends only a transactional message over HTTPS and rejects provider errors without retry", async () => {
  const originalFetch = global.fetch, originalConsoleError = console.error; let requests = 0;
  const diagnostics = [];
  const sender = mail.createMailSender({ AUTH_EMAIL_MODE: "brevo", BREVO_API_KEY: "synthetic-only", AUTH_EMAIL_FROM: "sender@example.invalid" });
  try {
    console.error = (...args) => diagnostics.push(args);
    global.fetch = async (url, options) => {
      requests++; assert.equal(url, "https://api.brevo.com/v3/smtp/email"); assert.equal(options.method, "POST"); assert.equal(options.redirect, "error");
      assert.equal(options.headers["api-key"], "synthetic-only");
      const body = JSON.parse(options.body);
      assert.deepEqual(body.to, [{ email: "recipient@example.invalid" }]);
      assert.equal(body.sender.email, "sender@example.invalid"); assert.ok(body.textContent.includes("https://finbridge.example/verify"));
      assert.match(body.htmlContent, /Verify your email address/); assert.match(body.htmlContent, /Verify email/);
      assert.match(body.htmlContent, /href="https:\/\/finbridge\.example\/verify"/);
      assert.equal(body.subject, "Verify your FinBridge email"); return new Response(null, { status: requests === 1 ? 201 : 429 });
    };
    const message = { to: "recipient@example.invalid", kind: "verify", url: "https://finbridge.example/verify" };
    await sender(message); await assert.rejects(() => sender(message), /AUTH_EMAIL_DELIVERY_FAILED/); assert.equal(requests, 2);
    assert.deepEqual(diagnostics, [["AUTH_MAIL_BREVO_DELIVERY_FAILED", { provider: "brevo", status: 429, retryAfter: null }]]);
    assert.doesNotMatch(JSON.stringify(diagnostics), /synthetic-only|recipient@example\.invalid|finbridge\.example/);
  } finally { global.fetch = originalFetch; console.error = originalConsoleError; }
});
test("authentication email gives a usable action, expiry and safe fallback link", () => {
  const verify = mail.renderAuthEmail({ kind: "verify", url: "https://finbridge.example/verify?token=a&next=b" });
  assert.match(verify.text, /expires in 1 hour/); assert.match(verify.html, /Verify your email address/);
  assert.match(verify.html, /token=a&amp;next=b/); assert.match(verify.html, /Never share this link/);
  const vietnamese = mail.renderAuthEmail({ kind: "verify", url: "https://finbridge.example/verify?callbackURL=%2Flogin%3Flang%3Dvi" });
  assert.equal(vietnamese.subject, "Xác minh email FinBridge của bạn"); assert.match(vietnamese.html, /Xác minh địa chỉ email/);
  const reset = mail.renderAuthEmail({ kind: "reset", url: "https://finbridge.example/reset" });
  assert.match(reset.text, /expires in 30 minutes/); assert.match(reset.html, /Reset your password/);
});
test("local auth mail is blocked in production and on non-local origins", () => {
  assert.equal(mail.readMailConfig({}), null);
  assert.equal(mail.readMailConfig({ AUTH_EMAIL_MODE: "local", NODE_ENV: "development", BETTER_AUTH_URL: "http://localhost:3011" }).mode, "local");
  assert.throws(() => mail.readMailConfig({ AUTH_EMAIL_MODE: "local", NODE_ENV: "production", BETTER_AUTH_URL: "https://finbridge.example" }));
  assert.throws(() => mail.readMailConfig({ AUTH_EMAIL_MODE: "local", NODE_ENV: "development", BETTER_AUTH_URL: "https://remote.example" }));
});
test("SMTP rejects incomplete, cleartext and injected sender settings", () => {
  const smtp = { SMTP_HOST: "smtp.example.invalid", SMTP_USER: "fixture", SMTP_PASSWORD: "synthetic", SMTP_FROM: "FinBridge <mail@example.invalid>" };
  assert.equal(mail.readMailConfig(smtp).port, 587);
  assert.equal(mail.readMailConfig({ ...smtp, SMTP_PORT: "465" }).port, 465);
  assert.throws(() => mail.readMailConfig({ ...smtp, SMTP_PASSWORD: "" }));
  assert.throws(() => mail.readMailConfig({ ...smtp, SMTP_PORT: "25" }));
  assert.throws(() => mail.readMailConfig({ ...smtp, SMTP_FROM: "fake\r\nBcc: attacker@example.invalid" }));
});
const legacy = JSON.stringify({ wallets: [{ id: "bank", currency: "VND", initial: 1000000 }], transactions: [{ amount: 200000, wallet: "bank" }], settings: { name: "Old name" } });
function fixture() { const records = new Map([[storage.LEGACY_WORKSPACE_KEY, legacy]]); return { records, getItem: (key) => records.get(key) || null, setItem: (key, value) => records.set(key, value) }; }
test("legacy bytes remain accessible for backup; never auto-loaded for a new account", () => { const s = fixture(); assert.equal(storage.legacyWorkspaceBackup(s), legacy); assert.equal(storage.readUserWorkspace(s, "new-user"), null); assert.equal(s.records.size, 1); });
test("legacy copy requires an explicit user choice and writes nothing otherwise", () => { const s = fixture(); assert.throws(() => storage.importLegacyWorkspace(s, "A", false)); assert.equal(s.records.size, 1); });
test("explicit copy preserves original bytes and all transactions", () => { const s = fixture(); storage.importLegacyWorkspace(s, "A", true); assert.equal(s.getItem(storage.LEGACY_WORKSPACE_KEY), legacy); assert.equal(s.getItem(storage.userWorkspaceKey("A")), legacy); assert.deepEqual(storage.readUserWorkspace(s, "A").transactions, JSON.parse(legacy).transactions); });
test("copy cannot overwrite an account that already has data", () => { const s = fixture(); s.setItem(storage.userWorkspaceKey("A"), "existing data"); assert.throws(() => storage.importLegacyWorkspace(s, "A", true)); assert.equal(s.getItem(storage.userWorkspaceKey("A")), "existing data"); assert.equal(s.getItem(storage.LEGACY_WORKSPACE_KEY), legacy); });
test("account B does not load account A financial data", () => { const s = fixture(); storage.importLegacyWorkspace(s, "A", true); assert.equal(storage.readUserWorkspace(s, "B"), null); assert.notEqual(storage.userWorkspaceKey("A"), storage.userWorkspaceKey("B")); });
test("invalid local data and empty owner never become a workspace", () => { const s = fixture(); s.setItem(storage.LEGACY_WORKSPACE_KEY, "{broken"); assert.equal(storage.legacyWorkspaceBackup(s), null); assert.throws(() => storage.userWorkspaceKey(" ")); });
const env = { BETTER_AUTH_URL: "http://localhost:3011", BETTER_AUTH_SECRET: "x".repeat(48), GOOGLE_CLIENT_ID: "synthetic", GOOGLE_CLIENT_SECRET: "synthetic", DATABASE_URL: "postgresql://fixture", NODE_ENV: "development" };
test("auth is unavailable when any required configuration is absent", () => { for (const key of ["BETTER_AUTH_URL", "BETTER_AUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "DATABASE_URL"]) assert.equal(config.readAuthConfig({ ...env, [key]: "" }), null); });
test("production requires a canonical HTTPS origin and a strong-length secret", () => { assert.throws(() => config.readAuthConfig({ ...env, NODE_ENV: "production" })); assert.throws(() => config.readAuthConfig({ ...env, BETTER_AUTH_URL: "https://example.com/evil?next=x" })); assert.throws(() => config.readAuthConfig({ ...env, BETTER_AUTH_SECRET: "weak" })); assert.equal(config.readAuthConfig({ ...env, NODE_ENV: "production", BETTER_AUTH_URL: "https://example.com" }).baseURL, "https://example.com"); });
test("welcome defaults to English and identifies Finn in all three languages", () => { assert.equal(copy.authLanguage(undefined), "en"); assert.equal(copy.authLanguage("forged"), "en"); for (const language of ["en", "vi", "zh"]) { assert.ok(copy.AUTH_COPY[language].greeting.includes("Finn")); assert.ok(copy.AUTH_COPY[language].google.includes("Google")); } });
test("display language preference is normalized, stored locally and mapped for the workspace", () => {
  const previousStorage = global.localStorage, records = new Map();
  global.localStorage = { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
  try {
    assert.equal(languagePreference.readPreferredLanguage(), "en");
    assert.equal(languagePreference.rememberPreferredLanguage("Tiếng Việt"), "vi");
    assert.equal(languagePreference.readPreferredLanguage(), "vi");
    assert.equal(languagePreference.preferredLanguage("中文"), "zh");
    assert.equal(languagePreference.workspaceLanguage("zh"), "中文");
  } finally { global.localStorage = previousStorage; }
});
test("actual store partitions accounts, clears memory on logout, and preserves saved records", () => {
  const s = fixture(), previousWindow = global.window, previousStorage = global.localStorage;
  global.window = new EventTarget(); global.localStorage = s;
  try {
    const store = compile("src/components/sites/rolly/replica/store.ts", (name) => name === "@/lib/workspace-storage" ? storage : name === "@/lib/language-preference" ? languagePreference : name === "react" ? { useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot() } : require(name));
    assert.throws(() => store.updateState((state) => state));
    languagePreference.rememberPreferredLanguage("zh");
    store.activateUserWorkspace("A", "Google A");
    assert.equal(store.useAppState().settings.language, "中文");
    store.setSetting("language", "Tiếng Việt");
    assert.equal(languagePreference.readPreferredLanguage(), "vi");
    assert.equal(store.useAppState().transactions.length, 0);
    store.updateState((state) => ({ ...state, transactions: [{ id: "A-only", amount: 123 }] }));
    const savedA = s.getItem(storage.userWorkspaceKey("A"));
    store.activateUserWorkspace("B", "Google B");
    assert.equal(store.useAppState().transactions.length, 0);
    assert.equal(store.useAppState().settings.name, "Google B");
    store.clearUserWorkspace("A"); assert.equal(store.workspaceOwner(), "B", "stale cleanup cannot clear another account");
    store.clearUserWorkspace(); assert.equal(store.workspaceOwner(), null);
    assert.equal(s.getItem(storage.userWorkspaceKey("A")), savedA);
    assert.equal(s.getItem(storage.LEGACY_WORKSPACE_KEY), legacy);
    languagePreference.rememberPreferredLanguage("zh");
    store.activateUserWorkspace("A", "Google A");
    assert.equal(store.useAppState().transactions[0].id, "A-only");
    assert.equal(store.useAppState().settings.language, "中文", "the browser language choice overrides an older per-account setting");
  } finally { global.window = previousWindow; global.localStorage = previousStorage; }
});
test("actual store imports only after choice and retains the legacy backup", () => {
  const s = fixture(), previousWindow = global.window, previousStorage = global.localStorage;
  global.window = new EventTarget(); global.localStorage = s;
  try {
    const store = compile("src/components/sites/rolly/replica/store.ts", (name) => name === "@/lib/workspace-storage" ? storage : name === "@/lib/language-preference" ? languagePreference : name === "react" ? { useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot() } : require(name));
    store.activateUserWorkspace("A", "Google A"); assert.throws(() => store.importOldWorkspace(false));
    assert.equal(store.useAppState().transactions.length, 0);
    store.importOldWorkspace(true); assert.equal(store.useAppState().transactions.length, 1);
    assert.equal(s.getItem(storage.LEGACY_WORKSPACE_KEY), legacy);
    assert.throws(() => store.importOldWorkspace(true));
  } finally { global.window = previousWindow; global.localStorage = previousStorage; }
});
test("default category arrays do not leak across accounts", () => {
  const s = fixture(), previousWindow = global.window, previousStorage = global.localStorage;
  global.window = new EventTarget(); global.localStorage = s;
  try {
    const store = compile("src/components/sites/rolly/replica/store.ts", (name) => name === "@/lib/workspace-storage" ? storage : name === "@/lib/language-preference" ? languagePreference : name === "react" ? { useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot() } : require(name));
    store.activateUserWorkspace("A", "A"); store.useAppState().categories.push("A-only");
    store.activateUserWorkspace("B", "B"); assert.ok(!store.useAppState().categories.includes("A-only"));
  } finally { global.window = previousWindow; global.localStorage = previousStorage; }
});
