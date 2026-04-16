'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface Summary {
  id: string;
  status: string;
  headerSummary?: string | null;
  diagnosesSummary?: string | null;
  proceduresSummary?: string | null;
  keyLabsSummary?: string | null;
  labResultsSummary?: string | null;
  medicationReconciliation?: string | null;
  dischargeInstructions?: string | null;
  followUpDate?: string | null;
  followUpInstructions?: string | null;
  signedAt?: string | null;
  doctor?: { user?: { firstName: string; lastName: string } } | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export default function DischargeSummaryDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const { data, isLoading } = useQuery({
    queryKey: ['patient', 'discharge-summary', id],
    queryFn: async () => {
      const res = await apiGet<Summary>(`/patient-portal/discharge-summaries/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  const downloadPdf = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
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

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/patient-portal/discharge-summaries">
          <Button size="sm" variant="ghost" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <Button size="sm" onClick={downloadPdf} className="gap-1.5">
          <Download className="h-3.5 w-3.5" /> Download PDF
        </Button>
      </div>

      <div>
        <p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-2">
          Care Records
        </p>
        <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
          Discharge Summary
        </h1>
        <p className="font-label text-sm text-on-surface-variant mt-1.5">
          {data.doctor?.user
            ? `Signed by Dr. ${data.doctor.user.firstName} ${data.doctor.user.lastName}`
            : 'Full discharge record from your care team'}
        </p>
      </div>

      <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-6 space-y-6">
        <Section title="Patient & Admission Details" body={data.headerSummary} />
        <Section title="Diagnoses" body={data.diagnosesSummary} />
        <Section title="Clinical Course / Procedures" body={data.proceduresSummary} />
        <Section title="Key Labs / Imaging" body={data.keyLabsSummary} />
        <Section title="All Lab Results" body={data.labResultsSummary} />
        <Section title="Medications" body={data.medicationReconciliation} />
        <Section title="Discharge Instructions" body={data.dischargeInstructions} />
        {(data.followUpDate || data.followUpInstructions) && (
          <Section
            title="Follow-up"
            body={[
              data.followUpDate ? `Date: ${new Date(data.followUpDate).toLocaleDateString('en-IN')}` : '',
              data.followUpInstructions || '',
            ]
              .filter(Boolean)
              .join('\n')}
          />
        )}
      </div>
    </div>
  );
}

function Section({ title, body }: { title: string; body?: string | null }) {
  if (!body) return null;
  return (
    <div className="border-t border-outline-variant/30 first:border-t-0 first:pt-0 pt-4">
      <h3 className="font-headline text-sm font-bold text-on-surface mb-2">{title}</h3>
      <pre className="whitespace-pre-wrap text-xs text-on-surface-variant font-sans leading-relaxed">
        {body}
      </pre>
    </div>
  );
}
