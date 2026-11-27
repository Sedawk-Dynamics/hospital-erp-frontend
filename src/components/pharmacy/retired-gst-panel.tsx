'use client';

import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileUp, RefreshCw, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/shared/empty-state';
import {
  GST_RATE_EDIT_ROLES, useApplyGstRateList, usePreviewGstRateList, useRetiredGstRates,
  type ApplyRateListResult, type ApplyRateListRow, type RateListPreview, type RateListStatus,
} from '@/hooks/use-gst-rate-list';
import { useAuthStore } from '@/stores/auth-store';
import { downloadCsv } from '@/lib/csv';
import { parseRateList, RATE_LIST_HEADERS } from '@/lib/gst-rate-list';
import { cn, getApiErrorMessage } from '@/lib/utils';

const STATUS: Record<RateListStatus, { label: string; cls: string }> = {
  ready: { label: 'Ready', cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
  unchanged: { label: 'No change', cls: 'bg-muted text-muted-foreground' },
  not_due: { label: 'Not due yet', cls: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  unmatched: { label: 'Not matched', cls: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  error: { label: 'Rejected', cls: 'bg-red-500/10 text-red-700 border-red-500/20' },
};

const rateText = (n: number | null) => (n == null ? 'not set' : `${n}%`);

/** One row of the template, keyed by its headings. */
const templateRow = (v: Partial<Record<(typeof RATE_LIST_HEADERS)[number], string>>) =>
  Object.fromEntries(RATE_LIST_HEADERS.map((h) => [h, v[h] ?? '']));

/**
 * #262 — the medicines still on a GST rate the law no longer recognises, and
 * the import that loads the corrected rates. Nothing here suggests a rate: the
 * hospital's own list decides, and only the rows ticked are changed.
 */
export function RetiredGstPanel() {
  const { user } = useAuthStore();
  const role = (user?.role?.slug ?? user?.role?.name ?? '').toLowerCase().replace(/[\s-]+/g, '_');
  const allowed = GST_RATE_EDIT_ROLES.includes(role);

  const { data, isLoading, isError, error, refetch, isFetching } = useRetiredGstRates(allowed);
  const preview = usePreviewGstRateList();
  const apply = useApplyGstRateList();

  const fileRef = useRef<HTMLInputElement>(null);
  const [pasted, setPasted] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [checked, setChecked] = useState<RateListPreview | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const [show, setShow] = useState<'all' | RateListStatus>('all');
  const [result, setResult] = useState<ApplyRateListResult | null>(null);

  // Every proposed change, with the row it came from.
  const changes = useMemo(
    () =>
      (checked?.rows ?? []).flatMap((r) =>
        r.changes.map((c) => ({ ...c, rowNumber: r.rowNumber, effectiveFrom: r.effectiveFrom })),
      ),
    [checked],
  );
  const rows = (checked?.rows ?? []).filter((r) => show === 'all' || r.status === show);

  const clear = () => {
    setChecked(null);
    setPicked(new Set());
    setFileName(null);
    setPasted('');
    setShow('all');
    if (fileRef.current) fileRef.current.value = '';
  };

  const runPreview = async (text: string, name: string | null) => {
    setResult(null);
    const parsed = parseRateList(text);
    if (parsed.error) {
      toast.error(parsed.error);
      return;
    }
    try {
      const out = await preview.mutateAsync(parsed.rows);
      setChecked(out);
      setFileName(name);
      setShow('all');
      // Ready rows start ticked; the user unticks what they do not confirm.
      setPicked(new Set(out.rows.flatMap((r) => r.changes.map((c) => c.drugId))));
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not check the rate list'));
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (/\.(xlsx?|ods)$/i.test(file.name)) {
      toast.error('Save the sheet as CSV (File → Save As → CSV) and choose that file.');
      return;
    }
    await runPreview(await file.text(), file.name);
  };

  const onApply = async () => {
    if (!reason.trim()) {
      toast.error('Give the reason for the rate change.');
      return;
    }
    const body: ApplyRateListRow[] = changes
      .filter((c) => picked.has(c.drugId))
      .map((c) => ({
        drugId: c.drugId, gstPercent: c.newRate, expectedRate: c.currentRate,
        effectiveFrom: c.effectiveFrom, rowNumber: c.rowNumber,
      }));
    if (!body.length) {
      toast.error('Tick at least one medicine to change.');
      return;
    }
    try {
      const out = await apply.mutateAsync({ reason: reason.trim(), rows: body });
      setResult(out);
      toast.success(`${out.appliedCount} medicine rate(s) changed${out.skippedCount ? ` · ${out.skippedCount} not changed` : ''}`);
      clear();
      setReason('');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not apply the rate list'));
    }
  };

  if (!allowed) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Not available for your role"
        description="Medicine GST rates are changed by the Pharmacy Admin, Inventory Manager, Hospital Admin or Finance (Billing Admin)."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-headline text-xl font-bold">Retired GST rates</h1>
          <p className="text-xs text-muted-foreground">
            Medicines still on a GST rate that is no longer legal. They cannot be billed until the rate is corrected.
            {data && ` Rates allowed today: ${data.allowed}.`} Bills already issued, and returns against them, keep their rate.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!data?.items.length}
            onClick={() =>
              downloadCsv(
                `retired-gst-rates-${data!.asOf}.csv`,
                data!.items.map((i) => ({
                  Medicine: i.drugName,
                  Strength: i.strength ?? '',
                  Manufacturer: i.manufacturer ?? '',
                  HSN: i.hsnCode ?? '',
                  'Current GST %': i.ratePercent,
                  'Rate comes from': i.sourceLabel,
                  Why: i.reason,
                  'Stock on hand (single units)': i.stockOnHand,
                  'Stock on hand': i.stockText,
                  Active: i.isActive ? 'Yes' : 'No',
                })),
              )
            }
          >
            <Download className="mr-1.5 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      <section className="rounded-xl bg-surface-container-lowest shadow-sanctuary" aria-label="Medicines with a retired GST rate">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : isError ? (
          <p className="p-4 text-sm text-error">{getApiErrorMessage(error, 'Could not load the list')}</p>
        ) : data && !data.slabsConfigured ? (
          <p className="p-4 text-sm text-muted-foreground">
            No GST slabs are configured on the platform, so no rate can be judged. Ask the platform admin to set the GST slabs.
          </p>
        ) : !data?.items.length ? (
          <EmptyState icon={CheckCircle2} title="No medicine is on a retired rate" description="Every medicine's GST rate is one of the rates allowed today." />
        ) : (
          <>
            <p className="border-b px-4 py-2 text-xs text-muted-foreground">
              {data.total} medicine(s), {data.inStock} with stock on hand.
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicine</TableHead>
                    <TableHead>HSN</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead>Rate comes from</TableHead>
                    <TableHead className="text-right">Stock on hand</TableHead>
                    <TableHead>To fix</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((i) => (
                    <TableRow key={i.drugId}>
                      <TableCell>
                        <div className="font-medium">
                          {i.drugName}
                          {!i.isActive && <Badge variant="outline" className="ml-1.5 text-[10px]">Inactive</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">{[i.strength, i.manufacturer].filter(Boolean).join(' · ')}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{i.hsnCode ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-error">{i.ratePercent}%</span>
                        <div className="text-[10px] text-muted-foreground">{i.reason}</div>
                      </TableCell>
                      <TableCell className="text-sm">{i.sourceLabel}</TableCell>
                      <TableCell className="text-right text-sm">{i.stockText}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{i.fixedBy}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </section>

      <section className="space-y-3 rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary" aria-label="Import a GST rate list">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Import a rate list</h2>
            <p className="text-xs text-muted-foreground">
              Columns: {RATE_LIST_HEADERS.join(', ')}. Give a drug code, a drug name or an HSN. An HSN row changes only
              medicines under it that are on a retired rate.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadCsv('gst-rate-list-template.csv', [templateRow({})])}
            >
              <Download className="mr-1.5 h-4 w-4" /> Blank template
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!data?.items.length}
              onClick={() =>
                downloadCsv(
                  'gst-rate-list-to-fill.csv',
                  data!.items.map((i) =>
                    templateRow({ 'Drug code': i.drugId, 'Drug name': [i.drugName, i.strength].filter(Boolean).join(' '), HSN: i.hsnCode ?? '' }),
                  ),
                )
              }
            >
              <Download className="mr-1.5 h-4 w-4" /> Template with these medicines
            </Button>
          </div>
        </div>

        {!checked && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt,text/csv"
                className="hidden"
                aria-label="Rate list file"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
              <Button size="sm" onClick={() => fileRef.current?.click()} disabled={preview.isPending}>
                <FileUp className="mr-1.5 h-4 w-4" /> {preview.isPending ? 'Checking…' : 'Choose CSV file'}
              </Button>
              <span className="text-xs text-muted-foreground">or paste from a spreadsheet, headings included</span>
            </div>
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={4}
              aria-label="Paste the rate list"
              placeholder={`${RATE_LIST_HEADERS.join('\t')}\n…`}
              className="w-full rounded-md border bg-background p-2 font-mono text-xs"
            />
            <Button size="sm" variant="outline" disabled={!pasted.trim() || preview.isPending} onClick={() => void runPreview(pasted, null)}>
              Check pasted rows
            </Button>
          </div>
        )}

        {checked && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                {fileName ? <b>{fileName}</b> : <b>Pasted rows</b>} — nothing has been changed yet.
              </p>
              <Button size="sm" variant="ghost" onClick={clear}><X className="mr-1 h-4 w-4" /> Discard</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {([
                ['all', `All (${checked.summary.total})`],
                ['ready', `Ready (${checked.summary.ready})`],
                ['unmatched', `Not matched (${checked.summary.unmatched})`],
                ['error', `Rejected (${checked.summary.errors})`],
                ['not_due', `Not due yet (${checked.summary.notDue})`],
                ['unchanged', `No change (${checked.summary.unchanged})`],
              ] as const).map(([k, label]) => (
                <Button key={k} size="sm" variant={show === k ? 'default' : 'outline'} onClick={() => setShow(k)}>{label}</Button>
              ))}
              {checked.summary.unmatched + checked.summary.errors + checked.summary.notDue > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadCsv(
                      'gst-rate-list-not-applied.csv',
                      checked.rows
                        .filter((r) => r.status !== 'ready' && r.status !== 'unchanged')
                        .map((r) => ({
                          Row: r.rowNumber, 'Drug code': r.drugCode ?? '', 'Drug name': r.drugName ?? '', HSN: r.hsnCode ?? '',
                          'GST %': r.gstPercent ?? '', 'Effective from': r.effectiveFrom ?? '', Status: STATUS[r.status].label, Reason: r.message,
                        })),
                    )
                  }
                >
                  <Download className="mr-1.5 h-4 w-4" /> Rows not applied
                </Button>
              )}
            </div>

            <div className="max-h-[28rem] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Row</TableHead>
                    <TableHead>In the file</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Medicine and change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.rowNumber} className="align-top">
                      <TableCell className="font-mono text-xs">{r.rowNumber}</TableCell>
                      <TableCell className="text-xs">
                        <div>{[r.drugCode, r.drugName].filter(Boolean).join(' · ') || '—'}</div>
                        <div className="text-muted-foreground">
                          {[r.hsnCode && `HSN ${r.hsnCode}`, r.gstPercent && `GST ${r.gstPercent}`, r.effectiveFrom && `from ${r.effectiveFrom}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </TableCell>
                      <TableCell><Badge className={cn('text-[10px]', STATUS[r.status].cls)}>{STATUS[r.status].label}</Badge></TableCell>
                      <TableCell className="text-xs">
                        {r.changes.length === 0 && <span className={r.status === 'error' ? 'text-error' : 'text-muted-foreground'}>{r.message}</span>}
                        {r.changes.length > 0 && r.matchedBy === 'hsn' && <p className="mb-1 text-muted-foreground">{r.message}</p>}
                        {r.changes.map((c) => (
                          <label key={c.drugId} className="flex cursor-pointer items-start gap-2 py-0.5">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={picked.has(c.drugId)}
                              aria-label={`Change ${c.drugName}`}
                              onChange={(e) =>
                                setPicked((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(c.drugId);
                                  else next.delete(c.drugId);
                                  return next;
                                })
                              }
                            />
                            <span>
                              <b>{c.drugName}</b> {c.strength ?? ''} — {rateText(c.currentRate)} → <b>{c.newRate}%</b>
                              {c.newTreatment === 'nil_rated' && ' (nil-rated)'}
                              <span className="block text-muted-foreground">
                                Bills now at {c.currentSourceLabel} · stock {c.stockText}
                              </span>
                            </span>
                          </label>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {checked.notCovered.length > 0 && (
              <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {checked.notCovered.length} medicine(s) on a retired rate are not in this file and stay blocked:{' '}
                {checked.notCovered.slice(0, 6).map((d) => `${d.drugName} (${d.ratePercent}%)`).join(', ')}
                {checked.notCovered.length > 6 ? '…' : ''}
              </p>
            )}
            <p className="text-xs text-muted-foreground">{checked.effectiveDateNote}</p>

            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[16rem] flex-1">
                <Label htmlFor="rateListReason">Reason for the change *</Label>
                <Input
                  id="rateListReason"
                  value={reason}
                  maxLength={400}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Client rate list dated …"
                />
              </div>
              <Button onClick={() => void onApply()} disabled={apply.isPending || picked.size === 0 || !reason.trim()}>
                <Upload className="mr-1.5 h-4 w-4" />
                {apply.isPending ? 'Applying…' : `Change ${changes.filter((c) => picked.has(c.drugId)).length} medicine(s)`}
              </Button>
            </div>
          </div>
        )}

        {result && result.skipped.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p className="font-medium">Not changed:</p>
            {result.skipped.map((s) => (
              <p key={`${s.drugId}-${s.rowNumber}`}>
                {s.rowNumber ? `Row ${s.rowNumber}: ` : ''}{s.drugName ?? 'Medicine'} — {s.reason}
              </p>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
