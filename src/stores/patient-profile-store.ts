import { create } from 'zustand';
import { apiGet } from '@/lib/api';

export interface PatientProfile {
  id: string;
  mrn: string;
  firstName: string;
  lastName?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  relationship: 'self' | 'spouse' | 'child' | 'parent' | 'sibling' | 'guardian' | 'other';
  isSelf?: boolean;
  tenantId: string;
  tenant?: { id: string; name: string; slug: string; logoUrl?: string | null } | null;
  /**
   * Other hospitals holding a record for this same person.
   *
   * One profile now stands for the person rather than for a single hospital's
   * row, so this is how the entry can still say they are known elsewhere.
   * Optional: a response from before this existed simply omits it.
   */
  alsoAt?: Array<{ id: string; name: string }> | null;
}

const STORAGE_KEY = 'selectedPatientProfileId';

function loadSelectedId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistSelectedId(id: string | null) {
  if (typeof window === 'undefined') return;
  if (id) localStorage.setItem(STORAGE_KEY, id);
  else localStorage.removeItem(STORAGE_KEY);
}

interface PatientProfileState {
  profiles: PatientProfile[];
  selectedProfileId: string | null;
  isLoading: boolean;
  _hydrated: boolean;

  hydrate: () => void;
  fetchProfiles: () => Promise<void>;
  selectProfile: (id: string | null) => void;
  clear: () => void;
}

export const usePatientProfileStore = create<PatientProfileState>((set, get) => ({
  profiles: [],
  selectedProfileId: null,
  isLoading: false,
  _hydrated: false,

  hydrate: () => {
    if (get()._hydrated) return;
    set({ selectedProfileId: loadSelectedId(), _hydrated: true });
  },

  fetchProfiles: async () => {
    set({ isLoading: true });
    try {
      const resp = await apiGet<PatientProfile[]>('/patient-portal/profiles');
      const profiles = resp.data ?? [];
      let selected = get().selectedProfileId;
      // If stored selection is no longer valid, default to the 'self' profile (or first).
      if (!selected || !profiles.find((p) => p.id === selected)) {
        const self = profiles.find((p) => p.isSelf) ?? profiles[0] ?? null;
        selected = self?.id ?? null;
        persistSelectedId(selected);
      }
      set({ profiles, selectedProfileId: selected, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  selectProfile: (id) => {
    persistSelectedId(id);
    set({ selectedProfileId: id });
  },

  clear: () => {
    persistSelectedId(null);
    set({ profiles: [], selectedProfileId: null });
  },
}));
