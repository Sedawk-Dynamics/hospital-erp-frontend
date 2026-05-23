'use client';

// Combobox-style unit picker used in the lab parameter builder. Behaviour:
//   • text input is fully editable so admins can type a custom unit
//     (matches the backend schema which is `unit: string|null, max 50`)
//   • a small chevron button opens a popover with grouped suggestions —
//     pulled live from the DB (`/lab/unit-groups`) when available, with a
//     fallback to the frontend LAB_UNIT_GROUPS constants so the picker
//     still works on first paint before the query resolves
//   • when a `unitGroupCode` filter is passed, the popover only shows
//     units from that group (with a "Show all units" footer to escape
//     the filter when needed)
//   • when the user types something not in the catalog, the popover shows
//     a "use {input}" footer so they can commit it explicitly
//
// Intentionally lightweight — no Command/Combobox dependency, so it slots
// straight into the table-style parameter builder without breaking the row
// height.

import { useMemo, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { LAB_UNIT_GROUPS, LAB_UNIT_VALUES } from './lab-units';
import { useLabUnitGroups, type LabUnitGroup as DbUnitGroup } from '@/hooks/use-lab-units';

interface LabUnitPickerProps {
  value: string | null | undefined;
  onChange: (next: string | null) => void;
  // When set, restricts the dropdown to units in that group's code (e.g.
  // "concentration_mass"). The user can still type a custom value and the
  // footer offers a "Show all units" escape hatch.
  unitGroupCode?: string | null;
  placeholder?: string;
  className?: string;
}

type RenderGroup = {
  code: string;
  label: string;
  units: { value: string; label: string }[];
  isTenantLocal?: boolean;
};

// Map the DB rows into the same shape the picker uses for the local fallback.
function dbGroupsToRender(groups: DbUnitGroup[]): RenderGroup[] {
  return groups
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((g) => ({
      code: g.code,
      label: g.tenantId ? `${g.name} (Hospital)` : g.name,
      isTenantLocal: !!g.tenantId,
      units: g.units.map((u) => ({
        value: u.symbol,
        label: u.name ? `${u.symbol} — ${u.name}` : u.symbol,
      })),
    }));
}

// Local constants → render shape (fallback when API not yet loaded).
const FALLBACK_GROUPS: RenderGroup[] = LAB_UNIT_GROUPS.map((g) => ({
  code: g.group.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
  label: g.group,
  units: g.units,
}));

export function LabUnitPicker({
  value,
  onChange,
  unitGroupCode,
  placeholder = 'g/dL',
  className,
}: LabUnitPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // When user manually clears the unit-group filter from inside the popover
  // (footer button) — flip the picker into "show all" mode for this session.
  const [showAll, setShowAll] = useState(false);
  const dbQuery = useLabUnitGroups();

  const allGroups: RenderGroup[] = useMemo(() => {
    if (dbQuery.data && dbQuery.data.length > 0) return dbGroupsToRender(dbQuery.data);
    return FALLBACK_GROUPS;
  }, [dbQuery.data]);

  const filterByGroup = !showAll && !!unitGroupCode;

  const knownSymbols = useMemo(
    () => new Set(allGroups.flatMap((g) => g.units.map((u) => u.value))),
    [allGroups],
  );

  const current = value ?? '';
  const trimmedQuery = query.trim();

  // Filter groups based on the search query AND the unit-group filter.
  const filteredGroups = useMemo(() => {
    let groups = allGroups;
    if (filterByGroup) {
      groups = groups.filter((g) => g.code === unitGroupCode);
    }
    if (!trimmedQuery) return groups;
    const needle = trimmedQuery.toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        units: g.units.filter(
          (u) => u.value.toLowerCase().includes(needle) || u.label.toLowerCase().includes(needle),
        ),
      }))
      .filter((g) => g.units.length > 0);
  }, [allGroups, filterByGroup, unitGroupCode, trimmedQuery]);

  const customAvailable = !!trimmedQuery && !knownSymbols.has(trimmedQuery) && !LAB_UNIT_VALUES.includes(trimmedQuery);

  const pick = (val: string) => {
    onChange(val);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className={cn('relative flex items-center', className)}>
      <Input
        className="h-7 text-xs pr-12"
        placeholder={placeholder}
        value={current}
        onChange={(e) => onChange(e.target.value || null)}
        aria-label="Parameter unit"
      />
      {current && (
        <button
          type="button"
          className="absolute right-7 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.preventDefault();
            onChange(null);
          }}
          title="Clear unit"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 rounded hover:bg-surface-container-high text-muted-foreground inline-flex items-center justify-center"
              title="Pick a standard unit"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          }
        />
        <PopoverContent align="end" className="w-72 p-0">
          <div className="p-2 border-b bg-surface-container-lowest">
            <Input
              autoFocus
              placeholder="Search units…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-7 text-xs"
            />
            {filterByGroup && (
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>
                  Filtered: <span className="font-mono font-semibold">{unitGroupCode}</span>
                </span>
                <button
                  type="button"
                  className="hover:underline"
                  onClick={() => setShowAll(true)}
                >
                  Show all units →
                </button>
              </div>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto p-1.5">
            {filteredGroups.length === 0 && !customAvailable && (
              <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                No matching units. Type a custom value above.
              </div>
            )}
            {filteredGroups.map((g) => (
              <div key={g.code} className="mb-2 last:mb-0">
                <div className="px-2 pt-1 pb-0.5 text-[10px] uppercase font-semibold tracking-wide text-muted-foreground flex items-center gap-1">
                  {g.label}
                  {g.isTenantLocal && (
                    <span className="rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[9px] font-medium normal-case">local</span>
                  )}
                </div>
                {g.units.map((u) => {
                  const isSelected = u.value === current;
                  return (
                    <button
                      key={u.value}
                      type="button"
                      className={cn(
                        'w-full flex items-center justify-between gap-2 px-2 py-1 rounded text-xs hover:bg-surface-container-low',
                        isSelected && 'bg-primary/10 text-primary',
                      )}
                      onClick={() => pick(u.value)}
                    >
                      <span className="truncate text-left">{u.label}</span>
                      {isSelected ? (
                        <Check className="h-3 w-3 shrink-0" />
                      ) : (
                        <span className="font-mono text-[10px] text-muted-foreground shrink-0">{u.value}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          {customAvailable && (
            <button
              type="button"
              className="w-full border-t px-3 py-2 text-left text-xs hover:bg-surface-container-low"
              onClick={() => pick(trimmedQuery)}
            >
              Use custom unit:{' '}
              <span className="font-mono font-semibold">{trimmedQuery}</span>
            </button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
