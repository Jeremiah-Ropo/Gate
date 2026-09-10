/**
 * Check-in is allowed only on the event's calendar day in Africa/Lagos.
 * Events store a single `starts_at` instant and no timezone column, so Lagos
 * is the product timezone (NGN). Offline scans are judged by `scannedAt`,
 * not by when they later sync.
 */
export const EVENT_TIME_ZONE = "Africa/Lagos";

export function calendarDay(date: Date, timeZone = EVENT_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isEventDay(startsAt: Date, now: Date = new Date()): boolean {
  if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) return false;
  return calendarDay(startsAt) === calendarDay(now);
}
