'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth-store';
import { ArrowRight, Eye, EyeOff, Phone, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PhoneOtpForm } from '../_components/phone-otp-form';
import { describeSignInError } from '../_components/sign-in-error';

const loginSchema = z.object({
  email: z.email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Shown inline under the form, so the reason stays visible after the toast.
  const [signInError, setSignInError] = useState<string | null>(null);
  // Patients sign in with phone + OTP; staff use email + password.
  const [mode, setMode] = useState<'patient' | 'staff'>('patient');
  // Gap 297: accounts with two-factor sign-in on are asked for an app code
  // after the password (the server answers 2FA_REQUIRED).
  const [needs2fa, setNeeds2fa] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    setSignInError(null);
    try {
      if (needs2fa) await login(data.email, data.password, twoFactorCode);
      else await login(data.email, data.password);
      toast.success('Login successful! Redirecting...');
      const loggedInUser = useAuthStore.getState().user;
      const roleSlug = loggedInUser?.role?.slug || loggedInUser?.roles?.[0];

      // Super admin goes straight to the platform panel — no onboarding, no hospital selection
      if (roleSlug === 'super_admin') {
        router.push('/super-admin');
        return;
      }

      if (roleSlug === 'patient') {
        router.push('/patient-portal');
        return;
      }

      // Hospital admins go to hospital selection
      router.push('/select-hospital');
    } catch (error: unknown) {
      if ((error as { response?: { data?: { code?: string } } })?.response?.data?.code === '2FA_REQUIRED') {
        // Password was right; now ask for the authenticator code.
        setNeeds2fa(true);
        setTwoFactorCode('');
        setSignInError(null);
        return;
      }
      // Gaps 370/371: stay on the Staff tab with the email kept, and say what
      // actually went wrong — a wrong password, an unreachable server and a
      // login-service fault each get their own message.
      const message = describeSignInError(error);
      setSignInError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-8 animate-fade-in-up">
      <div className="text-center mb-6">
        <h2 className="font-headline text-2xl font-extrabold tracking-tight">Welcome back</h2>
        <p className="font-label text-sm text-on-surface-variant mt-1">
          Sign in to continue to your dashboard
        </p>
      </div>

      {/* Patient (phone OTP) vs Staff (email/password) */}
      <div className="mb-5 flex gap-1 rounded-xl bg-surface-container p-1">
        <button
          type="button"
          onClick={() => setMode('patient')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-label text-sm font-semibold transition-all',
            mode === 'patient' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface',
          )}
        >
          <Phone className="h-3.5 w-3.5" />
          Patient
        </button>
        <button
          type="button"
          onClick={() => setMode('staff')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-label text-sm font-semibold transition-all',
            mode === 'staff' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface',
          )}
        >
          <Building2 className="h-3.5 w-3.5" />
          Staff
        </button>
      </div>

      {mode === 'patient' ? (
        <PhoneOtpForm mode="login" />
      ) : (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <Label htmlFor="email" className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Email</Label>
          <input
            id="email"
            type="email"
            placeholder="doctor@hospital.com"
            className="bg-surface-container-low border-none rounded-xl px-4 py-2.5 w-full font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
            {...register('email')}
          />
          {errors.email && (
            <p className="font-label text-xs text-error">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Password</Label>
            <Link
              href="/forgot-password"
              className="font-label text-xs text-primary hover:underline font-bold"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              className="bg-surface-container-low border-none rounded-xl px-4 py-2.5 pr-10 w-full font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="font-label text-xs text-error">{errors.password.message}</p>
          )}
        </div>

        {needs2fa && (
          <div className="space-y-2">
            <Label htmlFor="twoFactorCode" className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest">
              Two-factor code
            </Label>
            <input
              id="twoFactorCode"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="6-digit code from your authenticator app"
              className="bg-surface-container-low border-none rounded-xl px-4 py-2.5 w-full font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <p className="font-label text-xs text-on-surface-variant">
              Two-factor sign-in is on for this account. Enter the code your authenticator app shows.
            </p>
          </div>
        )}

        {signInError && (
          <p role="alert" className="rounded-xl bg-error/10 px-4 py-2.5 font-label text-sm text-error">
            {signInError}
          </p>
        )}

        <button
          type="submit"
          className="w-full bg-primary text-on-primary font-label font-bold text-sm px-6 py-3 rounded-xl hover:shadow-lg transition-all animate-fade-in-up h-11"
          style={{ animationDelay: '300ms' }}
          disabled={isSubmitting || (needs2fa && twoFactorCode.length !== 6)}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Signing in...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              Continue
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </button>
      </form>
      )}

      {mode === 'patient' ? (
        <div className="mt-6 pt-5 border-t border-surface-container text-center">
          <p className="font-label text-sm text-on-surface-variant">
            New patient?{' '}
            <Link href="/register" className="text-primary hover:underline font-bold">
              Create an account
            </Link>
          </p>
        </div>
      ) : (
        <div className="mt-6 pt-5 border-t border-surface-container text-center">
          <p className="font-label text-sm text-on-surface-variant">
            Are you a patient?{' '}
            <button
              type="button"
              onClick={() => setMode('patient')}
              className="text-primary hover:underline font-bold"
            >
              Sign in with phone
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
