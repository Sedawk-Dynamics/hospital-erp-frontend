'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowRight, ArrowLeft, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { PhoneField, DEFAULT_PHONE, phoneToE164, type PhoneValue } from '@/components/ui/phone-field';
import {
  parseTrustedDevice,
  pinPromptSkipped,
  subscribeTrustedDevice,
  trustedDeviceSnapshot,
} from '@/lib/trusted-device';
import { authErrorCode, authErrorMessage, onlyDigits, sentByText, type CodeReceipt } from '@/lib/patient-auth';
import { AUTH_BUTTON, AUTH_INPUT, AUTH_LABEL, AuthError, Busy } from './auth-form-parts';
import { PinSignIn } from './pin-sign-in';
import { PinSetupPrompt } from './pin-setup-prompt';

/** How long to wait before another code when the server did not say. */
const DEFAULT_RESEND_SECONDS = 60;

/** A countdown in whole seconds, and a way to (re)start it. */
function useCountdown(): [number, (seconds: number) => void] {
  const [{ until, now }, setClock] = useState({ until: 0, now: 0 });
  useEffect(() => {
    if (!until) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setClock((c) => ({ ...c, now: t }));
      if (t >= until) clearInterval(timer);
    }, 500);
    return () => clearInterval(timer);
  }, [until]);
  const start = (seconds: number) => {
    const t = Date.now();
    setClock({ until: t + seconds * 1000, now: t });
  };
  return [Math.max(0, Math.ceil((until - now) / 1000)), start];
}

/**
 * Patient sign-in, in one of two explicit modes:
 *   - 'login'  → the number MUST already have an account; never creates one.
 *   - 'signup' → the number must NOT have an account; collects details + creates.
 * Each mode has its own page, so login never shows signup fields. Whether a
 * number has an account is only said once the code sent to it is entered.
 *
 * On a device that has a PIN, login starts with the PIN. After a code sign-in
 * the patient may set a PIN for this device, or skip it.
 */
