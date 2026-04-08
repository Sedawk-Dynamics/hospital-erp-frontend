/**
 * Centralized date formatting — dd/MM/yyyy format, IST timezone.
 * All display dates in the app should use these helpers.
 */
import { format, formatDistanceToNow } from 'date-fns';

const IST_TIMEZONE = 'Asia/Kolkata';

/** Convert any date to IST Date object. Returns null for invalid input. */
function toIST(date: Date | string | null | undefined): Date | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  return new Date(d.toLocaleString('en-US', { timeZone: IST_TIMEZONE }));
}

/** dd/MM/yyyy */
export function formatDate(date: Date | string | null | undefined): string {
  const d = toIST(date);
  if (!d) return '-';
  return format(d, 'dd/MM/yyyy');
}

/** dd/MM/yyyy HH:mm */
export function formatDateTime(date: Date | string | null | undefined): string {
  const d = toIST(date);
  if (!d) return '-';
  return format(d, 'dd/MM/yyyy HH:mm');
}

/** dd/MM/yyyy, hh:mm a */
export function formatDateTimeAmPm(date: Date | string | null | undefined): string {
  const d = toIST(date);
  if (!d) return '-';
  return format(d, 'dd/MM/yyyy, hh:mm a');
}

/** dd/MM/yyyy hh:mm a (without comma) */
export function formatDateTimeAmPmNoComma(date: Date | string | null | undefined): string {
  const d = toIST(date);
  if (!d) return '-';
  return format(d, 'dd/MM/yyyy hh:mm a');
}

/** EEEE, dd/MM/yyyy (e.g. "Monday, 15/01/2024") */
export function formatDateLong(date: Date | string | null | undefined): string {
  const d = toIST(date);
  if (!d) return '-';
  return format(d, 'EEEE, dd/MM/yyyy');
}

/** hh:mm a (12-hour time) */
export function formatTime(date: Date | string | null | undefined): string {
  const d = toIST(date);
  if (!d) return '-';
  return format(d, 'hh:mm a');
}

/** HH:mm (24-hour time) */
export function formatTime24(date: Date | string | null | undefined): string {
  const d = toIST(date);
  if (!d) return '-';
  return format(d, 'HH:mm');
}

/** MMM yyyy (e.g. "Jan 2024") — for expiry dates */
export function formatMonthYear(date: Date | string | null | undefined): string {
  const d = toIST(date);
  if (!d) return '-';
  return format(d, 'MMM yyyy');
}

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

/** yyyy-MM-dd — for HTML date inputs and API query params (not for display) */
export function toInputDateStr(date?: Date | string): string {
  const d = date
    ? typeof date === 'string' ? new Date(date) : date
    : new Date();
  const ist = toIST(d);
  if (!ist) return format(new Date(), 'yyyy-MM-dd');
  return format(ist, 'yyyy-MM-dd');
}
