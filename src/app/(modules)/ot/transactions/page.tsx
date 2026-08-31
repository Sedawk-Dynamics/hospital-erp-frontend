'use client';

import { useState, useMemo } from 'react';
import { formatDate } from '@/lib/date-utils';
import {
  CreditCard, Search, Download, IndianRupee, Clock, CheckCircle2, XCircle, Pencil, Loader2, Receipt,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { useOTRequests, useUpdateOTRequest, useBillOtRequest, type OTRequest } from '@/hooks/use-ot';
import { useAuthStore } from '@/stores/auth-store';
import { fullName } from '@/lib/person-name';

// Pushing an OT charge to the hospital bill creates/finalizes a bill and can
// record payment — a billing action, so it's limited to hospital admins
// (the backend requires billing:create, which only admin/super_admin hold here).
function useCanBillToHospital() {
  const roleSlug = useAuthStore((s) => s.user?.role?.slug);
  const n = (roleSlug ?? '').toLowerCase().replace(/[\s-]+/g, '_');
  return n === 'admin' || n === 'super_admin';
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-300',
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  partially_paid: 'bg-blue-100 text-blue-700 border-blue-300',
  cancelled: 'bg-red-100 text-red-700 border-red-300',
};

function rupees(n: number | null | undefined) {
  if (n == null) return '-';
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatPatientName(req: OTRequest): string {
  if (req.patient) return fullName(req.patient);
  return req.patientId;
}

export default function OTTransactionsPage() {
  const canBill = useCanBillToHospital();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<OTRequest | null>(null);
  const [billingId, setBillingId] = useState<string | null>(null);
  const bill = useBillOtRequest();

  // One click → add the surgery's charge onto the patient's running in-patient
  // bill (ledger). OT is admitted-only, so there's no payment to collect here —
  // it's settled with the consolidated IP bill at discharge.
  const addToLedger = (r: OTRequest) => {
    setBillingId(r.id);
    bill.mutate(
      { id: r.id },
      {
        onSuccess: () => toast.success(`Added to ${formatPatientName(r)}'s in-patient bill (ledger)`),
        onError: (e: any) => toast.error(e?.message ?? 'Failed to add to ledger'),
        onSettled: () => setBillingId(null),
      },
    );
  };

  const { data, isLoading } = useOTRequests({ page, limit: 20, search: search.trim() || undefined });
  const all = data?.data ?? [];
  const meta = data?.meta;

  // Stats computed from the same payload (page-scoped, but reasonable for billing screen)
  const stats = useMemo(() => {
    return all.reduce(
      (acc, r) => {
        const status = (r.billingStatus ?? 'pending').toLowerCase();
        const amt = r.billingAmount ?? 0;
        acc.total += amt;
        if (status === 'paid') acc.paid += amt;
        if (status === 'pending' || status === 'partially_paid') acc.pending += amt;
        if (status === 'cancelled') acc.cancelled += amt;
        return acc;
      },
      { total: 0, paid: 0, pending: 0, cancelled: 0 },
    );
  }, [all]);

  return (
    <div className="space-y-5 animate-fade-in-up">
      <PageHeader
        title="OT Billing Transactions"
        description="Manage OT billing and payment records linked to surgeries"
        action={
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Billed', value: stats.total, icon: IndianRupee, bg: 'bg-blue-50', color: 'text-blue-600' },
          { label: 'Paid', value: stats.paid, icon: CheckCircle2, bg: 'bg-emerald-50', color: 'text-emerald-600' },
          { label: 'Pending', value: stats.pending, icon: Clock, bg: 'bg-amber-50', color: 'text-amber-600' },
          { label: 'Cancelled', value: stats.cancelled, icon: XCircle, bg: 'bg-red-50', color: 'text-red-600' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl shadow-sanctuary p-4 ${s.bg}`}>
            <div className="flex items-center gap-2">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
            <p className="font-headline text-2xl font-extrabold mt-1">{rupees(s.value)}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search patient, surgery..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        {isLoading ? (
          <div className="p-4"><Skeleton className="h-40 w-full" /></div>
        ) : all.length === 0 ? (
          <div className="p-8">
            <EmptyState icon={CreditCard} title="No billing records" description="OT billing rows show up once surgeries are scheduled." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[10px] uppercase tracking-widest font-label text-on-surface-variant">
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Surgery</th>
                  <th className="px-4 py-3">Surgeon</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">OT Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {all.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <div className="font-medium">{formatPatientName(r)}</div>
                      {r.patient?.mrn && <div className="text-xs text-muted-foreground">{r.patient.mrn}</div>}
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-medium">{r.surgeryName}</div>
                      {r.surgeryType && <div className="text-xs text-muted-foreground">{r.surgeryType}</div>}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {r.surgeon?.user
                        ? `Dr. ${fullName(r.surgeon.user)}`
                        : r.doctor?.user
                          ? `Dr. ${fullName(r.doctor.user)}`
                          : '-'}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">
                      {r.scheduledDate ? formatDate(r.scheduledDate) : '-'}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{rupees(r.billingAmount)}</td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={`text-xs ${STATUS_COLOR[r.billingStatus ?? 'pending'] ?? ''}`}>
                        {r.billingStatus ?? 'pending'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className="text-xs capitalize">
                        {r.status?.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8"
                          onClick={() => setEditingId(r)}
                          title="Set billing amount / status"
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Amount
                        </Button>
                        {canBill && (r.billingAmount ?? 0) > 0 && r.billingStatus !== 'paid' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                            onClick={() => addToLedger(r)}
                            disabled={billingId === r.id}
                            title="Add this surgery's charge to the patient's in-patient bill (ledger)"
                          >
                            {billingId === r.id ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                            ) : (
                              <Receipt className="h-3.5 w-3.5 mr-1" />
                            )}
                            Add to Ledger
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">Page {meta.page} of {meta.totalPages}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {editingId && (
        <BillingDialog
          request={editingId}
          onOpenChange={(o) => { if (!o) setEditingId(null); }}
        />
      )}

    </div>
  );
}

// Set the surgery charge only — no payment status here. Payment is settled on
// the patient's consolidated in-patient bill at discharge, not per surgery.
function BillingDialog({ request, onOpenChange }: { request: OTRequest; onOpenChange: (o: boolean) => void }) {
  const [amount, setAmount] = useState(request.billingAmount?.toString() ?? '');
  const update = useUpdateOTRequest();

  const save = () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 0) {
      toast.error('Enter a valid amount');
      return;
    }
    update.mutate(
      { id: request.id, billingAmount: amt },
      {
        onSuccess: () => {
          toast.success('OT charge set');
          onOpenChange(false);
        },
        onError: (e: any) => toast.error(e?.message ?? 'Update failed'),
      },
    );
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>OT Charge — {request.surgeryName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md bg-muted/40 p-3 text-sm">
            <div><span className="font-medium">Patient:</span> {request.patient?.firstName} {request.patient?.lastName}</div>
            {request.patient?.mrn && <div className="text-muted-foreground">MRN: {request.patient.mrn}</div>}
          </div>
          <div>
            <Label>Amount (₹)</Label>
            <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>
          <p className="text-xs text-muted-foreground">
            Set the charge, then click <span className="font-medium">Add to Ledger</span> on the row to post it to the patient&apos;s in-patient bill.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
