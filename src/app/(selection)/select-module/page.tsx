'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { getAutoRouteForRole } from '@/config/role-modules';

/**
 * Legacy module selection page — now redirects to the first permitted module.
 * Kept for backward compatibility (bookmarks, browser history).
 */
export default function SelectModulePage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    const route = getAutoRouteForRole(user?.role?.slug) || '/hospital';
    router.replace(route);
  }, [user, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
