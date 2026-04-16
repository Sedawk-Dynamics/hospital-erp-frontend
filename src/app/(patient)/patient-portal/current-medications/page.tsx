'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pill } from 'lucide-react';
import { apiGet } from '@/lib/api';
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-2">
          Care Records
        </p>
        <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
          Current Medications
        </h1>
        <p className="font-label text-sm text-on-surface-variant mt-1.5">
          Medications you are currently taking. Contact your doctor to add or change.
        </p>
      </div>

      <HospitalFilter value={hospitalFilter} onChange={setHospitalFilter} />

      {isLoading ? (
        <Loader />
      ) : total === 0 ? (
        <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-10 text-center">
          <div className="w-12 h-12 mx-auto bg-surface-container-high rounded-full flex items-center justify-center text-outline mb-3">
            <Pill className="h-5 w-5" />
          </div>
          <p className="font-label text-sm font-semibold text-on-surface">No current medications</p>
          <p className="font-label text-xs text-on-surface-variant mt-1">
            Medications prescribed by your care team will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {manual.length > 0 && (
            <section>
              <p className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">
                Added by your doctor
              </p>
              <div className="space-y-3">
                {manual.map((m) => (
                  <ManualCard key={m.id} med={m} />
                ))}
              </div>
            </section>
          )}
          {derived.length > 0 && (
            <section>
              <p className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">
                From your prescriptions
              </p>
              <div className="space-y-3">
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
    <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-4 flex items-start gap-3">
      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Pill className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="font-label text-sm font-bold text-on-surface">{med.drugName}</p>
          {med.source && (
            <span className="text-[10px] font-bold font-label px-2 py-0.5 rounded-full capitalize bg-primary/10 text-primary">
              {med.source}
            </span>
          )}
        </div>
        <p className="font-label text-xs text-on-surface-variant mt-0.5">
          {[med.dosage, med.frequency, med.route].filter(Boolean).join(' · ') || '—'}
        </p>
        {med.notes && (
          <p className="font-label text-[11px] text-on-surface-variant mt-1">{med.notes}</p>
        )}
        {med.startedOn && (
          <p className="font-label text-[10px] text-outline mt-1">
            Since {new Date(med.startedOn).toLocaleDateString('en-IN')}
          </p>
        )}
      </div>
    </div>
  );
}

function DerivedCard({ med }: { med: DerivedMed }) {
  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-4 flex items-start gap-3">
      <div className="h-10 w-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
        <Pill className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-label text-sm font-bold text-on-surface">{med.drugName}</p>
        <p className="font-label text-xs text-on-surface-variant mt-0.5">
          {[med.dosage, med.frequency, med.duration, med.route].filter(Boolean).join(' · ') || '—'}
        </p>
        {med.instructions && (
          <p className="font-label text-[11px] text-on-surface-variant mt-1">{med.instructions}</p>
        )}
        <p className="font-label text-[10px] text-outline mt-1">
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
