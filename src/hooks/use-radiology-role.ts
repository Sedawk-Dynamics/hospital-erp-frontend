'use client';

import { useAuthStore } from '@/stores/auth-store';

function normalizeRole(slug?: string | null): string {
  return (slug ?? '').toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * Resolve the current user's radiology-role posture. Mirrors useLabRole.
 *
 * - `radiology_admin` (and platform admin equivalents) get the full surface:
 *   modality catalog, tariffs, scheduling, billing, inventory, purchase,
 *   analytics, settings, vendor management.
 * - `radiologist` is the clinical surface: pick up orders, schedule slots,
 *   perform the study, draft + sign reports. They can also see DICOM
 *   studies and worklist, but not billing/inventory/purchase/settings.
 * - `admin` / `super_admin` see everything (treated as radiology admin).
 */
export function useRadiologyRole() {
  const { user } = useAuthStore();
  const role = normalizeRole(user?.role?.slug ?? user?.role?.name);

  const isRadiologyAdmin =
    role === 'radiology_admin' ||
    role === 'admin' ||
    role === 'super_admin';

  const isRadiologist = role === 'radiologist';
  const isAdmin = role === 'admin' || role === 'super_admin';

  return {
    role,
    isRadiologyAdmin,
    isRadiologist,
    isAdmin,
    /** True when the user can manage modality catalog, tariffs, vendors. */
    canManageCatalog: isRadiologyAdmin,
    /** True when the user can sign/publish reports (radiologist or admin). */
    canApprove: isRadiologyAdmin || isRadiologist,
  };
}
