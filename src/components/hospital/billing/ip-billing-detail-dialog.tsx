'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Loader2, ShieldCheck, Percent, Wallet, BedDouble, ReceiptText, RefreshCw,
  PiggyBank, Undo2,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NumberInput } from '@/components/ui/number-input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { IpLedgerPanel } from '@/components/shared/ip-ledger-panel';
import { CollectBillPaymentDialog } from '@/components/hospital/billing/collect-bill-payment-dialog';
import {
  useRecordTpaSettlement, useSetBillDiscount, useConsolidateIpBill,
  useSetBillItemReimbursable, useBillPayments, useApplyDeposit, useRefundDeposit,
  type IpBill,
} from '@/hooks/use-ip-billing';
import { useAdmissionLedger } from '@/hooks/use-ip-ledger';
import { formatDate } from '@/lib/date-utils';

const n = (v: number | string | null | undefined) => Number(v ?? 0);
const money = (v: number | string | null | undefined) => `₹${n(v).toFixed(2)}`;
const isInsurance = (cat?: string | null) => cat === 'insurance' || cat === 'corporate';

const CLAIM_BADGE: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-700', under_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-indigo-100 text-indigo-700', partially_approved: 'bg-indigo-100 text-indigo-700',
  settled: 'bg-emerald-100 text-emerald-700', partially_settled: 'bg-teal-100 text-teal-700',
  rejected: 'bg-red-100 text-red-700', resubmitted: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-gray-100 text-gray-600',
};

