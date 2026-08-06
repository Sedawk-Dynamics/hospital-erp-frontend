'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { FileSignature, Stethoscope } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { Button } from '@/components/ui/button';

/** What the portal list endpoint returns — a signed consultation plus enough
 *  visit context to say what it was about. */
interface ConsultationListItem {
  id: string;
  signedAt?: string | null;
  doctor?: { user?: { firstName: string; lastName?: string | null } } | null;
  patient?: { tenant?: { name?: string } | null } | null;
  visit?: {
    chiefComplaint?: string | null;
    diagnoses?: { id: string; diagnosisName: string }[];
  } | null;
}

export default function ConsultationSummariesListPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['patient', 'consultation-summaries'],
    queryFn: async () => {
      const res = await apiGet<ConsultationListItem[]>('/patient-portal/consultation-summaries');
      return res.data ?? [];
    },
  });

  const summaries = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-2">
          Care Records
        </p>
        <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
          Consultation Summaries
        </h1>
        <p className="font-label text-sm text-on-surface-variant mt-1.5">
          Summaries published by your doctor after each visit
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : summaries.length === 0 ? (
        <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-10 text-center">
          <div className="w-12 h-12 mx-auto bg-surface-container-high rounded-full flex items-center justify-center text-outline mb-3">
            <FileSignature className="h-5 w-5" />
          </div>
          <p className="font-label text-sm font-semibold text-on-surface">
            No consultation summaries yet
          </p>
          <p className="font-label text-xs text-on-surface-variant mt-1">
            Summaries appear here once your doctor signs and finalizes them.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {summaries.map((s) => {
            const doctorName = s.doctor?.user
              ? `Dr. ${s.doctor.user.firstName} ${s.doctor.user.lastName ?? ''}`.trim()
              : 'Doctor';
            const signedAt = s.signedAt
              ? new Date(s.signedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : '—';
            const tenantName = s.patient?.tenant?.name;
            // What the visit was actually for reads better than a count of
            // pinned sections, which meant nothing to a patient.
            const subtitle =
              (s.visit?.diagnoses ?? []).map((d) => d.diagnosisName).join(', ') ||
              s.visit?.chiefComplaint ||
              null;
            return (
              <div
                key={s.id}
                className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-4 flex items-center gap-4"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-label text-sm font-bold text-on-surface">
                    Consultation: {signedAt}
                  </p>
                  <p className="font-label text-xs text-on-surface-variant mt-0.5">
                    {doctorName}
                    {tenantName ? ` · ${tenantName}` : ''}
                  </p>
                  {subtitle && (
                    <p className="mt-0.5 truncate font-label text-xs text-primary">{subtitle}</p>
                  )}
                </div>
                <Link href={`/patient-portal/consultation-summaries/${s.id}`}>
                  <Button size="sm" variant="outline">
                    View
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
