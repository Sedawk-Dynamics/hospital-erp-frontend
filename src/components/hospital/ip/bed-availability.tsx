'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDate } from '@/lib/date-utils';
import { BedDouble } from 'lucide-react';
import type { Admission, BedWithStatus } from '@/types';

interface Ward {
  id: string;
  name: string;
  wardType?: string;
}

const statusMeta: Record<
  BedWithStatus['status'],
  { bg: string; ring: string; label: string; legend: string }
> = {
  available: {
    bg: 'bg-green-500 hover:bg-green-600',
    ring: 'ring-green-300',
    label: 'Available',
    legend: 'bg-green-500',
  },
  occupied: {
    bg: 'bg-red-500 hover:bg-red-600',
    ring: 'ring-red-300',
    label: 'Occupied',
    legend: 'bg-red-500',
  },
  maintenance: {
    bg: 'bg-amber-500 hover:bg-amber-600',
    ring: 'ring-amber-300',
    label: 'Cleaning / Maintenance',
    legend: 'bg-amber-500',
  },
  reserved: {
    bg: 'bg-blue-500 hover:bg-blue-600',
    ring: 'ring-blue-300',
    label: 'Reserved',
    legend: 'bg-blue-500',
  },
};

export function BedAvailability() {
  const [wardFilter, setWardFilter] = useState<string>('all');
  const [selectedBed, setSelectedBed] = useState<BedWithStatus | null>(null);

  // Wards (for filter dropdown)
  const { data: wardsData } = useQuery({
    queryKey: ['infrastructure', 'wards'],
    queryFn: async () => {
      const res = await apiGet<Ward[]>('/infrastructure/wards', { params: { limit: 200 } });
      return res.data ?? [];
    },
  });

  const wards = wardsData ?? [];

  // Beds (with optional ward filter)
  const { data: beds, isLoading } = useQuery({
    queryKey: ['hospital', 'beds', wardFilter],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 500 };
      if (wardFilter !== 'all') params.wardId = wardFilter;
      const response = await apiGet<BedWithStatus[]>('/infrastructure/beds', { params });
      return response.data ?? [];
    },
  });

  // Group beds by ward (using nested room.ward.name OR direct ward.name as fallback)
  const grouped = useMemo(() => {
    const map: Record<string, { wardId?: string; beds: BedWithStatus[] }> = {};
    (beds ?? []).forEach((bed) => {
      const wardName = bed.room?.ward?.name ?? bed.ward?.name ?? 'Unassigned';
      const wardId = bed.room?.ward?.id ?? bed.ward?.id;
      if (!map[wardName]) map[wardName] = { wardId, beds: [] };
      map[wardName].beds.push(bed);
    });
    // Sort beds within each ward
    Object.values(map).forEach((g) => {
      g.beds.sort((a, b) =>
        a.bedNumber.localeCompare(b.bedNumber, undefined, { numeric: true }),
      );
    });
    return map;
  }, [beds]);

  const wardNames = Object.keys(grouped).sort();

  // Aggregate stats
  const stats = useMemo(() => {
    const all = beds ?? [];
    return {
      total: all.length,
      available: all.filter((b) => b.status === 'available').length,
      occupied: all.filter((b) => b.status === 'occupied').length,
      maintenance: all.filter((b) => b.status === 'maintenance').length,
      reserved: all.filter((b) => b.status === 'reserved').length,
    };
  }, [beds]);

  return (
    <div className="space-y-6">
      {/* Header: Ward filter + stats */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-label text-xs text-on-surface-variant uppercase tracking-widest">
            Ward
          </span>
          <Select value={wardFilter} onValueChange={(v) => setWardFilter(v ?? 'all')}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All wards" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Wards</SelectItem>
              {wards.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-3 ml-auto">
          <StatPill label="Total" value={stats.total} color="text-foreground" />
          <StatPill label="Available" value={stats.available} color="text-green-600" />
          <StatPill label="Occupied" value={stats.occupied} color="text-red-600" />
          <StatPill label="Cleaning" value={stats.maintenance} color="text-amber-600" />
          <StatPill label="Reserved" value={stats.reserved} color="text-blue-600" />
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 rounded-xl bg-surface-container-low p-3">
        {Object.entries(statusMeta).map(([key, meta]) => (
          <div key={key} className="flex items-center gap-2">
            <div className={cn('h-4 w-4 rounded', meta.legend)} />
            <span className="font-label text-xs text-on-surface-variant">{meta.label}</span>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : wardNames.length === 0 ? (
        <div className="py-12 text-center font-label text-on-surface-variant">
          No beds configured. Add beds in Settings.
        </div>
      ) : (
        wardNames.map((wardName) => {
          const wardBeds = grouped[wardName].beds;
          const wardStats = {
            total: wardBeds.length,
            available: wardBeds.filter((b) => b.status === 'available').length,
            occupied: wardBeds.filter((b) => b.status === 'occupied').length,
          };
          return (
            <div key={wardName} className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
              <div className="mb-4 flex items-end justify-between">
                <h3 className="font-headline text-xl font-bold">{wardName}</h3>
                <p className="font-label text-xs text-on-surface-variant">
                  {wardStats.available}/{wardStats.total} available · {wardStats.occupied} occupied
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
                {wardBeds.map((bed) => {
                  const meta = statusMeta[bed.status] ?? statusMeta.available;
                  const clickable = bed.status === 'occupied' || bed.status === 'reserved';
                  return (
                    <button
                      key={bed.id}
                      type="button"
                      disabled={!clickable}
                      onClick={() => clickable && setSelectedBed(bed)}
                      title={`Bed ${bed.bedNumber} · ${meta.label}${
                        bed.currentPatient
                          ? ` · ${bed.currentPatient.firstName} ${bed.currentPatient.lastName}`
                          : ''
                      }`}
                      className={cn(
                        'group flex flex-col items-center justify-center rounded-xl text-white text-xs font-bold min-h-[64px] transition-all p-2',
                        meta.bg,
                        clickable
                          ? 'cursor-pointer hover:scale-105 hover:shadow-lg'
                          : 'cursor-default opacity-90',
                      )}
                    >
                      <BedDouble className="h-3.5 w-3.5 mb-0.5 opacity-70" />
                      <span>{bed.bedNumber}</span>
                      {bed.currentPatient && (
                        <span className="mt-0.5 text-[9px] opacity-90 truncate max-w-full leading-tight">
                          {bed.currentPatient.firstName}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* Patient details dialog (on occupied bed click) */}
      <BedDetailsDialog
        bed={selectedBed}
        open={!!selectedBed}
        onOpenChange={(o) => !o && setSelectedBed(null)}
      />
    </div>
  );
}

// ── Stat pill ───────────────────────────────────────────────
function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-surface-container-low px-3 py-1.5 min-w-[68px]">
      <span className={cn('text-base font-bold', color)}>{value}</span>
      <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest">
        {label}
      </span>
    </div>
  );
}

// ── Bed Details Dialog ──────────────────────────────────────
function BedDetailsDialog({
  bed,
  open,
  onOpenChange,
}: {
  bed: BedWithStatus | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  // Look up active admission for this bed (only when occupied)
  const { data: admissionData, isLoading } = useQuery({
    queryKey: ['hospital', 'bed-admission', bed?.id],
    queryFn: async () => {
      if (!bed) return null;
      const res = await apiGet<Admission[]>('/clinical/admissions', {
        params: { status: 'admitted', limit: 5, search: bed.currentPatient?.firstName ?? '' },
      });
      // Find the admission for this exact bed
      return res.data?.find((a) => a.bedId === bed.id) ?? null;
    },
    enabled: !!bed && bed.status === 'occupied' && !!bed.currentPatient,
  });

  if (!bed) return null;

  const meta = statusMeta[bed.status];
  const initials = bed.currentPatient
    ? `${bed.currentPatient.firstName?.[0] ?? ''}${bed.currentPatient.lastName?.[0] ?? ''}`.toUpperCase()
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Bed {bed.bedNumber}
            <span
              className={cn(
                'ml-2 inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full text-white',
                meta.bg,
              )}
            >
              {meta.label}
            </span>
          </DialogTitle>
          <DialogDescription>
            {bed.room?.ward?.name ?? bed.ward?.name ?? 'Unassigned ward'}
            {bed.room?.roomNumber ? ` · Room ${bed.room.roomNumber}` : ''}
            {bed.bedType ? ` · ${bed.bedType.toUpperCase()}` : ''}
          </DialogDescription>
        </DialogHeader>

        {bed.status === 'occupied' && bed.currentPatient ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-label text-sm font-bold">
                  {bed.currentPatient.firstName} {bed.currentPatient.lastName}
                </p>
                <p className="font-label text-xs text-muted-foreground">
                  MRN: {bed.currentPatient.mrn ?? '-'}
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : admissionData ? (
              <div className="rounded-xl border bg-muted/30 p-3 space-y-1.5 text-sm">
                <p>
                  <span className="text-muted-foreground">Doctor:</span>{' '}
                  <span className="font-medium">
                    Dr. {admissionData.doctor?.user?.firstName}{' '}
                    {admissionData.doctor?.user?.lastName}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Admitted:</span>{' '}
                  <span className="font-medium">
                    {formatDate(admissionData.admissionDate)}
                  </span>
                </p>
                {admissionData.expectedDischargeDate && (
                  <p>
                    <span className="text-muted-foreground">Expected Discharge:</span>{' '}
                    <span className="font-medium">
                      {formatDate(admissionData.expectedDischargeDate)}
                    </span>
                  </p>
                )}
                {admissionData.admissionReason && (
                  <p>
                    <span className="text-muted-foreground">Reason:</span>{' '}
                    <span className="font-medium">{admissionData.admissionReason}</span>
                  </p>
                )}
                <p>
                  <span className="text-muted-foreground">Deposit:</span>{' '}
                  <span className="font-medium">
                    ₹{Number(admissionData.depositAmount ?? 0).toLocaleString('en-IN')}
                  </span>
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No active admission record found for this bed.
              </p>
            )}
          </div>
        ) : bed.status === 'reserved' ? (
          <p className="text-sm text-muted-foreground">
            This bed is reserved. View details in the Reservation tab.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            This bed is currently {meta.label.toLowerCase()}.
          </p>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
