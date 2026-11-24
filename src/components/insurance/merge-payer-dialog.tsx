'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowRight, Loader2, Merge } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useMergePayer,
  usePayerMergePreview,
  type MergeablePayerKind,
  type PayerMergeCounts,
} from '@/hooks/use-insurance-admin';

export interface MergeCandidate {
  id: string;
  name: string;
  gstin?: string | null;
  isActive: boolean;
  mergedIntoId?: string | null;
}

interface Props {
  kind: MergeablePayerKind;
  /** The duplicate being merged away. null = closed. */
  duplicate: MergeCandidate | null;
  /** Every record of this kind; the dialog offers the active, unmerged others. */
  records: MergeCandidate[];
  onClose: () => void;
}

const COUNT_LABELS: Array<[keyof PayerMergeCounts, string]> = [
  ['policies', 'Patient policies'],
  ['cases', 'Payer cases'],
  ['contracts', 'Contracts'],
  ['claims', 'Claims'],
  ['preAuths', 'Pre-authorisations'],
  ['settlements', 'Settlements'],
  ['communicationLogs', 'Communication logs'],
];

/**
 * Gap 293: merge a duplicate insurer / TPA into the record to keep. The admin
 * picks the record to keep, sees what will move, and confirms.
 */
export function MergePayerDialog({ kind, duplicate, records, onClose }: Props) {
  const label = kind === 'insurer' ? 'insurer' : 'TPA';
  const [keepId, setKeepId] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const preview = usePayerMergePreview(kind, duplicate?.id, keepId || undefined);
  const merge = useMergePayer(kind);

  const candidates = records.filter((r) => r.id !== duplicate?.id && r.isActive && !r.mergedIntoId);
  const keep = candidates.find((c) => c.id === keepId);

  function close() {
    setKeepId('');
    setConfirmed(false);
    onClose();
  }

  async function submit() {
    if (!duplicate || !keepId) return;
    try {
      const result = await merge.mutateAsync({ duplicateId: duplicate.id, keepId });
      toast.success(`"${result.duplicate.name}" merged into "${result.kept.name}"`);
      close();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message ?? 'Merge failed — nothing was changed');
    }
  }

  const counts = preview.data?.counts;
  const visibleCounts = COUNT_LABELS.filter(([key]) => kind === 'tpa' || key !== 'communicationLogs');

  return (
    <Dialog open={!!duplicate} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Merge className="size-4" /> Merge duplicate {label}</DialogTitle>
          <DialogDescription>
            Everything linked to &ldquo;{duplicate?.name}&rdquo; moves to the record you keep. The duplicate is
            deactivated (not deleted) and the merge is written to the audit log.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="merge-keep">Record to keep</Label>
            <select
              id="merge-keep"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={keepId}
              onChange={(e) => { setKeepId(e.target.value); setConfirmed(false); }}
            >
              <option value="">Select the {label} to keep…</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.gstin ? ` · ${c.gstin}` : ''}</option>
              ))}
            </select>
            {!candidates.length && (
              <p className="text-xs text-on-surface-variant">There is no other active {label} to merge into.</p>
            )}
          </div>

          {keep && (
            <div className="flex items-center gap-2 rounded-lg bg-surface-container-low p-3 text-sm">
              <span className="truncate line-through decoration-rose-500/60">{duplicate?.name}</span>
              <ArrowRight className="size-4 shrink-0" />
              <span className="truncate font-semibold">{keep.name}</span>
            </div>
          )}

          {keepId && (
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">What will move</p>
              {preview.isLoading ? (
                <div className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" /> Counting linked records…</div>
              ) : preview.isError ? (
                <p className="text-sm text-destructive">
                  {(preview.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not load the merge preview'}
                </p>
              ) : counts ? (
                <>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {visibleCounts.map(([key, text]) => (
                      <div key={key} className="flex justify-between"><dt className="text-on-surface-variant">{text}</dt><dd className="font-medium tabular-nums">{counts[key]}</dd></div>
                    ))}
                  </dl>
                  <p className="mt-2 text-[11px] text-on-surface-variant">Claims, pre-authorisations and settlements follow their policy or payer case.</p>
                  {counts.contractsDeactivated > 0 && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      {counts.contractsDeactivated} contract(s) overlap an active contract of &ldquo;{keep?.name}&rdquo;. They will move but be
                      deactivated, so the kept record&apos;s tariff applies.
                    </p>
                  )}
                </>
              ) : null}
            </div>
          )}

          {counts && (
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              I understand this cannot be undone from the screen: &ldquo;{duplicate?.name}&rdquo; will be deactivated and its records moved.
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>Cancel</Button>
          <Button variant="destructive" disabled={!counts || !confirmed || merge.isPending} onClick={submit}>
            {merge.isPending && <Loader2 className="mr-1 size-4 animate-spin" />} Merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
