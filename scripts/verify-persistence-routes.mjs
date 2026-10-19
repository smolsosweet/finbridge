// Real route exports, with session/database adapters replaced; never opens a database or provider connection.
import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
const fixture = globalThis.__finbridgePersistenceTest = { session: { user: { id: "a" } }, memoryCalls: 0, sessionFailure: false, databaseFailure: true };
const stubs = {
  "@/lib/auth-session": `export async function getSession(){const f=globalThis.__finbridgePersistenceTest;if(f.sessionFailure)throw Error('private auth detail');return f.session;}`,
  "@/lib/database": `export function database(){if(globalThis.__finbridgePersistenceTest.databaseFailure)throw Error('private database detail');return {connect:async()=>{throw Error('private pool detail');}};}`,
};
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (stubs[specifier]) return { url: "finbridge-persistence-test:" + specifier, shortCircuit: true };
    if (specifier.startsWith("@/")) return { url: pathToFileURL(path.join(root, specifier.slice(2)) + ".ts").href, shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const candidate = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
      if (existsSync(candidate + ".ts")) return { url: pathToFileURL(candidate + ".ts").href, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith("finbridge-persistence-test:")) return { source: stubs[url.slice("finbridge-persistence-test:".length)], format: "module", shortCircuit: true };
    // Shared transfer services import the same DB adapter by a relative path.
    // Keep that import isolated too; never load the real production DB module.
    if (url === pathToFileURL(path.join(root, "lib/database.ts")).href) return { source: stubs["@/lib/database"], format: "module", shortCircuit: true };
    return next(url, context);
  },
});
const saved = Object.fromEntries(["NODE_ENV", "FINBRIDGE_DEMO_MODE", "BETTER_AUTH_URL"].map(k => [k, process.env[k]]));
process.env.BETTER_AUTH_URL = "http://localhost:3000";
const routes = await Promise.all(["safety", "international-transfers", "international-transfers/reference", "feedback"].map(p => import(`../src/app/api/${p}/route.ts`)));
test.after(() => { hooks.deregister(); for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v; });
const request = () => new Request("http://localhost:3000/api/unused", { headers: { host: "localhost:3000", "x-finbridge-workspace-owner": "a" } });
test("authenticated routes return sanitized 503 on factory and pool failures, including when local demo flag is on", async () => {
  for (const environment of ["production", "development"]) for (const databaseFailure of [true, false]) {
    process.env.NODE_ENV = environment; process.env.FINBRIDGE_DEMO_MODE = "true";
    fixture.session = { user: { id: "a" } }; fixture.databaseFailure = databaseFailure;
    for (const route of routes) {
      const result = await (route.GET || route.POST)(request());
      // Feedback validates POST/origin before connecting; its factory still fails with unavailable config.
      if (route.GET || databaseFailure) {
        assert.equal(result.status, 503); assert.equal(result.headers.get("cache-control"), "no-store");
        assert.equal(JSON.stringify(await result.json()).includes("private"), false);
      }
    }
  }
});
test("public production calls cannot activate memory repositories by enabling a demo flag", async () => {
  process.env.NODE_ENV = "production"; process.env.FINBRIDGE_DEMO_MODE = "true"; fixture.session = null;
  for (const route of routes) assert.equal((await (route.GET || route.POST)(request())).status, 401);
});
test("session failures are unavailable responses, never anonymous demo persistence", async () => {
  fixture.sessionFailure = true; process.env.NODE_ENV = "development";
  try { for (const route of routes) assert.equal((await (route.GET || route.POST)(request())).status, 503); }
  finally { fixture.sessionFailure = false; }
});
