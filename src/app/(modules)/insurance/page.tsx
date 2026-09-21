'use client';

import Link from 'next/link';
import {
  ShieldCheck,
  ShieldAlert,
  FileCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Pause,
  IndianRupee,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useInsuranceDashboard, type ClaimStatus, type PreAuthStatus } from '@/hooks/use-insurance';
import { formatDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

const CLAIM_STATUS_TONE: Record<ClaimStatus, string> = {
  submitted: 'bg-amber-100 text-amber-700 border-amber-300',
  under_review: 'bg-amber-100 text-amber-700 border-amber-300',
  query_raised: 'bg-orange-100 text-orange-700 border-orange-300',
  response_submitted: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  partially_approved: 'bg-sky-100 text-sky-700 border-sky-300',
  rejected: 'bg-rose-100 text-rose-700 border-rose-300',
  resubmitted: 'bg-violet-100 text-violet-700 border-violet-300',
  settled: 'bg-teal-100 text-teal-700 border-teal-300',
  partially_settled: 'bg-cyan-100 text-cyan-700 border-cyan-300',
  cancelled: 'bg-zinc-100 text-zinc-700 border-zinc-300',
};

const PREAUTH_STATUS_TONE: Record<PreAuthStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-300',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  denied: 'bg-rose-100 text-rose-700 border-rose-300',
  expired: 'bg-zinc-100 text-zinc-700 border-zinc-300',
  on_hold: 'bg-violet-100 text-violet-700 border-violet-300',
  cancelled: 'bg-zinc-100 text-zinc-700 border-zinc-300',
};