export function IpBillingDetailDialog({ bill, open, onOpenChange }: {
  bill: IpBill | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const settle = useRecordTpaSettlement();
  const discount = useSetBillDiscount();
  const consolidate = useConsolidateIpBill();
  const setReimbursable = useSetBillItemReimbursable();
  const applyDeposit = useApplyDeposit();
  const refundDeposit = useRefundDeposit();
  const qc = useQueryClient();
  const admissionId = bill?.admissionId ?? '';
  const { data: ledger } = useAdmissionLedger(open ? admissionId : null);
  const { data: payments } = useBillPayments(open ? (bill?.id ?? null) : null);

  const [discType, setDiscType] = useState<'percentage' | 'fixed'>('fixed');
  const [discValue, setDiscValue] = useState<number>(0);
  const [payAmt, setPayAmt] = useState<number>(0);
  const [collectOpen, setCollectOpen] = useState(false);

  if (!bill) return null;
  const cat = (bill.admission?.billingCategory ?? 'cash').toLowerCase();
  const claim = bill.insuranceClaims?.[0];
  const liveClaim = claim && !['cancelled', 'rejected'].includes(claim.status);
  const patientName = `${bill.patient?.firstName ?? ''} ${bill.patient?.lastName ?? ''}`.trim();

  const doSettle = async () => {
    if (!(payAmt > 0)) { toast.error('Enter the amount the TPA paid.'); return; }
    try { await settle.mutateAsync({ admissionId, paidAmount: payAmt }); toast.success('TPA payment recorded.'); setPayAmt(0); }
    catch (e) { toast.error((e as Error).message || 'Could not record the TPA payment.'); }
  };
  const doDiscount = async () => {
    if (!(discValue > 0)) { toast.error('Enter a discount value.'); return; }
    try { await discount.mutateAsync({ billId: bill.id, discountType: discType, discountValue: discValue, reason: 'IP billing desk' }); toast.success('Discount applied.'); setDiscValue(0); }
    catch (e) { toast.error((e as Error).message || 'Could not apply the discount.'); }
  };
  const doConsolidate = async () => {
    try { await consolidate.mutateAsync(admissionId); toast.success('All charges pulled onto the bill.'); }
    catch (e) { toast.error((e as Error).message || 'Could not generate the bill.'); }
  };
  const doApplyDeposit = async () => {
    try { await applyDeposit.mutateAsync({ admissionId }); toast.success('Deposit applied — cut from the bill balance.'); }
    catch (e) { toast.error((e as Error).message || 'Could not apply the deposit.'); }
  };
  const doRefundDeposit = async () => {
    try { await refundDeposit.mutateAsync({ admissionId }); toast.success('Deposit returned to the patient.'); }
    catch (e) { toast.error((e as Error).message || 'Could not return the deposit.'); }
  };
  const toggleLine = async (itemId: string, toInsurance: boolean) => {
    try { await setReimbursable.mutateAsync({ itemId, isReimbursable: toInsurance }); }
    catch (e) { toast.error((e as Error).message || 'Could not update the line.'); }
  };

  // Posted (real) bill lines — only these can be split insurance vs patient.
  const postedLines = (ledger?.lines ?? []).filter((l) => l.status === 'posted' && !l.isAutoPulled);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <ReceiptText className="h-5 w-5 text-primary" /> IP Bill — {patientName}
            <Badge variant="outline" className="text-[10px] capitalize">{cat}</Badge>
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{bill.patient?.mrn}</span>
            {(bill.admission?.ward?.name || bill.admission?.bed?.bedNumber) && (
              <span className="inline-flex items-center gap-1"><BedDouble className="h-3 w-3" />{[bill.admission?.ward?.name, bill.admission?.bed?.bedNumber].filter(Boolean).join(' · ')}</span>
            )}
            <span className="font-mono text-[11px]">{bill.billNumber}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={doConsolidate} disabled={consolidate.isPending}
            title="Pull every pending charge (room, lab, imaging, pharmacy…) onto the single bill + finalize">
            {consolidate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Generate / refresh bill
          </Button>
        </div>

        {/* The single consolidated, editable IP bill (add / remove charges). */}
        <IpLedgerPanel admissionId={admissionId} patientId={bill.patient?.id ?? ''} role="admin" />

        {/* Line-level insurance split — which charges the insurer covers vs the
            patient always pays. Tagging re-splits the auto-raised TPA claim. */}
        {postedLines.length > 0 && (
          <div className="rounded-xl border bg-card p-3">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary" /> Insurance split
              <span className="text-[11px] font-normal text-muted-foreground">— tag each charge insurer-covered or patient-only</span>
            </h3>
            <div className="space-y-1.5">
              {postedLines.map((l) => {
                const patientOnly = l.isReimbursable === false;
                return (
                  <div key={l.id} className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">{l.description} <span className="text-muted-foreground">· {money(l.totalAmount)}</span></span>
                    <div className="flex shrink-0 overflow-hidden rounded-md border">
                      <button type="button" disabled={setReimbursable.isPending}
                        onClick={() => toggleLine(l.id, true)}
                        className={cn('px-2 py-0.5 text-[11px]', !patientOnly ? 'bg-purple-600 text-white' : 'bg-background text-muted-foreground hover:bg-accent')}>
                        Insurer
                      </button>
                      <button type="button" disabled={setReimbursable.isPending}
                        onClick={() => toggleLine(l.id, false)}
                        className={cn('px-2 py-0.5 text-[11px]', patientOnly ? 'bg-amber-500 text-white' : 'bg-background text-muted-foreground hover:bg-accent')}>
                        Patient
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">Changing a tag re-splits the bill (and the claim, if already transferred).</p>
          </div>
        )}

        {/* Bill actions: discount + collect patient payment */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border bg-card p-3">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Percent className="h-4 w-4 text-primary" /> Discount</h3>
            <div className="flex items-center gap-1.5">
              <select className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={discType} onChange={(e) => setDiscType(e.target.value as any)}>
                <option value="fixed">₹ Fixed</option>
                <option value="percentage">% Percent</option>
              </select>
              <NumberInput min={0} value={discValue} onValueChange={setDiscValue} className="h-8 text-sm" />
              <Button size="sm" className="h-8" onClick={doDiscount} disabled={discount.isPending}>
                {discount.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Apply'}
              </Button>
            </div>
            {n(bill.discountAmount) > 0 && <p className="mt-1 text-[11px] text-muted-foreground">Current discount: {money(bill.discountAmount)}</p>}
          </div>

          <div className="rounded-xl border bg-card p-3">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Wallet className="h-4 w-4 text-primary" /> Patient payment <span className="text-[11px] font-normal text-muted-foreground">— pay in parts</span></h3>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Paid / balance</span>
              <span className="font-medium">{money(bill.amountPaid)} / <span className="font-semibold">{money(bill.balanceDue)}</span></span>
            </div>
            {(payments ?? []).filter((p) => p.status !== 'failed' && p.status !== 'reversed').length > 0 && (
              <div className="mt-1.5 max-h-24 space-y-0.5 overflow-y-auto border-t pt-1.5">
                {(payments ?? []).filter((p) => p.status !== 'failed' && p.status !== 'reversed').map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">#{i + 1} · {formatDate(p.paymentDate)} · {p.paymentMethod}</span>
                    <span className="font-medium">{money(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => setCollectOpen(true)} disabled={n(bill.balanceDue) <= 0}>
              Collect part payment
            </Button>
          </div>
        </div>

        {/* Deposit — cut from the bill as it builds; return the unused part */}
        {n(ledger?.totals.deposit) > 0 && (
          <div className="rounded-xl border border-teal-300 bg-teal-50/40 p-3">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <PiggyBank className="h-4 w-4 text-teal-700" /> Deposit
              <span className="text-[11px] font-normal text-muted-foreground">— collected at admission, cut from the running bill</span>
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="On file" value={money(ledger?.totals.deposit)} className="text-teal-700" />
              <Stat label="Applied to bill" value={money(ledger?.totals.depositApplied)} />
              <Stat label="Balance after deposit" value={money(ledger?.totals.balanceAfterDeposit)} className="text-amber-700" />
              <Stat label="Refundable" value={money(ledger?.totals.refundable)} className="text-emerald-700" />
            </div>
            {n(ledger?.totals.depositRefunded) > 0 && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">Already returned: {money(ledger?.totals.depositRefunded)}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={doApplyDeposit}
                disabled={applyDeposit.isPending || n(ledger?.totals.depositAvailable) <= 0}
                title="Cut the deposit from the current bill balance">
                {applyDeposit.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}
                Apply deposit to bill
              </Button>
              <Button size="sm" className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={doRefundDeposit}
                disabled={refundDeposit.isPending || n(ledger?.totals.refundable) <= 0}
                title="Return the unused deposit to the patient (e.g. insurance covered the charges)">
                {refundDeposit.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                Return deposit
              </Button>
              {n(ledger?.totals.refundable) > 0 && (
                <span className="text-[11px] text-emerald-700">Insurance / payments cover the charges — {money(ledger?.totals.refundable)} can be returned.</span>
              )}
            </div>
          </div>
        )}

        {/* TPA connection */}
        <div className={cn('rounded-xl border p-3', isInsurance(cat) ? 'border-purple-300 bg-purple-50/40' : 'bg-card')}>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" /> TPA / Insurance
          </h3>

          {!liveClaim ? (
            <div className="flex items-start gap-2 rounded-lg border border-purple-200 bg-purple-50/50 px-3 py-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
              <p className="text-sm text-muted-foreground">
                {isInsurance(cat)
                  ? <><strong className="text-purple-700">Connected to the TPA.</strong> Because the patient was booked as {cat}, the claim is raised automatically once there are charges and kept in sync as the bill builds — no manual transfer needed. The insurance team fills in the policy &amp; approvals; insurer-tagged lines are claimed.</>
                  : <>This is a <strong>{cat}</strong> patient — settled directly, not through a TPA. Change the billing category on the admission to route it to insurance.</>}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge className={cn('text-[10px] capitalize', CLAIM_BADGE[claim!.status] ?? 'bg-gray-100 text-gray-600')}>{claim!.status.replace('_', ' ')}</Badge>
                <span className="text-muted-foreground">{claim!.policy?.tpa?.name || claim!.policy?.insurer?.name || 'TPA'}</span>
                {claim!.claimNumber && <span className="font-mono text-[11px] text-muted-foreground">{claim!.claimNumber}</span>}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Claimed" value={money(claim!.claimAmount)} />
                <Stat label="Insurer covers" value={money(bill.insuranceCoveredAmount)} className="text-purple-700" />
                <Stat label="TPA paid" value={money(claim!.paidAmount)} className="text-emerald-700" />
                <Stat label="Remaining" value={money(claim!.outstandingAmount)} className="text-amber-700" />
              </div>
              <div className="flex items-center gap-1.5">
                <NumberInput min={0} placeholder="TPA payment received (₹)" value={payAmt} onValueChange={setPayAmt} className="h-8 text-sm" />
                <Button size="sm" className="h-8" onClick={doSettle} disabled={settle.isPending}>
                  {settle.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Record payment'}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Patient out-of-pocket: <strong>{money(bill.patientPayableAmount)}</strong> — collect that from the patient; the rest is settled by the TPA.
              </p>
            </div>
          )}
        </div>
      </DialogContent>

      <CollectBillPaymentDialog
        open={collectOpen}
        onOpenChange={setCollectOpen}
        bill={{
          id: bill.id,
          billNumber: bill.billNumber,
          balanceDue: n(bill.balanceDue),
          patientName,
          // Lets the counter settle from a deposit the patient has already paid.
          patientId: bill.patient?.id,
        }}
        onCollected={() => {
          qc.invalidateQueries({ queryKey: ['hospital', 'ip-bills'] });
          qc.invalidateQueries({ queryKey: ['bill-payments', bill.id] });
          qc.invalidateQueries({ queryKey: ['ip-ledger', admissionId] });
        }}
      />
    </Dialog>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-lg border bg-card px-2.5 py-1.5">
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn('text-sm font-semibold', className)}>{value}</p>
    </div>
  );
}
