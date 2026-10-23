'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useAddFastTrackCode,
  useFastTrackCodes,
  type FastTrackCode,
  type FastTrackCodeRecord,
} from '@/hooks/use-fast-track';
import { FastTrackCodeDialog } from './fast-track-code-dialog';
import { toast } from 'sonner';

interface FastTrackPanelProps {
  admissionId: string;
  visitId?: string;
  patientId: string;
  role: string;
}

export const CODE_META: Record<FastTrackCode, { label: string; emoji: string; badge: string; bar: string }> = {
  code_red_trauma: { label: 'Code Red — Trauma', emoji: '🔴', badge: 'bg-red-50 text-red-700 border-red-200', bar: 'bg-red-500' },
  code_stemi: { label: 'Code STEMI', emoji: '🫀', badge: 'bg-green-50 text-green-700 border-green-200', bar: 'bg-green-500' },
  code_stroke: { label: 'Code Stroke', emoji: '🧠', badge: 'bg-violet-50 text-violet-700 border-violet-200', bar: 'bg-violet-500' },
  code_sepsis: { label: 'Code Sepsis', emoji: '🦠', badge: 'bg-amber-50 text-amber-700 border-amber-200', bar: 'bg-amber-500' },
  red: { label: 'Code Red', emoji: '🔴', badge: 'bg-red-50 text-red-700 border-red-200', bar: 'bg-red-500' },
  orange: { label: 'Code Orange', emoji: '🟠', badge: 'bg-orange-50 text-orange-700 border-orange-200', bar: 'bg-orange-500' },
  yellow: { label: 'Code Yellow', emoji: '🟡', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200', bar: 'bg-yellow-500' },
  green: { label: 'Code Green', emoji: '🟢', badge: 'bg-green-50 text-green-700 border-green-200', bar: 'bg-green-500' },
  black: { label: 'Code Black', emoji: '⚫', badge: 'bg-gray-100 text-gray-800 border-gray-300', bar: 'bg-gray-800' },
};

interface DetailField {
  label: string;
  value: string;
  wide?: boolean;
}

function fields(rec: FastTrackCodeRecord): DetailField[] {
  const d = rec.details as Record<string, any>;
  switch (rec.code) {
    case 'code_red_trauma':
      return [
        { label: 'PRBC', value: `${d.prbcUnits ?? 0} units` },
        { label: 'FFP', value: `${d.ffpUnits ?? 0} units` },
        { label: 'Platelets', value: `${d.plateletPacks ?? 0}` },
        { label: 'TXA', value: d.txaGiven ? `Given${d.txaGivenAt ? ` · ${d.txaGivenAt}` : ''}` : 'Not given' },
        {
          label: 'eFAST',
          wide: true,
          value:
            Object.entries(d.efast ?? {})
              .filter(([, v]) => v)
              .map(([k, v]) => `${k.toUpperCase()} ${v}`)
              .join(', ') || '—',
        },
      ];
    case 'code_stemi':
      return [
        { label: 'Door-to-ECG', value: `${d.ecgTime ?? '—'} min` },
        { label: 'Door-to-Balloon', value: `${d.balloonTime ?? '—'} min` },
        { label: 'Infarct Territory', value: d.infarctTerritory || '—' },
        {
          label: 'DAPT',
          wide: true,
          value:
            [d.aspirinGiven && 'Aspirin', d.ticagrelorGiven && 'Ticagrelor', d.atorvastatinGiven && 'Atorvastatin']
              .filter(Boolean)
              .join(', ') || '—',
        },
      ];
    case 'code_stroke':
      return [
        { label: 'Door-to-CT', value: `${d.ctTime ?? '—'} min` },
        { label: 'LKW Window', value: `${d.lkwWindow ?? '—'} hr` },
        { label: 'NIHSS', value: `${d.nihssScore ?? '—'}` },
        { label: 'Blood Glucose', value: `${d.bloodGlucose ?? '—'} mg/dL` },
        {
          label: 'FAST Screen',
          wide: true,
          value: [d.facialDroop, d.armDrift, d.speech].filter(Boolean).join(' / ') || '—',
        },
      ];
    case 'code_sepsis':
      return [
        { label: 'Serum Lactate', value: `${d.serumLactate ?? '—'} mmol/L` },
        { label: 'Blood Cultures', value: d.bloodCulturesDrawn ? 'Done' : 'Not done' },
        { label: 'Antibiotics', value: d.antibioticsGiven ? 'Given' : 'Not given' },
        { label: 'Crystalloid', value: d.crystalloidDone ? 'Done' : 'Not done' },
      ];
    case 'red':
    case 'orange':
    case 'yellow':
    case 'green':
    case 'black':
      // Colour codes only carry an optional note.
      return d.notes ? [{ label: 'Note', value: d.notes, wide: true }] : [];
    default:
      return [];
  }
}

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

export default function FastTrackPanel({ admissionId, visitId, patientId }: FastTrackPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const addFastTrackCode = useAddFastTrackCode();
  const { data: codes = [], isLoading } = useFastTrackCodes(admissionId);

  const handleSave = async (payload: { code: FastTrackCode; details: Record<string, unknown> }) => {
    try {
      await addFastTrackCode.mutateAsync({
        patientId,
        admissionId,
        visitId,
        code: payload.code,
        details: payload.details,
      });
      setDialogOpen(false);
    } catch {
      toast.error('Error in adding the fast track codes');
    }
  };

  const addButton = (
    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDialogOpen(true)}>
      <Plus className="h-4 w-4" />
      Add Code
    </Button>
  );

  return (
    <div className="rounded-xl border border-outline-variant/40 bg-white p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-on-surface">Fast Track Codes</h3>
          <p className="text-xs text-on-surface-variant">
            Activate a rapid-response protocol code for this patient.
          </p>
        </div>
        {codes.length > 0 && addButton}
      </div>

      {isLoading ? (
        <p className="py-6 text-center text-xs text-on-surface-variant">Loading…</p>
      ) : codes.length > 0 ? (
        <div className="space-y-3">
          {codes.map((rec) => {
            const meta = CODE_META[rec.code];
            return (
              <div
                key={rec.id}
                className="relative overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-container-low"
              >
                <span className={`absolute inset-y-0 left-0 w-1 ${meta?.bar ?? 'bg-outline-variant'}`} />
                <div className="space-y-3 p-3 pl-4">
                  {/* Header: coloured code badge + activation time */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta?.badge ?? ''}`}
                    >
                      <span>{meta?.emoji}</span>
                      {meta?.label ?? rec.code}
                    </span>
                    <span className="text-[11px] text-on-surface-variant">{formatWhen(rec.createdAt)}</span>
                  </div>

                  {/* Detail chips — label on top (muted), value below (bold) */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {fields(rec).map((f, i) => (
                      <div
                        key={i}
                        className={`rounded-md border border-outline-variant/40 bg-white px-2.5 py-1.5 ${
                          f.wide ? 'col-span-2 sm:col-span-4' : ''
                        }`}
                      >
                        <p className="text-[10px] font-medium uppercase tracking-wide text-on-surface-variant">
                          {f.label}
                        </p>
                        <p className="text-xs font-semibold text-on-surface">{f.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex justify-center py-6">{addButton}</div>
      )}

      <FastTrackCodeDialog open={dialogOpen} setOpen={setDialogOpen} onSave={handleSave} />
    </div>
  );
}










