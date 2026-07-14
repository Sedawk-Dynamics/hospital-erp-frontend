'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { BedDouble, ChevronRight, Stethoscope, MapPin } from 'lucide-react';
import { apiGet } from '@/lib/api';

interface AdmissionListItem {
  id: string;
  status: string;
  admissionDate?: string | null;
  dischargeDate?: string | null;
  lengthOfStayDays?: number | null;
  admissionReason?: string | null;
  ward?: string | null;
  bed?: string | null;
  hospital?: string | null;
  doctor?: string | null;
  specialization?: string | null;
  primaryDiagnosis?: string | null;
  dischargeSummaryId?: string | null;
}

const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    admitted: 'bg-emerald-100 text-emerald-800',
    discharged: 'bg-slate-200 text-slate-700',
    transferred: 'bg-amber-100 text-amber-800',
    absconded: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${map[status] ?? 'bg-slate-200 text-slate-700'}`}>
      {status === 'admitted' ? 'Currently admitted' : status}
    </span>
  );
}

export default function AdmissionsListPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['patient', 'admissions'],
    queryFn: async () => (await apiGet<AdmissionListItem[]>('/patient-portal/admissions')).data ?? [],
  });
  const admissions = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-2">Care Records</p>
        <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">Hospitalizations</h1>
        <p className="font-label text-sm text-on-surface-variant mt-1.5">
          Your in-patient stays — admission details, diagnoses, vitals, medications, procedures and bills
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : admissions.length === 0 ? (
        <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-10 text-center">
          <div className="w-12 h-12 mx-auto bg-surface-container-high rounded-full flex items-center justify-center text-outline mb-3">
            <BedDouble className="h-5 w-5" />
          </div>
          <p className="font-label text-sm font-semibold text-on-surface">No hospitalizations yet</p>
          <p className="font-label text-xs text-on-surface-variant mt-1">
            Your in-patient stays appear here once you&apos;re admitted
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {admissions.map((a) => (
            <Link
              key={a.id}
              href={`/patient-portal/admissions/${a.id}`}
              className="block rounded-xl bg-surface-container-lowest shadow-sanctuary p-4 transition-colors hover:bg-surface-container-low"
            >
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <BedDouble className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-label text-sm font-bold text-on-surface">
                      {fmtDate(a.admissionDate)}
                      {a.status === 'discharged' && ` – ${fmtDate(a.dischargeDate)}`}
                    </p>
                    <StatusPill status={a.status} />
                    {a.lengthOfStayDays != null && (
                      <span className="text-[11px] text-on-surface-variant">· {a.lengthOfStayDays} day(s)</span>
                    )}
                  </div>
                  {a.primaryDiagnosis && (
                    <p className="font-label text-[13px] font-medium text-on-surface mt-1 truncate">{a.primaryDiagnosis}</p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-on-surface-variant">
                    {a.doctor && (
                      <span className="inline-flex items-center gap-1"><Stethoscope className="h-3 w-3" />{a.doctor}{a.specialization ? ` · ${a.specialization}` : ''}</span>
                    )}
                    {(a.ward || a.bed) && (
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{[a.ward, a.bed].filter(Boolean).join(' · ')}</span>
                    )}
                    {a.hospital && <span>{a.hospital}</span>}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-outline shrink-0 self-center" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
