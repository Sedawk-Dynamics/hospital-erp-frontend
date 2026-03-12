import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';

// ─── Mock auth store ───
const mockRegister = vi.fn();
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    register: mockRegister,
  }),
}));

// ─── Mock next/navigation ───
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/register',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

// ─── Mock next/link ───
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import RegisterPage from '@/app/(auth)/register/page';

describe('Register Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────
  // Rendering
  // ────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('should render all form fields', () => {
      render(<RegisterPage />);

      expect(screen.getByLabelText(/hospital code/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });

    it('should render submit button', () => {
      render(<RegisterPage />);

      expect(screen.getByRole('button', { name: /register as patient/i })).toBeInTheDocument();
    });

    it('should have link to login page', () => {
      render(<RegisterPage />);

      const loginLink = screen.getByText(/sign in/i);
      expect(loginLink).toBeInTheDocument();
      expect(loginLink.closest('a')).toHaveAttribute('href', '/login');
    });

    it('should render page title and description', () => {
      render(<RegisterPage />);

      expect(screen.getByText(/patient registration/i)).toBeInTheDocument();
      expect(screen.getByText(/create your patient account/i)).toBeInTheDocument();
    });
  });

  // ────────────────────────────────────────────────────────
  // Validation
  // ────────────────────────────────────────────────────────

  describe('validation', () => {
    it('should validate required fields', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      // Click submit without filling anything
      await user.click(screen.getByRole('button', { name: /register as patient/i }));

      await waitFor(() => {
        expect(screen.getByText(/hospital code is required/i)).toBeInTheDocument();
        expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
      });
    });

    it('should validate email format', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      await user.type(screen.getByLabelText(/email/i), 'not-valid');
      await user.click(screen.getByRole('button', { name: /register as patient/i }));

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
      });
    });

    it('should validate minimum password length', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      await user.type(screen.getByLabelText(/^password$/i), 'short');
      await user.click(screen.getByRole('button', { name: /register as patient/i }));

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
      });
    });

    it('should validate password confirmation matches', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      await user.type(screen.getByLabelText(/hospital code/i), 'demo-hospital');
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/email/i), 'john@test.com');
      await user.type(screen.getByLabelText(/phone number/i), '1234567890');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'different456');
      await user.click(screen.getByRole('button', { name: /register as patient/i }));

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      });
    });
  });

  // ────────────────────────────────────────────────────────
  // Submission
  // ────────────────────────────────────────────────────────

  describe('submission', () => {
    const fillForm = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.type(screen.getByLabelText(/hospital code/i), 'demo-hospital');
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/email/i), 'john@test.com');
      await user.type(screen.getByLabelText(/phone number/i), '1234567890');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');
    };

    it('should call register on valid submission', async () => {
      mockRegister.mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(<RegisterPage />);

      await fillForm(user);
      await user.click(screen.getByRole('button', { name: /register as patient/i }));

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith({
          tenantSlug: 'demo-hospital',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@test.com',
          phone: '1234567890',
          password: 'password123',
        });
      });
    });

    it('should show success toast on registration', async () => {
      mockRegister.mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(<RegisterPage />);

      await fillForm(user);
      await user.click(screen.getByRole('button', { name: /register as patient/i }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Registration successful! Please sign in.');
        expect(mockPush).toHaveBeenCalledWith('/login');
      });
    });

    it('should show error toast on failure', async () => {
      mockRegister.mockRejectedValue({
        response: { data: { message: 'Email already registered' } },
      });
      const user = userEvent.setup();
      render(<RegisterPage />);

      await fillForm(user);
      await user.click(screen.getByRole('button', { name: /register as patient/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Email already registered');
      });
    });

    it('should show default error message when no API message', async () => {
      mockRegister.mockRejectedValue(new Error('Network Error'));
      const user = userEvent.setup();
      render(<RegisterPage />);

      await fillForm(user);
      await user.click(screen.getByRole('button', { name: /register as patient/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Registration failed. Please try again.');
      });
    });

    it('should disable button while submitting', async () => {
      let resolveRegister: () => void;
      mockRegister.mockImplementation(
        () => new Promise<void>((resolve) => { resolveRegister = resolve; })
      );
      const user = userEvent.setup();
      render(<RegisterPage />);

      await fillForm(user);
      await user.click(screen.getByRole('button', { name: /register as patient/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();
      });

      resolveRegister!();
    });
  });
});
