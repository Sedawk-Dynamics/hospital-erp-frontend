import { useMemo } from 'react';
import { useAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'export' | 'approve';

export type PermissionModule =
  | 'auth' | 'tenants' | 'users' | 'roles' | 'departments' | 'wards' | 'rooms' | 'beds'
  | 'patients' | 'appointments' | 'visits' | 'admissions' | 'vitals' | 'diagnoses'
  | 'progress_notes' | 'nursing_notes' | 'prescriptions' | 'lab_orders' | 'lab_reports'
  | 'imaging' | 'pharmacy' | 'inventory' | 'billing' | 'payments' | 'insurance'
  | 'blood_bank' | 'hr' | 'notifications' | 'tickets' | 'reports' | 'audit_logs' | 'compliance';

interface PermissionDef {
  module: string;
  action: string;
}

// ---------------------------------------------------------------------------
// Permission matrix — mirrors backend role-permissions.ts exactly
// ---------------------------------------------------------------------------

const ALL_MODULES: PermissionModule[] = [
  'auth', 'tenants', 'users', 'roles', 'departments', 'wards', 'rooms', 'beds',
  'patients', 'appointments', 'visits', 'admissions', 'vitals', 'diagnoses',
  'progress_notes', 'nursing_notes', 'prescriptions', 'lab_orders', 'lab_reports',
  'imaging', 'pharmacy', 'inventory', 'billing', 'payments', 'insurance',
  'blood_bank', 'hr', 'notifications', 'tickets', 'reports', 'audit_logs', 'compliance',
];

const ALL_ACTIONS: PermissionAction[] = ['create', 'read', 'update', 'delete', 'export', 'approve'];

function allPermissions(): PermissionDef[] {
  const perms: PermissionDef[] = [];
  for (const mod of ALL_MODULES) {
    for (const action of ALL_ACTIONS) {
      perms.push({ module: mod, action });
    }
  }
  return perms;
}

export const ROLE_PERMISSIONS: Record<string, PermissionDef[]> = {
  super_admin: allPermissions(),

  admin: [
    { module: 'users', action: 'create' }, { module: 'users', action: 'read' }, { module: 'users', action: 'update' }, { module: 'users', action: 'delete' }, { module: 'users', action: 'export' },
    { module: 'roles', action: 'create' }, { module: 'roles', action: 'read' }, { module: 'roles', action: 'update' }, { module: 'roles', action: 'delete' },
    { module: 'departments', action: 'create' }, { module: 'departments', action: 'read' }, { module: 'departments', action: 'update' }, { module: 'departments', action: 'delete' },
    { module: 'wards', action: 'create' }, { module: 'wards', action: 'read' }, { module: 'wards', action: 'update' }, { module: 'wards', action: 'delete' },
    { module: 'rooms', action: 'create' }, { module: 'rooms', action: 'read' }, { module: 'rooms', action: 'update' }, { module: 'rooms', action: 'delete' },
    { module: 'beds', action: 'create' }, { module: 'beds', action: 'read' }, { module: 'beds', action: 'update' }, { module: 'beds', action: 'delete' },
    { module: 'patients', action: 'create' }, { module: 'patients', action: 'read' }, { module: 'patients', action: 'update' }, { module: 'patients', action: 'export' },
    { module: 'appointments', action: 'create' }, { module: 'appointments', action: 'read' }, { module: 'appointments', action: 'update' }, { module: 'appointments', action: 'delete' }, { module: 'appointments', action: 'export' },
    { module: 'visits', action: 'read' }, { module: 'visits', action: 'update' },
    { module: 'admissions', action: 'read' }, { module: 'admissions', action: 'update' }, { module: 'admissions', action: 'approve' },
    { module: 'vitals', action: 'read' },
    { module: 'diagnoses', action: 'read' },
    { module: 'progress_notes', action: 'read' },
    { module: 'nursing_notes', action: 'read' },
    { module: 'prescriptions', action: 'read' },
    { module: 'lab_orders', action: 'read' }, { module: 'lab_orders', action: 'approve' },
    { module: 'lab_reports', action: 'read' }, { module: 'lab_reports', action: 'approve' }, { module: 'lab_reports', action: 'export' },
    { module: 'imaging', action: 'read' }, { module: 'imaging', action: 'approve' },
    { module: 'pharmacy', action: 'read' }, { module: 'pharmacy', action: 'update' }, { module: 'pharmacy', action: 'approve' },
    { module: 'inventory', action: 'create' }, { module: 'inventory', action: 'read' }, { module: 'inventory', action: 'update' }, { module: 'inventory', action: 'delete' }, { module: 'inventory', action: 'approve' }, { module: 'inventory', action: 'export' },
    { module: 'billing', action: 'create' }, { module: 'billing', action: 'read' }, { module: 'billing', action: 'update' }, { module: 'billing', action: 'delete' }, { module: 'billing', action: 'approve' }, { module: 'billing', action: 'export' },
    { module: 'payments', action: 'create' }, { module: 'payments', action: 'read' }, { module: 'payments', action: 'update' }, { module: 'payments', action: 'approve' },
    { module: 'insurance', action: 'create' }, { module: 'insurance', action: 'read' }, { module: 'insurance', action: 'update' }, { module: 'insurance', action: 'approve' }, { module: 'insurance', action: 'export' },
    { module: 'blood_bank', action: 'read' }, { module: 'blood_bank', action: 'update' }, { module: 'blood_bank', action: 'approve' },
    { module: 'hr', action: 'create' }, { module: 'hr', action: 'read' }, { module: 'hr', action: 'update' }, { module: 'hr', action: 'approve' }, { module: 'hr', action: 'export' },
    { module: 'notifications', action: 'create' }, { module: 'notifications', action: 'read' }, { module: 'notifications', action: 'update' }, { module: 'notifications', action: 'delete' },
    { module: 'tickets', action: 'create' }, { module: 'tickets', action: 'read' }, { module: 'tickets', action: 'update' }, { module: 'tickets', action: 'approve' },
    { module: 'compliance', action: 'create' }, { module: 'compliance', action: 'read' }, { module: 'compliance', action: 'update' }, { module: 'compliance', action: 'approve' },
    { module: 'reports', action: 'create' }, { module: 'reports', action: 'read' }, { module: 'reports', action: 'export' },
    { module: 'audit_logs', action: 'read' }, { module: 'audit_logs', action: 'export' },
  ],

  doctor: [
    { module: 'patients', action: 'read' }, { module: 'patients', action: 'create' }, { module: 'patients', action: 'update' },
    { module: 'appointments', action: 'read' }, { module: 'appointments', action: 'create' }, { module: 'appointments', action: 'update' },
    { module: 'visits', action: 'read' }, { module: 'visits', action: 'create' }, { module: 'visits', action: 'update' },
    { module: 'admissions', action: 'read' }, { module: 'admissions', action: 'create' }, { module: 'admissions', action: 'update' },
    { module: 'vitals', action: 'read' }, { module: 'vitals', action: 'create' },
    { module: 'diagnoses', action: 'read' }, { module: 'diagnoses', action: 'create' }, { module: 'diagnoses', action: 'update' }, { module: 'diagnoses', action: 'delete' },
    { module: 'progress_notes', action: 'read' }, { module: 'progress_notes', action: 'create' }, { module: 'progress_notes', action: 'update' },
    { module: 'prescriptions', action: 'read' }, { module: 'prescriptions', action: 'create' }, { module: 'prescriptions', action: 'update' },
    { module: 'lab_orders', action: 'read' }, { module: 'lab_orders', action: 'create' }, { module: 'lab_reports', action: 'read' },
    { module: 'imaging', action: 'read' }, { module: 'imaging', action: 'create' },
    { module: 'billing', action: 'read' }, { module: 'payments', action: 'read' },
  ],

  patient: [
    { module: 'patients', action: 'read' }, { module: 'appointments', action: 'read' }, { module: 'appointments', action: 'create' },
    { module: 'billing', action: 'read' }, { module: 'payments', action: 'read' },
    { module: 'lab_reports', action: 'read' }, { module: 'imaging', action: 'read' }, { module: 'prescriptions', action: 'read' },
  ],

  nurse: [
    { module: 'patients', action: 'read' }, { module: 'patients', action: 'update' },
    { module: 'appointments', action: 'read' }, { module: 'appointments', action: 'update' },
    { module: 'visits', action: 'read' }, { module: 'visits', action: 'update' },
    { module: 'admissions', action: 'read' }, { module: 'admissions', action: 'update' },
    { module: 'vitals', action: 'read' }, { module: 'vitals', action: 'create' }, { module: 'vitals', action: 'update' },
    { module: 'diagnoses', action: 'read' },
    { module: 'nursing_notes', action: 'read' }, { module: 'nursing_notes', action: 'create' }, { module: 'nursing_notes', action: 'update' },
    { module: 'progress_notes', action: 'read' },
    { module: 'prescriptions', action: 'read' }, { module: 'prescriptions', action: 'update' },
    { module: 'lab_orders', action: 'read' }, { module: 'lab_reports', action: 'read' },
  ],

  front_desk: [
    { module: 'patients', action: 'read' }, { module: 'patients', action: 'create' }, { module: 'patients', action: 'update' },
    { module: 'appointments', action: 'read' }, { module: 'appointments', action: 'create' }, { module: 'appointments', action: 'update' },
    { module: 'billing', action: 'read' }, { module: 'billing', action: 'create' },
    { module: 'payments', action: 'read' }, { module: 'payments', action: 'create' },
    { module: 'departments', action: 'read' },
  ],

  lab_technician: [
    { module: 'lab_orders', action: 'read' }, { module: 'lab_orders', action: 'update' },
    { module: 'lab_reports', action: 'read' }, { module: 'lab_reports', action: 'create' }, { module: 'lab_reports', action: 'update' },
    { module: 'patients', action: 'read' },
  ],

  lab_supervisor: [
    { module: 'lab_orders', action: 'read' }, { module: 'lab_orders', action: 'create' }, { module: 'lab_orders', action: 'update' }, { module: 'lab_orders', action: 'approve' },
    { module: 'lab_reports', action: 'read' }, { module: 'lab_reports', action: 'create' }, { module: 'lab_reports', action: 'update' }, { module: 'lab_reports', action: 'approve' },
    { module: 'patients', action: 'read' },
  ],

  radiologist: [
    { module: 'imaging', action: 'read' }, { module: 'imaging', action: 'create' }, { module: 'imaging', action: 'update' }, { module: 'imaging', action: 'approve' },
    { module: 'patients', action: 'read' },
  ],

  pharmacist: [
    { module: 'pharmacy', action: 'read' }, { module: 'pharmacy', action: 'create' }, { module: 'pharmacy', action: 'update' }, { module: 'pharmacy', action: 'approve' },
    { module: 'prescriptions', action: 'read' }, { module: 'prescriptions', action: 'update' },
    { module: 'inventory', action: 'read' }, { module: 'patients', action: 'read' },
  ],

  pharmacy_technician: [
    { module: 'pharmacy', action: 'read' }, { module: 'pharmacy', action: 'create' }, { module: 'pharmacy', action: 'update' },
    { module: 'prescriptions', action: 'read' }, { module: 'inventory', action: 'read' }, { module: 'patients', action: 'read' },
  ],

  pharmacy_admin: [
    { module: 'pharmacy', action: 'read' }, { module: 'pharmacy', action: 'create' }, { module: 'pharmacy', action: 'update' }, { module: 'pharmacy', action: 'delete' }, { module: 'pharmacy', action: 'approve' },
    { module: 'prescriptions', action: 'read' }, { module: 'prescriptions', action: 'update' },
    { module: 'inventory', action: 'read' }, { module: 'inventory', action: 'create' }, { module: 'inventory', action: 'update' },
    { module: 'patients', action: 'read' }, { module: 'reports', action: 'read' },
  ],

  inventory_manager: [
    { module: 'inventory', action: 'read' }, { module: 'inventory', action: 'create' }, { module: 'inventory', action: 'update' },
    { module: 'inventory', action: 'delete' }, { module: 'inventory', action: 'approve' }, { module: 'inventory', action: 'export' },
    { module: 'reports', action: 'read' },
  ],

  billing_admin: [
    { module: 'billing', action: 'read' }, { module: 'billing', action: 'create' }, { module: 'billing', action: 'update' }, { module: 'billing', action: 'delete' }, { module: 'billing', action: 'approve' }, { module: 'billing', action: 'export' },
    { module: 'payments', action: 'read' }, { module: 'payments', action: 'create' }, { module: 'payments', action: 'update' }, { module: 'payments', action: 'approve' },
    { module: 'patients', action: 'read' }, { module: 'insurance', action: 'read' }, { module: 'reports', action: 'read' },
  ],

  cashier: [
    { module: 'billing', action: 'read' }, { module: 'billing', action: 'create' }, { module: 'billing', action: 'update' },
    { module: 'payments', action: 'read' }, { module: 'payments', action: 'create' }, { module: 'patients', action: 'read' },
  ],

  insurance_staff: [
    { module: 'insurance', action: 'read' }, { module: 'insurance', action: 'create' }, { module: 'insurance', action: 'update' }, { module: 'insurance', action: 'approve' },
    { module: 'billing', action: 'read' }, { module: 'patients', action: 'read' }, { module: 'admissions', action: 'read' },
  ],

  blood_bank_staff: [
    { module: 'blood_bank', action: 'read' }, { module: 'blood_bank', action: 'create' }, { module: 'blood_bank', action: 'update' }, { module: 'blood_bank', action: 'approve' },
    { module: 'patients', action: 'read' },
  ],

  hr_staff: [
    { module: 'hr', action: 'read' }, { module: 'hr', action: 'create' }, { module: 'hr', action: 'update' }, { module: 'hr', action: 'approve' }, { module: 'hr', action: 'export' },
    { module: 'users', action: 'read' }, { module: 'departments', action: 'read' }, { module: 'reports', action: 'read' },
  ],
};

// Doctor specialization slugs that inherit doctor permissions
const DOCTOR_SPECIALIZATIONS = [
  'general_physician', 'ent', 'diabetologist', 'obstetrics_gynaecologist',
  'cardiologist', 'dermatologist', 'neurologist', 'ophthalmologist',
  'orthopedic', 'pediatrician', 'psychiatrist', 'pulmonologist',
  'surgeon', 'urologist', 'opt', 'physiotherapist',
];

// ---------------------------------------------------------------------------
// Build a fast lookup Set per role: "module:action"
// ---------------------------------------------------------------------------

const permissionSetCache = new Map<string, Set<string>>();

function getPermissionSet(roleSlug: string): Set<string> {
  const normalized = roleSlug.toLowerCase().replace(/[\s-]+/g, '_');

  if (permissionSetCache.has(normalized)) {
    return permissionSetCache.get(normalized)!;
  }

  // Resolve the effective role key
  let effectiveRole = normalized;
  if (DOCTOR_SPECIALIZATIONS.includes(normalized)) {
    effectiveRole = 'doctor';
  }

  const perms = ROLE_PERMISSIONS[effectiveRole] ?? [];
  const set = new Set(perms.map((p) => `${p.module}:${p.action}`));
  permissionSetCache.set(normalized, set);
  return set;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePermissions() {
  const user = useAuthStore((s) => s.user);

  // Derive the primary role slug from user.role.name
  const roleSlug = user?.role?.name?.toLowerCase().replace(/[\s-]+/g, '_') ?? '';

  return useMemo(() => {
    const permSet = roleSlug ? getPermissionSet(roleSlug) : new Set<string>();

    /** Check if the user holds a specific role */
    function hasRole(roleName: string): boolean {
      const target = roleName.toLowerCase().replace(/[\s-]+/g, '_');
      return roleSlug === target;
    }

    /** Check if the user holds any of the given roles */
    function hasAnyRole(...roles: string[]): boolean {
      return roles.some((r) => hasRole(r));
    }

    /** Check if the user can perform `action` on `module` */
    function canAccess(module: string, action: PermissionAction): boolean {
      // super_admin bypasses all checks
      if (roleSlug === 'super_admin') return true;
      return permSet.has(`${module}:${action}`);
    }

    /** Is admin or super_admin */
    function isAdmin(): boolean {
      return roleSlug === 'admin' || roleSlug === 'super_admin';
    }

    /** Is any doctor specialization or generic doctor */
    function isDoctor(): boolean {
      return roleSlug === 'doctor' || DOCTOR_SPECIALIZATIONS.includes(roleSlug);
    }

    /** Is nurse */
    function isNurse(): boolean {
      return roleSlug === 'nurse';
    }

    /** Is front_desk */
    function isFrontDesk(): boolean {
      return roleSlug === 'front_desk';
    }

    return {
      roleSlug,
      hasRole,
      hasAnyRole,
      canAccess,
      isAdmin,
      isDoctor,
      isNurse,
      isFrontDesk,
      permissions: permSet,
    };
  }, [roleSlug]);
}
