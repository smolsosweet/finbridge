import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { TRANSFER_REFERENCE_SQL } from "./transfer-reference-repository";
import { transferSandboxEnabled } from "./transfer-runtime";
import { transferCommandSchema, assertTransferReady, quoteTransfer, transferDate, TransferError, TRANSFER_OPENING, TRANSFER_PROVIDERS, TRANSFER_RESERVE, type TransferBill, type TransferCommand, type TransferDocument, type TransferPlan, type TransferQuote } from "./international-transfer";

export const INTERNATIONAL_TRANSFER_SQL = TRANSFER_REFERENCE_SQL + `
CREATE TABLE IF NOT EXISTS finbridge_transfer_controls (
 user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE RESTRICT,
 paused BOOLEAN NOT NULL DEFAULT false, window_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 requests INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS finbridge_transfer_accounts (
 user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
 id TEXT NOT NULL CHECK(id IN ('ALIPAY','BANK_A')), opening NUMERIC(20,0) NOT NULL,
 balance NUMERIC(20,0) NOT NULL CHECK(balance>=0), PRIMARY KEY(user_id,id)
);
CREATE TABLE IF NOT EXISTS finbridge_transfer_bills (
 user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT, id TEXT NOT NULL,
 school_id TEXT NOT NULL, reference TEXT NOT NULL, version INTEGER NOT NULL,
 archived BOOLEAN NOT NULL DEFAULT false, data JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,id), UNIQUE(user_id,school_id,reference)
);
CREATE TABLE IF NOT EXISTS finbridge_transfer_quotes (
 user_id TEXT NOT NULL, id TEXT NOT NULL, bill_id TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
 data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,id), FOREIGN KEY(user_id,bill_id) REFERENCES finbridge_transfer_bills(user_id,id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS finbridge_transfer_plans (
 user_id TEXT NOT NULL, id TEXT NOT NULL, bill_id TEXT NOT NULL, quote_id TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('review','approved','completed','cancelled','invalidated')),
 data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,id), UNIQUE(user_id,quote_id),
 FOREIGN KEY(user_id,bill_id) REFERENCES finbridge_transfer_bills(user_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(user_id,quote_id) REFERENCES finbridge_transfer_quotes(user_id,id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS finbridge_transfer_paid_bill ON finbridge_transfer_plans(user_id,bill_id) WHERE status='completed';
CREATE TABLE IF NOT EXISTS finbridge_transfer_audit (
 user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT, id TEXT NOT NULL,
 event TEXT NOT NULL, target_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,id)
);
CREATE TABLE IF NOT EXISTS finbridge_transfer_mutations (
 user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT, id TEXT NOT NULL,
 content_hash TEXT NOT NULL, result_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,id)
);
CREATE INDEX IF NOT EXISTS finbridge_transfer_plan_time ON finbridge_transfer_plans(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS finbridge_transfer_audit_time ON finbridge_transfer_audit(user_id,created_at DESC);
`;
export type TransferRepository = { read(owner: string): Promise<TransferDocument>; mutate(owner: string, command: TransferCommand): Promise<TransferDocument & { resultId?: string }> };
export function internationalTransferRepository(pool: Pool, clock: () => Date = () => new Date(), options: { sandboxEnabled?: boolean } = {}): TransferRepository {
  const sandboxEnabled = options.sandboxEnabled ?? transferSandboxEnabled();
  async function active(c: PoolClient, owner: string) {
    const user = await c.query('SELECT id FROM "user" WHERE id=$1 AND "emailVerified"=true FOR SHARE', [owner]);
    if (!user.rowCount || (await c.query("SELECT 1 FROM finbridge_account_lifecycle WHERE user_id=$1", [owner])).rowCount) throw new TransferError("UNAUTHENTICATED", 401);
  }
  async function initialize(c: PoolClient, owner: string) {
    await c.query("INSERT INTO finbridge_transfer_controls(user_id) VALUES($1) ON CONFLICT DO NOTHING", [owner]);
    if (sandboxEnabled) for (const id of ["ALIPAY", "BANK_A"]) await c.query("INSERT INTO finbridge_transfer_accounts(user_id,id,opening,balance) VALUES($1,$2,$3,$3) ON CONFLICT DO NOTHING", [owner, id, TRANSFER_OPENING]);
  }
  async function document(c: PoolClient, owner: string): Promise<TransferDocument> {
    const controls = await c.query("SELECT paused FROM finbridge_transfer_controls WHERE user_id=$1", [owner]);
    const accounts = await c.query("SELECT id, opening::float8 AS opening, balance::float8 AS balance, (opening-balance)::float8 AS spent FROM finbridge_transfer_accounts WHERE user_id=$1 ORDER BY id", [owner]);
    const bills = await c.query("SELECT data FROM finbridge_transfer_bills WHERE user_id=$1 ORDER BY created_at DESC,id", [owner]);
    const plans = await c.query("SELECT data FROM finbridge_transfer_plans WHERE user_id=$1 ORDER BY created_at DESC,id LIMIT 201", [owner]);
    const receipts = await c.query("SELECT data FROM finbridge_transfer_plans WHERE user_id=$1 AND status='completed' ORDER BY created_at DESC,id", [owner]);
    const quotes = await c.query("SELECT data FROM finbridge_transfer_quotes WHERE user_id=$1 AND expires_at>$2 ORDER BY created_at DESC,id LIMIT 300", [owner, clock()]);
    const audit = await c.query('SELECT id,event,target_id AS "targetId",created_at AS "createdAt" FROM finbridge_transfer_audit WHERE user_id=$1 ORDER BY created_at DESC,id LIMIT 200', [owner]);
    return { mode: "sandbox", sandboxEnabled, paused: controls.rows[0]?.paused ?? false, reserve: TRANSFER_RESERVE, accounts: accounts.rows, bills: bills.rows.map(r => r.data), quotes: quotes.rows.map(r => r.data), plans: plans.rows.slice(0, 200).map(r => r.data), receipts: receipts.rows.map(r => r.data), audit: audit.rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })), serverTime: clock().toISOString(), hasMore: plans.rows.length > 200 };
  }
  async function audit(c: PoolClient, owner: string, event: string, id: string) { await c.query("INSERT INTO finbridge_transfer_audit(user_id,id,event,target_id) VALUES($1,$2,$3,$4)", [owner, randomUUID(), event, id]); }
  async function bill(c: PoolClient, owner: string, id: string) {
    const r = await c.query("SELECT data FROM finbridge_transfer_bills WHERE user_id=$1 AND id=$2", [owner, id]);
    if (!r.rowCount) throw new TransferError("NOT_FOUND", 404); return r.rows[0].data as TransferBill;
  }
  async function completed(c: PoolClient, owner: string, id: string) { return !!(await c.query("SELECT id FROM finbridge_transfer_plans WHERE user_id=$1 AND bill_id=$2 AND status='completed'", [owner, id])).rowCount; }
  async function savePlan(c: PoolClient, owner: string, plan: TransferPlan) { await c.query("UPDATE finbridge_transfer_plans SET status=$3,data=$4 WHERE user_id=$1 AND id=$2", [owner, plan.id, plan.status, JSON.stringify(plan)]); }
  async function invalidate(c: PoolClient, owner: string, id: string) {
    await c.query("UPDATE finbridge_transfer_plans SET status='invalidated',data=(data-'approvedAt') || '{\"status\":\"invalidated\"}'::jsonb WHERE user_id=$1 AND bill_id=$2 AND status IN ('review','approved')", [owner, id]);
  }
  return {
    async read(owner) {
      const c = await pool.connect();
      try { await c.query("BEGIN"); await active(c, owner); await initialize(c, owner); await c.query("SELECT user_id FROM finbridge_transfer_controls WHERE user_id=$1 FOR SHARE", [owner]); const doc = await document(c, owner); await c.query("COMMIT"); return doc; }
      catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
    },
    async mutate(owner, command) {
      const c = await pool.connect(), now = clock();
      const hash = createHash("sha256").update(JSON.stringify(command)).digest("hex");
      try {
        await c.query("BEGIN"); await active(c, owner);
        if (!sandboxEnabled && ["quote", "draft", "approve", "execute"].includes(command.action)) throw new TransferError("SANDBOX_DISABLED", 403);
        await initialize(c, owner);
        const control = (await c.query("SELECT * FROM finbridge_transfer_controls WHERE user_id=$1 FOR UPDATE", [owner])).rows[0];
        const replay = (await c.query("SELECT * FROM finbridge_transfer_mutations WHERE user_id=$1 AND id=$2", [owner, command.mutationId])).rows[0];
        if (replay) {
          if (replay.content_hash !== hash) throw new TransferError("MUTATION_MISMATCH");
          const doc = await document(c, owner); await c.query("COMMIT"); return { ...doc, resultId: replay.result_id || undefined };
        }
        const rate = await c.query(`UPDATE finbridge_transfer_controls SET requests=CASE WHEN window_at<$2::timestamptz-INTERVAL '1 minute' THEN 1 ELSE requests+1 END,window_at=CASE WHEN window_at<$2::timestamptz-INTERVAL '1 minute' THEN $2 ELSE window_at END WHERE user_id=$1 AND (requests<30 OR window_at<$2::timestamptz-INTERVAL '1 minute') RETURNING user_id`, [owner, now]);
        if (!rate.rowCount) throw new TransferError("RATE_LIMITED", 429);
        let resultId: string | undefined;
        if (command.action === "pause") {
          await c.query("UPDATE finbridge_transfer_controls SET paused=$2 WHERE user_id=$1", [owner, command.paused]);
          if (command.paused) await c.query("UPDATE finbridge_transfer_plans SET status='review',data=(data-'approvedAt') || '{\"status\":\"review\"}'::jsonb WHERE user_id=$1 AND status='approved'", [owner]);
          await audit(c, owner, command.paused ? "paused" : "resumed", owner);
        } else if (command.action === "saveBill" || command.action === "archiveBill") {
          const previous = command.id ? await bill(c, owner, command.id) : null;
          if (previous && previous.version !== command.version) throw new TransferError("BILL_CHANGED");
          if (previous && await completed(c, owner, previous.id)) throw new TransferError("ALREADY_COMPLETED");
          if (!previous && command.action === "archiveBill") throw new TransferError("NOT_FOUND", 404);
          if (command.action === "saveBill" && command.bill.dueDate < transferDate(now)) throw new TransferError("BILL_OVERDUE", 400);
          if (!previous && (await c.query("SELECT id FROM finbridge_transfer_bills WHERE user_id=$1", [owner])).rowCount! >= 100) throw new TransferError("BILL_LIMIT", 400);
          const next: TransferBill = command.action === "saveBill" ? { ...command.bill, id: previous?.id || randomUUID(), version: (previous?.version || 0) + 1, archived: previous?.archived || false, createdAt: previous?.createdAt || now.toISOString() } : { ...previous!, version: previous!.version + 1, archived: command.archived };
          await c.query(`INSERT INTO finbridge_transfer_bills(user_id,id,school_id,reference,version,archived,data) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id,id) DO UPDATE SET school_id=$3,reference=$4,version=$5,archived=$6,data=$7,updated_at=CURRENT_TIMESTAMP`, [owner, next.id, next.schoolId, next.reference, next.version, next.archived, JSON.stringify(next)]);
          await invalidate(c, owner, next.id); resultId = next.id;
          await audit(c, owner, command.action === "saveBill" ? previous ? "billUpdated" : "billCreated" : next.archived ? "billArchived" : "billRestored", next.id);
        } else if (command.action === "quote") {
          const b = await bill(c, owner, command.id);
          if (b.archived || b.version !== command.version) throw new TransferError("BILL_CHANGED");
          if (await completed(c, owner, b.id)) throw new TransferError("ALREADY_COMPLETED");
          if (b.dueDate < transferDate(now)) throw new TransferError("BILL_OVERDUE");
          await invalidate(c, owner, b.id);
          // Refresh invalidates old quotes as well as old approvals.
          await c.query("UPDATE finbridge_transfer_quotes SET expires_at=$3 WHERE user_id=$1 AND bill_id=$2 AND expires_at>$3", [owner, b.id, now]);
          for (const provider of TRANSFER_PROVIDERS) {
            const q = quoteTransfer(b, provider, now, randomUUID());
            await c.query("INSERT INTO finbridge_transfer_quotes(user_id,id,bill_id,expires_at,data) VALUES($1,$2,$3,$4,$5)", [owner, q.id, b.id, q.expiresAt, JSON.stringify(q)]);
          }
          resultId = b.id; await audit(c, owner, "quoted", b.id);
        } else if (command.action === "draft") {
          const row = (await c.query("SELECT data,expires_at FROM finbridge_transfer_quotes WHERE user_id=$1 AND id=$2", [owner, command.quoteId])).rows[0];
          if (!row) throw new TransferError("NOT_FOUND", 404);
          if (+now >= +row.expires_at) throw new TransferError("QUOTE_EXPIRED");
          const q: TransferQuote = row.data, b = await bill(c, owner, q.billId);
          if (await completed(c, owner, b.id)) throw new TransferError("ALREADY_COMPLETED");
          const existing = (await c.query("SELECT data FROM finbridge_transfer_plans WHERE user_id=$1 AND quote_id=$2", [owner, q.id])).rows[0];
          if (existing) { resultId = existing.data.id; }
          else {
            const p: TransferPlan = { id: randomUUID(), bill: b, quote: q, status: "review", createdAt: now.toISOString() };
            const account = (await c.query("SELECT balance FROM finbridge_transfer_accounts WHERE user_id=$1 AND id=$2", [owner, q.provider])).rows[0];
            assertTransferReady(p, b, control.paused, Number(account?.balance || 0), now);
            await invalidate(c, owner, b.id);
            await c.query("INSERT INTO finbridge_transfer_plans(user_id,id,bill_id,quote_id,status,data) VALUES($1,$2,$3,$4,$5,$6)", [owner, p.id, b.id, q.id, p.status, JSON.stringify(p)]);
            resultId = p.id; await audit(c, owner, "drafted", p.id);
          }
        } else {
          const row = (await c.query("SELECT data FROM finbridge_transfer_plans WHERE user_id=$1 AND id=$2", [owner, command.id])).rows[0];
          if (!row) throw new TransferError("NOT_FOUND", 404);
          const p: TransferPlan = row.data;
          resultId = p.id;
          if (p.status === "completed") { if (command.action !== "execute") throw new TransferError("ALREADY_COMPLETED"); }
          else if (command.action === "cancel") {
            if (!["review", "approved"].includes(p.status)) throw new TransferError("BILL_CHANGED");
            p.status = "cancelled"; delete p.approvedAt; await savePlan(c, owner, p); await audit(c, owner, "cancelled", p.id);
          } else {
            const b = await bill(c, owner, p.bill.id);
            if (await completed(c, owner, b.id)) throw new TransferError("ALREADY_COMPLETED");
            const account = (await c.query("SELECT balance FROM finbridge_transfer_accounts WHERE user_id=$1 AND id=$2 FOR UPDATE", [owner, p.quote.provider])).rows[0];
            const balance = Number(account?.balance || 0);
            assertTransferReady(p, b, control.paused, balance, now, command.action === "execute");
            if (command.action === "approve") {
              p.status = "approved"; p.approvedAt = now.toISOString(); await savePlan(c, owner, p); await audit(c, owner, "approved", p.id);
            } else {
              p.status = "completed"; p.completedAt = now.toISOString(); p.receiptId = randomUUID(); p.balanceBefore = balance; p.balanceAfter = balance - p.quote.total;
              await c.query("UPDATE finbridge_transfer_accounts SET balance=$3 WHERE user_id=$1 AND id=$2", [owner, p.quote.provider, p.balanceAfter]);
              await savePlan(c, owner, p); await invalidate(c, owner, b.id); await audit(c, owner, "completed", p.id);
            }
          }
        }
        await c.query("INSERT INTO finbridge_transfer_mutations(user_id,id,content_hash,result_id) VALUES($1,$2,$3,$4)", [owner, command.mutationId, hash, resultId || null]);
        const doc = await document(c, owner); await c.query("COMMIT"); return { ...doc, resultId };
      } catch (e) { await c.query("ROLLBACK"); if ((e as { code?: string }).code === "23505") throw new TransferError("DUPLICATE_REFERENCE"); throw e; } finally { c.release(); }
    },
  };
}

