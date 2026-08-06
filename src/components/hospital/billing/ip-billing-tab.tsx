'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Loader2, ShieldCheck, RefreshCw, BedDouble, Undo2, Printer, LogOut, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useIpAdmissions, useClearAndDischarge, type IpBill } from '@/hooks/use-ip-billing';
import { IpBillingDetailDialog } from '@/components/hospital/billing/ip-billing-detail-dialog';
import { BillPrintDialog } from '@/components/hospital/billing/bill-print-dialog';
import { BillGeneratorDialog } from '@/components/hospital/billing/bill-generator-dialog';
import {
  AdmissionTypeBadge,
  ADMISSION_TYPE_LABELS,
  normalizeAdmissionType,
} from '@/components/shared/admission-type-badge';

// IP billing section: one consolidated bill per admission, shown separately from
// OP. Click a row to open the full IP bill (edit charges, discount, collect,
// cut/return deposit, record TPA settlement). Insurance patients auto-connect to
// the TPA — no manual transfer. This is the single place for IP billing.

const n = (v: number | string | null | undefined) => Number(v ?? 0);
const money = (v: number | string | null | undefined) => `₹${n(v).toFixed(2)}`;
const isInsurance = (cat?: string | null) => cat === 'insurance' || cat === 'corporate';

const CLAIM_BADGE: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-indigo-100 text-indigo-700',
  partially_approved: 'bg-indigo-100 text-indigo-700',
  settled: 'bg-emerald-100 text-emerald-700',
  partially_settled: 'bg-teal-100 text-teal-700',
  rejected: 'bg-red-100 text-red-700',
  resubmitted: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-gray-100 text-gray-600',
};
const CATEGORY_BADGE: Record<string, string> = {
  insurance: 'bg-purple-100 text-purple-700',
  corporate: 'bg-fuchsia-100 text-fuchsia-700',
  package: 'bg-sky-100 text-sky-700',
  cash: 'bg-gray-100 text-gray-600',
};

/** Deposit-adjusted money still owed — the number the discharge gate checks. */
const outstandingOf = (b: IpBill) => n(b.deposit?.balanceAfterDeposit ?? b.balanceDue);

/**
 * The worklist falls back to the ADMISSION id when a stay has no bill yet
 * (`id: primary?.id ?? a.id`, billNumber '—'). Handing that to the bill screen
 * would look up a bill that does not exist, so gate on a real bill number.
 */
const hasRealBill = (b: IpBill) => !!b.billNumber && b.billNumber !== '—';

