'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { useClinicStore } from '@/stores/clinic-store';
import { useAuthStore } from '@/stores/auth-store';
import { useModuleStore } from '@/stores/module-store';
import { MODULE_REGISTRY } from '@/config/modules';
import { ModuleCard } from '@/components/selection/module-card';
import { getModulesForRole, getAutoRouteForRole } from '@/config/role-modules';
import type { ModuleKey } from '@/stores/module-store';

export default function SelectModulePage() {
  const router = useRouter();
  const { selectedClinic } = useClinicStore();
  const { user } = useAuthStore();
  const { setModule } = useModuleStore();

  const roleSlug = user?.role?.slug;
  const allowedModules = getModulesForRole(roleSlug);

  // If no clinic selected, redirect back
  if (!selectedClinic) {
    router.push('/select-clinic');
    return null;
  }

  // If role has auto-route (e.g. doctor), redirect immediately
  useEffect(() => {
    const autoRoute = getAutoRouteForRole(roleSlug);
    if (autoRoute) {
      const modules = getModulesForRole(roleSlug);
      if (modules.length === 1) {
        setModule(modules[0] as ModuleKey);
      }
      router.push(autoRoute);
    }
  }, [roleSlug, setModule, router]);

  const handleSelectModule = (moduleKey: ModuleKey) => {
    setModule(moduleKey);
    const moduleConfig = MODULE_REGISTRY[moduleKey];
    router.push(moduleConfig.baseRoute);
  };

  return (
    <div className="mx-auto max-w-5xl">
      {/* Selected clinic indicator */}
      <div className="mb-8 flex items-center justify-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Selected Clinic</p>
          <p className="font-semibold text-foreground">{selectedClinic.name}</p>
        </div>
        <button
          onClick={() => router.push('/select-clinic')}
          className="ml-4 text-sm text-primary hover:underline"
        >
          Change
        </button>
      </div>

      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-foreground">Select Module</h1>
        <p className="mt-2 text-muted-foreground">
          Choose a module to get started
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {allowedModules.map((key) => (
          <ModuleCard
            key={key}
            module={MODULE_REGISTRY[key]}
            onClick={() => handleSelectModule(key)}
          />
        ))}
      </div>
    </div>
  );
}
