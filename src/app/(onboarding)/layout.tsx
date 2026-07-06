'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, LogOut, Building2, User } from 'lucide-react';
import { PlatformLogo } from '@/components/branding/platform-logo';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { hydrate, _hydrated, isAuthenticated, user, logout } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!_hydrated) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    // Super admin == tenant owner — never goes through onboarding
    const roleSlug = user?.role?.slug || user?.roles?.[0];
    if (roleSlug === 'super_admin') {
      router.replace('/super-admin');
    }
  }, [_hydrated, isAuthenticated, user, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (!_hydrated || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-50 via-background to-teal-50 overflow-hidden">
      {/* Background pattern */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(0,191,165,0.08)_0%,transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(59,130,246,0.06)_0%,transparent_50%)]" />

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/60 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <PlatformLogo
            variant="light"
            alt="Hospital ERP"
            className="h-9 w-auto max-w-[190px] object-contain"
            fallback={
              <>
                <Activity className="h-6 w-6 text-primary" />
                <span className="text-lg font-bold text-foreground">Hospital ERP</span>
              </>
            }
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:block">
            Welcome, <span className="font-medium text-foreground">{user?.firstName} {user?.lastName}</span>
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger className="relative h-9 w-9 rounded-full focus:outline-none">
              <Avatar className="h-9 w-9 ring-2 ring-primary/20 hover:ring-primary/40 transition-all">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {`${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user ? `${user.firstName} ${user.lastName}` : 'User'}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email || ''}
                    </p>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => router.push('/my-hospitals')}>
                  <Building2 className="mr-2 h-4 w-4" />
                  <span>My Hospitals</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/select-hospital')}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Switch Hospital</span>
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

      {/* Content */}
      <main className="relative z-10 mx-auto max-w-6xl px-6 py-10">
        {children}
      </main>
    </div>
  );
}
