'use client';

// Super-admin "Refresh Catalog" — upserts the Drug Master against a CSV
// snapshot so MRP / discontinued / composition changes flow in WITHOUT
// duplicating drugs, breaking hospital import links, or touching any
// hospital's own formulary/batch prices. Re-pull the default dataset or
// upload a newer/price-adjusted CSV.

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
  drugMasterKeys,
} from '@/hooks/use-drug-master';

export function RefreshCatalogDialog() {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState('open-dataset');
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: status } = useRefreshStatus(open);
  const { data: providers = [] } = useDrugProviders(open);
  const startRefresh = useStartRefresh();

  const running = status?.status === 'running' || startRefresh.isPending;

  // When a background refresh finishes, refresh the catalog table underneath.
  const prevStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prevStatus.current === 'running' && status?.status === 'success') {
      qc.invalidateQueries({ queryKey: drugMasterKeys.all });
      const r = status.result;
      if (r) {
        toast.success(
          `Catalog refreshed — ${r.inserted} added, ${r.updated} updated, ${r.unchanged} unchanged`,
        );
      }
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
            Updates MRP, discontinued status and composition against a dataset snapshot. Existing
            drugs and hospital imports are preserved — hospital formulary/batch prices are never
            changed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
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
            {providers.find((p) => p.name === provider) && (
              <p className="text-[11px] text-muted-foreground">
                {providers.find((p) => p.name === provider)!.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="flex-1"
              disabled={running || !providers.find((p) => p.name === provider)?.configured}
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
                  <p className="text-xs text-muted-foreground">
                    {status.result.inserted.toLocaleString('en-IN')} added ·{' '}
                    {status.result.updated.toLocaleString('en-IN')} updated ·{' '}
                    {status.result.unchanged.toLocaleString('en-IN')} unchanged · catalog now{' '}
                    {(status.result.existingBefore + status.result.inserted).toLocaleString('en-IN')}
                  </p>
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
            Tip: to reflect new market prices, upload an updated CSV with the same columns.
            The refresh matches drugs by name + manufacturer + pack, so it updates in place.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
