'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BarChart3, Filter, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDate } from '@/lib/date-utils';
import {
  useClaimsSummaryReport,
  useApprovalRateReport,
  useAgingReport,
  useOutstandingReport,
  useInsurers,
  useTpas,
  type ReportFilters,
} from '@/hooks/use-insurance';

function inr(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
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
  const { data: insurers } = useInsurers({ isActive: true, limit: 100 });
  const { data: tpas } = useTpas({ isActive: true, limit: 100 });

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="size-4 text-primary" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div>
            <Label>From</Label>
            <Input
              type="date"
              value={filters.fromDate ?? ''}
              onChange={(e) => setFilters({ ...filters, fromDate: e.target.value || undefined })}
            />
          </div>
          <div>
            <Label>To</Label>
            <Input
              type="date"
              value={filters.toDate ?? ''}
              onChange={(e) => setFilters({ ...filters, toDate: e.target.value || undefined })}
            />
          </div>
          <div>
            <Label>Insurer</Label>
            <Select
              value={filters.insurerId ?? null}
              onValueChange={(v) =>
                setFilters({ ...filters, insurerId: (v as string) || undefined })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All insurers" />
              </SelectTrigger>
              <SelectContent>
                {insurers?.data?.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>TPA</Label>
            <Select
              value={filters.tpaId ?? null}
              onValueChange={(v) =>
                setFilters({ ...filters, tpaId: (v as string) || undefined })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All TPAs" />
              </SelectTrigger>
              <SelectContent>
                {tpas?.data?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

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
                <CardDescription>By claim status</CardDescription>
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
                <Tile label="Outstanding" value={inr(summary.data?.total.outstanding)} />
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
                      <TableRow key={r.status}>
                        <TableCell className="font-medium">
                          {r.status.replace(/_/g, ' ')}
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
                <CardDescription>By insurer</CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  const rows: CsvCell[][] = [
                    ['Insurer', 'Total', 'Approved', 'Rejected', 'Rate %', 'Claimed', 'Approved Amt'],
                    ...(approval.data?.byInsurer ?? []).map(
                      (r): CsvCell[] => [
                        r.insurerName,
                        r.total,
                        r.approved,
                        r.rejected,
                        r.approvalRate,
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
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Tile label="Total" value={approval.data?.overall.total ?? 0} />
                <Tile label="Approved" value={approval.data?.overall.approved ?? 0} />
                <Tile label="Rejected" value={approval.data?.overall.rejected ?? 0} />
                <Tile
                  label="Approval Rate"
                  value={`${approval.data?.overall.approvalRate ?? 0}%`}
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Insurer</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Rejected</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Claimed</TableHead>
                    <TableHead>Approved Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approval.data?.byInsurer?.length ? (
                    approval.data.byInsurer.map((r) => (
                      <TableRow key={r.insurerId}>
                        <TableCell className="font-medium">{r.insurerName}</TableCell>
                        <TableCell>{r.total}</TableCell>
                        <TableCell>{r.approved}</TableCell>
                        <TableCell>{r.rejected}</TableCell>
                        <TableCell>{r.approvalRate}%</TableCell>
                        <TableCell>{inr(r.claimedAmount)}</TableCell>
                        <TableCell>{inr(r.approvedAmount)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-on-surface-variant">
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
              <CardDescription>Open claims grouped by submission age</CardDescription>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bucket</TableHead>
                    <TableHead>Claim</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Insurer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Outstanding</TableHead>
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
                        <TableCell>{c.insurer.name}</TableCell>
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
                <CardDescription>Approved but not yet fully paid</CardDescription>
              </div>
              <div className="text-right">
                <div className="text-xs text-on-surface-variant">Total outstanding</div>
                <div className="text-xl font-bold text-rose-700">
                  {inr(outstanding.data?.totalOutstanding ?? 0)}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Claim</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Insurer</TableHead>
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
                        <TableCell>{c.policy?.insurer?.name ?? '—'}</TableCell>
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

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-surface-container-lowest px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-on-surface-variant">{label}</div>
      <div className="text-lg font-bold font-headline">{value}</div>
    </div>
  );
}
