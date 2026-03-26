'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { StatusProgression } from './status-progression';
import { cn } from '@/lib/utils';
import { Eye, MoreHorizontal } from 'lucide-react';
import type { Appointment } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AppointmentTableProps {
  appointments: Appointment[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
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
}: AppointmentTableProps) {
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
          No appointments found.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
              <th className="px-4 pb-4 pt-5 font-semibold">Patient Details</th>
              <th className="px-4 pb-4 pt-5 font-semibold">Appointment Details</th>
              <th className="px-4 pb-4 pt-5 font-semibold">Time</th>
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
                            (apt.type && categoryColors[apt.type]) || 'bg-outline'
                          )}
                          title={apt.type}
                        />
                      </div>
                      <div>
                        <p className="font-label text-sm font-bold">
                          {patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown'}
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
                      <p className="font-label text-[10px] text-on-surface-variant capitalize">{apt.type?.replace('_', ' ') || 'General'}</p>
                    </div>
                  </td>

                  {/* Time */}
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-label text-sm font-bold">{apt.startTime || '-'}</p>
                      <p className="font-label text-[10px] text-on-surface-variant">{apt.endTime ? `to ${apt.endTime}` : ''}</p>
                    </div>
                  </td>

                  {/* Payment Status */}
                  <td className="px-4 py-4">
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-secondary/10 text-secondary rounded-full">
                      Pending
                    </span>
                  </td>

                  {/* Purpose */}
                  <td className="px-4 py-4">
                    <p className="font-label text-sm truncate max-w-[150px]">
                      {apt.reason || '-'}
                    </p>
                  </td>

                  {/* Status Progression */}
                  <td className="px-4 py-4">
                    <StatusProgression status={apt.status} />
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-4 text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon" className="h-8 w-8 text-outline hover:text-primary transition-colors" />}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
  );
}
