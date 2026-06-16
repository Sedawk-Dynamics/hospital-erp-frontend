import {
  Building2,
  FlaskConical,
  ScanLine,
  Pill,
  Database,
  Scissors,
  UserRound,
  Sun,
  BedDouble,
  Home,
  Users,
  CalendarClock,
  Receipt,
  ArrowLeftRight,
  CreditCard,
  BarChart3,
  Settings,
  LayoutDashboard,
  ClipboardList,
  Package,
  ShoppingCart,
  Truck,
  FileText,
  Stethoscope,
  UtensilsCrossed,
  FileBarChart,
  FolderArchive,
  HeartPulse,
  ClipboardPlus,
  FileCheck,
  Activity,
  PillBottle,
  ArrowRightLeft,
  ClipboardCheck,
  ShieldCheck,
  ShieldAlert,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import type { ModuleKey } from '@/stores/module-store';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /**
   * Optional allowlist of normalized role slugs (snake_case) permitted to see
   * this item. When omitted, the item is visible to every role that can
   * access the module. `admin` and `super_admin` always pass.
   */
  restrictTo?: string[];
}

export interface ModuleConfig {
  key: ModuleKey;
  label: string;
  icon: LucideIcon;
  baseRoute: string;
  sidebarItems: NavItem[];
}

