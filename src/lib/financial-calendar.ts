/** Calendar dates are compared as dates, never by elapsed local-time hours. */
export function financialCalendarDate(now: Date, timeZone?: string) {
  let zone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  try { new Intl.DateTimeFormat("en", { timeZone: zone }).format(now); }
  catch { zone = "UTC"; }
  const parts = new Intl.DateTimeFormat("en", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return ["year", "month", "day"].map(key => parts.find(part => part.type === key)!.value).join("-");
}
