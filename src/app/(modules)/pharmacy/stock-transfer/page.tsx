'use client';

import { useState } from 'react';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import { Search, ArrowLeftRight, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { useStockTransactions } from '@/hooks/use-inventory';

const typeColors: Record<string, string> = {
  stock_in: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  stock_out: 'bg-red-500/10 text-red-600 border-red-500/20',
  return_stock: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  adjustment: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  expired_removal: 'bg-red-500/10 text-red-700 border-red-500/30',
};

const typeLabels: Record<string, string> = {
  stock_in: 'Stock In',
  stock_out: 'Stock Out',
  return_stock: 'Return',
  adjustment: 'Adjustment',
  expired_removal: 'Expired',
};

export default function PharmacyStockTransferPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useStockTransactions({ page, limit: 20, search: search || undefined });

  const transactions = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-xl font-bold">Stock Transactions</h1>
      </div>

      {/* Search bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by item name, reference..."
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
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="No stock transactions"
            description={search ? 'No transactions match your search.' : 'Stock movements will appear here as inventory changes occur.'}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-center">Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell className="font-medium">
                      {txn.inventoryItem?.itemName || txn.inventoryItemId}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={typeColors[txn.transactionType] || ''}>
                        {typeLabels[txn.transactionType] || txn.transactionType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={txn.transactionType === 'stock_in' ? 'text-emerald-600' : txn.transactionType === 'stock_out' ? 'text-red-600' : ''}>
                        {txn.transactionType === 'stock_in' ? '+' : txn.transactionType === 'stock_out' ? '-' : ''}{txn.quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{txn.department?.name || '-'}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {txn.referenceType ? `${txn.referenceType}` : '-'}
                      {txn.referenceId ? ` #${txn.referenceId.slice(0, 8)}` : ''}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTimeAmPm(txn.createdAt)}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-muted-foreground text-xs">
                      {txn.notes || '-'}
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
