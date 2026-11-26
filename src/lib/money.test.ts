import { describe, expect, it } from 'vitest';
import { formatINR } from './money';

// Gap item 289 — one formatter, ₹ with Indian grouping.
describe('formatINR', () => {
  it('groups in lakhs and crores with paise', () => {
    expect(formatINR(123456.78)).toBe('₹1,23,456.78');
    expect(formatINR(45000)).toBe('₹45,000.00');
    expect(formatINR(12345678.9)).toBe('₹1,23,45,678.90');
  });

  it('accepts strings and empty values', () => {
    expect(formatINR('25500')).toBe('₹25,500.00');
    expect(formatINR(null)).toBe('₹0.00');
    expect(formatINR('not a number')).toBe('₹0.00');
  });

  it('puts the sign before the symbol and can drop paise', () => {
    expect(formatINR(-500)).toBe('-₹500.00');
    expect(formatINR(1999.5, { whole: true })).toBe('₹2,000');
  });
});
