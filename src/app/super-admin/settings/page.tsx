'use client';

import { useAuthStore } from '@/stores/auth-store';
import { Badge } from '@/components/ui/badge';
import { Shield, User, Mail, Phone } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-xl font-bold">Settings</h1>
        <p className="font-label text-sm text-on-surface-variant">Platform configuration and account settings</p>
      </div>

      {/* Profile Card */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
        <div className="pb-4 mb-4 border-b border-surface-container">
          <h2 className="font-headline text-lg font-bold text-on-surface flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </div>
            Account Information
          </h2>
          <p className="font-label text-sm text-on-surface-variant mt-1">Your super admin account details</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Name</p>
            <p className="font-label text-sm font-bold text-on-surface">{user?.firstName} {user?.lastName}</p>
          </div>
          <div className="space-y-1">
            <p className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest flex items-center gap-1">
              <Mail className="h-3 w-3" /> Email
            </p>
            <p className="font-label text-sm font-bold text-on-surface">{user?.email}</p>
          </div>
          <div className="space-y-1">
            <p className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest flex items-center gap-1">
              <Phone className="h-3 w-3" /> Phone
            </p>
            <p className="font-label text-sm font-bold text-on-surface">{user?.phone || 'Not set'}</p>
          </div>
          <div className="space-y-1">
            <p className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest flex items-center gap-1">
              <Shield className="h-3 w-3" /> Role
            </p>
            <Badge>{user?.role?.name || 'Super Admin'}</Badge>
          </div>
        </div>
      </div>

      {/* Platform Settings */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
        <div className="pb-4 mb-4 border-b border-surface-container">
          <h2 className="font-headline text-lg font-bold text-on-surface">Platform Configuration</h2>
          <p className="font-label text-sm text-on-surface-variant mt-1">Global settings for the SaaS platform</p>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-surface-container-low rounded-xl px-4 py-3">
            <div>
              <p className="font-label text-sm font-bold text-on-surface">Platform Name</p>
              <p className="font-label text-xs text-on-surface-variant">Display name for the platform</p>
            </div>
            <p className="font-label text-sm text-on-surface">Hospital ERP</p>
          </div>
          <div className="flex items-center justify-between bg-surface-container-low rounded-xl px-4 py-3">
            <div>
              <p className="font-label text-sm font-bold text-on-surface">Default Currency</p>
              <p className="font-label text-xs text-on-surface-variant">Used for billing and subscriptions</p>
            </div>
            <p className="font-label text-sm text-on-surface">INR</p>
          </div>
          <div className="flex items-center justify-between bg-surface-container-low rounded-xl px-4 py-3">
            <div>
              <p className="font-label text-sm font-bold text-on-surface">Max Tenants</p>
              <p className="font-label text-xs text-on-surface-variant">Maximum number of hospitals</p>
            </div>
            <p className="font-label text-sm text-on-surface">Unlimited</p>
          </div>
        </div>
      </div>
    </div>
  );
}
