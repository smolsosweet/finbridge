const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs"), ts = require("typescript"), React = require("react");

// Exercise the provider's real effects with deterministic visibility, events and
// HTTP responses; no database or provider credentials are loaded by this test.
function mount(t) {
  const saved = Object.fromEntries(["fetch", "window", "document", "setInterval", "clearInterval"].map(key => [key, global[key]]));
  const dateNow = Date.now, effects = [], timers = new Map(), calls = [];
  let time = 1_000_000, nextTimer = 1, owner = "synthetic-owner", hold = false, resolveFetch;
  const window = new EventTarget(), document = new EventTarget();
  document.visibilityState = "visible";
  Object.assign(global, { window, document,
    setInterval(fn, ms) { const id = nextTimer++; timers.set(id, { fn, ms }); return id; },
    clearInterval(id) { timers.delete(id); },
    async fetch(url, options) {
      calls.push({ url, options });
      if (hold) { hold = false; await new Promise(resolve => { resolveFetch = resolve; }); }
      return Response.json({ revision: 0, rules: [], evaluated: {}, events: [], emailAvailable: false });
    },
  });
  Date.now = () => time;
  const fakeReact = { ...React,
    useState(value) { return [value, () => {}]; }, useRef(value) { return { current: value }; },
    useCallback(fn) { return fn; }, useEffect(effect) { effects.push(effect); },
  };
  const output = ts.transpileModule(fs.readFileSync("src/components/safety/SafetyProvider.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", output)(name => {
    if (name === "react") return fakeReact;
    if (name === "@/components/auth/AuthenticatedUser") return { useAuthenticatedUser: () => ({ id: owner }) };
    if (name === "@/components/finbridge/workspace/store") return { workspaceOwner: () => owner, flushWorkspace: async () => {} };
    if (name === "@/lib/safety-model") return { emptySafetyPublic: { revision: 0, rules: [], evaluated: {}, events: [] } };
    return require(name);
  }, module, module.exports);
  const owned = module.exports.SafetyProvider({ children: null });
  const context = owned.type(owned.props).props.value;
  const cleanups = effects.map(effect => effect());
  let cleaned = false;
  const cleanup = () => { if (!cleaned) { cleaned = true; cleanups.forEach(fn => fn?.()); } };
  t.after(() => { cleanup(); Date.now = dateNow; for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete global[key]; else global[key] = value; } });
  return {
    calls, timers, context, cleanup,
    advance(ms) { time += ms; },
    async settled() { await new Promise(resolve => setImmediate(resolve)); },
    poll() { for (const { fn } of timers.values()) fn(); },
    visibility(value) { document.visibilityState = value; document.dispatchEvent(new Event("visibilitychange")); },
    saved() { window.dispatchEvent(new Event("finbridge:financial-workspace-saved")); },
    holdNext() { hold = true; }, release() { resolveFetch?.(); },
  };
}

test("idle safety polling is five minutes and makes no requests while the tab is hidden", async t => {
  const h = mount(t); await h.settled();
  assert.equal(h.calls.length, 1);
  assert.equal([...h.timers.values()][0].ms, 300000);
  h.visibility("hidden");
  for (let i = 0; i < 12; i++) { h.advance(300000); h.poll(); }
  await h.settled(); assert.equal(h.calls.length, 1);
  h.visibility("visible"); await h.settled(); assert.equal(h.calls.length, 2);
  for (let i = 0; i < 10; i++) { h.visibility("hidden"); h.visibility("visible"); }
  await h.settled(); assert.equal(h.calls.length, 2);
  h.advance(300000); h.poll(); await h.settled(); assert.equal(h.calls.length, 3);
});

test("financial saves refresh immediately and an in-flight save schedules a fresh read", async t => {
  const h = mount(t); await h.settled();
  h.saved(); await h.settled(); assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].options.headers["x-finbridge-workspace-owner"], "synthetic-owner");
  h.holdNext(); h.saved(); h.saved(); h.saved();
  assert.equal(h.calls.length, 3);
  h.release(); await h.settled(); assert.equal(h.calls.length, 4);
});

test("unmount removes timers and listeners so signed-out tabs stop automatic reads", async t => {
  const h = mount(t); await h.settled();
  h.cleanup(); assert.equal(h.timers.size, 0);
  h.advance(300000); h.saved(); h.visibility("visible"); h.poll();
  await h.settled(); assert.equal(h.calls.length, 1);
});
