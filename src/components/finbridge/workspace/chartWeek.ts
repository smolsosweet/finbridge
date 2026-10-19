export function localDateKey(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function calendarWeek(dateKey: string): { start: string; end: string; days: string[] } {
  const date = new Date(dateKey + "T12:00:00");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !Number.isFinite(date.getTime()) || localDateKey(date) !== dateKey) {
    throw new RangeError("Invalid calendar date");
  }
  date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  const days = Array.from({ length: 7 }, (_, index) => {
    const next = new Date(date);
    next.setDate(next.getDate() + index);
    return localDateKey(next);
  });
  return { start: days[0], end: days[6], days };
}

export function shiftCalendarWeek(start: string, weeks: number): string {
  const date = new Date(start + "T12:00:00");
  date.setDate(date.getDate() + weeks * 7);
  return localDateKey(date);
}
