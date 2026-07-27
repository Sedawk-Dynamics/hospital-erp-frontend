'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowRight, ArrowLeft, Phone, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

const INPUT_CLASS =
  'bg-surface-container-low border-none rounded-xl px-4 py-2.5 w-full font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60';

/**
 * Patient phone + OTP form, in one of two explicit modes:
 *   - 'login'  → the number MUST already have an account; never creates one.
 *   - 'signup' → the number must NOT have an account; collects details + creates.
 * Each mode has its own page, so login never shows signup fields. On success
 * the user is routed by role (patients → the portal).
 *
 * The OTP is a fixed dev code (123123) until SMS delivery is wired up.
 */
export function PhoneOtpForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const { requestPhoneOtp, loginWithPhoneOtp } = useAuthStore();

  const isSignup = mode === 'signup';

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [busy, setBusy] = useState(false);

  // `phone` holds exactly the 10 local digits; we always send +91 + those.
  const fullPhone = `+91${phone}`;

  const sendCode = async () => {
    if (phone.length !== 10) {
      toast.error('Enter a 10-digit phone number');
      return;
    }
    setBusy(true);
    try {
      const { isExistingUser: exists } = await requestPhoneOtp(fullPhone);
      // Gate each flow to its purpose before sending the user to the code step.
      if (mode === 'login' && !exists) {
        toast.error('No account found for this number. Please sign up first.');
        return;
      }
      if (mode === 'signup' && exists) {
        toast.error('An account already exists for this number. Please sign in.');
        return;
      }
      setStep('otp');
      toast.success('Verification code sent');
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Could not send the code. Please try again.';
      toast.error(message);
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
    if (otp.trim().length < 4) {
      toast.error('Enter the verification code');
      return;
    }
    if (isSignup && !firstName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    setBusy(true);
    try {
      await loginWithPhoneOtp({
        phone: fullPhone,
        otp: otp.trim(),
        intent: mode,
        ...(isSignup
          ? {
              firstName: firstName.trim() || undefined,
              lastName: lastName.trim() || undefined,
              gender,
              dateOfBirth: dateOfBirth || undefined,
            }
          : {}),
      });
      toast.success('Signed in! Redirecting…');
      redirectByRole();
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Invalid code. Please try again.';
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  if (step === 'phone') {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="otp-phone" className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest">
            Phone Number
          </label>
          <div className="relative flex items-center">
            <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
            <span className="pointer-events-none absolute left-9 top-1/2 -translate-y-1/2 font-label text-sm font-semibold text-on-surface">
              +91
            </span>
            <input
              id="otp-phone"
              type="tel"
              inputMode="numeric"
              autoFocus
              maxLength={10}
              placeholder="98765 43210"
              className={`${INPUT_CLASS} pl-[4.25rem] tracking-wider`}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              onKeyDown={(e) => e.key === 'Enter' && sendCode()}
            />
          </div>
          <p className="font-label text-[11px] text-on-surface-variant/70">
            Use the number you gave at the hospital — your and your family&apos;s records are
            linked to it automatically.
          </p>
        </div>

        <button
          type="button"
          onClick={sendCode}
          disabled={busy}
          className="w-full bg-primary text-on-primary font-label font-bold text-sm px-6 py-3 rounded-xl hover:shadow-lg transition-all h-11"
        >
          {busy ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Sending code…
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              Send verification code
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => { setStep('phone'); setOtp(''); }}
        className="flex items-center gap-1.5 font-label text-xs font-semibold text-on-surface-variant hover:text-on-surface"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        +91 {phone}
      </button>

      <div className="space-y-2">
        <label htmlFor="otp-code" className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest">
          Verification Code
        </label>
        <div className="relative">
          <ShieldCheck className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
          <input
            id="otp-code"
            inputMode="numeric"
            autoFocus
            placeholder="Enter 6-digit code"
            className={`${INPUT_CLASS} pl-10 tracking-[0.3em]`}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && !isSignup && verify()}
          />
        </div>
        <p className="font-label text-[11px] text-on-surface-variant/70">
          For testing, use code <span className="font-bold text-primary">123123</span>.
        </p>
      </div>

      {/* New number → collect the patient's basics to create their profile */}
      {isSignup && (
        <div className="space-y-3 rounded-xl bg-surface-container/40 p-3">
          <p className="font-label text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">
            Your details
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="otp-first" className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest">First Name *</label>
              <input id="otp-first" placeholder="John" className={INPUT_CLASS} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label htmlFor="otp-last" className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Last Name</label>
              <input id="otp-last" placeholder="Doe" className={INPUT_CLASS} value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="otp-gender" className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Gender</label>
              <select
                id="otp-gender"
                className={INPUT_CLASS}
                value={gender}
                onChange={(e) => setGender(e.target.value as 'male' | 'female' | 'other')}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="otp-dob" className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Date of Birth</label>
              <input id="otp-dob" type="date" className={INPUT_CLASS} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={verify}
        disabled={busy}
        className="w-full bg-primary text-on-primary font-label font-bold text-sm px-6 py-3 rounded-xl hover:shadow-lg transition-all h-11"
      >
        {busy ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Verifying…
          </span>
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
        disabled={busy}
        className="w-full font-label text-xs text-on-surface-variant hover:text-primary"
      >
        Didn&apos;t get a code? Resend
      </button>
    </div>
  );
}
