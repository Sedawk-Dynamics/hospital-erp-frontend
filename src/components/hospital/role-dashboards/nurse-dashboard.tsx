'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import {
  Activity, ClipboardList, Pill, ArrowRightLeft, Users,
  CheckCircle2, Clock, AlertTriangle, Stethoscope,
} from 'lucide-react';

interface AssignedPatient {
  id: string;
  patient: { firstName: string; lastName: string; mrn: string };
  ward?: { name: string };
  bed?: { bedNumber: string };
  doctor?: { user?: { firstName: string; lastName: string } };
  vitalsStatus?: 'due' | 'recorded' | 'overdue';
  lastVitalsAt?: string;
  admissionDate: string;
}

interface Handover {
  id: string;
  // These are RELATIONS on ShiftHandoverNote, not strings. Typing them as
  // strings and rendering {h.fromNurse} threw "Objects are not valid as a React
  // child" the moment this table had a row.
  fromNurse?: { id: string; firstName: string; lastName?: string | null } | null;
  toNurse?: { id: string; firstName: string; lastName?: string | null } | null;
  ward?: { id: string; name: string } | null;
  shiftType: string;
  status: 'submitted' | 'acknowledged';
  createdAt: string;
}

const nurseName = (n?: { firstName: string; lastName?: string | null } | null, fallback = '—') =>
  n ? `${n.firstName} ${n.lastName ?? ''}`.trim() : fallback;

export function NurseDashboard() {
  const [page, setPage] = useState(1);

  const { data: admissionsData, isLoading: admissionsLoading } = useQuery({
    queryKey: ['nurse', 'assigned-patients', page],
    queryFn: async () => {
      const response = await apiGet<AssignedPatient[]>('/clinical/admissions', {
        params: { page, limit: 15, status: 'active' },
      });
      return { data: response.data, meta: response.meta };
    },
  });

  const { data: handovers, isLoading: handoversLoading } = useQuery({
    queryKey: ['nurse', 'handovers'],
    queryFn: async () => {
      // `status` is not in getHandoversQuerySchema, and validate() REPLACES
      // req.query with the parsed object — so this filter was silently dropped
      // and the "pending handovers" table listed every handover in the tenant.
      const response = await apiGet<Handover[]>('/communication/handovers', {
        params: { isAcknowledged: 'false', limit: 10 },
      });
      return response.data;
    },
  });

  const patients = admissionsData?.data ?? [];
  const pendingHandovers = handovers ?? [];

  // Compute task stats from patient data
  const totalPatients = patients.length;
  const vitalsDue = patients.filter((p) => p.vitalsStatus === 'due' || p.vitalsStatus === 'overdue').length;
  const vitalsOverdue = patients.filter((p) => p.vitalsStatus === 'overdue').length;
  const vitalsRecorded = patients.filter((p) => p.vitalsStatus === 'recorded').length;

  const stats = [
    { label: 'Assigned Patients', value: totalPatients, icon: Users },
    { label: 'Vitals Recorded', value: vitalsRecorded, icon: CheckCircle2 },
    { label: 'Vitals Due', value: vitalsDue, icon: Clock },
    { label: 'Overdue', value: vitalsOverdue, icon: AlertTriangle },
  ];

  const quickActions = [
    { label: 'Record Vitals', icon: Activity, href: '/hospital/vitals/new' },
    { label: 'Add Nursing Note', icon: ClipboardList, href: '/hospital/notes/new' },
    { label: 'Medication Schedule', icon: Pill, href: '/hospital/medications' },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold">Nursing Dashboard</h1>
          <p className="font-label text-[10px] text-on-surface-variant mt-0.5">Manage your assigned patients and tasks</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-surface-container-lowest p-6 rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] border-l-4 border-primary transition-all duration-150 hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-headline text-3xl font-extrabold">{stat.value}</p>
                <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        {quickActions.map((action) => (
          <Button key={action.label} variant="outline" className="gap-2">
            <action.icon className="h-4 w-4" />
            {action.label}
          </Button>
        ))}
      </div>

      {/* Assigned Patients Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-container">
          <h2 className="font-headline text-lg font-bold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Stethoscope className="h-4 w-4" />
            </div>
            My Assigned Patients
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Patient</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">MRN</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Ward / Bed</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Doctor</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Vitals Status</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {admissionsLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center font-label text-on-surface-variant">
                    No patients currently assigned.
                  </td>
                </tr>
              ) : (
                patients.map((admission) => (
                  <tr key={admission.id} className="group hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-label text-sm font-bold">
                      {admission.patient.firstName} {admission.patient.lastName}
                    </td>
                    <td className="px-4 py-3 font-label text-sm">{admission.patient.mrn}</td>
                    <td className="px-4 py-3 font-label text-sm">
                      {admission.ward?.name ?? '-'} / {admission.bed?.bedNumber ?? '-'}
                    </td>
                    <td className="px-4 py-3 font-label text-sm">
                      {admission.doctor?.user
                        ? `Dr. ${admission.doctor.user.firstName} ${admission.doctor.user.lastName}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                          admission.vitalsStatus === 'recorded' && 'bg-primary/10 text-primary',
                          admission.vitalsStatus === 'due' && 'bg-secondary/10 text-secondary',
                          admission.vitalsStatus === 'overdue' && 'bg-error-container text-on-error-container',
                          !admission.vitalsStatus && 'bg-secondary/10 text-secondary',
                        )}
                      >
                        {admission.vitalsStatus ?? 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">
                      {admission.lastVitalsAt
                        ? formatDateTime(admission.lastVitalsAt)
                        : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {(admissionsData?.meta?.totalPages ?? 1) > 1 && (
          <div className="flex items-center justify-between border-t border-surface-container px-4 py-3">
            <p className="font-label text-[10px] text-on-surface-variant">
              Page {page} of {admissionsData?.meta?.totalPages}
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= (admissionsData?.meta?.totalPages ?? 1)}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Shift Handovers */}
      <div className="bg-surface-container-lowest rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-container">
          <h2 className="font-headline text-lg font-bold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            Pending Shift Handovers
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold">From</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">To</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Ward</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Time</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {handoversLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : pendingHandovers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center font-label text-on-surface-variant">
                    No pending handovers.
                  </td>
                </tr>
              ) : (
                pendingHandovers.map((h) => (
                  <tr key={h.id} className="group hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-label text-sm font-bold">{nurseName(h.fromNurse)}</td>
                    <td className="px-4 py-3 font-label text-sm">{nurseName(h.toNurse, 'Anyone on next shift')}</td>
                    <td className="px-4 py-3 font-label text-sm">{h.ward?.name ?? '—'}</td>
                    <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">
                      {formatDateTime(h.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary capitalize">
                        {h.status}
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
