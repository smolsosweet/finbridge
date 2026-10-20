import { readFileSync } from "node:fs";
import { demoIdentity } from "../src/lib/demo-accounts.ts";

const origin = new URL(process.env.FINBRIDGE_BASE_URL || "https://finbridge-orcin-phi.vercel.app");
if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw Error("CANONICAL_HTTPS_ORIGIN_REQUIRED");
const files = process.argv.slice(2).filter(arg => arg.startsWith("--credentials=")).map(arg => arg.slice("--credentials=".length));
if (files.length !== 2) throw Error("PASS_EXACTLY_TWO_PRIVATE_CREDENTIAL_FILES");
const seen = new Set();
for (const file of files) {
  const credentials = JSON.parse(readFileSync(file, "utf8"));
  const slot = [1, 2].find(slot => demoIdentity(slot).id === credentials.id && demoIdentity(slot).email === credentials.email);
  if (!slot || seen.has(slot) || typeof credentials.password !== "string") throw Error("UNEXPECTED_DEMO_IDENTITY");
  seen.add(slot);
  let cookie;
  const headers = () => ({ origin: origin.origin, "content-type": "application/json", ...(cookie ? { cookie } : {}), "x-finbridge-workspace-owner": credentials.id });
  const request = async (path, options = {}) => {
    const response = await fetch(new URL(path, origin), { ...options, headers: headers(), redirect: "error", signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Error(`DEMO_HTTP_${response.status}_${path.replaceAll("/", "_")}`);
    return response;
  };
  try {
    const login = await request("/api/auth/sign-in/email", { method: "POST", body: JSON.stringify({ email: credentials.email, password: credentials.password }) });
    cookie = login.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
    if (!cookie) throw Error("DEMO_SESSION_COOKIE_MISSING");
    const session = await (await request("/api/auth/get-session")).json();
    if (session?.user?.id !== credentials.id || !session.user.emailVerified) throw Error("DEMO_SESSION_OWNER_MISMATCH");
    const workspace = await (await request("/api/workspace")).json();
    const onboarding = await (await request("/api/onboarding")).json();
    const safety = await (await request("/api/safety")).json();
    if (slot === 1 && (workspace.data !== null || onboarding.profile !== null || safety.rules.length || safety.events.length)) throw Error("EMPTY_DEMO_HAS_DATA");
    if (slot === 2 && (!workspace.data || workspace.data.wallets.length !== 5 || workspace.data.categories.length !== 13 || !onboarding.profile || safety.rules.length !== 6 || !safety.events.length)) throw Error("POPULATED_DEMO_INCOMPLETE");
    // A stale/foreign owner header must not expose the other demo's workspace.
    const foreign = await fetch(new URL("/api/workspace", origin), { headers: { ...headers(), "x-finbridge-workspace-owner": demoIdentity(slot === 1 ? 2 : 1).id }, redirect: "error", signal: AbortSignal.timeout(30000) });
    if (foreign.status !== 409) throw Error("DEMO_OWNER_ISOLATION_FAILED");
    console.log(JSON.stringify({ account: demoIdentity(slot).name, email: credentials.email, login: "passed", isolated: true, wallets: workspace.data?.wallets.length || 0, transactions: workspace.data?.transactions.length || 0, categories: workspace.data?.categories.length || 0, budgets: workspace.data?.goals.length || 0, fixedExpenses: workspace.data?.fixedExpenses.length || 0, thresholds: safety.rules.length, alerts: safety.events.length }));
  } finally {
    if (cookie) await request("/api/auth/sign-out", { method: "POST", body: "{}" });
  }
}
