'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Appointment } from '@/types';

export default function WalkInPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['hospital', 'walkin', { search, page }],
    queryFn: async () => {
      const response = await apiGet<Appointment[]>('/appointments', {
        params: { type: 'consultation', search: search || undefined, page, limit: 20 },
      });
      return { data: response.data, meta: response.meta! };
    },
  });

  const items = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Walk In</h1>
        <Button>New Walk In</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search patient..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Patient Details</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Doctor</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No walk-in entries found.</td>
                </tr>
              ) : (
                items.map((apt) => (
                  <tr key={apt.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium">{apt.patient?.firstName} {apt.patient?.lastName}</p>
                      <p className="text-xs text-muted-foreground">{apt.patient?.mrn} | {apt.patient?.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      {apt.doctor ? `Dr. ${apt.doctor.user?.firstName} ${apt.doctor.user?.lastName}` : '-'}
                    </td>
                    <td className="px-4 py-3 capitalize">{apt.type?.replace('_', ' ')}</td>
                    <td className="px-4 py-3 capitalize">{apt.status?.replace('_', ' ')}</td>
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
