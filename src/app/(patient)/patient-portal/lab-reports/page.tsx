'use client';

import { useState } from 'react';
import { TestTube, Download, Eye } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { HospitalFilter } from '../_components/hospital-filter';
import { usePatientProfileStore } from '@/stores/patient-profile-store';

export default function PatientLabReportsPage() {
  const [hospitalFilter, setHospitalFilter] = useState('');
  const { selectedProfileId } = usePatientProfileStore();

  const { data, isLoading } = useQuery({
    queryKey: ['patient', 'lab-reports', hospitalFilter, selectedProfileId],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 50 };
      if (hospitalFilter) params.tenantId = hospitalFilter;
      if (selectedProfileId) params.profileId = selectedProfileId;
      const res = await apiGet<Array<{
        id: string; reportNumber?: string; status: string; createdAt: string;
        labOrder?: { id: string; orderNumber?: string; labOrderItems?: Array<{ test?: { testName: string } }> };
      }>>('/patient-portal/lab-reports', { params });
      return res.data ?? [];
    },
  });

  const reports = data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-2">
          Care Records
        </p>
        <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
          Lab Reports
        </h1>
        <p className="font-label text-sm text-on-surface-variant mt-1.5">
          Access diagnostic results and download test reports from your hospitals
        </p>
      </div>

      <HospitalFilter value={hospitalFilter} onChange={setHospitalFilter} />

      <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-container text-on-surface-variant font-label text-[10px] uppercase tracking-widest">
              <th className="px-4 py-3 text-left font-bold">Report #</th>
              <th className="px-4 py-3 text-left font-bold">Tests</th>
              <th className="px-4 py-3 text-left font-bold">Date</th>
              <th className="px-4 py-3 text-left font-bold">Status</th>
              <th className="px-4 py-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container/50">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center">
                  <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center">
                  <div className="w-12 h-12 mx-auto bg-surface-container-high rounded-full flex items-center justify-center text-outline mb-3">
                    <TestTube className="h-5 w-5" />
                  </div>
                  <p className="font-label text-sm font-semibold text-on-surface">No lab reports yet</p>
                  <p className="font-label text-xs text-on-surface-variant mt-1">
                    Your diagnostic results will appear here once published
                  </p>
                </td>
              </tr>
            ) : (
              reports.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-surface-container-low transition-colors"
                >
                  <td className="px-4 py-3 font-label font-bold text-on-surface">
                    {r.reportNumber ?? r.labOrder?.orderNumber ?? r.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    {r.labOrder?.labOrderItems?.map((i) => i.test?.testName).join(', ') || '-'}
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'text-[10px] font-bold font-label px-2 py-0.5 rounded-full capitalize',
                        r.status === 'published' && 'bg-primary/10 text-primary',
                        r.status === 'draft' && 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
                        r.status === 'verified' && 'bg-primary/10 text-primary',
                      )}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon-sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
