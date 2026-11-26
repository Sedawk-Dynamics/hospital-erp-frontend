import { describe, it, expect } from 'vitest';
import { weekDays, weekHeading, startOfWeek, addDays, toLocalYmd, fromLocalYmd } from './roster-week';

describe('roster week (gap 313)', () => {
  it('columns start on the local week start, not the UTC-shifted day', () => {
    const start = startOfWeek(new Date(2026, 10, 11, 10, 0)); // Wed 11 Nov 2026
    const days = weekDays(start);
    expect(days[0]).toBe('2026-11-08');
    expect(days[6]).toBe('2026-11-14');
    expect(fromLocalYmd(days[0]!).getDay()).toBe(0);
  });

  it('heading uses the first and last column dates', () => {
    const h = weekHeading(weekDays(new Date(2026, 10, 8)));
    expect(h).toContain('8');
    expect(h).toContain('14');
    expect(h).toContain('2026');
  });

  it('prev/next week moves the columns by exactly 7 days', () => {
    const start = new Date(2026, 10, 8);
    expect(weekDays(addDays(start, 7))[0]).toBe('2026-11-15');
    expect(weekDays(addDays(start, -7))[6]).toBe('2026-11-07');
    expect(toLocalYmd(fromLocalYmd('2026-03-01'))).toBe('2026-03-01');
  });
});

describe('roster week start from HR settings (gap 313)', () => {
  const wed = new Date(2026, 10, 11, 10, 0); // Wed 11 Nov 2026

  it('defaults to Sunday', () => {
    expect(weekDays(startOfWeek(wed))[0]).toBe('2026-11-08');
  });

  it('starts on Monday when configured, columns and heading follow', () => {
    const days = weekDays(startOfWeek(wed, 1));
    expect(days[0]).toBe('2026-11-09');
    expect(days[6]).toBe('2026-11-15');
    expect(fromLocalYmd(days[0]!).getDay()).toBe(1);
    expect(weekHeading(days)).toMatch(/Mon.*9.*Sun.*15.*2026/);
  });

  it('a week start on the day itself does not jump back a week', () => {
    expect(weekDays(startOfWeek(wed, 3))[0]).toBe('2026-11-11');
    expect(weekDays(startOfWeek(wed, 4))[0]).toBe('2026-11-05');
  });

  it('prev/next keeps the configured start day across a month and year end', () => {
    const start = startOfWeek(new Date(2026, 11, 30), 1); // Wed 30 Dec 2026 → Mon 28 Dec
    expect(toLocalYmd(start)).toBe('2026-12-28');
    const next = startOfWeek(addDays(new Date(2026, 11, 30), 7), 1);
    expect(toLocalYmd(next)).toBe('2027-01-04');
    expect(next.getDay()).toBe(1);
  });

  it('an invalid setting falls back to Sunday', () => {
    expect(startOfWeek(wed, 9).getDay()).toBe(0);
  });
});
