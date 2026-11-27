'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import apiClient from '@/lib/api-client';

// The same rule the server applies.
const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Use at least 8 characters')
      .max(128, 'Use at most 128 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/,
        'Include an uppercase letter, a lowercase letter, a number and a special character (@$!%*?&#)',
      ),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { message: 'The two passwords do not match', path: ['confirm'] });

type FormData = z.infer<typeof schema>;

const CARD = 'bg-surface-container-lowest rounded-xl shadow-sanctuary p-8 animate-fade-in-up';
const FIELD =
  'bg-surface-container-low border-none rounded-xl px-4 py-2.5 w-full font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60';
const LABEL = 'font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest';

function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 font-label text-sm font-bold text-primary hover:text-primary-container transition-colors"
    >
      <ArrowLeft className="h-4 w-4" />
      {children}
    </Link>
  );
}

export default function ResetPasswordPage() {
  // undefined = not read yet; the token is in the URL fragment, which only the browser sees.
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { newPassword: '', confirm: '' } });

  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token');
    // Off the address bar and out of the history once read.
    if (value) window.history.replaceState(null, '', window.location.pathname);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the fragment does not exist during server rendering
    setToken((current) => value ?? current ?? null);
  }, []);

  const onSubmit = async (data: FormData) => {
    setError('');
    try {
      await apiClient.post('/auth/reset-password', { token, newPassword: data.newPassword });
      setDone(true);
    } catch (e: unknown) {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'The password could not be changed. Please try again.',
      );
    }
  };

  if (token === undefined) return <div className={CARD} aria-busy="true" />;

  if (done) {
    return (
      <div className={`${CARD} text-center`}>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-7 w-7 text-primary" />
        </div>
        <h2 className="font-headline text-2xl font-extrabold tracking-tight">Password changed</h2>
        <p className="font-label text-sm text-on-surface-variant mt-2 mb-6">
          You have been signed out on your other devices. Sign in with the new password.
        </p>
        <BackLink href="/login">Go to Sign In</BackLink>
      </div>
    );
  }

  if (!token) {
    return (
      <div className={`${CARD} text-center`}>
        <h2 className="font-headline text-2xl font-extrabold tracking-tight">This link is not complete</h2>
        <p className="font-label text-sm text-on-surface-variant mt-2 mb-6">
          Open the link from your email again, or ask for a new one.
        </p>
        <BackLink href="/forgot-password">Ask for a new link</BackLink>
      </div>
    );
  }

  return (
    <div className={CARD}>
      <div className="text-center mb-6">
        <h2 className="font-headline text-2xl font-extrabold tracking-tight">Choose a new password</h2>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="newPassword" className={LABEL}>New password</Label>
          <input id="newPassword" type="password" autoComplete="new-password" className={FIELD} {...register('newPassword')} />
          {errors.newPassword && <p className="font-label text-xs text-error">{errors.newPassword.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm" className={LABEL}>Type it again</Label>
          <input id="confirm" type="password" autoComplete="new-password" className={FIELD} {...register('confirm')} />
          {errors.confirm && <p className="font-label text-xs text-error">{errors.confirm.message}</p>}
        </div>
        {error && (
          <p role="alert" className="font-label text-sm text-error">
            {error} <Link href="/forgot-password" className="font-bold underline">Ask for a new link</Link>
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-primary text-on-primary font-label font-bold text-sm px-6 py-3 rounded-xl hover:shadow-lg transition-all disabled:opacity-60"
        >
          {isSubmitting ? 'Saving...' : 'Change password'}
        </button>
      </form>
    </div>
  );
}
