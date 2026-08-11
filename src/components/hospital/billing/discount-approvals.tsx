'use client';

// ────────────────────────────────────────────────────────────────────────
// Concessions waiting on a second pair of eyes, plus the limit that parks them.
//
// An unlimited discount at the counter is the classic revenue leak. Recording
// who granted one was already done; this is the gate on top — a concession over
// the configured limit is recorded, visible, and takes nothing off the bill
// until someone with billing:approve decides on it.
//
// The gate is OFF until a hospital switches it on, so nothing here changes how
// an existing counter works until somebody chooses to.
// ────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, Check, X, Settings2, Percent, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/ui/number-input';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { formatDate, formatTime24 } from '@/lib/date-utils';
import {
  useDiscountPolicy,
  useUpdateDiscountPolicy,
  usePendingDiscounts,
  useDecideDiscount,
  type PendingDiscountRow,
} from '@/hooks/use-hospital';

const fmt = (n: number) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;

export function DiscountApprovals() {
  const { data: pending, isLoading } = usePendingDiscounts();
  const rows = pending ?? [];

  return (
    <div className="space-y-4">
      <PolicyPanel />

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="flex items-center gap-2 border-b border-surface-container px-4 py-3">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="font-headline text-sm font-bold">Concessions awaiting approval</h3>
          {rows.length > 0 && (
            <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-bold text-secondary">
              {rows.length}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-on-surface-variant">
            Nothing waiting. Concessions over the limit appear here for a decision.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-container">
                  {['Bill', 'Patient', 'Bill total', 'Concession', 'Reason', 'Requested', 'Decision'].map(
                    (h, i) => (
                      <th
                        key={h}
                        className={cn(
                          'px-4 pb-3 pt-4 font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest',
                          i === 2 || i === 3 ? 'text-right' : i === 6 ? 'text-center' : 'text-left',
                        )}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container/50">
                {rows.map((r) => (
                  <PendingRow key={r.id} row={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PendingRow({ row }: { row: PendingDiscountRow }) {
  const decide = useDecideDiscount();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const act = (approve: boolean) => {
    decide.mutate(
      { id: row.id, approve, reason: approve ? undefined : reason.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(
            approve
              ? `${fmt(row.amount)} concession approved`
              : 'Concession rejected — the bill is unchanged',
          );
          setRejecting(false);
          setReason('');
        },
        onError: (e) => toast.error(getApiErrorMessage(e, 'Could not record the decision')),
      },
    );
  };

  return (
    <>
      <tr className="hover:bg-surface-container-low">
        <td className="px-4 py-3 font-mono text-xs font-bold">{row.billNumber ?? '—'}</td>
        <td className="px-4 py-3">
          {row.patientName ?? '—'}
          {row.patientMrn && (
            <div className="font-label text-[10px] text-on-surface-variant">{row.patientMrn}</div>
          )}
        </td>
        <td className="px-4 py-3 text-right">{fmt(row.billTotal)}</td>
        <td className="px-4 py-3 text-right">
          <span className="font-bold text-error">{fmt(row.amount)}</span>
          {row.percentOfBill > 0 && (
            <div className="font-label text-[10px] text-on-surface-variant">
              {row.percentOfBill}% of the bill
            </div>
          )}
        </td>
        <td className="px-4 py-3 max-w-[16rem] text-xs text-on-surface-variant">
          {row.reason || <span className="italic">no reason given</span>}
        </td>
        <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">
          {row.requestedBy ?? '—'}
          <div>
            {formatDate(row.requestedAt)} {formatTime24(row.requestedAt)}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-xs text-primary"
              disabled={decide.isPending}
              onClick={() => act(true)}
            >
              <Check className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-xs text-error"
              disabled={decide.isPending}
              onClick={() => setRejecting((v) => !v)}
            >
              <X className="h-3.5 w-3.5" /> Reject
            </Button>
          </div>
        </td>
      </tr>
      {rejecting && (
        <tr className="bg-error-container/20">
          <td colSpan={7} className="px-4 py-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[16rem] flex-1 space-y-1">
                <Label htmlFor={`rej-${row.id}`} className="text-xs">
                  Why is this being refused?
                </Label>
                <Input
                  id={`rej-${row.id}`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="The requester will see this"
                />
              </div>
              <Button
                size="sm"
                variant="destructive"
                disabled={decide.isPending}
                onClick={() => act(false)}
              >
                {decide.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Confirm reject
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRejecting(false)}>
                Cancel
              </Button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/** The limit itself — what parks a concession rather than granting it. */
function PolicyPanel() {
  const { data: policy, isLoading } = useDiscountPolicy();
  const update = useUpdateDiscountPolicy();
  const [draft, setDraft] = useState<{ amount: number; percent: number } | null>(null);

  if (isLoading || !policy) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      </div>
    );
  }

  const amount = draft?.amount ?? policy.maxAmountWithoutApproval;
  const percent = draft?.percent ?? policy.maxPercentWithoutApproval;
  const dirty =
    draft !== null &&
    (draft.amount !== policy.maxAmountWithoutApproval ||
      draft.percent !== policy.maxPercentWithoutApproval);

  const save = (patch: Parameters<typeof update.mutate>[0]) =>
    update.mutate(patch, {
      onSuccess: () => {
        toast.success('Discount policy updated');
        setDraft(null);
      },
      onError: (e) => toast.error(getApiErrorMessage(e, 'Could not update the policy')),
    });

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-primary" />
        <h3 className="font-headline text-sm font-bold">When a concession needs approval</h3>
        <label className="ml-auto inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={policy.enabled}
            disabled={update.isPending}
            onChange={(e) => save({ enabled: e.target.checked })}
            className="h-4 w-4 accent-current text-primary"
          />
          <span className="font-label text-xs font-bold">
            {policy.enabled ? 'On' : 'Off'}
          </span>
        </label>
      </div>

      {!policy.enabled ? (
        <p className="text-xs text-on-surface-variant">
          Off — every concession applies the moment it is entered, and is recorded against whoever
          granted it. Switch on to park anything over a limit for a second pair of eyes.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="flex items-center gap-1 text-xs">
                <IndianRupee className="h-3 w-3" /> Allowed without approval
              </Label>
              <NumberInput
                value={amount}
                min={0}
                onValueChange={(v) => setDraft({ amount: v ?? 0, percent })}
                className="w-36"
              />
            </div>
            <div className="space-y-1">
              <Label className="flex items-center gap-1 text-xs">
                <Percent className="h-3 w-3" /> …and up to this share of the bill
              </Label>
              <NumberInput
                value={percent}
                min={0}
                max={100}
                onValueChange={(v) => setDraft({ amount, percent: v ?? 0 })}
                className="w-28"
              />
            </div>
            {dirty && (
              <Button
                size="sm"
                disabled={update.isPending}
                onClick={() =>
                  save({ maxAmountWithoutApproval: amount, maxPercentWithoutApproval: percent })
                }
              >
                {update.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Save limits
              </Button>
            )}
          </div>
          <p className="font-label text-[11px] text-on-surface-variant">
            A concession over <b>either</b> limit is parked. Zero means that test is not applied —
            ₹500 is nothing on a ₹200,000 admission and everything on a ₹600 consultation, which is
            why both exist. Nobody can approve a concession they requested themselves.
          </p>
        </>
      )}
    </div>
  );
}
