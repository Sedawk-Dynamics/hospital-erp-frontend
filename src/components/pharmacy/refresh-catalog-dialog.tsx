'use client';

// Super-admin "Refresh Catalog". The catalogue is the vendor's, bundled with
// each build and applied on boot; this re-applies that release or upserts a CSV
// exported from the vendor's workbook. Products are matched on their Product
// ID, so nothing is duplicated, every hospital import stays linked, and no
// hospital's own formulary or batch prices are touched.

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  useRefreshStatus,
  useStartRefresh,
  useDrugProviders,
  useCatalogRelease,
  drugMasterKeys,
  type RefreshSummary,
} from '@/hooks/use-drug-master';

const n = (v: number) => v.toLocaleString('en-IN');

function summaryLine(r: RefreshSummary): string {
  const parts = [`${n(r.inserted)} added`, `${n(r.updated)} updated`, `${n(r.unchanged)} unchanged`];
  if (r.discontinued) parts.push(`${n(r.discontinued)} discontinued`);
  if (r.legacyRemoved) parts.push(`${n(r.legacyRemoved)} old-dataset rows removed`);
  if (r.relinked) parts.push(`${n(r.relinked)} hospital drugs re-linked`);
  if (r.unlinked) parts.push(`${n(r.unlinked)} hospital drugs left unlinked`);
  if (r.skipped) parts.push(`${n(r.skipped)} rows without a Product ID skipped`);
  return parts.join(' · ');
}

export function RefreshCatalogDialog() {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState('bundled');
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: status } = useRefreshStatus(open);
  const { data: providers = [] } = useDrugProviders(open);
  const { data: release } = useCatalogRelease(open);
  const startRefresh = useStartRefresh();

  const running = status?.status === 'running' || startRefresh.isPending;

  // When a background refresh finishes, refresh the catalog table underneath.
  const prevStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prevStatus.current === 'running' && status?.status === 'success') {
      qc.invalidateQueries({ queryKey: drugMasterKeys.all });
      if (status.result) toast.success(`Catalog refreshed — ${summaryLine(status.result)}`);
    }
    if (prevStatus.current === 'running' && status?.status === 'error') {
      toast.error(status.error ?? 'Refresh failed');
    }
    prevStatus.current = status?.status;
  }, [status?.status, status?.result, status?.error, qc]);

  async function handleStart(input: { file?: File; url?: string; provider?: string }) {
    try {
      await startRefresh.mutateAsync(input);
      toast.message('Refresh started — this runs in the background.');
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to start refresh';
      toast.error(msg);
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleStart({ file });
    if (fileRef.current) fileRef.current.value = '';
  }

  const selected = providers.find((p) => p.name === provider);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Refresh Catalog
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refresh Drug Catalog</DialogTitle>
          <DialogDescription>
            Re-apply the vendor release shipped with this build, or upload a CSV exported from the
            vendor&apos;s workbook. Products are matched on their Product ID, so nothing is duplicated
            and hospital imports stay linked — hospital formulary and batch prices are never changed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {release && (
            <p className="rounded-md border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              This build carries release <b>{release.bundled ?? 'none'}</b>; the database holds{' '}
              <b>{release.applied ?? 'none yet'}</b>.
              {release.latest && release.latest.status !== 'complete' && (
                <>
                  {' '}
                  Release {release.latest.release} is <b>{release.latest.status}</b>
                  {release.latest.error ? ` — ${release.latest.error}` : ''}.
                </>
              )}
            </p>
          )}

          {/* Provider picker */}
          <div className="space-y-1">
            <label className="text-xs font-medium">Data source</label>
            <select
              className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              disabled={running}
            >
              {providers.map((p) => (
                <option key={p.name} value={p.name} disabled={!p.configured}>
                  {p.label}
                  {p.configured ? '' : ' — not configured'}
                </option>
              ))}
            </select>
            {selected && <p className="text-[11px] text-muted-foreground">{selected.description}</p>}
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="flex-1"
              disabled={running || !selected?.configured}
              onClick={() => handleStart({ provider })}
            >
              {running ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-4 w-4" />
              )}
              Refresh from source
            </Button>
            <Button
              variant="outline"
              disabled={running}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-1.5 h-4 w-4" />
              Upload CSV
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onPickFile}
            />
          </div>

          {/* Status panel */}
          {status && status.status !== 'idle' && (
            <div className="rounded-lg border p-3 text-sm">
              {status.status === 'running' && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Refresh in progress… ({status.source})
                </p>
              )}
              {status.status === 'success' && status.result && (
                <div className="space-y-1">
                  <p className="flex items-center gap-2 text-primary font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    Last refresh complete
                  </p>
                  <p className="text-xs text-muted-foreground">{summaryLine(status.result)}</p>
                </div>
              )}
              {status.status === 'error' && (
                <p className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {status.error ?? 'Refresh failed'}
                </p>
              )}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            Tip: a CSV needs the vendor&apos;s columns — at least <code>Product ID</code> and{' '}
            <code>Product Name</code> (drugs) or <code>name</code> (OTC). Rows are updated in place by
            Product ID; a partial file never discontinues anything.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
