'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { HeartPulse, LogOut, CreditCard, User } from 'lucide-react';
import { PlatformLogo } from '@/components/branding/platform-logo';
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
import { useClinicStore } from '@/stores/clinic-store';
import { usePermissions } from '@/hooks/use-permissions';
import { formatRoleName } from '@/lib/utils';
import { fullName } from '@/lib/person-name';

export default function SelectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, hydrate: hydrateAuth, _hydrated: authHydrated, logout, fetchMe } = useAuthStore();
  const { hydrate: hydrateClinic } = useClinicStore();
  const { isAdmin } = usePermissions();

  useEffect(() => {
    hydrateAuth();
    hydrateClinic();
  }, [hydrateAuth, hydrateClinic]);

  useEffect(() => {
    if (authHydrated && user && !user.role) {
      fetchMe();
    }
  }, [authHydrated, user, fetchMe]);

  if (!authHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase()
    : 'U';

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header — matches code.html top bar */}
      <header className="sticky top-0 z-30 flex h-20 items-center justify-between bg-background/80 backdrop-blur-xl px-8">
        <div className="flex items-center gap-3">
          <PlatformLogo
            variant="light"
            alt={process.env.NEXT_PUBLIC_APP_NAME || 'Hospital ERP'}
            className="h-11 w-auto max-w-[210px] object-contain"
            fallback={
              <>
                <div className="min-w-[40px] h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <HeartPulse className="h-5 w-5 text-primary" />
                </div>
                <h1 className="font-headline font-bold text-xl text-primary tracking-tight">
                  {process.env.NEXT_PUBLIC_APP_NAME || 'Hospital ERP'}
                </h1>
              </>
            }
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="h-8 w-[1px] bg-outline-variant/30 hidden sm:block" />
          <div className="text-right text-sm hidden sm:block">
            <p className="font-label text-xs font-semibold text-on-surface">{user ? fullName(user) : 'User'}</p>
            <p className="font-label text-[10px] text-on-surface-variant capitalize">{user?.role?.name ? formatRoleName(user.role.name) : ''}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="relative focus:outline-none">
              <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-sm">
                {initials}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-headline font-semibold leading-none">
                      {user ? fullName(user) : 'User'}
                    </p>
                    <p className="text-xs font-label leading-none text-on-surface-variant">
                      {user?.email || ''}
                    </p>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
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

      <main className="relative z-10 flex-1 px-8 py-6">
        {children}
      </main>
    </div>
  );
}
