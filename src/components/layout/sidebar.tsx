'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/stores/sidebar-store';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { PlatformLogo } from '@/components/branding/platform-logo';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Stethoscope,
  BedDouble,
  HeartPulse,
  FileText,
  ClipboardList,
  ClipboardPlus,
  Pill,
  FlaskConical,
  ScanLine,
  Tablets,
  Package,
  Receipt,
  CreditCard,
  Shield,
  Droplets,
  UserCog,
  Clock,
  Banknote,
  MessageSquare,
  UserPlus,
  Building2,
  Settings,
  BarChart3,
  ChevronLeft,
  Activity,
  Bell,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: 'Main',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Notifications', href: '/notifications', icon: Bell },
    ],
  },
  {
    title: 'Patient Management',
    items: [
      { label: 'Patients', href: '/patients', icon: Users },
      { label: 'Appointments', href: '/appointments', icon: Calendar },
    ],
  },
  {
    title: 'Clinical',
    items: [
      { label: 'Visits', href: '/visits', icon: Stethoscope },
      { label: 'Admissions', href: '/admissions', icon: BedDouble },
      { label: 'Vitals', href: '/vitals', icon: HeartPulse },
      { label: 'Diagnoses', href: '/diagnoses', icon: FileText },
    ],
  },
  {
    title: 'Notes',
    items: [
      { label: 'Progress Notes', href: '/progress-notes', icon: ClipboardList },
      { label: 'Nursing Notes', href: '/nursing-notes', icon: ClipboardPlus },
    ],
  },
  {
    title: 'Prescriptions',
    items: [
      { label: 'Prescriptions', href: '/prescriptions', icon: Pill },
    ],
  },
  {
    title: 'Lab & Imaging',
    items: [
      { label: 'Lab Orders', href: '/lab', icon: FlaskConical },
      { label: 'Imaging', href: '/imaging', icon: ScanLine },
    ],
  },
  {
    title: 'Pharmacy',
    items: [
      { label: 'Pharmacy', href: '/pharmacy', icon: Tablets },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { label: 'Inventory', href: '/inventory', icon: Package },
    ],
  },
  {
    title: 'Billing',
    items: [
      { label: 'Bills', href: '/billing', icon: Receipt },
      { label: 'Payments', href: '/billing/payments', icon: CreditCard },
    ],
  },
  {
    title: 'Insurance',
    items: [
      { label: 'Insurance', href: '/insurance', icon: Shield },
    ],
  },
  {
    title: 'Blood Bank',
    items: [
      { label: 'Blood Bank', href: '/blood-bank', icon: Droplets },
    ],
  },
  {
    title: 'HR',
    items: [
      { label: 'Staff', href: '/hr', icon: UserCog },
      { label: 'Attendance', href: '/attendance', icon: Clock },
      { label: 'Payroll', href: '/payroll', icon: Banknote },
    ],
  },
  {
    title: 'Communication',
    items: [
      { label: 'Messages', href: '/messages', icon: MessageSquare },
    ],
  },
  {
    title: 'Admin',
    items: [
      { label: 'Users', href: '/users', icon: UserPlus },
      { label: 'Departments', href: '/departments', icon: Building2 },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
  {
    title: 'Reports',
    items: [
      { label: 'Reports', href: '/reports', icon: BarChart3 },
    ],
  },
];

function SidebarContent({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const { close } = useSidebarStore();

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-2 px-4 h-16 border-b border-sidebar-border shrink-0',
        collapsed && 'justify-center px-2'
      )}>
        <PlatformLogo
          variant="light"
          alt={process.env.NEXT_PUBLIC_APP_NAME || 'Hospital ERP'}
          className={cn('w-auto object-contain', collapsed ? 'h-7 max-w-[36px]' : 'h-8 max-w-[160px]')}
          fallback={
            <>
              <Activity className="h-7 w-7 text-primary shrink-0" />
              {!collapsed && (
                <span className="font-bold text-lg text-sidebar-foreground truncate">
                  {process.env.NEXT_PUBLIC_APP_NAME || 'Hospital ERP'}
                </span>
              )}
            </>
          }
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-4">
        {navGroups.map((group) => (
          <div key={group.title}>
            {!collapsed && (
              <p className="px-3 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {group.title}
              </p>
            )}
            {collapsed && <Separator className="mb-2" />}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => close()}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        isActive
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                          : 'text-sidebar-foreground',
                        collapsed && 'justify-center px-2'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}

export function Sidebar() {
  const { isOpen, isCollapsed, close, toggleCollapse } = useSidebarStore();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 relative',
          isCollapsed ? 'w-[68px]' : 'w-64'
        )}
      >
        <SidebarContent collapsed={isCollapsed} />
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapse}
          className="absolute -right-3 top-20 z-10 h-6 w-6 rounded-full border bg-background shadow-sm hover:bg-accent"
        >
          <ChevronLeft
            className={cn(
              'h-3.5 w-3.5 transition-transform',
              isCollapsed && 'rotate-180'
            )}
          />
        </Button>
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation Menu</SheetTitle>
          </SheetHeader>
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  );
}
