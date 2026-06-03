'use client';

import { useAuthStore } from '@/stores/auth-store';

function normalizeRole(slug?: string | null): string {
  return (slug ?? '').toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * Pharmacy has exactly two roles:
 *   - `pharmacist`    — operational counter (dispense, patient returns, read).
 *   - `pharmacy_admin` — full management (formulary, batches, recalls, purchase,
 *     reports, inventory). admin / super_admin always count as admin.
 */
export function usePharmacyRole() {
  const { user } = useAuthStore();
  const role = normalizeRole(user?.role?.slug ?? user?.role?.name);

  const isAdmin = role === 'admin' || role === 'super_admin';
  const isPharmacyAdmin = role === 'pharmacy_admin' || isAdmin;
  const isPharmacist = role === 'pharmacist';

  return {
    role,
    isPharmacyAdmin,
    isPharmacist,
    isAdmin,
    // Capability helpers (master/stock management + financials = admin only).
    canManageFormulary: isPharmacyAdmin,
    canManageBatches: isPharmacyAdmin,
    canApprove: isPharmacyAdmin,
    canViewReports: isPharmacyAdmin,
  };
}
