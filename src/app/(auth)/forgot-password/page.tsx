'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Mail } from 'lucide-react';
import apiClient from '@/lib/api-client';

const forgotPasswordSchema = z.object({
  email: z.email('Please enter a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsSubmitting(true);
    try {
      await apiClient.post('/auth/forgot-password', { email: data.email });
      setIsEmailSent(true);
      toast.success('Password reset email sent!');
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to send reset email. Please try again.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEmailSent) {
    return (
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-8 animate-fade-in-up text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-7 w-7 text-primary" />
        </div>
        <h2 className="font-headline text-2xl font-extrabold tracking-tight">Check Your Email</h2>
        <p className="font-label text-sm text-on-surface-variant mt-2 mb-6">
          We&apos;ve sent a password reset link to your email address. Please check your inbox and follow the instructions.
        </p>
        <Link href="/login">
          <button className="inline-flex items-center gap-2 font-label text-sm font-bold text-primary hover:text-primary-container transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Sign In
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-8 animate-fade-in-up">
      <div className="text-center mb-6">
        <h2 className="font-headline text-2xl font-extrabold tracking-tight">Forgot Password</h2>
        <p className="font-label text-sm text-on-surface-variant mt-1">
          Enter your email address and we&apos;ll send you a link to reset your password
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <Label htmlFor="email" className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Email Address</Label>
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

        <button
          type="submit"
          className="w-full bg-primary text-on-primary font-label font-bold text-sm px-6 py-3 rounded-xl hover:shadow-lg transition-all animate-fade-in-up"
          style={{ animationDelay: '200ms' }}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Sending...
            </span>
          ) : (
            'Send Reset Link'
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-surface-container text-center">
        <Link href="/login">
          <button className="inline-flex items-center gap-2 font-label text-sm font-bold text-primary hover:text-primary-container transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Sign In
          </button>
        </Link>
      </div>
    </div>
  );
}
