'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRadiologyRole } from '@/hooks/use-radiology-role';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Bounce non-admins back to /radiology if they try to deep-link into a
 * radiology-admin-only page (Dashboard, Billing, Inventory, Purchase,
 * Settings). The sidebar already hides these for radiologists, but URL paste
 * and bookmarks can still land them here.
 */
export function RadiologyAdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { _hydrated } = useAuthStore();
  const { isRadiologyAdmin } = useRadiologyRole();

  useEffect(() => {
    if (_hydrated && !isRadiologyAdmin) {
      router.replace('/radiology');
    }
  }, [_hydrated, isRadiologyAdmin, router]);

  if (!_hydrated) return null;
  if (!isRadiologyAdmin) return null;
  return <>{children}</>;
}
