'use client';

// Gap 297: /my-account rendered blank on a direct load or refresh. Unlike every
// other signed-in area it had no layout, so nothing hydrated the auth store
// from localStorage — `user` stayed null and the page never got past its
// loading state. This mirrors the other top-level layouts, without their
// role restriction: every signed-in user has an account page.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useClinicStore } from '@/stores/clinic-store';

export default function MyAccountLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { hydrate, _hydrated, isAuthenticated } = useAuthStore();
  const hydrateClinic = useClinicStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    hydrateClinic();
  }, [hydrate, hydrateClinic]);

  useEffect(() => {
    if (_hydrated && !isAuthenticated) router.push('/login');
  }, [_hydrated, isAuthenticated, router]);

  if (!_hydrated || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
