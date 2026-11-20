'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { MODULE_REGISTRY, getModuleFromPathname } from '@/config/modules';
import { canOpenModule, getAutoRouteForRole } from '@/config/role-modules';
import { ModuleSidebar } from '@/components/layout/module-sidebar';
import { ModuleHeader } from '@/components/layout/module-header';
import { SupportAssistantWidget } from '@/components/ai/support-assistant-widget';
import { useAuthStore } from '@/stores/auth-store';
import { useClinicStore } from '@/stores/clinic-store';
import { useSidebarStore } from '@/stores/sidebar-store';

export default function ModulesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
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

  // Gap 178/179: the sidebar hid the Counsellor portal from Front Desk, but the
  // URL still rendered it with its session data. Check the role before any
  // page (and its queries) mounts. On a restricted portal, wait for /auth/me
  // when the stored user has no role yet, rather than deciding on a missing one.
  const currentModule = getModuleFromPathname(pathname);
  const roleSlug = user?.role?.slug;
  if (currentModule && !roleSlug && user && !canOpenModule(undefined, currentModule)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  const denied = !!currentModule && !canOpenModule(roleSlug, currentModule);
  const homeRoute = denied ? getAutoRouteForRole(roleSlug) : null;

  return (
    <div className="min-h-screen bg-background">
      <ModuleSidebar />

      {/* Main content — offset by sidebar width: ml-20 (collapsed) or ml-64 (pinned) */}
      <div className={`transition-all duration-300 ${isPinned ? 'lg:ml-64' : 'lg:ml-20'}`}>
        <ModuleHeader />
        <main className="p-8 pt-4 sanctuary-scrollbar">
          <div className="animate-fade-in-up">
            {denied && currentModule ? (
              <EmptyState
                icon={ShieldOff}
                title="You don't have access to this page"
                description={`The ${MODULE_REGISTRY[currentModule].label} portal is not available to your role. Ask a hospital administrator if you need access.`}
                action={
                  homeRoute && homeRoute !== MODULE_REGISTRY[currentModule].baseRoute ? (
                    <Button nativeButton={false} render={<Link href={homeRoute} />}>Go to my portal</Button>
                  ) : undefined
                }
              />
            ) : (
              children
            )}
          </div>
        </main>
      </div>

      {/* UC3: global read-only support assistant (self-hides when disabled) */}
      <SupportAssistantWidget />
    </div>
  );
}
