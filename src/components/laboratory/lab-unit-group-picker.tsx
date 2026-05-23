'use client';

// Compact dropdown that picks a Lab Unit Group code. Backed by the DB-
// loaded /lab/unit-groups list and merges global + tenant-local. Used in
// the lab parameter builder to pre-filter the unit picker (per the
// 2026-05-23 meeting decision: parameters → unit_group → units).

import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useLabUnitGroups } from '@/hooks/use-lab-units';
import { useState } from 'react';

interface LabUnitGroupPickerProps {
  value: string | null | undefined;
  onChange: (code: string | null) => void;
  placeholder?: string;
  className?: string;
}

export function LabUnitGroupPicker({
  value,
  onChange,
  placeholder = 'Unit group',
  className,
}: LabUnitGroupPickerProps) {
  const groups = useLabUnitGroups();
  const [open, setOpen] = useState(false);

  const sorted = (groups.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const selected = sorted.find((g) => g.code === value);

  return (
    <div className={cn('relative', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className={cn(
                'w-full h-7 rounded-lg border border-input bg-transparent px-2 text-xs flex items-center justify-between gap-1 hover:bg-surface-container-low',
                !value && 'text-muted-foreground',
              )}
            >
              <span className="truncate">{selected?.name ?? placeholder}</span>
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            </button>
          }
        />
        <PopoverContent align="start" className="w-64 p-1.5">
          <button
            type="button"
            className={cn(
              'w-full text-left text-xs px-2 py-1 rounded hover:bg-surface-container-low',
              !value && 'bg-primary/10 text-primary',
            )}
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            <span className="italic text-muted-foreground">(no group)</span>
          </button>
          <div className="my-1 border-t" />
          {sorted.length === 0 && (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">
              No unit groups configured. Run the seed.
            </div>
          )}
          {sorted.map((g) => {
            const isSelected = g.code === value;
            return (
              <button
                key={g.id}
                type="button"
                className={cn(
                  'w-full text-left text-xs px-2 py-1 rounded flex items-center justify-between gap-2 hover:bg-surface-container-low',
                  isSelected && 'bg-primary/10 text-primary',
                )}
                onClick={() => {
                  onChange(g.code);
                  setOpen(false);
                }}
              >
                <span className="truncate flex items-center gap-1.5">
                  {g.name}
                  {g.tenantId && (
                    <span className="rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[9px] font-medium">local</span>
                  )}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                  {g.units.length}u
                </span>
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
    </div>
  );
}
