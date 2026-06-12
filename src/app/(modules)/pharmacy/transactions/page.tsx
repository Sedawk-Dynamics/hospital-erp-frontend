'use client';
import { PharmacyAdminGuard } from '@/components/pharmacy/pharmacy-admin-guard';

import { useState } from 'react';
import { formatDate, formatDateTimeAmPm } from '@/lib/date-utils';
import {
  Search,
  Receipt,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Ban,
  Eye,
  IndianRupee,
  ReceiptText,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { cn } from '@/lib/utils';
import {
  useDispenseRecords,
  usePharmacySales,
  useCancelPharmacySale,
  usePharmacySale,
  type PharmacySaleListItem,
  type PharmacySaleStatus,
} from '@/hooks/use-pharmacy';
import { PharmacyReceiptDialog } from '@/components/pharmacy/pharmacy-receipt-dialog';

const money = (n: number | string | null | undefined) =>
  `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SALE_STATUS_BADGE: Record<PharmacySaleStatus, string> = {
  paid: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  partially_paid: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  pending: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  cancelled: 'bg-red-500/10 text-red-600 border-red-500/20',
};

// ============================================================
// Counter Sales tab — bills list, summary cards, view + void
// ============================================================

function CounterSalesTab() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | PharmacySaleStatus>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  // View-receipt + void dialog state
  const [viewBillId, setViewBillId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PharmacySaleListItem | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const { data, isLoading } = usePharmacySales({
    page,
    limit: 20,
    search: search || undefined,
    status: status === 'all' ? undefined : status,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
  });
  const bills = data?.data ?? [];
  const meta = data?.meta;
  const summary = data?.summary;

  const { data: viewSale } = usePharmacySale(viewBillId);
  const cancelSale = useCancelPharmacySale();

  const handleCancel = async () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) return toast.error('A cancellation reason is required');
    try {
      await cancelSale.mutateAsync({ id: cancelTarget.id, reason: cancelReason.trim() });
      toast.success(`Bill ${cancelTarget.billNumber} cancelled — stock restored`);
      setCancelTarget(null);
      setCancelReason('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel bill');
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard
          icon={ReceiptText}
          label="Total Bills"
          value={summary ? String(summary.totalBills) : '—'}
        />
        <SummaryCard
          icon={IndianRupee}
          label="Sales (net of voids)"
          value={summary ? money(summary.totalAmount) : '—'}
          accent="emerald"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Collected"
          value={summary ? money(summary.totalPaid) : '—'}
        />
        <SummaryCard
          icon={XCircle}
          label="Cancelled"
          value={summary ? String(summary.cancelledCount) : '—'}
          accent="red"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search bill #, patient, MRN..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus((v ?? 'all') as 'all' | PharmacySaleStatus);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="partially_paid">Partially paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5 text-sm">
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            className="h-9 w-36"
          />
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPage(1); }}
            className="h-9 w-36"
          />
        </div>
      </div>

      {/* Bills table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full bg-muted/60" />
            ))}
          </div>
        ) : bills.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No counter sales"
            description={
              search || status !== 'all' || fromDate || toDate
                ? 'No bills match the current filters.'
                : 'Counter sale invoices will appear here once you bill from the POS.'
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill #</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right w-[150px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((bill) => {
                  const isCancelled = bill.status === 'cancelled';
                  return (
                    <TableRow key={bill.id} className={cn(isCancelled && 'opacity-60')}>
                      <TableCell className="font-mono text-xs font-medium">{bill.billNumber}</TableCell>
                      <TableCell>
                        {bill.patient ? (
                          <>
                            <div className="font-medium">
                              {bill.patient.firstName} {bill.patient.lastName ?? ''}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">{bill.patient.mrn}</div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Walk-in</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{bill._count?.billItems ?? '-'}</TableCell>
                      <TableCell className="text-right font-medium">{money(bill.totalAmount)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{money(bill.amountPaid)}</TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {formatDateTimeAmPm(bill.billDate)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={SALE_STATUS_BADGE[bill.status]}>
                          {bill.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="View receipt"
                          onClick={() => setViewBillId(bill.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          title={isCancelled ? 'Already cancelled' : 'Cancel / void bill'}
                          disabled={isCancelled}
                          onClick={() => {
                            setCancelTarget(bill);
                            setCancelReason('');
                          }}
                        >
                          <Ban className="h-4 w-4" />
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

      {/* Receipt viewer (loads the full bill on demand) */}
      <PharmacyReceiptDialog
        sale={viewSale ?? null}
        open={!!viewBillId && !!viewSale}
        onOpenChange={(o) => { if (!o) setViewBillId(null); }}
      />

      {/* Void / cancel confirmation */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) { setCancelTarget(null); setCancelReason(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel bill {cancelTarget?.billNumber}?</DialogTitle>
            <DialogDescription>
              This voids the sale: the dispensed stock is returned to its batches and the counter
              payment is reversed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label htmlFor="cancelReason">Reason *</Label>
            <Textarea
              id="cancelReason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Billed in error, patient declined, wrong item..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Keep bill</DialogClose>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelSale.isPending}>
              {cancelSale.isPending ? 'Cancelling...' : 'Cancel bill'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: 'emerald' | 'red';
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p
        className={cn(
          'mt-1 font-headline text-2xl font-extrabold',
          accent === 'emerald' && 'text-emerald-600',
          accent === 'red' && 'text-red-600',
        )}
      >
        {value}
      </p>
    </div>
  );
}

// ============================================================
// Dispensing Records tab (per-line dispense register)
// ============================================================

function DispensingRecordsTab() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useDispenseRecords({ page, limit: 20, search: search || undefined });
  const records = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by patient name, drug..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="pl-9"
        />
      </div>

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
            description={search
              ? 'No records match your search.'
              : 'Dispensing records appear here once drugs are dispensed from the billing page.'}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Drug</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Dispensed By</TableHead>
                  <TableHead>Dispensed At</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {record.patient
                        ? `${record.patient.firstName} ${record.patient.lastName}`
                        : '-'}
                    </TableCell>
                    <TableCell>{record.drugBatch?.drug?.drugName ?? '-'}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {record.drugBatch?.batchNumber ?? '-'}
                    </TableCell>
                    <TableCell className="text-right">{record.quantityDispensed}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {record.dispenser
                        ? `${record.dispenser.firstName} ${record.dispenser.lastName}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTimeAmPm(record.dispensedAt)}
                    </TableCell>
                    <TableCell className="text-center">
                      {record.verifiedBy ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                          Dispensed
                        </Badge>
                      )}
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

function PharmacyTransactionsPageInner() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <h1 className="font-headline text-xl font-bold">Billing Transactions</h1>
        <p className="text-sm text-muted-foreground">
          Counter-sale invoices and the dispensing register. Void a bill to restore stock.
        </p>
      </div>

      <Tabs defaultValue="sales">
        <TabsList variant="line">
          <TabsTrigger value="sales">Counter Sales</TabsTrigger>
          <TabsTrigger value="dispensing">Dispensing Records</TabsTrigger>
        </TabsList>
        <TabsContent value="sales" className="pt-4">
          <CounterSalesTab />
        </TabsContent>
        <TabsContent value="dispensing" className="pt-4">
          <DispensingRecordsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function PharmacyTransactionsPage() {
  return (
    <PharmacyAdminGuard>
      <PharmacyTransactionsPageInner />
    </PharmacyAdminGuard>
  );
}
