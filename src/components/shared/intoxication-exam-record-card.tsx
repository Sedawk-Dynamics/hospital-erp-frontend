'use client';

import type { IntoxicationExamRecord } from '@/hooks/use-intoxication-exam';
import { CLINICAL_FIELDS, clinicalLabel, opinionLabel } from '@/lib/intoxication-options';

const OPINION_META: Record<string, { badge: string; bar: string }> = {
  consumed_under_influence: { badge: 'bg-red-50 text-red-700 border-red-200', bar: 'bg-red-500' },
  consumed_not_under_influence: { badge: 'bg-amber-50 text-amber-700 border-amber-200', bar: 'bg-amber-500' },
  no_evidence: { badge: 'bg-green-50 text-green-700 border-green-200', bar: 'bg-green-500' },
};

const NEUTRAL_META = { badge: 'bg-slate-50 text-slate-600 border-slate-200', bar: 'bg-slate-400' };

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function IntoxicationExamRecordCard({ record }: { record: IntoxicationExamRecord }) {
  const meta = (record.opinion && OPINION_META[record.opinion]) || NEUTRAL_META;
  const opinionText = opinionLabel(record.opinion);

  const findings = CLINICAL_FIELDS.map((f) => ({
    label: f.label,
    value: clinicalLabel(record[f.name as keyof IntoxicationExamRecord] as string | null),
  }));
  const hasExaminer = record.examinerName || record.examinerNmcNo || record.examinedAt;
  const hasWitness = record.witnessName || record.witnessBuckleNo || record.witnessPoliceStation;

  return (
    <div className="flex overflow-hidden rounded-xl border border-outline-variant/40 bg-white">
      <div className={`w-1.5 shrink-0 ${meta.bar}`} />

      <div className="min-w-0 flex-1 space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.badge}`}>
            {opinionText ?? 'No opinion recorded'}
          </span>
          <span className="ml-auto text-[11px] text-on-surface-variant">
            Examined {formatDateTime(record.examinedAt)}
          </span>
        </div>

        {record.recordedBac !== null && record.recordedBac !== '' && (
          <div className="inline-flex items-baseline gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-low/40 px-3 py-1.5">
            <span className="text-[10px] uppercase tracking-wide text-on-surface-variant">Recorded BAC</span>
            <span className="text-sm font-semibold text-on-surface">{record.recordedBac} mg/dL</span>
          </div>
        )}

        <section className="space-y-2">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
            Clinical Findings
          </h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {findings.map((f) => (
              <div
                key={f.label}
                className="rounded-lg border border-outline-variant/30 bg-surface-container-low/40 px-3 py-1.5"
              >
                <p className="text-[10px] uppercase tracking-wide text-on-surface-variant">{f.label}</p>
                <p className="text-sm text-on-surface">{f.value}</p>
              </div>
            ))}
          </div>
        </section>

        {(hasExaminer || hasWitness) && (
          <div className="space-y-1 text-sm text-on-surface">
            {hasExaminer && (
              <p>
                <span className="font-medium">Examiner:</span>{' '}
                {[record.examinerName, record.examinerNmcNo].filter(Boolean).join(' · ') || '—'}
              </p>
            )}
            {hasWitness && (
              <p>
                <span className="font-medium">Witness:</span>{' '}
                {[record.witnessName, record.witnessBuckleNo, record.witnessPoliceStation]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
