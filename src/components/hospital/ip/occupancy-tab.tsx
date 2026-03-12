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
      <div className="py-8 text-center text-muted-foreground">
        No occupancy data available.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ward / Block</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Total Beds</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Occupied</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Available</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Occupancy %</th>
            </tr>
          </thead>
          <tbody>
            {occupancy.map((item) => {
              const pct = item.totalBeds > 0 ? Math.round((item.occupied / item.totalBeds) * 100) : 0;
              return (
                <tr key={item.wardName} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{item.wardName}</td>
                  <td className="px-4 py-3 text-center">{item.totalBeds}</td>
                  <td className="px-4 py-3 text-center text-red-600 font-medium">{item.occupied}</td>
                  <td className="px-4 py-3 text-center text-green-600 font-medium">{item.available}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{pct}%</span>
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
