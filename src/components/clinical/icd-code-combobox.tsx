'use client';

import { useState } from 'react';
import { ChevronsUpDown, Check, X, Stethoscope } from 'lucide-react';
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
import { useDebounce } from '@/hooks/use-debounce';
import { useIcdSearch, type IcdCode } from '@/hooks/use-icd';

export interface IcdCodeComboboxProps {
  /** Currently selected ICD code string (or empty). */
  value?: string | null;
  /** Optional title to show alongside the code when one is selected. */
  valueTitle?: string | null;
  onSelect: (icd: IcdCode | null) => void;
  placeholder?: string;
  className?: string;
  triggerSize?: 'sm' | 'default';
  disabled?: boolean;
  clearable?: boolean;
}

// Diagnosis ICD-10 picker — server-side search against /icd/search (shared
// catalog + the hospital's custom codes). Drop-in for any diagnosis field.
export function IcdCodeCombobox({
  value,
  valueTitle,
  onSelect,
  placeholder = 'Search ICD diagnosis…',
  className,
  triggerSize = 'default',
  disabled = false,
  clearable = true,
}: IcdCodeComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);
  const { data: results, isFetching } = useIcdSearch(debounced, open);

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
          {value ? (
            <>
              <span className="font-semibold text-primary">{value}</span>
              {valueTitle ? <span className="text-foreground"> — {valueTitle}</span> : null}
            </>
          ) : (
            placeholder
          )}
        </span>
        <span className="ml-auto flex items-center gap-1 opacity-60">
          {clearable && value ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(null);
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
      <PopoverContent className="w-[360px] p-0" align="start">
        {/* shouldFilter=false — results are already filtered by the server. */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type a code or condition (e.g. fever, E11)…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {query.trim().length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Start typing to search the ICD-10 catalog.
              </div>
            ) : isFetching ? (
              <div className="py-6 text-center text-xs text-muted-foreground">Searching…</div>
            ) : (results ?? []).length === 0 ? (
              <CommandEmpty>No matching ICD codes.</CommandEmpty>
            ) : (
              <CommandGroup>
                {(results ?? []).map((icd) => (
                  <CommandItem
                    key={icd.id}
                    value={icd.code}
                    onSelect={() => {
                      onSelect(icd);
                      setOpen(false);
                      setQuery('');
                    }}
                    data-checked={icd.code === value || undefined}
                  >
                    <div className="flex w-full items-center gap-2">
                      <Stethoscope className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">
                          <span className="font-semibold text-primary">{icd.code}</span> {icd.title}
                        </div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {icd.category ?? '—'}
                          {icd.isCustom ? ' · custom' : ''}
                        </div>
                      </div>
                      {icd.code === value ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
