'use client';

// C-10 — Missing SAC codes (#264). A service billed at 0% with no SAC is allowed
// and warned; one that carries GST stops its bill until the code is set.

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/date-utils';
import type { GstReportQuery, MissingSacRow } from '@/hooks/use-gst-reports';
import { useMissingSac } from '@/hooks/use-gst-reports';
import { useRadiologyRole } from '@/hooks/use-radiology-role';
import { Column, ExportButton, Loading, ReportNotes, ReportTable, StatStrip, exportAll, money, plain, titleCase } from './gst-report-shell';

const FIX: Record<MissingSacRow['fix'], { href: string; label: string }> = {
  gst_classification: { href: '/hospital/settings/gst-classification', label: 'GST classification' },
  radiology_settings: { href: '/radiology/settings', label: 'Radiology settings' },
  registration_fee: { href: '/hospital/settings/registration-fee', label: 'Registration fee' },
};

const statusText = (r: MissingSacRow) =>
  r.status === 'warn'
    ? 'Warning'
    : [
        'Blocked',
        r.blockedDrafts ? `${r.blockedDrafts} draft bill(s) cannot be issued` : null,
        r.issuedTaxedLines ? `${r.issuedTaxedLines} line(s) already issued with GST` : null,
      ]
        .filter(Boolean)
        .join(' — ');

const cols: Column<MissingSacRow>[] = [
  {
    key: 'service', label: 'Service',
    cell: (r) => (
      <span>
        {r.service}
        {r.serviceCode ? <span className="ml-1 font-mono text-[10px] text-muted-foreground">{r.serviceCode}</span> : null}
      </span>
    ),
    csv: (r) => (r.serviceCode ? `${r.service} (${r.serviceCode})` : r.service),
  },
  { key: 'cat', label: 'Category', cell: (r) => titleCase(r.category), csv: (r) => titleCase(r.category) },
  { key: 'lines', label: 'Lines', align: 'right', cell: (r) => r.lines, csv: (r) => r.lines },
  { key: 'value', label: 'Value', align: 'right', cell: (r) => plain(r.value), csv: (r) => r.value },
  { key: 'rate', label: 'GST %', align: 'right', cell: (r) => `${r.maxRatePercent}%`, csv: (r) => r.maxRatePercent },
  { key: 'tax', label: 'GST', align: 'right', cell: (r) => plain(r.taxAmount), csv: (r) => r.taxAmount },
  {
    key: 'last', label: 'Last bill',
    cell: (r) => (r.lastBillDate ? `${r.lastBillNumber ?? '—'} · ${formatDate(r.lastBillDate)}` : 'Not billed'),
    csv: (r) => (r.lastBillDate ? `${r.lastBillNumber ?? ''} ${formatDate(r.lastBillDate)}` : 'Not billed'),
  },
  {
    key: 'status', label: 'Status',
    cell: (r) => (
      <div className="space-y-0.5">
        <Badge variant={r.status === 'blocked' ? 'destructive' : 'outline'}>{r.status === 'blocked' ? 'Blocked' : 'Warning'}</Badge>
        {r.status === 'blocked' && statusText(r) !== 'Blocked' ? (
          <p className="max-w-[16rem] text-[11px] text-muted-foreground">{statusText(r).replace(/^Blocked — /, '')}</p>
        ) : null}
      </div>
    ),
    csv: statusText,
  },
];

export function MissingSacView({ q }: { q: GstReportQuery }) {
  const { data, isLoading } = useMissingSac(q);
  const [status, setStatus] = useState<'all' | 'warn' | 'blocked'>('all');
  // Finance cannot open the radiology settings; the classification page lists scans too.
  const { isRadiologyAdmin } = useRadiologyRole();
  const fixOf = (r: MissingSacRow) =>
    r.fix === 'radiology_settings' && !isRadiologyAdmin ? FIX.gst_classification : FIX[r.fix];
  if (isLoading) return <Loading />;
  const rows = (data?.rows ?? []).filter((r) => status === 'all' || r.status === status);
  const s = data?.summary;
  return (
    <div className="space-y-4">
      <StatStrip
        stats={[
          { label: 'Services', value: String(s?.services ?? 0) },
          { label: 'Warning (0%)', value: String(s?.warn ?? 0), tone: (s?.warn ?? 0) > 0 ? 'warn' : 'good' },
          { label: 'Blocked (GST above 0%)', value: String(s?.blocked ?? 0), tone: (s?.blocked ?? 0) > 0 ? 'bad' : 'good' },
          { label: 'Bills that cannot be issued', value: String(s?.blockedDrafts ?? 0), tone: (s?.blockedDrafts ?? 0) > 0 ? 'bad' : 'good' },
          { label: 'Value billed without a code', value: money(s?.value ?? 0) },
        ]}
      />
      {data?.note ? <ReportNotes notes={[data.note]} /> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {(['all', 'blocked', 'warn'] as const).map((v) => (
            <Button key={v} size="sm" variant={status === v ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setStatus(v)}>
              {v === 'all' ? 'All' : v === 'blocked' ? 'Blocked' : 'Warnings'}
            </Button>
          ))}
        </div>
        <ExportButton {...exportAll('gst-missing-sac', cols, rows, q)} disabled={!rows.length} />
      </div>
      <ReportTable
        columns={[
          ...cols,
          {
            key: 'fix', label: '',
            cell: (r) => (
              <Link className="text-xs text-primary underline" href={fixOf(r).href}>
                Set the code in {fixOf(r).label}
              </Link>
            ),
          },
        ]}
        rows={rows}
        empty="Every service has a SAC code."
      />
    </div>
  );
}
