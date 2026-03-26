'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ModuleSidebar } from '@/components/layout/module-sidebar';
import { ModuleHeader } from '@/components/layout/module-header';
import { useAuthStore } from '@/stores/auth-store';
import { useClinicStore } from '@/stores/clinic-store';
import { useSidebarStore } from '@/stores/sidebar-store';

export default function ModulesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { hydrate: hydrateAuth, _hydrated: authHydrated, isAuthenticated, user, fetchMe } = useAuthStore();
  const { hydrate: hydrateClinic, selectedClinic, _hydrated: clinicHydrated } = useClinicStore();
  const isPinned = useSidebarStore((s) => s.isPinned);

  useEffect(() => {
    hydrateAuth();
    hydrateClinic();
  }, [hydrateAuth, hydrateClinic]);

  useEffect(() => {
    if (authHydrated && user && !user.role) {
      fetchMe();
    }
  }, [authHydrated, user, fetchMe]);

  const allHydrated = authHydrated && clinicHydrated;

  useEffect(() => {
    if (!allHydrated) return;
    if (!isAuthenticated) {
      router.push('/login');
    } else if (!selectedClinic) {
      router.push('/select-hospital');
    }
  }, [allHydrated, isAuthenticated, selectedClinic, router]);

  if (!allHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || !selectedClinic) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <ModuleSidebar />

      {/* Main content — offset by sidebar width: ml-20 (collapsed) or ml-64 (pinned) */}
      <div className={`transition-all duration-300 ${isPinned ? 'lg:ml-64' : 'lg:ml-20'}`}>
        <ModuleHeader />
        <main className="p-8 pt-4 sanctuary-scrollbar">
          <div className="animate-fade-in-up">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
