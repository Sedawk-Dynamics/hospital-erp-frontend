'use client';

import { useState } from 'react';
import { Pill } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import { HospitalFilter } from '../_components/hospital-filter';

export default function PatientPrescriptionsPage() {
  const [hospitalFilter, setHospitalFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['patient', 'prescriptions', hospitalFilter],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 30 };
      if (hospitalFilter) params.tenantId = hospitalFilter;
      const res = await apiGet<Array<{
        id: string; status: string; createdAt: string;
        doctor?: { user?: { firstName: string; lastName: string } };
        prescriptionItems?: Array<{ drugName?: string; dosage?: string; frequency?: string; duration?: string; instructions?: string }>;
      }>>('/patient-portal/prescriptions', { params });
      return res.data ?? [];
    },
  });

  const prescriptions = data ?? [];

  return (
    <div className="space-y-5 animate-fade-in-up">
      <h1 className="text-xl font-bold text-foreground">My Prescriptions</h1>

      <HospitalFilter value={hospitalFilter} onChange={setHospitalFilter} />

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : prescriptions.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <Pill className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No prescriptions found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {prescriptions.map((rx) => (
            <div key={rx.id} className="rounded-xl border bg-card p-5 transition-colors hover:bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Dr. {rx.doctor?.user?.firstName} {rx.doctor?.user?.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(rx.createdAt)}</p>
                </div>
                <span className={cn(
                  'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                  rx.status === 'active' && 'bg-green-100 text-green-800',
                  rx.status === 'completed' && 'bg-gray-100 text-gray-800',
                  rx.status === 'cancelled' && 'bg-red-100 text-red-800',
                )}>{rx.status}</span>
              </div>
              {rx.prescriptionItems && rx.prescriptionItems.length > 0 && (
                <div className="space-y-2">
                  {rx.prescriptionItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                      <Pill className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{item.drugName}</p>
                        <p className="text-xs text-muted-foreground">
                          {[item.dosage, item.frequency, item.duration].filter(Boolean).join(' \u00b7 ')}
                        </p>
                        {item.instructions && <p className="text-xs text-muted-foreground mt-0.5 italic">{item.instructions}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
