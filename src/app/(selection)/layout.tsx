'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/auth-store';
import { useClinicStore } from '@/stores/clinic-store';
import { useModuleStore } from '@/stores/module-store';
import { formatRoleName } from '@/lib/utils';

export default function SelectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, hydrate: hydrateAuth, _hydrated: authHydrated, logout, fetchMe } = useAuthStore();
  const { hydrate: hydrateClinic } = useClinicStore();
  const { hydrate: hydrateModule } = useModuleStore();

  useEffect(() => {
    hydrateAuth();
    hydrateClinic();
    hydrateModule();
  }, [hydrateAuth, hydrateClinic, hydrateModule]);

  // Refresh user data from backend to get latest role & tenant
  useEffect(() => {
    if (authHydrated && user && !user.role) {
      fetchMe();
    }
  }, [authHydrated, user, fetchMe]);

  if (!authHydrated) {
    return (
      <div className="flex h-screen items-center justify-center">
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
      {/* Teal header bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-primary px-6 text-primary-foreground shadow-sm">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6" />
          <span className="text-lg font-bold">
            {process.env.NEXT_PUBLIC_APP_NAME || 'Hospital ERP'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right text-sm hidden sm:block">
            <p className="font-medium">{user ? `${user.firstName} ${user.lastName}` : 'User'}</p>
            <p className="text-xs opacity-80">{user?.role?.name ? formatRoleName(user.role.name) : ''}</p>
          </div>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-white/20 text-primary-foreground text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-white/10"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main content — centered */}
      <main className="flex-1 px-4 py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}
