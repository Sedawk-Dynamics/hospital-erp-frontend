'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLabRole } from '@/hooks/use-lab-role';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Bounce non-supervisors back to /laboratory if they try to deep-link into a
 * supervisor-only page (Reports, Billing, Inventory, Purchase, Settings).
 *
 * Sidebar already hides these for technicians, but URL paste, browser
 * history, and bookmark recall can still land them here. The backend would
 * 403 supervisor-only mutations regardless — this just keeps the UI honest.
 */
export function SupervisorOnlyGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { _hydrated } = useAuthStore();
  const { isSupervisor } = useLabRole();

  useEffect(() => {
    if (_hydrated && !isSupervisor) {
      router.replace('/laboratory');
    }
  }, [_hydrated, isSupervisor, router]);

  if (!_hydrated) return null;
  if (!isSupervisor) return null;
  return <>{children}</>;
}
