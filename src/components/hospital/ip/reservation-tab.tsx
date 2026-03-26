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
                'rounded-full px-3 py-1 text-[10px] font-bold transition-colors',
                statusFilter === f.key
                  ? 'bg-primary text-white'
                  : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-high/80'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button size="sm" className="bg-primary text-white font-label font-bold text-sm px-6 py-2.5 rounded-xl hover:shadow-lg transition-shadow">Create Reservation</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
        <Input
          placeholder="Search reservation..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="bg-surface-container-low border-none rounded-xl pl-12 pr-6 py-2.5 font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
        />
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Patient</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Diagnosis</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Consultant</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Ward / Block</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Advance</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : reservations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center font-label text-on-surface-variant">
                    No reservations found.
                  </td>
                </tr>
              ) : (
                reservations.map((res) => (
                  <tr key={res.id} className="group hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-label text-sm font-bold">
                      {res.patient?.firstName} {res.patient?.lastName}
                    </td>
                    <td className="px-4 py-3 font-label text-sm">{res.diagnosis || '-'}</td>
                    <td className="px-4 py-3 font-label text-sm">
                      {res.doctor ? `Dr. ${res.doctor.user?.firstName} ${res.doctor.user?.lastName}` : '-'}
                    </td>
                    <td className="px-4 py-3 font-label text-sm">{res.ward?.name || '-'} / {res.block || '-'}</td>
                    <td className="px-4 py-3 font-label text-sm font-bold">{res.advanceAmount?.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                        res.status === 'reserved' && 'bg-secondary/10 text-secondary',
                        res.status === 'completed' && 'bg-primary/10 text-primary',
                        res.status === 'cancelled' && 'bg-error-container text-on-error-container',
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
