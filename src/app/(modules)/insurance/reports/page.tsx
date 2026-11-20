'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BarChart3, Download, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/date-utils';
import { formatINR } from '@/lib/money';
import { InsuranceReportFilters, amountRateBasis } from '@/components/insurance/insurance-report-filters';
import {
  useClaimsSummaryReport,
  useApprovalRateReport,
  useAgingReport,
  useOutstandingReport,
  type ReportFilters,
  type PayerGroup,
} from '@/hooks/use-insurance';

function rate(value: number | null | undefined) {
  // null = nothing decided yet; "—" rather than a misleading 0% (gap 290).
  return value === null || value === undefined ? '—' : `${value}%`;
}

// Gap 289: the shared formatter (₹1,23,456.78). CSV keeps plain numbers.
function inr(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return formatINR(value);
}

type CsvCell = string | number | null | undefined;
function downloadCsv(filename: string, rows: CsvCell[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${(c ?? '').toString().replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function InsuranceReportsPage() {
  const [filters, setFilters] = useState<ReportFilters>({});

  const summary = useClaimsSummaryReport(filters);
  const approval = useApprovalRateReport(filters);
  const aging = useAgingReport(filters);
  const outstanding = useOutstandingReport(filters);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-headline">Insurance Reports</h1>
        <p className="text-sm text-on-surface-variant">
          Claims summary, approval rate, aging, and outstanding receivables.
        </p>
      </div>

      {/* Gap 290: the same filter bar (and the same backend filter) as the dashboard. */}
      <InsuranceReportFilters filters={filters} onChange={setFilters} />

      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList>
          <TabsTrigger value="summary">Claims Summary</TabsTrigger>
          <TabsTrigger value="approval">Approval Rate</TabsTrigger>
          <TabsTrigger value="aging">Aging</TabsTrigger>
          <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
        </TabsList>

        {/* Summary */}
        <TabsContent value="summary">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="size-4 text-primary" /> Claims Summary
                </CardTitle>
                <CardDescription>
                  By claim status. {summary.data?.definitions?.totals}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  const rows: CsvCell[][] = [
                    ['Status', 'Count', 'Claimed', 'Approved', 'Paid'],
                    ...(summary.data?.byStatus ?? []).map(
                      (r): CsvCell[] => [r.status, r.count, r.claimed, r.approved, r.paid],
                    ),
                  ];
                  downloadCsv('claims-summary.csv', rows);
                }}
              >
                <Download className="size-4" /> CSV
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <Tile label="Total Claims" value={summary.data?.total.count ?? 0} />
                <Tile label="Claimed" value={inr(summary.data?.total.claimed)} />
                <Tile label="Approved" value={inr(summary.data?.total.approved)} />
                <Tile label="Paid" value={inr(summary.data?.total.paid)} />
                <Tile
                  label="Outstanding"
                  value={inr(summary.data?.total.outstanding)}
                  hint={summary.data?.definitions?.outstanding}
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>Claimed</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.data?.byStatus?.length ? (
                    summary.data.byStatus.map((r) => (
                      <TableRow
                        key={r.status}
                        className={r.excludedFromTotals ? 'text-on-surface-variant' : undefined}
                      >
                        <TableCell className="font-medium">
                          {r.status.replace(/_/g, ' ')}
                          {r.excludedFromTotals && (
                            <span className="ml-1 text-[10px] uppercase">(not in totals)</span>
                          )}
                        </TableCell>
                        <TableCell>{r.count}</TableCell>
                        <TableCell>{inr(r.claimed)}</TableCell>
                        <TableCell>{inr(r.approved)}</TableCell>
                        <TableCell>{inr(r.paid)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-on-surface-variant">
                        No claims in this range.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Approval rate */}
        <TabsContent value="approval">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Approval Rate</CardTitle>
                <CardDescription>By payer (payer case first, then policy)</CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  const rows: CsvCell[][] = [
                    [
                      'Payer', 'Total', 'Decided', 'Approved', 'Rejected', 'Rate by count %',
                      'Rate by amount %', 'Decided claimed amt', 'Decided approved amt', 'Claimed', 'Approved Amt',
                    ],
                    ...(approval.data?.byInsurer ?? []).map(
                      (r): CsvCell[] => [
                        r.insurerName,
                        r.total,
                        r.decided,
                        r.approved,
                        r.rejected,
                        r.approvalRate,
                        r.amountApprovalRate,
                        r.decidedClaimedAmount,
                        r.decidedApprovedAmount,
                        r.claimedAmount,
                        r.approvedAmount,
                      ],
                    ),
                  ];
                  downloadCsv('approval-rate.csv', rows);
                }}
              >
                <Download className="size-4" /> CSV
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <Tile label="Decided" value={approval.data?.overall.decided ?? 0} />
                <Tile label="Approved" value={approval.data?.overall.approved ?? 0} />
                <Tile label="Rejected" value={approval.data?.overall.rejected ?? 0} />
                {/* Gap 290: two written definitions, shown separately. */}
                <Tile
                  label="Approval rate (by count)"
                  value={rate(approval.data?.overall.approvalRate)}
                  hint={approval.data?.definitions?.approvalRate}
                  sub={
                    approval.data
                      ? `${approval.data.overall.approved} approved ÷ ${approval.data.overall.decided ?? 0} decided`
                      : undefined
                  }
                />
                <Tile
                  label="Approval rate (by amount)"
                  value={rate(approval.data?.overall.amountApprovalRate)}
                  hint={approval.data?.definitions?.amountApprovalRate}
                  sub={amountRateBasis(
                    approval.data?.overall.decidedApprovedAmount,
                    approval.data?.overall.decidedClaimedAmount,
                    inr,
                  )}
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payer</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Decided</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Rejected</TableHead>
                    <TableHead title={approval.data?.definitions?.approvalRate}>Rate (count)</TableHead>
                    <TableHead title={approval.data?.definitions?.amountApprovalRate}>Rate (amount)</TableHead>
                    <TableHead>Claimed</TableHead>
                    <TableHead>Approved Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approval.data?.byInsurer?.length ? (
                    approval.data.byInsurer.map((r) => (
                      <TableRow key={r.insurerId ?? 'payer-missing'}>
                        <TableCell className={r.insurerId ? 'font-medium' : 'font-medium text-amber-700'}>
                          {r.insurerName}
                        </TableCell>
                        <TableCell>{r.total}</TableCell>
                        <TableCell>{r.decided ?? '—'}</TableCell>
                        <TableCell>{r.approved}</TableCell>
                        <TableCell>{r.rejected}</TableCell>
                        <TableCell>{rate(r.approvalRate)}</TableCell>
                        <TableCell
                          title={amountRateBasis(r.decidedApprovedAmount, r.decidedClaimedAmount, inr)}
                        >
                          {rate(r.amountApprovalRate)}
                        </TableCell>
                        <TableCell>{inr(r.claimedAmount)}</TableCell>
                        <TableCell>{inr(r.approvedAmount)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-on-surface-variant">
                        No data for these filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aging */}
        <TabsContent value="aging">
          <Card>
            <CardHeader>
              <CardTitle>Aging Report</CardTitle>
              <CardDescription>
                Live claims grouped by submission age. Amount = outstanding on approved claims plus the
                claimed amount of claims awaiting a decision; cancelled, rejected and replaced claims are
                left out.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {aging.data?.buckets?.map((b) => (
                  <Tile
                    key={b.range}
                    label={`${b.range} days`}
                    value={`${b.count} · ${inr(b.amount)}`}
                  />
                )) ?? null}
              </div>
              <PayerTable title="By payer" groups={aging.data?.byPayer} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bucket</TableHead>
                    <TableHead>Claim</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Payer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount awaited</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aging.data?.buckets?.flatMap((b) =>
                    b.claims.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs">{b.range}d</TableCell>
                        <TableCell>
                          <Link
                            href={`/insurance/claims/${c.id}`}
                            className="text-primary hover:underline"
                          >
                            {c.claimNumber ?? c.id.slice(0, 8)}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {c.patient.firstName} {c.patient.lastName ?? ''}
                        </TableCell>
                        <TableCell>
                          {c.insurer?.name ?? <span className="text-amber-700">Payer missing</span>}
                        </TableCell>
                        <TableCell>{c.status.replace(/_/g, ' ')}</TableCell>
                        <TableCell>{inr(c.outstandingAmount)}</TableCell>
                        <TableCell>{formatDate(c.submissionDate)}</TableCell>
                      </TableRow>
                    )),
                  ) ?? null}
                  {aging.data && aging.data.buckets.every((b) => b.claims.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-on-surface-variant">
                        No open claims.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Outstanding */}
        <TabsContent value="outstanding">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Outstanding Claims</CardTitle>
                <CardDescription title={outstanding.data?.definitions?.outstanding}>
                  Approved but not yet fully paid: approved − received − write-offs
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-xs text-on-surface-variant">Total outstanding</div>
                <div className="text-xl font-bold text-rose-700">
                  {inr(outstanding.data?.totalOutstanding ?? 0)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <PayerTable title="By payer" groups={outstanding.data?.byPayer} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Claim</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Payer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Claimed</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Approval Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outstanding.data?.claims?.length ? (
                    outstanding.data.claims.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Link
                            href={`/insurance/claims/${c.id}`}
                            className="text-primary hover:underline"
                          >
                            {c.claimNumber ?? c.id.slice(0, 8)}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {c.patient?.firstName} {c.patient?.lastName ?? ''}
                        </TableCell>
                        <TableCell>
                          {c.insurer?.name ?? <span className="text-amber-700">Payer missing</span>}
                        </TableCell>
                        <TableCell>{c.status.replace(/_/g, ' ')}</TableCell>
                        <TableCell>{inr(c.claimAmount)}</TableCell>
                        <TableCell>{inr(c.approvedAmount)}</TableCell>
                        <TableCell>{inr(c.paidAmount)}</TableCell>
                        <TableCell className="font-medium text-rose-700">
                          {inr(c.outstandingAmount)}
                        </TableCell>
                        <TableCell>
                          {c.approvalDate ? formatDate(c.approvalDate) : '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-on-surface-variant">
                        No outstanding claims.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  /** Numerator ÷ denominator behind a rate (gap 290). */
  sub?: string;
}) {
  return (
    <div className="rounded-xl border bg-surface-container-lowest px-4 py-3" title={hint}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-on-surface-variant">
        {label}
        {hint && <Info className="size-3" aria-label={hint} />}
      </div>
      <div className="text-lg font-bold font-headline">{value}</div>
      {sub && <div className="text-[10px] text-on-surface-variant">{sub}</div>}
    </div>
  );
}

/** Per-payer totals; claims with no payer get their own row so the total adds up (gap 292). */
function PayerTable({ title, groups }: { title: string; groups?: PayerGroup[] }) {
  if (!groups?.length) return null;
  const total = groups.reduce((sum, g) => sum + g.amount, 0);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{title}</TableHead>
          <TableHead>Claims</TableHead>
          <TableHead>Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((g) => (
          <TableRow key={g.payerId ?? 'payer-missing'}>
            <TableCell className={g.payerId ? 'font-medium' : 'font-medium text-amber-700'}>
              {g.payerName}
            </TableCell>
            <TableCell>{g.count}</TableCell>
            <TableCell>{inr(g.amount)}</TableCell>
          </TableRow>
        ))}
        <TableRow>
          <TableCell className="font-bold">Total</TableCell>
          <TableCell className="font-bold">{groups.reduce((sum, g) => sum + g.count, 0)}</TableCell>
          <TableCell className="font-bold">{inr(Math.round(total * 100) / 100)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
