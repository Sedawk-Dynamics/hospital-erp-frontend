'use client';

import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { BedWithStatus } from '@/types';

const statusColors: Record<string, { bg: string; label: string }> = {
  available: { bg: 'bg-green-500', label: 'Available' },
  occupied: { bg: 'bg-red-400', label: 'Occupied' },
  under_cleaning: { bg: 'bg-amber-400', label: 'Under Cleaning' },
  under_maintenance: { bg: 'bg-blue-400', label: 'Under Maintenance' },
};

export function BedAvailability() {
  const { data: beds, isLoading } = useQuery({
    queryKey: ['hospital', 'beds'],
    queryFn: async () => {
      const response = await apiGet<BedWithStatus[]>('/infrastructure/beds', {
        params: { limit: 500 },
      });
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Group beds by ward
  const bedsByWard: Record<string, BedWithStatus[]> = {};
  (beds || []).forEach((bed) => {
    const wardName = bed.ward?.name || 'Unassigned';
    if (!bedsByWard[wardName]) bedsByWard[wardName] = [];
    bedsByWard[wardName].push(bed);
  });

  const wardNames = Object.keys(bedsByWard).sort();

  // Legend
  const legendItems = Object.values(statusColors);

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div className={cn('h-4 w-4 rounded', item.bg)} />
            <span className="font-label text-sm text-on-surface-variant">{item.label}</span>
          </div>
        ))}
      </div>

      {wardNames.length === 0 ? (
        <div className="py-8 text-center font-label text-on-surface-variant">
          No beds configured. Add beds in Settings.
        </div>
      ) : (
        wardNames.map((wardName) => (
          <div key={wardName} className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
            <h3 className="mb-3 font-headline text-xl font-bold">{wardName}</h3>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
              {bedsByWard[wardName].map((bed) => {
                const colors = statusColors[bed.status] || statusColors.available;
                return (
                  <div
                    key={bed.id}
                    title={`${bed.bedNumber} - ${colors.label}${bed.currentPatient ? ` (${bed.currentPatient.firstName} ${bed.currentPatient.lastName})` : ''}`}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-xl p-2 text-white text-xs font-bold min-h-[56px]',
                      colors.bg
                    )}
                  >
                    <span>{bed.bedNumber}</span>
                    {bed.currentPatient && (
                      <span className="mt-0.5 text-[10px] opacity-80 truncate max-w-full">
                        {bed.currentPatient.firstName}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
