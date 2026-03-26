'use client';

import { Building2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { HospitalConnection } from '@/types';

interface HospitalFilterProps {
  value: string; // '' means all
  onChange: (tenantId: string) => void;
}

export function HospitalFilter({ value, onChange }: HospitalFilterProps) {
  const { data: connectionsRaw } = useQuery({
    queryKey: ['patient', 'connections'],
    queryFn: async () => {
      const res = await apiGet<HospitalConnection[]>('/patient-portal/connections');
      return res.data ?? [];
    },
  });
  const connections = connectionsRaw ?? [];

  const approved = connections.filter((c: HospitalConnection) => c.status === 'approved');

  if (approved.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <button
        onClick={() => onChange('')}
        className={cn(
          'rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
          !value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
        )}
      >
        All Hospitals
      </button>
      {approved.map((c: HospitalConnection) => (
        <button
          key={c.tenantId}
          onClick={() => onChange(c.tenantId)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
            value === c.tenantId ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
          )}
        >
          {c.tenant.name}
        </button>
      ))}
    </div>
  );
}
