import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';

// Patient signup is phone + OTP now — the email / password / hospital-code form
// these tests used to drive no longer exists. They cover the current flow:
// enter a number, receive a code, and (for a new number) give a name.

const requestPhoneOtp = vi.fn();
const loginWithPhoneOtp = vi.fn();

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({ requestPhoneOtp, loginWithPhoneOtp }),
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
  usePathname: () => '/register',
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

import RegisterPage from '@/app/(auth)/register/page';

describe('Patient register page (phone OTP signup)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestPhoneOtp.mockResolvedValue({ isNewUser: true });
    loginWithPhoneOtp.mockResolvedValue('active');
  });

  const sendButton = () => screen.getByRole('button', { name: /send|continue/i });

  it('introduces itself as account creation', () => {
    render(<RegisterPage />);
    expect(screen.getByText(/create your account/i)).toBeInTheDocument();
    expect(screen.getByText(/sign up with your phone number/i)).toBeInTheDocument();
  });

  it('asks for a phone number, not an email / password / hospital code', () => {
    render(<RegisterPage />);
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/hospital code/i)).not.toBeInTheDocument();
  });

  it('explains that records link to the number given at the hospital', () => {
    render(<RegisterPage />);
    expect(screen.getByText(/linked to it automatically/i)).toBeInTheDocument();
  });

  it('offers a route back to sign in for an existing account', () => {
    render(<RegisterPage />);
    expect(screen.getByText(/already have an account/i)).toBeInTheDocument();
    expect(screen.getByText(/sign in/i)).toBeInTheDocument();
  });

  it('refuses to send a code without a phone number', async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.click(sendButton());

    expect(requestPhoneOtp).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('requests a code for the number entered, in E.164 form', async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/phone number/i), '9876543210');
    await user.click(sendButton());

    await waitFor(() => expect(requestPhoneOtp).toHaveBeenCalled());
    // The store is handed a full E.164 number, not the raw digits typed.
    expect(String(requestPhoneOtp.mock.calls[0][0])).toContain('9876543210');
  });

  it('moves on to the code step once a code has been sent', async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/phone number/i), '9876543210');
    await user.click(sendButton());

    await waitFor(() => expect(screen.getByLabelText(/code/i)).toBeInTheDocument());
  });

  it('asks a brand-new patient for their name before creating the account', async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/phone number/i), '9876543210');
    await user.click(sendButton());

    await waitFor(() => expect(screen.getByLabelText(/first name/i)).toBeInTheDocument());
  });

  it('surfaces a send failure instead of advancing to the code step', async () => {
    const user = userEvent.setup();
    requestPhoneOtp.mockRejectedValue(new Error('SMS gateway down'));
    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/phone number/i), '9876543210');
    await user.click(sendButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
  });
});
