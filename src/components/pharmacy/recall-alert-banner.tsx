'use client';

// A recalled batch is already blocked from dispensing by the server. The
// problem was that the person actually dispensing had no way to KNOW: recalls
// lived on a batch row inside Inventory → Storage, and a `pharmacist` cannot
// open the Inventory module at all. So the counter would hit a refusal it could
// neither see coming nor explain to the patient in front of it.
//
// This is the warning on the surfaces where medicine is handed over.

import Link from 'next/link';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { useRecalledItems } from '@/hooks/use-pharmacy';
import { cn } from '@/lib/utils';

export function RecallAlertBanner({ className }: { className?: string }) {
  const { data } = useRecalledItems();
  const batches = data?.recalledBatches ?? [];
  if (batches.length === 0) return null;

  // Name the medicines rather than just counting them — "2 batches recalled"
  // tells the counter nothing it can act on.
  const names = Array.from(new Set(batches.map((b) => b.drug.drugName)));
  const shown = names.slice(0, 3).join(', ');
  const rest = names.length - 3;

  return (
    <Link
      href="/pharmacy/recalls"
      className={cn(
        'flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 transition-colors hover:bg-red-100',
        className,
      )}
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-red-800">
          {batches.length} recalled batch{batches.length === 1 ? '' : 'es'} — blocked from
          dispensing
        </span>
        <span className="block truncate text-xs text-red-700">
          {shown}
          {rest > 0 && ` and ${rest} more`}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-red-600" />
    </Link>
  );
}
