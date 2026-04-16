import {
  Building2,
  FlaskConical,
  ScanLine,
  Pill,
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
  type LucideIcon,
} from 'lucide-react';
import type { ModuleKey } from '@/stores/module-store';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
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
      { label: 'Home', href: '/laboratory', icon: Home },
      { label: 'Reports', href: '/laboratory/reports', icon: BarChart3 },
      { label: 'Billing', href: '/laboratory/billing', icon: Receipt },
      { label: 'Inventory', href: '/laboratory/inventory', icon: Package },
      { label: 'Purchase', href: '/laboratory/purchase', icon: ShoppingCart },
      { label: 'Settings', href: '/laboratory/settings', icon: Settings },
    ],
  },

  radiology: {
    key: 'radiology',
    label: 'Radiology',
    icon: ScanLine,
    baseRoute: '/radiology',
    sidebarItems: [
      { label: 'Home', href: '/radiology', icon: Home },
      { label: 'Reports', href: '/radiology/reports', icon: BarChart3 },
      { label: 'Billing', href: '/radiology/billing', icon: Receipt },
      { label: 'Inventory', href: '/radiology/inventory', icon: Package },
      { label: 'Purchase', href: '/radiology/purchase', icon: ShoppingCart },
      { label: 'Settings', href: '/radiology/settings', icon: Settings },
    ],
  },

  pharmacy: {
    key: 'pharmacy',
    label: 'Pharmacy',
    icon: Pill,
    baseRoute: '/pharmacy',
    sidebarItems: [
      { label: 'Billing', href: '/pharmacy', icon: Receipt },
      { label: 'Billing Transaction', href: '/pharmacy/transactions', icon: ArrowLeftRight },
      { label: 'Inventory', href: '/pharmacy/inventory', icon: Package },
      { label: 'Purchase', href: '/pharmacy/purchase', icon: ShoppingCart },
      { label: 'Reports', href: '/pharmacy/reports', icon: BarChart3 },
      { label: 'Stock Transfer', href: '/pharmacy/stock-transfer', icon: Truck },
      { label: 'Settings', href: '/pharmacy/settings', icon: Settings },
      { label: 'GST Update', href: '/pharmacy/gst', icon: FileText },
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
      { label: 'Clinical Charting', href: '/nurse/charting', icon: ClipboardList },
      { label: 'eMAR', href: '/nurse/emar', icon: PillBottle },
      { label: 'Shift Handover', href: '/nurse/handover', icon: ArrowRightLeft },
      { label: 'Orders & Ward', href: '/nurse/orders', icon: ClipboardCheck },
      { label: 'Settings', href: '/nurse/settings', icon: Settings },
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
