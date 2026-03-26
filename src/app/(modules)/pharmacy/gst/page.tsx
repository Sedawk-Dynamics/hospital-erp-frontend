'use client';

import { useState } from 'react';
import { formatMonthYear } from '@/lib/date-utils';
import { Search, Receipt, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableFooter,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { useBatches } from '@/hooks/use-pharmacy';

export default function GSTUpdatePage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useBatches({ page, limit: 20, search: search || undefined });

  const batches = data?.data ?? [];
  const meta = data?.meta;

  // Calculate totals for footer
  const totals = batches.reduce(
    (acc, batch) => {
      const sellingPrice = batch.sellingPrice ?? batch.mrp ?? 0;
      const qty = batch.availableQuantity ?? batch.quantity ?? 0;
      const taxableAmount = sellingPrice * qty;
      const gstRate = batch.gstRate ?? 0;
      const gstAmount = taxableAmount * (gstRate / 100);
      const cgst = gstAmount / 2;
      const sgst = gstAmount / 2;

      return {
        taxable: acc.taxable + taxableAmount,
        cgst: acc.cgst + cgst,
        sgst: acc.sgst + sgst,
        total: acc.total + taxableAmount + gstAmount,
      };
    },
    { taxable: 0, cgst: 0, sgst: 0, total: 0 }
  );

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-xl font-bold">GST Summary</h1>
      </div>

      {/* Search bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by drug name, batch, HSN code..."
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
        ) : batches.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No batch data"
            description={search ? 'No batches match your search.' : 'GST information will appear once drug batches are added to the inventory.'}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Drug Name</TableHead>
                  <TableHead>Batch No.</TableHead>
                  <TableHead>HSN Code</TableHead>
                  <TableHead className="text-right">GST Rate</TableHead>
                  <TableHead className="text-right">Taxable Amt</TableHead>
                  <TableHead className="text-right">CGST</TableHead>
                  <TableHead className="text-right">SGST</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Expiry</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => {
                  const sellingPrice = batch.sellingPrice ?? batch.mrp ?? 0;
                  const qty = batch.availableQuantity ?? batch.quantity ?? 0;
                  const taxableAmount = sellingPrice * qty;
                  const gstRate = batch.gstRate ?? 0;
                  const gstAmount = taxableAmount * (gstRate / 100);
                  const cgst = gstAmount / 2;
                  const sgst = gstAmount / 2;
                  const total = taxableAmount + gstAmount;

                  return (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">
                        {batch.formularyItem?.drugName || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {batch.batchNumber}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {batch.hsnCode || batch.formularyItem?.hsnCode || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {gstRate > 0 ? `${gstRate}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {taxableAmount > 0 ? `₹${taxableAmount.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {cgst > 0 ? `₹${cgst.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {sgst > 0 ? `₹${sgst.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {total > 0 ? `₹${total.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {batch.expiryDate
                          ? formatMonthYear(batch.expiryDate)
                          : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              {batches.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="font-semibold">
                      Page Total
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      ₹{totals.taxable.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      ₹{totals.cgst.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      ₹{totals.sgst.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      ₹{totals.total.toFixed(2)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              )}
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
