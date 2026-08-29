'use client';

/**
 * Ward stock moved to Inventory → Stock Transfer.
 *
 * It now sits beside the transfers that fill the shelf, because separating them
 * is what let the board lose stock: it issued medicines from the pharmacy and
 * credited nowhere, while this screen was the only place that credited a ward.
 * One surface, one ledger.
 *
 * The redirect stays rather than the route being deleted — this page is in
 * people's bookmarks and in the nav they have used for months, and a 404 is a
 * poor way to learn that something moved.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BedDouble } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';

export default function WardStockMovedPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/inventory/stock-transfer');
  }, [router]);

  return (
    <div className="p-6">
      <EmptyState
        icon={BedDouble}
        title="Ward stock has moved"
        description="It is now a tab on Inventory → Stock Transfer, beside the transfers that fill the shelf. Taking you there…"
      />
    </div>
  );
}
