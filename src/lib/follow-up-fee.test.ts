import { describe, it, expect } from 'vitest';
import {
  consultationFeeText,
  draftError,
  followUpNote,
  fromDraft,
  isWaivedFollowUp,
  ruleHint,
  rupees,
  toDraft,
  type FollowUpPricing,
} from './follow-up-fee';

const priced = (over: Partial<FollowUpPricing> = {}): FollowUpPricing => ({
  isFree: false, listFee: 500, windowDays: 7, governed: true, label: null, ruleSummary: 'Free for 7 days, then ₹300', ...over,
});

describe('what a booking screen says', () => {
  it('shows a waived follow-up as ₹0, with the day', () => {
    const f = priced({ isFree: true, label: 'Free follow-up, day 4 of 7' });
    expect(consultationFeeText(0, f)).toBe('₹0 · Waived (Follow-up)');
    expect(followUpNote(0, f)).toBe('Free follow-up, day 4 of 7');
  });

  it('shows a chargeable follow-up at its fee', () => {
    const f = priced({ kind: 'paid_follow_up', label: 'Follow-up fee ₹300 (day 9, free follow-up ended on day 7)' });
    expect(consultationFeeText(300, f)).toBe('₹300');
    expect(followUpNote(300, f)).toContain('day 9');
  });

  it('shows a new consultation at the full fee, with the rule as a hint', () => {
    expect(consultationFeeText(500, priced())).toBe('₹500');
    expect(followUpNote(500, priced())).toBeNull();
    expect(ruleHint(priced())).toBe('Follow-up rule: Free for 7 days, then ₹300');
  });

  it('says nothing about rules when none is set', () => {
    const f = priced({ governed: false, ruleSummary: null });
    expect(ruleHint(f)).toBeNull();
    expect(followUpNote(0, { ...f, isFree: true, windowDays: 0 })).toBe('Booked as a follow-up — no consultation fee');
    expect(followUpNote(0, { ...f, isFree: true, windowDays: 7 })).toContain('7-day');
  });

  it('does not call a zero fee a waiver', () => {
    expect(isWaivedFollowUp(0, priced({ kind: 'paid_follow_up' }))).toBe(false);
    expect(isWaivedFollowUp(0, priced({ isFree: true, governed: false, listFee: 0 }))).toBe(false);
    expect(consultationFeeText(0, null)).toBe('₹0');
  });

  it('groups rupees the Indian way and keeps paise', () => {
    expect(rupees(125000)).toBe('₹1,25,000');
    expect(rupees(300.5)).toBe('₹300.50');
  });
});

describe('the settings form', () => {
  const full = { freeDays: '7', afterWindow: 'fixed', fixedFee: '300', scope: 'same_doctor', dischargeStartsWindow: 'no' } as const;

  it('round-trips a rule', () => {
    expect(fromDraft({ ...full })).toEqual({
      freeDays: 7, afterWindow: 'fixed', fixedFee: 300, scope: 'same_doctor', dischargeStartsWindow: false,
    });
    expect(toDraft(fromDraft({ ...full }))).toEqual(full);
  });

  it('keeps blank (default) apart from 0 (none)', () => {
    expect(fromDraft(toDraft(null))).toEqual({
      freeDays: null, afterWindow: null, fixedFee: null, scope: null, dischargeStartsWindow: null,
    });
    expect(fromDraft({ ...full, freeDays: '0' }).freeDays).toBe(0);
  });

  it('drops an amount left behind when the mode changes', () => {
    expect(fromDraft({ ...full, afterWindow: 'full' }).fixedFee).toBeNull();
  });

  it.each(['91', '-1', '2.5', 'x'])('refuses %s free days', (freeDays) => {
    expect(draftError({ ...full, freeDays }, true)).toMatch(/0 to 90/);
  });
  it('accepts the limits, and a fee of zero', () => {
    expect(draftError({ ...full, freeDays: '0' }, true)).toBeNull();
    expect(draftError({ ...full, freeDays: '90', fixedFee: '0' }, true)).toBeNull();
  });
  it('needs every field for the hospital default, none for an override', () => {
    expect(draftError(toDraft(null), true)).toMatch(/free follow-up days/);
    expect(draftError(toDraft(null), false)).toBeNull();
    expect(draftError({ ...full, fixedFee: '' }, false)).toMatch(/follow-up fee/);
    expect(draftError({ ...full, fixedFee: '-5' }, false)).toMatch(/0 or more/);
  });
});
