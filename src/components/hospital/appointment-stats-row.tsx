'use client';

import { cn } from '@/lib/utils';
import type { AppointmentStats } from '@/hooks/use-hospital';

interface StatCardProps {
  label: string;
  count: number;
  color: string;
  isActive: boolean;
  onClick: () => void;
}

function StatCard({ label, count, color, isActive, onClick }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center rounded-lg border-2 px-4 py-3 min-w-[100px] transition-all',
        isActive
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-transparent bg-card hover:border-border'
      )}
    >
      <span className={cn('text-2xl font-bold', color)}>{count}</span>
      <span className="text-xs text-muted-foreground mt-1 whitespace-nowrap">{label}</span>
    </button>
  );
}

interface AppointmentStatsRowProps {
  stats: AppointmentStats | undefined;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  isLoading: boolean;
}

const statItems = [
  { key: 'all', label: 'All', color: 'text-foreground' },
  { key: 'booked', label: 'Booked', color: 'text-blue-600' },
  { key: 'ipAppointments', label: 'IP Appt', color: 'text-purple-600' },
  { key: 'arrived', label: 'Arrived', color: 'text-amber-600' },
  { key: 'withDoctor', label: 'With Doctor', color: 'text-teal-600' },
  { key: 'completed', label: 'Completed', color: 'text-green-600' },
  { key: 'cancelled', label: 'Cancelled', color: 'text-red-600' },
] as const;

export function AppointmentStatsRow({
  stats,
  activeFilter,
  onFilterChange,
  isLoading,
}: AppointmentStatsRowProps) {
  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-2">
        {statItems.map((item) => (
          <div
            key={item.key}
            className="flex flex-col items-center rounded-lg border-2 border-transparent bg-card px-4 py-3 min-w-[100px]"
          >
            <div className="h-8 w-8 animate-pulse rounded bg-muted" />
            <div className="h-3 w-12 mt-1 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {statItems.map((item) => (
        <StatCard
          key={item.key}
          label={item.label}
          count={stats?.[item.key] ?? 0}
          color={item.color}
          isActive={activeFilter === item.key}
          onClick={() => onFilterChange(item.key)}
        />
      ))}
    </div>
  );
}
