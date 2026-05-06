'use client';

import { useState, useMemo } from 'react';
import { ChevronsUpDown, Check, X } from 'lucide-react';
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
import type { UserListItem } from '@/hooks/use-users';

export interface NursePickerProps {
  users: UserListItem[];
  /** Currently selected user id, or empty string for none. */
  value: string;
  onChange: (userId: string) => void;
  placeholder?: string;
  /** Optional set of userIds to render with a "Rostered" badge. */
  rosteredUserIds?: Set<string>;
  /** When true, the trigger gets a clear ("X") button. */
  clearable?: boolean;
  className?: string;
  /** When set, restricts to users whose primary nursing role is in this list. */
  rolesShown?: string[];
  triggerSize?: 'sm' | 'default';
  /** Additional metadata renderer per user (e.g. "12 active assignments"). */
  metaForUser?: (user: UserListItem) => string | null;
  disabled?: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  nurse: 'Nurse',
  nurse_admin: 'Nurse admin',
};

function primaryNursingRole(u: UserListItem): string | undefined {
  const names = u.userRoles?.map((r) => r.role.name) ?? [];
  return names.find((n) => /^nurse(_|$)/i.test(n));
}

/**
 * Searchable nurse picker — built on Popover + cmdk so it scales to 100+
 * staff. The Base-UI Select component doesn't take a search input, which
 * makes it impractical for large hospital rosters; this component is the
 * drop-in replacement everywhere a nurse identity is chosen.
 */
export function NursePicker({
  users,
  value,
  onChange,
  placeholder = 'Pick a nurse',
  rosteredUserIds,
  clearable = false,
  className,
  rolesShown,
  triggerSize = 'default',
  metaForUser,
  disabled = false,
}: NursePickerProps) {
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!rolesShown || rolesShown.length === 0) return users;
    return users.filter((u) => {
      const names = u.userRoles?.map((r) => r.role.name) ?? [];
      return rolesShown.some((r) => names.includes(r));
    });
  }, [users, rolesShown]);

  // Sort: rostered first, then by name. Keeps the most relevant choices on
  // top when nurse_admin is mid-handover.
  const sorted = useMemo(() => {
    return filtered.slice().sort((a, b) => {
      const ar = rosteredUserIds?.has(a.id) ? 0 : 1;
      const br = rosteredUserIds?.has(b.id) ? 0 : 1;
      if (ar !== br) return ar - br;
      return `${a.firstName} ${a.lastName ?? ''}`.localeCompare(
        `${b.firstName} ${b.lastName ?? ''}`,
      );
    });
  }, [filtered, rosteredUserIds]);

  const selected = filtered.find((u) => u.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            disabled={disabled}
            className={cn(
              'justify-between font-normal',
              triggerSize === 'sm' ? 'h-8 px-2 text-xs' : 'h-9 px-3 text-sm',
              !value && 'text-muted-foreground',
              className,
            )}
          />
        }
      >
        <span className="line-clamp-1 text-left">
          {selected
            ? `${selected.firstName} ${selected.lastName ?? ''}`.trim() ||
              selected.email
            : placeholder}
        </span>
        <span className="ml-auto flex items-center gap-1 opacity-60">
          {clearable && value ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="rounded-sm p-0.5 hover:bg-muted"
              aria-label="Clear"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
          <ChevronsUpDown className="h-3.5 w-3.5" />
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter>
          <CommandInput placeholder="Search nurse by name…" />
          <CommandList>
            <CommandEmpty>No matching staff.</CommandEmpty>
            <CommandGroup>
              {sorted.map((u) => {
                const name = `${u.firstName} ${u.lastName ?? ''}`.trim();
                const role = primaryNursingRole(u);
                const isRostered = rosteredUserIds?.has(u.id);
                const meta = metaForUser?.(u);
                return (
                  <CommandItem
                    key={u.id}
                    // cmdk filters by `value`; use name + email so search
                    // works for both. id is set explicitly for selection.
                    value={`${name} ${u.email}`}
                    onSelect={() => {
                      onChange(u.id);
                      setOpen(false);
                    }}
                    data-checked={u.id === value || undefined}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{name || u.email}</div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {role ? (ROLE_LABEL[role] ?? role) : '—'}
                          {meta ? ` · ${meta}` : ''}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {isRostered ? (
                          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                            Rostered
                          </span>
                        ) : null}
                        {u.id === value ? (
                          <Check className="h-3.5 w-3.5 text-primary" />
                        ) : null}
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
