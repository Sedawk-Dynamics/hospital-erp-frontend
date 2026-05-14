import { create } from 'zustand';

export type ModuleKey =
  | 'hospital'
  | 'laboratory'
  | 'radiology'
  | 'pharmacy'
  | 'inventory'
  | 'ot'
  | 'counsellor'
  | 'daycare'
  | 'ward'
  | 'doctor'
  | 'nurse'
  | 'nurse-admin';

function loadPersistedModule(): ModuleKey | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('activeModule');
    return raw as ModuleKey | null;
  } catch {
    return null;
  }
}

function persistModule(moduleKey: ModuleKey | null) {
  if (typeof window === 'undefined') return;
  if (moduleKey) {
    localStorage.setItem('activeModule', moduleKey);
  } else {
    localStorage.removeItem('activeModule');
  }
}

interface ModuleState {
  activeModule: ModuleKey | null;
  _hydrated: boolean;

  hydrate: () => void;
  setModule: (moduleKey: ModuleKey) => void;
  clearModule: () => void;
}

export const useModuleStore = create<ModuleState>((set, get) => ({
  activeModule: null,
  _hydrated: false,

  hydrate: () => {
    if (get()._hydrated) return;
    const moduleKey = loadPersistedModule();
    set({ activeModule: moduleKey, _hydrated: true });
  },

  setModule: (moduleKey: ModuleKey) => {
    persistModule(moduleKey);
    set({ activeModule: moduleKey });
  },

  clearModule: () => {
    persistModule(null);
    set({ activeModule: null });
  },
}));
