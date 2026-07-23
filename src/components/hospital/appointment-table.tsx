'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusProgression } from './status-progression';
import { TempPatientActions, isTemporaryPatient } from '@/components/hospital/temp-patient-actions';
import {
  AppointmentRowActions,
  type AppointmentRowLike,
} from './appointment-row-actions';
import { cn } from '@/lib/utils';
import { formatDate, formatTime24 } from '@/lib/date-utils';
import type { Appointment } from '@/types';

interface AppointmentTableProps {
  appointments: Appointment[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Lead with the queue token — the Walk In / Front Desk queues want it. */
  showToken?: boolean;
  /** Copy for the empty state, so each queue can phrase it in its own terms. */
  emptyMessage?: string;
  /** Fired after any row action mutates, so the host can refresh its queries. */
  onChanged?: () => void;
}

/** Normalize @db.Time() values (plain "HH:mm" or "HH:mm:ss") into ISO strings that formatTime24 can parse */
function normalizeTimeValue(value: string | undefined | null): string | null {
  if (!value) return null;
  if (value.includes('T')) return value; // already ISO
  if (/^\d{2}:\d{2}/.test(value)) return `1970-01-01T${value}Z`;
  return value;
}

const categoryColors: Record<string, string> = {
  consultation: 'bg-error',
  follow_up: 'bg-primary',
  emergency: 'bg-tertiary',
  procedure: 'bg-secondary',
};

export function AppointmentTable({
  appointments,
  isLoading,
  page,
  totalPages,
  total,
  onPageChange,
  showToken = false,
  emptyMessage = 'No appointments found.',
  onChanged,
}: AppointmentTableProps) {
  const [tokenOf] = useState(() => (apt: Appointment) => {
    const a = apt as unknown as {
      tokenNumber?: number;
      queueTokens?: Array<{ tokenNumber: number }>;
    };
    const n = a.tokenNumber ?? a.queueTokens?.[0]?.tokenNumber;
    return n ? `#${n}` : '-';
  });

  if (isLoading) {
    return (
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        <div className="p-8 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-2 font-label text-sm text-on-surface-variant">Loading appointments...</p>
        </div>
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        <div className="p-8 text-center text-on-surface-variant font-label">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                {showToken && <th className="px-4 pb-4 pt-5 font-semibold">Token</th>}
                <th className="px-4 pb-4 pt-5 font-semibold">Patient Details</th>
                <th className="px-4 pb-4 pt-5 font-semibold">Appointment Details</th>
                <th className="px-4 pb-4 pt-5 font-semibold">Date & Time</th>
                <th className="px-4 pb-4 pt-5 font-semibold">Payment Status</th>
                <th className="px-4 pb-4 pt-5 font-semibold">Purpose</th>
                <th className="px-4 pb-4 pt-5 font-semibold">Status</th>
                <th className="px-4 pb-4 pt-5 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {appointments.map((apt) => {
                const patient = apt.patient;
                const initials = patient
                  ? `${patient.firstName?.[0] || ''}${patient.lastName?.[0] || ''}`.toUpperCase()
                  : '?';

                return (
                  <tr key={apt.id} className="group hover:bg-surface-container-low transition-colors">
                    {showToken && (
                      <td className="px-4 py-4">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 font-label text-sm font-bold text-primary">
                          {tokenOf(apt)}
                        </span>
                      </td>
                    )}

                    {/* Patient Details */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-10 w-10 rounded-xl">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary rounded-xl">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div
                            className={cn(
                              'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface-container-lowest',
                              ((apt.consultationType || apt.type) && categoryColors[apt.consultationType || apt.type]) || 'bg-outline'
                            )}
                            title={apt.consultationType || apt.type}
                          />
                        </div>
                        <div>
                          <p className="flex items-center gap-1.5 font-label text-sm font-bold">
                            {patient ? [patient.firstName, patient.lastName].filter(Boolean).join(' ') : 'Unknown'}
                            {isTemporaryPatient(patient) && (
                              <Badge variant="secondary" className="uppercase">Temp</Badge>
                            )}
                          </p>
                          <div className="flex items-center gap-2 font-label text-[10px] text-on-surface-variant">
                            <span>{patient?.mrn || '-'}</span>
                            <span>|</span>
                            <span>{patient?.phone || '-'}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Appointment Details */}
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-label text-sm font-bold">
                          {apt.doctor
                            ? `Dr. ${apt.doctor.user?.firstName || ''} ${apt.doctor.user?.lastName || ''}`
                            : '-'}
                        </p>
                        <p className="font-label text-[10px] text-on-surface-variant capitalize">{(apt.consultationType || apt.type)?.replace('_', ' ') || 'General'}</p>
                      </div>
                    </td>

                    {/* Date & Time */}
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-label text-[10px] text-on-surface-variant">{formatDate(apt.appointmentDate)}</p>
                        <p className="font-label text-sm font-bold">{formatTime24(normalizeTimeValue(apt.startTime))} - {formatTime24(normalizeTimeValue(apt.endTime))}</p>
                      </div>
                    </td>

                    {/* Payment Status */}
                    <td className="px-4 py-4">
                      {apt.paymentInfo ? (
                        <div>
                          <span className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full inline-block',
                            apt.paymentInfo.paymentStatus === 'paid_online' && 'bg-green-100 text-green-700',
                            apt.paymentInfo.paymentStatus === 'paid_at_frontdesk' && 'bg-emerald-100 text-emerald-700',
                            apt.paymentInfo.paymentStatus === 'pay_at_frontdesk' && 'bg-amber-100 text-amber-700',
                            apt.paymentInfo.paymentStatus === 'pending' && 'bg-blue-100 text-blue-700',
                          )}>
                            {apt.paymentInfo.paymentStatus === 'paid_online' && 'Paid Online'}
                            {apt.paymentInfo.paymentStatus === 'paid_at_frontdesk' && 'Paid at Desk'}
                            {apt.paymentInfo.paymentStatus === 'pay_at_frontdesk' && 'Pay at Desk'}
                            {apt.paymentInfo.paymentStatus === 'pending' && 'Payment Pending'}
                          </span>
                          {apt.paymentInfo.balanceDue > 0 && (
                            <p className="text-[10px] text-on-surface-variant mt-0.5 font-label">
                              &#8377;{apt.paymentInfo.balanceDue.toLocaleString('en-IN')} due
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-muted text-muted-foreground rounded-full">
                          No Billing
                        </span>
                      )}
                    </td>

                    {/* Purpose */}
                    <td className="px-4 py-4">
                      <p className="font-label text-sm truncate max-w-[150px]">
                        {apt.reason || '-'}
                      </p>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">
                      <StatusProgression status={apt.status} />
                    </td>

                    {/* Actions — shared with the Walk In / Front Desk queues */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {isTemporaryPatient(patient) && patient && (
                          <TempPatientActions patient={patient as any} />
                        )}
                        <AppointmentRowActions
                          appointment={apt as unknown as AppointmentRowLike}
                          onChanged={onChanged}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-surface-container px-4 py-3">
            <p className="font-label text-xs text-on-surface-variant">
              Showing page {page} of {totalPages} ({total} total)
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

    </>
  );
}
