'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Access guard for the Narcotics (NDPS) page. The nav link lives under the
 * Inventory module (so inventory managers see it), and the backend NDPS routes
 * only require pharmacy read/create/update — held by pharmacist, pharmacy_admin
 * AND inventory_manager. The old PharmacyAdminGuard here allowed only
 * pharmacy_admin/admin, so inventory managers and pharmacists who clicked the
 * link were silently bounced to /pharmacy ("NDPS doesn't work"). Allow every
 * role that legitimately manages/uses the narcotic register.
 */
const NDPS_ROLES = new Set([
  'pharmacy_admin',
  'inventory_manager',
  'pharmacist',
  'admin',
  'super_admin',
]);

function normalizeRole(slug?: string | null): string {
  return (slug ?? '').toLowerCase().replace(/[\s-]+/g, '_');
}

export function NdpsGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, _hydrated } = useAuthStore();
  const role = normalizeRole(user?.role?.slug ?? user?.role?.name);
  const allowed = NDPS_ROLES.has(role);

  useEffect(() => {
    if (_hydrated && !allowed) router.replace('/');
  }, [_hydrated, allowed, router]);

  if (!_hydrated) return null;
  if (!allowed) return null;
  return <>{children}</>;
}
