'use client';

import { useState } from 'react';
import { FileText, RefreshCw, IndianRupee, Calculator, Receipt } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { cn } from '@/lib/utils';
import { toInputDateStr } from '@/lib/date-utils';
import { useGstReport } from '@/hooks/use-pharmacy';

const fmtINR = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const GST_RATES = [0, 5, 12, 18, 28];

export default function GSTReportPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toInputDateStr(d);
  });
  const [to, setTo] = useState(() => toInputDateStr());
  const [rate, setRate] = useState<number>(12);

  const { data, isLoading, refetch } = useGstReport({
    fromDate: from || undefined,
    toDate: to || undefined,
    gstRate: rate,
  });

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5" /> GST Summary
          </h1>
          <p className="text-xs text-muted-foreground">
            GST liability derived from dispense × selling price. Selling price is
            treated as GST-inclusive; CGST + SGST split applied for intra-state.
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
        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground block">GST Rate</label>
          <Select value={String(rate)} onValueChange={(v) => setRate(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Rate" />
            </SelectTrigger>
            <SelectContent>
              {GST_RATES.map((r) => (
                <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      {/* By category */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        <div className="px-4 pt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            By Drug Category
          </h3>
          <p className="text-xs text-muted-foreground">
            HSN code is not yet captured per drug. This view groups by drug category as a proxy.
          </p>
        </div>
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : !data || data.byCategory.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No GST data in range"
            description="No dispensing records found for the selected dates."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Total (incl. GST)</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">Txns</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byCategory.map((c) => (
                <TableRow key={c.categoryId}>
                  <TableCell className="font-medium">{c.categoryName}</TableCell>
                  <TableCell className="text-right">{fmtINR(c.totalAmount)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{fmtINR(c.taxableValue)}</TableCell>
                  <TableCell className="text-right text-amber-700">{fmtINR(c.gstAmount)}</TableCell>
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
