'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Building2, Plus, MapPin, Mail, Phone, Calendar, ArrowRight,
  Check, Search, ArrowLeft,
} from 'lucide-react';
import { useClinicStore } from '@/stores/clinic-store';
import { useAuthStore } from '@/stores/auth-store';
import { useHospitalLimit } from '@/hooks/use-hospitals';
import { useMySubscription } from '@/hooks/use-subscriptions';
import { getAutoRouteForRole } from '@/config/role-modules';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import type { Tenant } from '@/types';

export default function SelectHospitalPage() {
  const router = useRouter();
  const { user, switchHospital } = useAuthStore();
  const { clinics, selectedClinic, isLoading, fetchClinics, fetchMyHospitals, selectClinic } = useClinicStore();
  const { data: limit } = useHospitalLimit();
  const { data: subData, isLoading: subLoading } = useMySubscription();
  const [isSwitching, setIsSwitching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const switchingRef = useRef(false);

  const roleSlug = user?.role?.slug || user?.roles?.[0];
  const roleName = user?.role?.name || '';
  const isSuperAdmin = roleSlug === 'super_admin' || roleName === 'super_admin';
  const isAdmin = roleSlug === 'admin' || roleName === 'admin';
  const isHospitalOwner = isAdmin;

  // Redirect to subscription-expired if no active subscription (admin/owner only)
  const hasActiveSubscription = subData?.active ?? true; // default true while loading
  useEffect(() => {
    if (!subLoading && !isSuperAdmin && isHospitalOwner && !hasActiveSubscription) {
      router.replace('/subscription-expired');
    }
  }, [subLoading, isSuperAdmin, isHospitalOwner, hasActiveSubscription, router]);

  // Super admin doesn't depend on any hospital — route straight to super admin panel
  useEffect(() => {
    if (isSuperAdmin) {
      router.replace('/super-admin');
    }
  }, [isSuperAdmin, router]);

  const canCreateRole = isAdmin;
  const canCreate = canCreateRole && (limit?.canCreate ?? true);
  const limitLabel = limit
    ? limit.max !== null
      ? `${limit.current}/${limit.max} hospitals`
      : null
    : null;

  useEffect(() => {
    if (isHospitalOwner) {
      fetchMyHospitals();
    } else {
      fetchClinics();
    }
  }, [isHospitalOwner, fetchClinics, fetchMyHospitals]);

  const navigateAfterClinic = useCallback(() => {
    const currentUser = useAuthStore.getState().user;
    const currentRole = currentUser?.role?.slug || currentUser?.roles?.[0] || roleSlug;
    const autoRoute = getAutoRouteForRole(currentRole) || '/hospital';
    router.push(autoRoute);
  }, [roleSlug, router]);

  const handleSelect = useCallback(async (clinic: Tenant) => {
    if (switchingRef.current) return;

    // Block hospital access if subscription is not active
    if (isHospitalOwner && !hasActiveSubscription) {
      router.replace('/subscription-expired');
      return;
    }

    if (isHospitalOwner) {
      switchingRef.current = true;
      setIsSwitching(true);
      try {
        const result = await switchHospital(clinic.id);
        const tenantFromSwitch: Tenant = {
          id: result.tenant.id,
          name: result.tenant.name,
          slug: result.tenant.slug,
          hospitalCode: result.tenant.hospitalCode,
          logo: result.tenant.logo,
          address: result.tenant.address,
          phone: result.tenant.phone,
          email: result.tenant.email,
          isActive: result.tenant.isActive,
          createdAt: result.tenant.createdAt,
          updatedAt: result.tenant.updatedAt,
        };
        selectClinic(tenantFromSwitch);
        navigateAfterClinic();
      } catch (error: unknown) {
        switchingRef.current = false;
        const message =
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to switch hospital. Please try again.';
        // Redirect to subscription-expired page if backend rejects
        if (message === 'SUBSCRIPTION_EXPIRED') {
          router.replace('/subscription-expired');
          return;
        }
        toast.error(message);
      } finally {
        setIsSwitching(false);
      }
    } else {
      selectClinic(clinic);
      navigateAfterClinic();
    }
  }, [isHospitalOwner, hasActiveSubscription, switchHospital, selectClinic, navigateAfterClinic, router]);

  useEffect(() => {
    if (!isLoading && clinics.length === 1 && !selectedClinic && !isSwitching && !switchingRef.current) {
      handleSelect(clinics[0]);
    }
  }, [isLoading, clinics, selectedClinic, isSwitching, handleSelect]);

  useEffect(() => {
    if (!isHospitalOwner && !isLoading && clinics.length === 0 && user?.tenant && !selectedClinic) {
      selectClinic(user.tenant as Tenant);
      navigateAfterClinic();
    }
  }, [isHospitalOwner, isLoading, clinics, user, selectedClinic, selectClinic, navigateAfterClinic]);

  const filtered = searchQuery.trim()
    ? clinics.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.slug?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.city?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : clinics;

  const showLoading = isLoading || isSwitching;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in-up">
        <div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-surface-container-low transition-colors">
              <ArrowLeft className="h-5 w-5 text-on-surface-variant" />
            </button>
            <h1 className="font-headline text-2xl font-extrabold">My Hospitals</h1>
            {limitLabel && (
              <span className="text-[10px] font-bold px-2 py-0.5 bg-secondary/10 text-secondary rounded-full font-label">{limitLabel}</span>
            )}
          </div>
          <p className="mt-1 font-label text-sm text-on-surface-variant">
            {canCreateRole ? 'Select a hospital to manage, or create a new one' : 'Select a hospital to continue'}
          </p>
        </div>
        {/* Hospital creation is handled by super admin via demo request approval */}
      </div>

      {/* Search */}
      {clinics.length > 3 && (
        <div className="relative max-w-sm mb-6 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
          <input
            placeholder="Search hospitals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-surface-container-low border-none rounded-xl pl-12 pr-6 py-2.5 w-full font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
          />
        </div>
      )}

      {/* Loading */}
      {showLoading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          {isSwitching && (
            <p className="font-label text-sm text-on-surface-variant">Switching hospital...</p>
          )}
        </div>
      )}

      {/* Empty state */}
      {!showLoading && filtered.length === 0 && clinics.length === 0 && !user?.tenant && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-16 text-center animate-fade-in-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface-container-high text-on-surface-variant mb-4">
            <Building2 className="h-8 w-8" />
          </div>
          <h3 className="font-headline text-lg font-bold mb-2">No hospitals yet</h3>
          <p className="font-label text-sm text-on-surface-variant mb-6 max-w-md mx-auto">
            Your account doesn&apos;t have any hospitals assigned yet. Please contact your administrator or book a demo to get started.
          </p>
          <Link href="/contact">
            <button className="bg-primary text-on-primary font-label font-bold text-sm px-6 py-2.5 rounded-xl hover:shadow-lg transition-shadow inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Book a Free Demo
            </button>
          </Link>
        </div>
      )}

      {/* No search results */}
      {!showLoading && filtered.length === 0 && clinics.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-12 text-center animate-fade-in-up">
          <p className="font-label text-on-surface-variant">No hospitals matching &quot;{searchQuery}&quot;</p>
        </div>
      )}

      {/* Hospital Grid */}
      {!showLoading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((clinic, index) => {
            const isSelected = selectedClinic?.id === clinic.id;
            return (
              <button
                key={clinic.id}
                onClick={() => handleSelect(clinic)}
                className={cn(
                  'group relative flex flex-col text-left bg-surface-container-lowest rounded-xl shadow-sanctuary p-6 transition-all duration-300 animate-fade-in-up',
                  'hover:-translate-y-1 hover:shadow-lg',
                  isSelected && 'ring-2 ring-primary/30'
                )}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                {/* Selected indicator */}
                {isSelected && (
                  <div className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                    <Check className="h-3.5 w-3.5 text-on-primary" />
                  </div>
                )}

                {/* Header row */}
                <div className="flex items-start gap-3 mb-3">
                  <div className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-xl shrink-0 transition-all duration-200',
                    isSelected ? 'bg-primary/10' : 'bg-surface-container-high'
                  )}>
                    <Building2 className={cn('h-5 w-5', isSelected ? 'text-primary' : 'text-on-surface-variant')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-label text-sm font-bold truncate">{clinic.name}</p>
                    <div className="flex items-center gap-2">
                      <p className="font-label text-[10px] text-on-surface-variant font-mono truncate">{clinic.slug}</p>
                      {clinic.hospitalCode && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-mono tracking-wider">
                          {clinic.hospitalCode}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status badge */}
                <div className="mb-3">
                  <span className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full',
                    clinic.isActive ? 'bg-primary/10 text-primary' : 'bg-error-container text-on-error-container'
                  )}>
                    {clinic.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-1.5 font-label text-xs text-on-surface-variant flex-1">
                  {clinic.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate">{clinic.email}</span>
                    </div>
                  )}
                  {clinic.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span>{clinic.phone}</span>
                    </div>
                  )}
                  {(clinic.city || clinic.state || clinic.address) && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {[clinic.city, clinic.state].filter(Boolean).join(', ') || clinic.address}
                      </span>
                    </div>
                  )}
                  {clinic.createdAt && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3 shrink-0" />
                      <span>Created {formatDate(clinic.createdAt)}</span>
                    </div>
                  )}
                </div>

                {/* Enter button */}
                <div className="mt-4 pt-3 border-t border-surface-container">
                  <div className={cn(
                    'flex items-center justify-center gap-2 rounded-xl py-2 font-label text-sm font-bold transition-all duration-200',
                    isSelected
                      ? 'bg-primary text-on-primary shadow-lg'
                      : 'bg-surface-container-low text-on-surface-variant group-hover:bg-primary/10 group-hover:text-primary'
                  )}>
                    {isSelected ? 'Selected' : 'Enter'}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Fallback for staff with tenant */}
      {!showLoading && filtered.length === 0 && clinics.length === 0 && user?.tenant && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <button
            onClick={() => handleSelect(user.tenant as Tenant)}
            className="group flex flex-col text-left bg-surface-container-lowest rounded-xl shadow-sanctuary p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg animate-fade-in-up"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-high shrink-0">
                <Building2 className="h-5 w-5 text-on-surface-variant" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-label text-sm font-bold truncate">{(user.tenant as Tenant).name}</p>
              </div>
            </div>
            <div className="mt-auto pt-3 border-t border-surface-container">
              <div className="flex items-center justify-center gap-2 rounded-xl py-2 font-label text-sm font-bold bg-surface-container-low text-on-surface-variant group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                Enter
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Plan limit warning */}
      {!canCreate && clinics.length > 0 && (
        <p className="font-label text-xs text-on-surface-variant text-center mt-6 animate-fade-in-up">
          Hospital limit reached. Contact your administrator to upgrade your plan.
        </p>
      )}
    </div>
  );
}
