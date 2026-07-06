'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { UploadCloud, Trash2, ImageIcon, Info, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  usePlatformBranding,
  useUploadPlatformLogo,
  useDeletePlatformLogo,
  resolveLogoUrl,
  type LogoVariant,
} from '@/hooks/use-branding';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

function LogoSlot({
  variant,
  title,
  subtitle,
  where,
  url,
  dark,
}: {
  variant: LogoVariant;
  title: string;
  subtitle: string;
  where: string;
  url: string | null | undefined;
  dark?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadPlatformLogo();
  const remove = useDeletePlatformLogo();
  const [busy, setBusy] = useState(false);
  const resolved = resolveLogoUrl(url);

  const onFile = async (file?: File | null) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be 10 MB or smaller.');
      return;
    }
    setBusy(true);
    try {
      await upload.mutateAsync({ variant, file });
      toast.success(`${title} updated.`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Upload failed.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onRemove = async () => {
    setBusy(true);
    try {
      await remove.mutateAsync(variant);
      toast.success(`${title} removed.`);
    } catch {
      toast.error('Could not remove the logo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-outline-variant/25 bg-surface-container-lowest p-5 shadow-sanctuary">
      <div className="mb-1 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dark ? 'bg-slate-800' : 'bg-slate-200 ring-1 ring-slate-300'}`} />
        <h3 className="font-headline text-base font-bold text-on-surface">{title}</h3>
      </div>
      <p className="font-label text-[12.5px] text-on-surface-variant">{subtitle}</p>
      <p className="mt-1 font-label text-[11px] text-on-surface-variant/80">
        Shown on: <span className="font-medium text-on-surface-variant">{where}</span>
      </p>

      {/* Preview on the matching background so you see how it really looks */}
      <div
        className={`mt-4 flex h-32 items-center justify-center rounded-lg border ${
          dark ? 'border-slate-700 bg-slate-900' : 'border-outline-variant/40 bg-white'
        }`}
      >
        {resolved ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolved} alt={title} className="max-h-20 max-w-[80%] object-contain" />
        ) : (
          <div className={`flex flex-col items-center gap-1.5 ${dark ? 'text-slate-500' : 'text-outline'}`}>
            <ImageIcon className="h-7 w-7" />
            <span className="font-label text-[11px]">No logo — the default icon is used</span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-1.5 h-4 w-4" />}
          {resolved ? 'Replace' : 'Upload'}
        </Button>
        {resolved && (
          <Button size="sm" variant="ghost" onClick={onRemove} disabled={busy} className="text-destructive hover:text-destructive">
            <Trash2 className="mr-1.5 h-4 w-4" /> Remove
          </Button>
        )}
      </div>
    </div>
  );
}

export default function BrandingPage() {
  const { data, isLoading } = usePlatformBranding();

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="font-headline text-xl font-bold text-on-surface">Platform Branding</h1>
        <p className="font-label text-sm text-on-surface-variant">
          Upload the platform logo in two versions — one for light surfaces and one for dark surfaces.
        </p>
      </div>

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-[13px] leading-relaxed text-on-surface-variant">
          These two logos are <span className="font-semibold text-on-surface">not a light/dark theme toggle</span>.
          They match the <span className="font-semibold text-on-surface">background a logo is placed on</span>: the
          <span className="font-semibold text-on-surface"> light-background</span> logo (usually a dark/coloured mark)
          shows on light surfaces like the login screen and sidebars, and the
          <span className="font-semibold text-on-surface"> dark-background</span> logo (usually a white/light mark)
          shows on dark surfaces like the website footer. Use a transparent <span className="font-mono">PNG</span> or{' '}
          <span className="font-mono">WebP</span> (max 10 MB). Leave a slot empty to keep the built-in icon.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-10 text-on-surface-variant">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading branding…
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <LogoSlot
            variant="light"
            title="Logo for light backgrounds"
            subtitle="A dark or coloured mark that reads clearly on white/light surfaces."
            where="Login screen · module & super-admin sidebars · website navbar"
            url={data?.logoLightUrl}
          />
          <LogoSlot
            variant="dark"
            title="Logo for dark backgrounds"
            subtitle="A white or light mark that reads clearly on dark surfaces."
            where="Website footer · any dark header"
            url={data?.logoDarkUrl}
            dark
          />
        </div>
      )}
    </div>
  );
}
