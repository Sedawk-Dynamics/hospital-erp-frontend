'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ModuleSidebar } from '@/components/layout/module-sidebar';
import { ModuleHeader } from '@/components/layout/module-header';
import { useAuthStore } from '@/stores/auth-store';
import { useClinicStore } from '@/stores/clinic-store';
import { useModuleStore } from '@/stores/module-store';

export default function ModulesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { hydrate: hydrateAuth, _hydrated: authHydrated, isAuthenticated, user, fetchMe } = useAuthStore();
  const { hydrate: hydrateClinic, selectedClinic, _hydrated: clinicHydrated } = useClinicStore();
  const { hydrate: hydrateModule, activeModule, _hydrated: moduleHydrated } = useModuleStore();

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

  const allHydrated = authHydrated && clinicHydrated && moduleHydrated;

  useEffect(() => {
    if (!allHydrated) return;
    if (!isAuthenticated) {
      router.push('/login');
    } else if (!selectedClinic) {
      router.push('/select-clinic');
    } else if (!activeModule) {
      router.push('/select-module');
    }
  }, [allHydrated, isAuthenticated, selectedClinic, activeModule, router]);

  if (!allHydrated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || !selectedClinic || !activeModule) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <ModuleSidebar />
      <div className="flex flex-1 flex-col overflow-hidden transition-all duration-300">
        <ModuleHeader />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
