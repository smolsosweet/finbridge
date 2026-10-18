import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { testPool, syntheticUser, cleanupFinance } from "./workspace-fixtures.mjs";
import { transferReferenceRepository, TRANSFER_REFERENCE_SQL } from "../src/lib/transfer-reference-repository.ts";
import { internationalTransferRepository, INTERNATIONAL_TRANSFER_SQL } from "../src/lib/international-transfer-repository.ts";
import { parseReferencePayload } from "../src/lib/reference-rates.ts";
import { deactivateAccountLifecycle } from "../src/lib/account-lifecycle.ts";
test("PostgreSQL: snapshots, owner isolation, retries, concurrent save, stale data, account closure and sandbox guard", async () => {
  const pool = await testPool(), owners = [], observationIds = [];
  const fxDate = "2090-10-17"; // Future isolated observations never collide with current UI test cache.
  let now = new Date(fxDate + "T06:00:00Z"), calls = 0;
  const loadRate = async (currency, time) => { calls++; return parseReferencePayload({ date: fxDate, base: currency, quote: "VND", rate: 3864.07 }, currency, time); };
  const repo = transferReferenceRepository(pool, { clock: () => now, loadRate });
  try {
    await pool.query(TRANSFER_REFERENCE_SQL); await pool.query(INTERNATIONAL_TRANSFER_SQL);
    const owner = await syntheticUser(pool), other = await syntheticUser(pool); owners.push(owner, other);
    const doc = await repo.read(owner); assert.equal(doc.rates.length, 3); assert.equal(calls, 3);
    observationIds.push(...doc.rates.map(r => r.reference.id));
    assert.equal((await repo.read(owner)).rates.every(r => r.usable), true); assert.equal(calls, 3);
    // More readers than pool slots must finish without reserving slots across HTTP/cache reads.
    const concurrentReads = await Promise.all(Array.from({ length: 8 }, () => repo.read(owner)));
    assert.equal(concurrentReads.every(r => r.rates.every(rate => rate.usable)), true);
    const input = { mutationId: randomUUID(), referenceId: doc.rates[0].reference.id, amount: "1000.25" };
    const [first, replay] = await Promise.all([repo.estimate(owner, input), repo.estimate(owner, input)]);
    assert.equal(first.id, replay.id); assert.equal(first.convertedVnd, "3865036");
    assert.equal((await repo.read(owner)).estimates.length, 1);
    assert.equal((await repo.read(other)).estimates.length, 0);
    await assert.rejects(() => repo.estimate(owner, { ...input, amount: "2" }), /MUTATION_MISMATCH/);
    const otherEstimate = await repo.estimate(other, input); assert.equal(otherEstimate.id, input.mutationId);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM finbridge_transfer_estimates WHERE id=$1", [input.mutationId])).rows[0].n, 2);
    now = new Date(+now + 12 * 60 * 60_000);
    const failedProvider = transferReferenceRepository(pool, { clock: () => now, loadRate: async () => { throw new Error("provider offline"); } });
    const stillUsable = await failedProvider.read(owner);
    assert.equal(stillUsable.rates.every(r => r.cached && r.usable), true);
    now = new Date(+now + 13 * 60 * 60_000);
    const stale = await failedProvider.read(owner);
    assert.equal(stale.rates.every(r => r.cached && !r.usable), true);
    assert.equal(stale.estimates[0].reference.id, first.reference.id);
    await assert.rejects(() => failedProvider.estimate(owner, { ...input, mutationId: randomUUID() }), /RATE_STALE/);
    assert.equal((await failedProvider.estimate(owner, input)).convertedVnd, first.convertedVnd);
    const locked = internationalTransferRepository(pool, () => now, { sandboxEnabled: false });
    for (const action of ["quote", "draft", "approve", "execute"]) await assert.rejects(() => locked.mutate(owner, { action, mutationId: randomUUID(), id: randomUUID(), quoteId: randomUUID(), version: 1, acknowledge: true }), /SANDBOX_DISABLED/);
    await pool.query('UPDATE "user" SET "emailVerified"=false WHERE id=$1', [owner]);
    await assert.rejects(() => repo.read(owner), /UNAUTHENTICATED/);
    await assert.rejects(() => repo.estimate(owner, input), /UNAUTHENTICATED/);
    await pool.query('UPDATE "user" SET "emailVerified"=true WHERE id=$1', [owner]);
    await deactivateAccountLifecycle(pool, { userId: owner, secret: "synthetic-reference-lifecycle-".repeat(3) });
    await assert.rejects(() => repo.read(owner), /UNAUTHENTICATED/);
    await assert.rejects(() => repo.estimate(owner, input), /UNAUTHENTICATED/);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM finbridge_transfer_estimates WHERE user_id=$1", [owner])).rows[0].n, 1);
  } finally {
    await pool.query("DELETE FROM finbridge_transfer_estimates WHERE user_id=ANY($1::text[])", [owners]);
    await pool.query("DELETE FROM finbridge_transfer_estimate_limits WHERE user_id=ANY($1::text[])", [owners]);
    await pool.query("DELETE FROM finbridge_fx_observations WHERE id=ANY($1::uuid[])", [observationIds]);
    await cleanupFinance(pool, owners); await pool.end();
  }
});
