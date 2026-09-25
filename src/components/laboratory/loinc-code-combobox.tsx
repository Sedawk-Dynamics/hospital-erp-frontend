'use client';

import { useState } from 'react';
import { ChevronsUpDown, Check, X, FlaskConical } from 'lucide-react';
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
import { useLoincSearch, type LoincConcept } from '@/hooks/use-loinc';

export interface LoincCodeComboboxProps {
  /** Currently selected LOINC code string (or empty). */
  value?: string | null;
  /** Optional display name shown alongside the code when one is selected. */
  valueTitle?: string | null;
  onSelect: (loinc: LoincConcept | null) => void;
  placeholder?: string;
  className?: string;
  triggerSize?: 'sm' | 'default';
  disabled?: boolean;
  clearable?: boolean;
}

// LOINC observation picker — server-side search against /loinc/search. Unlike the
// ICD/SNOMED pickers there is no cross-map step: the selected row already carries
// the final code, so onSelect just hands back the concept.
export function LoincCodeCombobox({
  value,
  valueTitle,
  onSelect,
  placeholder = 'Search LOINC observation…',
  className,
  triggerSize = 'default',
  disabled = false,
  clearable = true,
}: LoincCodeComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);
  const { data: results, isFetching } = useLoincSearch(debounced, open);

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
            // role="button" span, not <button> — this lives inside the
            // PopoverTrigger's <button>, and nested buttons are invalid HTML.
            <span
              role="button"
              tabIndex={0}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect(null);
                }
              }}
              className="rounded-sm p-0.5 hover:bg-muted"
              aria-label="Clear"
            >
              <X className="h-3 w-3" />
            </span>
          ) : null}
          <ChevronsUpDown className="h-3.5 w-3.5" />
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        {/* shouldFilter=false — results are already filtered by the server. */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type a test or code (e.g. CBC, hemoglobin, 718-7)…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {query.trim().length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Start typing to search the LOINC catalog.
              </div>
            ) : isFetching ? (
              <div className="py-6 text-center text-xs text-muted-foreground">Searching…</div>
            ) : (results ?? []).length === 0 ? (
              <CommandEmpty>No matching LOINC codes.</CommandEmpty>
            ) : (
              <CommandGroup>
                {(results ?? []).map((loinc) => (
                  <CommandItem
                    key={loinc.id}
                    value={loinc.loincCode}
                    onSelect={() => {
                      onSelect(loinc);
                      setOpen(false);
                      setQuery('');
                    }}
                    data-checked={loinc.loincCode === value || undefined}
                  >
                    <div className="flex w-full items-center gap-2">
                      <FlaskConical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">
                          <span className="font-semibold text-primary">{loinc.loincCode}</span>{' '}
                          {loinc.displayName}
                        </div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {loinc.component ?? '—'}
                          {loinc.system ? ` · ${loinc.system}` : ''}
                        </div>
                      </div>
                      {loinc.loincCode === value ? (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      ) : null}
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
