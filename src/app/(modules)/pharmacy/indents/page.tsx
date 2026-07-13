'use client';

// ============================================================
// IP Medication Indents — PHARMACIST queue (design doc I).
// Ward nurses raise indents; the pharmacist approves (credit-gated),
// dispenses to the patient's IP bill (FEFO), and marks them delivered.
// Lifecycle: raised → approved → dispensed → delivered → acknowledged.
// ============================================================

import { useMemo, useRef, useState } from 'react';
import {
  Plus,
  Search,
  Eye,
  Loader2,
  CheckCircle2,
  Ban,
  Truck,
  ClipboardList,
  ShieldAlert,
  Undo2,
  Receipt,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import {
  useIndents,
  useApproveIndent,
  useDispenseIndent,
  useDeliverIndent,
  useCancelIndent,
  useRaiseIndent,
  useReturnIndent,
  type MedicationIndent,
  type MedicationIndentItem,
} from '@/hooks/use-indents';
import { useWards } from '@/hooks/use-clinical';
import { usePatientSearch } from '@/hooks/use-hospital';
import { useFormulary, useIpBillingSummary } from '@/hooks/use-pharmacy';

// ============================================================
// Constants & small helpers
// ============================================================

const STATUS_META: Record<string, { label: string; className: string }> = {
  raised: { label: 'Raised', className: 'bg-amber-100 text-amber-700 border-amber-300' },
  approved: { label: 'Approved', className: 'bg-blue-100 text-blue-700 border-blue-300' },
  dispensed: { label: 'Dispensed', className: 'bg-violet-100 text-violet-700 border-violet-300' },
  delivered: { label: 'Delivered', className: 'bg-teal-100 text-teal-700 border-teal-300' },
  acknowledged: { label: 'Acknowledged', className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 border-red-300' },
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'raised', label: 'Raised' },
  { key: 'approved', label: 'Approved' },
  { key: 'dispensed', label: 'Dispensed' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'acknowledged', label: 'Acknowledged' },
  { key: 'cancelled', label: 'Cancelled' },
];

const PRIORITIES = ['routine', 'urgent', 'emergency'];

const inr = (n?: number | null) => (n == null ? '—' : `₹${Number(n).toFixed(2)}`);

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? {
    label: status,
    className: 'bg-gray-100 text-gray-700 border-gray-300',
  };
  return (
    <Badge variant="outline" className={cn('text-[10px] font-medium', meta.className)}>
      {meta.label}
    </Badge>
  );
}

function TtoBadge({ isTto }: { isTto?: boolean }) {
  if (!isTto) return null;
  return (
    <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-[10px]">
      TTO
    </Badge>
  );
}

function CreditBadge({ creditStatus }: { creditStatus: string }) {
  if (creditStatus === 'clearance_required') {
    return (
      <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 text-[10px]">
        Clearance Required
      </Badge>
    );
  }
  if (creditStatus === 'cleared') {
    return (
      <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 text-[10px]">
        Cleared
      </Badge>
    );
  }
  return null;
}

// ============================================================
// Main page
// ============================================================

