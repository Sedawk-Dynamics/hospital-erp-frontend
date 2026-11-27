'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Smartphone } from 'lucide-react';
import { apiPost } from '@/lib/api';
import { getTrustedDevice, saveTrustedDevice, skipPinPrompt } from '@/lib/trusted-device';
import { authErrorMessage, onlyDigits } from '@/lib/patient-auth';
import { AUTH_BUTTON, AUTH_INPUT, AUTH_LABEL, AuthError, Busy } from './auth-form-parts';

/** Offered right after a code sign-in: a PIN for next time, on this device only. */
export function PinSetupPrompt({
  setupToken,
  name,
  onDone,
}: {
  setupToken: string;
  name?: string;
  onDone: () => void;
}) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (pin !== confirm) {
      setError('The PINs do not match');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const previous = getTrustedDevice();
      const { data } = await apiPost<{ deviceId: string; deviceToken: string }>('/auth/me/pin', {
        pin,
        setupToken,
        ...(previous ? { deviceToken: previous.deviceToken } : {}),
      });
      saveTrustedDevice({ deviceId: data.deviceId, deviceToken: data.deviceToken, name });
      toast.success('PIN set for this device');
      onDone();
    } catch (err: unknown) {
      setError(authErrorMessage(err, 'Could not set the PIN. You can do it later in Settings.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="font-label text-sm font-bold text-on-surface">Set a PIN for this device?</p>
          <p className="mt-1 font-label text-xs text-on-surface-variant">
            Next time you can sign in here with 6 digits instead of a code. It works only on this device. Do not set
            one on a shared computer.
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="new-pin" className={AUTH_LABEL}>
          New PIN
        </label>
        <input
          id="new-pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          maxLength={6}
          placeholder="6 digits"
          className={`${AUTH_INPUT} tracking-[0.3em]`}
          value={pin}
          onChange={(e) => setPin(onlyDigits(e.target.value, 6))}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="confirm-pin" className={AUTH_LABEL}>
          Enter it again
        </label>
        <input
          id="confirm-pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          placeholder="6 digits"
          className={`${AUTH_INPUT} tracking-[0.3em]`}
          value={confirm}
          onChange={(e) => setConfirm(onlyDigits(e.target.value, 6))}
        />
      </div>
      {error && <AuthError>{error}</AuthError>}
      <button type="submit" disabled={busy || pin.length !== 6 || confirm.length !== 6} className={AUTH_BUTTON}>
        {busy ? <Busy>Setting PIN…</Busy> : 'Set PIN'}
      </button>
      <button
        type="button"
        onClick={() => {
          skipPinPrompt();
          onDone();
        }}
        disabled={busy}
        className="w-full font-label text-xs text-on-surface-variant hover:text-primary"
      >
        Not now
      </button>
    </form>
  );
}