function inr(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function patientName(p?: { firstName: string; lastName?: string | null } | null) {
  if (!p) return '—';
  return `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
}

export default function InsuranceDashboardPage() {
  const { data, isLoading } = useInsuranceDashboard();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-headline">Insurance & TPA Dashboard</h1>
        <p className="text-sm text-on-surface-variant">
          Pending claims, pre-auth status, settlement overview, and deadline alerts.
        </p>
      </div>

      {/* Claim status row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <StatTile
          icon={<Clock className="text-amber-600" />}
          label="Pending"
          value={data?.claims.pending ?? 0}
          tone="amber"
          loading={isLoading}
          href="/insurance/claims?status=submitted"
        />
        <StatTile
          icon={<Clock className="text-amber-700" />}
          label="Under Review"
          value={data?.claims.underReview ?? 0}
          tone="amber"
          loading={isLoading}
          href="/insurance/claims?status=under_review"
        />
        <StatTile
          icon={<CheckCircle2 className="text-emerald-600" />}
          label="Approved"
          value={data?.claims.approved ?? 0}
          tone="emerald"
          loading={isLoading}
          href="/insurance/claims?status=approved"
        />
        <StatTile
          icon={<CheckCircle2 className="text-sky-600" />}
          label="Partial"
          value={data?.claims.partiallyApproved ?? 0}
          tone="sky"
          loading={isLoading}
          href="/insurance/claims?status=partially_approved"
        />
        <StatTile
          icon={<XCircle className="text-rose-600" />}
          label="Rejected"
          value={data?.claims.rejected ?? 0}
          tone="rose"
          loading={isLoading}
          href="/insurance/claims?status=rejected"
        />
        <StatTile
          icon={<ShieldCheck className="text-teal-600" />}
          label="Settled"
          value={data?.claims.settled ?? 0}
          tone="teal"
          loading={isLoading}
          href="/insurance/claims?status=settled"
        />
        <StatTile
          icon={<TrendingUp className="text-primary" />}
          label="Approval Rate"
          value={`${data?.claims.approvalRate ?? 0}%`}
          tone="primary"
          loading={isLoading}
        />
      </div>

      {/* Pre-auth + settlement + expiry */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-violet-600" /> Pre-Authorization
            </CardTitle>
            <CardDescription>Current state of TPA approval requests</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Pending" value={data?.preAuth.pending} tone="text-amber-600" />
            <Row
              label={
                <span className="inline-flex items-center gap-1">
                  <Pause className="size-3" /> On Hold
                </span>
              }
              value={data?.preAuth.onHold}
              tone="text-violet-600"
            />
            <Row label="Approved" value={data?.preAuth.approved} tone="text-emerald-600" />
            <Link
              href="/insurance/pre-auth"
              className="mt-2 inline-block text-xs font-bold text-primary hover:underline"
            >
              Manage Pre-Auth →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IndianRupee className="size-4 text-teal-600" /> Settlement Overview
            </CardTitle>
            <CardDescription>Claim amounts across the lifetime of the hospital</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Total Claimed" value={inr(data?.settlement.totalClaimed)} />
            <Row label="Approved" value={inr(data?.settlement.totalApprovedAmount)} tone="text-emerald-600" />
            <Row label="Paid by Insurer" value={inr(data?.settlement.totalPaid)} tone="text-teal-600" />
            <Row label="Outstanding" value={inr(data?.settlement.totalOutstanding)} tone="text-rose-600" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600" /> Expiring in 7 Days
            </CardTitle>
            <CardDescription>Deadlines you should follow up on</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Policies" value={data?.expiry.policiesIn7Days} tone="text-rose-600" />
            <Row label="Claims (TPA deadline)" value={data?.expiry.claimsIn7Days} tone="text-amber-600" />
            <Row label="Pre-Auth Validity" value={data?.expiry.preAuthsIn7Days} tone="text-violet-600" />
          </CardContent>
        </Card>
      </div>

      {/* Recent claims */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="size-4 text-primary" /> Recent Claims
            </CardTitle>
            <CardDescription>Latest 8 claims across all statuses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {data?.recentClaims?.length ? (
              data.recentClaims.map((c) => (
                <Link
                  key={c.id}
                  href={`/insurance/claims/${c.id}`}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-surface-container-low"
                >
                  <div>
                    <div className="font-medium">{c.claimNumber ?? c.id.slice(0, 8)}</div>
                    <div className="text-xs text-on-surface-variant">
                      {patientName(c.patient)} · {c.policy?.insurer?.name ?? '—'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-on-surface">{inr(c.claimAmount)}</span>
                    <Badge className={cn('border', CLAIM_STATUS_TONE[c.status])}>
                      {c.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </Link>
              ))
            ) : (
              <EmptyHint loading={isLoading} text="No claims yet." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-violet-600" /> Recent Pre-Auth Requests
            </CardTitle>
            <CardDescription>Latest 5 procedure approvals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {data?.recentPreAuths?.length ? (
              data.recentPreAuths.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-surface-container-low"
                >
                  <div>
                    <div className="font-medium">{p.procedureDescription}</div>
                    <div className="text-xs text-on-surface-variant">
                      {patientName(p.patient)} · {p.policy?.insurer?.name ?? '—'}
                      {p.validTo ? ` · valid till ${formatDate(p.validTo)}` : ''}
                    </div>
                  </div>
                  <Badge className={cn('border', PREAUTH_STATUS_TONE[p.status])}>
                    {p.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              ))
            ) : (
              <EmptyHint loading={isLoading} text="No pre-auth requests yet." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  tone,
  loading,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone: 'amber' | 'emerald' | 'sky' | 'rose' | 'teal' | 'primary';
  loading?: boolean;
  href?: string;
}) {
  const toneClasses: Record<typeof tone, string> = {
    amber: 'border-amber-200 bg-amber-50',
    emerald: 'border-emerald-200 bg-emerald-50',
    sky: 'border-sky-200 bg-sky-50',
    rose: 'border-rose-200 bg-rose-50',
    teal: 'border-teal-200 bg-teal-50',
    primary: 'border-primary/20 bg-primary/5',
  };

  const content = (
    <div
      className={cn(
        'flex items-center justify-between rounded-xl border px-4 py-3 transition-all hover:shadow-sm',
        toneClasses[tone],
      )}
    >
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
          {label}
        </div>
        <div className="text-xl font-bold font-headline">
          {loading ? '…' : value}
        </div>
      </div>
      <div className="size-9 rounded-lg bg-white/70 flex items-center justify-center [&_svg]:size-5">
        {icon}
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function Row({
  label,
  value,
  tone,
}: { label: React.ReactNode; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-on-surface-variant">{label}</span>
      <span className={cn('font-bold', tone)}>{value ?? '—'}</span>
    </div>
  );
}

function EmptyHint({ loading, text }: { loading?: boolean; text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-outline-variant/40 px-3 py-6 text-center text-xs text-on-surface-variant">
      {loading ? 'Loading…' : text}
    </div>
  );
}
