import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatMonthYear,
  toInputDateStr,
  formatAge,
  isFutureDate,
} from './date-utils';

/**
 * The pharmacy reports (G15/G17) render every date through these helpers, which
 * pin output to dd/MM/yyyy in IST (Asia/Kolkata) regardless of the runner's
 * local timezone. These tests lock that contract.
 */
describe('date-utils — IST display formatting (reports)', () => {
  describe('formatDate (dd/MM/yyyy)', () => {
    it('formats a UTC instant into IST calendar date', () => {
      // 2026-06-18T20:00:00Z is 2026-06-19 01:30 IST -> the 19th in IST
      expect(formatDate('2026-06-18T20:00:00Z')).toBe('19/06/2026');
    });

    it('zero-pads day and month', () => {
      expect(formatDate('2026-01-05T06:00:00Z')).toBe('05/01/2026');
    });

    it('returns a dash for null/undefined/invalid input', () => {
      expect(formatDate(null)).toBe('-');
      expect(formatDate(undefined)).toBe('-');
      expect(formatDate('not-a-date')).toBe('-');
    });
  });

  describe('formatDateTime (dd/MM/yyyy HH:mm)', () => {
    it('includes 24-hour IST time', () => {
      // 2026-06-19T05:30:00Z -> 11:00 IST
      expect(formatDateTime('2026-06-19T05:30:00Z')).toBe('19/06/2026 11:00');
    });

    it('returns a dash for invalid input', () => {
      expect(formatDateTime('')).toBe('-');
    });
  });

  describe('formatMonthYear (MMM yyyy — expiry)', () => {
    it('formats batch expiry as month + year', () => {
      expect(formatMonthYear('2027-03-15T00:00:00Z')).toBe('Mar 2027');
    });
  });

  describe('toInputDateStr (yyyy-MM-dd for date inputs/queries)', () => {
    it('formats a date into an IST yyyy-MM-dd query string', () => {
      expect(toInputDateStr('2026-06-18T20:00:00Z')).toBe('2026-06-19');
    });

    it('falls back to today (valid yyyy-MM-dd) for an invalid date', () => {
      expect(toInputDateStr('garbage')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});


describe('formatAge / isFutureDate (gap 329)', () => {
  const now = new Date('2026-11-19T08:00:00Z'); // 13:30 IST

  it('shows years for adults and children over one', () => {
    expect(formatAge('1990-05-01', now)).toBe('36 yrs');
    expect(formatAge('2025-11-19', now)).toBe('1 yr');
    expect(formatAge('1990-11-20', now)).toBe('35 yrs'); // birthday tomorrow
  });

  it('shows months, then days, for infants', () => {
    expect(formatAge('2026-05-10', now)).toBe('6 mo');
    expect(formatAge('2026-11-05', now)).toBe('14 days');
    expect(formatAge('2026-11-18', now)).toBe('1 day');
    expect(formatAge('2026-11-19', now)).toBe('0 days'); // newborn today
  });

  it('reads a stored @db.Date timestamp as its calendar date', () => {
    expect(formatAge('2026-11-05T00:00:00.000Z', now)).toBe('14 days');
  });

  it('shows a dash for a missing or future DOB', () => {
    expect(formatAge(null, now)).toBe('—');
    expect(formatAge('2030-01-01', now)).toBe('—');
  });

  it('flags only dates after today as future', () => {
    expect(isFutureDate('2030-01-01')).toBe(true);
    expect(isFutureDate(new Date())).toBe(false);
    expect(isFutureDate('2000-01-01')).toBe(false);
  });
});
