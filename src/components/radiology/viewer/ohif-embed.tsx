'use client';

// Embeds the OHIF viewer in an iframe. When the deployment routes PACS traffic
// through the authenticating proxy (pacs.proxy), it first mints the short-lived
// session cookie so every OHIF + DICOMweb sub-request inside the iframe is
// authorized. In direct mode it just renders the iframe.

import { useEffect, useState } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { useDicomConfig, useCreatePacsSession } from '@/hooks/use-dicom';

interface OhifEmbedProps {
  viewerUrl: string;
  title: string;
  className?: string;
  style?: React.CSSProperties;
}

export function OhifEmbed({ viewerUrl, title, className, style }: OhifEmbedProps) {
  const { data: pacs } = useDicomConfig();
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
