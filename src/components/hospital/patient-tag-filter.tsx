'use client';

import { cn } from '@/lib/utils';

const tags = [
  { key: 'all', label: 'All', color: 'bg-surface-container-high text-on-surface-variant' },
  { key: 'staff', label: 'STAFF', color: 'bg-error-container text-on-error-container' },
  { key: 'doctor_family', label: 'DOCTOR FAMILY', color: 'bg-primary/10 text-primary' },
  { key: 'vip', label: 'VIP', color: 'bg-secondary/10 text-secondary' },
  { key: 'emergency', label: 'ACCIDENT AND EMERGENCY', color: 'bg-tertiary-fixed text-on-tertiary-fixed-variant' },
] as const;

interface PatientTagFilterProps {
  activeTag: string;
  onTagChange: (tag: string) => void;
}

export function PatientTagFilter({ activeTag, onTagChange }: PatientTagFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <button
          key={tag.key}
          onClick={() => onTagChange(tag.key)}
          className={cn(
            'inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold transition-all',
            activeTag === tag.key
              ? cn(tag.color, 'ring-2 ring-primary ring-offset-1')
              : cn(tag.color, 'opacity-70 hover:opacity-100')
          )}
        >
          {tag.label}
        </button>
      ))}
    </div>
  );
}
