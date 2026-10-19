// Read-only deployment smoke: never signs in, sends mail, changes DB or calls Gemini.
const args = process.argv.slice(2), option = name => args.find(x => x.startsWith(name + "="))?.slice(name.length + 1);
const origin = new URL(option("--url") || "http://localhost:3011");
if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password) throw Error("Invalid origin");
const expected = option("--sha");
if (!expected || !/^[a-f0-9]{40}$/i.test(expected)) throw Error("Pass the expected full --sha=40-character-commit");
const result = { checkedAt: new Date().toISOString(), origin: origin.origin, expectedCommit: expected, checks: [] };
const check = (name, ok) => result.checks.push({ check: name, ok });
try {
  const response = await fetch(new URL("/api/release", origin), { redirect: "error", signal: AbortSignal.timeout(20_000) });
  const body = await response.json(); result.deployedCommit = body.commit;
  check("deployment commit matches", response.ok && body.commit === expected);
  check("build source was clean", body.dirty === false);
  for (const path of ["/", "/login", "/signup"]) {
    const page = await fetch(new URL(path, origin), { redirect: "manual", signal: AbortSignal.timeout(20_000) });
    check(path + " responds", page.status === 200);
    check(path + " security headers", page.headers.get("x-content-type-options") === "nosniff" && !!page.headers.get("content-security-policy") && /microphone=\(self\)/.test(page.headers.get("permissions-policy") || ""));
    await page.body?.cancel();
  }
  for (const route of ["assistant", "transaction-drafts", "receipt-drafts", "speech-transcription", "scenario-planner", "proactive-feed", "workspace-actions"]) {
    const response = await fetch(new URL("/api/ai/" + route, origin), { method: "POST", redirect: "error", signal: AbortSignal.timeout(20_000), headers: { origin: origin.origin, "content-type": "application/json" }, body: "{}" });
    check(route + " denies anonymous", response.status === 401); await response.body?.cancel();
  }
} catch { check("HTTP smoke completed without redirect/auth/transport errors", false); }
console.log(JSON.stringify(result, null, 2));
if (!result.checks.length || result.checks.some(c => !c.ok)) process.exitCode = 1;