export function createInMemoryTransferRepository(clock: () => Date = () => new Date(), options: { sandboxEnabled?: boolean } = {}): TransferRepository {
  const enabled = options.sandboxEnabled ?? transferSandboxEnabled();
  const documents = new Map<string, TransferDocument>();
  const mutations = new Map<string, Map<string, { hash: string; resultId?: string }>>();
  const limits = new Map<string, { at: number; requests: number }>();
  function getDoc(owner: string): TransferDocument {
    return documents.get(owner) || { mode: "sandbox", sandboxEnabled: enabled, paused: false, reserve: TRANSFER_RESERVE,
      accounts: enabled ? (["ALIPAY", "BANK_A"] as const).map(id => ({ id, opening: TRANSFER_OPENING, spent: 0, balance: TRANSFER_OPENING })) : [],
      bills: [], quotes: [], plans: [], receipts: [], audit: [], serverTime: clock().toISOString(), hasMore: false };
  }
  function view(doc: TransferDocument): TransferDocument {
    return structuredClone({ ...doc, quotes: doc.quotes.filter(q => Date.parse(q.expiresAt) > +clock()),
      plans: doc.plans.slice(0, 200), receipts: doc.plans.filter(p => p.status === "completed"),
      audit: doc.audit.slice(0, 200), serverTime: clock().toISOString(), hasMore: doc.plans.length > 200 });
  }
  return {
    async read(owner) { return view(getDoc(owner)); },
    async mutate(owner, untrusted) {
      const parsed = transferCommandSchema.safeParse(untrusted);
      if (!parsed.success) throw new TransferError("INVALID_COMMAND", 400);
      const command = parsed.data, now = clock(), hash = createHash("sha256").update(JSON.stringify(command)).digest("hex");
      if (!enabled && ["quote", "draft", "approve", "execute"].includes(command.action)) throw new TransferError("SANDBOX_DISABLED", 403);
      const saved = mutations.get(owner) || new Map<string, { hash: string; resultId?: string }>();
      const previous = saved.get(command.mutationId);
      if (previous) {
        if (previous.hash !== hash) throw new TransferError("MUTATION_MISMATCH");
        return { ...view(getDoc(owner)), resultId: previous.resultId };
      }
      const limit = limits.get(owner);
      if (limit && +now - limit.at < 60_000 && limit.requests >= 30) throw new TransferError("RATE_LIMITED", 429);
      // Copy-on-write gives the demo the same all-or-nothing behavior on failure.
      const doc = structuredClone(getDoc(owner));
      const bill = (id: string) => { const b = doc.bills.find(b => b.id === id); if (!b) throw new TransferError("NOT_FOUND", 404); return b; };
      const paid = (id: string) => doc.plans.some(p => p.bill.id === id && p.status === "completed");
      const invalidate = (id: string) => { for (const p of doc.plans) if (p.bill.id === id && ["review", "approved"].includes(p.status)) { p.status = "invalidated"; delete p.approvedAt; } };
      const audit = (event: string, targetId: string) => doc.audit.unshift({ id: randomUUID(), event, targetId, createdAt: now.toISOString() });
      let resultId: string | undefined;
      if (command.action === "pause") {
        doc.paused = command.paused;
        if (command.paused) for (const p of doc.plans) if (p.status === "approved") { p.status = "review"; delete p.approvedAt; }
        audit(command.paused ? "paused" : "resumed", owner);
      } else if (command.action === "saveBill" || command.action === "archiveBill") {
        const before = command.id ? bill(command.id) : null;
        if (before && before.version !== command.version) throw new TransferError("BILL_CHANGED");
        if (before && paid(before.id)) throw new TransferError("ALREADY_COMPLETED");
        if (command.action === "saveBill" && command.bill.dueDate < transferDate(now)) throw new TransferError("BILL_OVERDUE", 400);
        if (!before && doc.bills.length >= 100) throw new TransferError("BILL_LIMIT", 400);
        const next: TransferBill = command.action === "saveBill"
          ? { ...command.bill, id: before?.id || randomUUID(), version: (before?.version || 0) + 1, archived: before?.archived || false, createdAt: before?.createdAt || now.toISOString() }
          : { ...before!, version: before!.version + 1, archived: command.archived };
        if (doc.bills.some(b => b.id !== next.id && b.schoolId === next.schoolId && b.reference === next.reference)) throw new TransferError("DUPLICATE_REFERENCE");
        doc.bills = [next, ...doc.bills.filter(b => b.id !== next.id)];
        invalidate(next.id); resultId = next.id;
        audit(command.action === "saveBill" ? before ? "billUpdated" : "billCreated" : next.archived ? "billArchived" : "billRestored", next.id);
      } else if (command.action === "quote") {
        const b = bill(command.id);
        if (b.archived || b.version !== command.version) throw new TransferError("BILL_CHANGED");
        if (paid(b.id)) throw new TransferError("ALREADY_COMPLETED");
        if (b.dueDate < transferDate(now)) throw new TransferError("BILL_OVERDUE");
        invalidate(b.id);
        for (const q of doc.quotes) if (q.billId === b.id) q.expiresAt = now.toISOString();
        doc.quotes.push(...TRANSFER_PROVIDERS.map(provider => quoteTransfer(b, provider, now, randomUUID())));
        resultId = b.id; audit("quoted", b.id);
      } else if (command.action === "draft") {
        const q = doc.quotes.find(q => q.id === command.quoteId);
        if (!q) throw new TransferError("NOT_FOUND", 404);
        if (+now >= Date.parse(q.expiresAt)) throw new TransferError("QUOTE_EXPIRED");
        const b = bill(q.billId);
        if (paid(b.id)) throw new TransferError("ALREADY_COMPLETED");
        const existing = doc.plans.find(p => p.quote.id === q.id);
        if (existing) resultId = existing.id;
        else {
          const p: TransferPlan = { id: randomUUID(), bill: structuredClone(b), quote: structuredClone(q), status: "review", createdAt: now.toISOString() };
          assertTransferReady(p, b, doc.paused, doc.accounts.find(a => a.id === q.provider)?.balance || 0, now);
          invalidate(b.id); doc.plans.unshift(p); resultId = p.id; audit("drafted", p.id);
        }
      } else {
        const p = doc.plans.find(p => p.id === command.id);
        if (!p) throw new TransferError("NOT_FOUND", 404);
        resultId = p.id;
        if (p.status === "completed") {
          if (command.action !== "execute") throw new TransferError("ALREADY_COMPLETED");
        } else if (command.action === "cancel") {
          if (!["review", "approved"].includes(p.status)) throw new TransferError("BILL_CHANGED");
          p.status = "cancelled"; delete p.approvedAt; audit("cancelled", p.id);
        } else {
          const b = bill(p.bill.id);
          if (paid(b.id)) throw new TransferError("ALREADY_COMPLETED");
          const account = doc.accounts.find(a => a.id === p.quote.provider);
          const balance = account?.balance || 0;
          assertTransferReady(p, b, doc.paused, balance, now, command.action === "execute");
          if (command.action === "approve") {
            p.status = "approved"; p.approvedAt = now.toISOString(); audit("approved", p.id);
          } else {
            p.status = "completed"; p.completedAt = now.toISOString(); p.receiptId = randomUUID();
            p.balanceBefore = balance; p.balanceAfter = balance - p.quote.total;
            account!.balance = p.balanceAfter; account!.spent += p.quote.total;
            invalidate(b.id); audit("completed", p.id);
          }
        }
      }
      saved.set(command.mutationId, { hash, resultId }); mutations.set(owner, saved);
      limits.set(owner, limit && +now - limit.at < 60_000 ? { ...limit, requests: limit.requests + 1 } : { at: +now, requests: 1 });
      documents.set(owner, doc);
      return { ...view(doc), resultId };
    },
  };
}
