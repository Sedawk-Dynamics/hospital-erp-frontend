'use client'; // Error boundaries must be Client Components

// Gap 297: a render error on My Account used to leave a blank screen. Show what
// happened and let the user retry (Next 16 `retry` re-fetches and re-renders).

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MyAccountError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error('My Account failed to render', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md space-y-4 rounded-xl bg-surface-container-lowest p-8 text-center shadow-sanctuary">
        <AlertTriangle className="mx-auto h-8 w-8 text-error" />
        <h1 className="font-headline text-lg font-bold">Couldn&apos;t load your account</h1>
        <p className="font-label text-sm text-on-surface-variant">
          Something went wrong while showing this page. Try again — if it keeps happening, sign out and
          back in.
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={() => retry()}>Retry</Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/select-hospital" />}>
            Back
          </Button>
        </div>
      </div>
    </div>
  );
}
