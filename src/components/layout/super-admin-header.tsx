'use client';

import { Bell, HelpCircle, LogOut, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/stores/auth-store';
import { getRolePortalLabel } from '@/config/role-modules';
import { useRouter } from 'next/navigation';

export function SuperAdminHeader() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase()
    : 'SA';

  const portalLabel = getRolePortalLabel(user?.role?.slug || 'super_admin');

  return (
    <header className="sticky top-0 z-40 flex h-20 items-center justify-between bg-background/80 backdrop-blur-xl px-8">
      {/* Left side */}
      <div className="flex items-center gap-8">
        <h1 className="font-headline font-extrabold text-2xl text-primary tracking-tight">
          {portalLabel}
        </h1>
        <div className="relative hidden sm:block">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-outline"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            className="bg-surface-container-low border-none rounded-xl pl-12 pr-6 py-2.5 w-80 font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline"
            placeholder="Search hospitals, users, or reports..."
            type="text"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative p-2 text-on-surface-variant hover:bg-surface-container-high rounded-lg transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full ring-2 ring-background" />
        </button>

        {/* Help */}
        <button className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded-lg transition-colors">
          <HelpCircle className="h-5 w-5" />
        </button>

        {/* Divider */}
        <div className="h-8 w-[1px] bg-outline-variant/30 hidden sm:block" />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-3 focus:outline-none">
            <div className="text-right hidden sm:block">
              <p className="font-label text-xs font-semibold text-on-surface">
                {user ? `${user.firstName} ${user.lastName}` : 'Super Admin'}
              </p>
              <p className="font-label text-[10px] text-on-surface-variant">
                Platform Administrator
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-sm">
              {initials}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-headline font-semibold leading-none">
                    {user ? `${user.firstName} ${user.lastName}` : 'Super Admin'}
                  </p>
                  <p className="text-xs font-label leading-none text-on-surface-variant">
                    {user?.email || ''}
                  </p>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push('/super-admin/settings')}>
                <User className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
