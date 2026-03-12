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
              'flex flex-col items-center rounded-lg border-2 px-4 py-3 min-w-[90px] transition-all',
              statusFilter === item.key
                ? 'border-primary bg-primary/5'
                : 'border-transparent bg-card hover:border-border'
            )}
          >
            <span className={cn('text-xl font-bold', item.color)}>-</span>
            <span className="text-xs text-muted-foreground mt-1">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search patient, IP number..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Patient Details</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">IP Records</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Consultant</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Bed / Ward</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Advance</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : admissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No admissions found.
                  </td>
                </tr>
              ) : (
                admissions.map((adm) => {
                  const initials = `${adm.patient?.firstName?.[0] || ''}${adm.patient?.lastName?.[0] || ''}`.toUpperCase();
                  return (
                    <tr key={adm.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{adm.patient?.firstName} {adm.patient?.lastName}</p>
                            <p className="text-xs text-muted-foreground">{adm.patient?.mrn} | {adm.patient?.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-muted-foreground">{adm.admissionReason || '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm">
                          {adm.doctor ? `Dr. ${adm.doctor.user?.firstName || ''} ${adm.doctor.user?.lastName || ''}` : '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm">{adm.bed?.bedNumber || '-'} / {adm.ward?.name || '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium">{adm.depositAmount?.toLocaleString() ?? 0}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                          adm.status === 'admitted' && 'bg-blue-100 text-blue-800',
                          adm.status === 'discharged' && 'bg-green-100 text-green-800',
                          adm.status === 'transferred' && 'bg-amber-100 text-amber-800',
                          adm.status === 'absconded' && 'bg-red-100 text-red-800',
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
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
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
