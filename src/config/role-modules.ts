import type { ModuleKey } from '@/stores/module-store';
import { MODULE_REGISTRY } from '@/config/modules';

/**
 * Maps user role slugs to allowed modules.
 *
 * Role hierarchy:
 *   super_admin — SaaS platform owner (tenant owner). Has access to ALL modules
 *                 and bypasses permission checks on the backend.
 *   admin      — Hospital administrator who purchased a subscription. Manages
 *                 their hospital's operations across all standard modules.
 *
 * If a role has exactly one module, the user is auto-routed to it (skipping module selection).
 * If a role is not listed, they see the default admin modules.
 */

// All modules (for super_admin — SaaS platform owner)
export const ALL_MODULES: ModuleKey[] = [
  'hospital',
  'laboratory',
  'radiology',
  'pharmacy',
  'ot',
  'counsellor',
  'daycare',
  'ward',
  'doctor',
];

// Standard admin modules (for admin — hospital subscription owner)
export const ADMIN_MODULES: ModuleKey[] = [
  'hospital',
  'laboratory',
  'radiology',
  'pharmacy',
  'ot',
  'counsellor',
  'daycare',
  'ward',
];

// Doctor specializations all map to the single 'doctor' module
const DOCTOR_ROLE_SLUGS = [
  'doctor',
  'general_physician',
  'ent',
  'diabetologist',
  'obstetrics_gynaecologist',
  'cardiologist',
  'dermatologist',
  'neurologist',
  'ophthalmologist',
  'orthopedic',
  'pediatrician',
  'psychiatrist',
  'pulmonologist',
  'surgeon',
  'urologist',
  'opt',
  'physiotherapist',
];

// Role-to-modules mapping for non-doctor, non-admin roles
const ROLE_MODULE_MAP: Record<string, ModuleKey[]> = {
  // Lab staff → laboratory only
  lab_technician: ['laboratory'],
  lab_supervisor: ['laboratory'],

  // Radiology staff → radiology only
  radiologist: ['radiology'],

  // Pharmacy staff → pharmacy only
  pharmacist: ['pharmacy'],
  pharmacy_technician: ['pharmacy'],
  pharmacy_admin: ['pharmacy'],

  // Nursing staff → hospital + ward
  nurse: ['hospital', 'ward'],

  // Front desk → hospital (OP/IP, billing, appointments)
  front_desk: ['hospital'],

  // Billing & finance → hospital (billing, transactions, credit settlement)
  billing_admin: ['hospital'],
  cashier: ['hospital'],
  insurance_staff: ['hospital'],

  // Inventory → pharmacy, laboratory, ot (stock management across modules)
  inventory_manager: ['pharmacy', 'laboratory', 'ot'],

  // Blood bank → hospital
  blood_bank_staff: ['hospital'],

  // HR → hospital
  hr_staff: ['hospital'],

  // Patient role → no module access (future patient portal)
  patient: [],
};

/**
 * Get allowed modules for a user role.
 * Returns the list of ModuleKeys the user can access.
 */
export function getModulesForRole(roleSlug?: string): ModuleKey[] {
  if (!roleSlug) return ADMIN_MODULES;

  const normalized = roleSlug.toLowerCase().replace(/[\s-]+/g, '_');

  // Doctor specializations → doctor module
  if (DOCTOR_ROLE_SLUGS.includes(normalized)) {
    return ['doctor'];
  }

  // super_admin (SaaS platform owner) → has own panel, not hospital modules
  if (normalized === 'super_admin') {
    return [];
  }

  // admin (hospital subscription owner) → all standard admin modules
  if (normalized === 'admin') {
    return ADMIN_MODULES;
  }

  // Check role-specific mapping
  if (normalized in ROLE_MODULE_MAP) {
    return ROLE_MODULE_MAP[normalized];
  }

  // Default: show admin modules
  return ADMIN_MODULES;
}

/**
 * Get the auto-route path for a role.
 * Always returns the first permitted module's base route (no module selection step).
 * Returns null only for roles with no modules (e.g. patient).
 */
export function getAutoRouteForRole(roleSlug?: string): string | null {
  if (!roleSlug) return MODULE_REGISTRY['hospital'].baseRoute;

  const normalized = roleSlug.toLowerCase().replace(/[\s-]+/g, '_');

  // Super admin has its own dedicated panel
  if (normalized === 'super_admin') {
    return '/super-admin';
  }

  // Patient has its own portal
  if (normalized === 'patient') {
    return '/patient-portal';
  }

  const modules = getModulesForRole(roleSlug);
  if (modules.length === 0) return null;

  // Always route to first permitted module
  return MODULE_REGISTRY[modules[0]].baseRoute;
}
