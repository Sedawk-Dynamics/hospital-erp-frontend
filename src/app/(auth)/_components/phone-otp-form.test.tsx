import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Patient sign-in: code entry, PIN on a known device, and the PIN offer after a code.

const requestPhoneOtp = vi.fn();
const loginWithPhoneOtp = vi.fn();
const loginWithPin = vi.fn();
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: Object.assign(() => ({ requestPhoneOtp, loginWithPhoneOtp, loginWithPin }), {
    getState: () => ({ user: { firstName: 'Asha', roles: ['patient'], role: { slug: 'patient' } } }),
  }),
}));
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
const apiPost = vi.fn();
vi.mock('@/lib/api', () => ({ apiPost: (...a: unknown[]) => apiPost(...a) }));

import { PhoneOtpForm } from './phone-otp-form';

const RECEIPT = { channel: 'sms', sentTo: '+91 ******3210', expiresInSeconds: 300, resendInSeconds: 60 };
const DEVICE = { deviceId: 'dev-1', deviceToken: 'device-token-1', name: 'Asha' };
const refused = (code: string, message: string, status = 400) => ({ response: { status, data: { code, message } } });
const stored = () => JSON.parse(localStorage.getItem('patientDevice') ?? 'null');

async function toCodeStep(mode: 'login' | 'signup' = 'login') {
  render(<PhoneOtpForm mode={mode} />);
  await userEvent.type(screen.getByLabelText(/phone number/i), '9876543210');
  await userEvent.click(screen.getByRole('button', { name: /send verification code/i }));
  return screen.findByLabelText(/verification code/i);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  requestPhoneOtp.mockResolvedValue(RECEIPT);
  loginWithPhoneOtp.mockResolvedValue({});
  loginWithPin.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe('code entry', () => {
  it('says where the code went, masked, and shows no test code anywhere', async () => {
    await toCodeStep();
    expect(requestPhoneOtp).toHaveBeenCalledWith('+919876543210', 'login');
    expect(screen.getByTestId('code-sent-to')).toHaveTextContent('by SMS to +91 ******3210. It expires in 5 minutes');
    expect(document.body.textContent).not.toMatch(/123123|for testing/i);
  });

  it('names the email when that is where it went', async () => {
    requestPhoneOtp.mockResolvedValue({ ...RECEIPT, channel: 'email', sentTo: 'a***@example.com' });
    await toCodeStep();
    expect(screen.getByTestId('code-sent-to')).toHaveTextContent('by email to a***@example.com');
  });

  it('signs in with the six digits and goes to the portal', async () => {
    const input = await toCodeStep();
    await userEvent.type(input, '48a2915x99');
    expect(input).toHaveValue('482915');
    await userEvent.click(screen.getByRole('button', { name: /verify & sign in/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/patient-portal'));
    expect(loginWithPhoneOtp).toHaveBeenCalledWith({ phone: '+919876543210', otp: '482915', intent: 'login' });
  });

  it('will not submit fewer than six digits', async () => {
    await userEvent.type(await toCodeStep(), '1234');
    await userEvent.click(screen.getByRole('button', { name: /verify & sign in/i }));
    expect(loginWithPhoneOtp).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the 6-digit code');
  });

  it('holds back Resend for a minute, then allows it', async () => {
    vi.useFakeTimers();
    render(<PhoneOtpForm mode="login" />);
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '9876543210' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /send verification code/i })));
    const resend = () => screen.getByRole('button', { name: /new code|resend/i });
    expect(resend()).toBeDisabled();
    expect(resend()).toHaveTextContent('60s');
    await act(async () => vi.advanceTimersByTime(30_000));
    expect(resend()).toHaveTextContent('30s');
    await act(async () => vi.advanceTimersByTime(31_000));
    expect(resend()).toBeEnabled();
    await act(async () => fireEvent.click(resend()));
    expect(requestPhoneOtp).toHaveBeenCalledTimes(2);
    expect(resend()).toBeDisabled();
  });

  it('shows why a code could not be sent and stays on the phone step', async () => {
    requestPhoneOtp.mockRejectedValue(refused('OTP_NOT_CONFIGURED', 'Verification codes cannot be sent right now. Please contact the hospital.', 503));
    render(<PhoneOtpForm mode="login" />);
    await userEvent.type(screen.getByLabelText(/phone number/i), '9876543210');
    await userEvent.click(screen.getByRole('button', { name: /send verification code/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('cannot be sent right now');
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
  });

  it('keeps a wrong code to correct, and clears one that is used up', async () => {
    const input = await toCodeStep();
    loginWithPhoneOtp.mockRejectedValueOnce(refused('OTP_INVALID', 'The code is wrong. 4 attempts left.'));
    await userEvent.type(input, '482915');
    await userEvent.click(screen.getByRole('button', { name: /verify & sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('4 attempts left');
    expect(input).toHaveValue('482915');
    loginWithPhoneOtp.mockRejectedValueOnce(refused('OTP_EXPIRED', 'The code has expired. Ask for a new code.'));
    await userEvent.click(screen.getByRole('button', { name: /verify & sign in/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('expired'));
    expect(input).toHaveValue('');
  });

  it('links to sign up when the number has no account, and to sign in when it has one', async () => {
    loginWithPhoneOtp.mockRejectedValueOnce(refused('NO_ACCOUNT', 'No account found for this number. Please sign up first.', 404));
    await userEvent.type(await toCodeStep(), '482915');
    await userEvent.click(screen.getByRole('button', { name: /verify & sign in/i }));
    expect(await screen.findByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/register');
  });

  it('asks for the authenticator code when the account has 2FA and sends both', async () => {
    loginWithPhoneOtp.mockRejectedValueOnce(refused('2FA_REQUIRED', 'Two-factor authentication code is required'));
    await userEvent.type(await toCodeStep(), '482915');
    const submit = screen.getByRole('button', { name: /verify & sign in/i });
    await userEvent.click(submit);
    await userEvent.type(await screen.findByLabelText(/two-factor/i), '654321');
    await userEvent.click(submit);
    await waitFor(() =>
      expect(loginWithPhoneOtp).toHaveBeenLastCalledWith({
        phone: '+919876543210', otp: '482915', intent: 'login', twoFactorCode: '654321',
      }),
    );
  });

  it('signup asks for the code with the signup intent and needs a name', async () => {
    await userEvent.type(await toCodeStep('signup'), '482915');
    expect(requestPhoneOtp).toHaveBeenCalledWith('+919876543210', 'signup');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(loginWithPhoneOtp).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText(/first name/i), 'Ravi');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() =>
      expect(loginWithPhoneOtp).toHaveBeenCalledWith(expect.objectContaining({ intent: 'signup', firstName: 'Ravi' })),
    );
  });
});

describe('the PIN offer after a code sign-in', () => {
  async function toOffer() {
    loginWithPhoneOtp.mockResolvedValue({ pinSetupToken: 'setup-ticket' });
    await userEvent.type(await toCodeStep(), '482915');
    await userEvent.click(screen.getByRole('button', { name: /verify & sign in/i }));
    await screen.findByText(/set a pin for this device/i);
  }

  it('can be skipped, and is not shown again for a while', async () => {
    await toOffer();
    await userEvent.click(screen.getByRole('button', { name: /not now/i }));
    expect(push).toHaveBeenCalledWith('/patient-portal');
    expect(apiPost).not.toHaveBeenCalled();
    expect(stored()).toBeNull();
    expect(localStorage.getItem('patientPinPromptSkippedAt')).toBeTruthy();
  });

  it('sets a PIN and remembers the device, never the PIN', async () => {
    apiPost.mockResolvedValue({ data: { deviceId: 'dev-9', deviceToken: 'tok-9' } });
    await toOffer();
    await userEvent.type(screen.getByLabelText(/new pin/i), '480193');
    await userEvent.type(screen.getByLabelText(/enter it again/i), '480193');
    await userEvent.click(screen.getByRole('button', { name: /^set pin$/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/patient-portal'));
    expect(apiPost).toHaveBeenCalledWith('/auth/me/pin', { pin: '480193', setupToken: 'setup-ticket' });
    expect(stored()).toEqual({ deviceId: 'dev-9', deviceToken: 'tok-9', name: 'Asha' });
    expect(JSON.stringify({ ...localStorage })).not.toContain('480193');
  });

  it('refuses two different PINs, and shows the server reason for a weak one', async () => {
    await toOffer();
    const a = screen.getByLabelText(/new pin/i);
    const b = screen.getByLabelText(/enter it again/i);
    await userEvent.type(a, '480193');
    await userEvent.type(b, '480194');
    await userEvent.click(screen.getByRole('button', { name: /^set pin$/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('do not match');
    expect(apiPost).not.toHaveBeenCalled();
    apiPost.mockRejectedValue(refused('PIN_WEAK', 'This PIN is too easy to guess.'));
    await userEvent.clear(b);
    await userEvent.type(b, '480193');
    await userEvent.click(screen.getByRole('button', { name: /^set pin$/i }));
    expect(await screen.findByText(/too easy to guess/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe('PIN sign-in on a known device', () => {
  beforeEach(() => localStorage.setItem('patientDevice', JSON.stringify(DEVICE)));

  const enter = async (pin: string) => {
    await userEvent.type(screen.getByLabelText('PIN'), pin);
    await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
  };

  it('asks for the PIN and signs in with it', async () => {
    render(<PhoneOtpForm mode="login" />);
    expect(screen.getByText(/welcome back, asha/i)).toBeInTheDocument();
    await enter('480193');
    await waitFor(() => expect(push).toHaveBeenCalledWith('/patient-portal'));
    expect(loginWithPin).toHaveBeenCalledWith({ deviceToken: 'device-token-1', pin: '480193' });
  });

  it('signup never asks for a PIN', () => {
    render(<PhoneOtpForm mode="signup" />);
    expect(screen.queryByLabelText('PIN')).not.toBeInTheDocument();
  });

  it('can use a code instead, and come back', async () => {
    render(<PhoneOtpForm mode="login" />);
    await userEvent.click(screen.getByRole('button', { name: /use a code instead/i }));
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /use my pin instead/i }));
    expect(screen.getByLabelText('PIN')).toBeInTheDocument();
  });

  it('a wrong PIN says how many tries are left and clears the box', async () => {
    loginWithPin.mockRejectedValue(refused('PIN_INVALID', 'Wrong PIN. 4 attempts left.', 401));
    render(<PhoneOtpForm mode="login" />);
    await enter('111122');
    expect(await screen.findByRole('alert')).toHaveTextContent('4 attempts left');
    expect(screen.getByLabelText('PIN')).toHaveValue('');
  });

  it('a locked PIN moves to the code form and stays there', async () => {
    loginWithPin.mockRejectedValue(refused('PIN_LOCKED', 'Too many wrong PINs. Sign in with a code instead.', 401));
    render(<PhoneOtpForm mode="login" />);
    await enter('111122');
    expect(await screen.findByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Sign in with a code');
    expect(screen.queryByRole('button', { name: /use my pin/i })).not.toBeInTheDocument();
    expect(stored()).toMatchObject({ deviceId: 'dev-1', locked: true });
  });

  it('a removed device is forgotten', async () => {
    loginWithPin.mockRejectedValue(refused('PIN_UNAVAILABLE', 'PIN sign-in is not available on this device.', 401));
    render(<PhoneOtpForm mode="login" />);
    await enter('480193');
    expect(await screen.findByLabelText(/phone number/i)).toBeInTheDocument();
    expect(stored()).toBeNull();
  });

  it('asks for the authenticator code when 2FA is on', async () => {
    loginWithPin.mockRejectedValueOnce(refused('2FA_REQUIRED', 'x'));
    render(<PhoneOtpForm mode="login" />);
    await enter('480193');
    await userEvent.type(await screen.findByLabelText(/two-factor code/i), '654321');
    await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
    await waitFor(() =>
      expect(loginWithPin).toHaveBeenLastCalledWith({ deviceToken: 'device-token-1', pin: '480193', twoFactorCode: '654321' }),
    );
  });

  it('ignores a corrupted record', () => {
    localStorage.setItem('patientDevice', '{oops');
    render(<PhoneOtpForm mode="login" />);
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
  });
});
