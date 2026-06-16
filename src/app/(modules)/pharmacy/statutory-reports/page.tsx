'use client';
import { PharmacyAdminGuard } from '@/components/pharmacy/pharmacy-admin-guard';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { FileText } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { toInputDateStr, formatDate, formatDateTime } from '@/lib/date-utils';
import { useSuppliers } from '@/hooks/use-inventory';
import { useUsersList } from '@/hooks/use-users';
import {
  useDailyTransactionReport,
  usePurchaseReport,
  useStockValuationReport,
  useVendorWiseReport,
  useCreditNotesReport,
  useNarcoticRegister,
  useReorderList,
} from '@/hooks/use-pharmacy';

const inr = (n: number | null | undefined) =>
  n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Totals({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-muted/40 px-4 py-2 text-sm">{children}</div>
  );
}

function DailyReport() {
  const [date, setDate] = useState(() => toInputDateStr());
  const { data, isLoading } = useDailyTransactionReport(date || undefined);
  const s = data?.summary;
  return (
    <div className="space-y-3">
      <Input type="date" value={date} max={toInputDateStr()} onChange={(e) => setDate(e.target.value)} className="w-44" />
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <>
          {s && (
            <Totals>
              <span>Bills: <b>{s.billCount}</b></span>
              <span>Gross: <b>{inr(s.gross)}</b></span>
              <span>Discount: <b>{inr(s.discount)}</b></span>
              <span>GST: <b>{inr(s.tax)}</b></span>
              <span>Collected: <b className="text-emerald-600">{inr(s.collected)}</b></span>
              <span>Cancelled: <b>{s.cancelledCount}</b></span>
              {Object.entries(s.byPaymentMode ?? {}).map(([m, v]) => (
                <span key={m} className="capitalize text-muted-foreground">{m.replace('_', ' ')}: {inr(v as number)}</span>
              ))}
            </Totals>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.bills ?? []).map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">{b.billNumber}</TableCell>
                  <TableCell className="text-sm">
                    {b.patient ? `${b.patient.firstName} ${b.patient.lastName ?? ''}` : 'Walk-in'}
                  </TableCell>
                  <TableCell className="text-right font-mono">{inr(b.totalAmount)}</TableCell>
                  <TableCell className="text-right font-mono">{inr(b.amountPaid)}</TableCell>
                  <TableCell className="text-center"><Badge variant="outline" className="capitalize">{b.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {(data?.bills ?? []).length === 0 && (
            <EmptyState icon={FileText} title="No sales" description="No counter sales on this date." />
          )}
        </>
      )}
    </div>
  );
}

