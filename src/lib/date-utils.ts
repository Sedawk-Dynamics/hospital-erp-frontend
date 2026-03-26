/**
 * Centralized date formatting — dd/MM/yyyy format, IST timezone.
 * All display dates in the app should use these helpers.
 */
import { format, formatDistanceToNow } from 'date-fns';

const IST_TIMEZONE = 'Asia/Kolkata';

/** Convert any date to IST Date object */
function toIST(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Date(d.toLocaleString('en-US', { timeZone: IST_TIMEZONE }));
}

/** dd/MM/yyyy */
export function formatDate(date: Date | string): string {
  return format(toIST(typeof date === 'string' ? new Date(date) : date), 'dd/MM/yyyy');
}

/** dd/MM/yyyy HH:mm */
export function formatDateTime(date: Date | string): string {
  return format(toIST(typeof date === 'string' ? new Date(date) : date), 'dd/MM/yyyy HH:mm');
}

/** dd/MM/yyyy, hh:mm a */
export function formatDateTimeAmPm(date: Date | string): string {
  return format(toIST(typeof date === 'string' ? new Date(date) : date), 'dd/MM/yyyy, hh:mm a');
}

/** dd/MM/yyyy hh:mm a (without comma) */
export function formatDateTimeAmPmNoComma(date: Date | string): string {
  return format(toIST(typeof date === 'string' ? new Date(date) : date), 'dd/MM/yyyy hh:mm a');
}

/** EEEE, dd/MM/yyyy (e.g. "Monday, 15/01/2024") */
export function formatDateLong(date: Date | string): string {
  return format(toIST(typeof date === 'string' ? new Date(date) : date), 'EEEE, dd/MM/yyyy');
}

/** hh:mm a (12-hour time) */
export function formatTime(date: Date | string): string {
  return format(toIST(typeof date === 'string' ? new Date(date) : date), 'hh:mm a');
}

/** HH:mm (24-hour time) */
export function formatTime24(date: Date | string): string {
  return format(toIST(typeof date === 'string' ? new Date(date) : date), 'HH:mm');
}

/** MMM yyyy (e.g. "Jan 2024") — for expiry dates */
export function formatMonthYear(date: Date | string): string {
  return format(toIST(typeof date === 'string' ? new Date(date) : date), 'MMM yyyy');
}

/** Relative time (e.g. "2 hours ago") with fallback to dd/MM/yyyy */
export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
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
  return format(toIST(d), 'yyyy-MM-dd');
}
