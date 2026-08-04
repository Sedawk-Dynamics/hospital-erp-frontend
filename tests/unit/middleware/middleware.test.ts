import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock next/server ───
const mockRedirect = vi.fn((url: URL) => ({ type: 'redirect', url: url.toString() }));
const mockNext = vi.fn(() => ({ type: 'next' }));

vi.mock('next/server', () => ({
  NextResponse: {
    redirect: (url: URL) => mockRedirect(url),
    next: () => mockNext(),
  },
}));

// ─── Helper: Create mock NextRequest ───
function createMockRequest(pathname: string, cookies: Record<string, string> = {}) {
  return {
    nextUrl: { pathname },
    url: 'http://localhost:3000',
    cookies: {
      get: (name: string) => (cookies[name] ? { value: cookies[name] } : undefined),
    },
  } as any;
}

// Import middleware after mocks are set up
import { middleware } from '@/middleware';

describe('Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────
  // Unauthenticated Users on Protected Paths
  // ────────────────────────────────────────────────────────

  describe('unauthenticated users on protected paths', () => {
    it('should redirect to /login when accessing /dashboard without token', () => {
      const req = createMockRequest('/dashboard');
      middleware(req);

      expect(mockRedirect).toHaveBeenCalled();
      const redirectUrl = mockRedirect.mock.calls[0][0];
      expect(redirectUrl.pathname).toBe('/login');
    });

    it('should include callbackUrl when redirecting to /login', () => {
      const req = createMockRequest('/dashboard/patients');
      middleware(req);

      expect(mockRedirect).toHaveBeenCalled();
      const redirectUrl = mockRedirect.mock.calls[0][0];
      expect(redirectUrl.pathname).toBe('/login');
      expect(redirectUrl.searchParams.get('callbackUrl')).toBe('/dashboard/patients');
    });

    it('should redirect for nested dashboard paths', () => {
      const req = createMockRequest('/dashboard/settings/profile');
      middleware(req);

      expect(mockRedirect).toHaveBeenCalled();
      const redirectUrl = mockRedirect.mock.calls[0][0];
      expect(redirectUrl.pathname).toBe('/login');
      expect(redirectUrl.searchParams.get('callbackUrl')).toBe('/dashboard/settings/profile');
    });
  });

  // ────────────────────────────────────────────────────────
  // Authenticated Users on Public Paths
  // ────────────────────────────────────────────────────────

  describe('authenticated users on public paths', () => {
    it('should redirect to /dashboard when accessing /login with token', () => {
      const req = createMockRequest('/login', { accessToken: 'valid-token' });
      middleware(req);

      expect(mockRedirect).toHaveBeenCalled();
      const redirectUrl = mockRedirect.mock.calls[0][0];
      expect(redirectUrl.pathname).toBe('/select-hospital');
    });

    it('should redirect to /dashboard when accessing /register with token', () => {
      const req = createMockRequest('/register', { accessToken: 'valid-token' });
      middleware(req);

      expect(mockRedirect).toHaveBeenCalled();
      const redirectUrl = mockRedirect.mock.calls[0][0];
      expect(redirectUrl.pathname).toBe('/select-hospital');
    });

    it('should redirect to /dashboard when accessing /forgot-password with token', () => {
      const req = createMockRequest('/forgot-password', { accessToken: 'valid-token' });
      middleware(req);

      expect(mockRedirect).toHaveBeenCalled();
      const redirectUrl = mockRedirect.mock.calls[0][0];
      expect(redirectUrl.pathname).toBe('/select-hospital');
    });
  });

  // ────────────────────────────────────────────────────────
  // Authenticated Users on Protected Paths
  // ────────────────────────────────────────────────────────

  describe('authenticated users on protected paths', () => {
    it('should allow access to /dashboard with valid token', () => {
      const req = createMockRequest('/dashboard', { accessToken: 'valid-token' });
      middleware(req);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('should allow access to /dashboard/patients with valid token', () => {
      const req = createMockRequest('/dashboard/patients', { accessToken: 'valid-token' });
      middleware(req);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────
  // Unauthenticated Users on Public Paths
  // ────────────────────────────────────────────────────────

  describe('unauthenticated users on public paths', () => {
    it('should allow access to /login without token', () => {
      const req = createMockRequest('/login');
      middleware(req);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('should allow access to /register without token', () => {
      const req = createMockRequest('/register');
      middleware(req);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('should allow access to /forgot-password without token', () => {
      const req = createMockRequest('/forgot-password');
      middleware(req);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────
  // Other Paths
  // ────────────────────────────────────────────────────────

  describe('other paths', () => {
    it('should pass through for non-matched paths without token', () => {
      const req = createMockRequest('/about');
      middleware(req);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('should pass through for non-matched paths with token', () => {
      const req = createMockRequest('/about', { accessToken: 'valid-token' });
      middleware(req);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });
});