export default function PharmacyIndentsPage() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { data, isLoading, isError } = useIndents();
  const { data: wards } = useWards();

  const wardNameById = useMemo(() => {
    const m = new Map<string, string>();
    (wards ?? []).forEach((w) => m.set(w.id, w.name));
    return m;
  }, [wards]);

  const all = data?.items ?? [];

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length };
    for (const it of all) c[it.status] = (c[it.status] ?? 0) + 1;
    return c;
  }, [all]);

  const rows = useMemo(() => {
    let r = filter === 'all' ? all : all.filter((i) => i.status === filter);
    const q = search.trim().toLowerCase();
    if (q) {
      r = r.filter(
        (i) =>
          i.indentNumber?.toLowerCase().includes(q) ||
          i.patientName?.toLowerCase().includes(q) ||
          i.patientMrn?.toLowerCase().includes(q),
      );
    }
    return r;
  }, [all, filter, search]);

  // Dialog targets
  const [viewTarget, setViewTarget] = useState<MedicationIndent | null>(null);
  const [approveTarget, setApproveTarget] = useState<MedicationIndent | null>(null);
  const [cancelTarget, setCancelTarget] = useState<MedicationIndent | null>(null);
  const [returnTarget, setReturnTarget] = useState<MedicationIndent | null>(null);
  const [billingTarget, setBillingTarget] = useState<MedicationIndent | null>(null);
  const [raiseOpen, setRaiseOpen] = useState(false);

  const dispenseMutation = useDispenseIndent();
  const deliverMutation = useDeliverIndent();

  const handleDispense = (id: string) => {
    dispenseMutation.mutate(
      { id },
      {
        onSuccess: () => toast.success("Delivered to ward — charges posted to the patient's IP bill"),
        onError: (err: any) => toast.error(err?.message ?? 'Failed to deliver'),
      },
    );
  };

  const handleDeliver = (id: string) => {
    deliverMutation.mutate(id, {
      onSuccess: () => toast.success('Marked delivered to ward'),
      onError: (err: any) => toast.error(err?.message ?? 'Failed to mark delivered'),
    });
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-headline text-xl font-bold">Medication Indents</h1>
          <p className="text-xs text-muted-foreground">
            Ward requests for IP medication — approve, then deliver. Charges post to the patient&apos;s IP bill (hospital billing), never the pharmacy counter.
          </p>
        </div>
        <Button onClick={() => setRaiseOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Raise Indent
        </Button>
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
              filter === f.key
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:border-primary/40',
            )}
          >
            {f.label}
            <span
              className={cn(
                'rounded-full px-1.5 text-[10px]',
                filter === f.key ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
              )}
            >
              {isLoading ? '·' : counts[f.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search indent no., patient, MRN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Error state */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load indents. Please try again.
        </div>
      )}

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">
                  Indent
                </th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">
                  Patient
                </th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">
                  Ward
                </th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">
                  Flags
                </th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">
                  Status
                </th>
                <th className="px-4 pb-4 pt-5 text-center font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">
                  Items
                </th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">
                  Raised
                </th>
                <th className="px-4 pb-4 pt-5 text-center font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                    <p className="mt-2 text-sm text-muted-foreground">Loading indents...</p>
                  </td>
                </tr>
              ) : !isError && rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground/40" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      No indents{filter !== 'all' ? ` with "${STATUS_META[filter]?.label ?? filter}" status` : ''}.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((ind) => {
                  const dispensing =
                    dispenseMutation.isPending && dispenseMutation.variables?.id === ind.id;
                  const delivering =
                    deliverMutation.isPending && deliverMutation.variables === ind.id;
                  return (
                    <tr
                      key={ind.id}
                      className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-medium">{ind.indentNumber}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{ind.patientName ?? '—'}</div>
                        {ind.patientMrn && (
                          <div className="text-xs text-muted-foreground">MRN: {ind.patientMrn}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {ind.wardId ? wardNameById.get(ind.wardId) ?? '—' : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          <TtoBadge isTto={ind.isTto} />
                          <CreditBadge creditStatus={ind.creditStatus} />
                          {ind.priority && ind.priority !== 'routine' && (
                            <Badge
                              variant="outline"
                              className="bg-orange-100 text-orange-700 border-orange-300 text-[10px] capitalize"
                            >
                              {ind.priority}
                            </Badge>
                          )}
                          {!ind.isTto && ind.creditStatus === 'ok' && !ind.priority && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={ind.status} />
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        {ind.items?.length ?? 0}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(ind.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {ind.status === 'raised' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => setApproveTarget(ind)}
                            >
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              Approve
                            </Button>
                          )}
                          {ind.status === 'approved' && (
                            // Deliver = dispense to the ward + post charges to the
                            // patient's IP bill, in one step. No separate "dispense".
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                              onClick={() => handleDispense(ind.id)}
                              disabled={dispensing}
                            >
                              {dispensing ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Truck className="mr-1 h-3.5 w-3.5" />
                              )}
                              Deliver
                            </Button>
                          )}
                          {ind.status === 'dispensed' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                              onClick={() => handleDeliver(ind.id)}
                              disabled={delivering}
                            >
                              {delivering ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Truck className="mr-1 h-3.5 w-3.5" />
                              )}
                              Mark Delivered
                            </Button>
                          )}
                          {['dispensed', 'delivered', 'acknowledged'].includes(ind.status) && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                title="Return unused medicine to pharmacy (credit the IP bill)"
                                onClick={() => setReturnTarget(ind)}
                              >
                                <Undo2 className="mr-1 h-3.5 w-3.5" />
                                Return
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-slate-600 hover:text-slate-700 hover:bg-slate-50"
                                title="IP billing summary (reimbursable / non-reimbursable)"
                                onClick={() => setBillingTarget(ind)}
                              >
                                <Receipt className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {(ind.status === 'raised' || ind.status === 'approved') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setCancelTarget(ind)}
                            >
                              <Ban className="mr-1 h-3.5 w-3.5" />
                              Cancel
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="View details"
                            onClick={() => setViewTarget(ind)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialogs */}
      {approveTarget && (
        <ApproveIndentDialog
          indent={approveTarget}
          wardName={approveTarget.wardId ? wardNameById.get(approveTarget.wardId) : undefined}
          onClose={() => setApproveTarget(null)}
        />
      )}
      {cancelTarget && (
        <CancelIndentDialog indent={cancelTarget} onClose={() => setCancelTarget(null)} />
      )}
      {returnTarget && (
        <ReturnIndentDialog indent={returnTarget} onClose={() => setReturnTarget(null)} />
      )}
      {billingTarget && (
        <BillingSummaryDialog indent={billingTarget} onClose={() => setBillingTarget(null)} />
      )}
      {viewTarget && (
        <IndentDetailsDialog
          indent={viewTarget}
          wardName={viewTarget.wardId ? wardNameById.get(viewTarget.wardId) : undefined}
          onClose={() => setViewTarget(null)}
        />
      )}
      <RaiseIndentDialog open={raiseOpen} onOpenChange={setRaiseOpen} />
    </div>
  );
}

