'use client';

// Table primitives shared by the lab and radiology worklists. They were written
// for the lab and then re-typed, slightly differently, in radiology — the header
// cells had different padding and the pagers different copy, which is most of
// why the two pages never looked like the same product.

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
      <td colSpan={span} className="px-4 py-8 text-center font-label text-on-surface-variant">
        {message}
      </td>
    </tr>
  );
}

export function PriorityBadge({ priority }: { priority?: string | null }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-bold capitalize',
        priority === 'routine' && 'bg-gray-100 text-gray-800',
        priority === 'urgent' && 'bg-amber-100 text-amber-800',
        priority === 'stat' && 'bg-red-100 text-red-800',
      )}
    >
      {priority ?? '-'}
    </span>
  );
}

export function PaginationBar({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t px-4 py-3">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/** The card the worklist tables sit in. */
export function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sanctuary">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  );
}
