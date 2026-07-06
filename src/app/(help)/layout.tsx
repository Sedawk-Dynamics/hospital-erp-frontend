'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

// Standalone auth-guarded shell for the in-app User Guide (/help). Deliberately
// NOT inside (modules) — so it's reachable by every logged-in surface (module
// roles, super-admin AND patients) without needing a selected clinic.
export default function HelpLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, _hydrated, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (_hydrated && !isAuthenticated) router.replace('/login');
  }, [_hydrated, isAuthenticated, router]);

  if (!_hydrated || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-outline-variant/30 bg-background/85 px-4 backdrop-blur-xl sm:px-8">
        <button
          onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <p className="font-headline text-sm font-bold text-on-surface">User Guide</p>
            <p className="font-label text-[10px] text-on-surface-variant">Roles &amp; the Support Assistant</p>
          </div>
        </div>
      </header>
      <main className="sanctuary-scrollbar">{children}</main>
    </div>
  );
}
