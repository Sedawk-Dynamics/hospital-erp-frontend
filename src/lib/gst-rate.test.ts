import { describe, it, expect } from 'vitest';
import { gstAfterHsnChange, gstDiffersFromHsn } from './gst-rate';
import { gstinProblem } from './gstin';

// G-2: the drug master used to overwrite a typed 12% / 18% with the HSN 5%.
describe('gstAfterHsnChange', () => {
  it('keeps a rate somebody typed', () => {
    expect(gstAfterHsnChange('18', '', '5')).toBe('18');
    expect(gstAfterHsnChange('12', '5', '5')).toBe('12');
  });

  it('fills a blank from the HSN default', () => {
    expect(gstAfterHsnChange('', '', '5')).toBe('5');
  });

  it('follows the HSN when the value was the previous HSN default', () => {
    expect(gstAfterHsnChange('5', '5', '18')).toBe('18');
  });

  it('leaves the rate alone for an unrecognised HSN', () => {
    expect(gstAfterHsnChange('18', '5', '')).toBe('18');
  });
});

describe('gstDiffersFromHsn', () => {
  it('asks for a reason only when a typed rate disagrees with HSN', () => {
    expect(gstDiffersFromHsn('18', 5)).toBe(true);
    expect(gstDiffersFromHsn('5.00', 5)).toBe(false);
    expect(gstDiffersFromHsn('', 5)).toBe(false);
    expect(gstDiffersFromHsn('18', null)).toBe(false);
  });
});

// G-4: the buyer GSTIN is check-digit validated before it is sent.
describe('gstinProblem', () => {
  it('accepts a valid GSTIN and a blank', () => {
    expect(gstinProblem('29AAPFU0939F1ZR')).toBeNull();
    expect(gstinProblem('')).toBeNull();
  });

  it('names what is wrong', () => {
    expect(gstinProblem('29AAPFU0939F1ZV')).toMatch(/check digit/);
    expect(gstinProblem('29AAPF')).toMatch(/15 characters/);
  });
});
