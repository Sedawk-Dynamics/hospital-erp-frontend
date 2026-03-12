import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ─── Mock auth store ───
const mockFetchMe = vi.fn();
const mockStoreState = {
  user: null as any,
  isAuthenticated: false,
  isLoading: false,
  _hydrated: false,
  hydrate: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
  fetchMe: mockFetchMe,
  setUser: vi.fn(),
  reset: vi.fn(),
};

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({ ...mockStoreState }),
}));

import { useAuth } from '@/hooks/use-auth';

describe('useAuth Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState.user = null;
    mockStoreState.isAuthenticated = false;
    mockStoreState.isLoading = false;
    mockStoreState._hydrated = false;
  });

  // ────────────────────────────────────────────────────────
  // Return Values
  // ────────────────────────────────────────────────────────

  it('should return store state', () => {
    mockStoreState._hydrated = true;
    mockStoreState.isAuthenticated = true;
    mockStoreState.user = { id: 'user-1', firstName: 'John' };

    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toEqual({ id: 'user-1', firstName: 'John' });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.login).toBeDefined();
    expect(result.current.logout).toBeDefined();
    expect(result.current.fetchMe).toBeDefined();
  });

  // ────────────────────────────────────────────────────────
  // fetchMe Behavior
  // ────────────────────────────────────────────────────────

  it('should call fetchMe when hydrated and not authenticated', () => {
    mockStoreState._hydrated = true;
    mockStoreState.isAuthenticated = false;
    mockStoreState.user = null;

    renderHook(() => useAuth());

    expect(mockFetchMe).toHaveBeenCalled();
  });

  it('should not call fetchMe if not yet hydrated', () => {
    mockStoreState._hydrated = false;
    mockStoreState.isAuthenticated = false;
    mockStoreState.user = null;

    renderHook(() => useAuth());

    expect(mockFetchMe).not.toHaveBeenCalled();
  });

  it('should not call fetchMe if already authenticated', () => {
    mockStoreState._hydrated = true;
    mockStoreState.isAuthenticated = true;
    mockStoreState.user = { id: 'user-1', firstName: 'John' };

    renderHook(() => useAuth());

    expect(mockFetchMe).not.toHaveBeenCalled();
  });
});
