'use client';

// Super-admin "Import NPPA Prices" — uploads the official NPPA / DPCO ceiling
// price list (CSV: formulation, strength, dosage_form, unit, ceiling_price,
// notification, effective_date) and flags matching catalog drugs as
// price-controlled. This is the free, authoritative government price source.
// It only writes shared reference data — no hospital price is ever changed.

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useNppaStatus, useImportNppa, drugMasterKeys } from '@/hooks/use-drug-master';

export function NppaImportDialog() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: status } = useNppaStatus(open);
  const importNppa = useImportNppa();

  const running = status?.status === 'running' || importNppa.isPending;

  const prevStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prevStatus.current === 'running' && status?.status === 'success') {
      qc.invalidateQueries({ queryKey: drugMasterKeys.all });
      const r = status.result;
      if (r) toast.success(`NPPA prices applied — ${r.drugsMatched.toLocaleString('en-IN')} drugs flagged`);
    }
    if (prevStatus.current === 'running' && status?.status === 'error') {
      toast.error(status.error ?? 'NPPA import failed');
    }
    prevStatus.current = status?.status;
  }, [status?.status, status?.result, status?.error, qc]);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      importNppa
        .mutateAsync(file)
        .then(() => toast.message('NPPA import started — running in the background.'))
        .catch((err: unknown) => {
          const msg =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            'Failed to start import';
          toast.error(msg);
        });
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <ShieldCheck className="mr-1.5 h-4 w-4" />
            Import NPPA Prices
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import NPPA / DPCO Ceiling Prices</DialogTitle>
          <DialogDescription>
            Upload the official NPPA price list (CSV). Matching scheduled drugs are flagged with
            their ceiling price. This updates shared reference data only — no hospital&apos;s own
            price is changed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Button className="w-full" disabled={running} onClick={() => fileRef.current?.click()}>
            {running ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-4 w-4" />
            )}
            Upload NPPA CSV
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onPickFile}
          />

          {status && status.status !== 'idle' && (
            <div className="rounded-lg border p-3 text-sm">
              {status.status === 'running' && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing &amp; matching… ({status.source})
                </p>
              )}
              {status.status === 'success' && status.result && (
                <div className="space-y-1">
                  <p className="flex items-center gap-2 text-primary font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    Last import complete
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {status.result.ceilingsUpserted} ceilings ·{' '}
                    {status.result.drugsMatched.toLocaleString('en-IN')} drugs flagged ·{' '}
                    {status.result.ceilingsUnmatched} ceilings unmatched
                  </p>
                </div>
              )}
              {status.status === 'error' && (
                <p className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {status.error ?? 'Import failed'}
                </p>
              )}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            Expected columns: formulation, strength, dosage_form, unit, ceiling_price, notification,
            effective_date. Get the list from the NPPA DPCO order (nppaindia.gov.in) and save it as
            CSV. Matching is by salt + strength (single-ingredient drugs).
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
