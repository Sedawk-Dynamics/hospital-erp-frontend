'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
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
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search estimation..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Button size="sm">Create Estimation</Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Patient</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Doctor</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Complaints</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Period</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Estimate Amount</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : estimations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No estimations found.
                  </td>
                </tr>
              ) : (
                estimations.map((est) => (
                  <tr key={est.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      {est.patient?.firstName} {est.patient?.lastName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(est.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {est.doctor ? `Dr. ${est.doctor.user?.firstName} ${est.doctor.user?.lastName}` : '-'}
                    </td>
                    <td className="px-4 py-3">{est.complaints || '-'}</td>
                    <td className="px-4 py-3">{est.estimationPeriodDays} days</td>
                    <td className="px-4 py-3 text-right font-semibold">
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
