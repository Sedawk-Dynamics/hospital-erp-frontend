'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Users, ShieldCheck } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { allergiesKey, familyKey, LIVE } from '@/components/shared/patient-history-panel';
import { cn } from '@/lib/utils';

/**
 * Allergies and family disorders, shown the moment a consultation opens.
 *
 * These used to be buried two levels deep (Medical History tab → Allergies /
 * Family sub-tab), so a doctor could write a whole prescription without ever
 * seeing that the patient is allergic to what they just prescribed. They are
 * the two facts that must be on screen before anything else.
 */

interface Allergy {
  id: string;
  allergen: string;
  allergyType: string;
  severity?: string | null;
  reaction?: string | null;
}

interface FamilyEntry {
  id: string;
  conditionName: string;
  relationSide: string;
  relationship?: string | null;
}

const SEVERITY_TONE: Record<string, string> = {
  life_threatening: 'bg-red-600 text-white',
  severe: 'bg-red-100 text-red-800 ring-1 ring-red-300',
  moderate: 'bg-amber-100 text-amber-800 ring-1 ring-amber-300',
  mild: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
};

export function PatientSafetyBanner({
  patientId,
  className,
}: {
  patientId: string;
  className?: string;
}) {
  // Same query keys as PatientHistoryPanel on purpose: adding an allergy there
  // — or the patient adding one in the portal — has to refresh this banner,
  // which it never did while the two used different keys.
  const { data: allergies, isLoading: allergiesLoading } = useQuery({
    queryKey: allergiesKey(patientId),
    queryFn: async () => {
      const res = await apiGet<Allergy[]>(`/medical-history/${patientId}/allergies`);
      return res.data ?? [];
    },
    enabled: !!patientId,
    ...LIVE,
  });

  const { data: family } = useQuery({
    queryKey: familyKey(patientId),
    queryFn: async () => {
      const res = await apiGet<FamilyEntry[]>(`/medical-history/${patientId}/family`);
      return res.data ?? [];
    },
    enabled: !!patientId,
    ...LIVE,
  });

  if (!patientId || allergiesLoading) return null;

  const allergyList = allergies ?? [];
  const familyList = family ?? [];
  const hasAllergies = allergyList.length > 0;

  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2',
        hasAllergies ? 'border-red-300 bg-red-50/70' : 'border-emerald-200 bg-emerald-50/60',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {hasAllergies ? (
          <>
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <span className="font-label text-[11px] font-bold uppercase tracking-widest text-red-700">
              Allergies
            </span>
            {allergyList.map((a) => (
              <span
                key={a.id}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  SEVERITY_TONE[a.severity ?? 'mild'] ?? SEVERITY_TONE.mild,
                )}
                title={
                  [a.allergyType, a.severity?.replace(/_/g, ' '), a.reaction]
                    .filter(Boolean)
                    .join(' · ') || undefined
                }
              >
                {a.allergen}
              </span>
            ))}
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="font-label text-[11px] font-semibold text-emerald-800">
              No known allergies on file
            </span>
          </>
        )}
      </div>

      {familyList.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-black/5 pt-1.5">
          <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="font-label text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Family
          </span>
          {familyList.map((f) => (
            <span
              key={f.id}
              className="rounded-full bg-background/80 px-2 py-0.5 text-[11px] font-medium ring-1 ring-black/5"
            >
              {f.conditionName}
              <span className="text-muted-foreground">
                {' '}
                · {f.relationship || f.relationSide}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
