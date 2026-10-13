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
test("welcome defaults to English and identifies Jack in all three languages", () => { assert.equal(copy.authLanguage(undefined), "en"); assert.equal(copy.authLanguage("forged"), "en"); for (const language of ["en", "vi", "zh"]) { assert.ok(copy.AUTH_COPY[language].greeting.includes("Jack")); assert.ok(copy.AUTH_COPY[language].google.includes("Google")); } });
test("actual store partitions accounts, clears memory on logout, and preserves saved records", () => {
  const s = fixture(), previousWindow = global.window, previousStorage = global.localStorage;
  global.window = {}; global.localStorage = s;
  try {
    const store = compile("src/components/sites/rolly/replica/store.ts", (name) => name === "@/lib/workspace-storage" ? storage : name === "react" ? { useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot() } : require(name));
    assert.throws(() => store.updateState((state) => state));
    store.activateUserWorkspace("A", "Google A");
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
    store.activateUserWorkspace("A", "Google A"); assert.equal(store.useAppState().transactions[0].id, "A-only");
  } finally { global.window = previousWindow; global.localStorage = previousStorage; }
});
test("actual store imports only after choice and retains the legacy backup", () => {
  const s = fixture(), previousWindow = global.window, previousStorage = global.localStorage;
  global.window = {}; global.localStorage = s;
  try {
    const store = compile("src/components/sites/rolly/replica/store.ts", (name) => name === "@/lib/workspace-storage" ? storage : name === "react" ? { useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot() } : require(name));
    store.activateUserWorkspace("A", "Google A"); assert.throws(() => store.importOldWorkspace(false));
    assert.equal(store.useAppState().transactions.length, 0);
    store.importOldWorkspace(true); assert.equal(store.useAppState().transactions.length, 1);
    assert.equal(s.getItem(storage.LEGACY_WORKSPACE_KEY), legacy);
    assert.throws(() => store.importOldWorkspace(true));
  } finally { global.window = previousWindow; global.localStorage = previousStorage; }
});
test("default category arrays do not leak across accounts", () => {
  const s = fixture(), previousWindow = global.window, previousStorage = global.localStorage;
  global.window = {}; global.localStorage = s;
  try {
    const store = compile("src/components/sites/rolly/replica/store.ts", (name) => name === "@/lib/workspace-storage" ? storage : name === "react" ? { useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot() } : require(name));
    store.activateUserWorkspace("A", "A"); store.useAppState().categories.push("A-only");
    store.activateUserWorkspace("B", "B"); assert.ok(!store.useAppState().categories.includes("A-only"));
  } finally { global.window = previousWindow; global.localStorage = previousStorage; }
});