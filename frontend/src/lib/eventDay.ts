const EVENT_TIME_ZONE = "Africa/Lagos";

export function calendarDay(date: Date, timeZone = EVENT_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isEventDay(startsAt: string | Date, now: Date = new Date()): boolean {
  return calendarDay(new Date(startsAt)) === calendarDay(now);
}
