'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  Pill,
  ArrowRight,
  BedDouble,
  Wallet,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import { calcQuantityFromStrings } from '@/lib/dosage-calc';
import { formatBaseQty, packLooseBreakdown } from '@/lib/pharmacy-units';
import {
  usePrescriptionQueue,
  useSetPharmacyOrderStatus,
  type PrescriptionListItem,
  type PrescriptionQueueParams,
  type PharmacyOrderStatus,
  type IpBillingCategory,
} from '@/hooks/use-pharmacy';

const statusBadge: Record<PrescriptionListItem['status'], string> = {
  active: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  partially_dispensed: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  dispensed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  cancelled: 'bg-red-500/10 text-red-600 border-red-500/20',
};

// G12: ward→pharmacy fulfilment lifecycle.
const ORDER_FLOW: PharmacyOrderStatus[] = ['ordered', 'preparing', 'ready', 'collected'];
const orderStatusBadge: Record<PharmacyOrderStatus, string> = {
  ordered: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  preparing: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  ready: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  collected: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
};
const nextOrderLabel: Record<Exclude<PharmacyOrderStatus, 'collected'>, string> = {
  ordered: 'Start prep',
  preparing: 'Mark ready',
  ready: 'Mark delivered',
};
// IP orders are delivered to the ward (not "collected" at a counter).
const ipStatusLabel = (s: PharmacyOrderStatus) => (s === 'collected' ? 'delivered' : s);

// G12: how the patient settles — drives whether the pharmacist collects payment.
// package / insurance are billed against the advance / TPA (no cash at counter).
const billingBadge: Record<IpBillingCategory, { label: string; cls: string; collect: boolean }> = {
  cash: { label: 'Cash — collect', cls: 'bg-rose-500/10 text-rose-600 border-rose-500/20', collect: true },
  corporate: { label: 'Corporate — collect', cls: 'bg-rose-500/10 text-rose-600 border-rose-500/20', collect: true },
  package: { label: 'Package — on advance', cls: 'bg-violet-500/10 text-violet-600 border-violet-500/20', collect: false },
  insurance: { label: 'Insurance — TPA', cls: 'bg-teal-500/10 text-teal-600 border-teal-500/20', collect: false },
};

