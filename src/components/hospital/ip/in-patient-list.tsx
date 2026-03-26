'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Admission } from '@/types';

const statItems = [
  { key: 'all', label: 'Total', color: 'text-foreground' },
  { key: 'admitted', label: 'In IP', color: 'text-blue-600' },
  { key: 'discharged', label: 'Discharged', color: 'text-green-600' },
  { key: 'cancelled', label: 'Cancelled', color: 'text-red-600' },
];

export function InPatientList() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['hospital', 'admissions', { status: statusFilter, search, page }],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (search) params.search = search;
      const response = await apiGet<Admission[]>('/clinical/admissions', { params });
      return { data: response.data, meta: response.meta! };
    },
  });

  const admissions = data?.data ?? [];

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex gap-2 overflow-x-auto">
        {statItems.map((item) => (
          <button
            key={item.key}
            onClick={() => { setStatusFilter(item.key); setPage(1); }}
            className={cn(
              'flex flex-col items-center rounded-xl border-2 px-4 py-3 min-w-[90px] transition-all',
              statusFilter === item.key
                ? 'border-primary bg-primary/5'
                : 'border-transparent bg-surface-container-lowest hover:border-surface-container'
            )}
          >
            <span className={cn('text-xl font-bold', item.color)}>-</span>
            <span className="font-label text-xs text-on-surface-variant uppercase tracking-widest mt-1">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
        <Input
          placeholder="Search patient, IP number..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="bg-surface-container-low border-none rounded-xl pl-12 pr-6 py-2.5 font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
        />
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Patient Details</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">IP Records</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Consultant</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Bed / Ward</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Advance</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center font-label text-on-surface-variant">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : admissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center font-label text-on-surface-variant">
                    No admissions found.
                  </td>
                </tr>
              ) : (
                admissions.map((adm) => {
                  const initials = `${adm.patient?.firstName?.[0] || ''}${adm.patient?.lastName?.[0] || ''}`.toUpperCase();
                  return (
                    <tr key={adm.id} className="group hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-label text-sm font-bold">{adm.patient?.firstName} {adm.patient?.lastName}</p>
                            <p className="font-label text-[10px] text-on-surface-variant">{adm.patient?.mrn} | {adm.patient?.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-label text-[10px] text-on-surface-variant">{adm.admissionReason || '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-label text-sm">
                          {adm.doctor ? `Dr. ${adm.doctor.user?.firstName || ''} ${adm.doctor.user?.lastName || ''}` : '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-label text-sm">{adm.bed?.bedNumber || '-'} / {adm.ward?.name || '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-label text-sm font-bold">{adm.depositAmount?.toLocaleString() ?? 0}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                          adm.status === 'admitted' && 'bg-primary/10 text-primary',
                          adm.status === 'discharged' && 'bg-primary/10 text-primary',
                          adm.status === 'transferred' && 'bg-secondary/10 text-secondary',
                          adm.status === 'absconded' && 'bg-error-container text-on-error-container',
                        )}>
                          {adm.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {(data?.meta?.totalPages ?? 1) > 1 && (
          <div className="flex items-center justify-between border-t border-surface-container px-4 py-3">
            <p className="font-label text-sm text-on-surface-variant">
              Page {page} of {data?.meta?.totalPages} ({data?.meta?.total} total)
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= (data?.meta?.totalPages ?? 1)} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
