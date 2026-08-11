'use client';

// Per-test result entry: upload a report to read values off, or type them
// in against the test's parameter schema.
//
// Extracted verbatim from the Laboratory home page, which had grown to
// 2,056 lines holding the shell, seven tabs, four dialogs and the shared
// table primitives in one file. No behaviour changed in the move.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Upload,
  CheckCircle2,
  ClipboardEdit,
  Plus,
  AlertTriangle,
  Lock,
  ScanText,
  X as XIcon
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useCompleteLabOrderItem,
  useEnterResults,
  useVerifyResults,
  type LabOrder
} from '@/hooks/use-lab';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useUploadLabAttachment,
  useDeleteLabAttachment,
  useExtractAttachmentResults,
  type LabAttachment
} from '@/hooks/use-lab-attachments';
import { useLabRole } from '@/hooks/use-lab-role';
import { AttachmentList, SchemaParamGrid } from '@/components/laboratory/home/result-entry-bits';


// ============================================================
// Order Detail Dialog — sample lifecycle + per-test two-mode result entry
// + order-level report panel (Generate → Sign → Publish).
//
// Two report-generation paths per SoW Week 6/7:
//   Mode A (Upload): upload a PDF/image per test → Mark Done. When every
//     item is done the backend auto-publishes the LabReport — the uploaded
//     files ARE the report.
//   Mode B (Add Details): enter structured parameter rows per test (value,
//     unit, normal range, abnormal flag). Generate creates a branded
//     LabReport draft; supervisor signs and publishes.
//
// Role gating: both technicians and supervisors can run either mode and
// generate a draft report. Sign / Publish / Verify-results stay supervisor-
// only (the backend permission `lab_reports.approve` enforces this; the UI
// just hides the controls).
// ============================================================

