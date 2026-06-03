'use client';

// NPPA / DPCO Price Control watch. Shows the price-controlled (scheduled) drugs
// THIS hospital stocks, comparing the hospital's own per-unit price against the
// official NPPA ceiling. Read-only — the hospital decides whether to re-price.
// Each hospital sets its own prices independently; nothing here changes them.

import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { EmptyState } from '@/components/shared/empty-state';
import { usePriceControlWatch } from '@/hooks/use-pharmacy';

export default function PriceControlPage() {
  const { data, isLoading } = usePriceControlWatch();
  const items = data?.items ?? [];

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <h1 className="font-headline text-xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Price Control (NPPA / DPCO)
        </h1>
        <p className="text-sm text-muted-foreground">
          Government price-controlled drugs you stock, compared to the official NPPA ceiling. Your
          own prices are never changed automatically — this is a compliance view.
        </p>
      </div>

      {/* Summary */}
      {!isLoading && items.length > 0 && (
        <div className="flex gap-3">
          <div className="rounded-xl border bg-surface-container-lowest p-3 flex-1">
            <p className="text-xs text-muted-foreground">Scheduled drugs stocked</p>
            <p className="text-2xl font-bold">{data?.total ?? 0}</p>
          </div>
          <div className="rounded-xl border bg-surface-container-lowest p-3 flex-1">
            <p className="text-xs text-muted-foreground">Above ceiling</p>
            <p
              className={`text-2xl font-bold ${
                (data?.overCeilingCount ?? 0) > 0 ? 'text-rose-600' : 'text-primary'
              }`}
            >
              {data?.overCeilingCount ?? 0}
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-surface-container-lowest p-2">
        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No price-controlled drugs stocked"
            description="When you stock a drug that NPPA has flagged as scheduled, it will appear here with its ceiling price. Ask the platform admin to import the latest NPPA list."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Drug</TableHead>
                <TableHead>Composition</TableHead>
                <TableHead className="text-right">Your price / unit</TableHead>
                <TableHead className="text-right">NPPA ceiling</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notification</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.formularyId} className={it.isOverCeiling ? 'bg-rose-50/50' : ''}>
                  <TableCell className="font-medium">{it.drugName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {it.genericName ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {it.hospitalPrice != null ? (
                      <>
                        ₹{it.hospitalPrice.toLocaleString('en-IN')}
                        {it.priceSource && (
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            ({it.priceSource})
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {it.ceilingPrice != null ? `₹${it.ceilingPrice.toLocaleString('en-IN')}` : '—'}
                    {it.ceilingUnit && (
                      <span className="ml-1 text-[10px] text-muted-foreground">{it.ceilingUnit}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {it.isOverCeiling ? (
                      <Badge variant="outline" className="border-rose-300 bg-rose-100 text-rose-700 gap-1">
                        <ShieldAlert className="h-3 w-3" />
                        Above ceiling
                      </Badge>
                    ) : it.hospitalPrice != null && it.ceilingPrice != null ? (
                      <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                        Within ceiling
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        No price set
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {it.nppaNotification ?? '—'}
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
