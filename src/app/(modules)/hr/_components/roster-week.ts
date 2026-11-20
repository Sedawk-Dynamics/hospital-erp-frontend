// Gap 313: the roster built its day keys with toISOString() (UTC). In IST the
// local Sunday midnight is Saturday 18:30 UTC, so the columns ran Sat–Fri while
// the heading said "week of <Sunday>". Everything here works in local dates.

/** Local YYYY-MM-DD (never via UTC). */
export function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD key as a local date (new Date('YYYY-MM-DD') is UTC). */
export function fromLocalYmd(ymd: string): Date {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

/** 0 = Sunday … 6 = Saturday (Date#getDay). */
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/**
 * Local midnight of the week containing `d`. Gap 313: the first day comes from
 * the HR setting "roster week start day" (default Sunday) instead of being
 * hard-coded, so heading, columns and prev/next all follow it.
 */
export function startOfWeek(d: Date, weekStartDay = 0): Date {
  const start = Number.isInteger(weekStartDay) && weekStartDay >= 0 && weekStartDay <= 6 ? weekStartDay : 0;
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  date.setDate(date.getDate() - ((date.getDay() - start + 7) % 7));
  return date;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

/** The 7 column keys for the week starting at `weekStart`. */
export function weekDays(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => toLocalYmd(addDays(weekStart, i)));
}

/** Heading built from the first and last column, e.g. "Sun 8 Nov – Sat 14 Nov 2026". */
export function weekHeading(days: string[]): string {
  const fmt = (ymd: string, withYear: boolean) =>
    fromLocalYmd(ymd).toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}),
    });
  return `${fmt(days[0]!, false)} – ${fmt(days[days.length - 1]!, true)}`;
}
