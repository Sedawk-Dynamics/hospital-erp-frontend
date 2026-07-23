'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// The Drug Formulary was merged into the unified Storage list at /inventory:
// drugs and supplies live in one list, and every drug operation (edit, add
// stock/batches, merge, alternatives, suggest-to-catalog, remove, nickname,
// import-from-catalog) is now available there. This route is kept so existing
// links / bookmarks keep working — it forwards to /inventory.
export default function DrugFormularyRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/inventory');
  }, [router]);
  return null;
}
