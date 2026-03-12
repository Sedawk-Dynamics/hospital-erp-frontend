import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';

// ─── Mock auth store ───
const mockLogin = vi.fn();
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    login: mockLogin,
  }),
}));

// ─── Mock next/navigation (override the global one to track push calls) ───
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/login',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

// ─── Mock next/link to render anchor tags ───
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import LoginPage from '@/app/(auth)/login/page';

describe('Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────
  // Rendering
  // ────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('should render email and password inputs', () => {
      render(<LoginPage />);

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });

    it('should render sign in button', () => {
      render(<LoginPage />);

      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('should render register link', () => {
      render(<LoginPage />);

      const registerLink = screen.getByText(/register here/i);
      expect(registerLink).toBeInTheDocument();
      expect(registerLink.closest('a')).toHaveAttribute('href', '/register');
    });

    it('should render forgot password link', () => {
      render(<LoginPage />);

      const forgotLink = screen.getByText(/forgot password/i);
      expect(forgotLink).toBeInTheDocument();
      expect(forgotLink.closest('a')).toHaveAttribute('href', '/forgot-password');
    });
  });

  // ────────────────────────────────────────────────────────
  // Validation
  // ────────────────────────────────────────────────────────

  describe('validation', () => {
    it('should show validation error for invalid email', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'not-an-email');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
      });
    });

    it('should show validation error for short password', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, '12345');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument();
      });
    });
  });

  // ────────────────────────────────────────────────────────
  // Submission
  // ────────────────────────────────────────────────────────

  describe('submission', () => {
    it('should call login on valid form submission', async () => {
      mockLogin.mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'doctor@hospital.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('doctor@hospital.com', 'password123');
      });
    });

    it('should show success toast and redirect on successful login', async () => {
      mockLogin.mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(<LoginPage />);

      await user.type(screen.getByLabelText(/email/i), 'doctor@hospital.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Login successful! Redirecting...');
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('should show error toast on login failure', async () => {
      mockLogin.mockRejectedValue({
        response: { data: { message: 'Invalid credentials' } },
      });
      const user = userEvent.setup();
      render(<LoginPage />);

      await user.type(screen.getByLabelText(/email/i), 'bad@hospital.com');
      await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Invalid credentials');
      });
    });

    it('should show default error message when no API message', async () => {
      mockLogin.mockRejectedValue(new Error('Network Error'));
      const user = userEvent.setup();
      render(<LoginPage />);

      await user.type(screen.getByLabelText(/email/i), 'bad@hospital.com');
      await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Login failed. Please check your credentials.');
      });
    });

    it('should disable button while submitting', async () => {
      // Make login hang so we can check the disabled state
      let resolveLogin: () => void;
      mockLogin.mockImplementation(
        () => new Promise<void>((resolve) => { resolveLogin = resolve; })
      );
      const user = userEvent.setup();
      render(<LoginPage />);

      await user.type(screen.getByLabelText(/email/i), 'doctor@hospital.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
      });

      // Resolve so the test can clean up
      resolveLogin!();
    });
  });
});
