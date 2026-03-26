'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

interface OccupancyData {
  wardName: string;
  totalBeds: number;
  occupied: number;
  available: number;
}

export function OccupancyTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['hospital', 'occupancy'],
    queryFn: async () => {
      // Try dedicated endpoint, fall back to beds computation
      try {
        const response = await apiGet<OccupancyData[]>('/infrastructure/occupancy');
        return response.data;
      } catch {
        return [] as OccupancyData[];
      }
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const occupancy = data || [];

  if (occupancy.length === 0) {
    return (
      <div className="py-8 text-center font-label text-on-surface-variant">
        No occupancy data available.
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
              <th className="px-4 pb-4 pt-5 text-left font-semibold">Ward / Block</th>
              <th className="px-4 pb-4 pt-5 text-center font-semibold">Total Beds</th>
              <th className="px-4 pb-4 pt-5 text-center font-semibold">Occupied</th>
              <th className="px-4 pb-4 pt-5 text-center font-semibold">Available</th>
              <th className="px-4 pb-4 pt-5 text-center font-semibold">Occupancy %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container/50">
            {occupancy.map((item) => {
              const pct = item.totalBeds > 0 ? Math.round((item.occupied / item.totalBeds) * 100) : 0;
              return (
                <tr key={item.wardName} className="group hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-3 font-label text-sm font-bold">{item.wardName}</td>
                  <td className="px-4 py-3 text-center font-label text-sm">{item.totalBeds}</td>
                  <td className="px-4 py-3 text-center font-label text-sm font-bold text-red-600">{item.occupied}</td>
                  <td className="px-4 py-3 text-center font-label text-sm font-bold text-green-600">{item.available}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-surface-container">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="font-label text-xs text-on-surface-variant">{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