export function PhoneOtpForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const { requestPhoneOtp, loginWithPhoneOtp } = useAuthStore();

  const isSignup = mode === 'signup';

  // The server renders the phone form; a remembered device appears after hydration.
  const deviceRaw = useSyncExternalStore(subscribeTrustedDevice, trustedDeviceSnapshot, () => null);
  const device = useMemo(() => parseTrustedDevice(deviceRaw), [deviceRaw]);
  const [useCode, setUseCode] = useState(false);

  const [step, setStep] = useState<'phone' | 'otp' | 'set-pin'>('phone');
  const [phoneVal, setPhoneVal] = useState<PhoneValue>({ ...DEFAULT_PHONE });
  const [otp, setOtp] = useState('');
  const [receipt, setReceipt] = useState<CodeReceipt | null>(null);
  const [needs2fa, setNeeds2fa] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  const [resendIn, startResendTimer] = useCountdown();

  // National number is 10 digits; the country code is chosen (default +91).
  const fullPhone = phoneToE164(phoneVal);

  const fail = (err: unknown, fallback: string) => {
    const message = authErrorMessage(err, fallback);
    setError({ message, code: authErrorCode(err) });
    toast.error(message);
  };

  const sendCode = async () => {
    if (phoneVal.national.length !== 10) {
      setError({ message: 'Enter a 10-digit phone number' });
      toast.error('Enter a 10-digit phone number');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const sent = await requestPhoneOtp(fullPhone, mode);
      setReceipt(sent);
      startResendTimer(sent?.resendInSeconds ?? DEFAULT_RESEND_SECONDS);
      setOtp('');
      setNeeds2fa(false);
      setTwoFactorCode('');
      setStep('otp');
      toast.success('Verification code sent');
    } catch (err: unknown) {
      if (authErrorCode(err) === 'OTP_COOLDOWN') startResendTimer(DEFAULT_RESEND_SECONDS);
      fail(err, 'Could not send the code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const redirectByRole = () => {
    const user = useAuthStore.getState().user;
    const roleSlug = user?.role?.slug || user?.roles?.[0];
    if (roleSlug === 'super_admin') return router.push('/super-admin');
    if (roleSlug === 'patient') return router.push('/patient-portal');
    return router.push('/select-hospital');
  };

  const verify = async () => {
    if (otp.length !== 6) {
      setError({ message: 'Enter the 6-digit code' });
      toast.error('Enter the 6-digit code');
      return;
    }
    if (isSignup && !firstName.trim()) {
      setError({ message: 'Please enter your name' });
      toast.error('Please enter your name');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await loginWithPhoneOtp({
        phone: fullPhone,
        otp,
        intent: mode,
        ...(needs2fa ? { twoFactorCode } : {}),
        ...(isSignup
          ? {
              firstName: firstName.trim() || undefined,
              lastName: lastName.trim() || undefined,
              gender,
              dateOfBirth: dateOfBirth || undefined,
            }
          : {}),
      });
      if (result?.pinSetupToken && !pinPromptSkipped()) {
        setSetupToken(result.pinSetupToken);
        setStep('set-pin');
        return;
      }
      toast.success('Signed in! Redirecting…');
      redirectByRole();
    } catch (err: unknown) {
      const code = authErrorCode(err);
      if (code === '2FA_REQUIRED') {
        // The code was right; now the authenticator app's.
        setNeeds2fa(true);
        setTwoFactorCode('');
        return;
      }
      // Anything that used the code up leaves nothing to correct: start over.
      if (['OTP_EXPIRED', 'OTP_ATTEMPTS_EXCEEDED', 'NO_ACCOUNT', 'ACCOUNT_EXISTS'].includes(code ?? '')) setOtp('');
      if (needs2fa) setTwoFactorCode('');
      fail(err, 'Invalid code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (step === 'set-pin') {
    return (
      <PinSetupPrompt
        setupToken={setupToken}
        name={useAuthStore.getState().user?.firstName}
        onDone={redirectByRole}
      />
    );
  }

  if (!isSignup && device && !device.locked && !useCode && step === 'phone') {
    return (
      <PinSignIn
        device={device}
        onSignedIn={() => {
          toast.success('Signed in! Redirecting…');
          redirectByRole();
        }}
        onUseCode={(reason) => {
          setUseCode(true);
          setError(reason ? { message: reason } : null);
        }}
      />
    );
  }

  const errorBox = error && (
    <AuthError>
      {error.message}
      {error.code === 'NO_ACCOUNT' && (
        <>
          {' '}
          <Link href="/register" className="font-bold underline">
            Create an account
          </Link>
        </>
      )}
      {error.code === 'ACCOUNT_EXISTS' && (
        <>
          {' '}
          <Link href="/login" className="font-bold underline">
            Go to sign in
          </Link>
        </>
      )}
    </AuthError>
  );

  if (step === 'phone') {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="otp-phone" className={AUTH_LABEL}>
            Phone Number
          </label>
          <PhoneField
            id="otp-phone"
            value={phoneVal}
            onChange={setPhoneVal}
            onEnter={sendCode}
            autoFocus
          />
          <p className="font-label text-[11px] text-on-surface-variant/70">
            Use the number you gave at the hospital — your and your family&apos;s records are
            linked to it automatically.
          </p>
        </div>

        {errorBox}

        <button type="button" onClick={sendCode} disabled={busy} className={AUTH_BUTTON}>
          {busy ? (
            <Busy>Sending code…</Busy>
          ) : (
            <span className="flex items-center justify-center gap-2">
              Send verification code
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </button>

        {!isSignup && device && !device.locked && (
          <button
            type="button"
            onClick={() => {
              setUseCode(false);
              setError(null);
            }}
            className="w-full font-label text-xs text-on-surface-variant hover:text-primary"
          >
            Use my PIN instead
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => {
          setStep('phone');
          setOtp('');
          setError(null);
        }}
        className="flex items-center gap-1.5 font-label text-xs font-semibold text-on-surface-variant hover:text-on-surface"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {phoneVal.code} {phoneVal.national}
      </button>

      <div className="space-y-2">
        <label htmlFor="otp-code" className={AUTH_LABEL}>
          Verification Code
        </label>
        <div className="relative">
          <ShieldCheck className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
          <input
            id="otp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="Enter 6-digit code"
            className={`${AUTH_INPUT} pl-10 tracking-[0.3em]`}
            value={otp}
            onChange={(e) => setOtp(onlyDigits(e.target.value, 6))}
            onKeyDown={(e) => e.key === 'Enter' && !isSignup && verify()}
          />
        </div>
        {receipt?.sentTo && (
          <p data-testid="code-sent-to" className="font-label text-[11px] text-on-surface-variant/70">
            {sentByText(receipt)}
            <span className="font-bold">{receipt.sentTo}</span>. It expires in{' '}
            {Math.round(receipt.expiresInSeconds / 60)} minutes.
          </p>
        )}
      </div>

      {needs2fa && (
        <div className="space-y-2">
          <label htmlFor="otp-2fa" className={AUTH_LABEL}>
            Two-factor
          </label>
          <input
            id="otp-2fa"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="6 digits from your authenticator app"
            className={AUTH_INPUT}
            value={twoFactorCode}
            onChange={(e) => setTwoFactorCode(onlyDigits(e.target.value, 6))}
            onKeyDown={(e) => e.key === 'Enter' && twoFactorCode.length === 6 && verify()}
          />
          <p className="font-label text-[11px] text-on-surface-variant/70">
            Two-factor sign-in is on for this account. Enter what your authenticator app shows.
          </p>
        </div>
      )}

      {/* New number → collect the patient's basics to create their profile */}
      {isSignup && (
        <div className="space-y-3 rounded-xl bg-surface-container/40 p-3">
          <p className="font-label text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">
            Your details
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="otp-first" className={AUTH_LABEL}>First Name *</label>
              <input id="otp-first" placeholder="John" className={AUTH_INPUT} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label htmlFor="otp-last" className={AUTH_LABEL}>Last Name</label>
              <input id="otp-last" placeholder="Doe" className={AUTH_INPUT} value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="otp-gender" className={AUTH_LABEL}>Gender</label>
              <select
                id="otp-gender"
                className={AUTH_INPUT}
                value={gender}
                onChange={(e) => setGender(e.target.value as 'male' | 'female' | 'other')}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="otp-dob" className={AUTH_LABEL}>Date of Birth</label>
              <input id="otp-dob" type="date" className={AUTH_INPUT} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {errorBox}

      <button
        type="button"
        onClick={verify}
        disabled={busy || (needs2fa && twoFactorCode.length !== 6)}
        className={AUTH_BUTTON}
      >
        {busy ? (
          <Busy>Verifying…</Busy>
        ) : (
          <span className="flex items-center justify-center gap-2">
            {isSignup ? 'Verify & create account' : 'Verify & sign in'}
            <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={sendCode}
        disabled={busy || resendIn > 0}
        className="w-full font-label text-xs text-on-surface-variant hover:text-primary disabled:hover:text-on-surface-variant"
      >
        {resendIn > 0 ? `You can ask for a new code in ${resendIn}s` : "Didn't get a code? Resend"}
      </button>
    </div>
  );
}
