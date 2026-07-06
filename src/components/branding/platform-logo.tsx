'use client';

import { useEffect, useState } from 'react';
import { resolveLogoUrl, type PlatformBranding } from '@/hooks/use-branding';

// Self-contained logo renderer that works on EVERY surface — including pre-auth
// screens (login, public website) where the React Query provider may not wrap.
// It fetches the public /platform-branding endpoint once (module-level cache)
// and renders the uploaded logo for the requested placement variant, or the
// provided `fallback` (the built-in icon mark) when no logo is set.

let cache: PlatformBranding | null = null;
let inflight: Promise<PlatformBranding | null> | null = null;

function loadBranding(): Promise<PlatformBranding | null> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
  inflight = fetch(`${apiUrl}/platform-branding`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      cache = (j?.data as PlatformBranding) ?? null;
      return cache;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function PlatformLogo({
  variant = 'light',
  className,
  alt = 'Platform logo',
  fallback,
}: {
  /** 'light' = logo for light backgrounds, 'dark' = logo for dark backgrounds. */
  variant?: 'light' | 'dark';
  className?: string;
  alt?: string;
  /** Rendered when no logo is uploaded for this variant. */
  fallback: React.ReactNode;
}) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    let live = true;
    loadBranding().then((b) => {
      const raw = variant === 'dark' ? b?.logoDarkUrl : b?.logoLightUrl;
      if (live && raw) setUrl(resolveLogoUrl(raw));
    });
    return () => {
      live = false;
    };
  }, [variant]);

  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={alt} className={className} />;
  }
  return <>{fallback}</>;
}
