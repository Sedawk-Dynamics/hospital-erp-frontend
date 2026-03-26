'use client';

import { useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CreatePatientDialog } from '@/components/hospital/create-patient-dialog';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Appointment } from '@/types';

export default function WalkInPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createPatientOpen, setCreatePatientOpen] = useState(false);

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
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-xl font-bold">Walk In</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setCreatePatientOpen(true)} size="sm">
            <UserPlus className="h-4 w-4 mr-1.5" />
            Register Patient
          </Button>
          <Button className="bg-primary text-white font-label font-bold text-sm px-6 py-2.5 rounded-xl hover:shadow-lg transition-shadow">New Walk In</Button>
        </div>
      </div>

      <CreatePatientDialog
        open={createPatientOpen}
        onOpenChange={setCreatePatientOpen}
      />

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
          <Input
            placeholder="Search patient..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="bg-surface-container-low border-none rounded-xl pl-12 pr-6 py-2.5 font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
          />
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Patient Details</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Doctor</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Type</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center font-label text-on-surface-variant">No walk-in entries found.</td>
                </tr>
              ) : (
                items.map((apt) => (
                  <tr key={apt.id} className="group hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-label text-sm font-bold">{apt.patient?.firstName} {apt.patient?.lastName}</p>
                      <p className="font-label text-[10px] text-on-surface-variant">{apt.patient?.mrn} | {apt.patient?.phone}</p>
                    </td>
                    <td className="px-4 py-3 font-label text-sm">
                      {apt.doctor ? `Dr. ${apt.doctor.user?.firstName} ${apt.doctor.user?.lastName}` : '-'}
                    </td>
                    <td className="px-4 py-3 font-label text-sm capitalize">{apt.type?.replace('_', ' ')}</td>
                    <td className="px-4 py-3 font-label text-sm capitalize">{apt.status?.replace('_', ' ')}</td>
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
