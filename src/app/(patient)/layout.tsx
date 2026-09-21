'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { PlatformLogo } from '@/components/branding/platform-logo';
import {
  BedDouble,
  Building2,
  Calendar,
  CalendarDays,
  ClipboardList,
  FileText,
  FileCheck,
  FileSignature,
  Folder,
  HeartPulse,
  Home,
  HelpCircle,
  LogOut,
  Menu,
  PanelLeft,
  PanelLeftClose,
  Pill,
  ScanLine,
  Search,
  Stethoscope,
  Settings,
  TestTube,
  User,
  Heart,
  ShieldCheck,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { NotificationBell } from '@/components/layout/notification-bell';
import { cn } from '@/lib/utils';
import { ProfileSelector } from './patient-portal/_components/profile-selector';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/patient-portal', icon: Home },
  { label: 'Appointments', href: '/patient-portal/appointments', icon: Calendar },
  { label: 'Book Appointment', href: '/patient-portal/book-appointment', icon: Building2 },
  { label: 'My Investigations', href: '/patient-portal/orders', icon: ClipboardList },
  { label: 'Lab Reports', href: '/patient-portal/lab-reports', icon: TestTube },
  { label: 'Imaging Reports', href: '/patient-portal/imaging-reports', icon: ScanLine },
  { label: 'Prescriptions', href: '/patient-portal/prescriptions', icon: Pill },
  { label: 'Consultation Summaries', href: '/patient-portal/consultation-summaries', icon: FileSignature },
  { label: 'Hospitalizations', href: '/patient-portal/admissions', icon: BedDouble },
  { label: 'Discharge Summaries', href: '/patient-portal/discharge-summaries', icon: FileCheck },
  { label: 'Medical History', href: '/patient-portal/medical-history', icon: Heart },
  { label: 'Current Medications', href: '/patient-portal/current-medications', icon: Stethoscope },
  { label: 'My Documents', href: '/patient-portal/documents', icon: Folder },
  { label: 'Follow-Ups', href: '/patient-portal/follow-ups', icon: CalendarDays },
  { label: 'Bills & Payments', href: '/patient-portal/billing', icon: FileText },
  { label: 'Insurance & Claims', href: '/patient-portal/insurance', icon: ShieldCheck },
  { label: 'My Profile', href: '/patient-portal/profile', icon: User },
  { label: 'Settings', href: '/patient-portal/settings', icon: Settings },
];

