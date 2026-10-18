import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { estimateInputSchema, fetchReferenceRate, REFERENCE_CACHE_MS, REFERENCE_CURRENCIES, ReferenceError, referenceConversion, referenceUsable, type EstimateInput, type ReferenceCurrency, type ReferenceDocument, type ReferenceEstimate, type ReferenceRate } from "./reference-rates";

export const TRANSFER_REFERENCE_SQL = `
CREATE TABLE IF NOT EXISTS finbridge_fx_observations (
 id UUID PRIMARY KEY, base TEXT NOT NULL CHECK(base IN ('CNY','USD','AUD')),
 quote TEXT NOT NULL CHECK(quote='VND'), rate NUMERIC(24,10) NOT NULL CHECK(rate>0),
 rate_date DATE NOT NULL, fetched_at TIMESTAMPTZ NOT NULL, source TEXT NOT NULL CHECK(source='Frankfurter')
);
CREATE INDEX IF NOT EXISTS finbridge_fx_latest ON finbridge_fx_observations(base, fetched_at DESC);
CREATE TABLE IF NOT EXISTS finbridge_transfer_estimates (
 user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT, id UUID NOT NULL,
 reference_id UUID NOT NULL REFERENCES finbridge_fx_observations(id) ON DELETE RESTRICT,
 amount NUMERIC(9,2) NOT NULL CHECK(amount>0 AND amount<=1000000),
 converted_vnd NUMERIC(20,0) NOT NULL CHECK(converted_vnd>=0),
 content_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL,
 PRIMARY KEY(user_id,id)
);
CREATE INDEX IF NOT EXISTS finbridge_transfer_estimate_time ON finbridge_transfer_estimates(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS finbridge_transfer_estimate_limits (
 user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE RESTRICT,
 window_at TIMESTAMPTZ NOT NULL, requests INTEGER NOT NULL DEFAULT 0
);`;
export type ReferenceRepository = {
  read(owner: string): Promise<ReferenceDocument>;
  estimate(owner: string, input: EstimateInput): Promise<ReferenceEstimate>;
};
type Dependencies = { clock?: () => Date; loadRate?: typeof fetchReferenceRate };
export function transferReferenceRepository(pool: Pool, dependencies: Dependencies = {}): ReferenceRepository {
  const clock = dependencies.clock || (() => new Date()), loadRate = dependencies.loadRate || fetchReferenceRate;
  async function active(c: PoolClient, owner: string) {
    const r = await c.query('SELECT id FROM "user" WHERE id=$1 AND "emailVerified"=true FOR SHARE', [owner]);
    if (!r.rowCount || (await c.query("SELECT 1 FROM finbridge_account_lifecycle WHERE user_id=$1", [owner])).rowCount) throw new ReferenceError("UNAUTHENTICATED", 401);
  }
  function reference(row: Record<string, string>): ReferenceRate {
    return { id: row.id, base: row.base as ReferenceCurrency, quote: "VND", rate: row.rate, date: row.date, fetchedAt: row.fetchedAt, source: "Frankfurter" };
  }
  const columns = `id,base,rate::text,rate_date::text AS date,to_char(fetched_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "fetchedAt"`;
  async function rate(currency: ReferenceCurrency, now: Date) {
    const previous = (await pool.query(`SELECT ${columns} FROM finbridge_fx_observations WHERE base=$1 ORDER BY fetched_at DESC LIMIT 1`, [currency])).rows[0];
    const cached = previous ? reference(previous) : null;
    if (cached && referenceUsable(cached, now) && +now - Date.parse(cached.fetchedAt) < REFERENCE_CACHE_MS) return { currency, reference: cached, cached: false, usable: true };
    try {
      const fresh = { ...await loadRate(currency, now), id: randomUUID() };
      // Validate even injected/provider adapter data before recording it.
      if (fresh.base !== currency || fresh.quote !== "VND" || fresh.source !== "Frankfurter" || !referenceUsable(fresh, now) || (cached && fresh.date < cached.date)) throw new ReferenceError("RATE_UNAVAILABLE", 503);
      await pool.query("INSERT INTO finbridge_fx_observations(id,base,quote,rate,rate_date,fetched_at,source) VALUES($1,$2,$3,$4,$5,$6,$7)", [fresh.id, fresh.base, fresh.quote, fresh.rate, fresh.date, fresh.fetchedAt, fresh.source]);
      return { currency, reference: fresh, cached: false, usable: true };
    } catch { return { currency, reference: cached, cached: true, usable: !!cached && referenceUsable(cached, now) }; }
  }
  function saved(row: { id: string; amount: string; convertedVnd: string; createdAt: string; reference: ReferenceRate }): ReferenceEstimate { return row; }
  const estimateColumns = `e.id,e.amount::text,e.converted_vnd::text AS "convertedVnd",to_char(e.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt",json_build_object('id',r.id,'base',r.base,'quote',r.quote,'rate',r.rate::text,'date',r.rate_date::text,'fetchedAt',to_char(r.fetched_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'source',r.source) AS reference`;
  return {
    async read(owner) {
      // Release the authorization connection before pooled cache queries/HTTP.
      // Holding it across those operations can exhaust small production pools.
      const authorization = await pool.connect();
      try { await active(authorization, owner); } finally { authorization.release(); }
      const rates = await Promise.all(REFERENCE_CURRENCIES.map(currency => rate(currency, clock())));
      const c = await pool.connect();
      try {
        // Recheck after public HTTP calls before returning private history.
        await c.query("BEGIN"); await active(c, owner);
        const rows = await c.query(`SELECT ${estimateColumns} FROM finbridge_transfer_estimates e JOIN finbridge_fx_observations r ON r.id=e.reference_id WHERE e.user_id=$1 ORDER BY e.created_at DESC,e.id LIMIT 20`, [owner]);
        await c.query("COMMIT");
        return { rates, estimates: rows.rows.map(saved), serverTime: clock().toISOString() };
      } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
    },
    async estimate(owner, untrusted) {
      const parsed = estimateInputSchema.safeParse(untrusted);
      if (!parsed.success) throw new ReferenceError("INVALID_COMMAND", 400);
      const input = parsed.data, now = clock(), hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
      const c = await pool.connect();
      try {
        await c.query("BEGIN"); await active(c, owner);
        await c.query("INSERT INTO finbridge_transfer_estimate_limits(user_id,window_at) VALUES($1,$2) ON CONFLICT DO NOTHING", [owner, now]);
        await c.query("SELECT user_id FROM finbridge_transfer_estimate_limits WHERE user_id=$1 FOR UPDATE", [owner]);
        const previous = (await c.query("SELECT content_hash FROM finbridge_transfer_estimates WHERE user_id=$1 AND id=$2", [owner, input.mutationId])).rows[0];
        if (previous && previous.content_hash !== hash) throw new ReferenceError("MUTATION_MISMATCH");
        if (!previous) {
          const limit = await c.query("UPDATE finbridge_transfer_estimate_limits SET requests=CASE WHEN window_at<=$2::timestamptz-INTERVAL '1 minute' THEN 1 ELSE requests+1 END,window_at=CASE WHEN window_at<=$2::timestamptz-INTERVAL '1 minute' THEN $2 ELSE window_at END WHERE user_id=$1 AND (requests<10 OR window_at<=$2::timestamptz-INTERVAL '1 minute') RETURNING user_id", [owner, now]);
          if (!limit.rowCount) throw new ReferenceError("RATE_LIMITED", 429);
          const row = (await c.query(`SELECT ${columns} FROM finbridge_fx_observations WHERE id=$1`, [input.referenceId])).rows[0];
          if (!row) throw new ReferenceError("RATE_UNAVAILABLE", 503);
          const ref = reference(row);
          if (!referenceUsable(ref, now)) throw new ReferenceError("RATE_STALE");
          await c.query("INSERT INTO finbridge_transfer_estimates(user_id,id,reference_id,amount,converted_vnd,content_hash,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)", [owner, input.mutationId, ref.id, input.amount, referenceConversion(input.amount, ref.rate), hash, now]);
        }
        const result = (await c.query(`SELECT ${estimateColumns} FROM finbridge_transfer_estimates e JOIN finbridge_fx_observations r ON r.id=e.reference_id WHERE e.user_id=$1 AND e.id=$2`, [owner, input.mutationId])).rows[0];
        await c.query("COMMIT"); return saved(result);
      } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
    },
  };
}
