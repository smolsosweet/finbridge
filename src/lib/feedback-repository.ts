import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { feedbackSchema, FeedbackError, type FeedbackInput, type FeedbackReceipt } from "./feedback";

export const FEEDBACK_SQL = `
CREATE TABLE IF NOT EXISTS finbridge_feedback (
 user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
 id UUID NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('contact','feature')),
 subject TEXT NOT NULL CHECK(length(subject)<=120),
 message TEXT NOT NULL CHECK(length(message) BETWEEN 1 AND 2000),
 status TEXT NOT NULL DEFAULT 'received' CHECK(status='received'),
 content_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,id)
);
CREATE INDEX IF NOT EXISTS finbridge_feedback_received ON finbridge_feedback(created_at DESC);
CREATE TABLE IF NOT EXISTS finbridge_feedback_limits (
 user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE RESTRICT,
 window_at TIMESTAMPTZ NOT NULL, requests INTEGER NOT NULL DEFAULT 0
);`;
export type FeedbackRepository = { submit(owner: string, input: FeedbackInput): Promise<FeedbackReceipt> };
export function feedbackRepository(pool: Pool, clock: () => Date = () => new Date()): FeedbackRepository {
  return { async submit(owner, untrusted) {
    const parsed = feedbackSchema.safeParse(untrusted);
    if (!parsed.success) throw new FeedbackError("INVALID_FEEDBACK", 400);
    const input = parsed.data, now = clock();
    const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const user = await c.query('SELECT id FROM "user" WHERE id=$1 AND "emailVerified"=true FOR SHARE', [owner]);
      if (!user.rowCount || (await c.query("SELECT 1 FROM finbridge_account_lifecycle WHERE user_id=$1", [owner])).rowCount) throw new FeedbackError("UNAUTHENTICATED", 401);
      await c.query("INSERT INTO finbridge_feedback_limits(user_id,window_at) VALUES($1,$2) ON CONFLICT DO NOTHING", [owner, now]);
      await c.query("SELECT user_id FROM finbridge_feedback_limits WHERE user_id=$1 FOR UPDATE", [owner]);
      const previous = (await c.query("SELECT content_hash FROM finbridge_feedback WHERE user_id=$1 AND id=$2", [owner, input.mutationId])).rows[0];
      if (previous && previous.content_hash !== hash) throw new FeedbackError("MUTATION_MISMATCH");
      if (!previous) {
        const limit = await c.query(`UPDATE finbridge_feedback_limits SET
          requests=CASE WHEN window_at<=$2::timestamptz-INTERVAL '10 minutes' THEN 1 ELSE requests+1 END,
          window_at=CASE WHEN window_at<=$2::timestamptz-INTERVAL '10 minutes' THEN $2 ELSE window_at END
          WHERE user_id=$1 AND (requests<5 OR window_at<=$2::timestamptz-INTERVAL '10 minutes') RETURNING user_id`, [owner, now]);
        if (!limit.rowCount) throw new FeedbackError("RATE_LIMITED", 429);
        await c.query("INSERT INTO finbridge_feedback(user_id,id,kind,subject,message,content_hash,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)", [owner, input.mutationId, input.kind, input.subject, input.message, hash, now]);
      }
      const result = (await c.query('SELECT id,kind,status,created_at AS "createdAt" FROM finbridge_feedback WHERE user_id=$1 AND id=$2', [owner, input.mutationId])).rows[0];
      await c.query("COMMIT");
      return { ...result, createdAt: result.createdAt.toISOString() };
    } catch (error) { await c.query("ROLLBACK"); throw error; } finally { c.release(); }
  } };
}
