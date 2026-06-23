'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Drug Batches was merged into the combined Inventory page as the "Drug Batches"
// tab. This route is kept so existing links / bookmarks keep working — it simply
// forwards to /inventory?tab=batches.
export default function DrugBatchesRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/inventory?tab=batches');
  }, [router]);
  return null;
}
