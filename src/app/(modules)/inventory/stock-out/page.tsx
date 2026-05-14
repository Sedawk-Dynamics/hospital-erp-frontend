'use client';

import { ArrowRightLeft } from 'lucide-react';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import { useStockTransactions } from '@/hooks/use-inventory';

export default function StockOutPage() {
  // History of all "out" type transactions (stock_out + expired_removal).
  const { data: outResp, isLoading: outLoading } = useStockTransactions({
    transactionType: 'stock_out',
    limit: 50,
  });
  const { data: expResp, isLoading: expLoading } = useStockTransactions({
    transactionType: 'expired_removal',
    limit: 50,
  });

  const isLoading = outLoading || expLoading;
  // Merge & sort desc by createdAt
  const records = [
    ...(outResp?.data ?? []),
    ...(expResp?.data ?? []),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <h1 className="font-headline text-xl font-bold flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5" /> Stock Out (history)
        </h1>
        <p className="text-xs text-muted-foreground">
          Auto-recorded when items are dispensed/used. Includes expired-batch removals.
        </p>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : records.length === 0 ? (
          <EmptyState icon={ArrowRightLeft} title="No outflow" description="Stock-out records will appear here." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Performed By</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.inventoryItem?.itemName}</TableCell>
                  <TableCell>
                    {t.transactionType === 'expired_removal' ? (
                      <Badge className="bg-red-500/10 text-red-700 border-red-500/20">Expired</Badge>
                    ) : (
                      <Badge className="bg-blue-500/10 text-blue-700 border-blue-500/20">Stock Out</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{t.batchNumber ?? '-'}</TableCell>
                  <TableCell className="text-sm">{t.department?.name ?? '-'}</TableCell>
                  <TableCell className="text-right">{t.quantity}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {t.referenceType ?? '-'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.performer ? `${t.performer.firstName} ${t.performer.lastName}` : '-'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTimeAmPm(t.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
