'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Reservation } from '@/types';

const statusFilters = [
  { key: 'all', label: 'All' },
  { key: 'reserved', label: 'Reserved' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export function ReservationTab() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['hospital', 'reservations', { status: statusFilter, search, page }],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (search) params.search = search;
      const response = await apiGet<Reservation[]>('/clinical/admissions/reservations', { params });
      return { data: response.data, meta: response.meta! };
    },
  });

  const reservations = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {statusFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => { setStatusFilter(f.key); setPage(1); }}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                statusFilter === f.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button size="sm">Create Reservation</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search reservation..."
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
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Patient</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Diagnosis</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Consultant</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ward / Block</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Advance</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : reservations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No reservations found.
                  </td>
                </tr>
              ) : (
                reservations.map((res) => (
                  <tr key={res.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      {res.patient?.firstName} {res.patient?.lastName}
                    </td>
                    <td className="px-4 py-3">{res.diagnosis || '-'}</td>
                    <td className="px-4 py-3">
                      {res.doctor ? `Dr. ${res.doctor.user?.firstName} ${res.doctor.user?.lastName}` : '-'}
                    </td>
                    <td className="px-4 py-3">{res.ward?.name || '-'} / {res.block || '-'}</td>
                    <td className="px-4 py-3 font-medium">{res.advanceAmount?.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                        res.status === 'reserved' && 'bg-blue-100 text-blue-800',
                        res.status === 'completed' && 'bg-green-100 text-green-800',
                        res.status === 'cancelled' && 'bg-red-100 text-red-800',
                      )}>
                        {res.status}
                      </span>
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
