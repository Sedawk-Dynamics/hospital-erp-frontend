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
} from 'lucide-react';
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
import {
  usePrescriptionQueue,
  type PrescriptionListItem,
  type PrescriptionQueueParams,
} from '@/hooks/use-pharmacy';

const statusBadge: Record<PrescriptionListItem['status'], string> = {
  active: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  partially_dispensed: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  dispensed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  cancelled: 'bg-red-500/10 text-red-600 border-red-500/20',
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

  const handleDispense = (rx: PrescriptionListItem) => {
    router.push(`/pharmacy?prescriptionId=${rx.id}`);
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
                  <TableHead className="text-right w-[150px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((rx) => {
                  const doctorName = rx.doctor?.user
                    ? `Dr. ${rx.doctor.user.firstName} ${rx.doctor.user.lastName}`
                    : '-';
                  const drugLabels = rx.prescriptionItems.map((it) =>
                    `${it.drugName}${it.dosage ? ` ${it.dosage}` : ''}`,
                  );
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
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                          {doctorName}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <div className="flex items-start gap-1.5">
                          <Pill className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <span className="text-sm line-clamp-2">
                            {drugLabels.length === 0
                              ? <span className="text-muted-foreground italic">No items</span>
                              : drugLabels.join(', ')}
                          </span>
                        </div>
                        {rx.prescriptionItems.length > 0 && (
                          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {rx.prescriptionItems.length} item{rx.prescriptionItems.length > 1 ? 's' : ''}
                          </p>
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
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={rx.status === 'cancelled' || rx.status === 'dispensed' ? 'outline' : 'default'}
                          disabled={rx.status === 'cancelled' || rx.prescriptionItems.length === 0}
                          onClick={() => handleDispense(rx)}
                        >
                          {rx.status === 'dispensed' ? 'View' : 'Dispense'}
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
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
