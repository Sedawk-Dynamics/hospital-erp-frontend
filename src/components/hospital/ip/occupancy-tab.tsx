'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, BedDouble, AlertCircle } from 'lucide-react';

interface OccupancyRow {
  wardId: string;
  wardName: string;
  wardType?: string;
  department?: string | null;
  floor?: { id: string; name: string; level: number } | null;
  totalBeds: number;
  occupied: number;
  available: number;
  maintenance: number;
  occupancyPercent: number;
}

interface Department {
  id: string;
  name: string;
}

export function OccupancyTab() {
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const { data: deptData } = useQuery({
    queryKey: ['infrastructure', 'departments'],
    queryFn: async () => {
      const res = await apiGet<Department[]>('/infrastructure/departments', {
        params: { limit: 100 },
      });
      return res.data ?? [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['hospital', 'occupancy', departmentFilter],
    queryFn: async () => {
      const params: Record<string, unknown> = {};
      if (departmentFilter !== 'all') params.departmentId = departmentFilter;
      const response = await apiGet<OccupancyRow[]>('/infrastructure/occupancy', { params });
      return response.data ?? [];
    },
  });

  const occupancy = useMemo(() => data ?? [], [data]);
  const departments = deptData ?? [];

  // Group rows by department / block (floor) for block-wise patient count
  const byBlock = useMemo(() => {
    const groups: Record<string, OccupancyRow[]> = {};
    occupancy.forEach((row) => {
      const key = row.department || row.floor?.name || 'General';
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });
    return groups;
  }, [occupancy]);

  const totals = useMemo(() => {
    return occupancy.reduce(
      (acc, r) => ({
        totalBeds: acc.totalBeds + r.totalBeds,
        occupied: acc.occupied + r.occupied,
        available: acc.available + r.available,
        maintenance: acc.maintenance + r.maintenance,
      }),
      { totalBeds: 0, occupied: 0, available: 0, maintenance: 0 },
    );
  }, [occupancy]);

  const overallPct =
    totals.totalBeds > 0 ? Math.round((totals.occupied / totals.totalBeds) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Filter & summary */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-label text-xs text-on-surface-variant uppercase tracking-widest">
            Department
          </span>
          <Select
            value={departmentFilter}
            onValueChange={(v) => setDepartmentFilter(v ?? 'all')}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-3 ml-auto">
          <SummaryCard
            label="Total Beds"
            value={totals.totalBeds}
            icon={<BedDouble className="h-4 w-4" />}
            color="text-foreground"
          />
          <SummaryCard
            label="Occupied"
            value={totals.occupied}
            icon={<AlertCircle className="h-4 w-4" />}
            color="text-red-600"
          />
          <SummaryCard
            label="Available"
            value={totals.available}
            icon={<BedDouble className="h-4 w-4" />}
            color="text-green-600"
          />
          <SummaryCard
            label="Occupancy %"
            value={overallPct}
            icon={<Building2 className="h-4 w-4" />}
            color="text-primary"
            suffix="%"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : occupancy.length === 0 ? (
        <div className="py-8 text-center font-label text-on-surface-variant">
          No occupancy data available.
        </div>
      ) : (
        Object.entries(byBlock).map(([blockName, rows]) => {
          const blockTotals = rows.reduce(
            (a, r) => ({
              total: a.total + r.totalBeds,
              occupied: a.occupied + r.occupied,
            }),
            { total: 0, occupied: 0 },
          );
          const pct =
            blockTotals.total > 0
              ? Math.round((blockTotals.occupied / blockTotals.total) * 100)
              : 0;
          return (
            <div
              key={blockName}
              className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-surface-container px-4 py-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <h3 className="font-headline text-base font-bold">{blockName}</h3>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-label text-on-surface-variant">
                    {blockTotals.occupied}/{blockTotals.total} occupied
                  </span>
                  <span
                    className={cn(
                      'font-bold px-2 py-0.5 rounded-full',
                      pct >= 90
                        ? 'bg-red-100 text-red-700'
                        : pct >= 70
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-green-100 text-green-700',
                    )}
                  >
                    {pct}%
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                      <th className="px-4 pb-3 pt-3 text-left font-semibold">Ward</th>
                      <th className="px-4 pb-3 pt-3 text-left font-semibold">Type</th>
                      <th className="px-4 pb-3 pt-3 text-left font-semibold">Floor</th>
                      <th className="px-4 pb-3 pt-3 text-center font-semibold">Total</th>
                      <th className="px-4 pb-3 pt-3 text-center font-semibold">Occupied</th>
                      <th className="px-4 pb-3 pt-3 text-center font-semibold">Available</th>
                      <th className="px-4 pb-3 pt-3 text-center font-semibold">Maintenance</th>
                      <th className="px-4 pb-3 pt-3 text-center font-semibold">Occupancy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container/50">
                    {rows.map((row) => (
                      <tr
                        key={row.wardId}
                        className="hover:bg-surface-container-low transition-colors"
                      >
                        <td className="px-4 py-2 font-label text-sm font-bold">
                          {row.wardName}
                        </td>
                        <td className="px-4 py-2 font-label text-xs text-on-surface-variant uppercase">
                          {row.wardType ?? '-'}
                        </td>
                        <td className="px-4 py-2 font-label text-xs text-on-surface-variant">
                          {row.floor?.name ?? '-'}
                        </td>
                        <td className="px-4 py-2 text-center font-label text-sm">
                          {row.totalBeds}
                        </td>
                        <td className="px-4 py-2 text-center font-label text-sm font-bold text-red-600">
                          {row.occupied}
                        </td>
                        <td className="px-4 py-2 text-center font-label text-sm font-bold text-green-600">
                          {row.available}
                        </td>
                        <td className="px-4 py-2 text-center font-label text-sm text-amber-600">
                          {row.maintenance}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="h-2 w-20 overflow-hidden rounded-full bg-surface-container">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all',
                                  row.occupancyPercent >= 90
                                    ? 'bg-red-500'
                                    : row.occupancyPercent >= 70
                                      ? 'bg-amber-500'
                                      : 'bg-primary',
                                )}
                                style={{ width: `${row.occupancyPercent}%` }}
                              />
                            </div>
                            <span className="font-label text-xs text-on-surface-variant w-8">
                              {row.occupancyPercent}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Summary card ────────────────────────────────────────────
function SummaryCard({
  label,
  value,
  icon,
  color,
  suffix,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-surface-container-low px-3 py-1.5">
      <span className={cn('opacity-70', color)}>{icon}</span>
      <div>
        <div className={cn('text-base font-bold leading-none', color)}>
          {value}
          {suffix ?? ''}
        </div>
        <div className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest">
          {label}
        </div>
      </div>
    </div>
  );
}
