'use client';

import { useState } from 'react';
import { Pill, Sun, Cloud, Sunset, Moon, AlertCircle, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import { HospitalFilter } from '../_components/hospital-filter';
import { parseFrequencyToSchedule } from '@/components/doctor/consultation-completion';

interface PrescriptionItem {
  drugName?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
  route?: string;
  isPrn?: boolean;
}

interface PrescriptionData {
  id: string;
  status: string;
  createdAt: string;
  doctor?: { user?: { firstName: string; lastName: string } };
  prescriptionItems?: PrescriptionItem[];
}

export default function PatientPrescriptionsPage() {
  const [hospitalFilter, setHospitalFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['patient', 'prescriptions', hospitalFilter],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 30 };
      if (hospitalFilter) params.tenantId = hospitalFilter;
      const res = await apiGet<PrescriptionData[]>('/patient-portal/prescriptions', { params });
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
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Dr. {rx.doctor?.user?.firstName} {rx.doctor?.user?.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(rx.createdAt)}</p>
                </div>
                <span className={cn(
                  'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                  rx.status === 'active' && 'bg-green-100 text-green-800',
                  rx.status === 'dispensed' && 'bg-blue-100 text-blue-800',
                  rx.status === 'completed' && 'bg-gray-100 text-gray-800',
                  rx.status === 'cancelled' && 'bg-red-100 text-red-800',
                )}>{rx.status}</span>
              </div>
              {rx.prescriptionItems && rx.prescriptionItems.length > 0 && (
                <div className="space-y-3">
                  {rx.prescriptionItems.map((item, i) => (
                    <MedicineScheduleCard key={i} item={item} index={i + 1} />
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

// ── Medicine Schedule Card ─────────────────────────────────

const TIMING_SLOTS = [
  { key: 'morning', label: 'Morning', icon: Sun, time: '8:00 AM' },
  { key: 'afternoon', label: 'Afternoon', icon: Cloud, time: '1:00 PM' },
  { key: 'evening', label: 'Evening', icon: Sunset, time: '6:00 PM' },
  { key: 'night', label: 'Night', icon: Moon, time: '10:00 PM' },
] as const;

function MedicineScheduleCard({ item, index }: { item: PrescriptionItem; index: number }) {
  const schedule = parseFrequencyToSchedule(item.frequency || '');
  const hasStructuredSchedule = schedule.morning || schedule.afternoon || schedule.evening || schedule.night || schedule.isPrn;

  return (
    <div className="rounded-lg border bg-background p-4 space-y-3">
      {/* Header: Drug name + dosage + duration */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0 mt-0.5">
            <span className="text-xs font-bold">{index}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{item.drugName}</p>
            {item.dosage && (
              <p className="text-xs text-primary font-medium">{item.dosage}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.duration && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
              <Clock className="h-2.5 w-2.5" />
              {item.duration}
            </span>
          )}
          {item.route && item.route !== 'oral' && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
              {item.route}
            </span>
          )}
        </div>
      </div>

      {/* Timing Grid or SOS */}
      {schedule.isPrn ? (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-xs font-semibold text-amber-700">Take as needed (SOS)</span>
        </div>
      ) : hasStructuredSchedule ? (
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-2">
            {TIMING_SLOTS.map((slot) => {
              const SlotIcon = slot.icon;
              const isActive = schedule[slot.key as keyof typeof schedule] as boolean;
              return (
                <div
                  key={slot.key}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg p-2 border text-center transition-colors',
                    isActive
                      ? 'bg-primary/5 border-primary/30'
                      : 'bg-muted/30 border-transparent opacity-40',
                  )}
                >
                  <SlotIcon className={cn('h-4 w-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
                  <span className={cn('text-[10px] font-semibold', isActive ? 'text-foreground' : 'text-muted-foreground')}>
                    {slot.label}
                  </span>
                  {isActive && (
                    <span className="text-[9px] text-muted-foreground">{slot.time}</span>
                  )}
                  {isActive && item.dosage && (
                    <span className="inline-flex items-center justify-center rounded bg-primary text-primary-foreground px-1.5 py-0.5 text-[9px] font-bold">
                      {item.dosage}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Meal relation */}
          {schedule.mealRelation && (
            <div className="flex items-center justify-center">
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200 px-2.5 py-0.5 text-[10px] font-semibold text-orange-700">
                🍽 {schedule.mealRelation}
              </span>
            </div>
          )}
        </div>
      ) : (
        /* Fallback: show raw frequency for legacy prescriptions */
        <p className="text-xs text-muted-foreground">
          {[item.dosage, item.frequency, item.duration].filter(Boolean).join(' · ')}
        </p>
      )}

      {/* Instructions */}
      {item.instructions && (
        <p className="text-xs text-muted-foreground italic border-t pt-2">
          📋 {item.instructions}
        </p>
      )}
    </div>
  );
}
