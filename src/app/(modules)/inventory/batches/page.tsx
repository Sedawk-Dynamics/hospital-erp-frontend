'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Drug Batches was merged into the unified Storage list at /inventory (medicines
// expand inline to their batches). This route is kept so existing links / bookmarks
// keep working — it simply forwards to /inventory.
export default function DrugBatchesRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/inventory');
  }, [router]);
  return null;
}
