'use client';

import { useQuery } from '@tanstack/react-query';
import { Pill, Info } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

interface DerivedMed {
  itemId: string;
  drugName: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  prescribedAt: string;
  doctorName: string;
}

interface ManualMed {
  id: string;
  drugName: string;
  dosage?: string | null;
  frequency?: string | null;
  route?: string | null;
  source?: string | null;
  notes?: string | null;
  startedOn?: string | null;
}

/**
 * Read-only current medications view for the doctor consultation panel.
 *
 * Doctors prescribe / amend medications through the Consultation Form (within
 * the 24-hour edit window), not through this panel. This panel shows both
 * derived meds (from active prescriptions) and manual entries (from the
 * patient portal or prior imports) for context only.
 */
export function CurrentMedicationsPanel({ patientId }: { patientId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['doctor', 'current-medications', patientId],
    queryFn: async () => {
      const res = await apiGet<{ derived: DerivedMed[]; manual: ManualMed[] }>(
        `/medical-history/${patientId}/current-medications`,
      );
      return res.data ?? { derived: [], manual: [] };
    },
    enabled: !!patientId,
  });

  const derived = data?.derived ?? [];
  const manual = data?.manual ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-[11px] text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0 mt-px text-primary" />
        <span>
          Read-only. Prescribe or amend medications through the <strong>Consultation Form</strong>.
        </span>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : manual.length === 0 && derived.length === 0 ? (
        <div className="text-center py-6 text-xs text-muted-foreground">
          <Pill className="h-6 w-6 mx-auto mb-1 opacity-40" />
          No medications recorded
        </div>
      ) : (
        <>
          {derived.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                From prescriptions
              </p>
              <div className="space-y-1.5">
                {derived.map((d) => (
                  <div key={d.itemId} className="flex items-start gap-2 rounded-md border px-2 py-1.5 text-xs">
                    <Pill className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{d.drugName}</div>
                      <div className="text-foreground/70 text-[10px]">
                        {[d.dosage, d.frequency, d.duration].filter(Boolean).join(' · ') || '—'}
                      </div>
                      <div className="text-[9px] text-muted-foreground">
                        {d.doctorName} · {new Date(d.prescribedAt).toLocaleDateString('en-IN')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {manual.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Patient-reported / external
              </p>
              <div className="space-y-1.5">
                {manual.map((m) => (
                  <div key={m.id} className="flex items-start gap-2 rounded-md border px-2 py-1.5 text-xs">
                    <Pill className="h-3.5 w-3.5 text-primary-container shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-semibold">{m.drugName}</span>
                        {m.source && (
                          <Badge className="bg-primary-container/10 text-primary-container text-[9px] px-1 py-0 capitalize">
                            {m.source}
                          </Badge>
                        )}
                      </div>
                      <div className="text-foreground/70 text-[10px]">
                        {[m.dosage, m.frequency, m.route].filter(Boolean).join(' · ') || '—'}
                      </div>
                      {m.notes && <div className="text-[10px] text-foreground/60 mt-0.5">{m.notes}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
