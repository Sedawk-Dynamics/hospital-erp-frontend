'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirects to the unified /select-hospital page which now
 * combines both hospital management and selection functionality.
 */
export default function MyHospitalsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/select-hospital');
  }, [router]);

  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
