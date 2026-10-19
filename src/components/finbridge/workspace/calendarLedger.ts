// Transactions store their accounting day first, optionally followed by a time.
// Keep that day as recorded; parsing an ISO timestamp would shift it by timezone.
export function ledgerDateKey(value: string): string | null {
  const key = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const date = new Date(key + "T12:00:00");
  if (!Number.isFinite(date.getTime())) return null;
  return date.getFullYear() === Number(key.slice(0, 4)) &&
    date.getMonth() + 1 === Number(key.slice(5, 7)) &&
    date.getDate() === Number(key.slice(8, 10)) ? key : null;
}