export function IpBillingTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [detailBill, setDetailBill] = useState<IpBill | null>(null);
  const [manageBill, setManageBill] = useState<IpBill | null>(null);
  const [printAdmissionId, setPrintAdmissionId] = useState<string | null>(null);
  const [readyOnly, setReadyOnly] = useState(false);
  const [dischargeTarget, setDischargeTarget] = useState<IpBill | null>(null);

  // One row per ADMISSION — listed from the moment the patient is admitted
  // (the endpoint ensures each active admission has its running IP bill).
  const { data, isLoading } = useIpAdmissions(search || undefined);
  const all = useMemo(() => data ?? [], [data]);
  const readyCount = useMemo(
    () => all.filter((b) => b.admission?.dischargeReady).length,
    [all],
  );
  const grouped = useMemo(
    () => (readyOnly ? all.filter((b) => b.admission?.dischargeReady) : all),
    [all, readyOnly],
  );

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['hospital', 'ip-bills'] });
    qc.invalidateQueries({ queryKey: ['ip-ledger'] });
  };


  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search IP bills / patient / MRN…" className="pl-8 h-9 text-sm" />
        </div>
        {/* The doctor has signed off on these; they are holding a bed until the
            counter settles the bill. */}
        <Button
          variant={readyOnly ? 'default' : 'outline'}
          size="sm"
          className="gap-1.5"
          onClick={() => setReadyOnly((v) => !v)}
          title="Patients whose discharge summary is published — waiting on bill clearance"
        >
          <LogOut className="h-3.5 w-3.5" /> Ready for discharge
          <span className={cn(
            'rounded-full px-1.5 text-[10px] font-bold',
            readyOnly ? 'bg-white/20' : 'bg-amber-100 text-amber-700',
          )}>
            {readyCount}
          </span>
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={refresh}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading IP patients…</div>
      ) : grouped.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {readyOnly ? 'No patients are waiting for discharge clearance.' : 'No IP patients admitted.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-3 py-2">Patient</th>
                <th className="px-3 py-2">Type / Category</th>
                <th className="px-3 py-2">Bill</th>
                <th className="px-3 py-2 text-right">Charges</th>
                <th className="px-3 py-2 text-right">Deposit</th>
                <th className="px-3 py-2 text-right">Insurer / Patient</th>
                <th className="px-3 py-2">TPA / Claim</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((b) => {
                const claim = b.insuranceClaims?.[0];
                const liveClaim = claim && !['cancelled', 'rejected'].includes(claim.status);
                const cat = (b.admission?.billingCategory ?? 'cash').toLowerCase();
                const dep = b.deposit;
                const refundable = n(dep?.refundable);
                return (
                  <tr key={b.admissionId ?? b.id} className="border-t align-top">
                    <td className="px-3 py-2">
                      <div className="font-medium">{b.patient?.firstName} {b.patient?.lastName}</div>
                      <div className="text-[11px] text-muted-foreground">{b.patient?.mrn}</div>
                      {(b.admission?.ward?.name || b.admission?.bed?.bedNumber) && (
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <BedDouble className="h-3 w-3" />
                          {[b.admission?.ward?.name, b.admission?.bed?.bedNumber].filter(Boolean).join(' · ')}
                        </div>
                      )}
                      {b.admission?.status === 'discharged' && (
                        <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">discharged</div>
                      )}
                      {b.admission?.dischargeReady && (
                        <Badge className="mt-1 gap-1 bg-amber-100 text-[10px] text-amber-800">
                          <LogOut className="h-2.5 w-2.5" /> Ready for discharge
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {/* Two different dimensions: the CARE type (IP / Emergency
                          / Day Care — all three run the same IP flow and share
                          this worklist) above how the stay is SETTLED. */}
                      <div className="flex flex-col items-start gap-1">
                        <AdmissionTypeBadge type={b.admission?.admissionType} className="text-[10px]" />
                        <Badge className={cn('text-[10px] capitalize', CATEGORY_BADGE[cat] ?? CATEGORY_BADGE.cash)}>{cat}</Badge>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-mono text-[11px]">{b.billNumber}</div>
                      <div className="text-[10px] uppercase text-muted-foreground">{b.status.replace('_', ' ')}</div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="font-medium">{money(b.totalAmount)}</div>
                      <div className="text-[10px] text-muted-foreground">after deposit {money(dep?.balanceAfterDeposit ?? b.balanceDue)}</div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {n(dep?.onFile) > 0 ? (
                        <>
                          <div className="font-medium text-teal-700">{money(dep?.onFile)}</div>
                          {refundable > 0 && (
                            <div className="text-[10px] text-emerald-600">refund {money(refundable)}</div>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {liveClaim ? (
                        <div className="text-[12px]">
                          <div className="text-purple-700">{money(b.insuranceCoveredAmount)}</div>
                          <div className="text-muted-foreground">pt {money(b.patientPayableAmount)}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {claim ? (
                        <div className="space-y-0.5">
                          <Badge className={cn('text-[10px] capitalize', CLAIM_BADGE[claim.status] ?? 'bg-gray-100 text-gray-600')}>
                            {claim.status.replace('_', ' ')}
                          </Badge>
                          <div className="text-[11px] text-muted-foreground">
                            {claim.policy?.tpa?.name || claim.policy?.insurer?.name || 'TPA'}
                          </div>
                          <div className="text-[11px]">
                            paid {money(claim.paidAmount)} · out {money(claim.outstandingAmount)}
                          </div>
                        </div>
                      ) : isInsurance(cat) ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-purple-700">
                          <ShieldCheck className="h-3.5 w-3.5" /> Connected — claim on charges
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        {isInsurance(cat) && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700" title="Insurance patient — auto-connected to the TPA at booking (no manual transfer)">
                            <ShieldCheck className="h-3.5 w-3.5" /> {liveClaim ? 'With TPA' : 'Connected to TPA'}
                          </span>
                        )}
                        {refundable > 0 && (
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px] border-emerald-300 text-emerald-700"
                            onClick={() => setDetailBill(b)} title="Return the unused deposit to the patient">
                            <Undo2 className="h-3 w-3" /> Return deposit
                          </Button>
                        )}
                        {/* Printable bill — available at any time, not only
                            once the stay is settled. Reads as an interim bill
                            while the patient is still admitted. */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-[11px]"
                          onClick={() => setPrintAdmissionId(b.admissionId ?? null)}
                          disabled={!b.admissionId}
                          title="Print / download the bill for this stay"
                        >
                          <Printer className="h-3 w-3" /> Bill
                        </Button>
                        {/* The counter completes the discharge — the doctor's
                            published summary only marks the patient ready. The
                            server re-checks the balance, so this button is a
                            convenience gate, not the security boundary. */}
                        {b.admission?.dischargeReady && (
                          <Button
                            size="sm"
                            variant={outstandingOf(b) > 0 ? 'outline' : 'default'}
                            className={cn(
                              'h-7 gap-1 text-[11px]',
                              outstandingOf(b) > 0 && 'border-amber-300 text-amber-700',
                            )}
                            onClick={() => setDischargeTarget(b)}
                            title={
                              outstandingOf(b) > 0
                                ? `${money(outstandingOf(b))} still outstanding — collect it first, or use the override`
                                : 'Bill is settled — complete the discharge and free the bed'
                            }
                          >
                            <LogOut className="h-3 w-3" />
                            {outstandingOf(b) > 0 ? `Due ${money(outstandingOf(b))}` : 'Clear & Discharge'}
                          </Button>
                        )}
                        {/* Deposit, TPA settlement, insurance split and the
                            payment history live only on the IP detail dialog —
                            Manage now opens the shared Generate Bill screen, so
                            they keep their own entry point here. */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-[11px]"
                          onClick={() => setDetailBill(b)}
                          title="Deposit, TPA settlement, insurance split and payment history"
                        >
                          Deposit / TPA
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 gap-1 text-[11px]"
                          onClick={() => setManageBill(b)}
                          disabled={!hasRealBill(b)}
                          title={
                            hasRealBill(b)
                              ? 'Open the bill — pull charges, add lines, discount, finalize, print'
                              : 'No bill on this stay yet'
                          }
                        >
                          Manage
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Every admitted IP patient shows here from day one — one <strong>consolidated bill</strong> that builds up as charges are posted. The <strong>deposit</strong> is cut from the running balance, and its unused part can be <strong>returned</strong> to the patient (e.g. when insurance covers the charges in full). Insurance / corporate patients are <strong>auto-connected to the TPA</strong> at booking — the claim is raised and kept in sync as charges accrue (no manual transfer). Click <strong>Manage</strong> to post charges, apply the deposit, discount, collect &amp; record TPA settlements.
      </p>

      <IpBillingDetailDialog bill={detailBill} open={!!detailBill} onOpenChange={(o) => { if (!o) setDetailBill(null); }} />

      {/* IP / Emergency / Day Care bills open the SAME screen as OP, so the
          counter learns one billing surface. `admissionId` is what enables
          Print Bill inside it. */}
      <BillGeneratorDialog
        open={!!manageBill}
        onOpenChange={(o) => { if (!o) setManageBill(null); }}
        initialBillId={manageBill?.id ?? null}
        admissionId={manageBill?.admissionId ?? null}
        initialPatient={
          manageBill?.patient
            ? {
                id: manageBill.patient.id,
                firstName: manageBill.patient.firstName,
                lastName: manageBill.patient.lastName,
                mrn: manageBill.patient.mrn,
              }
            : null
        }
      />
      <BillPrintDialog
        admissionId={printAdmissionId}
        open={!!printAdmissionId}
        onOpenChange={(o) => { if (!o) setPrintAdmissionId(null); }}
      />
      <ClearAndDischargeDialog
        bill={dischargeTarget}
        onClose={() => setDischargeTarget(null)}
        onCollect={(b) => { setDischargeTarget(null); setDetailBill(b); }}
      />
    </div>
  );
}

// ============================================================
// Clear & Discharge — the counter's half of the discharge
// ============================================================
// The doctor publishes the discharge summary (clinical sign-off); the patient
// stays admitted, holding their bed, until this runs. Discharging with money
// outstanding drops the patient off every active-IP worklist and effectively
// writes the balance off, so a balance blocks the normal path entirely — LAMA /
// transfer-out / death go through the explicit override with a reason.
function ClearAndDischargeDialog({
  bill,
  onClose,
  onCollect,
}: {
  bill: IpBill | null;
  onClose: () => void;
  onCollect: (bill: IpBill) => void;
}) {
  const discharge = useClearAndDischarge();
  const [reason, setReason] = useState('');
  const [overriding, setOverriding] = useState(false);

  const outstanding = bill ? outstandingOf(bill) : 0;
  const blocked = outstanding > 0;
  const patientName = `${bill?.patient?.firstName ?? ''} ${bill?.patient?.lastName ?? ''}`.trim();
  // IP / Emergency / Day Care all reach this dialog — name the one being closed.
  const typeLabel = ADMISSION_TYPE_LABELS[normalizeAdmissionType(bill?.admission?.admissionType)];

  const close = () => {
    setReason('');
    setOverriding(false);
    onClose();
  };

  const submit = async (force: boolean) => {
    if (!bill?.admissionId) return;
    try {
      await discharge.mutateAsync({
        admissionId: bill.admissionId,
        ...(force ? { force: true, reason: reason.trim() } : {}),
      });
      toast.success(
        force
          ? `${patientName || 'Patient'} discharged by override — bed released`
          : `${patientName || 'Patient'} discharged — bill cleared and bed released`,
      );
      close();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to discharge patient';
      toast.error(msg);
    }
  };

  return (
    <Dialog open={!!bill} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogOut className="h-4 w-4 text-primary" />
            Complete Discharge
          </DialogTitle>
          <DialogDescription>
            {patientName || 'This patient'} has a signed discharge summary for this{' '}
            <strong>{typeLabel}</strong> stay
            {bill?.admission?.ward?.name || bill?.admission?.bed?.bedNumber
              ? ` in ${[bill?.admission?.ward?.name, bill?.admission?.bed?.bedNumber].filter(Boolean).join(' · ')}`
              : ''}
            . Completing the discharge closes the admission and frees the bed.
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            'rounded-lg border p-3 text-sm',
            blocked ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Balance after deposit</span>
            <span className={cn('font-semibold', blocked ? 'text-amber-800' : 'text-emerald-800')}>
              {money(outstanding)}
            </span>
          </div>
          <p className={cn('mt-1 text-[11px]', blocked ? 'text-amber-700' : 'text-emerald-700')}>
            {blocked
              ? 'The bill is not settled. Collect the balance first — or record an override below.'
              : 'The bill is fully settled. This patient is clear to leave.'}
          </p>
        </div>

        {blocked && overriding && (
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" />
              Reason for discharging with an outstanding balance *
            </label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. LAMA — patient left against medical advice / transferred to another hospital / death"
            />
            <p className="text-[11px] text-muted-foreground">
              This is written to the audit log against your user.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={close} disabled={discharge.isPending}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            {blocked && !overriding && (
              <>
                <Button variant="ghost" className="text-xs" onClick={() => setOverriding(true)}>
                  Override…
                </Button>
                <Button onClick={() => bill && onCollect(bill)}>Collect payment</Button>
              </>
            )}
            {blocked && overriding && (
              <Button
                variant="destructive"
                onClick={() => submit(true)}
                disabled={!reason.trim() || discharge.isPending}
              >
                {discharge.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Discharge anyway
              </Button>
            )}
            {!blocked && (
              <Button onClick={() => submit(false)} disabled={discharge.isPending}>
                {discharge.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Clear &amp; Discharge
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
