'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  ToggleLeft,
  LifeBuoy,
  BarChart3,
  Settings,
  ShieldCheck,
  PanelLeftClose,
  PanelLeft,
  Percent,
  CalendarCheck,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/super-admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/super-admin/demo-requests', label: 'Demo Requests', icon: CalendarCheck },
  { href: '/super-admin/hospitals', label: 'Hospitals', icon: Building2 },
  { href: '/super-admin/users', label: 'Users', icon: Users },
  { href: '/super-admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { href: '/super-admin/commission', label: 'Commission', icon: Percent },
  { href: '/super-admin/features', label: 'Features', icon: ToggleLeft },
  { href: '/super-admin/support', label: 'Support Tickets', icon: LifeBuoy },
  { href: '/super-admin/reports', label: 'Reports', icon: BarChart3 },
  { href: '/super-admin/settings', label: 'Settings', icon: Settings },
];

export function SuperAdminSidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { isPinned, togglePin } = useSidebarStore();

  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase()
    : 'SA';

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full z-50 flex flex-col py-8 bg-slate-50 transition-all duration-300 ease-in-out border-r-0 shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)]',
        isPinned ? 'w-64' : 'w-20 hover:w-64 group'
      )}
    >
      {/* Logo / Brand */}
      <div className="mb-8 flex items-center justify-between px-6 w-full overflow-hidden">
        <div className="flex items-center min-w-0">
          <div className="min-w-[40px] h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div
            className={cn(
              'ml-4 whitespace-nowrap transition-opacity duration-300',
              isPinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            )}
          >
            <h2 className="text-primary font-bold text-xl tracking-tighter">Platform</h2>
            <p className="text-xs text-slate-400 font-medium">Super Admin</p>
          </div>
        </div>
        {/* Pin / Unpin button — visible when expanded */}
        <button
          onClick={togglePin}
          title={isPinned ? 'Collapse sidebar' : 'Keep sidebar open'}
          className={cn(
            'shrink-0 p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-all duration-200',
            isPinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
        >
          {isPinned ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 w-full space-y-0.5 overflow-y-auto sanctuary-scrollbar">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/super-admin'
              ? pathname === '/super-admin'
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex items-center px-6 py-4 w-full transition-all duration-200',
                isActive
                  ? 'bg-surface-container-lowest text-primary rounded-l-xl rounded-r-none sidebar-branch'
                  : 'text-slate-400 hover:text-primary hover:bg-primary/5'
              )}
            >
              <Icon
                className="min-w-[24px] h-5 w-5 shrink-0"
                style={isActive ? { strokeWidth: 2.5 } : undefined}
              />
              <span
                className={cn(
                  'ml-4 font-sans text-sm font-medium tracking-wide whitespace-nowrap transition-opacity duration-300',
                  isPinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* User profile at bottom */}
      <div className="mt-auto px-6 w-full">
        <div className="flex items-center w-full">
          <div className="min-w-[40px] w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-sm shrink-0">
            {initials}
          </div>
          <div
            className={cn(
              'ml-4 whitespace-nowrap transition-opacity duration-300',
              isPinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            )}
          >
            <p className="text-xs font-bold text-on-surface">
              {user ? `${user.firstName} ${user.lastName}` : 'Super Admin'}
            </p>
            <p className="text-[10px] text-slate-400">Platform Admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
