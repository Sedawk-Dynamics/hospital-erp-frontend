'use client';

// Extracted verbatim from the Laboratory home page, which had grown to
// 2,056 lines holding the shell, seven tabs, four dialogs and the shared
// table primitives in one file. No behaviour changed in the move.

import {
  type LabOrder
} from '@/hooks/use-lab';
import { cn } from '@/lib/utils';

// The generic pieces now live in shared/diagnostics so radiology renders the
// same table furniture rather than its own near-copy. Re-exported here so every
// existing import in this folder keeps working.
export {
  Th,
  LoadingRow,
  EmptyRow,
  PriorityBadge,
  PaginationBar,
} from '@/components/shared/diagnostics/table-bits';


// ============================================================
// Helpers — the lab-specific ones
// ============================================================
export function SpecimensCell({ samples }: { samples?: LabOrder['labSamples'] }) {
  const total = samples?.length ?? 0;
  if (total === 0) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }
  // Tally by status so the Status tab surfaces sample lifecycle alongside the count
  const tally = new Map<string, number>();
  for (const s of samples ?? []) {
    tally.set(s.status, (tally.get(s.status) ?? 0) + 1);
  }
  const summary = Array.from(tally.entries())
    .map(([status, n]) => `${n} ${status.replace(/_/g, ' ')}`)
    .join(', ');
  return (
    <span className="text-xs" title={summary}>
      <span className="font-medium">{total}</span>
      <span className="ml-1 text-muted-foreground">({summary})</span>
    </span>
  );
}

export function StatusBadge({ status, reportStatus }: { status?: string; reportStatus?: string }) {
  // Once the report is published (or corrected), the order reads "Published"
  // even though LabOrder.status stays 'completed' (no 'published' order status).
  const effective =
    reportStatus === 'published' || reportStatus === 'corrected' ? 'published' : status;
  status = effective;
  return (
    <span className={cn(
      'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
      (status === 'pending' || status === 'ordered') && 'bg-amber-100 text-amber-800',
      status === 'sample_collected' && 'bg-blue-100 text-blue-800',
      status === 'in_transit' && 'bg-amber-100 text-amber-800',
      status === 'received' && 'bg-purple-100 text-purple-800',
      status === 'in_progress' && 'bg-indigo-100 text-indigo-800',
      status === 'completed' && 'bg-green-100 text-green-800',
      status === 'published' && 'bg-emerald-100 text-emerald-800',
      status === 'cancelled' && 'bg-red-100 text-red-800',
    )}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
}
