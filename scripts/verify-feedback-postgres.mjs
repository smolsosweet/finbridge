import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { feedbackRepository } from "../src/lib/feedback-repository.ts";
import { testPool, syntheticUser, cleanupFinance } from "./workspace-fixtures.mjs";
import { deactivateAccountLifecycle } from "../src/lib/account-lifecycle.ts";
const pool = await testPool(), owners = [];
test.after(async () => { await cleanupFinance(pool, owners); await pool.end(); });
const user = async () => { const id = await syntheticUser(pool); owners.push(id); return id; };
const command = () => ({ mutationId: randomUUID(), kind: "feature", subject: "Synthetic idea", message: "Synthetic database-only test" });
test("feedback is durable after reopening repository, owner-scoped and idempotent under concurrent retries", async () => {
  const a = await user(), b = await user(), input = command();
  const results = await Promise.all(Array.from({ length: 4 }, () => feedbackRepository(pool).submit(a, input)));
  assert.ok(results.every(r => r.id === input.mutationId && r.status === "received"));
  assert.deepEqual(await feedbackRepository(pool).submit(a, input), results[0]);
  assert.equal(Number((await pool.query("SELECT count(*) n FROM finbridge_feedback WHERE user_id=$1", [a])).rows[0].n), 1);
  assert.equal(Number((await pool.query("SELECT count(*) n FROM finbridge_feedback WHERE user_id=$1", [b])).rows[0].n), 0);
  await assert.rejects(feedbackRepository(pool).submit(a, { ...input, message: "Changed content" }), /MUTATION_MISMATCH/);
  assert.equal((await pool.query("SELECT message FROM finbridge_feedback WHERE user_id=$1", [a])).rows[0].message, input.message);
  assert.equal((await feedbackRepository(pool).submit(b, input)).id, input.mutationId);
});
test("feedback rate limit is shared across instances, retry-safe and resets after ten minutes", async () => {
  const a = await user(); let now = new Date("2026-10-19T00:00:00Z");
  const first = command(); await feedbackRepository(pool, () => now).submit(a, first);
  for (let i = 0; i < 4; i++) await feedbackRepository(pool, () => now).submit(a, command());
  await assert.rejects(feedbackRepository(pool, () => now).submit(a, command()), /RATE_LIMITED/);
  await feedbackRepository(pool, () => now).submit(a, first);
  assert.equal(Number((await pool.query("SELECT count(*) n FROM finbridge_feedback WHERE user_id=$1", [a])).rows[0].n), 5);
  now = new Date(+now + 600000); await feedbackRepository(pool, () => now).submit(a, command());
});
test("unknown or unverified account and invalid payload cannot insert feedback", async () => {
  const a = await user(); await pool.query('UPDATE "user" SET "emailVerified"=false WHERE id=$1', [a]);
  await assert.rejects(feedbackRepository(pool).submit(a, command()), /UNAUTHENTICATED/);
  await assert.rejects(feedbackRepository(pool).submit("missing-" + randomUUID(), command()), /UNAUTHENTICATED/);
  await assert.rejects(feedbackRepository(pool).submit(a, { ...command(), message: " " }), /INVALID_FEEDBACK/);
  assert.equal(Number((await pool.query("SELECT count(*) n FROM finbridge_feedback WHERE user_id=$1", [a])).rows[0].n), 0);
});
test("account closure retains submitted feedback but denies subsequent writes", async () => {
  const a = await user(), input = command();
  await feedbackRepository(pool).submit(a, input);
  await deactivateAccountLifecycle(pool, { userId: a, secret: "synthetic-feedback-lifecycle-secret-".repeat(2) });
  await assert.rejects(feedbackRepository(pool).submit(a, command()), /UNAUTHENTICATED/);
  await assert.rejects(feedbackRepository(pool).submit(a, input), /UNAUTHENTICATED/);
  assert.equal(Number((await pool.query("SELECT count(*) n FROM finbridge_feedback WHERE user_id=$1", [a])).rows[0].n), 1);
});
