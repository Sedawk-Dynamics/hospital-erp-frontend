'use client';

// Extracted verbatim from the Laboratory home page, which had grown to
// 2,056 lines holding the shell, seven tabs, four dialogs and the shared
// table primitives in one file. No behaviour changed in the move.

import { Button } from '@/components/ui/button';
import {
  type LabOrder
} from '@/hooks/use-lab';
import { cn } from '@/lib/utils';


// ============================================================
// Helpers
// ============================================================
export function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">
      {children}
    </th>
  );
}

export function LoadingRow({ span }: { span: number }) {
  return (
    <tr>
      <td colSpan={span} className="px-4 py-8 text-center">
        <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </td>
    </tr>
  );
}

export function EmptyRow({ span, message }: { span: number; message: string }) {
  return (
    <tr>
      <td colSpan={span} className="px-4 py-8 text-center font-label text-on-surface-variant">{message}</td>
    </tr>
  );
}

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

export function PriorityBadge({ priority }: { priority?: string }) {
  return (
    <span className={cn(
      'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
      priority === 'routine' && 'bg-gray-100 text-gray-800',
      priority === 'urgent' && 'bg-amber-100 text-amber-800',
      priority === 'stat' && 'bg-red-100 text-red-800',
    )}>
      {priority ?? '-'}
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

export function PaginationBar({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between border-t px-4 py-3">
      <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}
