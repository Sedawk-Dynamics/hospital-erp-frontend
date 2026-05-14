'use client';

import { useState } from 'react';
import { Activity, AlertTriangle, RefreshCw, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import { useExpiringInventory, useFlagExpired } from '@/hooks/use-inventory';

export default function ExpiringInventoryPage() {
  const [months, setMonths] = useState(3);
  const { data, isLoading, refetch } = useExpiringInventory(months);
  const flag = useFlagExpired();

  const handleFlag = async () => {
    if (!confirm('Flag all expired batches as removed? This will deduct expired stock and create audit transactions.')) return;
    try {
      const result = await flag.mutateAsync();
      toast.success(`${result.flagged} expired batch(es) flagged and removed from stock`);
      refetch();
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed');
    }
  };

  const items = data?.items ?? [];

  // Categorize urgency
  const today = new Date();
  const tagFor = (expiry: string) => {
    const days = Math.floor((new Date(expiry).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 7) return { label: `${days}d`, tone: 'red' };
    if (days <= 30) return { label: `${days}d`, tone: 'amber' };
    return { label: `${days}d`, tone: 'yellow' };
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <Activity className="h-5 w-5" /> Expiry Tracking
          </h1>
          <p className="text-xs text-muted-foreground">
            Batches with expiry coming up within the selected window.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Next 1 month</SelectItem>
              <SelectItem value="3">Next 3 months</SelectItem>
              <SelectItem value="6">Next 6 months</SelectItem>
              <SelectItem value="12">Next 12 months</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
          </Button>
          <Button size="sm" variant="destructive" onClick={handleFlag} disabled={flag.isPending}>
            <ShieldX className="mr-1.5 h-4 w-4" /> Flag Expired
          </Button>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="No batches expiring"
            description={`No inventory batches expire within the next ${months} month${months > 1 ? 's' : ''}.`}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-center">Time Left</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Value at risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => {
                const tag = tagFor(row.expiryDate);
                const tagCls = {
                  red: 'bg-red-500/10 text-red-700 border-red-500/20',
                  amber: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
                  yellow: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
                }[tag.tone];
                const valueAtRisk = row.remainingQuantity * (row.unitCost || 0);
                return (
                  <TableRow key={row.transactionId}>
                    <TableCell className="font-medium">{row.item.itemName}</TableCell>
                    <TableCell className="font-mono text-xs">{row.batchNumber ?? '-'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(row.expiryDate)}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={tagCls}>{tag.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{row.remainingQuantity}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{row.receivedQuantity}</TableCell>
                    <TableCell className="text-sm">{row.supplier?.name ?? '-'}</TableCell>
                    <TableCell className="text-right text-amber-700">
                      {valueAtRisk > 0 ? `₹${valueAtRisk.toFixed(2)}` : '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
