'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Siren,
  Plus,
  Loader2,
  Stethoscope,
  BedDouble,
  ExternalLink,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { EmergencyPatientDialog } from '@/components/hospital/emergency-patient-dialog';
import { EmergencyResolveDialog } from '@/components/hospital/emergency-resolve-dialog';
import { useEmergencyPatients, type EmergencyPatient } from '@/hooks/use-emergency';
import { formatDateTime } from '@/lib/date-utils';

const inr = (n: number) => `₹${(n ?? 0).toFixed(0)}`;

export default function EmergencyConsolePage() {
  const router = useRouter();
  const { data: patients = [], isLoading } = useEmergencyPatients();
  const [createOpen, setCreateOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<EmergencyPatient | null>(null);

  const activeCount = patients.length;
  const heldTotal = patients.reduce((s, p) => s + (p.balanceDue || 0), 0);

  function openCase(p: EmergencyPatient) {
    if (p.type === 'ip' && p.admissionId) {
      router.push(`/hospital/ip/${p.admissionId}`);
    } else {
      router.push('/hospital/walkin');
    }
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-headline text-xl font-bold">
            <Siren className="h-5 w-5 text-red-600" />
            Emergency / Casualty
          </h1>
          <p className="font-label text-xs text-on-surface-variant">
            Temporary casualty patients — treat now, register or connect later.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-red-600 text-white hover:bg-red-700 rounded-xl font-label font-bold"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          New Emergency Patient
        </Button>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
          <p className="font-headline text-2xl font-bold text-on-surface">{activeCount}</p>
          <p className="font-label text-[11px] text-on-surface-variant">Active emergency patients</p>
        </div>
        <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
          <p className="font-headline text-2xl font-bold text-on-surface">
            {patients.filter((p) => p.type === 'ip').length}
          </p>
          <p className="font-label text-[11px] text-on-surface-variant">Admitted (IP)</p>
        </div>
        <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
          <p className="font-headline text-2xl font-bold text-on-surface">{inr(heldTotal)}</p>
          <p className="font-label text-[11px] text-on-surface-variant">Outstanding balance</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sanctuary">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-on-surface-variant">
            <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading…
          </div>
        ) : patients.length === 0 ? (
          <div className="py-10">
            <EmptyState
              icon={Siren}
              title="No active emergency patients"
              description="Click “New Emergency Patient” to register a casualty case."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-container">
                  {['Patient', 'Type', 'Placement', 'Opened', 'Balance', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className={`px-4 pb-3 pt-4 font-label text-[10px] uppercase tracking-widest text-on-surface-variant ${h === 'Actions' ? 'text-right' : 'text-left'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container/50">
                {patients.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 gap-1 text-[9px] font-bold uppercase">
                          <Siren className="h-2.5 w-2.5" /> ER
                        </Badge>
                        <div className="min-w-0">
                          <p className="font-label text-sm font-bold">
                            {p.firstName} {p.lastName}
                          </p>
                          <p className="font-mono text-[10px] text-on-surface-variant">
                            {p.mrn}
                            {p.phone ? ` · ${p.phone}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2 py-0.5 font-label text-[11px] font-semibold">
                        {p.type === 'ip' ? (
                          <BedDouble className="h-3 w-3" />
                        ) : (
                          <Stethoscope className="h-3 w-3" />
                        )}
                        {p.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-label text-sm text-on-surface-variant">
                      {p.type === 'ip'
                        ? p.ward
                          ? `${p.ward}${p.bed ? ` · Bed ${p.bed}` : ''}`
                          : 'Pending placement'
                        : p.appointmentStatus?.replace(/_/g, ' ') ?? 'In OP queue'}
                    </td>
                    <td className="px-4 py-3 font-label text-xs text-on-surface-variant">
                      {p.createdAt ? formatDateTime(p.createdAt) : '—'}
                    </td>
                    <td className="px-4 py-3 font-label text-sm">
                      {p.balanceDue > 0 ? (
                        <span className="font-semibold text-amber-600">{inr(p.balanceDue)}</span>
                      ) : (
                        <span className="text-on-surface-variant">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => openCase(p)}>
                          <ExternalLink className="h-3.5 w-3.5" /> Open
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1 bg-primary text-xs text-primary-foreground"
                          onClick={() => setResolveTarget(p)}
                        >
                          <UserCheck className="h-3.5 w-3.5" /> Register / Connect
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <EmergencyPatientDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EmergencyResolveDialog
        open={!!resolveTarget}
        onOpenChange={(o) => !o && setResolveTarget(null)}
        patient={resolveTarget}
        onResolved={() => setResolveTarget(null)}
      />
    </div>
  );
}
