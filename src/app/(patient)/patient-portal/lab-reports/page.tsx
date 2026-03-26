'use client';

import { useState } from 'react';
import { TestTube, Download, Eye } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { HospitalFilter } from '../_components/hospital-filter';

export default function PatientLabReportsPage() {
  const [hospitalFilter, setHospitalFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['patient', 'lab-reports', hospitalFilter],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 50 };
      if (hospitalFilter) params.tenantId = hospitalFilter;
      const res = await apiGet<Array<{
        id: string; reportNumber?: string; status: string; createdAt: string;
        labOrder?: { id: string; orderNumber?: string; labOrderItems?: Array<{ test?: { testName: string } }> };
      }>>('/patient-portal/lab-reports', { params });
      return res.data ?? [];
    },
  });

  const reports = data ?? [];

  return (
    <div className="space-y-5 animate-fade-in-up">
      <h1 className="text-xl font-bold text-foreground">Lab Reports</h1>

      <HospitalFilter value={hospitalFilter} onChange={setHospitalFilter} />

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Report #</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tests</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center"><div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></td></tr>
            ) : reports.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center">
                <TestTube className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No lab reports yet</p>
              </td></tr>
            ) : (
              reports.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{r.reportNumber ?? r.labOrder?.orderNumber ?? r.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.labOrder?.labOrderItems?.map((i) => i.test?.testName).join(', ') || '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                      r.status === 'published' && 'bg-green-100 text-green-800',
                      r.status === 'draft' && 'bg-gray-100 text-gray-800',
                      r.status === 'verified' && 'bg-blue-100 text-blue-800',
                    )}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon-sm"><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon-sm"><Download className="h-4 w-4" /></Button>
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
