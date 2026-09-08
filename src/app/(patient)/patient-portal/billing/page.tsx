'use client';

import { useState } from 'react';
import { CreditCard, Download, Wallet, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { HospitalFilter } from '../_components/hospital-filter';
import { usePatientProfileStore } from '@/stores/patient-profile-store';
import { useAuthStore } from '@/stores/auth-store';
import { fullName } from '@/lib/person-name';

export default function PatientBillingPage() {
  const [hospitalFilter, setHospitalFilter] = useState('');
  const { selectedProfileId } = usePatientProfileStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['patient', 'bills', hospitalFilter, selectedProfileId],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 30 };
      if (hospitalFilter) params.tenantId = hospitalFilter;
      if (selectedProfileId) params.profileId = selectedProfileId;
      const res = await apiGet<Array<{
        id: string; billNumber: string; status: string; createdAt: string;
        // The API returns Prisma's own column names. This screen asked for
        // `total` / `paidAmount` / `balanceAmount`, which no response has ever
        // carried — so every figure on it rendered as ₹NaN, and the balance
        // column fell to "-" because NaN > 0 is false. The old names are kept
        // as a fallback in case an older payload still uses them.
        totalAmount?: number | string; amountPaid?: number | string;
        balanceDue?: number | string;
        total?: number | string; paidAmount?: number | string;
        balanceAmount?: number | string;
        billItems?: Array<{
          description?: string; totalAmount?: number;
          hsnSacCode?: string | null; gstTreatment?: string | null;
          taxPercent?: number | string; taxAmount?: number | string;
        }>;
        patient?: { tenant?: { name?: string } };
        // What the hospital issued this as, and the tax inside it.
        gstDocumentType?: string | null; invoiceNumber?: string | null;
        taxAmount?: number | string;
        cgstAmount?: number | string; sgstAmount?: number | string;
        igstAmount?: number | string;
      }>>('/patient-portal/billing', { params });
      return res.data ?? [];
    },
  });

  const bills = data ?? [];
  /** A money figure off a bill, whichever name the payload carries it under. */
  const money = (...vals: Array<number | string | undefined>) => {
    for (const v of vals) {
      const n = Number(v);
      if (v !== undefined && v !== null && Number.isFinite(n)) return n;
    }
    return 0;
  };
  const totalDue = bills.reduce((s, b) => s + money(b.balanceDue, b.balanceAmount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-2">
            Finance
          </p>
          <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
            Bills &amp; Payments
          </h1>
          <p className="font-label text-sm text-on-surface-variant mt-1.5">
            View your invoices, download receipts, and track outstanding balances
          </p>
        </div>
        {totalDue > 0 && (
          <div className="flex items-center gap-4 rounded-xl bg-secondary-fixed/50 border-l-4 border-secondary px-5 py-3 shadow-sanctuary">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/10 text-secondary shrink-0">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                Outstanding
              </p>
              <p className="font-headline text-base font-bold text-on-surface">
                {`\u20B9${totalDue.toLocaleString('en-IN')}`}
              </p>
            </div>
          </div>
        )}
      </div>

      <HospitalFilter value={hospitalFilter} onChange={setHospitalFilter} />

      <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-container text-on-surface-variant font-label text-[10px] uppercase tracking-widest">
              <th className="px-4 py-3 text-left font-bold">Bill #</th>
              <th className="px-4 py-3 text-left font-bold">Date</th>
              <th className="px-4 py-3 text-right font-bold">Total</th>
              <th className="px-4 py-3 text-right font-bold">Paid</th>
              <th className="px-4 py-3 text-right font-bold">Balance</th>
              <th className="px-4 py-3 text-left font-bold">Status</th>
              <th className="px-4 py-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container/50">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center">
                  <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </td>
              </tr>
            ) : bills.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center">
                  <div className="w-12 h-12 mx-auto bg-surface-container-high rounded-full flex items-center justify-center text-outline mb-3">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <p className="font-label text-sm font-semibold text-on-surface">No bills found</p>
                  <p className="font-label text-xs text-on-surface-variant mt-1">Your invoices will appear here</p>
                </td>
              </tr>
            ) : (
              bills.map((bill) => (
                <tr
                  key={bill.id}
                  className="hover:bg-surface-container-low transition-colors"
                >
                  <td className="px-4 py-3 font-label font-bold text-on-surface">
                    {/* The number the hospital issued it under, where there is
                        one — that is what the patient quotes back. */}
                    {bill.invoiceNumber ?? bill.billNumber}
                    {bill.invoiceNumber ? (
                      <span className="block font-label text-[10px] font-normal text-on-surface-variant">
                        {bill.billNumber}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">{formatDate(bill.createdAt)}</td>
                  <td className="px-4 py-3 text-right font-label font-bold text-on-surface">
                    {`\u20B9${money(bill.totalAmount, bill.total).toLocaleString('en-IN')}`}
                    {/* Say what the tax inside it was — including when it is
                        nothing. Most of a hospital bill is exempt, and a patient
                        who cannot see that assumes tax is buried in the total. */}
                    <span className="block font-label text-[10px] font-normal text-on-surface-variant">
                      {Number(bill.taxAmount ?? 0) > 0
                        ? `incl. GST \u20B9${Number(bill.taxAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                        : 'no GST charged'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-primary font-label font-semibold">
                    {`\u20B9${money(bill.amountPaid, bill.paidAmount).toLocaleString('en-IN')}`}
                  </td>
                  <td className="px-4 py-3 text-right text-error font-label font-bold">
                    {money(bill.balanceDue, bill.balanceAmount) > 0
                      ? `\u20B9${money(bill.balanceDue, bill.balanceAmount).toLocaleString('en-IN')}`
                      : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'text-[10px] font-bold font-label px-2 py-0.5 rounded-full capitalize',
                        bill.status === 'paid' && 'bg-primary/10 text-primary',
                        bill.status === 'pending' && 'bg-secondary/10 text-secondary',
                        bill.status === 'partially_paid' && 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
                      )}
                    >
                      {bill.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Same field-name bug as the columns above: this read
                          `balanceAmount`, the payload carries `balanceDue`, and
                          NaN > 0 is false — so Pay Now never rendered on any
                          bill and no patient could settle one from here. */}
                      {money(bill.balanceDue, bill.balanceAmount) > 0 &&
                        (bill.status === 'pending' || bill.status === 'partially_paid') && (
                          <PayNowButton
                            bill={{
                              id: bill.id,
                              billNumber: bill.billNumber,
                              balanceAmount: money(bill.balanceDue, bill.balanceAmount),
                            }}
                            hospitalName={bill.patient?.tenant?.name}
                            onPaid={() =>
                              queryClient.invalidateQueries({ queryKey: ['patient', 'bills'] })
                            }
                          />
                        )}
                      <Button variant="ghost" size="icon-sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Pay Now — opens Razorpay checkout for an outstanding bill.
// Backend (POST /patient-portal/create-bill-payment-order) scopes the bill to
// the logged-in patient, so a patient can only pay their own bills. The
// balance is settled by the Razorpay webhook, so the row simply refetches.
// checkout.js is loaded globally in the root layout.
// ────────────────────────────────────────────────────────────────────────
function PayNowButton({
  bill,
  hospitalName,
  onPaid,
}: {
  bill: { id: string; billNumber: string; balanceAmount: number };
  hospitalName?: string;
  onPaid: () => void;
}) {
  const { user } = useAuthStore();
  const [processing, setProcessing] = useState(false);

  const pay = async () => {
    if (typeof window === 'undefined' || !window.Razorpay) {
      toast.error('Payment gateway is still loading — try again in a moment.');
      return;
    }
    setProcessing(true);
    try {
      const orderRes = await apiPost<{
        orderId: string;
        amount: number;
        currency: string;
        keyId: string;
      }>('/patient-portal/create-bill-payment-order', { billId: bill.id });
      const order = orderRes.data;
      if (!order) throw new Error('Failed to create payment order');

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: hospitalName || 'Hospital',
        description: `Bill ${bill.billNumber}`,
        order_id: order.orderId,
        handler: async (response: RazorpayResponse) => {
          try {
            await apiPost('/patient-portal/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success('Payment successful!');
            onPaid();
          } catch {
            toast.error('Payment verification failed. Contact the hospital for help.');
          } finally {
            setProcessing(false);
          }
        },
        prefill: {
          name: user ? fullName(user) : '',
          email: user?.email ?? '',
          contact: user?.phone ?? '',
        },
        theme: { color: '#0a685a' },
        modal: { ondismiss: () => setProcessing(false) },
      });
      rzp.open();
    } catch (err: unknown) {
      setProcessing(false);
      toast.error(err instanceof Error ? err.message : 'Failed to initiate payment');
    }
  };

  return (
    <Button size="sm" className="gap-1.5 text-xs" disabled={processing} onClick={pay}>
      {processing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Wallet className="h-3.5 w-3.5" />
      )}
      Pay Now
    </Button>
  );
}
