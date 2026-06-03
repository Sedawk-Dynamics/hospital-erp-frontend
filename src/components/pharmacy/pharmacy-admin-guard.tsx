'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePharmacyRole } from '@/hooks/use-pharmacy-role';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Bounce non-admins back to the POS (/pharmacy) if they deep-link into a
 * pharmacy-admin-only page (Formulary, Batches, Recalls, Purchase, Reports,
 * Transactions, Stock Transfer, GST, Settings).
 *
 * The sidebar already hides these for pharmacists; this catches URL paste /
 * history / bookmarks. The backend also enforces admin-only mutations, so this
 * just keeps the UI honest.
 */
export function PharmacyAdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { _hydrated } = useAuthStore();
  const { isPharmacyAdmin } = usePharmacyRole();

  useEffect(() => {
    if (_hydrated && !isPharmacyAdmin) {
      router.replace('/pharmacy');
    }
  }, [_hydrated, isPharmacyAdmin, router]);

  if (!_hydrated) return null;
  if (!isPharmacyAdmin) return null;
  return <>{children}</>;
}
