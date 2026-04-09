'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

export default function ManageSubscriptionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { hydrate, _hydrated, isAuthenticated, user, fetchMe } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (_hydrated && user && !user.role) {
      fetchMe();
    }
  }, [_hydrated, user, fetchMe]);

  useEffect(() => {
    if (!_hydrated) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    const roleSlug = user?.role?.name?.toLowerCase().replace(/[\s-]+/g, '_') ?? '';
    if (roleSlug !== 'admin' && roleSlug !== 'super_admin') {
      router.push('/select-hospital');
    }
  }, [_hydrated, isAuthenticated, user, router]);

  if (!_hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const roleSlug = user?.role?.name?.toLowerCase().replace(/[\s-]+/g, '_') ?? '';
  if (!isAuthenticated || (roleSlug !== 'admin' && roleSlug !== 'super_admin')) {
    return null;
  }

  return <>{children}</>;
}
