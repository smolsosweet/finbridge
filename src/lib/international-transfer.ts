import { z } from "zod";

// Ported from the original FinBridge education-payment sandbox. These are
// fixed synthetic fixtures, never market quotes or bank capabilities.
export const TRANSFER_PROVIDERS = ["ALIPAY", "BANK_A", "BANK_B"] as const;
export const TRANSFER_SCHOOLS = [
  { id: "shenzhen", name: "Shenzhen Demo University", country: "CN", currency: "CNY", recipient: "Shenzhen Demo University Tuition Office", bank: "Shenzhen Demo Education Bank", bankCode: "SZDUCNBSXXX", account: "SZDU-TUITION-2026" },
  { id: "pacific", name: "Pacific Demo College", country: "US", currency: "USD", recipient: "Pacific Demo College Bursar", bank: "Pacific Demo Bank", bankCode: "PDCMUS33XXX", account: "PDC-TUITION-USD" },
  { id: "sydney", name: "Sydney Demo Institute", country: "AU", currency: "AUD", recipient: "Sydney Demo Institute Fees Office", bank: "Sydney Demo Bank", bankCode: "SDIIAU2SXXX", account: "SDI-TUITION-AUD" },
] as const;
export const TRANSFER_RESERVE = 3_000_000;
export const TRANSFER_OPENING = 100_000_000;
export const TRANSFER_QUOTE_MS = 5 * 60_000;
export const TRANSFER_APPROVAL_MS = 2 * 60_000;
const text = z.string().trim().min(1).max(140).refine(s => !/[\u0000-\u001f]/.test(s));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => { const d = new Date(s + "T00:00:00Z"); return Number.isFinite(+d) && d.toISOString().slice(0, 10) === s; });
export const transferBillSchema = z.object({
  schoolId: z.enum(["shenzhen", "pacific", "sydney"]), title: text,
  amount: z.string().regex(/^\d{1,7}(\.\d{1,2})?$/).refine(s => Number(s) > 0 && Number(s) <= 1_000_000),
  dueDate: date, reference: text,
}).strict();
export type TransferBillInput = z.infer<typeof transferBillSchema>;
export type TransferBill = TransferBillInput & { id: string; version: number; archived: boolean; createdAt: string };
export type TransferQuote = {
  id: string; billId: string; billVersion: number; provider: typeof TRANSFER_PROVIDERS[number];
  eligible: boolean; rate: string; conversion: number; transferFee: number; fxMarkup: number; total: number;
  receiveAmount: string; currency: string; minDays: number; maxDays: number;
  quotedAt: string; expiresAt: string; arrivalDate: string; latestSendDate: string; deadlineRisk: boolean;
};
export type TransferPlan = {
  id: string; bill: TransferBill; quote: TransferQuote;
  status: "review" | "approved" | "completed" | "cancelled" | "invalidated";
  createdAt: string; approvedAt?: string; completedAt?: string; receiptId?: string;
  balanceBefore?: number; balanceAfter?: number;
};
export type TransferAccount = { id: "ALIPAY" | "BANK_A"; opening: number; spent: number; balance: number };
export type TransferAudit = { id: string; event: string; targetId: string; createdAt: string };
export type TransferDocument = { mode: "sandbox"; sandboxEnabled?: boolean; paused: boolean; reserve: number; accounts: TransferAccount[]; bills: TransferBill[]; quotes: TransferQuote[]; plans: TransferPlan[]; receipts: TransferPlan[]; audit: TransferAudit[]; serverTime: string; hasMore: boolean };
const key = z.string().uuid(), id = z.string().uuid();
export const transferCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("saveBill"), mutationId: key, id: id.optional(), version: z.number().int().positive().optional(), bill: transferBillSchema }).strict(),
  z.object({ action: z.literal("archiveBill"), mutationId: key, id, version: z.number().int().positive(), archived: z.boolean() }).strict(),
  z.object({ action: z.literal("quote"), mutationId: key, id, version: z.number().int().positive() }).strict(),
  z.object({ action: z.literal("draft"), mutationId: key, quoteId: id }).strict(),
  z.object({ action: z.literal("approve"), mutationId: key, id, acknowledge: z.literal(true) }).strict(),
  z.object({ action: z.literal("execute"), mutationId: key, id }).strict(),
  z.object({ action: z.literal("cancel"), mutationId: key, id }).strict(),
  z.object({ action: z.literal("pause"), mutationId: key, paused: z.boolean() }).strict(),
]);
export type TransferCommand = z.infer<typeof transferCommandSchema>;
export class TransferError extends Error {
  code: string; status: number;
  constructor(code: string, status = 409) { super(code); this.code = code; this.status = status; }
}
export function transferDate(now: Date) { return now.toISOString().slice(0, 10); }
function shiftDate(date: string, days: number) { const d = new Date(date + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return transferDate(d); }
// BigInt rational arithmetic rounds once per VND component. API money inputs
// remain decimal strings; VND totals are validated safe integers.
function rounded(n: bigint, d: bigint) { const value = Number((n + d / BigInt(2)) / d); if (!Number.isSafeInteger(value)) throw new TransferError("INVALID_COMMAND", 400); return value; }
export function quoteTransfer(bill: TransferBill, provider: TransferQuote["provider"], now: Date, quoteId: string): TransferQuote {
  const school = TRANSFER_SCHOOLS.find(s => s.id === bill.schoolId)!;
  const china = school.currency === "CNY";
  const rates = china ? [3535, 3520, 3480] : school.currency === "USD" ? [26100, 26100, 25950] : [17200, 17200, 17080];
  const index = TRANSFER_PROVIDERS.indexOf(provider), rate = rates[index];
  const [whole, fraction = ""] = bill.amount.split("."); const minor = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  const conversion = rounded(minor * BigInt(rate), BigInt(100));
  const transferFee = china ? [120000, 220000, 100000][index] : [120000, 260000, 150000][index];
  const markupBps = [30, 20, 10][index], fxMarkup = rounded(BigInt(conversion) * BigInt(markupBps), BigInt(10000));
  const maxDays = index === 0 ? 1 : index === 1 ? 3 : 2;
  const arrivalDate = shiftDate(transferDate(now), maxDays);
  return { id: quoteId, billId: bill.id, billVersion: bill.version, provider, eligible: provider !== "BANK_B" && (provider !== "ALIPAY" || china), rate: String(rate), conversion, transferFee, fxMarkup, total: conversion + transferFee + fxMarkup, receiveAmount: bill.amount, currency: school.currency, minDays: index === 1 ? 2 : 1, maxDays, quotedAt: now.toISOString(), expiresAt: new Date(+now + TRANSFER_QUOTE_MS).toISOString(), arrivalDate, latestSendDate: shiftDate(bill.dueDate, -maxDays - 1), deadlineRisk: shiftDate(arrivalDate, 1) > bill.dueDate };
}
export function assertTransferReady(plan: TransferPlan, bill: TransferBill, paused: boolean, balance: number, now: Date, execute = false) {
  if (paused) throw new TransferError("PAUSED");
  if (bill.archived || plan.bill.version !== bill.version || plan.bill.id !== bill.id || plan.status === "invalidated") throw new TransferError("BILL_CHANGED");
  if (plan.status === "cancelled") throw new TransferError("CANCELLED");
  if (!plan.quote.eligible || plan.quote.provider === "BANK_B") throw new TransferError("CHANNEL_UNAVAILABLE");
  if (+now >= Date.parse(plan.quote.expiresAt)) throw new TransferError("QUOTE_EXPIRED");
  if (transferDate(now) > bill.dueDate) throw new TransferError("BILL_OVERDUE");
  if (!Number.isSafeInteger(balance) || balance - plan.quote.total < TRANSFER_RESERVE) throw new TransferError("INSUFFICIENT_RESERVE");
  if (execute && (plan.status !== "approved" || !plan.approvedAt || +now - Date.parse(plan.approvedAt) >= TRANSFER_APPROVAL_MS)) throw new TransferError("APPROVAL_REQUIRED");
}
