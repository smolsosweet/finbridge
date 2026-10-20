import { z } from "zod";

export const REFERENCE_CURRENCIES = ["CNY", "USD", "AUD"] as const;
export type ReferenceCurrency = typeof REFERENCE_CURRENCIES[number];
export const ALL_REFERENCE_CURRENCIES = ["VND", "CNY", "USD", "AUD"] as const;
export type SupportedReferenceCurrency = typeof ALL_REFERENCE_CURRENCIES[number];
export const REFERENCE_CACHE_MS = 6 * 60 * 60_000;
const DAY = 24 * 60 * 60_000;
export type ReferenceRate = {
  id: string; base: ReferenceCurrency; quote: "VND"; rate: string;
  date: string; fetchedAt: string; source: "Frankfurter";
};
export type ReferenceEstimate = {
  id: string; amount: string; convertedVnd: string; createdAt: string;
  reference: ReferenceRate;
};
export type ReferenceDocument = {
  rates: { currency: ReferenceCurrency; reference: ReferenceRate | null; cached: boolean; usable: boolean }[];
  estimates: ReferenceEstimate[]; serverTime: string;
};
export class ReferenceError extends Error {
  code: string; status: number;
  constructor(code: string, status = 409) { super(code); this.code = code; this.status = status; }
}
export const estimateInputSchema = z.object({
  mutationId: z.string().uuid(), referenceId: z.string().uuid(),
  amount: z.string().regex(/^\d{1,7}(\.\d{1,2})?$/).refine(s => Number(s) > 0 && Number(s) <= 1_000_000),
}).strict();
export type EstimateInput = z.infer<typeof estimateInputSchema>;

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const date = new Date(s + "T00:00:00Z");
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === s;
});
const payloadSchema = z.object({ date: daySchema, base: z.enum(REFERENCE_CURRENCIES), quote: z.literal("VND"), rate: z.number().positive().finite().max(1_000_000_000) });
export function referenceUsable(reference: ReferenceRate, now: Date) {
  const date = Date.parse(reference.date + "T00:00:00Z"), fetched = Date.parse(reference.fetchedAt);
  const today = Date.parse(now.toISOString().slice(0, 10) + "T00:00:00Z");
  return Number.isFinite(date) && Number.isFinite(fetched) && date <= today && today - date <= 7 * DAY && fetched <= +now && +now - fetched < DAY;
}
export function parseReferencePayload(value: unknown, currency: ReferenceCurrency, now: Date): Omit<ReferenceRate, "id"> {
  const parsed = payloadSchema.safeParse(value);
  if (!parsed.success || parsed.data.base !== currency) throw new ReferenceError("RATE_UNAVAILABLE", 503);
  const rate = String(parsed.data.rate);
  if (!/^\d{1,10}(\.\d{1,10})?$/.test(rate)) throw new ReferenceError("RATE_UNAVAILABLE", 503);
  const reference = { ...parsed.data, rate, fetchedAt: now.toISOString(), source: "Frankfurter" as const };
  if (!referenceUsable({ ...reference, id: "" }, now)) throw new ReferenceError("RATE_UNAVAILABLE", 503);
  return reference;
}
// Only the public currency pair is sent upstream. Never send user, bill or bank data.
const inFlight = new Map<ReferenceCurrency, Promise<Omit<ReferenceRate, "id">>>();
const retryAfter = new Map<ReferenceCurrency, number>();
export async function fetchReferenceRate(currency: ReferenceCurrency, now: Date, transport: typeof fetch = fetch): Promise<Omit<ReferenceRate, "id">> {
  if (transport !== fetch) return fetchRate(currency, now, transport);
  if ((retryAfter.get(currency) || 0) > Date.now()) throw new ReferenceError("RATE_UNAVAILABLE", 503);
  const current = inFlight.get(currency); if (current) return current;
  const request = fetchRate(currency, now, transport).catch(error => { retryAfter.set(currency, Date.now() + 30000); throw error; }).finally(() => inFlight.delete(currency));
  inFlight.set(currency, request); return request;
}
async function fetchRate(currency: ReferenceCurrency, now: Date, transport: typeof fetch) {
  const response = await transport(`https://api.frankfurter.dev/v2/rate/${currency.toLowerCase()}/vnd`, {
    signal: AbortSignal.timeout(5000), redirect: "error", cache: "no-store", headers: { Accept: "application/json" },
  });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new ReferenceError("RATE_UNAVAILABLE", 503);
  const reader = response.body?.getReader();
  if (!reader) throw new ReferenceError("RATE_UNAVAILABLE", 503);
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 8192) { await reader.cancel(); throw new ReferenceError("RATE_UNAVAILABLE", 503); }
      chunks.push(value);
    }
    return parseReferencePayload(JSON.parse(Buffer.concat(chunks).toString("utf8")), currency, now);
  } catch { throw new ReferenceError("RATE_UNAVAILABLE", 503); }
  finally { reader.releaseLock(); }
}
// Decimal strings + integer arithmetic: round only the final VND amount, half up.
export function referenceConversion(amount: string, rate: string): string {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || Number(amount) > 1_000_000 || !/^\d{1,10}(\.\d{1,10})?$/.test(rate) || Number(rate) <= 0) throw new ReferenceError("INVALID_COMMAND", 400);
  const [whole, cents = ""] = amount.split("."), [integer, fraction = ""] = rate.split(".");
  const numerator = (BigInt(whole) * BigInt(100) + BigInt(cents.padEnd(2, "0"))) * BigInt(integer + fraction);
  const denominator = BigInt(100) * BigInt(10) ** BigInt(fraction.length);
  const result = (numerator + denominator / BigInt(2)) / denominator;
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new ReferenceError("INVALID_COMMAND", 400);
  return result.toString();
}
