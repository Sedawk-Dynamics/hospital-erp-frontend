'use client';

// A single-choice dropdown with a search box.
//
// Base-UI's Select takes no search input, so a field with fifty options —
// a diagnosis list, a ward list, a procedure list on a dynamic form — can only
// be scrolled. This is the same Popover + cmdk pattern NursePicker already
// uses, generalised so any option list can reach for it.
//
// The search input sits in its own row ABOVE the list, and the list scrolls
// underneath it, so typing is never covered by the options being filtered.

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
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

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Optional second line (e.g. a code, a category). Also searchable. */
  hint?: string;
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  /** Matches the app's compact control height by default. */
  size?: 'sm' | 'default';
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No matches.',
  disabled = false,
  clearable = false,
  className,
  size = 'default',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              'w-full justify-between font-normal',
              size === 'sm' ? 'h-8 px-2 text-xs' : 'h-9 px-3 text-sm',
              !selected && 'text-muted-foreground',
              className,
            )}
          />
        }
      >
        <span className="line-clamp-1 text-left">{selected ? selected.label : placeholder}</span>
        <span className="ml-auto flex items-center gap-1 opacity-60">
          {clearable && selected ? (
            // A span with role="button", not a <button> — this sits inside the
            // trigger's own <button> and nested buttons are invalid HTML.
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear selection"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(null);
                }
              }}
              className="rounded-sm p-0.5 hover:bg-muted"
            >
              <X className="h-3 w-3" />
            </span>
          ) : null}
          <ChevronsUpDown className="h-3.5 w-3.5" />
        </span>
      </PopoverTrigger>

      {/* p-0 lets Command own its padding; the width is capped against the
          viewport so the popup never spills off-screen on a phone. */}
      <PopoverContent
        className="w-[min(22rem,calc(100vw-2rem))] p-0"
        align="start"
      >
        <Command shouldFilter>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  // cmdk filters on this string — include the hint so a code
                  // or category matches as well as the visible label.
                  value={`${o.label} ${o.hint ?? ''} ${o.value}`}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <div className="flex w-full items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{o.label}</div>
                      {o.hint && (
                        <div className="truncate text-[10px] text-muted-foreground">{o.hint}</div>
                      )}
                    </div>
                    {o.value === value && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