export const MODULE_REGISTRY: Record<ModuleKey, ModuleConfig> = {
  hospital: {
    key: 'hospital',
    label: 'Hospital',
    icon: Building2,
    baseRoute: '/hospital',
    sidebarItems: [
      { label: 'Home', href: '/hospital', icon: Home },
      { label: 'IP Home', href: '/hospital/ip', icon: BedDouble },
      { label: 'Walk In', href: '/hospital/walkin', icon: Users },
      { label: 'Hospital Billing', href: '/hospital/billing', icon: Receipt },
      { label: 'Billing Transaction', href: '/hospital/transactions', icon: ArrowLeftRight },
      { label: 'Credit Settlement', href: '/hospital/credit-settlement', icon: CreditCard },
      { label: 'Reports', href: '/hospital/reports', icon: BarChart3 },
      { label: 'Settings', href: '/hospital/settings', icon: Settings },
      { label: 'Dashboard', href: '/hospital/dashboard', icon: LayoutDashboard },
    ],
  },

  laboratory: {
    key: 'laboratory',
    label: 'Laboratory',
    icon: FlaskConical,
    baseRoute: '/laboratory',
    sidebarItems: [
      // Home is the technician's primary surface: orders, samples, result entry.
      { label: 'Home', href: '/laboratory', icon: Home },
      // Everything below is supervisor-only per SOW (review/approve/sign/publish,
      // staff/outsource/test-catalog management, financials, analytics).
      { label: 'Reports', href: '/laboratory/reports', icon: BarChart3, restrictTo: ['lab_supervisor', 'pathologist'] },
      { label: 'Billing', href: '/laboratory/billing', icon: Receipt, restrictTo: ['lab_supervisor', 'pathologist'] },
      { label: 'Settings', href: '/laboratory/settings', icon: Settings, restrictTo: ['lab_supervisor', 'pathologist'] },
    ],
  },

  radiology: {
    key: 'radiology',
    label: 'Radiology',
    icon: ScanLine,
    baseRoute: '/radiology',
    sidebarItems: [
      // Home + Worklist are the radiologist's primary surface.
      { label: 'Home', href: '/radiology', icon: Home },
      { label: 'Worklist', href: '/radiology/worklist', icon: ClipboardList },
      // Below: radiology_admin-only per SOW (analytics, billing, inventory,
      // vendor purchases, modality catalog/tariffs). Sidebar hides them for
      // radiologists; the RadiologyAdminGuard also gates the routes.
      { label: 'Dashboard', href: '/radiology/dashboard', icon: LayoutDashboard, restrictTo: ['radiology_admin'] },
      { label: 'Reports', href: '/radiology/reports', icon: BarChart3, restrictTo: ['radiology_admin'] },
      { label: 'Billing', href: '/radiology/billing', icon: Receipt, restrictTo: ['radiology_admin'] },
      { label: 'Settings', href: '/radiology/settings', icon: Settings, restrictTo: ['radiology_admin'] },
    ],
  },

  pharmacy: {
    key: 'pharmacy',
    label: 'Pharmacy',
    icon: Pill,
    baseRoute: '/pharmacy',
    sidebarItems: [
      // Pharmacist surface (operational counter).
      { label: 'Billing', href: '/pharmacy', icon: Receipt },
      { label: 'Prescription Queue', href: '/pharmacy/queue', icon: ClipboardList },
      { label: 'Returns', href: '/pharmacy/returns', icon: ArrowLeftRight },
      // pharmacy_admin only (management + financials). admin/super_admin bypass.
      { label: 'Billing Transaction', href: '/pharmacy/transactions', icon: ArrowLeftRight, restrictTo: ['pharmacy_admin'] },
      { label: 'Reports', href: '/pharmacy/reports', icon: BarChart3, restrictTo: ['pharmacy_admin'] },
      { label: 'Stock Ledger', href: '/pharmacy/stock-ledger', icon: ClipboardList, restrictTo: ['pharmacy_admin'] },
      { label: 'Settings', href: '/pharmacy/settings', icon: Settings, restrictTo: ['pharmacy_admin'] },
    ],
  },

  ot: {
    key: 'ot',
    label: 'OT',
    icon: Scissors,
    baseRoute: '/ot',
    sidebarItems: [
      { label: 'Home', href: '/ot', icon: Home },
      { label: 'Billing Transaction', href: '/ot/transactions', icon: ArrowLeftRight },
      { label: 'OT Stocks', href: '/ot/stocks', icon: ClipboardList },
      { label: 'Inventory', href: '/ot/inventory', icon: Package },
      { label: 'Stock Transfer', href: '/ot/stock-transfer', icon: Truck },
      { label: 'Reports', href: '/ot/reports', icon: BarChart3 },
      { label: 'Settings', href: '/ot/settings', icon: Settings },
    ],
  },

  counsellor: {
    key: 'counsellor',
    label: 'Counsellor',
    icon: UserRound,
    baseRoute: '/counsellor',
    sidebarItems: [
      { label: 'Home', href: '/counsellor', icon: Home },
      { label: 'Reports', href: '/counsellor/reports', icon: BarChart3 },
      { label: 'Settings', href: '/counsellor/settings', icon: Settings },
    ],
  },

  daycare: {
    key: 'daycare',
    label: 'Day Care',
    icon: Sun,
    baseRoute: '/daycare',
    sidebarItems: [
      { label: 'Home', href: '/daycare', icon: Home },
      { label: 'Reports', href: '/daycare/reports', icon: BarChart3 },
      { label: 'Settings', href: '/daycare/settings', icon: Settings },
    ],
  },

  ward: {
    key: 'ward',
    label: 'Ward',
    icon: BedDouble,
    baseRoute: '/ward',
    sidebarItems: [
      { label: 'Home', href: '/ward', icon: Home },
      { label: 'Reports', href: '/ward/reports', icon: BarChart3 },
      { label: 'Settings', href: '/ward/settings', icon: Settings },
    ],
  },

  doctor: {
    key: 'doctor',
    label: 'Doctor',
    icon: Stethoscope,
    baseRoute: '/doctor',
    sidebarItems: [
      { label: 'Home', href: '/doctor', icon: Home },
      { label: 'IP Home', href: '/doctor/ip', icon: BedDouble },
      { label: 'Schedule & Leaves', href: '/doctor/schedule', icon: CalendarClock },
      { label: 'Prescriptions', href: '/doctor/prescriptions', icon: ClipboardPlus },
      { label: 'Discharge Summary', href: '/doctor/discharge-summary', icon: FileCheck },
      { label: 'Nutrition Chart', href: '/doctor/nutrition-chart', icon: UtensilsCrossed },
      { label: 'Registry', href: '/doctor/registry', icon: FileBarChart },
      { label: 'MRD', href: '/doctor/mrd', icon: FolderArchive },
      { label: 'OT List', href: '/doctor/ot-list', icon: HeartPulse },
      { label: 'CDSS Alerts', href: '/doctor/cdss', icon: Activity },
      { label: 'Settings', href: '/doctor/settings', icon: Settings },
    ],
  },

  nurse: {
    key: 'nurse',
    label: 'Nurse',
    icon: Activity,
    baseRoute: '/nurse',
    sidebarItems: [
      { label: 'Dashboard', href: '/nurse', icon: Home },
      { label: 'IP Patients', href: '/nurse/ip', icon: BedDouble },
      { label: 'My Schedule', href: '/nurse/schedule', icon: CalendarClock },
      { label: 'Patient Vitals', href: '/nurse/vitals', icon: HeartPulse },
      { label: 'Clinical Charting', href: '/nurse/charting', icon: ClipboardList },
      { label: 'eMAR', href: '/nurse/emar', icon: PillBottle },
      { label: 'Patient Forms', href: '/nurse/forms', icon: FileText },
      { label: 'Shift Handover', href: '/nurse/handover', icon: ArrowRightLeft },
      { label: 'Orders & Ward', href: '/nurse/orders', icon: ClipboardCheck },
      { label: 'Settings', href: '/nurse/settings', icon: Settings },
    ],
  },

  inventory: {
    key: 'inventory',
    label: 'Inventory',
    icon: Package,
    baseRoute: '/inventory',
    sidebarItems: [
      { label: 'Stock Register', href: '/inventory', icon: ClipboardList },
      { label: 'Stock In', href: '/inventory/stock-in', icon: Truck },
      { label: 'Stock Out', href: '/inventory/stock-out', icon: ArrowRightLeft },
      { label: 'Stock Transfer', href: '/inventory/stock-transfer', icon: ArrowLeftRight },
      { label: 'Low Stock Alerts', href: '/inventory/low-stock', icon: HeartPulse },
      { label: 'Purchase Orders', href: '/inventory/purchase-orders', icon: ShoppingCart },
      // Pharmacy drug-stock management (backed by /pharmacy/* endpoints).
      { label: 'Drug Catalog', href: '/inventory/drug-catalog', icon: Database },
      { label: 'Drug Formulary', href: '/inventory/drug-formulary', icon: Pill },
      { label: 'Drug Batches', href: '/inventory/drug-batches', icon: PillBottle },
      { label: 'Drug GST', href: '/inventory/drug-gst', icon: FileText },
      { label: 'Reports', href: '/inventory/reports', icon: BarChart3 },
      { label: 'Audit Logs', href: '/inventory/audit-logs', icon: FileCheck },
      { label: 'Settings', href: '/inventory/settings', icon: Settings },
    ],
  },

  insurance: {
    key: 'insurance',
    label: 'Insurance & TPA',
    icon: ShieldCheck,
    baseRoute: '/insurance',
    sidebarItems: [
      { label: 'Dashboard', href: '/insurance', icon: LayoutDashboard },
      { label: 'Claims', href: '/insurance/claims', icon: FileCheck },
      { label: 'Pre-Authorization', href: '/insurance/pre-auth', icon: ShieldAlert },
      { label: 'Policies', href: '/insurance/policies', icon: ClipboardCheck },
      { label: 'Insurers', href: '/insurance/insurers', icon: Building2 },
      { label: 'TPA Providers', href: '/insurance/tpa', icon: Users },
      { label: 'TPA Logs', href: '/insurance/tpa-logs', icon: FileText },
      { label: 'Reports', href: '/insurance/reports', icon: BarChart3 },
      { label: 'Settings', href: '/insurance/settings', icon: Settings },
    ],
  },

  hr: {
    key: 'hr',
    label: 'HR & Payroll',
    icon: UserCog,
    baseRoute: '/hr',
    sidebarItems: [
      { label: 'Dashboard', href: '/hr', icon: LayoutDashboard },
      { label: 'Staff', href: '/hr/staff', icon: Users },
      { label: 'Duty Rosters', href: '/hr/rosters', icon: CalendarClock },
      { label: 'Attendance', href: '/hr/attendance', icon: ClipboardCheck },
      { label: 'Leaves', href: '/hr/leaves', icon: FileText },
      { label: 'Payroll', href: '/hr/payroll', icon: Receipt },
      { label: 'Licenses', href: '/hr/licenses', icon: FileCheck },
      { label: 'Reports', href: '/hr/reports', icon: BarChart3 },
    ],
  },

  'nurse-admin': {
    key: 'nurse-admin',
    label: 'Nursing Admin',
    icon: ShieldCheck,
    baseRoute: '/nurse-admin',
    sidebarItems: [
      { label: 'Dashboard', href: '/nurse-admin', icon: Home },
      { label: 'Nurse ↔ Doctor', href: '/nurse-admin/nurse-doctor', icon: UserCog },
      { label: 'Patient Assignments', href: '/nurse-admin/assignments', icon: ClipboardCheck },
      { label: 'Shift Handover', href: '/nurse-admin/handover', icon: ArrowRightLeft },
      { label: 'Ward Orders', href: '/nurse-admin/orders', icon: ClipboardPlus },
      { label: 'Roster Planning', href: '/nurse-admin/roster', icon: CalendarClock },
      { label: 'Staffing', href: '/nurse-admin/staffing', icon: Users },
      { label: 'eMAR Settings', href: '/nurse/emar/settings', icon: PillBottle },
      { label: 'Settings', href: '/nurse-admin/settings', icon: Settings },
    ],
  },
};

export const MODULE_KEYS = Object.keys(MODULE_REGISTRY) as ModuleKey[];

/**
 * Derive the active ModuleKey from a pathname.
 * E.g. "/hospital/billing" → "hospital", "/doctor/ip" → "doctor"
 * Returns null if the pathname doesn't match any module.
 */
export function getModuleFromPathname(pathname: string): ModuleKey | null {
  const segment = pathname.split('/').filter(Boolean)[0];
  if (segment && segment in MODULE_REGISTRY) {
    return segment as ModuleKey;
  }
  return null;
}
