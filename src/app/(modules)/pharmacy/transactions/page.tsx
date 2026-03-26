'use client';

import { useState } from 'react';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import { Search, Receipt, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { useDispenseRecords } from '@/hooks/use-pharmacy';

const statusColors: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  dispensed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  verified: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  cancelled: 'bg-red-500/10 text-red-600 border-red-500/20',
};

export default function PharmacyTransactionsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useDispenseRecords({ page, limit: 20, search: search || undefined });

  const records = data?.data ?? [];
  const meta = data?.meta;

  const getPatientName = (record: (typeof records)[0]) => {
    if (record.patient) {
      return `${record.patient.firstName} ${record.patient.lastName}`;
    }
    return '-';
  };

  const getPatientId = (record: (typeof records)[0]) => {
    return record.patient?.uhid || record.patientId || '-';
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-xl font-bold">Dispensing Records</h1>
      </div>

      {/* Search bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by patient name, ID..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full bg-muted/60" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No dispensing records"
            description={search ? 'No records match your search.' : 'Dispensing records will appear here once drugs are dispensed from the billing page.'}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Patient ID</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Dispensed At</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{getPatientName(record)}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {getPatientId(record)}
                    </TableCell>
                    <TableCell className="text-center">
                      {record.items?.length ?? 0}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {record.totalAmount != null ? `₹${record.totalAmount.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={statusColors[record.status] || ''}>
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTimeAmPm(record.dispensedAt)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground text-xs">
                      {record.notes || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, meta.total)} of {meta.total}
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
