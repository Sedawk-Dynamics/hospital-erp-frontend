import { describe, it, expect } from 'vitest';
import { otBillingTotals, otChargeState, otChargeText } from './ot-charge';

describe('OT charge wording (gap 352 retest)', () => {
  it('shows a posted ₹0 no-charge case as posted, not "not posted"', () => {
    expect(otChargeState({ isPosted: true, postedAmount: 0 })).toBe('posted_no_charge');
    expect(otChargeText({ isPosted: true, postedAmount: 0 })).toBe('₹0 — no charge (posted)');
  });

  it('shows a tariff-priced case as planned, not "No price set"', () => {
    expect(otChargeText({ isPosted: false, plannedAmount: 15000 })).toBe('₹15,000 planned — not posted yet');
    expect(otChargeText({ isPosted: false, plannedAmount: 0, plannedNoCharge: true })).toBe('₹0 — no charge (not posted yet)');
  });

  it('says "No price set" only when nothing is configured', () => {
    expect(otChargeText({ isPosted: false, plannedAmount: null })).toBe('No price set — nothing will be billed');
  });

  it('posted money wins over the planned amount', () => {
    expect(otChargeText({ isPosted: true, postedAmount: 15000, plannedAmount: 18000 })).toBe('₹15,000');
  });

  it('totals posted money only, planned money separately', () => {
    const t = otBillingTotals([
      { isPosted: true, postedAmount: 15000, billingStatus: 'pending', status: 'completed' },
      { isPosted: true, postedAmount: 2000, billingStatus: 'paid', status: 'completed' },
      { isPosted: true, postedAmount: 0, billingStatus: 'pending', status: 'completed' },
      { isPosted: false, plannedAmount: 5000, status: 'scheduled' },
      { isPosted: false, plannedAmount: 9000, status: 'cancelled' },
      { isPosted: false, plannedAmount: null, status: 'scheduled' },
    ]);
    expect(t).toEqual({ billed: 17000, paid: 2000, pendingPayment: 15000, notPosted: 5000 });
  });
});
