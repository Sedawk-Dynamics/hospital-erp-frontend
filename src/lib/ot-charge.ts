// Gap 352 (retest): one wording for an OT case's money, used by OT Billing
// Transactions and OT Reports. What is POSTED to a bill wins; until then the
// planned charge (the amount Complete will post — typed on the case, else the
// tariff's components or single price) is shown as planned. A ₹0 tariff is an
// explicit "no charge" — never shown as "No price set", and once posted never
// as "not posted".

export const OT_NO_CHARGE = '₹0 — no charge';

export function otRupees(n: number): string {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export interface OtChargeFacts {
  isPosted?: boolean;
  postedAmount?: number | null;
  plannedAmount?: number | null;
  plannedNoCharge?: boolean;
}

export type OtChargeState = 'posted' | 'posted_no_charge' | 'planned' | 'planned_no_charge' | 'no_price';

export function otChargeState(f: OtChargeFacts): OtChargeState {
  if (f.isPosted) return Number(f.postedAmount ?? 0) === 0 ? 'posted_no_charge' : 'posted';
  if (f.plannedAmount == null) return 'no_price';
  return f.plannedNoCharge || Number(f.plannedAmount) === 0 ? 'planned_no_charge' : 'planned';
}

/** The amount cell text for an OT case. */
export function otChargeText(f: OtChargeFacts): string {
  switch (otChargeState(f)) {
    case 'posted':
      return otRupees(Number(f.postedAmount ?? 0));
    case 'posted_no_charge':
      return `${OT_NO_CHARGE} (posted)`;
    case 'planned':
      return `${otRupees(Number(f.plannedAmount))} planned — not posted yet`;
    case 'planned_no_charge':
      return `${OT_NO_CHARGE} (not posted yet)`;
    default:
      return 'No price set — nothing will be billed';
  }
}

export interface OtBillingTotals {
  /** Posted to bills. */
  billed: number;
  /** Posted, and the surgery's bill is paid. */
  paid: number;
  /** Posted, not paid yet. */
  pendingPayment: number;
  /** Priced but not on a bill yet (cancelled cases excluded). */
  notPosted: number;
}

/** The billing screen's tiles — posted money only, planned money separately. */
export function otBillingTotals(
  rows: Array<OtChargeFacts & { status?: string | null; billingStatus?: string | null }>,
): OtBillingTotals {
  const t = { billed: 0, paid: 0, pendingPayment: 0, notPosted: 0 };
  for (const r of rows) {
    if (r.isPosted) {
      const amt = Number(r.postedAmount ?? 0);
      t.billed += amt;
      if ((r.billingStatus ?? '').toLowerCase() === 'paid') t.paid += amt;
      else t.pendingPayment += amt;
    } else if (r.status !== 'cancelled' && r.plannedAmount != null) {
      t.notPosted += Number(r.plannedAmount);
    }
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return { billed: r2(t.billed), paid: r2(t.paid), pendingPayment: r2(t.pendingPayment), notPosted: r2(t.notPosted) };
}
