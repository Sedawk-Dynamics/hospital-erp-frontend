'use client';

import { useMemo, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  usePhysicalObservationCatalog,
  type PhysicalObservationCatalogEntry,
} from '@/hooks/use-doctor';

export interface PhysicalObservationValue {
  source: 'catalog' | 'free_text';
  catalogId?: string;
  value: string;
  system?: string;
}

export const PHYS_OBS_SYSTEMS: Array<{
  key: PhysicalObservationCatalogEntry['system'];
  label: string;
}> = [
  { key: 'general', label: 'General' },
  { key: 'cardiovascular', label: 'Cardiovascular' },
  { key: 'respiratory', label: 'Respiratory' },
  { key: 'gastrointestinal', label: 'Gastrointestinal' },
  { key: 'neurological', label: 'Neurological' },
  { key: 'musculoskeletal', label: 'Musculoskeletal' },
  { key: 'skin', label: 'Skin' },
  { key: 'ent', label: 'ENT' },
  { key: 'eye', label: 'Eye' },
  { key: 'genitourinary', label: 'Genitourinary' },
  { key: 'psychiatric', label: 'Psychiatric' },
  { key: 'other', label: 'Other' },
];

export interface PhysicalObservationsPickerProps {
  value: PhysicalObservationValue[];
  onChange: (next: PhysicalObservationValue[]) => void;
}

export function PhysicalObservationsPicker({ value, onChange }: PhysicalObservationsPickerProps) {
  const [search, setSearch] = useState('');
  const [system, setSystem] = useState<PhysicalObservationCatalogEntry['system'] | 'all'>('all');
  const [freeText, setFreeText] = useState('');

  const { data: catalog = [], isLoading } = usePhysicalObservationCatalog(
    system !== 'all' ? { system, search } : { search },
  );

  const selectedCatalogIds = useMemo(
    () => new Set(value.filter((v) => v.source === 'catalog').map((v) => v.catalogId)),
    [value],
  );

  const addFromCatalog = (entry: PhysicalObservationCatalogEntry) => {
    if (selectedCatalogIds.has(entry.id)) return;
    onChange([
      ...value,
      { source: 'catalog', catalogId: entry.id, value: entry.name, system: entry.system },
    ]);
  };

  const addFreeText = () => {
    const v = freeText.trim();
    if (!v) return;
    onChange([...value, { source: 'free_text', value: v }]);
    setFreeText('');
  };

  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((po, idx) => (
            <span
              key={`${po.catalogId ?? 'ft'}-${idx}`}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                po.source === 'catalog'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-secondary/10 text-secondary',
              )}
            >
              {po.value}
              <button
                type="button"
                onClick={() => remove(idx)}
                className="rounded-full hover:bg-background/50 p-0.5"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={system}
          onChange={(e) => setSystem(e.target.value as any)}
          className="h-8 rounded-md border bg-background px-2 text-xs"
        >
          <option value="all">All systems</option>
          {PHYS_OBS_SYSTEMS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search physical findings..."
          className="h-8 text-xs flex-1"
        />
      </div>

      <div className="max-h-40 overflow-y-auto rounded-md border bg-surface-container-lowest">
        {isLoading ? (
          <div className="p-3 text-center text-xs text-muted-foreground">
            <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
            Loading…
          </div>
        ) : catalog.length === 0 ? (
          <div className="p-3 text-center text-xs text-muted-foreground">
            No matching entries — add a custom one below.
          </div>
        ) : (
          <ul className="divide-y">
            {catalog.map((entry) => {
              const selected = selectedCatalogIds.has(entry.id);
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    disabled={selected}
                    onClick={() => addFromCatalog(entry)}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-muted/50',
                      selected && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    <span>{entry.name}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {entry.system}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addFreeText();
            }
          }}
          placeholder="Custom finding (press Enter to add)"
          className="h-8 text-xs"
        />
        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={addFreeText}>
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>
    </div>
  );
}
