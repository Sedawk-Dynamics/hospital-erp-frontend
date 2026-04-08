/**
 * Centralized date formatting — dd/MM/yyyy format, IST timezone.
 * All display dates in the app should use these helpers.
 *
 * Uses Intl.DateTimeFormat for accurate IST conversion regardless of system timezone.
 */
import { format, formatDistanceToNow } from 'date-fns';

const IST_TIMEZONE = 'Asia/Kolkata';

// ============================================================
// Core: Extract IST date/time parts from any Date
// ============================================================

/** Intl formatter that gives us individual IST parts */
const istPartFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: IST_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

interface ISTParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;  // 0-23
  minute: number;
  second: number;
}

/** Extract exact IST date/time parts using Intl (no drift). */
function getISTParts(date: Date): ISTParts {
  const parts = istPartFormatter.formatToParts(date);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** Parse input to a valid Date, or return null. */
function parseDate(date: Date | string | null | undefined): Date | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  return d;
}

/** Pad a number to 2 digits */
function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

// ============================================================
// Date formatting
// ============================================================

/** dd/MM/yyyy */
export function formatDate(date: Date | string | null | undefined): string {
  const d = parseDate(date);
  if (!d) return '-';
  const p = getISTParts(d);
  return `${pad(p.day)}/${pad(p.month)}/${p.year}`;
}

/** dd/MM/yyyy HH:mm */
export function formatDateTime(date: Date | string | null | undefined): string {
  const d = parseDate(date);
  if (!d) return '-';
  const p = getISTParts(d);
  return `${pad(p.day)}/${pad(p.month)}/${p.year} ${pad(p.hour)}:${pad(p.minute)}`;
}

/** dd/MM/yyyy, hh:mm a */
export function formatDateTimeAmPm(date: Date | string | null | undefined): string {
  const d = parseDate(date);
  if (!d) return '-';
  const p = getISTParts(d);
  const ampm = p.hour >= 12 ? 'PM' : 'AM';
  const h12 = p.hour % 12 || 12;
  return `${pad(p.day)}/${pad(p.month)}/${p.year}, ${pad(h12)}:${pad(p.minute)} ${ampm}`;
}

/** dd/MM/yyyy hh:mm a (without comma) */
export function formatDateTimeAmPmNoComma(date: Date | string | null | undefined): string {
  const d = parseDate(date);
  if (!d) return '-';
  const p = getISTParts(d);
  const ampm = p.hour >= 12 ? 'PM' : 'AM';
  const h12 = p.hour % 12 || 12;
  return `${pad(p.day)}/${pad(p.month)}/${p.year} ${pad(h12)}:${pad(p.minute)} ${ampm}`;
}

/** EEEE, dd/MM/yyyy (e.g. "Monday, 15/01/2024") */
export function formatDateLong(date: Date | string | null | undefined): string {
  const d = parseDate(date);
  if (!d) return '-';
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: IST_TIMEZONE,
    weekday: 'long',
  }).format(d);
  const p = getISTParts(d);
  return `${weekday}, ${pad(p.day)}/${pad(p.month)}/${p.year}`;
}

// ============================================================
// Time formatting
// ============================================================

/** hh:mm a (12-hour time). Handles plain "HH:mm" strings, ISO strings, and Date objects.
 *  For @db.Time() fields (1970-01-01T..Z), reads UTC hours directly since backend
 *  stores IST values as UTC in Time columns. */
export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return '-';
  // Plain time string like "09:00" or "14:30:00" — convert to 12-hour
  if (typeof date === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(date)) {
    const [h, m] = date.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${pad(hour)}:${pad(m)} ${ampm}`;
  }
  const d = parseDate(date);
  if (!d) return '-';
  // @db.Time() fields come as "1970-01-01T..." — read UTC directly (backend stores IST as UTC)
  if (typeof date === 'string' && date.startsWith('1970-01-01')) {
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${pad(h12)}:${pad(m)} ${ampm}`;
  }
  const p = getISTParts(d);
  const ampm = p.hour >= 12 ? 'PM' : 'AM';
  const h12 = p.hour % 12 || 12;
  return `${pad(h12)}:${pad(p.minute)} ${ampm}`;
}

/** HH:mm (24-hour time). Handles plain "HH:mm" strings, ISO strings, and Date objects.
 *  For @db.Time() fields (1970-01-01T..Z), reads UTC hours directly since backend
 *  stores IST values as UTC in Time columns. */
export function formatTime24(date: Date | string | null | undefined): string {
  if (!date) return '-';
  // Plain time string like "09:00" or "14:30:00" — return as HH:mm directly
  if (typeof date === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(date)) {
    return date.slice(0, 5);
  }
  const d = parseDate(date);
  if (!d) return '-';
  // @db.Time() fields come as "1970-01-01T..." — read UTC directly (backend stores IST as UTC)
  if (typeof date === 'string' && date.startsWith('1970-01-01')) {
    return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  }
  const p = getISTParts(d);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** MMM yyyy (e.g. "Jan 2024") — for expiry dates */
export function formatMonthYear(date: Date | string | null | undefined): string {
  const d = parseDate(date);
  if (!d) return '-';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: IST_TIMEZONE,
    month: 'short',
    year: 'numeric',
  }).format(d);
}

// ============================================================
// Relative / special formats
// ============================================================

/** Relative time (e.g. "2 hours ago") with fallback to dd/MM/yyyy */
export function formatRelativeDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  const now = new Date();
  const diffInHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
  if (diffInHours < 24) {
    return formatDistanceToNow(d, { addSuffix: true });
  }
  return formatDate(d);
}

// ============================================================
// Live IST helpers (always current, no drift)
// ============================================================

/** Get current IST time as "HH:mm" — live, uses Intl directly. */
export function getCurrentISTTime(): string {
  const p = getISTParts(new Date());
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Get current IST date as "yyyy-MM-dd" — live. */
export function getCurrentISTDate(): string {
  const p = getISTParts(new Date());
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Check if a given date (yyyy-MM-dd) is today in IST */
export function isToday(dateStr: string): boolean {
  return dateStr === getCurrentISTDate();
}

/** yyyy-MM-dd — for HTML date inputs and API query params (not for display) */
export function toInputDateStr(date?: Date | string): string {
  const d = date
    ? typeof date === 'string' ? new Date(date) : date
    : new Date();
  if (isNaN(d.getTime())) {
    const p = getISTParts(new Date());
    return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  }
  const p = getISTParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}
