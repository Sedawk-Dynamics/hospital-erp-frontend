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
import { UserPlus, Eye, EyeOff, HeartPulse } from 'lucide-react';

const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.email('Please enter a valid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/,
      'Must include uppercase, lowercase, number, and special character (@$!%*?&#)',
    ),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function PatientRegisterPage() {
  const router = useRouter();
  const { register: registerUser } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsSubmitting(true);
    try {
      await registerUser({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || undefined,
        password: data.password,
      });
      toast.success('Account created successfully! Please sign in.');
      router.push('/login');
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Registration failed. Please try again.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-8 animate-fade-in-up">
      <div className="text-center mb-6">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <HeartPulse className="h-6 w-6 text-primary" />
        </div>
        <h2 className="font-headline text-2xl font-extrabold tracking-tight">Create Your Account</h2>
        <p className="font-label text-sm text-on-surface-variant mt-1">
          Sign up as a patient to access your health records, appointments, and more
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div className="space-y-2">
            <Label htmlFor="firstName" className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest">First Name</Label>
            <input
              id="firstName"
              placeholder="John"
              className="bg-surface-container-low border-none rounded-xl px-4 py-2.5 w-full font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
              {...register('firstName')}
            />
            {errors.firstName && (
              <p className="font-label text-xs text-error">{errors.firstName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Last Name</Label>
            <input
              id="lastName"
              placeholder="Doe"
              className="bg-surface-container-low border-none rounded-xl px-4 py-2.5 w-full font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
              {...register('lastName')}
            />
            {errors.lastName && (
              <p className="font-label text-xs text-error">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <Label htmlFor="email" className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Email</Label>
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            className="bg-surface-container-low border-none rounded-xl px-4 py-2.5 w-full font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
            {...register('email')}
          />
          {errors.email && (
            <p className="font-label text-xs text-error">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '250ms' }}>
          <Label htmlFor="phone" className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Phone Number</Label>
          <input
            id="phone"
            type="tel"
            placeholder="+91 98765 43210"
            className="bg-surface-container-low border-none rounded-xl px-4 py-2.5 w-full font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
            {...register('phone')}
          />
          {errors.phone ? (
            <p className="font-label text-xs text-error">{errors.phone.message}</p>
          ) : (
            <p className="font-label text-[11px] text-on-surface-variant/70">
              Use the number you gave at the hospital — it links your and your family&apos;s
              records to this account automatically.
            </p>
          )}
        </div>

        <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <Label htmlFor="password" className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Password</Label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Min 8 chars, uppercase, number, special"
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

        <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '350ms' }}>
          <Label htmlFor="confirmPassword" className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Confirm Password</Label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Repeat your password"
              className="bg-surface-container-low border-none rounded-xl px-4 py-2.5 pr-10 w-full font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
              {...register('confirmPassword')}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="font-label text-xs text-error">{errors.confirmPassword.message}</p>
          )}
        </div>

        <button
          type="submit"
          className="w-full bg-primary text-on-primary font-label font-bold text-sm px-6 py-3 rounded-xl hover:shadow-lg transition-all animate-fade-in-up h-11"
          style={{ animationDelay: '400ms' }}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Creating account...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <UserPlus className="h-4 w-4" />
              Create Patient Account
            </span>
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-surface-container text-center">
        <p className="font-label text-sm text-on-surface-variant">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline font-bold">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
