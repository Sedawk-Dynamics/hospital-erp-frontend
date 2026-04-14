'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { FileCheck, Download, Calendar } from 'lucide-react';
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
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <FileCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Discharge Summaries</h1>
          <p className="text-xs text-muted-foreground">Hospital discharge summaries published by your doctors.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : summaries.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <FileCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">No discharge summaries yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Summaries appear here once your doctor publishes them.
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
                  day: 'numeric', month: 'short', year: 'numeric',
                })
              : '—';
            return (
              <div key={s.id} className="rounded-xl border-2 bg-card p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileCheck className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">
                    Discharged: {dischargeDate}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {doctorName}
                    {s.patient?.tenant?.name && ` · ${s.patient.tenant.name}`}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link href={`/patient-portal/discharge-summaries/${s.id}`}>
                    <Button size="sm" variant="outline">View</Button>
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
