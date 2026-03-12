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
  consultation: 'bg-red-500',
  follow_up: 'bg-blue-500',
  emergency: 'bg-purple-500',
  procedure: 'bg-amber-500',
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
      <div className="rounded-lg border bg-card">
        <div className="p-8 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-2 text-sm text-muted-foreground">Loading appointments...</p>
        </div>
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="rounded-lg border bg-card">
        <div className="p-8 text-center text-muted-foreground">
          No appointments found.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Patient Details</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Appointment Details</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Time</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Payment Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Purpose</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Action</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((apt) => {
              const patient = apt.patient;
              const initials = patient
                ? `${patient.firstName?.[0] || ''}${patient.lastName?.[0] || ''}`.toUpperCase()
                : '?';

              return (
                <tr key={apt.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  {/* Patient Details */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className={cn(
                            'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card',
                            categoryColors[apt.type] || 'bg-gray-400'
                          )}
                          title={apt.type}
                        />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown'}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{patient?.mrn || '-'}</span>
                          <span>|</span>
                          <span>{patient?.phone || '-'}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Appointment Details */}
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {apt.doctor
                          ? `Dr. ${apt.doctor.user?.firstName || ''} ${apt.doctor.user?.lastName || ''}`
                          : '-'}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">{apt.type.replace('_', ' ')}</p>
                    </div>
                  </td>

                  {/* Time */}
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground">{apt.startTime || '-'}</p>
                      <p className="text-xs text-muted-foreground">{apt.endTime ? `to ${apt.endTime}` : ''}</p>
                    </div>
                  </td>

                  {/* Payment Status */}
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      'bg-amber-100 text-amber-800'
                    )}>
                      Pending
                    </span>
                  </td>

                  {/* Purpose */}
                  <td className="px-4 py-3">
                    <p className="text-sm text-foreground truncate max-w-[150px]">
                      {apt.reason || '-'}
                    </p>
                  </td>

                  {/* Status Progression */}
                  <td className="px-4 py-3">
                    <StatusProgression status={apt.status} />
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon" className="h-8 w-8" />}
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
        <div className="flex items-center justify-between border-t px-4 py-3">
          <p className="text-sm text-muted-foreground">
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