export default function PrescriptionQueuePage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [scope, setScope] = useState<'pending' | 'all'>('pending');
  const [type, setType] = useState<'all' | 'op' | 'ip'>('all');

  const params = useMemo<PrescriptionQueueParams>(() => {
    const next: PrescriptionQueueParams = {
      page,
      limit: 20,
      search: search || undefined,
    };
    if (scope === 'pending') {
      next.status = 'pending';
      next.dispensed = false;
    }
    if (type !== 'all') next.prescriptionType = type;
    return next;
  }, [page, search, scope, type]);

  const { data, isLoading } = usePrescriptionQueue(params);
  const records = data?.data ?? [];
  const meta = data?.meta;
  const setOrderStatus = useSetPharmacyOrderStatus();

  const handleDispense = (rx: PrescriptionListItem) => {
    router.push(`/pharmacy?prescriptionId=${rx.id}`);
  };

  const advanceOrder = async (rx: PrescriptionListItem) => {
    const current = rx.pharmacyStatus ?? 'ordered';
    const idx = ORDER_FLOW.indexOf(current);
    const next = ORDER_FLOW[idx + 1];
    if (!next) return;
    try {
      await setOrderStatus.mutateAsync({ id: rx.id, status: next });
      toast.success(`Order ${next}`);
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to update order status');
    }
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-headline text-xl font-bold">Prescription Queue</h1>
          <p className="text-sm text-muted-foreground">
            Incoming e-prescriptions awaiting dispensing
          </p>
        </div>
        <Link href="/pharmacy">
          <Button size="sm" variant="outline">Open POS Billing</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by patient name, MRN, or notes..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>

        <Select value={scope} onValueChange={(v) => { setScope((v ?? 'pending') as 'pending' | 'all'); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Scope" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending only</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
          </SelectContent>
        </Select>

        <Select value={type} onValueChange={(v) => { setType((v ?? 'all') as 'all' | 'op' | 'ip'); setPage(1); }}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="op">OP</SelectItem>
            <SelectItem value="ip">IP</SelectItem>
          </SelectContent>
        </Select>

        {meta && (
          <span className="ml-auto text-xs text-muted-foreground">
            {meta.total} {meta.total === 1 ? 'prescription' : 'prescriptions'}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full bg-muted/60" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Queue is empty"
            description={
              scope === 'pending'
                ? 'No prescriptions are awaiting dispensing right now.'
                : 'No prescriptions match the current filters.'
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Date</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Drugs</TableHead>
                  <TableHead className="text-center w-[90px]">Type</TableHead>
                  <TableHead className="text-center w-[140px]">Status</TableHead>
                  <TableHead className="text-center w-[200px]">Fulfilment</TableHead>
                  <TableHead className="text-right w-[150px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((rx) => {
                  const doctorName = rx.doctor?.user
                    ? `Dr. ${rx.doctor.user.firstName} ${rx.doctor.user.lastName}`
                    : '-';
                  const items = rx.prescriptionItems;
                  const shown = items.slice(0, 3);
                  return (
                    <TableRow key={rx.id} className="group">
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTimeAmPm(rx.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {rx.patient.firstName} {rx.patient.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">{rx.patient.mrn}</div>
                        {/* G12: IP context — ward/bed + billing category */}
                        {rx.prescriptionType === 'ip' && rx.visit?.admission && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {(rx.visit.admission.ward || rx.visit.admission.bed) && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                <BedDouble className="h-3 w-3" />
                                {rx.visit.admission.ward?.name}
                                {rx.visit.admission.bed?.bedNumber ? ` · ${rx.visit.admission.bed.bedNumber}` : ''}
                              </span>
                            )}
                            {(() => {
                              const cat = (rx.visit.admission.billingCategory ?? 'cash') as IpBillingCategory;
                              const b = billingBadge[cat] ?? billingBadge.cash;
                              return (
                                <Badge className={`text-[10px] ${b.cls}`} title={b.collect ? 'Collect payment at counter' : 'No cash at counter'}>
                                  <Wallet className="mr-0.5 h-3 w-3" />
                                  {b.label}
                                </Badge>
                              );
                            })()}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                          {doctorName}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[340px]">
                        {items.length === 0 ? (
                          <span className="text-sm italic text-muted-foreground">No items</span>
                        ) : (
                          <div className="space-y-1.5">
                            {shown.map((it) => {
                              // Prefer the stored quantity; fall back to deriving it
                              // from the dose pattern × duration × per-intake dose so
                              // the pharmacist always sees a count to bill (null = PRN
                              // / can't derive).
                              const qty = it.quantity ?? calcQuantityFromStrings(it.frequency, it.duration, it.doseQuantity);
                              const dose = Number(it.doseQuantity ?? 1);
                              const sig = [it.frequency, it.duration, dose > 1 ? `× ${dose}` : null]
                                .filter(Boolean)
                                .join(' · ');
                              const dosageForm = it.drug?.dosageForm ?? null;
                              const looseLabel = it.drug?.looseUnitLabel ?? null;
                              // Total as tablets/caps/ml, plus a pack + loose breakdown
                              // so the pharmacist knows how to pick stock.
                              const totalLabel = qty != null ? formatBaseQty(qty, dosageForm, looseLabel) : null;
                              const breakdown = qty != null ? packLooseBreakdown(qty, it.drug?.packSize, dosageForm, looseLabel) : null;
                              return (
                                <div key={it.id} className="flex items-start gap-1.5">
                                  <Pill className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  <span className="min-w-0 text-sm leading-tight">
                                    <span className="font-medium">{it.drugName}</span>
                                    {it.dosage ? <span className="text-muted-foreground"> {it.dosage}</span> : null}
                                    {(sig || totalLabel || it.isPrn) && (
                                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                        {sig}
                                        {totalLabel != null ? (
                                          <>
                                            {sig ? ' → ' : ''}
                                            <span
                                              className="font-semibold text-foreground"
                                              title="Total units to dispense (dose × duration)"
                                            >
                                              {totalLabel}
                                            </span>
                                            {breakdown && (
                                              <span className="text-muted-foreground"> ({breakdown})</span>
                                            )}
                                          </>
                                        ) : it.isPrn ? (
                                          <>{sig ? ' · ' : ''}<span className="font-medium">PRN</span></>
                                        ) : null}
                                      </span>
                                    )}
                                  </span>
                                </div>
                              );
                            })}
                            {items.length > shown.length && (
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                +{items.length - shown.length} more item{items.length - shown.length > 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="uppercase text-[10px]">{rx.prescriptionType}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={statusBadge[rx.status]}>
                          {rx.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {/* G12: ward→pharmacy fulfilment lifecycle (IP orders) */}
                        {rx.prescriptionType === 'ip' ? (
                          (() => {
                            const cur = (rx.pharmacyStatus ?? 'ordered') as PharmacyOrderStatus;
                            return (
                              <div className="flex flex-col items-center gap-1">
                                <Badge className={orderStatusBadge[cur]}>{ipStatusLabel(cur)}</Badge>
                                {cur !== 'collected' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-[11px]"
                                    disabled={setOrderStatus.isPending}
                                    onClick={() => advanceOrder(rx)}
                                  >
                                    {cur === 'ready' ? <CheckCircle2 className="mr-1 h-3 w-3" /> : null}
                                    {nextOrderLabel[cur as Exclude<PharmacyOrderStatus, 'collected'>]}
                                  </Button>
                                )}
                              </div>
                            );
                          })()
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {rx.prescriptionType === 'ip' ? (
                          // IP meds are billed to the hospital IP bill — dispensed
                          // from the Ward Indents queue, never sold at the counter.
                          <div className="flex flex-col items-end gap-0.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => router.push('/pharmacy/indents')}
                            >
                              Ward Indent <ArrowRight className="ml-1 h-3 w-3" />
                            </Button>
                            <span className="text-[10px] text-muted-foreground">Billed to IP bill</span>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant={rx.status === 'cancelled' || rx.status === 'dispensed' ? 'outline' : 'default'}
                            disabled={rx.status === 'cancelled' || rx.prescriptionItems.length === 0}
                            onClick={() => handleDispense(rx)}
                          >
                            {rx.status === 'dispensed' ? 'View' : 'Dispense'}
                            <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, meta.total)} of {meta.total}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium">{page} / {meta.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
