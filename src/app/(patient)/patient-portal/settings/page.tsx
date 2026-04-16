'use client';

import { useState } from 'react';
import { Bell, Lock, Globe, User, Shield, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth-store';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiPost } from '@/lib/api';
import { toast } from 'sonner';

// ============================================================
// Schemas
// ============================================================

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

const verifyTotpSchema = z.object({
  token: z.string().min(6, 'Enter the 6-digit code').max(6, 'Enter the 6-digit code'),
});

type VerifyTotpForm = z.infer<typeof verifyTotpSchema>;

// ============================================================
// Helpers — shared Sanctuary section wrapper
// ============================================================

function SanctuarySection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof User;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-6">
      <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </h2>
      {children}
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export default function PatientSettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-2">
          Account
        </p>
        <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
          Settings
        </h1>
        <p className="font-label text-sm text-on-surface-variant mt-1.5">
          Manage your profile, security, and notification preferences
        </p>
      </div>

      <ProfileSection />
      <ChangePasswordSection />
      <NotificationPreferencesSection />
      <SecuritySection />

      <SanctuarySection icon={Globe} title="Preferences">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-label text-sm font-bold text-on-surface">Language</p>
            <p className="font-label text-xs text-on-surface-variant">
              Display language for the portal
            </p>
          </div>
          <span className="font-label text-sm text-on-surface-variant">English</span>
        </div>
      </SanctuarySection>
    </div>
  );
}

// ============================================================
// Profile Section
// ============================================================

function ProfileSection() {
  const { user } = useAuthStore();

  return (
    <SanctuarySection icon={User} title="Profile Information">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="font-label text-xs text-on-surface-variant">Full Name</Label>
          <p className="font-label text-sm font-bold text-on-surface mt-1">
            {user?.firstName} {user?.lastName}
          </p>
        </div>
        <div>
          <Label className="font-label text-xs text-on-surface-variant">Email</Label>
          <p className="font-label text-sm font-bold text-on-surface mt-1">{user?.email ?? '-'}</p>
        </div>
        <div>
          <Label className="font-label text-xs text-on-surface-variant">Phone</Label>
          <p className="font-label text-sm font-bold text-on-surface mt-1">{user?.phone ?? '-'}</p>
        </div>
        <div>
          <Label className="font-label text-xs text-on-surface-variant">Role</Label>
          <p className="font-label text-sm font-bold text-on-surface mt-1 capitalize">
            {user?.role?.name?.replace(/_/g, ' ') ?? '-'}
          </p>
        </div>
      </div>
    </SanctuarySection>
  );
}

// ============================================================
// Change Password Section
// ============================================================

function ChangePasswordSection() {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ChangePasswordForm) => {
    try {
      await apiPost('/auth/reset-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success('Password changed successfully');
      reset();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to change password';
      toast.error(message);
    }
  };

  return (
    <SanctuarySection icon={Lock} title="Change Password">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-sm">
        <div className="space-y-1.5">
          <Label htmlFor="currentPassword" className="text-sm">
            Current Password
          </Label>
          <div className="relative">
            <Input
              id="currentPassword"
              type={showCurrent ? 'text' : 'password'}
              placeholder="Enter current password"
              {...register('currentPassword')}
              className="pr-9"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
            >
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.currentPassword && (
            <p className="font-label text-xs text-error">{errors.currentPassword.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="newPassword" className="text-sm">
            New Password
          </Label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showNew ? 'text' : 'password'}
              placeholder="Enter new password"
              {...register('newPassword')}
              className="pr-9"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.newPassword && (
            <p className="font-label text-xs text-error">{errors.newPassword.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-sm">
            Confirm New Password
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Confirm new password"
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className="font-label text-xs text-error">{errors.confirmPassword.message}</p>
          )}
        </div>

        <Button type="submit" disabled={isSubmitting} size="sm">
          {isSubmitting ? 'Updating...' : 'Update Password'}
        </Button>
      </form>
    </SanctuarySection>
  );
}

// ============================================================
// Notification Preferences Section
// ============================================================

function NotificationPreferencesSection() {
  const [prefs, setPrefs] = useState({
    appointmentReminders: true,
    labReportReady: true,
    prescriptionUpdates: true,
    billNotifications: true,
    emailNotifications: true,
    smsNotifications: false,
  });

  const toggle = (key: keyof typeof prefs) => {
    setPrefs((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      if (typeof window !== 'undefined') {
        localStorage.setItem('notification_prefs', JSON.stringify(updated));
      }
      return updated;
    });
    toast.success('Preference updated');
  };

  useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('notification_prefs');
        if (saved) {
          const parsed = JSON.parse(saved);
          setPrefs((prev) => ({ ...prev, ...parsed }));
        }
      } catch {
        // ignore
      }
    }
  });

  const items: { key: keyof typeof prefs; label: string; desc: string }[] = [
    { key: 'appointmentReminders', label: 'Appointment Reminders', desc: 'Get reminders before scheduled appointments' },
    { key: 'labReportReady', label: 'Lab Report Ready', desc: 'Notified when lab reports are published' },
    { key: 'prescriptionUpdates', label: 'Prescription Updates', desc: 'When prescriptions are created or modified' },
    { key: 'billNotifications', label: 'Bill Notifications', desc: 'New bills and payment confirmations' },
    { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive notifications via email' },
    { key: 'smsNotifications', label: 'SMS Notifications', desc: 'Receive notifications via SMS' },
  ];

  return (
    <SanctuarySection icon={Bell} title="Notification Preferences">
      <div className="space-y-4">
        {items.map((pref) => (
          <div key={pref.key} className="flex items-center justify-between">
            <div>
              <p className="font-label text-sm font-bold text-on-surface">{pref.label}</p>
              <p className="font-label text-xs text-on-surface-variant">{pref.desc}</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={prefs[pref.key]}
                onChange={() => toggle(pref.key)}
                className="peer sr-only"
              />
              <div className="h-5 w-9 rounded-full bg-surface-container-high peer-checked:bg-primary transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
            </label>
          </div>
        ))}
      </div>
    </SanctuarySection>
  );
}

