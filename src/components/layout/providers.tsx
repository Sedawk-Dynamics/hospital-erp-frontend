'use client';

import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useClinicStore } from '@/stores/clinic-store';
import { applyFreshnessPolicies, shouldResetCache, type CacheIdentity } from '@/lib/query-config';

/**
 * Throws the cache away when it stops belonging to the person looking at it.
 *
 * Query keys carry no user and no hospital, so switching either one leaves a
 * cache full of somebody else's rows. Watching both stores in one place means
 * every route that can switch hospital — or log out — is covered, including any
 * added later.
 */
function CacheIdentityBoundary() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const tenantId = useClinicStore((s) => s.selectedClinic?.id ?? null);
  const previous = useRef<CacheIdentity | null>(null);

  useEffect(() => {
    const next: CacheIdentity = { userId, tenantId };
    const stale = shouldResetCache(previous.current, next);
    previous.current = next;
    if (stale) queryClient.clear();
  }, [userId, tenantId, queryClient]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          // 15s, not 60s. Long enough to absorb a burst of mounts from one
          // page and React's double-render in dev, short enough that walking
          // back to a screen shows current data.
          staleTime: 15_000,
          retry: 1,
          // The two that were switched off. Nothing else in this app can carry
          // another user's change into an already-open browser — there is no
          // websocket — so leaving these false meant a doctor could stare at a
          // vitals chart a nurse had already updated and never know.
          refetchOnWindowFocus: true,
          refetchOnReconnect: true,
        },
      },
    });
    // Per-key overrides: live worklists poll, heavy catalogues are held longer.
    applyFreshnessPolicies(client);
    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>
      <CacheIdentityBoundary />
      {children}
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
