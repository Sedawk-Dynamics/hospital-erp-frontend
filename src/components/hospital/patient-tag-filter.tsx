'use client';

import { cn } from '@/lib/utils';

const tags = [
  { key: 'all', label: 'All', color: 'bg-gray-100 text-gray-800' },
  { key: 'staff', label: 'STAFF', color: 'bg-red-100 text-red-800' },
  { key: 'doctor_family', label: 'DOCTOR FAMILY', color: 'bg-green-100 text-green-800' },
  { key: 'vip', label: 'VIP', color: 'bg-amber-100 text-amber-800' },
  { key: 'emergency', label: 'ACCIDENT AND EMERGENCY', color: 'bg-purple-100 text-purple-800' },
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
            'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-all',
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
