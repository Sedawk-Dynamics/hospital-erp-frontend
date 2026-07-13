'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Loader2, ArrowRightLeft, ShieldCheck, Percent, Wallet, BedDouble, ReceiptText, RefreshCw,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { IpLedgerPanel } from '@/components/shared/ip-ledger-panel';
import { CollectBillPaymentDialog } from '@/components/hospital/billing/collect-bill-payment-dialog';
import {
  useTransferToTpa, useRecordTpaSettlement, useSetBillDiscount, useConsolidateIpBill,
  type IpBill,
} from '@/hooks/use-ip-billing';

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
  const transfer = useTransferToTpa();
  const settle = useRecordTpaSettlement();
  const discount = useSetBillDiscount();
  const consolidate = useConsolidateIpBill();

  const [discType, setDiscType] = useState<'percentage' | 'fixed'>('fixed');
  const [discValue, setDiscValue] = useState<number>(0);
  const [payAmt, setPayAmt] = useState<number>(0);
  const [collectOpen, setCollectOpen] = useState(false);

  if (!bill) return null;
  const admissionId = bill.admissionId!;
  const cat = (bill.admission?.billingCategory ?? 'cash').toLowerCase();
  const claim = bill.insuranceClaims?.[0];
  const liveClaim = claim && !['cancelled', 'rejected'].includes(claim.status);
  const patientName = `${bill.patient?.firstName ?? ''} ${bill.patient?.lastName ?? ''}`.trim();

  const doTransfer = async () => {
    try {
      const res = await transfer.mutateAsync(admissionId);
      toast.success(`Transferred to ${res?.policy?.tpa?.name || res?.policy?.insurer?.name || 'the TPA'} — claim raised.`);
    } catch (e) { toast.error((e as Error).message || 'Transfer failed.'); }
  };
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

        {/* Bill actions: discount + collect patient payment */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border bg-card p-3">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Percent className="h-4 w-4 text-primary" /> Discount</h3>
            <div className="flex items-center gap-1.5">
              <select className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={discType} onChange={(e) => setDiscType(e.target.value as any)}>
                <option value="fixed">₹ Fixed</option>
                <option value="percentage">% Percent</option>
              </select>
              <Input type="number" min={0} value={discValue} onChange={(e) => setDiscValue(Math.max(0, parseFloat(e.target.value) || 0))} className="h-8 text-sm" />
              <Button size="sm" className="h-8" onClick={doDiscount} disabled={discount.isPending}>
                {discount.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Apply'}
              </Button>
            </div>
            {n(bill.discountAmount) > 0 && <p className="mt-1 text-[11px] text-muted-foreground">Current discount: {money(bill.discountAmount)}</p>}
          </div>

          <div className="rounded-xl border bg-card p-3">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Wallet className="h-4 w-4 text-primary" /> Patient payment</h3>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Balance due</span>
              <span className="font-semibold">{money(bill.balanceDue)}</span>
            </div>
            <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => setCollectOpen(true)} disabled={n(bill.balanceDue) <= 0}>
              Collect from patient
            </Button>
          </div>
        </div>

        {/* TPA connection */}
        <div className={cn('rounded-xl border p-3', isInsurance(cat) ? 'border-purple-300 bg-purple-50/40' : 'bg-card')}>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" /> TPA / Insurance
          </h3>

          {!isInsurance(cat) ? (
            <p className="text-sm text-muted-foreground">Self-pay / package patient — no TPA. Collect the balance from the patient.</p>
          ) : !liveClaim ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">Insurance patient — hand this bill to the TPA to raise the claim.</p>
              <Button size="sm" className="gap-1.5" onClick={doTransfer} disabled={transfer.isPending}>
                {transfer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />} Transfer to TPA
              </Button>
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
                <Input type="number" min={0} placeholder="TPA payment received (₹)" value={payAmt || ''} onChange={(e) => setPayAmt(Math.max(0, parseFloat(e.target.value) || 0))} className="h-8 text-sm" />
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
        bill={{ id: bill.id, billNumber: bill.billNumber, balanceDue: n(bill.balanceDue), patientName }}
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