function PurchaseReportTab() {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return toInputDateStr(d); });
  const [to, setTo] = useState(() => toInputDateStr());
  const { data, isLoading } = usePurchaseReport({ fromDate: from || undefined, toDate: to || undefined });
  const t = data?.totals;
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
      </div>
      {isLoading ? <Skeleton className="h-32 w-full" /> : (
        <>
          {t && (
            <Totals>
              <span>Lines: <b>{t.lineCount}</b></span>
              <span>Qty: <b>{t.totalQty}</b></span>
              <span>Purchase value: <b>{inr(t.totalValue)}</b></span>
              <span>GST: <b>{inr(t.totalTax)}</b></span>
            </Totals>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Drug / Batch</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Qty (+free)</TableHead>
                <TableHead className="text-right">Rate / Disc</TableHead>
                <TableHead className="text-right">Net value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((b: any) => (
                <TableRow key={b.batchId}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(b.receivedAt)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{b.drugName}</div>
                    <div className="text-xs font-mono text-muted-foreground">{b.batchNumber}</div>
                  </TableCell>
                  <TableCell className="text-sm">{b.supplier ?? '—'}</TableCell>
                  <TableCell className="text-right">{b.quantityReceived}{b.freeQuantity ? ` (+${b.freeQuantity})` : ''}</TableCell>
                  <TableCell className="text-right text-xs">{inr(b.purchaseRate)}{b.discountPercent ? ` / ${b.discountPercent}%` : ''}</TableCell>
                  <TableCell className="text-right font-mono">{inr(b.netPurchaseValue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}

function ValuationTab() {
  const { data, isLoading } = useStockValuationReport();
  const t = data?.totals;
  return (
    <div className="space-y-3">
      {isLoading ? <Skeleton className="h-32 w-full" /> : (
        <>
          {t && (
            <Totals>
              <span>Batches: <b>{t.batchCount}</b></span>
              <span>At purchase: <b>{inr(t.totalPurchaseValue)}</b></span>
              <span>At selling: <b>{inr(t.totalSellingValue)}</b></span>
              <span>Potential margin: <b className="text-emerald-600">{inr(t.potentialMargin)}</b></span>
            </Totals>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Drug / Batch</TableHead>
                <TableHead className="text-right">In stock</TableHead>
                <TableHead className="text-right">Purchase value</TableHead>
                <TableHead className="text-right">Selling value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((b: any) => (
                <TableRow key={b.batchId}>
                  <TableCell>
                    <div className="font-medium">{b.drugName}</div>
                    <div className="text-xs font-mono text-muted-foreground">{b.batchNumber}</div>
                  </TableCell>
                  <TableCell className="text-right">{b.quantityInStock}</TableCell>
                  <TableCell className="text-right font-mono">{inr(b.purchaseValue)}</TableCell>
                  <TableCell className="text-right font-mono">{inr(b.sellingValue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}

function VendorWiseTab() {
  const { data: suppliersData } = useSuppliers({ limit: 100 });
  const [supplierId, setSupplierId] = useState('');
  const { data, isLoading } = useVendorWiseReport(supplierId || undefined);
  const t = data?.totals;
  return (
    <div className="space-y-3">
      <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
        <option value="">All vendors</option>
        {(suppliersData?.data ?? []).map((s: any) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      {isLoading ? <Skeleton className="h-32 w-full" /> : (
        <>
          {t && (
            <Totals>
              <span>Vendors: <b>{t.vendorCount}</b></span>
              <span>Total paid: <b>{inr(t.totalPaid)}</b></span>
              <span>Total qty: <b>{t.totalQty}</b></span>
            </Totals>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Total paid</TableHead>
                <TableHead className="text-right">Medicines</TableHead>
                <TableHead className="text-right">Batches</TableHead>
                <TableHead className="text-right">Qty (in stock)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((v: any) => (
                <TableRow key={v.supplierId}>
                  <TableCell className="font-medium">{v.supplierName}</TableCell>
                  <TableCell className="text-right font-mono">{inr(v.totalPaid)}</TableCell>
                  <TableCell className="text-right">{v.medicineCount}</TableCell>
                  <TableCell className="text-right">{v.batchCount}</TableCell>
                  <TableCell className="text-right">{v.totalQty} ({v.inStockQty})</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}

function CreditNotesTab() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data, isLoading } = useCreditNotesReport({ fromDate: from || undefined, toDate: to || undefined });
  const t = data?.totals;
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
      </div>
      {isLoading ? <Skeleton className="h-32 w-full" /> : (
        <>
          {t && (
            <Totals>
              <span>Credit notes: <b>{t.noteCount}</b></span>
              <span>Total credit: <b className="text-emerald-600">{inr(t.totalCredit)}</b></span>
            </Totals>
          )}
          {(data?.items ?? []).length === 0 ? (
            <EmptyState icon={FileText} title="No credit notes" description="No vendor returns / credit notes in this range." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Drug / Batch</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>CN no.</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.items ?? []).map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(r.date)}</TableCell>
                    <TableCell className="text-sm">{r.supplier ?? '—'}</TableCell>
                    <TableCell>
                      <div className="text-sm">{r.drugName ?? '—'}</div>
                      {r.batchNumber && <div className="text-xs font-mono text-muted-foreground">{r.batchNumber}</div>}
                    </TableCell>
                    <TableCell className="text-right">{r.quantity}</TableCell>
                    <TableCell className="font-mono text-xs">{r.creditNoteNumber ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono">{inr(r.creditAmount)}</TableCell>
                    <TableCell className="text-center"><Badge variant="outline" className="capitalize">{r.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}

function NarcoticTab() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [userId, setUserId] = useState('');
  const { data: usersData } = useUsersList({ limit: 100 });
  const { data, isLoading } = useNarcoticRegister({
    fromDate: from || undefined,
    toDate: to || undefined,
    dispensedBy: userId || undefined,
  });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
        <select value={userId} onChange={(e) => setUserId(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
          <option value="">All users</option>
          {(usersData?.data ?? []).map((u: any) => (
            <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
          ))}
        </select>
      </div>
      <p className="text-xs text-muted-foreground">Dispenses of Schedule X / H1 / H drugs — for Drug Inspector audit.</p>
      {isLoading ? <Skeleton className="h-32 w-full" /> : (data?.items ?? []).length === 0 ? (
        <EmptyState icon={FileText} title="No controlled-drug dispenses" description="No scheduled-drug sales in this range." />
      ) : (
        <>
          <Totals><span>Records: <b>{data.total}</b></span></Totals>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Drug</TableHead>
                <TableHead className="text-center">Sch.</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Dispensed by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(r.date)}</TableCell>
                  <TableCell className="font-medium">{r.drugName}</TableCell>
                  <TableCell className="text-center"><Badge variant="outline">{r.schedule ?? '—'}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{r.batchNumber ?? '—'}</TableCell>
                  <TableCell className="text-right">{r.quantity}</TableCell>
                  <TableCell className="text-sm">{r.patient ?? '—'}{r.patientMrn ? ` (${r.patientMrn})` : ''}</TableCell>
                  <TableCell className="text-sm">{r.dispensedBy ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}

function ReorderTab() {
  const { data, isLoading } = useReorderList();
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Drugs at or below their reorder level — review and raise a purchase order.
      </p>
      {isLoading ? <Skeleton className="h-32 w-full" /> : (data?.items ?? []).length === 0 ? (
        <EmptyState icon={FileText} title="Nothing to reorder" description="All drugs with a reorder level are above it (set reorder levels on the formulary)." />
      ) : (
        <>
          <Totals><span>Items to reorder: <b>{data.total}</b></span></Totals>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Drug</TableHead>
                <TableHead className="text-right">In stock</TableHead>
                <TableHead className="text-right">Reorder level</TableHead>
                <TableHead className="text-right">Suggested qty</TableHead>
                <TableHead>Last supplier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((r: any) => (
                <TableRow key={r.drugId}>
                  <TableCell>
                    <div className="font-medium">{r.drugName} {r.strength ?? ''}</div>
                    {r.manufacturer && <div className="text-xs text-muted-foreground">{r.manufacturer}</div>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">{r.stock}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{r.minStock}</TableCell>
                  <TableCell className="text-right font-semibold">{r.suggestedQty}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.lastSupplier ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}

function StatutoryReportsInner() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <h1 className="font-headline text-xl font-bold">Reports</h1>
        <p className="text-xs text-muted-foreground">
          Daily transactions, purchases, stock valuation, vendor-wise and supplier credit notes.
        </p>
      </div>
      <Tabs defaultValue="daily">
        <TabsList variant="line">
          <TabsTrigger value="daily">Daily Transactions</TabsTrigger>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
          <TabsTrigger value="valuation">Stock Valuation</TabsTrigger>
          <TabsTrigger value="vendor">Vendor-wise</TabsTrigger>
          <TabsTrigger value="credit">Credit Notes</TabsTrigger>
          <TabsTrigger value="narcotic">Narcotic (DI)</TabsTrigger>
          <TabsTrigger value="reorder">Reorder</TabsTrigger>
        </TabsList>
        <TabsContent value="daily"><DailyReport /></TabsContent>
        <TabsContent value="purchases"><PurchaseReportTab /></TabsContent>
        <TabsContent value="valuation"><ValuationTab /></TabsContent>
        <TabsContent value="vendor"><VendorWiseTab /></TabsContent>
        <TabsContent value="credit"><CreditNotesTab /></TabsContent>
        <TabsContent value="narcotic"><NarcoticTab /></TabsContent>
        <TabsContent value="reorder"><ReorderTab /></TabsContent>
      </Tabs>
    </div>
  );
}

export default function StatutoryReportsPage() {
  return (
    <PharmacyAdminGuard>
      <StatutoryReportsInner />
    </PharmacyAdminGuard>
  );
}
