'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth-store';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';

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
    try {
      const onboardingStatus = await login(data.email, data.password);
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
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Login failed. Please check your credentials.';
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

        <button
          type="submit"
          className="w-full bg-primary text-on-primary font-label font-bold text-sm px-6 py-3 rounded-xl hover:shadow-lg transition-all animate-fade-in-up h-11"
          style={{ animationDelay: '300ms' }}
          disabled={isSubmitting}
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

      <div className="mt-6 pt-5 border-t border-surface-container text-center">
        <p className="font-label text-sm text-on-surface-variant">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-primary hover:underline font-bold">
            Register as Patient
          </Link>
        </p>
      </div>
    </div>
  );
}
