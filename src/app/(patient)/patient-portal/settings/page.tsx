'use client';

import { useState } from 'react';
import { Bell, Lock, Globe, User, Shield, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
// Page
// ============================================================

export default function PatientSettingsPage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6 animate-fade-in-up max-w-2xl">
      <h1 className="text-xl font-bold text-foreground">Settings</h1>

      {/* Profile Section */}
      <ProfileSection />

      {/* Change Password */}
      <ChangePasswordSection />

      {/* Notification Preferences */}
      <NotificationPreferencesSection />

      {/* Security / 2FA */}
      <SecuritySection />

      {/* Language */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" /> Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Language</p>
              <p className="text-xs text-muted-foreground">Display language for the portal</p>
            </div>
            <span className="text-sm text-muted-foreground">English</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Profile Section
// ============================================================

function ProfileSection() {
  const { user } = useAuthStore();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <User className="h-4 w-4 text-primary" /> Profile Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs text-muted-foreground">Full Name</Label>
            <p className="text-sm font-medium text-foreground mt-1">
              {user?.firstName} {user?.lastName}
            </p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <p className="text-sm font-medium text-foreground mt-1">
              {user?.email ?? '-'}
            </p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Phone</Label>
            <p className="text-sm font-medium text-foreground mt-1">
              {user?.phone ?? '-'}
            </p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Role</Label>
            <p className="text-sm font-medium text-foreground mt-1 capitalize">
              {user?.role?.name?.replace(/_/g, ' ') ?? '-'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
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
      const message =
        err instanceof Error ? err.message : 'Failed to change password';
      toast.error(message);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" /> Change Password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-sm">
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword" className="text-sm">Current Password</Label>
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="newPassword" className="text-sm">New Password</Label>
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-xs text-destructive">{errors.newPassword.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-sm">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm new password"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting} size="sm">
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      </CardContent>
    </Card>
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
      // Persist locally
      if (typeof window !== 'undefined') {
        localStorage.setItem('notification_prefs', JSON.stringify(updated));
      }
      return updated;
    });
    toast.success('Preference updated');
  };

  // Load persisted prefs on mount
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" /> Notification Preferences
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map((pref) => (
            <div key={pref.key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{pref.label}</p>
                <p className="text-xs text-muted-foreground">{pref.desc}</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={prefs[pref.key]}
                  onChange={() => toggle(pref.key)}
                  className="peer sr-only"
                />
                <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-primary transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
              </label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" /> Security
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 2FA Status */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Two-Factor Authentication</p>
            <p className="text-xs text-muted-foreground">
              {is2FAEnabled
                ? 'Your account is protected with 2FA'
                : 'Add an extra layer of security to your account'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                is2FAEnabled
                  ? 'bg-green-100 text-green-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
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
          <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
            <p className="text-sm font-medium text-foreground">Setup Two-Factor Authentication</p>

            {qrCodeUrl && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs text-muted-foreground text-center">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </p>
                <img src={qrCodeUrl} alt="2FA QR Code" className="h-48 w-48 rounded-lg border bg-white p-2" />
              </div>
            )}

            {secret && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Or enter this key manually:</p>
                <code className="rounded bg-muted px-3 py-1 text-sm font-mono tracking-wider select-all">
                  {secret}
                </code>
              </div>
            )}

            <form onSubmit={handleSubmit(handleVerify2FA)} className="flex items-end gap-3 max-w-xs mx-auto">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="totp-token" className="text-sm">Verification Code</Label>
                <Input
                  id="totp-token"
                  placeholder="000000"
                  maxLength={6}
                  {...register('token')}
                  className="text-center tracking-widest font-mono"
                />
                {verifyErrors.token && (
                  <p className="text-xs text-destructive">{verifyErrors.token.message}</p>
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
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
