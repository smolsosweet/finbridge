import assert from "node:assert/strict";
import test from "node:test";
import { readAiJson } from "../src/lib/ai-request.ts";
import { AI_AUDIO_BASE64_LENGTH, AI_AUDIO_JSON_BYTES, AI_IMAGE_DATA_URL_LENGTH, AI_RECEIPT_JSON_BYTES } from "../src/lib/ai-limits.ts";
import config from "../next.config.ts";

const encoder = new TextEncoder();
function request(chunks, headers = {}, onCancel = () => {}) {
  return new Request("https://example.invalid/api/ai/test", { method: "POST", headers: { "content-type": "application/json", ...headers }, duplex: "half",
    body: new ReadableStream({ pull(controller) { if (chunks.length) controller.enqueue(chunks.shift()); else controller.close(); }, cancel: onCancel }) });
}
test("streamed JSON counts UTF-8 bytes across chunks without trusting Content-Length", async () => {
  const raw = JSON.stringify({ text: "Tiếng Việt 中文" }), bytes = encoder.encode(raw);
  assert.deepEqual((await readAiJson(request([bytes.slice(0, 17), bytes.slice(17)]), bytes.length)).value, JSON.parse(raw));
  for (const headers of [{}, { "content-length": "1" }]) {
    let cancelled = false;
    const result = await readAiJson(request([encoder.encode('{"text":"'), encoder.encode("中".repeat(20)), encoder.encode('"}')], headers, () => { cancelled = true; }), 40);
    assert.equal(result.status, 413); assert.equal(cancelled, true);
  }
});
test("declared oversize is refused before reading; invalid JSON, UTF-8 and encoding never parse", async () => {
  assert.equal((await readAiJson(request([], { "content-length": "101" }), 100)).status, 413);
  assert.equal((await readAiJson(request([encoder.encode("{")]), 100)).status, 400);
  assert.equal((await readAiJson(request([new Uint8Array([255])]), 100)).status, 400);
  assert.equal((await readAiJson(request([], { "content-encoding": "gzip" }), 100)).status, 415);
  assert.equal((await readAiJson(request([], { "content-type": "text/plain" }), 100)).status, 415);
});
test("aborted and stalled uploads are cancelled without reaching JSON parsing", async () => {
  const abort = new AbortController(); abort.abort();
  const req = new Request("https://example.invalid", { method: "POST", body: "{}", signal: abort.signal, headers: { "content-type": "application/json" } });
  assert.equal((await readAiJson(req, 100)).status, 400);
  let cancelled = false;
  const stalled = new Request("https://example.invalid", { method: "POST", headers: { "content-type": "application/json" }, duplex: "half",
    body: new ReadableStream({ cancel() { cancelled = true; } }) });
  const result = await readAiJson(stalled, 100);
  assert.equal(result.status, 408); assert.equal(cancelled, true);
});
test("EN/VI/ZH oversize responses preserve manual input and media JSON fits hosting limit", async () => {
  const messages = [];
  for (const lang of ["en", "vi", "zh"]) {
    const response = await readAiJson(request([], { "content-length": "101", "x-finbridge-language": lang }), 100);
    const body = await response.json(); assert.equal(body.manualEntryAvailable, true); messages.push(body.message);
  }
  assert.equal(new Set(messages).size, 3);
  assert.ok(AI_AUDIO_BASE64_LENGTH + 1000 < AI_AUDIO_JSON_BYTES && AI_AUDIO_JSON_BYTES < 4_500_000);
  assert.ok(AI_IMAGE_DATA_URL_LENGTH + 100_000 < AI_RECEIPT_JSON_BYTES && AI_RECEIPT_JSON_BYTES < 4_500_000);
});
test("headers prevent embedding/sniffing and permit first-party microphone and camera", async () => {
  const rules = await config.headers(), h = Object.fromEntries(rules[0].headers.map(x => [x.key, x.value]));
  assert.equal(rules[0].source, "/:path*"); assert.equal(h["X-Frame-Options"], "DENY"); assert.equal(h["X-Content-Type-Options"], "nosniff");
  assert.match(h["Permissions-Policy"], /microphone=\(self\)/); assert.match(h["Permissions-Policy"], /camera=\(self\)/);
  assert.match(h["Content-Security-Policy"], /frame-ancestors 'none'/); assert.match(h["Content-Security-Policy"], /object-src 'none'/);
  assert.doesNotMatch(h["Content-Security-Policy"], /script-src|default-src/);
});
