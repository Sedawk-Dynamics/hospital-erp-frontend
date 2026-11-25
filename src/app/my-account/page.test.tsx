import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyAccountPage from './page';

// Gap 297 — My Account shows the profile, recovers from a failed load with
// Retry, and lets the user set up / turn off 2FA and change phone with a code.

const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock('@/lib/api', () => ({
  apiGet: (...a: unknown[]) => apiGet(...a),
  apiPost: (...a: unknown[]) => apiPost(...a),
  apiPut: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

const setUser = vi.fn();
const USER = {
  id: 'user-1',
  email: 'asha@example.com',
  firstName: 'Asha',
  lastName: 'Rao',
  phone: '+919800000001',
  roles: ['doctor'],
  role: { id: 'r1', name: 'doctor', slug: 'doctor' },
};
vi.mock('@/stores/auth-store', () => ({ useAuthStore: () => ({ user: USER, setUser }) }));
vi.mock('@/stores/clinic-store', () => ({
  useClinicStore: (sel: (s: unknown) => unknown) => sel({ selectedClinic: { name: 'Green City Hospital' } }),
}));
vi.mock('@/hooks/use-permissions', () => ({ usePermissions: () => ({ isAdmin: () => false }) }));
vi.mock('@/hooks/use-subscriptions', () => ({
  useMySubscription: () => ({ data: undefined, isLoading: false }),
  usePaymentHistory: () => ({ data: [], isLoading: false }),
  useOfferedPlans: () => ({ data: [] }),
}));

const ME = {
  id: 'user-1',
  email: 'asha@example.com',
  firstName: 'Asha',
  lastName: 'Rao',
  phone: '+919800000001',
  is2faEnabled: false,
  roles: ['doctor', 'department_head'],
  tenant: { id: 't1', name: 'Green City Hospital', slug: 'green-city' },
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MyAccountPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  apiGet.mockResolvedValue({ data: ME });
});

describe('My Account', () => {
  it('shows name, email, phone, roles and hospital', async () => {
    renderPage();
    // Roles come from the live /auth/me profile (the cached user only has one).
    expect(await screen.findByText('doctor, department head')).toBeInTheDocument();
    expect(screen.getByText('Asha Rao', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('asha@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('+919800000001').length).toBeGreaterThan(0);
    expect(screen.getByText('Green City Hospital')).toBeInTheDocument();
    expect(screen.queryByText(/not available yet/i)).not.toBeInTheDocument();
  });

  it('shows an error with Retry when the profile fails to load, and Retry reloads it', async () => {
    apiGet.mockRejectedValueOnce(new Error('Network error'));
    renderPage();

    const alert = await screen.findByText(/couldn.t load your latest account details/i);
    expect(alert).toBeInTheDocument();
    // Still a page, not a blank screen.
    expect(screen.getByText('asha@example.com')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.queryByText(/couldn.t load your latest account details/i)).not.toBeInTheDocument());
    expect(apiGet).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole('button', { name: /set up two-factor sign-in/i })).toBeInTheDocument();
  });

  it('sets up two-factor sign-in with a QR code and a 6-digit code', async () => {
    apiPost.mockImplementation(async (url: string) => {
      if (url === '/auth/2fa/setup') {
        return { data: { secret: 'JBSWY3DPEHPK3PXP', otpauthUrl: 'otpauth://totp/HospitalERP:asha?secret=JBSWY3DPEHPK3PXP' } };
      }
      return { data: null };
    });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /set up two-factor sign-in/i }));
    expect(await screen.findByTestId('twofa-qr')).toBeInTheDocument();
    expect(screen.getByText('JBSW Y3DP EHPK 3PXP')).toBeInTheDocument();

    const verifyBtn = screen.getByRole('button', { name: /verify and turn on/i });
    expect(verifyBtn).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/code from the app/i), '123456');
    await userEvent.click(verifyBtn);

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/auth/2fa/verify', { code: '123456' }));
  });

  it('shows a wrong 2FA code error from the server', async () => {
    apiPost.mockImplementation(async (url: string) => {
      if (url === '/auth/2fa/setup') return { data: { secret: 'ABCDEFGH', otpauthUrl: 'otpauth://totp/x?secret=ABCDEFGH' } };
      throw { response: { data: { message: 'Invalid verification code' } } };
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /set up two-factor sign-in/i }));
    await userEvent.type(await screen.findByLabelText(/code from the app/i), '000000');
    await userEvent.click(screen.getByRole('button', { name: /verify and turn on/i }));
    expect(await screen.findByText('Invalid verification code')).toBeInTheDocument();
  });

  it('turns two-factor sign-in off with the password and a current code', async () => {
    apiGet.mockResolvedValue({ data: { ...ME, is2faEnabled: true } });
    apiPost.mockResolvedValue({ data: null });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /^turn off$/i }));
    await userEvent.type(screen.getByLabelText(/^current password$/i, { selector: '#twofa-off-password' }), 'Secret@123');
    await userEvent.type(screen.getByLabelText(/code from your authenticator app/i), '654321');
    await userEvent.click(screen.getByRole('button', { name: /turn off two-factor sign-in/i }));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/auth/2fa/disable', { currentPassword: 'Secret@123', code: '654321' }),
    );
  });

  it('changes the phone with a one-time code and says where the code was sent', async () => {
    apiPost.mockImplementation(async (url: string) => {
      if (url === '/auth/me/phone/request') return { data: { channel: 'email', sentTo: 'a***@example.com', expiresInSeconds: 600 } };
      if (url === '/auth/me/phone/verify') return { data: { phone: '+919876543210' } };
      return { data: null };
    });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /change phone/i }));
    await userEvent.type(screen.getByLabelText(/new mobile number/i), '9876543210');
    await userEvent.click(screen.getByRole('button', { name: /send code/i }));

    expect(apiPost).toHaveBeenCalledWith('/auth/me/phone/request', { phone: '9876543210' });
    const sent = await screen.findByTestId('phone-code-sent');
    expect(sent).toHaveTextContent('by email to a***@example.com');
    expect(sent).toHaveTextContent('10 minutes');

    await userEvent.type(screen.getByLabelText(/^code$/i), '424242');
    await userEvent.click(screen.getByRole('button', { name: /verify and change/i }));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/auth/me/phone/verify', { phone: '9876543210', code: '424242' }),
    );
    await waitFor(() => expect(setUser).toHaveBeenCalledWith(expect.objectContaining({ phone: '+919876543210' })));
  });

  it('shows the server reason when a phone cannot be used', async () => {
    apiPost.mockRejectedValue({ response: { data: { message: 'This phone number is already used by another account' } } });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /change phone/i }));
    await userEvent.type(screen.getByLabelText(/new mobile number/i), '9876543210');
    await userEvent.click(screen.getByRole('button', { name: /send code/i }));
    expect(await screen.findByText('This phone number is already used by another account')).toBeInTheDocument();
  });
});