// ============================================================
// Security / 2FA Section
// ============================================================

function SecuritySection() {
  const [twoFAState, setTwoFAState] = useState<'idle' | 'setup' | 'verify'>('idle');
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);

  const {
    register,
    handleSubmit,
    reset: resetVerifyForm,
    formState: { errors: verifyErrors, isSubmitting: isVerifying },
  } = useForm<VerifyTotpForm>({
    resolver: zodResolver(verifyTotpSchema),
    defaultValues: { token: '' },
  });

  const handleSetup2FA = async () => {
    try {
      const response = await apiPost<{ qrCodeUrl: string; secret: string }>('/auth/2fa/setup');
      setQrCodeUrl(response.data?.qrCodeUrl ?? null);
      setSecret(response.data?.secret ?? null);
      setTwoFAState('verify');
      toast.info('Scan the QR code with your authenticator app');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to setup 2FA';
      toast.error(message);
    }
  };

  const handleVerify2FA = async (data: VerifyTotpForm) => {
    try {
      await apiPost('/auth/2fa/verify', { token: data.token });
      toast.success('Two-Factor Authentication enabled successfully');
      setIs2FAEnabled(true);
      setTwoFAState('idle');
      setQrCodeUrl(null);
      setSecret(null);
      resetVerifyForm();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid verification code';
      toast.error(message);
    }
  };

  const handleDisable2FA = async () => {
    try {
      await apiPost('/auth/2fa/disable');
      toast.success('Two-Factor Authentication disabled');
      setIs2FAEnabled(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to disable 2FA';
      toast.error(message);
    }
  };

  return (
    <SanctuarySection icon={Shield} title="Security">
      <div className="space-y-4">
        {/* 2FA Status */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-label text-sm font-bold text-on-surface">Two-Factor Authentication</p>
            <p className="font-label text-xs text-on-surface-variant">
              {is2FAEnabled
                ? 'Your account is protected with 2FA'
                : 'Add an extra layer of security to your account'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={
                'text-[10px] font-bold font-label px-2 py-0.5 rounded-full capitalize ' +
                (is2FAEnabled
                  ? 'bg-primary/10 text-primary'
                  : 'bg-secondary/10 text-secondary')
              }
            >
              {is2FAEnabled ? 'Enabled' : 'Disabled'}
            </span>
            {is2FAEnabled ? (
              <Button variant="outline" size="sm" onClick={handleDisable2FA}>
                Disable
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSetup2FA}
                disabled={twoFAState === 'verify'}
              >
                Enable
              </Button>
            )}
          </div>
        </div>

        {/* 2FA Setup Flow */}
        {twoFAState === 'verify' && (
          <div className="rounded-xl bg-surface-container-low p-5 space-y-4">
            <p className="font-label text-sm font-bold text-on-surface">
              Setup Two-Factor Authentication
            </p>

            {qrCodeUrl && (
              <div className="flex flex-col items-center gap-3">
                <p className="font-label text-xs text-on-surface-variant text-center">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </p>
                <img
                  src={qrCodeUrl}
                  alt="2FA QR Code"
                  className="h-48 w-48 rounded-lg border border-outline-variant/30 bg-white p-2"
                />
              </div>
            )}

            {secret && (
              <div className="text-center">
                <p className="font-label text-xs text-on-surface-variant mb-1">
                  Or enter this key manually:
                </p>
                <code className="rounded bg-surface-container-high px-3 py-1 text-sm font-mono tracking-wider select-all">
                  {secret}
                </code>
              </div>
            )}

            <form
              onSubmit={handleSubmit(handleVerify2FA)}
              className="flex items-end gap-3 max-w-xs mx-auto"
            >
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="totp-token" className="text-sm">
                  Verification Code
                </Label>
                <Input
                  id="totp-token"
                  placeholder="000000"
                  maxLength={6}
                  {...register('token')}
                  className="text-center tracking-widest font-mono"
                />
                {verifyErrors.token && (
                  <p className="font-label text-xs text-error">{verifyErrors.token.message}</p>
                )}
              </div>
              <Button type="submit" size="sm" disabled={isVerifying}>
                {isVerifying ? 'Verifying...' : 'Verify'}
              </Button>
            </form>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setTwoFAState('idle');
                  setQrCodeUrl(null);
                  setSecret(null);
                  resetVerifyForm();
                }}
                className="font-label text-xs text-on-surface-variant hover:text-on-surface underline"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </SanctuarySection>
  );
}
