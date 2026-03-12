'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';

export function useAuth() {
  const store = useAuthStore();

  useEffect(() => {
    // Wait until hydration is complete before attempting fetchMe
    if (!store._hydrated) return;
    if (!store.isAuthenticated && !store.user) {
      store.fetchMe();
    }
  }, [store._hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  return store;
}
