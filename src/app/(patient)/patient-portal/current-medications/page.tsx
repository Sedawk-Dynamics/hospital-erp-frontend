'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Stethoscope, Pill } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { HospitalFilter } from '../_components/hospital-filter';

interface DerivedMed {
  itemId: string;
  drugName: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  route?: string | null;
  instructions?: string | null;
  prescribedAt: string;
  doctorName: string;
  tenantName?: string | null;
}

interface ManualMed {
  id: string;
  drugName: string;
  dosage?: string | null;
  frequency?: string | null;
  route?: string | null;
  startedOn?: string | null;
  source?: string | null;
  notes?: string | null;
}

export default function CurrentMedicationsPage() {
  const [hospitalFilter, setHospitalFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['patient', 'current-medications', hospitalFilter],
    queryFn: async () => {
      const params: Record<string, unknown> = {};
      if (hospitalFilter) params.tenantId = hospitalFilter;
      const res = await apiGet<{ derived: DerivedMed[]; manual: ManualMed[] }>(
        '/patient-portal/current-medications',
        { params },
      );
      return res.data ?? { derived: [], manual: [] };
    },
  });

  const derived = data?.derived ?? [];
  const manual = data?.manual ?? [];
  const total = derived.length + manual.length;

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Stethoscope className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Current Medications</h1>
          <p className="text-xs text-muted-foreground">
            Medications you are currently taking. Contact your doctor to add or change.
          </p>
        </div>
      </div>

      <HospitalFilter value={hospitalFilter} onChange={setHospitalFilter} />

      {isLoading ? (
        <Loader />
      ) : total === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <Pill className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium">No current medications</p>
        </div>
      ) : (
        <div className="space-y-3">
          {manual.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                Added by your doctor
              </p>
              <div className="space-y-2">
                {manual.map((m) => (
                  <ManualCard key={m.id} med={m} />
                ))}
              </div>
            </section>
          )}
          {derived.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                From your prescriptions
              </p>
              <div className="space-y-2">
                {derived.map((d) => (
                  <DerivedCard key={d.itemId} med={d} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function ManualCard({ med }: { med: ManualMed }) {
  return (
    <div className="rounded-xl border-2 bg-card p-3 flex items-start gap-3">
      <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
        <Pill className="h-4 w-4 text-blue-700" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-bold">{med.drugName}</p>
          {med.source && (
            <Badge className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0 capitalize">
              {med.source}
            </Badge>
          )}
        </div>
        <p className="text-xs text-foreground/80 mt-0.5">
          {[med.dosage, med.frequency, med.route].filter(Boolean).join(' · ') || '—'}
        </p>
        {med.notes && <p className="text-[11px] text-foreground/70 mt-1">{med.notes}</p>}
        {med.startedOn && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Since {new Date(med.startedOn).toLocaleDateString('en-IN')}
          </p>
        )}
      </div>
    </div>
  );
}

function DerivedCard({ med }: { med: DerivedMed }) {
  return (
    <div className="rounded-xl border bg-card p-3 flex items-start gap-3">
      <div className="h-9 w-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
        <Pill className="h-4 w-4 text-green-700" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold">{med.drugName}</p>
        <p className="text-xs text-foreground/80 mt-0.5">
          {[med.dosage, med.frequency, med.duration, med.route].filter(Boolean).join(' · ') || '—'}
        </p>
        {med.instructions && <p className="text-[11px] text-foreground/70 mt-1">{med.instructions}</p>}
        <p className="text-[10px] text-muted-foreground mt-1">
          {med.doctorName}
          {med.tenantName && ` · ${med.tenantName}`}
          {` · ${new Date(med.prescribedAt).toLocaleDateString('en-IN')}`}
        </p>
      </div>
    </div>
  );
}

function Loader() {
  return (
    <div className="flex justify-center py-12">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
