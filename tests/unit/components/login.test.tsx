import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';

// Sign-in is split two ways now: patients use phone + OTP, staff use email +
// password. The page opens on the Patient tab, so the email form these tests
// used to drive is only reachable after switching to Staff.

const mockLogin = vi.fn();
const requestPhoneOtp = vi.fn();
const loginWithPhoneOtp = vi.fn();

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({ login: mockLogin, requestPhoneOtp, loginWithPhoneOtp }),
}));

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

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import LoginPage from '@/app/(auth)/login/page';

/** The page opens on Patient; staff sign-in lives behind the Staff tab. */
async function showStaffForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /staff/i }));
  await waitFor(() => expect(screen.getByLabelText(/email/i)).toBeInTheDocument());
}

/** Both forms submit with "Continue"; only one is mounted at a time. */
const submitButton = () => screen.getByRole('button', { name: /continue|send/i });

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogin.mockResolvedValue('active');
    requestPhoneOtp.mockResolvedValue({ channel: 'sms', sentTo: '+91 ******3210', expiresInSeconds: 300, resendInSeconds: 60 });
    loginWithPhoneOtp.mockResolvedValue({});
  });

  describe('choosing how to sign in', () => {
    it('offers both a patient and a staff route', () => {
      render(<LoginPage />);
      expect(screen.getByRole('button', { name: /patient/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /staff/i })).toBeInTheDocument();
    });

    it('opens on the patient phone flow, not the staff password form', () => {
      render(<LoginPage />);
      expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
    });

    it('reveals email + password once Staff is chosen', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      await showStaffForm(user);

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });
  });

  describe('staff sign-in', () => {
    it('signs in with the credentials entered', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);
      await showStaffForm(user);

      await user.type(screen.getByLabelText(/email/i), 'doctor@hospital.com');
      await user.type(screen.getByLabelText(/password/i), 'secret123');
      await user.click(submitButton());

      await waitFor(() =>
        expect(mockLogin).toHaveBeenCalledWith('doctor@hospital.com', 'secret123'),
      );
    });

    it('rejects a malformed email without calling the store', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);
      await showStaffForm(user);

      await user.type(screen.getByLabelText(/email/i), 'not-an-email');
      await user.type(screen.getByLabelText(/password/i), 'secret123');
      await user.click(submitButton());

      // The input is type="email", so the browser's own constraint validation
      // blocks the submit before the zod resolver ever runs — the observable
      // guarantee is simply that no sign-in is attempted.
      await new Promise((r) => setTimeout(r, 50));
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('rejects a too-short password without calling the store', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);
      await showStaffForm(user);

      await user.type(screen.getByLabelText(/email/i), 'doctor@hospital.com');
      await user.type(screen.getByLabelText(/password/i), '123');
      await user.click(submitButton());

      await waitFor(() => expect(screen.getByText(/at least 6/i)).toBeInTheDocument());
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('surfaces a rejected sign-in', async () => {
      const user = userEvent.setup();
      mockLogin.mockRejectedValue(new Error('Invalid credentials'));
      render(<LoginPage />);
      await showStaffForm(user);

      await user.type(screen.getByLabelText(/email/i), 'doctor@hospital.com');
      await user.type(screen.getByLabelText(/password/i), 'wrongpass');
      await user.click(submitButton());

      await waitFor(() => expect(toast.error).toHaveBeenCalled());
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('two-factor sign-in (gap 297)', () => {
    it('asks for the authenticator code when the account has 2FA on, then sends it', async () => {
      const user = userEvent.setup();
      mockLogin
        .mockRejectedValueOnce({
          response: { status: 400, data: { message: 'Two-factor authentication code is required', code: '2FA_REQUIRED' } },
        })
        .mockResolvedValueOnce('active');
      render(<LoginPage />);
      await showStaffForm(user);

      await user.type(screen.getByLabelText(/email/i), 'doctor@hospital.com');
      await user.type(screen.getByLabelText(/password/i), 'secret123');
      await user.click(submitButton());

      const codeField = await screen.findByLabelText(/two-factor code/i);
      expect(toast.error).not.toHaveBeenCalled();
      expect(submitButton()).toBeDisabled();

      await user.type(codeField, '123456');
      await user.click(submitButton());

      await waitFor(() =>
        expect(mockLogin).toHaveBeenLastCalledWith('doctor@hospital.com', 'secret123', '123456'),
      );
    });
  });

  describe('patient sign-in', () => {
    it('asks for a phone number and sends a code', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      await user.type(screen.getByLabelText(/phone number/i), '9876543210');
      await user.click(submitButton());

      await waitFor(() => expect(requestPhoneOtp).toHaveBeenCalled());
    });

    it('will not send a code without a number', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      await user.click(submitButton());

      expect(requestPhoneOtp).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalled();
    });

    it('moves to the code step after a code is sent', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      await user.type(screen.getByLabelText(/phone number/i), '9876543210');
      await user.click(submitButton());

      await waitFor(() => expect(screen.getByLabelText(/code/i)).toBeInTheDocument());
    });
  });
});
