'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useClinicStore } from '@/stores/clinic-store';
import { useAuthStore } from '@/stores/auth-store';
import { useModuleStore } from '@/stores/module-store';
import { ClinicCard } from '@/components/selection/clinic-card';
import { getAutoRouteForRole, getModulesForRole } from '@/config/role-modules';
import type { ModuleKey } from '@/stores/module-store';
import type { Tenant } from '@/types';

export default function SelectClinicPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { clinics, selectedClinic, isLoading, fetchClinics, selectClinic } = useClinicStore();
  const { setModule } = useModuleStore();

  useEffect(() => {
    fetchClinics();
  }, [fetchClinics]);

  // After clinic selection, route based on role
  const navigateAfterClinic = () => {
    const roleSlug = user?.role?.slug;
    const autoRoute = getAutoRouteForRole(roleSlug);
    if (autoRoute) {
      // Auto-set module for single-module roles (e.g. doctor)
      const modules = getModulesForRole(roleSlug);
      if (modules.length === 1) {
        setModule(modules[0] as ModuleKey);
      }
      router.push(autoRoute);
    } else {
      router.push('/select-module');
    }
  };

  const handleSelect = (clinic: Tenant) => {
    selectClinic(clinic);
    navigateAfterClinic();
  };

  // If user has only one tenant, auto-select it
  useEffect(() => {
    if (!isLoading && clinics.length === 1 && !selectedClinic) {
      selectClinic(clinics[0]);
      navigateAfterClinic();
    }
  }, [isLoading, clinics, selectedClinic, selectClinic, router]);

  // Also auto-select from user's tenant if no clinics API available
  useEffect(() => {
    if (!isLoading && clinics.length === 0 && user?.tenant && !selectedClinic) {
      selectClinic(user.tenant as Tenant);
      navigateAfterClinic();
    }
  }, [isLoading, clinics, user, selectedClinic, selectClinic, router]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-foreground">Select Clinic</h1>
        <p className="mt-2 text-muted-foreground">
          Choose a clinic to continue
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : clinics.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clinics.map((clinic) => (
            <ClinicCard
              key={clinic.id}
              clinic={clinic}
              isSelected={selectedClinic?.id === clinic.id}
              onClick={() => handleSelect(clinic)}
            />
          ))}
        </div>
      ) : user?.tenant ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ClinicCard
            clinic={user.tenant as Tenant}
            isSelected={selectedClinic?.id === user.tenant.id}
            onClick={() => handleSelect(user.tenant as Tenant)}
          />
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground">
          No clinics available. Please contact your administrator.
        </div>
      )}
    </div>
  );
}
