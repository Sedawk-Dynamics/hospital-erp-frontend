import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '@/stores/auth-store';

// ─── Mock @/lib/api-client ───
const mockPost = vi.fn();
const mockGet = vi.fn();
vi.mock('@/lib/api-client', () => ({
  default: {
    post: (...args: unknown[]) => mockPost(...args),
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

// ─── Mock @/lib/api ───
const mockSetTokens = vi.fn();
const mockClearTokens = vi.fn();
const mockGetAccessToken = vi.fn();
const mockGetRefreshToken = vi.fn();
vi.mock('@/lib/api', () => ({
  setTokens: (...args: unknown[]) => mockSetTokens(...args),
  clearTokens: (...args: unknown[]) => mockClearTokens(...args),
  getAccessToken: (...args: unknown[]) => mockGetAccessToken(...args),
  getRefreshToken: (...args: unknown[]) => mockGetRefreshToken(...args),
}));

// ─── Helpers ───
const mockUser = {
  id: 'user-1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@hospital.com',
  isActive: true,
  emailVerified: true,
  role: { id: 'r1', name: 'Doctor', slug: 'doctor', permissions: [], tenantId: 't1', createdAt: '', updatedAt: '' },
  tenant: { id: 't1', name: 'Demo Hospital', slug: 'demo-hospital', isActive: true, createdAt: '', updatedAt: '' },
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

function resetStore() {
  // Reset zustand store to initial state by calling setState directly
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    _hydrated: false,
  });
}

describe('Auth Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetStore();
  });

  // ────────────────────────────────────────────────────────
  // Initial State
  // ────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('should be unauthenticated with no user', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(true);
      expect(state._hydrated).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────
  // hydrate()
  // ────────────────────────────────────────────────────────

  describe('hydrate()', () => {
    it('should load user from localStorage when token exists', () => {
      localStorage.setItem('user', JSON.stringify(mockUser));
      mockGetAccessToken.mockReturnValue('test-access-token');

      useAuthStore.getState().hydrate();

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state._hydrated).toBe(true);
    });

    it('should not set authenticated when no token', () => {
      localStorage.setItem('user', JSON.stringify(mockUser));
      mockGetAccessToken.mockReturnValue(null);

      useAuthStore.getState().hydrate();

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state._hydrated).toBe(true);
    });

    it('should only hydrate once', () => {
      mockGetAccessToken.mockReturnValue('test-token');

      useAuthStore.getState().hydrate();
      const firstState = useAuthStore.getState();
      expect(firstState._hydrated).toBe(true);

      // Modify state after first hydration
      useAuthStore.setState({ user: mockUser });

      // Second hydrate should be a no-op
      useAuthStore.getState().hydrate();
      const secondState = useAuthStore.getState();
      expect(secondState.user).toEqual(mockUser);
    });
  });

  // ────────────────────────────────────────────────────────
  // login()
  // ────────────────────────────────────────────────────────

  describe('login()', () => {
    it('should set user and tokens on success', async () => {
      mockPost.mockResolvedValue({
        data: {
          data: {
            accessToken: 'access-123',
            refreshToken: 'refresh-123',
            user: mockUser,
          },
        },
      });

      await useAuthStore.getState().login('john@hospital.com', 'password123');

      const state = useAuthStore.getState();
      expect(mockPost).toHaveBeenCalledWith('/auth/login', {
        email: 'john@hospital.com',
        password: 'password123',
      });
      expect(mockSetTokens).toHaveBeenCalledWith('access-123', 'refresh-123');
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      // Should also persist user to localStorage
      expect(localStorage.getItem('user')).toBe(JSON.stringify(mockUser));
    });

    it('should throw and set isLoading false on failure', async () => {
      const error = new Error('Invalid credentials');
      mockPost.mockRejectedValue(error);

      await expect(
        useAuthStore.getState().login('bad@email.com', 'wrong')
      ).rejects.toThrow('Invalid credentials');

      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────
  // register()
  // ────────────────────────────────────────────────────────

  describe('register()', () => {
    it('should call API without setting user', async () => {
      mockPost.mockResolvedValue({ data: { success: true } });

      const registerData = {
        tenantSlug: 'demo-hospital',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@hospital.com',
        phone: '1234567890',
        password: 'password123',
      };

      await useAuthStore.getState().register(registerData);

      expect(mockPost).toHaveBeenCalledWith('/auth/register', registerData);
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('should throw on failure and reset isLoading', async () => {
      const error = new Error('Registration failed');
      mockPost.mockRejectedValue(error);

      await expect(
        useAuthStore.getState().register({
          tenantSlug: 'demo',
          firstName: 'J',
          lastName: 'D',
          email: 'j@d.com',
          phone: '1234567890',
          password: 'pwd',
        })
      ).rejects.toThrow('Registration failed');

      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────
  // logout()
  // ────────────────────────────────────────────────────────

  describe('logout()', () => {
    it('should clear tokens and user', async () => {
      // Set up authenticated state first
      useAuthStore.setState({ user: mockUser, isAuthenticated: true });
      localStorage.setItem('user', JSON.stringify(mockUser));
      mockPost.mockResolvedValue({});

      await useAuthStore.getState().logout();

      expect(mockPost).toHaveBeenCalledWith('/auth/logout');
      expect(mockClearTokens).toHaveBeenCalled();
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(localStorage.getItem('user')).toBeNull();
    });

    it('should still clear local state even if API fails', async () => {
      useAuthStore.setState({ user: mockUser, isAuthenticated: true });
      localStorage.setItem('user', JSON.stringify(mockUser));
      mockPost.mockRejectedValue(new Error('Network error'));

      await useAuthStore.getState().logout();

      expect(mockClearTokens).toHaveBeenCalled();
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(localStorage.getItem('user')).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────
  // refreshToken()
  // ────────────────────────────────────────────────────────

  describe('refreshToken()', () => {
    it('should update tokens', async () => {
      mockGetRefreshToken.mockReturnValue('old-refresh-token');
      mockPost.mockResolvedValue({
        data: {
          data: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
          },
        },
      });

      await useAuthStore.getState().refreshToken();

      expect(mockPost).toHaveBeenCalledWith('/auth/refresh', {
        refreshToken: 'old-refresh-token',
      });
      expect(mockSetTokens).toHaveBeenCalledWith('new-access-token', 'new-refresh-token');
    });

    it('should redirect to /login on failure', async () => {
      mockGetRefreshToken.mockReturnValue('bad-token');
      mockPost.mockRejectedValue(new Error('Token expired'));

      // Mock window.location.href
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { ...originalLocation, href: '' },
      });

      await useAuthStore.getState().refreshToken();

      expect(mockClearTokens).toHaveBeenCalled();
      expect(window.location.href).toBe('/login');
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);

      // Restore
      Object.defineProperty(window, 'location', {
        writable: true,
        value: originalLocation,
      });
    });

    it('should redirect to /login when no refresh token exists', async () => {
      mockGetRefreshToken.mockReturnValue(null);

      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { ...originalLocation, href: '' },
      });

      await useAuthStore.getState().refreshToken();

      expect(mockClearTokens).toHaveBeenCalled();
      expect(window.location.href).toBe('/login');

      Object.defineProperty(window, 'location', {
        writable: true,
        value: originalLocation,
      });
    });
  });

  // ────────────────────────────────────────────────────────
  // fetchMe()
  // ────────────────────────────────────────────────────────

  describe('fetchMe()', () => {
    it('should set user from API response', async () => {
      mockGetAccessToken.mockReturnValue('valid-token');
      mockGet.mockResolvedValue({
        data: { data: mockUser },
      });

      await useAuthStore.getState().fetchMe();

      const state = useAuthStore.getState();
      expect(mockGet).toHaveBeenCalledWith('/auth/me');
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(localStorage.getItem('user')).toBe(JSON.stringify(mockUser));
    });

    it('should clear state when no token', async () => {
      mockGetAccessToken.mockReturnValue(null);

      await useAuthStore.getState().fetchMe();

      const state = useAuthStore.getState();
      expect(mockGet).not.toHaveBeenCalled();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('should clear state on API error', async () => {
      mockGetAccessToken.mockReturnValue('valid-token');
      mockGet.mockRejectedValue(new Error('Unauthorized'));

      await useAuthStore.getState().fetchMe();

      const state = useAuthStore.getState();
      expect(mockClearTokens).toHaveBeenCalled();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────
  // setUser()
  // ────────────────────────────────────────────────────────

  describe('setUser()', () => {
    it('should persist user to localStorage', () => {
      useAuthStore.getState().setUser(mockUser);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(localStorage.getItem('user')).toBe(JSON.stringify(mockUser));
    });

    it('should remove user from localStorage when set to null', () => {
      localStorage.setItem('user', JSON.stringify(mockUser));
      useAuthStore.getState().setUser(null);

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(localStorage.getItem('user')).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────
  // reset()
  // ────────────────────────────────────────────────────────

  describe('reset()', () => {
    it('should clear everything', () => {
      useAuthStore.setState({ user: mockUser, isAuthenticated: true });
      localStorage.setItem('user', JSON.stringify(mockUser));

      useAuthStore.getState().reset();

      expect(mockClearTokens).toHaveBeenCalled();
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(localStorage.getItem('user')).toBeNull();
    });
  });
});
