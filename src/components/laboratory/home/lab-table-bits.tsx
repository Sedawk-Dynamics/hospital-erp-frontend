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

/**
 * The tests on an order, by name.
 *
 * This column rendered `labOrderItems.length` — a bare "4". The API has always
 * returned every test's name and code on the list payload, so the one thing the
 * lab needs in order to triage a queue (what was actually ordered) was fetched
 * and then thrown away. Reading it meant opening the order, or crossing to a
 * different tab that did show names.
 *
 * Two names inline, the rest behind a count, with the full list on hover — a
 * queue row has to stay one line high to remain scannable.
 */
export function TestsCell({ items }: { items?: LabOrder['labOrderItems'] }) {
  const names = (items ?? [])
    .map((i) => i.test?.testName)
    .filter((n): n is string => !!n);

  if (names.length === 0) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  const shown = names.slice(0, 2);
  const rest = names.length - shown.length;

  return (
    <span className="text-xs" title={names.join(', ')}>
      <span className="font-medium">{shown.join(', ')}</span>
      {rest > 0 && <span className="ml-1 text-muted-foreground">+{rest} more</span>}
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
