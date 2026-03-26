'use client';

import { cn } from '@/lib/utils';
import type { AppointmentStats } from '@/hooks/use-hospital';

interface StatCardProps {
  label: string;
  count: number;
  borderColor: string;
  iconColor: string;
  isActive: boolean;
  onClick: () => void;
}

function StatCard({ label, count, borderColor, iconColor, isActive, onClick }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center bg-surface-container-lowest rounded-xl px-4 py-3 min-w-[100px] shadow-sanctuary transition-all duration-200 hover:-translate-y-0.5 border-l-4',
        isActive
          ? 'border-primary ring-2 ring-primary/20'
          : borderColor
      )}
    >
      <span className={cn('font-headline text-2xl font-extrabold tabular-nums', iconColor)}>{count}</span>
      <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest mt-1 whitespace-nowrap">{label}</span>
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
  { key: 'all', label: 'All', color: 'text-on-surface', border: 'border-primary' },
  { key: 'booked', label: 'Booked', color: 'text-primary', border: 'border-primary' },
  { key: 'ipAppointments', label: 'IP Appt', color: 'text-tertiary', border: 'border-tertiary' },
  { key: 'arrived', label: 'Arrived', color: 'text-secondary', border: 'border-secondary' },
  { key: 'withDoctor', label: 'With Doctor', color: 'text-primary-container', border: 'border-primary-container' },
  { key: 'completed', label: 'Completed', color: 'text-primary', border: 'border-primary' },
  { key: 'cancelled', label: 'Cancelled', color: 'text-error', border: 'border-error' },
] as const;

export function AppointmentStatsRow({
  stats,
  activeFilter,
  onFilterChange,
  isLoading,
}: AppointmentStatsRowProps) {
  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {statItems.map((item) => (
          <div
            key={item.key}
            className="flex flex-col items-center bg-surface-container-lowest rounded-xl px-4 py-3 min-w-[100px] shadow-sanctuary border-l-4 border-surface-container"
          >
            <div className="h-8 w-8 animate-shimmer rounded" />
            <div className="h-3 w-12 mt-1 animate-shimmer rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {statItems.map((item) => (
        <StatCard
          key={item.key}
          label={item.label}
          count={stats?.[item.key] ?? 0}
          iconColor={item.color}
          borderColor={item.border}
          isActive={activeFilter === item.key}
          onClick={() => onFilterChange(item.key)}
        />
      ))}
    </div>
  );
}
