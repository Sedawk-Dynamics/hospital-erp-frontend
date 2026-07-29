'use client';

import { useMemo, useState } from 'react';
import { ChevronsUpDown, Check, X, AtSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useDoctorsList } from '@/hooks/use-hospital';
import type { DoctorProfile } from '@/types';

const nameOf = (d: DoctorProfile) =>
  `${d.user?.firstName ?? ''} ${d.user?.lastName ?? ''}`.trim() || d.user?.email || 'Doctor';

interface DoctorMentionPickerProps {
  /** Selected doctor USER ids (the mention targets). */
  value: string[];
  onChange: (userIds: string[]) => void;
  /** User id to exclude from the list (the author). */
  excludeUserId?: string;
  className?: string;
}

/**
 * Multi-select doctor picker for @mentioning colleagues on a progress note.
 * Lists doctors via /appointments/doctors (auth-only — a doctor CAN call it,
 * unlike /users which needs users:read), and returns each doctor's User id so
 * mentions/notifications key off the right id.
 */
export function DoctorMentionPicker({ value, onChange, excludeUserId, className }: DoctorMentionPickerProps) {
  const [open, setOpen] = useState(false);
  const { data } = useDoctorsList();

  const doctors = useMemo(
    () => (data ?? []).filter((d) => d.userId && d.userId !== excludeUserId),
    [data, excludeUserId],
  );
  const selected = useMemo(() => doctors.filter((d) => value.includes(d.userId)), [doctors, value]);

  const toggle = (userId: string) =>
    onChange(value.includes(userId) ? value.filter((v) => v !== userId) : [...value, userId]);

  return (
    <div className={cn('space-y-1.5', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              role="combobox"
              className="h-8 w-full justify-between px-2 text-xs font-normal text-muted-foreground"
            />
          }
        >
          <span className="inline-flex items-center gap-1.5">
            <AtSign className="h-3.5 w-3.5" />
            {value.length ? `${value.length} doctor${value.length === 1 ? '' : 's'} tagged` : 'Tag doctors…'}
          </span>
          <ChevronsUpDown className="ml-auto h-3.5 w-3.5 opacity-60" />
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command shouldFilter>
            <CommandInput placeholder="Search doctor by name…" />
            <CommandList>
              <CommandEmpty>No matching doctor.</CommandEmpty>
              <CommandGroup>
                {doctors.map((d) => {
                  const checked = value.includes(d.userId);
                  return (
                    <CommandItem
                      key={d.userId}
                      value={`${nameOf(d)} ${d.specialization ?? ''} ${d.user?.email ?? ''}`}
                      onSelect={() => toggle(d.userId)}
                      data-checked={checked || undefined}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm">{nameOf(d)}</div>
                          {d.specialization && (
                            <div className="truncate text-[10px] text-muted-foreground">{d.specialization}</div>
                          )}
                        </div>
                        {checked && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((d) => (
            <span
              key={d.userId}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
            >
              @{nameOf(d)}
              <button
                type="button"
                onClick={() => toggle(d.userId)}
                className="rounded-full hover:bg-primary/20"
                aria-label={`Remove ${nameOf(d)}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
