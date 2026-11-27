'use client';

// #264: the hospital admin's services list. Download, fill in, upload, check row
// by row, then apply only the rows ticked. Nothing is approved by an upload.

import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Download, FileUp, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  fetchServiceGstTemplate, useApplyServiceGstImport, usePreviewServiceGstImport,
  type ServiceGstPreviewRow,
} from '@/hooks/use-service-tariffs';
import { parseServiceGstGrid, type ServiceGstImportRow } from '@/lib/service-gst-import';
import { getApiErrorMessage } from '@/lib/utils';

const MAX_BYTES = 5 * 1024 * 1024;
const show = (v: { sacCode: string | null; treatment: string | null; gstPercent: number } | null) =>
  v && (v.sacCode || v.treatment)
    ? `${v.sacCode ?? 'no SAC'} · ${(v.treatment ?? 'not set').replace(/_/g, ' ')}${v.treatment === 'taxable' ? ` ${v.gstPercent}%` : ''}`
    : 'not set';

export function ServiceGstImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = usePreviewServiceGstImport();
  const apply = useApplyServiceGstImport();
  const [rows, setRows] = useState<ServiceGstImportRow[]>([]);
  const [checked, setChecked] = useState<ServiceGstPreviewRow[]>([]);
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const [outcome, setOutcome] = useState<Record<number, string>>({});
  const [downloading, setDownloading] = useState(false);

  const close = (o: boolean) => {
    if (!o) {
      setRows([]);
      setChecked([]);
      setTicked(new Set());
      setOutcome({});
    }
    onOpenChange(o);
  };

  const download = async () => {
    setDownloading(true);
    try {
      const t = await fetchServiceGstTemplate();
      const sheet = XLSX.utils.aoa_to_sheet([t.columns, ...t.rows]);
      // Codes stay text: Excel would turn a SAC into a number.
      for (const key of Object.keys(sheet)) {
        if (/^[AC]\d+$/.test(key) && key.slice(1) !== '1') sheet[key].t = 's';
      }
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, 'Services');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(t.notes.map((n) => [n])), 'How to fill');
      XLSX.writeFile(wb, 'services-gst-list.xlsx');
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not prepare the template'));
    } finally {
      setDownloading(false);
    }
  };

  const onFile = async (file: File) => {
    if (file.size > MAX_BYTES) return void toast.error('The file is larger than 5 MB');
    setChecked([]);
    setOutcome({});
    setTicked(new Set());
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]!];
      // `raw: false` reads what the admin SEES: 18% formatted as a percentage is "18%", not 0.18.
      const grid = sheet ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: true, defval: '', raw: false }) : [];
      const parsed = parseServiceGstGrid(grid);
      if (parsed.error) return void toast.error(parsed.error);
      const res = await preview.mutateAsync(parsed.rows);
      setRows(parsed.rows);
      setChecked(res.rows);
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not read this file'));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const ready = checked.filter((r) => r.status === 'ready' && outcome[r.rowNumber] === undefined);
  const chosen = rows.filter((r) => ticked.has(r.rowNumber) && ready.some((x) => x.rowNumber === r.rowNumber));

  const onApply = async () => {
    try {
      const res = await apply.mutateAsync(chosen);
      setOutcome((o) => ({ ...o, ...Object.fromEntries(res.results.map((r) => [r.rowNumber, r.applied ? 'Applied' : (r.reason ?? 'Not applied')])) }));
      setTicked(new Set());
      const msg = `${res.applied} service(s) updated${res.failed ? `, ${res.failed} not applied` : ''}. They still need approving.`;
      if (res.failed) toast.warning(msg);
      else toast.success(msg);
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not apply the services list'));
    }
  };

  const toggle = (n: number) =>
    setTicked((s) => {
      const next = new Set(s);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Import the services list</DialogTitle>
          <DialogDescription>
            SAC, treatment and GST % for services already in the hospital list. Every row is checked before anything is
            saved, only the rows you tick are applied, and nothing is approved by the upload.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={download} disabled={downloading}>
            {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download template
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            aria-label="Services list file"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <Button size="sm" className="gap-1.5" disabled={preview.isPending} onClick={() => fileRef.current?.click()}>
            {preview.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />} Choose file
          </Button>
        </div>

        {checked.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>
                {checked.length} row(s): {checked.filter((r) => r.status === 'ready').length} ready,{' '}
                {checked.filter((r) => r.status === 'unchanged').length} unchanged,{' '}
                {checked.filter((r) => r.status === 'error').length} with errors
              </span>
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!ready.length} onClick={() => setTicked(new Set(ready.map((r) => r.rowNumber)))}>
                Tick all ready
              </Button>
            </div>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2" />
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Service</th>
                    <th className="px-3 py-2">Now</th>
                    <th className="px-3 py-2">Becomes</th>
                    <th className="px-3 py-2">Check</th>
                  </tr>
                </thead>
                <tbody>
                  {checked.map((r) => (
                    <tr key={r.rowNumber} className="border-t align-top">
                      <td className="px-3 py-2">
                        {r.status === 'ready' && outcome[r.rowNumber] === undefined ? (
                          <input
                            type="checkbox"
                            aria-label={`Apply row ${r.rowNumber}`}
                            checked={ticked.has(r.rowNumber)}
                            onChange={() => toggle(r.rowNumber)}
                          />
                        ) : null}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{r.rowNumber}</td>
                      <td className="px-3 py-2">
                        {r.matchedName ?? r.serviceName ?? '—'}
                        {r.serviceCode ? <span className="ml-1 font-mono text-[10px] text-muted-foreground">{r.serviceCode}</span> : null}
                      </td>
                      <td className="px-3 py-2">{r.current ? show(r.current) : '—'}</td>
                      <td className="px-3 py-2">{r.next ? show(r.next) : '—'}</td>
                      <td className="px-3 py-2">
                        {outcome[r.rowNumber] !== undefined ? (
                          <Badge variant="outline">{outcome[r.rowNumber]}</Badge>
                        ) : r.status === 'error' ? (
                          <span className="text-red-700">{r.errors.join('. ')}</span>
                        ) : r.status === 'unchanged' ? (
                          <span className="text-muted-foreground">Already set to these values</span>
                        ) : (
                          <span className="text-emerald-700">Ready</span>
                        )}
                        {r.warnings.length ? <p className="text-amber-700">{r.warnings.join('. ')}</p> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>Close</Button>
          <Button onClick={onApply} disabled={!chosen.length || apply.isPending}>
            {apply.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Apply {chosen.length} ticked
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
