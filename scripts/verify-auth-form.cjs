const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
function compile(file, resolve = require) {
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} }; new Function("require", "module", "exports", output)(resolve, module, module.exports); return module.exports;
}
const copy = compile("src/lib/auth-copy.ts"), forms = compile("src/lib/auth-form-copy.ts");
let slots = [], cursor = 0, calls = [], destination = "", apiError = null;
const fakeReact = { ...React, useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], (next) => { slots[i] = next; }]; }, useRef(value) { const i = cursor++; if (!(i in slots)) slots[i] = { current: value }; return slots[i]; } };
const method = (kind) => async (body) => { calls.push({ kind, body }); return apiError ? { error: apiError } : { data: { url: "https://accounts.google.com" } }; };
const client = { signIn: { email: method("login"), social: method("google") }, signUp: { email: method("signup") }, requestPasswordReset: method("forgot"), resetPassword: method("reset"), sendVerificationEmail: method("resend") };
const { AuthCard } = compile("src/components/sites/rolly/AuthCard.tsx", (name) => {
  if (name.endsWith(".module.css")) return { default: new Proxy({}, { get: (_, key) => String(key) }) };
  if (name === "react") return fakeReact;
  if (name === "next/image") return { default: ({ src, alt }) => React.createElement("img", { src, alt }) };
  if (name === "next/link") return { default: ({ href, children, ...props }) => React.createElement("a", { ...props, href }, children) };
  if (name === "next/navigation") return { useRouter: () => ({ replace: (url) => { destination = url; }, push: (url) => { destination = url; }, refresh() {} }) };
  if (name === "./Icons") return { GoogleIcon: () => React.createElement("span", null, "G") };
  if (name === "./LanguageSelector") return { LanguageSelector: () => React.createElement("div", null) };
  if (name === "@/lib/auth-client") return { authClient: client };
  if (name === "@/lib/auth-copy") return copy;
  if (name === "@/lib/auth-form-copy") return forms;
  return require(name);
});
function find(node, match) { if (!React.isValidElement(node)) return; if (match(node)) return node; for (const child of React.Children.toArray(node.props.children)) { const result = find(child, match); if (result) return result; } }
let props;
function tree() { cursor = 0; return AuthCard(props); }
function reset(mode, lang = "en", overrides = {}) { slots = []; cursor = 0; calls = []; destination = ""; apiError = null; props = { mode, lang, configured: true, mailMode: "local", onBack() {}, ...overrides }; }
function fill(autoComplete, value) { find(tree(), (node) => node.type === "input" && node.props.autoComplete === autoComplete).props.onChange({ target: { value } }); }
function switchLanguage(value) { find(tree(), (node) => typeof node.type === "function" && typeof node.props.onChange === "function" && ["en", "vi", "zh"].includes(node.props.value)).props.onChange(value); }
async function submit() { find(tree(), (node) => node.type === "form").props.onSubmit({ preventDefault() {} }); await new Promise((resolve) => setImmediate(resolve)); }
async function main() {
  for (const lang of ["en", "vi", "zh"]) {
    assert.deepEqual(Object.keys(forms.AUTH_FORM_COPY[lang]), Object.keys(forms.AUTH_FORM_COPY.en));
    for (const mode of ["login", "signup", "forgot", "reset"]) {
      reset(mode, lang, { token: mode === "reset" ? "synthetic-token" : "" });
      const html = renderToStaticMarkup(tree());
      assert.doesNotMatch(html, /Apple|newsletter/);
      assert.doesNotMatch(html, new RegExp(forms.AUTH_FORM_COPY[lang].localMail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.match(html, new RegExp('lang="' + lang + '"'));
      assert.match(html, /autocomplete="(email|new-password)"/i);
      assert.ok(html.includes(forms.AUTH_FORM_COPY[lang].intro));
      if (mode === "login") { assert.match(html, /forgot-password\?lang=/); assert.match(html, /signup\?lang=/); assert.match(html, /Google/); }
    }
  }
  reset("login"); fill("email", "fixture@example.invalid"); fill("current-password", "Synthetic-password-123"); await submit();
  assert.equal(calls[0].kind, "login"); assert.equal(destination, "/app"); assert.equal(calls[0].body.password, "Synthetic-password-123");
  reset("login"); fill("email", "fixture@example.invalid"); fill("current-password", "Wrong-password-123"); apiError = { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 }; await submit();
  assert.equal(destination, ""); assert.ok(find(tree(), (node) => node.props.role === "alert"));
  reset("signup"); fill("email", "fixture@example.invalid"); fill("new-password", "Synthetic-password-123");
  const confirmInput = find(tree(), (node) => node.type === "input" && node.props.autoComplete === "new-password" && node.props.value === "");
  confirmInput.props.onChange({ target: { value: "Different-password-123" } }); await submit(); assert.equal(calls.length, 0);
  confirmInput.props.onChange({ target: { value: "Synthetic-password-123" } }); await submit(); assert.equal(calls[0].kind, "signup"); assert.equal(destination, ""); assert.ok(find(tree(), (node) => node.props.role === "status"));
  for (const language of ["vi", "zh", "en"]) {
    switchLanguage(language);
    assert.equal(find(tree(), (node) => node.props.role === "status").props.children, forms.AUTH_FORM_COPY[language].checkVerification);
  }
  find(tree(), (node) => node.type === "button" && node.props.children === forms.AUTH_FORM_COPY.en.resend).props.onClick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.at(-1).kind, "resend"); assert.equal(calls.at(-1).body.email, "fixture@example.invalid");
  assert.equal(calls.at(-1).body.callbackURL, "/login?lang=en&verified=1");
  reset("login"); fill("email", "fixture@example.invalid"); fill("current-password", "Wrong-password-123"); apiError = { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 }; await submit();
  switchLanguage("vi"); assert.equal(find(tree(), (node) => node.props.role === "alert").props.children, forms.AUTH_FORM_COPY.vi.invalid);
  reset("login", "en", { verified: true });
  assert.equal(find(tree(), (node) => node.props.role === "status"), undefined, "Verified query param must not render an extra status banner on login");
  reset("forgot"); fill("email", "fixture@example.invalid"); await submit(); assert.equal(calls[0].kind, "forgot"); assert.equal(calls[0].body.redirectTo, "/reset-password?lang=en");
  reset("reset", "en", { token: "synthetic-token" }); fill("new-password", "Synthetic-password-456");
  find(tree(), (node) => node.type === "input" && node.props.autoComplete === "new-password" && node.props.value === "").props.onChange({ target: { value: "Synthetic-password-456" } });
  await submit(); assert.equal(calls[0].kind, "reset"); assert.equal(calls[0].body.token, "synthetic-token"); assert.equal(destination, "");
  assert.equal(find(tree(), node => node.type === "form"), undefined, "Successful reset must close the form so its token cannot be submitted twice");
  assert.equal(find(tree(), node => node.props.role === "status").props.children, forms.AUTH_FORM_COPY.en.resetDone);
  assert.ok(find(tree(), node => node.props.href === "/login?lang=en"));
  reset("reset", "vi", { token: "used-token" }); fill("new-password", "Synthetic-password-456");
  find(tree(), node => node.type === "input" && node.props.autoComplete === "new-password" && node.props.value === "").props.onChange({ target: { value: "Synthetic-password-456" } });
  apiError = { code: "INVALID_TOKEN", status: 400 }; await submit();
  assert.equal(find(tree(), node => node.type === "form"), undefined);
  assert.equal(find(tree(), node => node.props.role === "alert").props.children, forms.AUTH_FORM_COPY.vi.invalidToken);
  assert.ok(find(tree(), node => node.props.href === "/forgot-password?lang=vi"));
  switchLanguage("zh"); assert.equal(find(tree(), node => node.props.role === "alert").props.children, forms.AUTH_FORM_COPY.zh.invalidToken);
  reset("forgot", "en", { mailMode: "unavailable" }); await submit(); assert.equal(calls.length, 0);
  reset("reset"); assert.equal(find(tree(), node => node.type === "form"), undefined); assert.equal(calls.length, 0);
  assert.ok(find(tree(), node => node.props.href === "/forgot-password?lang=en"));
  process.stdout.write("PASS: EN/VI/ZH auth forms; email login, signup confirmation, reset, failure handling, and unavailable delivery/token gates.\n");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
