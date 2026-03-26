import { create } from 'zustand';

interface SidebarState {
  isOpen: boolean;
  isCollapsed: boolean;
  isPinned: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  toggleCollapse: () => void;
  togglePin: () => void;
}

// Read initial pinned state from localStorage
const getInitialPinned = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem('sidebar-pinned') === 'true';
  } catch {
    return false;
  }
};

export const useSidebarStore = create<SidebarState>((set) => ({
  isOpen: false,
  isCollapsed: false,
  isPinned: getInitialPinned(),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggleCollapse: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
  togglePin: () =>
    set((state) => {
      const next = !state.isPinned;
      try {
        localStorage.setItem('sidebar-pinned', String(next));
      } catch { /* ignore */ }
      return { isPinned: next };
    }),
}));
