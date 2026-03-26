'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SuperAdminSidebar } from '@/components/layout/super-admin-sidebar';
import { SuperAdminHeader } from '@/components/layout/super-admin-header';
import { useAuthStore } from '@/stores/auth-store';
import { useSidebarStore } from '@/stores/sidebar-store';

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { hydrate, _hydrated, isAuthenticated, user, fetchMe } = useAuthStore();
  const { isPinned } = useSidebarStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

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
    const roleSlug = user?.role?.slug || user?.roles?.[0];
    if (roleSlug !== 'super_admin') {
      router.push('/select-hospital');
    }
  }, [_hydrated, isAuthenticated, user, router]);

  if (!_hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const roleSlug = user?.role?.slug || user?.roles?.[0];
  if (!isAuthenticated || roleSlug !== 'super_admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <SuperAdminSidebar />
      <div className={`flex flex-col min-h-screen transition-all duration-300 ${isPinned ? 'ml-64' : 'ml-20'}`}>
        <SuperAdminHeader />
        <main className="flex-1 overflow-y-auto p-8 pt-4 sanctuary-scrollbar">
          <div className="animate-fade-in-up">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
