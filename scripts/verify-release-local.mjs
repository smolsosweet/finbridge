import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const url = new URL(process.env.AUTH_TEST_DATABASE_URL || "");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/finbridge_auth_test") throw Error("Only isolated local finbridge_auth_test allowed");
if (!process.env.npm_execpath) throw Error("Run via npm run verify:release");
mkdirSync(".local/release-verification", { recursive: true });
const all = ["test:business:unit", "test:business:postgres", "lint", "typecheck", "build", "test:hardening:ui"];
const from = process.argv.find(x => x.startsWith("--from="))?.slice(7);
if (from && !all.includes(from)) throw Error("Unknown --from step");
const old = from && existsSync(".local/release-verification/results.json") ? JSON.parse(readFileSync(".local/release-verification/results.json", "utf8")) : null;
const selected = all.slice(from ? all.indexOf(from) : 0);
const results = old ? old.results.filter(r => all.indexOf(r.script) < all.indexOf(from)) : [], startedAt = old?.startedAt || new Date().toISOString();
for (const script of selected) {
  console.log("Running " + script);
  const started = Date.now(), chunks = [];
  const child = spawn(process.execPath, [process.env.npm_execpath, "run", script], { cwd: process.cwd(), env: process.env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", chunk => chunks.push(chunk)); child.stderr.on("data", chunk => chunks.push(chunk));
  const exitCode = await new Promise((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
  const output = Buffer.concat(chunks).toString("utf8"), log = ".local/release-verification/" + script.replaceAll(":", "-") + ".log";
  writeFileSync(log, output);
  const passed = [...output.matchAll(/(?:^|\n)(?:ℹ\s*)?(?:#\s*)?pass\s+(\d+)/g)].reduce((n, match) => n + Number(match[1]), 0);
  results.push({ script, exitCode, passed, durationMs: Date.now() - started, log });
  console.log(JSON.stringify(results.at(-1)));
  if (exitCode !== 0) { process.exitCode = 1; break; }
}
writeFileSync(".local/release-verification/results.json", JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), results }, null, 2));
