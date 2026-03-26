'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/date-utils';
import type { Estimation } from '@/types';

export function EstimationTab() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['hospital', 'estimations', { search, page }],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (search) params.search = search;
      const response = await apiGet<Estimation[]>('/clinical/admissions/estimations', { params });
      return { data: response.data, meta: response.meta! };
    },
  });

  const estimations = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
          <Input
            placeholder="Search estimation..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="bg-surface-container-low border-none rounded-xl pl-12 pr-6 py-2.5 font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
          />
        </div>
        <Button size="sm" className="bg-primary text-white font-label font-bold text-sm px-6 py-2.5 rounded-xl hover:shadow-lg transition-shadow">Create Estimation</Button>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Patient</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Date</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Doctor</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Complaints</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Period</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold">Estimate Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : estimations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center font-label text-on-surface-variant">
                    No estimations found.
                  </td>
                </tr>
              ) : (
                estimations.map((est) => (
                  <tr key={est.id} className="group hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-label text-sm font-bold">
                      {est.patient?.firstName} {est.patient?.lastName}
                    </td>
                    <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">
                      {formatDate(est.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-label text-sm">
                      {est.doctor ? `Dr. ${est.doctor.user?.firstName} ${est.doctor.user?.lastName}` : '-'}
                    </td>
                    <td className="px-4 py-3 font-label text-sm">{est.complaints || '-'}</td>
                    <td className="px-4 py-3 font-label text-sm">{est.estimationPeriodDays} days</td>
                    <td className="px-4 py-3 text-right font-label text-sm font-bold">
                      {est.totalEstimateAmount?.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
