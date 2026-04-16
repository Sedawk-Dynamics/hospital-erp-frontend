'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { FileCheck, Download } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface Summary {
  id: string;
  admissionDate?: string | null;
  dischargeDate?: string | null;
  signedAt?: string | null;
  doctor?: { user?: { firstName: string; lastName: string } } | null;
  patient?: { tenant?: { id: string; name: string } | null } | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

function getAuthToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

export default function DischargeSummariesListPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['patient', 'discharge-summaries'],
    queryFn: async () => {
      const res = await apiGet<Summary[]>('/patient-portal/discharge-summaries');
      return res.data ?? [];
    },
  });

  const summaries = data ?? [];

  const downloadPdf = async (id: string) => {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE}/patient-portal/discharge-summaries/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `discharge-summary-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-2">
          Care Records
        </p>
        <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
          Discharge Summaries
        </h1>
        <p className="font-label text-sm text-on-surface-variant mt-1.5">
          Hospital discharge summaries published by your doctors
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : summaries.length === 0 ? (
        <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-10 text-center">
          <div className="w-12 h-12 mx-auto bg-surface-container-high rounded-full flex items-center justify-center text-outline mb-3">
            <FileCheck className="h-5 w-5" />
          </div>
          <p className="font-label text-sm font-semibold text-on-surface">No discharge summaries yet</p>
          <p className="font-label text-xs text-on-surface-variant mt-1">
            Summaries appear here once your doctor publishes them
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {summaries.map((s) => {
            const doctorName = s.doctor?.user
              ? `Dr. ${s.doctor.user.firstName} ${s.doctor.user.lastName}`
              : 'Doctor';
            const dischargeDate = s.dischargeDate
              ? new Date(s.dischargeDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : '—';
            return (
              <div
                key={s.id}
                className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-4 flex items-center gap-4"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <FileCheck className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-label text-sm font-bold text-on-surface">
                    Discharged: {dischargeDate}
                  </p>
                  <p className="font-label text-xs text-on-surface-variant mt-0.5">
                    {doctorName}
                    {s.patient?.tenant?.name && ` · ${s.patient.tenant.name}`}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link href={`/patient-portal/discharge-summaries/${s.id}`}>
                    <Button size="sm" variant="outline">
                      View
                    </Button>
                  </Link>
                  <Button size="sm" onClick={() => downloadPdf(s.id)} className="gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    PDF
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
