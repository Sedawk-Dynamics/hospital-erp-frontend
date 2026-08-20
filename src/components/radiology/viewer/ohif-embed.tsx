'use client';

// Embeds the OHIF viewer in an iframe. When the deployment routes PACS traffic
// through the authenticating proxy (pacs.proxy), it first mints the short-lived
// session cookie so every OHIF + DICOMweb sub-request inside the iframe is
// authorized. In direct mode it just renders the iframe.

import { useEffect, useState } from 'react';
import { Loader2, ExternalLink, ServerCrash } from 'lucide-react';
import { useDicomConfig, useCreatePacsSession, usePacsHealth } from '@/hooks/use-dicom';

interface OhifEmbedProps {
  viewerUrl: string;
  title: string;
  className?: string;
  style?: React.CSSProperties;
}

export function OhifEmbed({ viewerUrl, title, className, style }: OhifEmbedProps) {
  const { data: pacs } = useDicomConfig();
  // Asked before embedding: an unreachable archive otherwise fails inside the
  // iframe, where the reason is invisible and reads as "there is no viewer".
  const { data: health } = usePacsHealth();
  const mint = useCreatePacsSession();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const needsSession = !!pacs?.proxy;

  useEffect(() => {
    if (pacs == null) return; // wait until we know whether proxy mode is on
    if (!needsSession) {
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    setFailed(false);
    mint
      .mutateAsync()
      .then(() => !cancelled && setReady(true))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacs, needsSession, viewerUrl]);

  // An archive that is off or not answering is not a viewer problem, and
  // saying "couldn't start the session" would send someone chasing the wrong
  // thing. Name it, so it reaches whoever can restart it.
  if (health && health.status !== 'ok') {
    const message =
      health.status === 'unreachable'
        ? 'The imaging archive is not responding.'
        : health.status === 'misconfigured'
          ? 'The imaging archive is not fully configured.'
          : 'PACS integration is switched off for this deployment.';
    return (
      <div
        className={`flex h-full flex-col items-center justify-center gap-2 bg-black px-6 text-center text-zinc-300 ${className ?? ''}`}
        style={style}
      >
        <ServerCrash className="size-6 text-zinc-500" />
        <p className="text-sm">{message}</p>
        <p className="max-w-sm text-xs text-zinc-500">
          The study itself is safe — it cannot be displayed until the archive is back. Contact IT
          if this persists.
        </p>
      </div>
    );
  }

  if (failed) {
    return (
      <div className={`flex h-full flex-col items-center justify-center gap-3 bg-black text-zinc-300 ${className ?? ''}`} style={style}>
        <p className="text-sm">Couldn’t start the secure PACS session.</p>
        <a
          href={viewerUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800"
        >
          <ExternalLink className="size-3.5" /> Open viewer in a new tab
        </a>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className={`flex h-full items-center justify-center gap-2 bg-black text-zinc-300 ${className ?? ''}`} style={style}>
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">Starting secure viewer…</span>
      </div>
    );
  }

  return (
    <iframe
      src={viewerUrl}
      title={title}
      className={`h-full w-full ${className ?? ''}`}
      style={{ border: 0, ...style }}
      allow="fullscreen"
    />
  );
}
