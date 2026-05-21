'use client';

import { useAuthStore } from '@/stores/auth-store';

function normalizeRole(slug?: string | null): string {
  return (slug ?? '').toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * Resolve the current user's lab-role posture.
 *
 * - `lab_supervisor` (and pathologist-equivalent privileged staff) get the
 *   full surface: result verification, report sign/publish, corrections,
 *   technician management, outsource partners, settings, billing, reports.
 * - `lab_technician` is restricted to order intake, sample lifecycle, and
 *   initial result entry — no Verify/Sign/Publish/Correct.
 * - `admin` / `super_admin` see everything (treated as supervisor) so they
 *   can validate the workflow without provisioning a separate lab account.
 */
export function useLabRole() {
  const { user } = useAuthStore();
  const role = normalizeRole(user?.role?.slug ?? user?.role?.name);

  const isSupervisor =
    role === 'lab_supervisor' ||
    role === 'pathologist' ||
    role === 'admin' ||
    role === 'super_admin';

  const isTechnician = role === 'lab_technician';
  // Hospital-level admin OR platform super admin. Distinct from `isSupervisor`
  // because lab_supervisor (a lab role) gets a narrower catalog surface —
  // they can only update price + TAT, never parameters.
  const isAdmin = role === 'admin' || role === 'super_admin';

  return {
    role,
    isSupervisor,
    isTechnician,
    isAdmin,
    /** True when the user can do supervisor-only actions (verify/sign/publish/correct). */
    canApprove: isSupervisor,
    /** True when the user can edit lab catalog schema (parameters, name, ...). */
    canEditCatalog: isAdmin,
  };
}
