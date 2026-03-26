'use client';

import { useState } from 'react';
import {
  BedDouble, Search, Building2, CheckCircle2, Users, Wrench, RefreshCw,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { PageLoading } from '@/components/shared/loading';
import { EmptyState } from '@/components/shared/empty-state';
import { useWards, useBedAvailability, type Ward } from '@/hooks/use-clinical';
import { cn } from '@/lib/utils';

const getOccupancyColor = (percentage: number) => {
  if (percentage >= 90) return 'text-red-600 bg-red-100';
  if (percentage >= 70) return 'text-amber-600 bg-amber-100';
  return 'text-emerald-600 bg-emerald-100';
};

const getOccupancyBarColor = (percentage: number) => {
  if (percentage >= 90) return 'bg-red-500';
  if (percentage >= 70) return 'bg-amber-500';
  return 'bg-emerald-500';
};

export default function WardHomePage() {
  const [search, setSearch] = useState('');

  const { data: wards, isLoading: wardsLoading, refetch: refetchWards } = useWards();
  const { data: beds, isLoading: bedsLoading } = useBedAvailability();

  const isLoading = wardsLoading || bedsLoading;

  // Calculate bed summary from beds data
  const allBeds = beds ?? [];
  const totalBeds = allBeds.length;
  const occupiedBeds = allBeds.filter((b) => b.status === 'occupied').length;
  const availableBeds = allBeds.filter((b) => b.status === 'available').length;
  const maintenanceBeds = allBeds.filter((b) => b.status === 'maintenance' || b.status === 'inactive').length;

  const summaryCards = [
    { label: 'Total Beds', value: totalBeds, icon: BedDouble, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { label: 'Occupied', value: occupiedBeds, icon: Users, color: 'text-purple-600', bgColor: 'bg-purple-50' },
    { label: 'Available', value: availableBeds, icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    { label: 'Maintenance', value: maintenanceBeds, icon: Wrench, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  ];

  // Process ward data
  const wardList = (wards ?? []) as Ward[];
  const filteredWards = wardList.filter((w) =>
    !search || w.name.toLowerCase().includes(search.toLowerCase())
  );

  // Calculate per-ward stats using beds data
  const wardStats = filteredWards.map((ward) => {
    const wardBeds = allBeds.filter((b) => b.wardId === ward.id);
    const total = ward.totalBeds || ward._count?.beds || wardBeds.length;
    const occupied = ward.occupiedBeds ?? wardBeds.filter((b) => b.status === 'occupied').length;
    const available = ward.availableBeds ?? (total - occupied);
    const occupancy = total > 0 ? Math.round((occupied / total) * 100) : 0;
    return { ...ward, total, occupied, available, occupancy };
  });

  if (isLoading) {
    return <PageLoading />;
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="Ward Management"
        description="Monitor bed availability, ward occupancy, and manage patient assignments"
        action={
          <Button variant="outline" className="gap-2" onClick={() => refetchWards()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {/* Bed Availability Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className={`bg-surface-container-lowest p-6 rounded-xl shadow-sanctuary border-l-4 border-primary ${card.bgColor} transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md`}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-white/80 p-2">
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className="font-headline text-3xl font-extrabold">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search ward name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Ward Occupancy Table */}
      {wardStats.length === 0 ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <EmptyState
            icon={Building2}
            title="No Wards Found"
            description={search ? 'No wards match your search criteria.' : 'No wards have been configured yet.'}
          />
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-container">
                  <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Ward Name</th>
                  <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Floor</th>
                  <th className="px-4 pb-4 pt-5 text-center font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Total Beds</th>
                  <th className="px-4 pb-4 pt-5 text-center font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Occupied</th>
                  <th className="px-4 pb-4 pt-5 text-center font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Available</th>
                  <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest min-w-[150px]">Occupancy</th>
                </tr>
              </thead>
              <tbody>
                {wardStats.map((ward) => (
                  <tr key={ward.id} className="group hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-foreground">{ward.name}</p>
                          {ward.wardType && (
                            <p className="text-xs text-muted-foreground">{ward.wardType}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{ward.floor || '-'}</td>
                    <td className="px-4 py-3 text-center font-medium">{ward.total}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-medium text-purple-600">{ward.occupied}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-medium text-emerald-600">{ward.available}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all duration-500', getOccupancyBarColor(ward.occupancy))}
                            style={{ width: `${ward.occupancy}%` }}
                          />
                        </div>
                        <span
                          className={cn(
                            'text-xs font-semibold px-2 py-0.5 rounded-md min-w-[45px] text-center',
                            getOccupancyColor(ward.occupancy)
                          )}
                        >
                          {ward.occupancy}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Overall occupancy footer */}
          <div className="px-4 py-3 bg-muted/30 border-t flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{wardStats.length}</span> ward(s) configured
            </p>
            <p className="text-sm text-muted-foreground">
              Overall Occupancy:{' '}
              <span className={cn('font-semibold', totalBeds > 0 && occupiedBeds / totalBeds >= 0.9 ? 'text-red-600' : 'text-foreground')}>
                {totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0}%
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
