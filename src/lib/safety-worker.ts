import type { Pool } from "pg";
import { advanceSafety, evaluateSafety, type SafetyDocument, type SafetyEvent } from "./safety-model";
import { saveSafety, safetyWorkspace, databaseSafety } from "./safety-repository";
import { sendSafetyEmail } from "./safety-mail";

// External schedulers can impose a 30-second request limit. Reserve time for
// cleanup and respond before that limit instead of leaving claimed mail ambiguous.
const WORKER_BUDGET_MS = 20_000;
const MINIMUM_MAIL_WINDOW_MS = 9_000;
const MAX_EVALUATIONS_PER_RUN = 25;
const MAX_EMAILS_PER_RUN = 1;

export async function runSafetyWorker(pool: Pool, send = sendSafetyEmail, now = new Date()) {
  const lock = await pool.connect();
  const count = { evaluated: 0, accepted: 0, cancelled: 0, failed: 0, unknown: 0, retried: 0 };
  const deadline = Date.now() + WORKER_BUDGET_MS;
  const hasTime = (minimum = 0) => Date.now() + minimum < deadline;
  try {
    const acquired = await lock.query("SELECT pg_try_advisory_lock(17961015) AS locked");
    if (!acquired.rows[0].locked) return { ...count, busy: true };
    await lock.query("UPDATE finbridge_safety_events SET event=jsonb_set(event,'{emailStatus}','\"unknown\"') WHERE event->>'emailStatus'='sending' AND next_attempt_at < $1", [new Date(now.getTime() - 10 * 60000)]);
    const docs = await lock.query<{ user_id: string }>("SELECT user_id FROM finbridge_safety WHERE updated_at < $1 ORDER BY updated_at LIMIT $2", [new Date(now.getTime() - 60000), MAX_EVALUATIONS_PER_RUN]);
    for (const { user_id: userId } of docs.rows) {
      if (!hasTime()) break;
      await lock.query("BEGIN");
      try {
        await lock.query('SELECT id FROM "user" WHERE id=$1 FOR SHARE', [userId]);
        const inactive = await lock.query("SELECT 1 FROM finbridge_account_lifecycle WHERE user_id=$1", [userId]);
        const workspace = await safetyWorkspace(lock, userId);
        const r = await lock.query<{ document: SafetyDocument }>("SELECT document FROM finbridge_safety WHERE user_id=$1 FOR UPDATE", [userId]);
        const doc = r.rows[0]?.document;
        if (doc && workspace) databaseSafety(doc, workspace.data, workspace.updatedAt);
        if (!inactive.rowCount && doc?.syncedAt && (doc.sourceId === "database" || now.getTime() - Date.parse(doc.syncedAt) <= 86400000)) {
          await saveSafety(lock, userId, advanceSafety(doc, now)); count.evaluated++;
        } else await lock.query("UPDATE finbridge_safety SET updated_at=CURRENT_TIMESTAMP WHERE user_id=$1", [userId]);
        await lock.query("COMMIT");
      } catch (e) { await lock.query("ROLLBACK"); throw e; }
    }
    const pending = await lock.query<{ id: string; user_id: string }>("SELECT id,user_id FROM finbridge_safety_events WHERE event->>'emailStatus'='pending' AND next_attempt_at <= $1 ORDER BY next_attempt_at LIMIT $2", [now, MAX_EMAILS_PER_RUN]);
    for (const item of pending.rows) {
      if (!hasTime(MINIMUM_MAIL_WINDOW_MS)) break;
      // A durable claim precedes I/O. Crash/timeout becomes unknown, never blind retry.
      const claim = await lock.query<{ event: SafetyEvent }>("UPDATE finbridge_safety_events SET event=jsonb_set(event,'{emailStatus}','\"sending\"'),attempts=attempts+1,next_attempt_at=$2 WHERE id=$1 AND event->>'emailStatus'='pending' RETURNING event", [item.id, now]);
      if (!claim.rowCount) continue;
      await lock.query("BEGIN");
      try {
        const user = await lock.query<{ email: string; emailVerified: boolean }>('SELECT email,"emailVerified" FROM "user" WHERE id=$1 FOR SHARE', [item.user_id]);
        const inactive = await lock.query("SELECT 1 FROM finbridge_account_lifecycle WHERE user_id=$1", [item.user_id]);
        const row = await lock.query<{ document: SafetyDocument }>("SELECT document FROM finbridge_safety WHERE user_id=$1 FOR SHARE", [item.user_id]);
        const doc = row.rows[0]?.document, event = claim.rows[0].event;
        const rule = doc?.rules.find(r => r.id === event.ruleId && r.active && r.email);
        const fresh = doc?.snapshot && doc.syncedAt && (doc.sourceId === "database" || now.getTime() - Date.parse(doc.syncedAt) <= 86400000);
        const evaluation = fresh && rule ? evaluateSafety(rule, doc!.snapshot!, now) : null;
        const valid = !inactive.rowCount && user.rows[0]?.emailVerified && evaluation?.state === "alarm" && evaluation.limit === event.evaluation.limit && evaluation.start === event.evaluation.start && evaluation.end === event.evaluation.end;
        let status: SafetyEvent["emailStatus"] = "cancelled";
        if (valid) {
          const sent = await send(user.rows[0].email, doc!.snapshot!.language);
          if (sent === "retry") {
            const attempts = await lock.query<{ attempts: number }>("SELECT attempts FROM finbridge_safety_events WHERE id=$1", [item.id]);
            status = attempts.rows[0].attempts < 3 ? "pending" : "failed"; count.retried++;
          } else { status = sent; count[sent]++; }
        } else count.cancelled++;
        await lock.query("UPDATE finbridge_safety_events SET event=jsonb_set(event,'{emailStatus}',to_jsonb($2::text)),next_attempt_at=$3 WHERE id=$1", [item.id, status, new Date(now.getTime() + 15 * 60000)]);
        await lock.query("COMMIT");
      } catch (e) { await lock.query("ROLLBACK"); throw e; }
    }
    return count;
  } finally { await lock.query("SELECT pg_advisory_unlock(17961015)"); lock.release(); }
}