export function TestItemRow({
  orderId,
  patientId,
  item,
  attachments,
  reportFinalized,
}: {
  orderId: string;
  patientId: string;
  item: NonNullable<LabOrder['labOrderItems']>[number];
  attachments: LabAttachment[];
  // True once the lab supervisor has signed/approved/published (or corrected)
  // the order's report. From that point the report is locked — no editing.
  reportFinalized: boolean;
}) {
  const { canApprove } = useLabRole();
  const upload = useUploadLabAttachment();
  const remove = useDeleteLabAttachment();
  const extract = useExtractAttachmentResults();
  const complete = useCompleteLabOrderItem();
  const enterResults = useEnterResults();
  const verifyResult = useVerifyResults();
  const fileRef = useRef<HTMLInputElement>(null);

  const isDone = item.status === 'completed';
  const isCancelled = item.status === 'cancelled';

  // A done test is normally read-only. "Edit" re-opens the entry controls so a
  // technician can fix an upload/result — but only while the report is still
  // unfinalized. Once the supervisor finalizes, editing is locked entirely.
  const [editing, setEditing] = useState(false);
  const isEditable = !isCancelled && (!isDone || (editing && !reportFinalized));

  const canMarkDone = isEditable && attachments.length > 0;

  // Existing LabResult rows for this item (eager-loaded by useLabOrder).
  const existingResults = item.labResults ?? [];

  // Default the active mode based on what's already captured for this item:
  // results already entered → start on "Add Details"; otherwise upload.
  const defaultMode: 'upload' | 'details' = existingResults.length > 0 ? 'details' : 'upload';
  const [mode, setMode] = useState<'upload' | 'details'>(defaultMode);

  // Structured parameter rows (drafted client-side, persisted via Save).
  type Row = {
    parameterName: string;
    value: string;
    unit: string;
    normalRange: string;
    isAbnormal: boolean;
    // When the catalog has a parameter schema, each row also carries the
    // input-type + option list so the render path can pick the right
    // control. Free-form rows leave these undefined.
    inputType?: 'number' | 'text' | 'select';
    options?: { value: string; label: string }[];
    group?: string | null;
    notes?: string | null;
    refLow?: number | null;
    refHigh?: number | null;
    decimals?: number | null;
  };

  // Catalog parameter schema (from the cloned platform template). When set,
  // we render one input row per parameter instead of free-form add/remove.
  const schemaParams = item.test.parameters && item.test.parameters.length > 0
    ? item.test.parameters
    : null;

  const formatRefRange = (
    p: NonNullable<NonNullable<typeof item.test.parameters>[number]>,
  ): string => {
    if (p.refLow != null && p.refHigh != null) return `${p.refLow}–${p.refHigh}`;
    if (p.refLow != null) return `≥ ${p.refLow}`;
    if (p.refHigh != null) return `≤ ${p.refHigh}`;
    return p.refRangeText ?? p.normalRange ?? '';
  };

  const blankRow = (): Row => ({
    parameterName: item.test.testName,
    value: '',
    unit: item.test.unit ?? '',
    normalRange: item.test.normalRange ?? '',
    isAbnormal: false,
  });

  // Build the initial structured rows from the catalog schema; one row per
  // parameter. Re-runs cheaply on test/parameters identity change.
  const initialRows = useMemo<Row[]>(() => {
    if (!schemaParams) return [blankRow()];
    return schemaParams.map((p) => ({
      parameterName: p.name,
      value: '',
      unit: p.unit ?? '',
      normalRange: formatRefRange(p),
      isAbnormal: false,
      inputType: p.inputType ?? 'number',
      options: p.options ?? undefined,
      group: p.group ?? null,
      notes: p.notes ?? null,
      refLow: p.refLow ?? null,
      refHigh: p.refHigh ?? null,
      decimals: p.decimals ?? null,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, schemaParams]);

  const [rows, setRows] = useState<Row[]>(initialRows);

  // Re-sync local rows when the schema arrives async (catalog included on
  // first GET but parameters might land later if backend trims) OR when the
  // item identity changes.
  useEffect(() => {
    setRows(initialRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, schemaParams ? schemaParams.length : 0]);

  // After save, reset rows back to a blank set so the form is ready for
  // editing or re-entry. For structured mode we re-init from schema.
  useEffect(() => {
    if (existingResults.length > 0 && rows.every((r) => !r.value)) {
      setRows(initialRows);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingResults.length]);

  const onPick = async (file: File) => {
    try {
      await upload.mutateAsync({
        orderId,
        file,
        category: 'report_pdf',
        labOrderItemId: item.id,
      });
      toast.success(`Uploaded ${file.name}`);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Upload failed');
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Remove this file? It will disappear from the patient and clinician views.')) return;
    try {
      await remove.mutateAsync(id);
      toast.success('File removed');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Delete failed');
    }
  };

  // Re-run the reader on an uploaded file. Uploading already triggers this in
  // the background; this is the retry for when the AI key was missing, the
  // quota was spent, or the first pass got nothing off a poor scan.
  const onExtract = async (attachmentId: string) => {
    try {
      const res = await extract.mutateAsync({ attachmentId, orderId });
      if (res && res.created > 0) {
        toast.success(
          `Read ${res.created} value${res.created === 1 ? '' : 's'} off the report — check them under Add Details.`,
        );
        setMode('details');
      } else {
        toast.warning(
          res?.warnings?.[0] ??
            'Nothing could be read off this file. Enter the values under Add Details.',
        );
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not read this report'));
    }
  };

  const onDone = async () => {
    try {
      await complete.mutateAsync({ orderId, itemId: item.id });
      toast.success('Test marked done');
      setEditing(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to mark done');
    }
  };

  const onSaveResults = async () => {
    const filled = rows
      .map((r) => ({ ...r, parameterName: r.parameterName.trim(), value: r.value.trim() }))
      .filter((r) => r.parameterName && r.value)
      .map((r) => {
        // Auto-flag abnormal for numeric rows with a ref range. The user
        // can still override by ticking the checkbox in free-form mode.
        if (
          (r.inputType === 'number' || r.inputType === undefined) &&
          (r.refLow != null || r.refHigh != null)
        ) {
          const n = Number(r.value);
          if (Number.isFinite(n)) {
            const lo = r.refLow ?? -Infinity;
            const hi = r.refHigh ?? Infinity;
            return { ...r, isAbnormal: r.isAbnormal || n < lo || n > hi };
          }
        }
        return r;
      });
    if (filled.length === 0) {
      toast.error('Enter at least one parameter with a value');
      return;
    }
    try {
      await enterResults.mutateAsync({
        labOrderItemId: item.id,
        labOrderId: orderId,
        patientId,
        results: filled.map((r) => ({
          parameterName: r.parameterName,
          value: r.value,
          unit: r.unit || undefined,
          normalRange: r.normalRange || undefined,
          isAbnormal: r.isAbnormal,
        })),
      });
      toast.success(`Saved ${filled.length} result${filled.length === 1 ? '' : 's'}`);
      setRows(initialRows);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save results');
    }
  };

  const onVerifyResult = async (
    id: string,
    action: 'approve' | 'request_correction',
  ) => {
    let notes: string | undefined;
    if (action === 'request_correction') {
      const input = window.prompt('Reason / requested correction?');
      if (input == null) return;
      notes = input.trim() || undefined;
    }
    try {
      await verifyResult.mutateAsync({ id, action, correctionNotes: notes });
      toast.success(action === 'approve' ? 'Result approved' : 'Correction requested');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed');
    }
  };

  const updateRow = (idx: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, blankRow()]);
  const removeRow = (idx: number) =>
    setRows((rs) => (rs.length === 1 ? [blankRow()] : rs.filter((_, i) => i !== idx)));

  return (
    <div className="px-3 py-3 text-sm space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-medium">{item.test.testName}</span>
          {item.test.testCode && (
            <span className="ml-1 text-[10px] text-muted-foreground">({item.test.testCode})</span>
          )}
          <Badge
            className={cn(
              'ml-2 capitalize',
              isDone && 'bg-emerald-100 text-emerald-800',
              isCancelled && 'bg-red-100 text-red-800',
            )}
          >
            {item.status.replace('_', ' ')}
          </Badge>
          {existingResults.length > 0 && !isDone && (
            <Badge className="ml-1 bg-cyan-100 text-cyan-800">
              {existingResults.length} result{existingResults.length === 1 ? '' : 's'} saved
            </Badge>
          )}
        </div>
        {isDone && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
              <CheckCircle2 className="size-3.5" />
              Done
            </span>
            {/* Edit re-opens entry while unfinalized; once the supervisor
                finalizes the report the test is locked instead. */}
            {!reportFinalized ? (
              editing ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => setEditing(false)}
                >
                  Cancel edit
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 gap-1 px-2 text-[10px]"
                  onClick={() => setEditing(true)}
                >
                  <ClipboardEdit className="size-3" /> Edit
                </Button>
              )
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <Lock className="size-3" /> Locked
              </span>
            )}
          </div>
        )}
      </div>

      {isEditable && (
        <Tabs value={mode} onValueChange={(v: any) => setMode(v)} className="mt-1">
          <TabsList variant="line" className="h-8">
            <TabsTrigger value="upload" className="gap-1 text-xs">
              <Upload className="size-3" /> Upload File
            </TabsTrigger>
            <TabsTrigger value="details" className="gap-1 text-xs">
              <ClipboardEdit className="size-3" /> Add Details
            </TabsTrigger>
          </TabsList>

          {/* Upload mode */}
          <TabsContent value="upload" className="pt-2 space-y-2">
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPick(f);
                }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={upload.isPending}
                className="gap-1"
              >
                <Upload className="size-3.5" />
                {upload.isPending ? 'Uploading…' : 'Upload File'}
              </Button>
              <Button
                size="sm"
                onClick={onDone}
                disabled={!canMarkDone || complete.isPending}
                className="gap-1"
                title={!canMarkDone ? 'Upload a report file first' : undefined}
              >
                <CheckCircle2 className="size-3.5" />
                {complete.isPending ? 'Saving…' : 'Mark Done'}
              </Button>
              <span className="text-[10px] text-muted-foreground ml-1">
                Queues the report for supervisor approval once every test is marked done.
              </span>
            </div>
            <AttachmentList
              attachments={attachments}
              onDelete={onDelete}
              onExtract={onExtract}
              extracting={extract.isPending}
              pending={remove.isPending}
              canDelete={isEditable}
            />
            {attachments.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Uploaded reports are read into the result grid automatically so doctors, the
                discharge summary and the AI assistant can use the values. Check them under
                <span className="font-medium"> Add Details</span> — use
                <span className="font-medium"> Read values</span> to try again if nothing appeared.
              </p>
            )}
          </TabsContent>

          {/* Add Details mode */}
          <TabsContent value="details" className="pt-2 space-y-2">
            {existingResults.length > 0 && (
              <div className="rounded-md border bg-card">
                <div className="px-2 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground border-b">
                  Saved results
                </div>
                <ul className="divide-y">
                  {existingResults.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{r.parameterName}</span>
                        <span className="ml-2">{r.value ?? '-'}</span>
                        {r.unit && <span className="ml-1 text-muted-foreground">{r.unit}</span>}
                        {r.normalRange && (
                          <span className="ml-2 text-[10px] text-muted-foreground">
                            (range {r.normalRange})
                          </span>
                        )}
                        {r.isAbnormal && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700">
                            <AlertTriangle className="size-3" /> Abnormal
                          </span>
                        )}
                        {r.source === 'ocr' && (
                          <Badge
                            className="ml-2 gap-1 bg-amber-100 text-amber-800"
                            title="Read off the uploaded report file — check it against the file before approving"
                          >
                            <ScanText className="size-3" /> Read from file — verify
                          </Badge>
                        )}
                        {r.status && r.status !== 'entered' && (
                          <Badge className="ml-2 capitalize">{r.status}</Badge>
                        )}
                        {r.correctionNotes && (
                          <div className="text-[10px] text-amber-700 mt-0.5">
                            Correction: {r.correctionNotes}
                          </div>
                        )}
                      </div>
                      {canApprove && r.status !== 'approved' && (
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px]"
                            disabled={verifyResult.isPending}
                            onClick={() => onVerifyResult(r.id, 'approve')}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px]"
                            disabled={verifyResult.isPending}
                            onClick={() => onVerifyResult(r.id, 'request_correction')}
                          >
                            Request fix
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {schemaParams ? (
              // Structured mode — one input row per catalog parameter, grouped
              // by `group`. Free-form add/remove is disabled because the
              // schema defines the report shape.
              <SchemaParamGrid
                rows={rows}
                updateRow={updateRow}
              />
            ) : (
              <div className="rounded-md border bg-card">
                <div className="grid grid-cols-12 gap-1 px-2 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground border-b">
                  <div className="col-span-3">Parameter</div>
                  <div className="col-span-3">Value</div>
                  <div className="col-span-2">Unit</div>
                  <div className="col-span-3">Normal range</div>
                  <div className="col-span-1"></div>
                </div>
                {rows.map((r, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-1 px-2 py-1.5 border-b last:border-b-0 items-center">
                    <Input
                      className="col-span-3 h-7 text-xs"
                      value={r.parameterName}
                      onChange={(e) => updateRow(idx, { parameterName: e.target.value })}
                      placeholder="e.g. Hemoglobin"
                    />
                    <Input
                      className="col-span-3 h-7 text-xs"
                      value={r.value}
                      onChange={(e) => updateRow(idx, { value: e.target.value })}
                      placeholder="value"
                    />
                    <Input
                      className="col-span-2 h-7 text-xs"
                      value={r.unit}
                      onChange={(e) => updateRow(idx, { unit: e.target.value })}
                      placeholder="g/dL"
                    />
                    <Input
                      className="col-span-3 h-7 text-xs"
                      value={r.normalRange}
                      onChange={(e) => updateRow(idx, { normalRange: e.target.value })}
                      placeholder="13.5-17.5"
                    />
                    <div className="col-span-1 flex justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeRow(idx)}
                        className="h-6 w-6 text-muted-foreground"
                        title="Remove row"
                      >
                        <XIcon className="size-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2 px-2 py-2">
                  <Button size="sm" variant="ghost" onClick={addRow} className="gap-1 text-xs">
                    <Plus className="size-3" /> Add parameter
                  </Button>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-2 px-2 py-2">
              <div className="text-[10px] text-muted-foreground">
                {schemaParams ? (
                  <span>
                    Report uses <span className="font-medium">{schemaParams.length}</span> parameter
                    {schemaParams.length === 1 ? '' : 's'} from the catalog. Numeric values are auto-flagged when outside the reference range.
                  </span>
                ) : (
                  <span>No catalog parameters configured — using free-form rows.</span>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRows(initialRows)}
                  className="gap-1 text-xs"
                  title="Clear entered values"
                >
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={onSaveResults}
                  disabled={enterResults.isPending}
                  className="gap-1"
                >
                  {enterResults.isPending ? 'Saving…' : 'Save Results'}
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Saved parameters roll up into the order&apos;s branded report.
              Use <span className="font-medium">Submit for Approval</span> below once results are entered;
              a lab supervisor must approve before the patient sees anything.
            </p>
          </TabsContent>
        </Tabs>
      )}

      {/* When the test is done (and not being edited) OR cancelled, just show
          the file list read-only. */}
      {((isDone && !editing) || isCancelled) && attachments.length > 0 && (
        <AttachmentList attachments={attachments} canDelete={false} />
      )}
    </div>
  );
}

// Renders structured-mode result entry: one input per catalog parameter
// row, grouped by `group` (RBC indices, WBC differential, etc.). The
// outer component owns `rows` state + the save handler; this only
// presents the inputs.
