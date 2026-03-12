'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SuperAdminSidebar } from '@/components/layout/super-admin-sidebar';
import { SuperAdminHeader } from '@/components/layout/super-admin-header';
import { useAuthStore } from '@/stores/auth-store';

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { hydrate, _hydrated, isAuthenticated, user, fetchMe } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Refresh user data from backend to get latest role
  useEffect(() => {
    if (_hydrated && user && !user.role) {
      fetchMe();
    }
  }, [_hydrated, user, fetchMe]);

  useEffect(() => {
    if (!_hydrated) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    // Guard: only super_admin can access this layout
    const roleSlug = user?.role?.slug || user?.roles?.[0];
    if (roleSlug !== 'super_admin') {
      router.push('/select-clinic');
    }
  }, [_hydrated, isAuthenticated, user, router]);

  if (!_hydrated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const roleSlug = user?.role?.slug || user?.roles?.[0];
  if (!isAuthenticated || roleSlug !== 'super_admin') {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <SuperAdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden transition-all duration-300">
        <SuperAdminHeader />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
