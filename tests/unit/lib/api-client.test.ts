import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

// We need to test the apiClient module which creates an Axios instance.
// Since it uses interceptors that reference localStorage and do HTTP calls,
// we test the behaviour by importing the configured instance.

// Mock axios at the module level so we can control the instance
const mockRequestInterceptorUse = vi.fn();
const mockResponseInterceptorUse = vi.fn();
const mockInstance = {
  interceptors: {
    request: { use: mockRequestInterceptorUse },
    response: { use: mockResponseInterceptorUse },
  },
  defaults: {
    baseURL: '',
    headers: { common: {} },
  },
  post: vi.fn(),
  get: vi.fn(),
};

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockInstance),
    post: vi.fn(),
  },
}));

describe('API Client', () => {
  let requestInterceptor: (config: any) => any;
  let responseSuccessInterceptor: (response: any) => any;
  let responseErrorInterceptor: (error: any) => any;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();

    // Re-capture interceptors by re-importing the module
    // Reset module registry to get fresh import
    vi.resetModules();

    // Re-mock axios for this fresh import
    vi.doMock('axios', () => ({
      default: {
        create: vi.fn(() => mockInstance),
        post: vi.fn(),
      },
    }));

    // Import fresh
    await import('@/lib/api-client');

    // Capture the interceptor functions that were registered
    if (mockRequestInterceptorUse.mock.calls.length > 0) {
      requestInterceptor = mockRequestInterceptorUse.mock.calls[0][0];
    }
    if (mockResponseInterceptorUse.mock.calls.length > 0) {
      responseSuccessInterceptor = mockResponseInterceptorUse.mock.calls[0][0];
      responseErrorInterceptor = mockResponseInterceptorUse.mock.calls[0][1];
    }
  });

  // ────────────────────────────────────────────────────────
  // Instance Creation
  // ────────────────────────────────────────────────────────

  describe('instance creation', () => {
    it('should create axios instance with correct baseURL', async () => {
      const { default: axiosMock } = await import('axios');
      expect(axiosMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: expect.any(String),
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });

  // ────────────────────────────────────────────────────────
  // Request Interceptor
  // ────────────────────────────────────────────────────────

  describe('request interceptor', () => {
    it('should attach Bearer token from localStorage', () => {
      localStorage.setItem('accessToken', 'my-test-token');

      const config = { headers: {} as Record<string, string> };
      const result = requestInterceptor(config);

      expect(result.headers.Authorization).toBe('Bearer my-test-token');
    });

    it('should not attach token if no token in localStorage', () => {
      const config = { headers: {} as Record<string, string> };
      const result = requestInterceptor(config);

      expect(result.headers.Authorization).toBeUndefined();
    });
  });

  // ────────────────────────────────────────────────────────
  // Response Interceptor
  // ────────────────────────────────────────────────────────

  describe('response interceptor', () => {
    it('should pass through successful responses', () => {
      const response = { data: { success: true } };
      const result = responseSuccessInterceptor(response);
      expect(result).toEqual(response);
    });

    it('should attempt token refresh on 401 response', async () => {
      localStorage.setItem('refreshToken', 'my-refresh-token');

      const { default: axiosMock } = await import('axios');
      (axiosMock.post as any).mockResolvedValue({
        data: {
          data: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
          },
        },
      });
      (mockInstance as any).mockImplementation = undefined;

      const error = {
        config: { headers: {}, _retry: false },
        response: { status: 401 },
      };

      // The interceptor will try to refresh and retry
      // We just verify it calls axios.post with the refresh endpoint
      try {
        await responseErrorInterceptor(error);
      } catch {
        // May throw depending on mock setup
      }

      expect(axiosMock.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/refresh'),
        { refreshToken: 'my-refresh-token' }
      );
    });

    it('should redirect to /login if refresh fails', async () => {
      localStorage.setItem('refreshToken', 'expired-token');

      const { default: axiosMock } = await import('axios');
      (axiosMock.post as any).mockRejectedValue(new Error('Refresh failed'));

      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { ...originalLocation, href: '' },
      });

      const error = {
        config: { headers: {}, _retry: false },
        response: { status: 401 },
      };

      await expect(responseErrorInterceptor(error)).rejects.toEqual(error);

      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
      expect(window.location.href).toBe('/login');

      Object.defineProperty(window, 'location', {
        writable: true,
        value: originalLocation,
      });
    });

    it('should not retry if already retried (_retry flag)', async () => {
      const { default: axiosMock } = await import('axios');

      const error = {
        config: { headers: {}, _retry: true },
        response: { status: 401 },
      };

      await expect(responseErrorInterceptor(error)).rejects.toEqual(error);

      // Should NOT attempt to refresh
      expect(axiosMock.post).not.toHaveBeenCalled();
    });

    it('should reject non-401 errors without refresh attempt', async () => {
      const { default: axiosMock } = await import('axios');

      const error = {
        config: { headers: {} },
        response: { status: 500 },
      };

      await expect(responseErrorInterceptor(error)).rejects.toEqual(error);
      expect(axiosMock.post).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────
  // Type Export
  // ────────────────────────────────────────────────────────

  describe('exports', () => {
    it('should export ApiResponse type (module exports default and type)', async () => {
      const mod = await import('@/lib/api-client');
      expect(mod.default).toBeDefined();
    });
  });
});
