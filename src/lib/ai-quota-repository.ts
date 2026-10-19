import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { AI_ROUTE_COST, AiQuotaError, aiQuotaWindows, type AiQuotaRepository } from "./ai-quota";

export const AI_QUOTA_SQL = `
CREATE TABLE IF NOT EXISTS finbridge_ai_control (
 provider TEXT PRIMARY KEY CHECK(provider='gemini'), blocked_until TIMESTAMPTZ NOT NULL DEFAULT '-infinity'
);
INSERT INTO finbridge_ai_control(provider) VALUES('gemini') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS finbridge_ai_quota_buckets (
 scope TEXT NOT NULL, owner TEXT NOT NULL, window_key TEXT NOT NULL,
 used INTEGER NOT NULL CHECK(used>=0), expires_at TIMESTAMPTZ NOT NULL,
 PRIMARY KEY(scope,owner,window_key)
);
CREATE TABLE IF NOT EXISTS finbridge_ai_reservations (
 id UUID PRIMARY KEY, user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
 route TEXT NOT NULL, buckets JSONB NOT NULL, released BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS finbridge_ai_quota_expiry ON finbridge_ai_quota_buckets(expires_at);
CREATE INDEX IF NOT EXISTS finbridge_ai_reservation_age ON finbridge_ai_reservations(created_at);
`;
type Bucket = { scope: string; owner: string; key: string; points: number; limit: number; expires: string };

export function aiQuotaRepository(pool: Pool, clock?: () => Date): AiQuotaRepository {
  async function transaction<T>(action: (c: PoolClient) => Promise<T>): Promise<T> {
    let c: PoolClient | undefined;
    try {
      c = await pool.connect();
      await c.query("BEGIN");
      await c.query("SET LOCAL lock_timeout = '3s'");
      await c.query("SET LOCAL statement_timeout = '5s'");
      const result = await action(c);
      await c.query("COMMIT");
      return result;
    } catch (error) {
      if (c) await c.query("ROLLBACK").catch(() => undefined);
      if (error instanceof AiQuotaError) throw error;
      throw new AiQuotaError("AI_QUOTA_UNAVAILABLE");
    } finally { c?.release(); }
  }
  async function nowInDatabase(c: PoolClient): Promise<Date> {
    return clock ? clock() : (await c.query("SELECT clock_timestamp() AS now")).rows[0].now;
  }
  return {
    reserve(owner, route, config) {
      return transaction(async c => {
        const user = await c.query('SELECT id FROM "user" WHERE id=$1 AND "emailVerified"=true FOR SHARE', [owner]);
        if (!user.rowCount || (await c.query("SELECT 1 FROM finbridge_account_lifecycle WHERE user_id=$1", [owner])).rowCount) throw new AiQuotaError("AI_QUOTA_UNAVAILABLE");
        // All reserve/release/pause transactions lock control first, then buckets in this fixed order.
        const control = (await c.query("SELECT blocked_until FROM finbridge_ai_control WHERE provider='gemini' FOR UPDATE")).rows[0];
        if (!control) throw new AiQuotaError("AI_QUOTA_UNAVAILABLE");
        const now = await nowInDatabase(c);
        if (+control.blocked_until > +now) throw new AiQuotaError("AI_RATE_LIMITED", Math.ceil((+control.blocked_until - +now) / 1000));
        const w = aiQuotaWindows(now), cost = AI_ROUTE_COST[route];
        if (!cost) throw new AiQuotaError("AI_QUOTA_UNAVAILABLE");
        const buckets: Bucket[] = [
          { scope: "server-day-points", owner: "*", key: w.day, points: cost, limit: config.serverDailyPoints, expires: w.nextDayAt.toISOString() },
          { scope: "server-day-requests", owner: "*", key: w.day, points: 1, limit: config.serverDailyRequests, expires: w.nextDayAt.toISOString() },
          { scope: "server-minute-requests", owner: "*", key: w.minute, points: 1, limit: config.serverMinuteRequests, expires: w.nextMinuteAt.toISOString() },
          { scope: "user-day-points", owner, key: w.day, points: cost, limit: config.userDailyPoints, expires: w.nextDayAt.toISOString() },
          { scope: "user-minute-points", owner, key: w.minute, points: cost, limit: config.userMinutePoints, expires: w.nextMinuteAt.toISOString() },
        ];
        for (const b of buckets) {
          const result = await c.query(`INSERT INTO finbridge_ai_quota_buckets(scope,owner,window_key,used,expires_at)
            SELECT $1,$2,$3,$4,$6 WHERE $4::integer <= $5::integer
            ON CONFLICT(scope,owner,window_key) DO UPDATE SET used=finbridge_ai_quota_buckets.used+EXCLUDED.used
            WHERE finbridge_ai_quota_buckets.used+EXCLUDED.used <= $5::integer
            RETURNING used`, [b.scope, b.owner, b.key, b.points, b.limit, b.expires]);
          if (!result.rowCount) throw new AiQuotaError("AI_QUOTA_EXCEEDED", Math.ceil((Date.parse(b.expires) - +now) / 1000));
        }
        const id = randomUUID();
        await c.query("INSERT INTO finbridge_ai_reservations(id,user_id,route,buckets,created_at) VALUES($1,$2,$3,$4::jsonb,$5)", [id, owner, route, JSON.stringify(buckets), now]);
        // Bounded retention for quota metadata. No prompts, files, tokens or financial data are saved here.
        await c.query("DELETE FROM finbridge_ai_reservations WHERE created_at < $1::timestamptz - INTERVAL '7 days'", [now]);
        await c.query("DELETE FROM finbridge_ai_quota_buckets WHERE expires_at < $1::timestamptz - INTERVAL '7 days'", [now]);
        return { id, owner };
      });
    },
    release(reservation) {
      return transaction(async c => {
        await c.query("SELECT provider FROM finbridge_ai_control WHERE provider='gemini' FOR UPDATE");
        const result = await c.query("UPDATE finbridge_ai_reservations SET released=true WHERE id=$1 AND user_id=$2 AND released=false RETURNING buckets", [reservation.id, reservation.owner]);
        for (const b of (result.rows[0]?.buckets || []) as Bucket[]) {
          await c.query("UPDATE finbridge_ai_quota_buckets SET used=GREATEST(0,used-$4) WHERE scope=$1 AND owner=$2 AND window_key=$3", [b.scope, b.owner, b.key, b.points]);
        }
      });
    },
    pause(seconds) {
      return transaction(async c => {
        await c.query("SELECT provider FROM finbridge_ai_control WHERE provider='gemini' FOR UPDATE");
        const now = await nowInDatabase(c);
        const result = await c.query("UPDATE finbridge_ai_control SET blocked_until=GREATEST(blocked_until,$1::timestamptz + $2::integer * INTERVAL '1 second') WHERE provider='gemini' RETURNING provider", [now, Math.max(1, Math.min(86_400, Math.ceil(seconds)))]);
        if (!result.rowCount) throw new AiQuotaError("AI_QUOTA_UNAVAILABLE");
      });
    },
  };
}
