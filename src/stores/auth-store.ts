import { create } from 'zustand';
import apiClient from '@/lib/api-client';
import { setTokens, clearTokens, getAccessToken, getRefreshToken } from '@/lib/api';
import type { User, RegisterData, SwitchHospitalResponse } from '@/types';

// ============================================================
// Hydrate persisted user from localStorage on store creation
// ============================================================

function loadPersistedUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function persistUser(user: User | null) {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  } else {
    localStorage.removeItem('user');
  }
}

// ============================================================
// Auth Store
// ============================================================

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  _hydrated: boolean;
  onboardingStatus: string | null;

  hydrate: () => void;
  login: (email: string, password: string) => Promise<string | undefined>;
  requestPhoneOtp: (phone: string) => Promise<{ isExistingUser: boolean }>;
  loginWithPhoneOtp: (input: {
    phone: string;
    otp: string;
    firstName?: string;
    lastName?: string;
    gender?: 'male' | 'female' | 'other';
    dateOfBirth?: string;
  }) => Promise<string | undefined>;
  switchHospital: (tenantId: string) => Promise<SwitchHospitalResponse>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  fetchMe: () => Promise<void>;
  setUser: (user: User | null) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Always start with null — SSR-safe (no localStorage on server)
  user: null,
  isAuthenticated: false,
  isLoading: true,
  _hydrated: false,
  onboardingStatus: null,

  // Call once from a client-side useEffect to load persisted user
  hydrate: () => {
    if (get()._hydrated) return;
    const user = loadPersistedUser();
    const token = getAccessToken();
    set({
      user,
      isAuthenticated: !!user && !!token,
      isLoading: false,
      _hydrated: true,
    });
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const { data } = await apiClient.post('/auth/login', {
        email,
        password,
      });
      const { accessToken, refreshToken, user, onboardingStatus } = data.data;
      setTokens(accessToken, refreshToken);
      persistUser(user);
      set({ user, isAuthenticated: true, isLoading: false, onboardingStatus: onboardingStatus || null });
      return onboardingStatus as string | undefined;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  // Ask the backend to "send" an OTP to a phone (fixed dev code for now).
  // Returns whether the number already has an account, so the UI knows if it
  // must collect a name for a new patient.
  requestPhoneOtp: async (phone: string) => {
    const { data } = await apiClient.post('/auth/otp/request', { phone });
    return { isExistingUser: !!data.data?.isExistingUser };
  },

  // Verify the OTP and log the patient in (creating the account if new).
  loginWithPhoneOtp: async (input) => {
    set({ isLoading: true });
    try {
      const { data } = await apiClient.post('/auth/otp/verify', input);
      const { accessToken, refreshToken, user, onboardingStatus } = data.data;
      setTokens(accessToken, refreshToken);
      persistUser(user);
      set({ user, isAuthenticated: true, isLoading: false, onboardingStatus: onboardingStatus || null });
      return onboardingStatus as string | undefined;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  switchHospital: async (tenantId: string) => {
    const { data } = await apiClient.post(`/hospitals/switch/${tenantId}`);
    const result = data.data as SwitchHospitalResponse;
    setTokens(result.accessToken, result.refreshToken);
    persistUser(result.user);
    set({ user: result.user, isAuthenticated: true });
    return result;
  },

  register: async (data: RegisterData) => {
    set({ isLoading: true });
    try {
      await apiClient.post('/auth/register', data);
      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore logout API errors
    } finally {
      clearTokens();
      persistUser(null);
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  refreshToken: async () => {
    try {
      const currentRefreshToken = getRefreshToken();
      if (!currentRefreshToken) throw new Error('No refresh token');
      const { data } = await apiClient.post('/auth/refresh', {
        refreshToken: currentRefreshToken,
      });
      setTokens(data.data.accessToken, data.data.refreshToken);
    } catch {
      clearTokens();
      persistUser(null);
      set({ user: null, isAuthenticated: false, isLoading: false });
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
  },

  fetchMe: async () => {
    set({ isLoading: true });
    try {
      const token = getAccessToken();
      if (!token) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }
      const { data } = await apiClient.get('/auth/me');
      const user = data.data;
      persistUser(user);
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      clearTokens();
      persistUser(null);
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  setUser: (user: User | null) => {
    persistUser(user);
    set({ user, isAuthenticated: !!user });
  },

  reset: () => {
    clearTokens();
    persistUser(null);
    set({ user: null, isAuthenticated: false, isLoading: false });
  },
}));
