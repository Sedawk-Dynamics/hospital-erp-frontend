'use client';

import { useState } from 'react';
import { ArrowRight, Lock } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { forgetTrustedDevice, saveTrustedDevice, type TrustedDevice } from '@/lib/trusted-device';
import { authErrorCode, authErrorMessage, onlyDigits } from '@/lib/patient-auth';
import { AUTH_BUTTON, AUTH_INPUT, AUTH_LABEL, AuthError, Busy } from './auth-form-parts';

/** Sign in on a device that already has a PIN. */
export function PinSignIn({
  device,
  onSignedIn,
  onUseCode,
}: {
  device: TrustedDevice;
  onSignedIn: () => void;
  /** Go to the phone + code form, with an optional reason to show there. */
  onUseCode: (reason?: string) => void;
}) {
  const { loginWithPin } = useAuthStore();
  const [pin, setPin] = useState('');
  const [needs2fa, setNeeds2fa] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = pin.length === 6 && (!needs2fa || twoFactorCode.length === 6);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await loginWithPin({
        deviceToken: device.deviceToken,
        pin,
        ...(needs2fa ? { twoFactorCode } : {}),
      });
      onSignedIn();
    } catch (err: unknown) {
      const code = authErrorCode(err);
      const message = authErrorMessage(err, 'Could not sign in. Please try again.');
      if (code === '2FA_REQUIRED') {
        setNeeds2fa(true);
        setTwoFactorCode('');
      } else if (code === 'PIN_LOCKED') {
        // Keep the token so a new PIN replaces this one on the server.
        saveTrustedDevice({ ...device, locked: true });
        onUseCode(message);
      } else if (code === 'PIN_UNAVAILABLE') {
        forgetTrustedDevice();
        onUseCode(message);
      } else {
        if (needs2fa) setTwoFactorCode('');
        else setPin('');
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="font-label text-sm text-on-surface">
        Welcome back{device.name ? `, ${device.name}` : ''}. Enter your PIN for this device.
      </p>
      <div className="space-y-2">
        <label htmlFor="device-pin" className={AUTH_LABEL}>
          PIN
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
          <input
            id="device-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            maxLength={6}
            placeholder="6 digits"
            className={`${AUTH_INPUT} pl-10 tracking-[0.3em]`}
            value={pin}
            onChange={(e) => setPin(onlyDigits(e.target.value, 6))}
          />
        </div>
      </div>

      {needs2fa && (
        <div className="space-y-2">
          <label htmlFor="pin-2fa" className={AUTH_LABEL}>
            Two-factor code
          </label>
          <input
            id="pin-2fa"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="6-digit code from your authenticator app"
            className={AUTH_INPUT}
            value={twoFactorCode}
            onChange={(e) => setTwoFactorCode(onlyDigits(e.target.value, 6))}
          />
        </div>
      )}

      {error && <AuthError>{error}</AuthError>}

      <button type="submit" disabled={busy || !ready} className={AUTH_BUTTON}>
        {busy ? (
          <Busy>Signing in…</Busy>
        ) : (
          <span className="flex items-center justify-center gap-2">
            Sign in
            <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => onUseCode()}
        disabled={busy}
        className="w-full font-label text-xs text-on-surface-variant hover:text-primary"
      >
        Use a code instead
      </button>
    </form>
  );
}
