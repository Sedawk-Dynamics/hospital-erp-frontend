'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

export default function HomePage() {
  const router = useRouter();
  const { hydrate, _hydrated, isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!_hydrated) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    const roleSlug = user?.role?.slug || user?.roles?.[0];
    if (roleSlug === 'super_admin') {
      router.push('/super-admin');
    } else {
      router.push('/select-clinic');
    }
  }, [_hydrated, isAuthenticated, user, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
