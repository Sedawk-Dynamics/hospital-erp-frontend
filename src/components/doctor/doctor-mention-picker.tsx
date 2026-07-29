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
import { useUsersList, type UserListItem } from '@/hooks/use-users';

function isDoctor(u: UserListItem): boolean {
  return (u.userRoles ?? []).some((r) => /^doctor(_|$)/i.test(r.role.name));
}
const nameOf = (u: UserListItem) => `${u.firstName} ${u.lastName ?? ''}`.trim() || u.email;

interface DoctorMentionPickerProps {
  /** Selected doctor USER ids. */
  value: string[];
  onChange: (userIds: string[]) => void;
  /** User id to exclude from the list (the author). */
  excludeUserId?: string;
  className?: string;
}

/**
 * Multi-select doctor picker for @mentioning colleagues on a progress note.
 * Mirrors NursePicker (Popover + cmdk) but toggles a set of doctors and shows
 * the picks as removable chips. Tagged doctors get a notification.
 */
export function DoctorMentionPicker({ value, onChange, excludeUserId, className }: DoctorMentionPickerProps) {
  const [open, setOpen] = useState(false);
  const { data } = useUsersList({ limit: 500, isActive: 'true' });

  const doctors = useMemo(
    () => (data?.data ?? []).filter((u) => isDoctor(u) && u.id !== excludeUserId),
    [data, excludeUserId],
  );
  const selected = useMemo(() => doctors.filter((u) => value.includes(u.id)), [doctors, value]);

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

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
                {doctors.map((u) => {
                  const checked = value.includes(u.id);
                  return (
                    <CommandItem
                      key={u.id}
                      value={`${nameOf(u)} ${u.email}`}
                      onSelect={() => toggle(u.id)}
                      data-checked={checked || undefined}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="truncate text-sm">{nameOf(u)}</span>
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
          {selected.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
            >
              @{nameOf(u)}
              <button
                type="button"
                onClick={() => toggle(u.id)}
                className="rounded-full hover:bg-primary/20"
                aria-label={`Remove ${nameOf(u)}`}
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
