'use client';

import Link from 'next/link';
import { ShieldCheck, BadgeCheck, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { usePoliciesByPatient, useVerifyPolicy } from '@/hooks/use-insurance';

const STATUS_TONE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-300 border',
  expired: 'bg-zinc-100 text-zinc-700 border-zinc-300 border',
  cancelled: 'bg-rose-100 text-rose-700 border-rose-300 border',
};

export function PatientPoliciesPanel({ patientId }: { patientId: string }) {
  const { data: policies, isLoading } = usePoliciesByPatient(patientId);
  const verifyMut = useVerifyPolicy();

  async function handleVerify(id: string) {
    try {
      const res = await verifyMut.mutateAsync(id);
      toast.success(res.isValid ? 'Policy is valid' : `Policy status: ${res.status}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Verification failed');
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-primary" /> Insurance Policies
          </CardTitle>
          <CardDescription>
            All policies tied to this patient — multiple active policies are allowed.
          </CardDescription>
        </div>
        <Link
          href={`/insurance/policies?patientId=${patientId}`}
          className="inline-flex h-7 items-center gap-1 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-[0.8rem] font-medium text-on-surface hover:bg-surface-container-high"
        >
          <Plus className="size-3.5" /> Add Policy
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="text-xs text-on-surface-variant">Loading…</div>
        ) : policies?.length ? (
          policies.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border bg-surface-container-lowest px-3 py-2 text-sm"
            >
              <div>
                <div className="font-medium">
                  {p.policyNumber}{' '}
                  <span className="text-on-surface-variant">· {p.insurer?.name ?? '—'}</span>
                </div>
                <div className="text-xs text-on-surface-variant">
                  {p.planName ?? '—'} · ₹{(p.coverageAmount ?? 0).toLocaleString('en-IN')} cover ·{' '}
                  {p.coPayPercent}% co-pay · valid {formatDate(p.validFrom)} →{' '}
                  {formatDate(p.validTo)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={cn(STATUS_TONE[p.status] ?? '')}>{p.status}</Badge>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => handleVerify(p.id)}
                  title="Verify"
                >
                  <BadgeCheck className="size-3.5 text-emerald-600" />
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-outline-variant/40 px-3 py-6 text-center text-xs text-on-surface-variant">
            No policies on file. Click <span className="font-bold">Add Policy</span> to assign one.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
