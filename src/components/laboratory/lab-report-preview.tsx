'use client';

// Lab report preview — renders a realistic, branded sample report from any
// LabParameterSpec[] schema. Used by:
//   • super-admin Lab Test Template builder (preview while editing)
//   • super-admin Lab Templates list (preview a published template)
//   • hospital admin Lab Test edit dialog (preview before save)
//   • hospital admin Lab Settings list (preview catalog row)
//   • lab supervisor / technician (read-only — see what the patient gets)
//
// Sample values are picked deterministically from each parameter spec so
// the preview is stable, prints cleanly, and clearly shows how the abnormal-
// flagging will render. No backend calls; this is a pure render of the
// schema with mock data.

import { useMemo } from 'react';
import { Eye, Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { LabParameterSpec } from '@/hooks/use-lab-templates';

// ─────────────────────────────────────────────────────────────
// Mock-data generation
// ─────────────────────────────────────────────────────────────

interface PreviewResult {
  value: string;
  isAbnormal: boolean;
  flag: 'low' | 'high' | 'normal' | null;
}

// Deterministic hash so the preview values don't change between renders for
// the same schema. We seed with the parameter id so re-renders are stable.
function seededRandom(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return Math.abs(h % 1000) / 1000;
}

function pickMockValue(p: LabParameterSpec): PreviewResult {
  if (p.inputType === 'select') {
    const opts = p.options ?? [];
    if (opts.length === 0) return { value: '—', isAbnormal: false, flag: null };
    // Pick the first option (usually the "normal" / negative one).
    return { value: opts[0].label, isAbnormal: false, flag: null };
  }

  if (p.inputType === 'text') {
    return {
      value: p.refRangeText ?? 'Within normal limits',
      isAbnormal: false,
      flag: null,
    };
  }

  // Numeric. Pick a value near the middle of the ref range; for ~1 in 4
  // params, pick something just outside it so the abnormal-flag styling
  // shows up in the preview.
  const decimals = p.decimals ?? 2;
  const low = p.refLow;
  const high = p.refHigh;
  if (low == null && high == null) {
    return { value: '0.00', isAbnormal: false, flag: null };
  }
  const r = seededRandom(p.id + p.name);
  const showAbnormal = r > 0.75; // ~25% of params flag
  let raw: number;
  let flag: PreviewResult['flag'] = 'normal';
  if (low != null && high != null) {
    if (showAbnormal && r > 0.875) {
      raw = high + Math.abs(high - low) * 0.2;
      flag = 'high';
    } else if (showAbnormal) {
      raw = Math.max(0, low - Math.abs(high - low) * 0.2);
      flag = 'low';
    } else {
      // Middle 70% of the range.
      raw = low + (high - low) * (0.15 + r * 0.7);
    }
  } else if (high != null) {
    raw = showAbnormal ? high + Math.abs(high) * 0.2 : high * (0.4 + r * 0.5);
    flag = showAbnormal ? 'high' : 'normal';
  } else {
    raw = (low ?? 0) * (0.6 + r * 0.6);
  }
  return {
    value: raw.toFixed(decimals),
    isAbnormal: flag !== 'normal',
    flag,
  };
}

function refRangeLabel(p: LabParameterSpec): string {
  if (p.refRangeText) return p.refRangeText;
  if (p.refLow != null && p.refHigh != null) return `${p.refLow} – ${p.refHigh}`;
  if (p.refHigh != null) return `≤ ${p.refHigh}`;
  if (p.refLow != null) return `≥ ${p.refLow}`;
  return '—';
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface LabReportPreviewSource {
  name: string;
  code?: string | null;
  departmentName?: string | null;
  sampleType?: string | null;
  specimen?: string | null;
  instructions?: string | null;
  description?: string | null;
  interpretation?: string | null;
  defaultPrice?: number | string | null;
  turnaroundHours?: number | null;
  parameters: LabParameterSpec[];
}

interface LabReportPreviewDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  source: LabReportPreviewSource | null;
}

// ─────────────────────────────────────────────────────────────
// Dialog
// ─────────────────────────────────────────────────────────────

export function LabReportPreviewDialog({ open, onOpenChange, source }: LabReportPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[92vh] overflow-hidden p-0 sm:rounded-2xl"
        showCloseButton={false}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b bg-surface-container-low">
          <div className="flex items-center gap-2 min-w-0">
            <Eye className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">Lab Report Preview</p>
              <p className="text-[10px] text-muted-foreground truncate">
                Sample values — actual report will use technician-entered data
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1"
              onClick={() => printPreview(source)}
              disabled={!source}
            >
              <Printer className="h-3 w-3" />
              Print
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="max-h-[calc(92vh-3rem)] overflow-y-auto p-5 bg-surface-container-lowest">
          {source ? (
            <LabReportPreviewBody source={source} />
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nothing to preview.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// Body (also exported so callers can embed inline e.g. side-by-side
// with the editor instead of in a dialog)
// ─────────────────────────────────────────────────────────────

export function LabReportPreviewBody({ source }: { source: LabReportPreviewSource }) {
  const grouped = useMemo(() => groupParameters(source.parameters), [source.parameters]);
  const today = new Date();

  return (
    <div id="lab-preview-print-root" className="bg-white text-slate-900 rounded-lg shadow-md overflow-hidden border">
      {/* Hospital header (mock) */}
      <div className="flex items-start justify-between gap-4 px-6 py-4 border-b-2 border-primary">
        <div>
          <p className="text-lg font-bold tracking-tight text-primary">Sample Hospital</p>
          <p className="text-[10px] text-slate-600">123 Care Street · City · State · 560001</p>
          <p className="text-[10px] text-slate-600">Phone: +91 80-0000-0000 · NABL Accredited</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase font-bold tracking-widest text-primary">Laboratory Report</p>
          <p className="text-[10px] text-slate-600 mt-1">Report ID: PREV-{source.code ?? 'XXXX'}</p>
          <p className="text-[10px] text-slate-600">Generated: {today.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Patient block (mock) */}
      <div className="grid grid-cols-4 gap-3 px-6 py-3 text-[11px] border-b bg-slate-50">
        <PatientField label="Patient" value="John Doe" />
        <PatientField label="MRN" value="MRN-001234" />
        <PatientField label="Age / Gender" value="42 yrs / Male" />
        <PatientField label="Ref. Doctor" value="Dr. A. Sharma" />
        <PatientField label="Sample Collected" value={today.toLocaleString('en-IN')} />
        <PatientField label="Sample Type" value={source.sampleType ?? 'Blood'} />
        <PatientField label="Specimen" value={source.specimen ?? '—'} />
        <PatientField label="Department" value={source.departmentName ?? '—'} />
      </div>

      {/* Test title */}
      <div className="px-6 py-3 border-b">
        <p className="font-bold text-base">
          {source.name}
          {source.code && (
            <span className="font-mono text-[10px] font-normal text-slate-500 ml-2">({source.code})</span>
          )}
        </p>
        {source.description && (
          <p className="text-[11px] text-slate-600 mt-0.5">{source.description}</p>
        )}
        {source.instructions && (
          <p className="text-[10px] text-amber-700 mt-1 italic">{source.instructions}</p>
        )}
      </div>

      {/* Parameters */}
      <div className="px-6 py-3">
        {source.parameters.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500 italic">
            No parameters configured. Add at least one parameter to see the report layout.
          </p>
        ) : (
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b-2 border-slate-300 text-[10px] uppercase tracking-wider text-slate-700">
                <th className="text-left py-1.5 w-[35%]">Test / Parameter</th>
                <th className="text-right py-1.5 w-[15%]">Result</th>
                <th className="text-left py-1.5 w-[10%] pl-3">Unit</th>
                <th className="text-left py-1.5 w-[25%] pl-3">Reference range</th>
                <th className="text-center py-1.5 w-[15%]">Flag</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(([groupName, params]) => (
                <ParameterGroup key={groupName} groupName={groupName} params={params} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Interpretation */}
      {source.interpretation && (
        <div className="px-6 py-3 border-t bg-slate-50">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-700 mb-1">
            Clinical Interpretation
          </p>
          <p className="text-[11px] text-slate-700 whitespace-pre-line">{source.interpretation}</p>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-3 border-t text-[10px] text-slate-600 flex items-center justify-between">
        <div>
          <p>
            <span className="font-semibold">Note:</span> This is a system-generated preview.
            Actual reports are signed by the laboratory supervisor before release.
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold">Dr. P. Verma, MD (Pathology)</p>
          <p>Laboratory Supervisor</p>
        </div>
      </div>
    </div>
  );
}

function PatientField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="font-medium text-slate-800 truncate">{value}</p>
    </div>
  );
}

function ParameterGroup({
  groupName,
  params,
}: {
  groupName: string;
  params: LabParameterSpec[];
}) {
  return (
    <>
      {groupName !== '__ungrouped__' && (
        <tr>
          <td
            colSpan={5}
            className="pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-primary"
          >
            {groupName}
          </td>
        </tr>
      )}
      {params.map((p) => {
        const mock = pickMockValue(p);
        return (
          <tr key={p.id} className="border-b border-slate-100">
            <td className="py-1.5">
              <span className="font-medium">{p.name}</span>
              {p.code && <span className="font-mono text-[9px] text-slate-500 ml-1">({p.code})</span>}
              {p.notes && (
                <p className="text-[9px] text-slate-500 italic mt-0.5">{p.notes}</p>
              )}
            </td>
            <td
              className={cn(
                'py-1.5 text-right font-mono tabular-nums font-semibold',
                mock.isAbnormal && mock.flag === 'high' && 'text-red-600',
                mock.isAbnormal && mock.flag === 'low' && 'text-blue-600',
              )}
            >
              {mock.value}
            </td>
            <td className="py-1.5 pl-3 text-slate-600">{p.unit ?? '—'}</td>
            <td className="py-1.5 pl-3 text-slate-600 text-[10px]">{refRangeLabel(p)}</td>
            <td className="py-1.5 text-center">
              {mock.flag === 'high' && (
                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700">
                  HIGH ↑
                </span>
              )}
              {mock.flag === 'low' && (
                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700">
                  LOW ↓
                </span>
              )}
              {mock.flag === 'normal' && (
                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-50 text-emerald-700">
                  Normal
                </span>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}

// Stable group order: groups appear in the order their first member appears
// in the parameter list. Ungrouped parameters render at the top under a
// pseudo-group, with no heading.
function groupParameters(params: LabParameterSpec[]): [string, LabParameterSpec[]][] {
  const order: string[] = [];
  const byGroup = new Map<string, LabParameterSpec[]>();
  for (const p of params) {
    const key = p.group?.trim() || '__ungrouped__';
    if (!byGroup.has(key)) {
      byGroup.set(key, []);
      order.push(key);
    }
    byGroup.get(key)!.push(p);
  }
  return order.map((g) => [g, byGroup.get(g)!]);
}

// ─────────────────────────────────────────────────────────────
// Print helper — opens a new window with the rendered preview HTML.
// Inline styles so the popup doesn't depend on the host stylesheet.
// ─────────────────────────────────────────────────────────────

function printPreview(source: LabReportPreviewSource | null) {
  if (typeof window === 'undefined' || !source) return;
  const node = document.getElementById('lab-preview-print-root');
  if (!node) return;
  const win = window.open('', '_blank', 'width=900,height=1100');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>${source.name} — Preview</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, sans-serif; color: #0f172a; padding: 24px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 6px 4px; }
  thead th { border-bottom: 2px solid #cbd5e1; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #334155; }
  tbody td { border-bottom: 1px solid #f1f5f9; font-size: 11px; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .text-red-600 { color: #dc2626; }
  .text-blue-600 { color: #2563eb; }
  .font-bold { font-weight: 700; }
  .font-mono { font-family: ui-monospace, Menlo, monospace; }
  .border-b { border-bottom: 1px solid #e2e8f0; }
  .border-primary { border-color: #00bfa5; }
  .bg-slate-50 { background: #f8fafc; }
  .text-primary { color: #00bfa5; }
  .py-3 { padding-top: 12px; padding-bottom: 12px; }
  .px-6 { padding-left: 24px; padding-right: 24px; }
  .border { border: 1px solid #e2e8f0; }
  .rounded-lg { border-radius: 8px; }
</style></head><body>${node.outerHTML}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
}
