'use client';

// Extracted verbatim from the Laboratory home page, which had grown to
// 2,056 lines holding the shell, seven tabs, four dialogs and the shared
// table primitives in one file. No behaviour changed in the move.

import { useMemo } from 'react';
import {
  Download,
  Trash2,
  FileText,
  FileImage,
  AlertTriangle,
  ScanText
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/date-utils';
import {
  canOcrAttachment,
  resolveAttachmentUrl,
  formatFileSize,
  isImageMime,
  type LabAttachment
} from '@/hooks/use-lab-attachments';


export function SchemaParamGrid({
  rows,
  updateRow,
}: {
  rows: Array<{
    parameterName: string;
    value: string;
    unit: string;
    normalRange: string;
    isAbnormal: boolean;
    inputType?: 'number' | 'text' | 'select';
    options?: { value: string; label: string }[];
    group?: string | null;
    notes?: string | null;
    refLow?: number | null;
    refHigh?: number | null;
    decimals?: number | null;
  }>;
  updateRow: (idx: number, patch: Partial<(typeof rows)[number]>) => void;
}) {
  // Group rows by `group` field, preserving incoming order. Rows without a
  // group land in a single "Other" section at the end.
  const groups = useMemo(() => {
    const order: string[] = [];
    const buckets = new Map<string, number[]>();
    rows.forEach((r, idx) => {
      const k = r.group || '';
      if (!buckets.has(k)) {
        buckets.set(k, []);
        order.push(k);
      }
      buckets.get(k)!.push(idx);
    });
    return order.map((label) => ({ label, indices: buckets.get(label)! }));
  }, [rows]);

  // Compute live abnormal flag for numeric rows. Doesn't mutate state — just
  // tints the value cell red so the technician notices before saving. The
  // saved-row flag is computed authoritatively in onSaveResults.
  const isOutOfRange = (r: (typeof rows)[number]): boolean => {
    if (!r.value) return false;
    if (r.inputType === 'select' || r.inputType === 'text') return false;
    const n = Number(r.value);
    if (!Number.isFinite(n)) return false;
    if (r.refLow != null && n < r.refLow) return true;
    if (r.refHigh != null && n > r.refHigh) return true;
    return false;
  };

  return (
    <div className="rounded-md border bg-card">
      <div className="grid grid-cols-12 gap-1 px-2 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground border-b">
        <div className="col-span-4">Parameter</div>
        <div className="col-span-4">Result</div>
        <div className="col-span-2">Unit</div>
        <div className="col-span-2">Reference</div>
      </div>
      {groups.map((g) => (
        <div key={g.label || '_none'}>
          {g.label && (
            <div className="px-2 py-1.5 bg-surface-container-low text-[10px] uppercase tracking-wide font-semibold text-on-surface-variant border-b">
              {g.label}
            </div>
          )}
          {g.indices.map((idx) => {
            const r = rows[idx];
            const abn = isOutOfRange(r);
            return (
              <div
                key={idx}
                className="grid grid-cols-12 gap-1 px-2 py-1.5 border-b last:border-b-0 items-center"
              >
                <div className="col-span-4 min-w-0">
                  <div className="text-xs font-medium truncate">{r.parameterName}</div>
                  {r.notes && (
                    <div className="text-[10px] text-muted-foreground truncate">{r.notes}</div>
                  )}
                </div>
                <div className="col-span-4 flex items-center gap-1">
                  {r.inputType === 'select' && r.options ? (
                    <select
                      className="flex h-7 w-full rounded-lg border border-input bg-transparent px-2 text-xs focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                      value={r.value}
                      onChange={(e) => updateRow(idx, { value: e.target.value })}
                    >
                      <option value="">— select —</option>
                      {r.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      className={cn('h-7 text-xs', abn && 'border-error text-error focus-visible:border-error')}
                      type={r.inputType === 'number' ? 'number' : 'text'}
                      step={r.decimals != null ? Math.pow(10, -r.decimals).toString() : 'any'}
                      value={r.value}
                      onChange={(e) => updateRow(idx, { value: e.target.value })}
                      placeholder={r.inputType === 'number' ? '0' : 'enter result'}
                    />
                  )}
                  {abn && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-error shrink-0"
                      title="Auto-flagged: outside the reference range"
                    >
                      <AlertTriangle className="size-3" />
                      Abn
                    </span>
                  )}
                </div>
                <div className="col-span-2 text-xs text-muted-foreground truncate">{r.unit || '—'}</div>
                <div className="col-span-2 text-[11px] text-muted-foreground truncate">{r.normalRange || '—'}</div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Reusable attachment list (read or delete) — extracted so both modes can
// render uploaded files identically.
export function AttachmentList({
  attachments,
  onDelete,
  onExtract,
  extracting,
  pending,
  canDelete,
}: {
  attachments: LabAttachment[];
  onDelete?: (id: string) => void;
  /** Re-run the report reader on this file. Lab roles only. */
  onExtract?: (id: string) => void;
  extracting?: boolean;
  pending?: boolean;
  canDelete?: boolean;
}) {
  if (attachments.length === 0) {
    return (
      <p className="text-[11px] italic text-muted-foreground">
        No file uploaded for this test yet.
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {attachments.map((a) => {
        const url = resolveAttachmentUrl(a.fileUrl);
        const Icon = isImageMime(a.mimeType) ? FileImage : FileText;
        return (
          <li
            key={a.id}
            className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border bg-muted">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{a.fileName}</p>
              <p className="text-[10px] text-muted-foreground">
                {formatFileSize(a.sizeBytes)}
                {a.uploader && ` · ${a.uploader.firstName} ${a.uploader.lastName ?? ''}`.trim()}
                {' · '}
                {formatDateTime(a.createdAt)}
              </p>
            </div>
            {onExtract && canOcrAttachment(a.mimeType) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onExtract(a.id)}
                disabled={extracting}
                className="h-7 gap-1 px-2 text-[10px]"
                title="Read the values off this report into the result grid so doctors and the AI assistant can use them"
              >
                <ScanText className="size-3.5" />
                {extracting ? 'Reading…' : 'Read values'}
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              nativeButton={false}
              render={
                <a href={url} target="_blank" rel="noopener noreferrer" download={a.fileName} />
              }
              className="h-7 w-7"
              title="Open / download"
            >
              <Download className="size-3.5" />
            </Button>
            {canDelete && onDelete && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onDelete(a.id)}
                disabled={pending}
                className="h-7 w-7 text-error"
                title="Remove"
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