// ============================================================
// Approve dialog — credit-gated
// ============================================================

function ApproveIndentDialog({
  indent,
  wardName,
  onClose,
}: {
  indent: MedicationIndent;
  wardName?: string;
  onClose: () => void;
}) {
  const approve = useApproveIndent();
  const [override, setOverride] = useState(false);
  const needsClearance = indent.creditStatus === 'clearance_required';

  const submit = () => {
    if (needsClearance && !override) {
      toast.error('Tick "Approve with clearance" to override the credit hold, or wait for a top-up');
      return;
    }
    approve.mutate(
      { id: indent.id, override: override || undefined },
      {
        onSuccess: () => {
          toast.success('Indent approved');
          onClose();
        },
        onError: (err: any) => toast.error(err?.message ?? 'Failed to approve indent'),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Approve indent {indent.indentNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
            <p>
              <span className="font-medium">Patient:</span> {indent.patientName ?? '—'}
              {indent.patientMrn ? ` (${indent.patientMrn})` : ''}
            </p>
            {wardName && (
              <p>
                <span className="font-medium">Ward:</span> {wardName}
              </p>
            )}
            <p>
              <span className="font-medium">Items:</span> {indent.items?.length ?? 0}
              {indent.isTto ? ' · TTO / discharge medication' : ''}
            </p>
          </div>

          {needsClearance ? (
            <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-red-600">
                <ShieldAlert className="h-4 w-4" /> Credit Limit Exceeded
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                This patient's running bill exceeds their deposit. Approve only after a top-up, or
                with explicit clearance. Life-saving drugs bypass this automatically.
              </p>
              <label className="mt-2 flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={override}
                  onChange={(e) => setOverride(e.target.checked)}
                />
                Approve with clearance (override)
              </label>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Approving reserves the drugs for dispensing. The pharmacist can then post the charges
              to the patient's IP bill.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={approve.isPending || (needsClearance && !override)}>
            {approve.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {needsClearance ? 'Approve with clearance' : 'Approve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Cancel dialog
// ============================================================

function CancelIndentDialog({
  indent,
  onClose,
}: {
  indent: MedicationIndent;
  onClose: () => void;
}) {
  const cancel = useCancelIndent();
  const [reason, setReason] = useState('');

  const submit = () => {
    cancel.mutate(
      { id: indent.id, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Indent cancelled');
          onClose();
        },
        onError: (err: any) => toast.error(err?.message ?? 'Failed to cancel indent'),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel indent {indent.indentNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <p className="text-sm text-muted-foreground">
            Cancel this indent for <b>{indent.patientName ?? 'the patient'}</b>? This cannot be
            undone.
          </p>
          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. duplicate request, order changed..."
              className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Keep
          </Button>
          <Button variant="destructive" onClick={submit} disabled={cancel.isPending}>
            {cancel.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Cancel Indent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// IP Return-to-Stock (RTS) dialog — design doc IP feature #2
// The ward returns unused / un-administered medicine; the pharmacist records it,
// the batch is restocked and the patient's running IP bill is credited.
// ============================================================

function ReturnIndentDialog({
  indent,
  onClose,
}: {
  indent: MedicationIndent;
  onClose: () => void;
}) {
  const ret = useReturnIndent();
  const [reason, setReason] = useState('');
  const [qty, setQty] = useState<Record<string, string>>({});

  // Only dispensed lines with something still on the ward are returnable.
  const returnable = (indent.items ?? []).map((it) => {
    const dispensed = it.dispensedQty ?? 0;
    const already = it.returnedQty ?? 0;
    const remaining = Math.max(0, dispensed - already);
    // Credit per sale-unit = the line's billed value spread over the dispensed qty.
    const perUnitCredit = dispensed > 0 ? Number(it.lineTotal ?? 0) / dispensed : 0;
    return { it, dispensed, already, remaining, perUnitCredit };
  });
  const anyReturnable = returnable.some((r) => r.remaining > 0);

  const creditPreview = returnable.reduce((sum, r) => {
    const n = Math.min(r.remaining, Math.max(0, Math.trunc(Number(qty[r.it.id] || 0))));
    return sum + n * r.perUnitCredit;
  }, 0);

  const submit = () => {
    const items = returnable
      .map((r) => ({ itemId: r.it.id, returnQty: Math.min(r.remaining, Math.max(0, Math.trunc(Number(qty[r.it.id] || 0)))) }))
      .filter((x) => x.returnQty > 0);
    if (items.length === 0) return toast.error('Enter a quantity to return on at least one line');
    ret.mutate(
      { id: indent.id, items, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          toast.success("Returned to pharmacy — the patient's IP bill was credited");
          onClose();
        },
        onError: (err: any) => toast.error(err?.message ?? 'Failed to process the return'),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Return to pharmacy · {indent.indentNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <p className="text-sm text-muted-foreground">
            Record unused medicine returned from the ward for <b>{indent.patientName ?? 'the patient'}</b>.
            Returned units are added back to the original batch and credited to the running IP bill.
          </p>
          {!anyReturnable ? (
            <div className="rounded-md border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
              Nothing left to return — every dispensed unit has already been returned.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Drug</th>
                    <th className="px-3 py-2 font-medium text-center">Dispensed</th>
                    <th className="px-3 py-2 font-medium text-center">Returned</th>
                    <th className="px-3 py-2 font-medium text-center">Return now</th>
                    <th className="px-3 py-2 font-medium text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {returnable.map(({ it, dispensed, already, remaining, perUnitCredit }) => {
                    const n = Math.min(remaining, Math.max(0, Math.trunc(Number(qty[it.id] || 0))));
                    const unit = it.saleUnit === 'loose' ? it.looseUnitLabel || 'loose' : 'pack';
                    return (
                      <tr key={it.id} className="border-b last:border-b-0">
                        <td className="px-3 py-2">
                          <div className="font-medium">{it.drugName ?? it.drugFormularyId}</div>
                          <div className="text-[11px] text-muted-foreground capitalize">{unit}</div>
                        </td>
                        <td className="px-3 py-2 text-center">{dispensed}</td>
                        <td className="px-3 py-2 text-center text-muted-foreground">{already || '—'}</td>
                        <td className="px-3 py-2 text-center">
                          {remaining > 0 ? (
                            <Input
                              type="number"
                              min={0}
                              max={remaining}
                              value={qty[it.id] ?? ''}
                              placeholder="0"
                              onChange={(e) => setQty((q) => ({ ...q, [it.id]: e.target.value }))}
                              className="w-20 mx-auto text-center"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                          {remaining > 0 && (
                            <div className="mt-0.5 text-[10px] text-muted-foreground">max {remaining}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{n > 0 ? inr(n * perUnitCredit) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. medication changed, patient discharged early..."
              className="flex min-h-[56px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {creditPreview > 0 && (
            <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
              <span className="font-medium text-emerald-700">Total credit to IP bill</span>
              <span className="font-mono font-semibold text-emerald-700">{inr(creditPreview)}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={ret.isPending || !anyReturnable || creditPreview <= 0}>
            {ret.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Process Return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// IP Billing Summary dialog — Cashless / TPA split (design doc IP feature #4).
// Shows the reimbursable (claim from insurer) vs non-reimbursable (collect from
// patient) vs take-home split, plus the running deposit / balance picture.
// ============================================================

function BillingSummaryDialog({
  indent,
  onClose,
}: {
  indent: MedicationIndent;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useIpBillingSummary(indent.patientId);

  const money = (n?: number | string | null) => `₹${Number(n ?? 0).toFixed(2)}`;
  const split = data?.pharmacySplit;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            IP Billing Summary · {indent.patientName ?? 'Patient'}
            {data?.category && (
              <Badge variant="outline" className="text-[10px] capitalize">
                {data.category}
              </Badge>
            )}
            {data?.isTpa && (
              <Badge variant="outline" className="bg-indigo-100 text-indigo-700 border-indigo-300 text-[10px]">
                Cashless / TPA
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          </div>
        ) : isError || !data ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load the billing summary.
          </div>
        ) : (
          <div className="space-y-4">
            {data.isTpa && data.insurance && (
              <div className="rounded-md border bg-indigo-50/50 p-3 text-sm grid grid-cols-2 gap-x-4 gap-y-1">
                <p><span className="text-muted-foreground">Insurer:</span> {data.insurance.insurer ?? '—'}</p>
                <p><span className="text-muted-foreground">TPA:</span> {data.insurance.tpa ?? '—'}</p>
                <p><span className="text-muted-foreground">Policy:</span> {data.insurance.policyNumber}</p>
                <p><span className="text-muted-foreground">Plan:</span> {data.insurance.planName ?? '—'}</p>
              </div>
            )}

            {/* Money picture */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Deposit', val: data.totals.deposit },
                { label: 'Billed', val: data.totals.totalBilled },
                { label: 'Paid', val: data.totals.totalPaid },
                { label: 'Balance', val: data.totals.balanceDue },
              ].map((c) => (
                <div key={c.label} className="rounded-lg border bg-card px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{c.label}</div>
                  <div className="font-mono text-sm font-semibold">{money(c.val)}</div>
                </div>
              ))}
            </div>

            {/* Pharmacy reimbursable split */}
            {split && (
              <div className="rounded-lg border p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Pharmacy — TPA split
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-emerald-700">Reimbursable</div>
                    <div className="font-mono text-sm font-semibold text-emerald-700">{money(split.reimbursable)}</div>
                    <div className="text-[10px] text-muted-foreground">Claim from insurer</div>
                  </div>
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-amber-700">Non-reimbursable</div>
                    <div className="font-mono text-sm font-semibold text-amber-700">{money(split.nonReimbursable)}</div>
                    <div className="text-[10px] text-muted-foreground">Collect from patient</div>
                  </div>
                  <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-violet-700">Take-home (TTO)</div>
                    <div className="font-mono text-sm font-semibold text-violet-700">{money(split.takeHome)}</div>
                    <div className="text-[10px] text-muted-foreground">Discharge meds</div>
                  </div>
                </div>
              </div>
            )}

            {/* Charges by category */}
            {data.categoryTotals.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Service category</th>
                      <th className="px-3 py-2 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.categoryTotals.map((c) => (
                      <tr key={c.category} className="border-b last:border-b-0">
                        <td className="px-3 py-2 capitalize">{c.category}</td>
                        <td className="px-3 py-2 text-right font-mono">{money(c.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Details dialog (read-only)
// ============================================================

function IndentDetailsDialog({
  indent,
  wardName,
  onClose,
}: {
  indent: MedicationIndent;
  wardName?: string;
  onClose: () => void;
}) {
  const dispensed = ['dispensed', 'delivered', 'acknowledged'].includes(indent.status);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{indent.indentNumber}</span>
            <StatusBadge status={indent.status} />
            <TtoBadge isTto={indent.isTto} />
            <CreditBadge creditStatus={indent.creditStatus} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md bg-muted/50 p-3 text-sm grid grid-cols-2 gap-x-4 gap-y-1">
            <p>
              <span className="text-muted-foreground">Patient:</span>{' '}
              <span className="font-medium">{indent.patientName ?? '—'}</span>
            </p>
            <p>
              <span className="text-muted-foreground">MRN:</span> {indent.patientMrn ?? '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Ward:</span> {wardName ?? '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Raised:</span> {formatDate(indent.createdAt)}
            </p>
            {indent.priority && (
              <p className="capitalize">
                <span className="text-muted-foreground">Priority:</span> {indent.priority}
              </p>
            )}
            {dispensed && indent.billId && (
              <p>
                <span className="text-muted-foreground">Billed to:</span>{' '}
                <span className="font-mono">{indent.billId}</span>
              </p>
            )}
          </div>

          {indent.notes && (
            <p className="text-sm">
              <span className="text-muted-foreground">Notes:</span> {indent.notes}
            </p>
          )}
          {indent.status === 'cancelled' && indent.cancelledReason && (
            <p className="text-sm text-red-600">
              <span className="font-medium">Cancellation reason:</span> {indent.cancelledReason}
            </p>
          )}

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Drug</th>
                  <th className="px-3 py-2 font-medium text-center">Requested</th>
                  <th className="px-3 py-2 font-medium text-center">Approved</th>
                  <th className="px-3 py-2 font-medium text-center">Dispensed</th>
                  <th className="px-3 py-2 font-medium">Unit</th>
                  <th className="px-3 py-2 font-medium text-right">Line total</th>
                </tr>
              </thead>
              <tbody>
                {(indent.items ?? []).map((it: MedicationIndentItem) => (
                  <tr key={it.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2">
                      <div className="font-medium">{it.drugName ?? it.drugFormularyId}</div>
                      {it.isLifeSaving && (
                        <span className="text-[10px] font-medium text-emerald-600">Life-saving</span>
                      )}
                      {it.notes && (
                        <div className="text-xs text-muted-foreground">{it.notes}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">{it.requestedQty}</td>
                    <td className="px-3 py-2 text-center">{it.approvedQty ?? '—'}</td>
                    <td className="px-3 py-2 text-center">{it.dispensedQty ?? '—'}</td>
                    <td className="px-3 py-2 capitalize">
                      {it.saleUnit === 'loose'
                        ? it.looseUnitLabel || 'loose'
                        : it.saleUnit}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{inr(it.lineTotal)}</td>
                  </tr>
                ))}
                {(indent.items?.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                      No line items.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Raise Indent dialog (pharmacist raising on behalf of a ward)
// ============================================================

interface DraftLine {
  key: number;
  drugFormularyId: string;
  drugName: string;
  looseUnitLabel?: string | null;
  requestedQty: string;
  saleUnit: 'pack' | 'loose';
}

const NONE = 'none';

function RaiseIndentDialog({
  open,
  onOpenChange,
  defaultWardId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultWardId?: string;
}) {
  const { data: wards } = useWards();
  const raise = useRaiseIndent();
  const keyRef = useRef(1);

  const [patientQuery, setPatientQuery] = useState('');
  const [patient, setPatient] = useState<{ id: string; name: string; mrn?: string } | null>(null);
  const { data: patients, isLoading: patientsLoading } = usePatientSearch(patientQuery);

  const [wardId, setWardId] = useState(defaultWardId ?? '');
  const [isTto, setIsTto] = useState(false);
  const [priority, setPriority] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([
    { key: 0, drugFormularyId: '', drugName: '', requestedQty: '', saleUnit: 'pack' },
  ]);

  const reset = () => {
    setPatientQuery('');
    setPatient(null);
    setWardId(defaultWardId ?? '');
    setIsTto(false);
    setPriority('');
    setNotes('');
    keyRef.current = 1;
    setLines([{ key: 0, drugFormularyId: '', drugName: '', requestedQty: '', saleUnit: 'pack' }]);
  };

  const close = () => {
    onOpenChange(false);
    reset();
  };

  const toggleTto = (v: boolean) => {
    setIsTto(v);
    // A TTO / discharge indent is always dispensed in full packs.
    if (v) setLines((ls) => ls.map((l) => ({ ...l, saleUnit: 'pack' })));
  };

  const addLine = () =>
    setLines((ls) => [
      ...ls,
      { key: keyRef.current++, drugFormularyId: '', drugName: '', requestedQty: '', saleUnit: 'pack' },
    ]);

  const updateLine = (key: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const removeLine = (key: number) =>
    setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));

  const submit = () => {
    if (!patient) return toast.error('Select a patient');
    const items = lines
      .filter((l) => l.drugFormularyId && Number(l.requestedQty) > 0)
      .map((l) => ({
        drugFormularyId: l.drugFormularyId,
        requestedQty: Number(l.requestedQty),
        saleUnit: (isTto ? 'pack' : l.saleUnit) as 'pack' | 'loose',
      }));
    if (items.length === 0) return toast.error('Add at least one drug with a quantity');

    raise.mutate(
      {
        patientId: patient.id,
        wardId: wardId || undefined,
        isTto,
        priority: priority || undefined,
        notes: notes.trim() || undefined,
        items,
      },
      {
        onSuccess: () => {
          toast.success('Indent raised');
          close();
        },
        onError: (err: any) => toast.error(err?.message ?? 'Failed to raise indent'),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Raise Medication Indent</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Patient */}
          <div className="space-y-1.5">
            <Label>Patient *</Label>
            {patient ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-muted/30">
                <div>
                  <span className="font-medium">{patient.name}</span>
                  {patient.mrn && (
                    <span className="ml-2 text-xs text-muted-foreground">MRN: {patient.mrn}</span>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPatient(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                <Input
                  placeholder="Search patient by name or MRN..."
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                />
                {patientQuery.trim().length >= 2 && (
                  <div className="rounded-md border bg-popover max-h-40 overflow-y-auto shadow-md">
                    {patientsLoading ? (
                      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Searching...
                      </div>
                    ) : patients && patients.length > 0 ? (
                      patients.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() =>
                            setPatient({
                              id: p.id,
                              name: `${p.firstName} ${p.lastName ?? ''}`.trim(),
                              mrn: p.mrn,
                            })
                          }
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b last:border-b-0"
                        >
                          <span className="font-medium">
                            {p.firstName} {p.lastName}
                          </span>
                          {p.mrn && (
                            <span className="ml-2 text-muted-foreground">MRN: {p.mrn}</span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No patients found</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ward + priority + TTO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Ward</Label>
              <Select
                value={wardId || NONE}
                onValueChange={(v: string | null) => setWardId(v === NONE ? '' : v ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select ward" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Unassigned —</SelectItem>
                  {(wards ?? []).map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={priority || NONE}
                onValueChange={(v: string | null) => setPriority(v === NONE ? '' : v ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Routine" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Routine</SelectItem>
                  {PRIORITIES.filter((p) => p !== 'routine').map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-input"
              checked={isTto}
              onChange={(e) => toggleTto(e.target.checked)}
            />
            TTO / discharge medication (dispensed in full packs)
          </label>

          {/* Drug lines */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Drugs *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add drug
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((line) => (
                <IndentDrugLine
                  key={line.key}
                  line={line}
                  isTto={isTto}
                  canRemove={lines.length > 1}
                  onChange={(patch) => updateLine(line.key, patch)}
                  onRemove={() => removeLine(line.key)}
                />
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional note for the pharmacist..."
              className="flex min-h-[56px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={raise.isPending}>
            {raise.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Raise Indent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// A single drug line inside the raise dialog — drug picker + qty + unit.
function IndentDrugLine({
  line,
  isTto,
  canRemove,
  onChange,
  onRemove,
}: {
  line: DraftLine;
  isTto: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<DraftLine>) => void;
  onRemove: () => void;
}) {
  const [search, setSearch] = useState('');
  const fq = useFormulary(search.trim().length >= 1 ? { search: search.trim() } : undefined);
  const drugs = fq.data?.data ?? [];

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {line.drugFormularyId ? (
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
              <span className="font-medium truncate">{line.drugName}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange({ drugFormularyId: '', drugName: '', looseUnitLabel: null });
                  setSearch('');
                }}
              >
                Change
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search drug..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {search.trim().length >= 1 && (
                <div className="rounded-md border bg-popover max-h-40 overflow-y-auto shadow-md">
                  {fq.isLoading ? (
                    <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Searching...
                    </div>
                  ) : drugs.length > 0 ? (
                    drugs.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          onChange({
                            drugFormularyId: d.id,
                            drugName: d.drugName,
                            looseUnitLabel: d.looseUnitLabel,
                          });
                          setSearch('');
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b last:border-b-0"
                      >
                        <span className="font-medium">{d.drugName}</span>
                        {d.strength && (
                          <span className="ml-1 text-xs text-muted-foreground">{d.strength}</span>
                        )}
                        {d.genericName && (
                          <span className="ml-2 text-xs text-muted-foreground">{d.genericName}</span>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No drugs found</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <Input
          type="number"
          min={1}
          placeholder="Qty"
          value={line.requestedQty}
          onChange={(e) => onChange({ requestedQty: e.target.value })}
          className="w-20 shrink-0"
        />

        <div className="w-28 shrink-0">
          <Select
            value={line.saleUnit}
            onValueChange={(v: string | null) =>
              onChange({ saleUnit: (v as 'pack' | 'loose') ?? 'pack' })
            }
            disabled={isTto}
          >
            <SelectTrigger>
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pack">Pack</SelectItem>
              {!isTto && (
                <SelectItem value="loose">{line.looseUnitLabel || 'Loose'}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-red-600"
          onClick={onRemove}
          disabled={!canRemove}
          title="Remove"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
