// The balance every bill list shows, and what it is made of (gap item 286).
//
// The server computes one breakdown per bill (lines − concessions − payments −
// advance applied − insurer share + refunds) and sends it as
// `balanceBreakdown`. Lists read the balance from it, and its parts become the
// hover text, so "Total 25,500 · Paid 0 · Balance 500" explains itself.

import { formatINR } from '@/lib/money';

export interface BillBalanceBreakdown {
  lines: number;
  concessions: number;
  total: number;
  payments: number;
  advanceApplied: number;
  insurerShare: number;
  insurerPaid: number;
  refunds: number;
  balance: number;
  insurerOutstanding: number;
  totalOutstanding: number;
  paid: number;
}

type BillLike = {
  balanceDue?: number | string | null;
  balanceAmount?: number | string | null;
  balanceBreakdown?: BillBalanceBreakdown | null;
};

/** The patient balance, from the shared breakdown when the server sent one. */
export function billBalance(bill: BillLike): number {
  const bd = bill.balanceBreakdown;
  if (bd) return Number(bd.balance) || 0;
  return Number(bill.balanceDue ?? bill.balanceAmount ?? 0) || 0;
}

/** One line per part of the balance, for a tooltip or a small breakdown. */
export function balanceBreakdownLines(bill: BillLike): string[] {
  const bd = bill.balanceBreakdown;
  if (!bd) return [];
  const lines = [`Charges ${formatINR(bd.lines)}`];
  if (bd.concessions > 0) lines.push(`− Concessions ${formatINR(bd.concessions)}`);
  if (bd.payments > 0) lines.push(`− Paid ${formatINR(bd.payments)}`);
  if (bd.advanceApplied > 0) lines.push(`− Advance applied ${formatINR(bd.advanceApplied)}`);
  if (bd.insurerShare > 0) lines.push(`− Insurer share ${formatINR(bd.insurerShare)}`);
  if (bd.insurerShare <= 0 && bd.insurerPaid > 0) lines.push(`− Insurer paid ${formatINR(bd.insurerPaid)}`);
  if (bd.refunds > 0) lines.push(`+ Refunds ${formatINR(bd.refunds)}`);
  lines.push(`= Balance ${formatINR(bd.balance)}`);
  if (bd.insurerOutstanding > 0) lines.push(`Insurer still owes ${formatINR(bd.insurerOutstanding)}`);
  return lines;
}

export function balanceTitle(bill: BillLike): string | undefined {
  const lines = balanceBreakdownLines(bill);
  return lines.length ? lines.join('\n') : undefined;
}

/** Enter / Space on a focused row opens it, like a click (gap item 364). */
export function rowKeyOpen(open: () => void) {
  return (e: { key: string; target: EventTarget | null; currentTarget: EventTarget | null; preventDefault: () => void }) => {
    // Only the row itself: Enter on a button inside the row is that button's.
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  };
}