function SidebarNav({
  pathname,
  onNavigate,
  user,
  onLogout,
  pinned,
  hoverExpand,
  onTogglePin,
  mobile = false,
}: {
  pathname: string;
  onNavigate?: () => void;
  user: { firstName?: string | null; lastName?: string | null } | null;
  onLogout: () => void;
  pinned: boolean;
  hoverExpand: boolean;
  onTogglePin?: () => void;
  mobile?: boolean;
}) {
  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase()
    : 'U';

  const labelVisibility = mobile || pinned
    ? 'opacity-100'
    : hoverExpand
      ? 'opacity-0 group-hover:opacity-100'
      : 'hidden';

  const showItemLabel = mobile || pinned;

  return (
    <div className="flex flex-col h-full w-full">
      {/* Brand + collapse toggle (sits next to the logo, always visible) */}
      <div className="mb-8 flex items-center gap-2 px-6 w-full overflow-hidden">
        <PlatformLogo
          variant="light"
          alt="Sanctuary"
          className="h-10 w-auto max-w-[150px] object-contain shrink-0"
          fallback={
            <>
              <div className="min-w-[40px] h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                <HeartPulse className="h-5 w-5 text-primary" />
              </div>
              <div className={cn(
                'ml-3 min-w-0 whitespace-nowrap transition-opacity duration-300',
                labelVisibility,
              )}>
                <h2 className="text-primary font-bold text-xl tracking-tighter font-headline truncate">
                  Sanctuary
                </h2>
                <p className="text-xs text-slate-400 font-medium font-label truncate">Patient Portal</p>
              </div>
            </>
          }
        />
        {onTogglePin && !mobile && (
          <button
            onClick={onTogglePin}
            title={pinned ? 'Collapse sidebar' : 'Pin sidebar open'}
            className={cn(
              'shrink-0 ml-auto p-1.5 rounded-lg transition-all duration-200 text-primary bg-primary/10 hover:bg-primary/15',
              // Hidden while the sidebar is collapsed; shown when pinned or hovered open.
              pinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            )}
          >
            {pinned ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 w-full space-y-1 overflow-y-auto overflow-x-hidden sanctuary-scrollbar">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/patient-portal' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={!showItemLabel && !hoverExpand ? item.label : undefined}
              className={cn(
                'relative flex items-center px-6 py-3.5 w-full transition-all duration-200',
                isActive
                  ? 'bg-white text-primary rounded-l-xl rounded-r-none sidebar-branch'
                  : 'text-slate-400 hover:text-primary hover:bg-primary/5',
              )}
            >
              <Icon
                className="min-w-[32px] h-5 w-5 shrink-0"
                style={isActive ? { strokeWidth: 2.5 } : undefined}
              />
              <span className={cn(
                'ml-4 font-sans text-sm font-medium tracking-wide whitespace-nowrap transition-opacity duration-300',
                labelVisibility,
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="mt-auto px-6 w-full pt-4">
        <div className="flex items-center w-full mb-3">
          <div className="min-w-[40px] h-10 w-10 rounded-xl bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-sm shrink-0">
            {initials}
          </div>
          <div className={cn(
            'ml-4 whitespace-nowrap transition-opacity duration-300 min-w-0',
            labelVisibility,
          )}>
            <p className="text-xs font-bold text-on-surface font-label truncate">
              {user ? `${user.firstName || ''} ${user.lastName || ''}` : 'Patient'}
            </p>
            <p className="text-[10px] text-slate-400 font-label">Member</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          title={!showItemLabel && !hoverExpand ? 'Sign Out' : undefined}
          className="flex items-center w-full px-0 py-2 text-slate-400 hover:text-error transition-colors"
        >
          <LogOut className="min-w-[40px] h-5 w-5" />
          <span className={cn(
            'ml-4 font-label text-sm font-medium whitespace-nowrap transition-opacity duration-300',
            labelVisibility,
          )}>
            Sign Out
          </span>
        </button>
      </div>
    </div>
  );
}

export default function PatientPortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, _hydrated, hydrate, logout } = useAuthStore();
  const { isPinned, togglePin } = useSidebarStore();
  const [ready, setReady] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!_hydrated) return;
    if (!isAuthenticated || !user) {
      router.replace('/login');
      return;
    }
    setReady(true);
  }, [_hydrated, isAuthenticated, user, router]);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase()
    : 'U';

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar — pin/unpin support */}
      <aside
        className={cn(
          'hidden lg:flex fixed left-0 top-0 h-full z-50 flex-col items-center py-8 bg-slate-50 transition-all duration-300 ease-in-out shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] overflow-x-hidden overflow-y-auto sanctuary-scrollbar',
          isPinned ? 'w-64' : 'w-20 hover:w-64 group',
        )}
      >
        <SidebarNav
          pathname={pathname}
          user={user}
          onLogout={handleLogout}
          pinned={isPinned}
          hoverExpand={!isPinned}
          onTogglePin={togglePin}
        />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-72 p-0 bg-slate-50">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <div className="py-8 h-full">
            <SidebarNav
              pathname={pathname}
              onNavigate={() => setMobileMenuOpen(false)}
              user={user}
              onLogout={handleLogout}
              pinned
              hoverExpand={false}
              mobile
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main area — offset by pinned/unpinned sidebar width */}
      <div className={cn('transition-all duration-300', isPinned ? 'lg:ml-64' : 'lg:ml-20')}>
        <header className="flex justify-between items-center sticky top-0 z-40 bg-background/80 backdrop-blur-xl h-20 px-6 sm:px-8">
          <div className="flex items-center gap-4 sm:gap-8">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-on-surface-variant hover:bg-surface-container-high rounded-lg transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <PlatformLogo
              variant="light"
              alt="Sanctuary"
              className="h-9 w-auto max-w-[180px] object-contain hidden sm:block"
              fallback={
                <h1 className="font-headline font-extrabold text-2xl text-primary tracking-tight hidden sm:block">
                  Sanctuary&nbsp;
                </h1>
              }
            />
            <div className="relative hidden md:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-outline" />
              <input
                type="text"
                placeholder="Search records, prescriptions, bills..."
                className="bg-surface-container-low border-none rounded-xl pl-12 pr-6 py-2.5 w-80 font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <ProfileSelector />
            {/* The real bell. This was a plain <button> with no onClick and a
                hardcoded red dot that was always lit — so a patient saw a
                permanent "you have something" marker that opened nothing, while
                their actual notifications (appointment reminders, "your lab
                report is ready") sat unread in the database. */}
            <NotificationBell variant="module" />
            <button
              onClick={() => router.push('/help')}
              title="User Guide"
              className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded-lg transition-colors hidden sm:flex"
            >
              <HelpCircle className="h-5 w-5" />
              <span className="sr-only">User Guide</span>
            </button>
            <div className="h-8 w-[1px] bg-outline-variant/30 hidden sm:block" />
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="font-label text-xs font-semibold text-on-surface truncate max-w-[160px]">
                  {user ? `${user.firstName || ''} ${user.lastName || ''}` : 'Patient'}
                </p>
                <p className="font-label text-[10px] text-on-surface-variant">Patient Portal</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-sm">
                {initials}
              </div>
            </div>
          </div>
        </header>

        <main className="p-6 sm:p-8 pt-4 sanctuary-scrollbar">
          <div className="animate-fade-in-up">{children}</div>
        </main>
      </div>
    </div>
  );
}
