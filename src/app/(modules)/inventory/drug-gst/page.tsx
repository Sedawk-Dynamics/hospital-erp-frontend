'use client';

import { useState } from 'react';
import { FileText, RefreshCw, IndianRupee, Calculator, Receipt } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { cn } from '@/lib/utils';
import { toInputDateStr } from '@/lib/date-utils';
import { useGstReport } from '@/hooks/use-pharmacy';
import { TreatmentBadge } from '@/components/hospital/gst/gst-badges';

const fmtINR = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function GSTReportPageInner() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toInputDateStr(d);
  });
  const [to, setTo] = useState(() => toInputDateStr());

  const { data, isLoading, refetch } = useGstReport({
    fromDate: from || undefined,
    toDate: to || undefined,
  });

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5" /> GST Summary
          </h1>
          <p className="text-xs text-muted-foreground">
            The pharmacy&apos;s share of the hospital&apos;s outward supplies, folded
            from the billed lines — each at the rate it was actually billed at.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground block">From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground block">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          label="Total Sales (incl. GST)"
          value={isLoading || !data ? '…' : fmtINR(data.summary.totalSales)}
          icon={IndianRupee}
          tone="blue"
        />
        <StatTile
          label="Taxable Value"
          value={isLoading || !data ? '…' : fmtINR(data.summary.taxableValue)}
          icon={Calculator}
          tone="purple"
        />
        <StatTile
          label="Total GST"
          value={isLoading || !data ? '…' : fmtINR(data.summary.totalGst)}
          icon={Receipt}
          tone="amber"
        />
        <StatTile
          label="Transactions"
          value={isLoading || !data ? '…' : data.summary.transactions}
          icon={Receipt}
          tone="emerald"
        />
      </div>

      {/* CGST/SGST split */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant mb-3">
          Intra-state Split (CGST + SGST)
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <Mini label="CGST" value={data ? fmtINR(data.summary.cgst) : '—'} />
          <Mini label="SGST" value={data ? fmtINR(data.summary.sgst) : '—'} />
          <Mini label="IGST (inter-state)" value={data ? fmtINR(data.summary.igst) : '—'} />
        </div>
      </div>

      {/* Rate-wise — the answer to "how much GST do we owe". */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        <div className="px-4 pt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            By Rate
          </h3>
          <p className="text-xs text-muted-foreground">
            Exempt and taxable-at-0% are kept apart — they share a number and go
            in different boxes on the return.
          </p>
        </div>
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : !data || data.byRate.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Nothing billed in range"
            description="No pharmacy lines were billed in the selected dates."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Treatment</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">CGST</TableHead>
                <TableHead className="text-right">SGST</TableHead>
                <TableHead className="text-right">IGST</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Lines</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byRate.map((r) => (
                <TableRow key={`${r.treatment}:${r.ratePercent}`}>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  <TableCell className="text-right">
                    {r.treatment === 'taxable' ? `${r.ratePercent}%` : '—'}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{fmtINR(r.taxableValue)}</TableCell>
                  <TableCell className="text-right">{r.cgstAmount ? fmtINR(r.cgstAmount) : '—'}</TableCell>
                  <TableCell className="text-right">{r.sgstAmount ? fmtINR(r.sgstAmount) : '—'}</TableCell>
                  <TableCell className="text-right">{r.igstAmount ? fmtINR(r.igstAmount) : '—'}</TableCell>
                  <TableCell className="text-right font-medium">{fmtINR(r.totalAmount)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{r.lines}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* What was sold */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        <div className="px-4 pt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            By Item
          </h3>
          <p className="text-xs text-muted-foreground">
            Each line at its own rate and its own HSN — the two things the return
            groups by.
          </p>
        </div>
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : !data || data.byDrug.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Nothing billed in range"
            description="No pharmacy lines were billed in the selected dates."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>HSN</TableHead>
                <TableHead>GST</TableHead>
                <TableHead className="text-right">Total (incl. GST)</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">GST amt</TableHead>
                <TableHead className="text-right">Lines</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byDrug.map((c) => (
                <TableRow key={c.drugId}>
                  <TableCell className="font-medium">{c.drugName}</TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">{c.hsnSacCode ?? '—'}</TableCell>
                  <TableCell>
                    <TreatmentBadge
                      treatment={c.treatment === 'unclassified' ? null : c.treatment}
                      ratePercent={c.ratePercent}
                    />
                  </TableCell>
                  <TableCell className="text-right">{fmtINR(c.totalAmount)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{fmtINR(c.taxableValue)}</TableCell>
                  <TableCell className="text-right text-amber-700">{c.gstAmount ? fmtINR(c.gstAmount) : '—'}</TableCell>
                  <TableCell className="text-right">{c.transactions}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function StatTile({
  label, value, icon: Icon, tone,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'blue' | 'purple' | 'amber' | 'emerald';
}) {
  const toneCls = {
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  }[tone];
  return (
    <div className={cn('rounded-xl shadow-sanctuary p-4', toneCls)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wide">{label}</p>
          <p className="font-headline text-xl font-bold mt-1">{value}</p>
        </div>
        <Icon className="size-6" />
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}

// Drug GST report now lives under the Inventory module; inventory-module
// membership governs access, so no extra role guard is needed.
export default function DrugGstReportPage() {
  return <GSTReportPageInner />;
}
