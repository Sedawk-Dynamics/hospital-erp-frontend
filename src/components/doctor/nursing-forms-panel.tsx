'use client';

// Read-only "Nursing Forms" panel for the doctor's consultation page.
// Mirrors the access pattern Vitals follows: doctors can see what the
// nursing team has captured but cannot edit. The single /summary endpoint
// returns the latest entry per form type plus a small recent slice, so
// this whole panel is one network call.

import { ClipboardList } from 'lucide-react';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import {
  usePatientFormsSummary,
  type FallRiskLevel,
} from '@/hooks/use-nursing-forms';

const FALL_RISK_BG: Record<FallRiskLevel, string> = {
  low: 'bg-emerald-100 text-emerald-700',
  moderate: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
};

function nurseName(n?: { firstName: string; lastName: string | null } | null) {
  if (!n) return '—';
  return `${n.firstName} ${n.lastName ?? ''}`.trim();
}

function Tile({
  label,
  primary,
  secondary,
  meta,
  emphasis,
}: {
  label: string;
  primary: string | null;
  secondary?: string | null;
  meta?: string | null;
  emphasis?: 'high' | 'amber' | 'low' | 'neutral';
}) {
  const emphasisCls =
    emphasis === 'high'
      ? 'border-red-200 bg-red-50/50'
      : emphasis === 'amber'
        ? 'border-amber-200 bg-amber-50/50'
        : emphasis === 'low'
          ? 'border-emerald-200 bg-emerald-50/50'
          : 'border-input bg-surface-container-low';
  return (
    <div className={cn('rounded-md border px-3 py-2', emphasisCls)}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
        {label}
      </p>
      <p className="text-sm font-semibold mt-0.5 truncate">{primary ?? '—'}</p>
      {secondary && (
        <p className="text-[11px] text-muted-foreground truncate">{secondary}</p>
      )}
      {meta && (
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{meta}</p>
      )}
    </div>
  );
}

export function NursingFormsPanel({ patientId }: { patientId: string }) {
  const { data, isLoading } = usePatientFormsSummary(patientId);
  const summary = data?.data;

  return (
    <section className="rounded-xl bg-surface-container-lowest shadow-sanctuary border-l-4 border-secondary p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-secondary" />
          <h2 className="font-headline text-sm font-bold">Nursing Forms</h2>
        </div>
        <span className="text-[10px] text-muted-foreground">Read-only · captured by nursing</span>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : !summary ? (
        <p className="text-xs text-muted-foreground">No data.</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {/* Admission Assessment */}
          <Tile
            label="Admission Assessment"
            primary={
              summary.admissionAssessment.latest
                ? summary.admissionAssessment.latest.chiefComplaint ?? 'Recorded'
                : 'Not recorded'
            }
            secondary={
              summary.admissionAssessment.latest
                ? `${summary.admissionAssessment.latest.arrivalMode ?? '—'} · LOC ${
                    summary.admissionAssessment.latest.consciousnessLevel ?? '—'
                  }`
                : null
            }
            meta={
              summary.admissionAssessment.latest
                ? `${formatDateTimeAmPm(summary.admissionAssessment.latest.assessedAt)} · ${nurseName(
                    summary.admissionAssessment.latest.nurse,
                  )}`
                : null
            }
          />

          {/* Pain (latest) */}
          {(() => {
            const latest = summary.pain.recent[0];
            const score = latest?.painScore;
            const emphasis: 'high' | 'amber' | 'low' | undefined =
              score == null ? undefined : score >= 7 ? 'high' : score >= 4 ? 'amber' : 'low';
            return (
              <Tile
                label="Pain"
                primary={latest ? `${latest.painScore}/10 (${latest.painScale})` : 'Not recorded'}
                secondary={latest?.painLocation ?? null}
                meta={
                  latest
                    ? `${formatDateTimeAmPm(latest.assessedAt)} · ${nurseName(latest.nurse)}`
                    : null
                }
                emphasis={emphasis}
              />
            );
          })()}

          {/* Fall risk */}
          {(() => {
            const latest = summary.fallRisk.latest;
            const emphasis: 'high' | 'amber' | 'low' | undefined =
              latest?.riskLevel === 'high'
                ? 'high'
                : latest?.riskLevel === 'moderate'
                  ? 'amber'
                  : latest?.riskLevel === 'low'
                    ? 'low'
                    : undefined;
            return (
              <Tile
                label="Fall risk (Morse)"
                primary={
                  latest
                    ? `${latest.riskLevel.toUpperCase()} · ${latest.totalScore}`
                    : 'Not screened'
                }
                secondary={latest?.intervention ?? null}
                meta={
                  latest
                    ? `${formatDateTimeAmPm(latest.assessedAt)} · ${nurseName(latest.nurse)}`
                    : null
                }
                emphasis={emphasis}
              />
            );
          })()}

          {/* I/O — last 24h totals from the recent slice */}
          {(() => {
            const slice = summary.intakeOutput.recent;
            if (slice.length === 0) {
              return <Tile label="Intake / Output" primary="Not recorded" />;
            }
            const intake = slice
              .filter((r) => r.entryType === 'intake')
              .reduce((s, r) => s + (r.volumeMl ?? 0), 0);
            const output = slice
              .filter((r) => r.entryType === 'output')
              .reduce((s, r) => s + (r.volumeMl ?? 0), 0);
            const balance = intake - output;
            return (
              <Tile
                label="Intake / Output (recent)"
                primary={`In ${intake} · Out ${output} ml`}
                secondary={`Balance ${balance >= 0 ? '+' : ''}${balance} ml`}
                meta={`Last: ${formatDateTimeAmPm(slice[0].recordDatetime)}`}
              />
            );
          })()}

          {/* Wound care */}
          {(() => {
            const latest = summary.woundCare.recent[0];
            return (
              <Tile
                label="Wound Care"
                primary={latest ? latest.woundLocation : 'No active wounds'}
                secondary={
                  latest
                    ? `${latest.woundType ?? '—'} · stage ${latest.woundStage ?? '—'} · ${latest.status}`
                    : null
                }
                meta={
                  latest
                    ? `${formatDateTimeAmPm(latest.assessedAt)} · ${nurseName(latest.nurse)}`
                    : null
                }
                emphasis={latest?.status === 'worsening' ? 'high' : undefined}
              />
            );
          })()}

          {/* Latest nursing note */}
          {(() => {
            const note = summary.nursingNote.latest;
            return (
              <Tile
                label="Latest Nursing Note"
                primary={note ? note.content.slice(0, 80) + (note.content.length > 80 ? '…' : '') : 'No notes'}
                secondary={note ? note.noteType.replaceAll('_', ' ') : null}
                meta={
                  note
                    ? `${formatDateTimeAmPm(note.createdAt)} · ${nurseName(note.nurse)}`
                    : null
                }
              />
            );
          })()}
        </div>
      )}

      {/* Footer summary — total entries per form type */}
      {summary && (
        <div className="mt-3 pt-3 border-t flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <span>Admissions: {summary.admissionAssessment.total}</span>
          <span>Pain: {summary.pain.total}</span>
          <span>Fall: {summary.fallRisk.total}</span>
          <span>I/O: {summary.intakeOutput.total}</span>
          <span>Wound: {summary.woundCare.total}</span>
          <span>Notes: {summary.nursingNote.total}</span>
        </div>
      )}
    </section>
  );
}
