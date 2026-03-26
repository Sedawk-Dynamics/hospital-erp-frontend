import { create } from 'zustand';
import apiClient from '@/lib/api-client';
import type { Tenant, MyHospital } from '@/types';

function loadPersistedClinic(): Tenant | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('selectedClinic');
    return raw ? (JSON.parse(raw) as Tenant) : null;
  } catch {
    return null;
  }
}

function persistClinic(clinic: Tenant | null) {
  if (typeof window === 'undefined') return;
  if (clinic) {
    localStorage.setItem('selectedClinic', JSON.stringify(clinic));
  } else {
    localStorage.removeItem('selectedClinic');
  }
}

interface ClinicState {
  clinics: Tenant[];
  selectedClinic: Tenant | null;
  isLoading: boolean;
  _hydrated: boolean;

  hydrate: () => void;
  fetchClinics: () => Promise<void>;
  fetchMyHospitals: () => Promise<void>;
  selectClinic: (clinic: Tenant) => void;
  clearClinic: () => void;
}

export const useClinicStore = create<ClinicState>((set, get) => ({
  clinics: [],
  selectedClinic: null,
  isLoading: false,
  _hydrated: false,

  hydrate: () => {
    if (get()._hydrated) return;
    const clinic = loadPersistedClinic();
    set({ selectedClinic: clinic, _hydrated: true });
  },

  fetchClinics: async () => {
    set({ isLoading: true });
    try {
      const { data } = await apiClient.get('/tenants');
      const clinics = data.data ?? data;
      set({ clinics: Array.isArray(clinics) ? clinics : [], isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchMyHospitals: async () => {
    set({ isLoading: true });
    try {
      const { data } = await apiClient.get('/hospitals/my');
      const hospitals: MyHospital[] = data.data ?? data;
      // Map MyHospital to Tenant shape for compatibility
      const clinics: Tenant[] = (Array.isArray(hospitals) ? hospitals : []).map((h) => ({
        id: h.id,
        name: h.name,
        slug: h.slug,
        hospitalCode: h.hospitalCode ?? undefined,
        logo: h.logoUrl ?? undefined,
        address: h.address ?? undefined,
        phone: h.phone ?? undefined,
        email: h.email ?? undefined,
        isActive: h.isActive,
        createdAt: h.createdAt,
        updatedAt: h.updatedAt,
      }));
      set({ clinics, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  selectClinic: (clinic: Tenant) => {
    persistClinic(clinic);
    set({ selectedClinic: clinic });
  },

  clearClinic: () => {
    persistClinic(null);
    set({ selectedClinic: null });
  },
}));
