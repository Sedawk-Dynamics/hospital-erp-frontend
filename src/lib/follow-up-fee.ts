// How a consultation's price and the follow-up rule behind it are worded, in
// one place, so the payment step, the prompt, the toast and the appointment row
// say the same thing (gap items #331 and #019). The server decides the amount;
// nothing here computes a fee.

import { formatINR } from '@/lib/money';

/** The `followUp` block of a charge preview, or a portal quote. */
export interface FollowUpPricing {
  isFree: boolean;
  /** What the doctor normally charges. */
  listFee: number;
  windowDays: number;
  kind?: 'consultation' | 'free_follow_up' | 'paid_follow_up' | 'legacy';
  /** Priced under a rule the Hospital Admin set. */
  governed?: boolean;
  /** "Free follow-up, day 4 of 7". */
  label?: string | null;
  /** "Free for 7 days, then ₹300". */
  ruleSummary?: string | null;
}

/** ₹500, or ₹500.50 when there are paise. */
export function rupees(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  return formatINR(n, { whole: Number.isInteger(n) });
}

export const WAIVED_LABEL = 'Waived (Follow-up)';

/** Is ₹0 here a waiver, as against a doctor who charges nothing? */
export function isWaivedFollowUp(fee: number, followUp: FollowUpPricing | null | undefined): boolean {
  return !!followUp?.isFree && fee === 0 && (followUp.listFee > 0 || !!followUp.governed);
}

/** "₹0 · Waived (Follow-up)", or the amount. */
export function consultationFeeText(fee: number, followUp: FollowUpPricing | null | undefined): string {
  return isWaivedFollowUp(fee, followUp) ? `${rupees(0)} · ${WAIVED_LABEL}` : rupees(fee);
}

/** The sentence under the amount: which rule decided it. Null when none did. */
export function followUpNote(fee: number, followUp: FollowUpPricing | null | undefined): string | null {
  if (!followUp) return null;
  if (followUp.label) return followUp.label;
  if (!isWaivedFollowUp(fee, followUp)) return null;
  return followUp.windowDays > 0
    ? `Within this doctor’s ${followUp.windowDays}-day follow-up window of a paid consultation`
    : 'Booked as a follow-up — no consultation fee';
}

/** The rule itself, for a visit that is not being waived or charged under it. */
export function ruleHint(followUp: FollowUpPricing | null | undefined): string | null {
  return followUp?.governed && followUp.ruleSummary ? `Follow-up rule: ${followUp.ruleSummary}` : null;
}

// ── The settings ───────────────────────────────────────────────────────────

export type AfterWindowMode = 'full' | 'fixed';
export type FollowUpScope = 'same_doctor' | 'same_department';

/** One level's settings. Null means "use the level above". */
export interface FollowUpRuleLayer {
  freeDays: number | null;
  afterWindow: AfterWindowMode | null;
  fixedFee: number | null;
  scope: FollowUpScope | null;
  dischargeStartsWindow: boolean | null;
}

export const EMPTY_LAYER: FollowUpRuleLayer = {
  freeDays: null,
  afterWindow: null,
  fixedFee: null,
  scope: null,
  dischargeStartsWindow: null,
};

export const MAX_FREE_DAYS = 90;

/** The form as typed. '' in a field means "use the default". */
export interface FollowUpRuleDraft {
  freeDays: string;
  afterWindow: AfterWindowMode | '';
  fixedFee: string;
  scope: FollowUpScope | '';
  dischargeStartsWindow: 'yes' | 'no' | '';
}

export function toDraft(layer: FollowUpRuleLayer | null | undefined): FollowUpRuleDraft {
  const l = layer ?? EMPTY_LAYER;
  return {
    freeDays: l.freeDays === null ? '' : String(l.freeDays),
    afterWindow: l.afterWindow ?? '',
    fixedFee: l.fixedFee === null ? '' : String(l.fixedFee),
    scope: l.scope ?? '',
    dischargeStartsWindow: l.dischargeStartsWindow === null ? '' : l.dischargeStartsWindow ? 'yes' : 'no',
  };
}

/** What is wrong with the form, or null. The server checks again. */
export function draftError(draft: FollowUpRuleDraft, complete: boolean): string | null {
  const days = draft.freeDays.trim();
  if (days === '') {
    if (complete) return 'Enter the free follow-up days. Use 0 for none.';
  } else if (!/^\d+$/.test(days) || Number(days) > MAX_FREE_DAYS) {
    return `Free follow-up days must be a whole number from 0 to ${MAX_FREE_DAYS}.`;
  }
  if (complete && !draft.afterWindow) return 'Choose what a follow-up costs after the free days.';
  if (draft.afterWindow === 'fixed') {
    const fee = draft.fixedFee.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(fee)) return 'Enter the follow-up fee in rupees, 0 or more.';
  }
  if (complete && !draft.scope) return 'Choose which visits count as a follow-up.';
  if (complete && !draft.dischargeStartsWindow) return 'Choose whether a discharge starts the free days.';
  return null;
}

export function fromDraft(draft: FollowUpRuleDraft): FollowUpRuleLayer {
  return {
    freeDays: draft.freeDays.trim() === '' ? null : Number(draft.freeDays),
    afterWindow: draft.afterWindow || null,
    fixedFee: draft.afterWindow === 'fixed' ? Number(draft.fixedFee) : null,
    scope: draft.scope || null,
    dischargeStartsWindow: draft.dischargeStartsWindow === '' ? null : draft.dischargeStartsWindow === 'yes',
  };
}

export const SCOPE_LABELS: Record<FollowUpScope, string> = {
  same_doctor: 'Same doctor only',
  same_department: 'Any doctor in the same department',
};
