'use client';

import { Download } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RTable, RHead, inr } from '@/components/reports/report-ui';
import { useConsumptionTransactions } from '@/hooks/use-inventory';
import { formatDate } from '@/lib/date-utils';
import { downloadCsv } from '@/lib/csv';

const label = (s: string | null | undefined) => (s ? s.replace(/_/g, ' ') : '');

/**
 * Gap 349: the supporting consumption records for one "Top consumed items"
 * row — batch, date, source document (PH-… bill, transfer number), quantity
 * and value. Same date range as the report, so the footer total reconciles to
 * the row that was clicked.
 */
export function ConsumptionTransactionsDialog({
  target, fromDate, toDate, onClose,
}: {
  target: { kind: 'item' | 'drug'; refId: string; itemName: string; qty: number; value: number } | null;
  fromDate: string;
  toDate: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useConsumptionTransactions(
    target ? { fromDate, toDate, kind: target.kind, refId: target.refId } : null,
  );
  const rows = data?.rows ?? [];
  const reconciles =
    !!data && !!target && data.totals.qty === target.qty && Math.abs(data.totals.value - target.value) < 0.005;

  return (
    <Dialog open={!!target} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{target?.itemName ?? 'Consumption'} — transactions</DialogTitle>
          <DialogDescription>
            Every stock-out counted in Top consumed items for {fromDate} to {toDate}.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <RTable>
              <RHead
                cols={[
                  { label: 'Date' }, { label: 'Batch' }, { label: 'Source document' }, { label: 'Type' },
                  { label: 'Qty', align: 'right' }, { label: 'Value', align: 'right' },
                ]}
              />
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="px-2.5 py-1.5 font-mono">{r.batchNumber ?? '—'}</td>
                    <td className="px-2.5 py-1.5">
                      <span className="font-mono">{r.documentNumber ?? '—'}</span>
                      {r.party && <div className="text-[10px] text-muted-foreground">{r.party}</div>}
                    </td>
                    <td className="px-2.5 py-1.5 capitalize text-muted-foreground">{label(r.movementType)}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">{r.quantityText ?? r.quantity}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">{inr(r.value)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="px-2.5 py-3 text-center text-muted-foreground">No transactions.</td></tr>
                )}
              </tbody>
              {data && rows.length > 0 && (
                <tfoot>
                  <tr className="border-t font-semibold">
                    <td className="px-2.5 py-1.5" colSpan={4}>
                      Total ({data.totals.transactions} transaction{data.totals.transactions === 1 ? '' : 's'})
                      {!reconciles && target && (
                        <span className="ml-2 text-[10px] font-normal text-amber-700">
                          differs from the summary row — refresh the report
                        </span>
                      )}
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">{data.totals.qty}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">{inr(data.totals.value)}</td>
                  </tr>
                </tfoot>
              )}
            </RTable>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            disabled={rows.length === 0}
            onClick={() =>
              downloadCsv(
                `consumption-${(target?.itemName ?? 'item').replace(/\W+/g, '-')}-${fromDate}_${toDate}.csv`,
                rows.map((r) => ({
                  date: r.date.slice(0, 10),
                  batch: r.batchNumber ?? '',
                  document: r.documentNumber ?? '',
                  party: r.party ?? '',
                  type: label(r.movementType),
                  quantity: r.quantity,
                  quantityInWords: r.quantityText ?? '',
                  unitCost: r.unitCost ?? '',
                  value: r.value,
                })),
              )
            }
          >
            <Download className="mr-1 h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
