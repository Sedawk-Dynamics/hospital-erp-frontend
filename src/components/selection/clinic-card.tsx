'use client';

import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tenant } from '@/types';

interface ClinicCardProps {
  clinic: Tenant;
  isSelected: boolean;
  onClick: () => void;
}

export function ClinicCard({ clinic, isSelected, onClick }: ClinicCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex flex-col items-center gap-3 rounded-xl border-2 p-6 text-center shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-1',
        isSelected
          ? 'border-primary bg-primary text-primary-foreground shadow-md'
          : 'border-border bg-card text-card-foreground hover:border-primary/50'
      )}
    >
      <div
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110',
          isSelected ? 'bg-white/20' : 'bg-primary/10'
        )}
      >
        <Building2
          className={cn(
            'h-7 w-7',
            isSelected ? 'text-primary-foreground' : 'text-primary'
          )}
        />
      </div>
      <div>
        <p className="font-semibold text-base">{clinic.name}</p>
        {clinic.address && (
          <p className={cn('mt-1 text-xs', isSelected ? 'opacity-80' : 'text-muted-foreground')}>
            {clinic.address}
          </p>
        )}
      </div>
    </button>
  );
}
