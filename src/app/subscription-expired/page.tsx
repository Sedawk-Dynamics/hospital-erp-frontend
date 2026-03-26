'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CreditCard, LogOut, Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { useMySubscription } from '@/hooks/use-subscriptions';

export default function SubscriptionExpiredPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { data: subData, isLoading } = useMySubscription();

  // If user has an active subscription, redirect them away
  useEffect(() => {
    if (!isLoading && subData?.active) {
      router.replace('/select-hospital');
    }
  }, [isLoading, subData, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Don't render if subscription is active (redirect will happen)
  if (subData?.active) return null;

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-lg w-full space-y-6">
        {/* Icon + Title */}
        <div className="text-center">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-error/10 mx-auto mb-4">
            <AlertTriangle className="h-10 w-10 text-error" />
          </div>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface">
            Subscription Expired
          </h1>
          <p className="mt-2 font-label text-sm text-on-surface-variant max-w-sm mx-auto">
            Your subscription has expired. To continue using Hospital ERP, please select a plan and complete payment.
          </p>
        </div>

        {/* User info */}
        {user && (
          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 text-center">
            <p className="font-label text-sm font-bold text-on-surface">
              {user.firstName} {user.lastName}
            </p>
            <p className="font-label text-xs text-on-surface-variant">{user.email}</p>
          </div>
        )}

        {/* Actions */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6 space-y-3">
          <Link href="/manage-subscription" className="block">
            <Button className="w-full gap-2 h-12 text-base" size="lg">
              <CreditCard className="h-4 w-4" />
              Manage Subscription
            </Button>
          </Link>

          <Link href="/contact" className="block">
            <Button variant="outline" className="w-full gap-2 h-11" size="lg">
              <Mail className="h-4 w-4" />
              Contact Support
            </Button>
          </Link>
        </div>

        {/* Help text */}
        <div className="bg-primary/5 rounded-xl p-4">
          <h3 className="font-label text-xs font-bold text-primary mb-2">What can you do?</h3>
          <ul className="space-y-1.5 font-label text-xs text-on-surface-variant">
            <li>- <strong>Choose a plan</strong> and pay to reactivate your account</li>
            <li>- <strong>Contact support</strong> if you need help with your subscription</li>
          </ul>
        </div>

        {/* Sign out */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 font-label text-sm text-on-surface-variant hover:text-error transition-colors py-2"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
