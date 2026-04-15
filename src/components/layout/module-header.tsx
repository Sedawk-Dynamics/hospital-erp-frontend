'use client';

import { Menu, Bell, HelpCircle, LogOut, Building2, Settings, ArrowLeftRight, Search, User, CreditCard, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useAuthStore } from '@/stores/auth-store';
import { useClinicStore } from '@/stores/clinic-store';
import { usePermissions } from '@/hooks/use-permissions';
import { MODULE_REGISTRY, getModuleFromPathname } from '@/config/modules';
import { useRouter, usePathname } from 'next/navigation';

export function ModuleHeader() {
  const { toggle } = useSidebarStore();
  const { user, logout } = useAuthStore();
  const { selectedClinic } = useClinicStore();
  const { isAdmin } = usePermissions();
  const pathname = usePathname();
  const router = useRouter();

  const activeModule = getModuleFromPathname(pathname);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase()
    : 'U';

  const moduleLabel = activeModule === 'doctor' && user
    ? `Dr ${user.firstName}`
    : activeModule
      ? MODULE_REGISTRY[activeModule]?.label
      : '';

  const settingsPath = activeModule ? MODULE_REGISTRY[activeModule]?.sidebarItems?.find(i => i.label === 'Settings')?.href : null;

  const clinicName = selectedClinic?.name || user?.tenant?.name || 'Hospital ERP';

  return (
    <header className="flex justify-between items-center sticky top-0 z-40 bg-background/80 backdrop-blur-xl h-20 px-8">
      {/* Left: Mobile menu + App name + Search — code.html: gap-8 */}
      <div className="flex items-center gap-8">
        {/* Mobile menu toggle */}
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggle}>
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>

        {/* App name / module label — code.html: font-headline font-extrabold text-2xl text-primary tracking-tight */}
        <h1 className="font-headline font-extrabold text-2xl text-primary tracking-tight hidden sm:block">
          {moduleLabel || clinicName}&nbsp;
        </h1>

        {/* Search bar — code.html: relative group, bg-surface-container-low, rounded-xl, pl-12 pr-6 py-2.5 w-80 */}
        <div className="relative hidden md:block group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-outline" />
          <input
            className="bg-surface-container-low border-none rounded-xl pl-12 pr-6 py-2.5 w-80 font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
            placeholder="Search patients, doctors, or reports..."
            type="text"
          />
        </div>
      </div>

      {/* Right: Actions — code.html: gap-6 */}
      <div className="flex items-center gap-6">
        {/* Notifications — code.html: relative p-2, rounded-lg, red dot */}
        <button className="relative p-2 text-on-surface-variant hover:bg-surface-container-high rounded-lg transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full ring-2 ring-background" />
        </button>

        {/* Help — code.html: p-2, rounded-lg */}
        <button className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded-lg transition-colors hidden sm:flex">
          <HelpCircle className="h-5 w-5" />
        </button>

        {/* Divider — code.html: h-8 w-[1px] bg-outline-variant/30 */}
        <div className="h-8 w-[1px] bg-outline-variant/30 hidden sm:block" />

        {/* Clinic info + Avatar dropdown — code.html: gap-3 */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-3 focus:outline-none">
            <div className="text-right hidden sm:block">
              <p className="font-label text-xs font-semibold text-on-surface">{clinicName}</p>
              <p className="font-label text-[10px] text-on-surface-variant">
                {selectedClinic?.hospitalCode ? `Code: ${selectedClinic.hospitalCode}` : (moduleLabel || 'Admin Terminal')}
              </p>
            </div>
            {/* Avatar — code.html: w-10 h-10 rounded-xl bg-secondary-container */}
            <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-sm">
              {initials}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-headline font-semibold leading-none">
                    {user ? `${user.firstName} ${user.lastName}` : 'User'}
                  </p>
                  <p className="text-xs font-label leading-none text-on-surface-variant">
                    {user?.email || ''}
                  </p>
                  {user?.role?.name && (
                    <p className="text-[10px] font-label leading-none text-primary font-medium capitalize mt-0.5">
                      {user.role.name.replace(/_/g, ' ')}
                    </p>
                  )}
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push('/select-hospital')}>
                <ArrowLeftRight className="mr-2 h-4 w-4" />
                <span>Switch Hospital</span>
              </DropdownMenuItem>
              {settingsPath && (
                <DropdownMenuItem onClick={() => router.push(settingsPath)}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push('/staff-forms')}>
                <ClipboardList className="mr-2 h-4 w-4" />
                <span>Staff Forms Inbox</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/my-account')}>
                <User className="mr-2 h-4 w-4" />
                <span>My Account</span>
              </DropdownMenuItem>
              {isAdmin() && (
                <DropdownMenuItem onClick={() => router.push('/manage-subscription')}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  <span>Subscription & Billing</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
