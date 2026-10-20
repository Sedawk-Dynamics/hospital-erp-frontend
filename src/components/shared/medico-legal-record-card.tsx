'use client';

import type { MedicoLegalRecord } from '@/hooks/use-medico-legal';

const META = {
  mlc: { label: 'MLC', badge: 'bg-red-50 text-red-700 border-red-200', bar: 'bg-red-500' },
  nonMlc: { label: 'Non-MLC', badge: 'bg-slate-50 text-slate-600 border-slate-200', bar: 'bg-slate-400' },
} as const;

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

function formatCm(value: string | number | null): string {
  if (value === null || value === '') return '—';
  return `${value} cm`;
}

interface Field {
  label: string;
  value: string;
}

export default function MedicoLegalRecordCard({ record }: { record: MedicoLegalRecord }) {
  const meta = record.isMlc ? META.mlc : META.nonMlc;

  const policeFields: Field[] = [
    { label: 'Police Station', value: record.policeStation || '—' },
    { label: 'Investigating Officer', value: record.investigatingOfficer || '—' },
    { label: 'Intimation Dispatched', value: formatDateTime(record.policeIntimationAt) },
    { label: 'IO Arrival', value: formatDateTime(record.ioArrivalAt) },
    { label: 'Receipt Ack. No.', value: record.receiptAckNo || '—' },
  ];

  return (
    <div className="flex overflow-hidden rounded-xl border border-outline-variant/40 bg-white">
      <div className={`w-1.5 shrink-0 ${meta.bar}`} />

      <div className="min-w-0 flex-1 space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.badge}`}>
            {meta.label}
          </span>
          {record.isMlc && record.mlcSerialNumber && (
            <span className="text-sm font-semibold text-on-surface">{record.mlcSerialNumber}</span>
          )}
          <span className="ml-auto text-[11px] text-on-surface-variant">
             {formatDateTime(record.createdAt)}
          </span>
        </div>

        {record.isMlc && (
          <section className="space-y-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
              Police Intimation
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
              {policeFields.map((f) => (
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
        )}

        {record.items.length > 0 && (
          <section className="space-y-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
              Belongings
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {record.items.map((item, i) => (
                <span
                  key={i}
                  className="rounded-full border border-outline-variant/40 bg-surface-container-low px-2.5 py-0.5 text-xs text-on-surface"
                >
                  {item}
                </span>
              ))}
            </div>
          </section>
        )}

        {record.injuries.length > 0 && (
          <section className="space-y-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
              Injuries ({record.injuries.length})
            </h4>
            <div className="overflow-hidden rounded-lg border border-outline-variant/30">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-container-low/60 text-[10px] uppercase tracking-wide text-on-surface-variant">
                  <tr>
                    <th className="px-3 py-1.5 font-semibold">Body Site</th>
                    <th className="px-3 py-1.5 font-semibold">Nature</th>
                    <th className="px-3 py-1.5 font-semibold">Length</th>
                    <th className="px-3 py-1.5 font-semibold">Width</th>
                  </tr>
                </thead>
                <tbody>
                  {record.injuries.map((inj) => (
                    <tr key={inj.id} className="border-t border-outline-variant/30">
                      <td className="px-3 py-1.5 font-medium text-on-surface">{inj.bodySite}</td>
                      <td className="px-3 py-1.5 text-on-surface">{inj.nature || '—'}</td>
                      <td className="px-3 py-1.5 text-on-surface">{formatCm(inj.lengthCm)}</td>
                      <td className="px-3 py-1.5 text-on-surface">{formatCm(inj.widthCm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
