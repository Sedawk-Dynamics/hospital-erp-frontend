'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { type UseFormReturn, useFieldArray } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Trash2, Pill, AlertTriangle, GripVertical } from 'lucide-react';
import { useFormularySearch, useAllergyCheck, type FormularyDrug } from '@/hooks/use-doctor';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import {
  FREQUENCY_OPTIONS,
  TIMING_OPTIONS,
  DURATION_UNITS,
  ROUTE_OPTIONS,
  getDosageFormBadge,
  defaultMedicine,
  type ConsultationFormData,
  type MedicineFormData,
} from './consultation-completion-schema';
import { QtyCell } from '../prescription-qty-cell';

interface StepPrescriptionProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<ConsultationFormData, any, any>;
  patientId: string;
}

export function StepPrescription({ form, patientId }: StepPrescriptionProps) {
  const { control, watch, setValue } = form;
  const medicines = watch('medicines');
  const { fields, append, remove, move } = useFieldArray({ control, name: 'medicines' });

  // Drug search state
  const [drugSearch, setDrugSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const debouncedSearch = useDebounce(drugSearch, 300);
  const searchRef = useRef<HTMLDivElement>(null);

  const { data: formularyResults } = useFormularySearch(debouncedSearch);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Filter already-added drugs (catalog-only matches have a null id → keep them)
  const filteredResults = (formularyResults ?? []).filter(
    (d) => d.id == null || !medicines.some((m) => m.drugId === d.id),
  );

  // Select drug from formulary → add as row
  const handleSelectDrug = useCallback(
    (drug: FormularyDrug) => {
      const newMed: MedicineFormData = {
        ...defaultMedicine,
        // Catalog-only drugs have no formulary id → save as free-text.
        drugId: drug.id ?? undefined,
        drugName: drug.drugName,
        genericName: drug.genericName || '',
        dosageForm: drug.dosageForm || '',
        strength: drug.strength || '',
        dose: '',
        dosage: drug.strength || '',
      };
      append(newMed);
      setDrugSearch('');
      setShowDropdown(false);
    },
    [append],
  );

  // Add custom (non-formulary) drug
  const handleAddCustom = useCallback(() => {
    if (!drugSearch.trim()) return;
    const newMed: MedicineFormData = {
      ...defaultMedicine,
      drugName: drugSearch.trim(),
    };
    append(newMed);
    setDrugSearch('');
    setShowDropdown(false);
  }, [drugSearch, append]);

  // Update a field on a specific medicine row
  const updateField = useCallback(
    (index: number, field: keyof MedicineFormData, value: string | number | boolean | undefined) => {
      setValue(`medicines.${index}.${field}` as any, value, { shouldDirty: true });
    },
    [setValue],
  );

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Pill className="h-4 w-4 text-primary" />
          Medications
        </h3>
        <span className="text-xs text-muted-foreground">
          {fields.length} medicine{fields.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Medication table */}
      {fields.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[minmax(180px,2fr)_100px_100px_110px_100px_72px_1fr_36px] gap-0 border-b bg-muted/50 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <div className="px-3 py-2.5">Medicine</div>
            <div className="px-2 py-2.5">Dose</div>
            <div className="px-2 py-2.5">Frequency</div>
            <div className="px-2 py-2.5">Timing</div>
            <div className="px-2 py-2.5">Duration</div>
            <div className="px-2 py-2.5" title="Total units = dose pattern × duration">Qty</div>
            <div className="px-2 py-2.5">Instructions</div>
            <div className="px-1 py-2.5" />
          </div>

          {/* Medicine rows */}
          {fields.map((field, index) => (
            <MedicineRow
              key={field.id}
              index={index}
              med={medicines[index]}
              patientId={patientId}
              onUpdate={updateField}
              onRemove={() => remove(index)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {fields.length === 0 && (
        <div className="rounded-xl border border-dashed bg-muted/10 p-6 text-center">
          <Pill className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No medicines added yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Search and select medicines below
          </p>
        </div>
      )}

      {/* Drug search bar */}
      <div ref={searchRef} className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Start typing Medicines..."
          className="pl-9 h-10 text-sm"
          value={drugSearch}
          onChange={(e) => {
            setDrugSearch(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => drugSearch.length >= 2 && setShowDropdown(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (filteredResults.length > 0) {
                handleSelectDrug(filteredResults[0]);
              } else if (drugSearch.trim()) {
                handleAddCustom();
              }
            }
          }}
        />

        {/* Search dropdown */}
        {showDropdown && drugSearch.length >= 2 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border bg-popover shadow-lg">
            {filteredResults.map((drug) => {
              const badge = getDosageFormBadge(drug.dosageForm ?? undefined);
              return (
                <button
                  key={drug.id ?? drug.drugMasterId ?? drug.drugName}
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-accent transition-colors border-b last:border-b-0"
                  onClick={() => handleSelectDrug(drug)}
                >
                  {badge && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] font-bold shrink-0 px-1.5 py-0.5',
                        drug.dosageForm === 'tablet' && 'bg-primary-container/10 text-primary-container border-primary-container/30',
                        drug.dosageForm === 'capsule' && 'bg-primary/10 text-primary border-primary/30',
                        drug.dosageForm === 'syrup' && 'bg-tertiary/10 text-tertiary border-tertiary/30',
                        drug.dosageForm === 'injection' && 'bg-error/10 text-error border-error/30',
                        drug.dosageForm === 'cream' && 'bg-secondary/10 text-secondary border-secondary/30',
                      )}
                    >
                      {badge}
                    </Badge>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{drug.drugName}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">
                      {[drug.genericName, drug.strength && `(${drug.strength})`].filter(Boolean).join(' ')}
                    </p>
                  </div>
                </button>
              );
            })}
            {filteredResults.length === 0 && (
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-3 text-sm hover:bg-accent"
                onClick={handleAddCustom}
              >
                <Pill className="h-4 w-4 text-muted-foreground" />
                <span>
                  Add &quot;<span className="font-medium">{drugSearch}</span>&quot; as custom medicine
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Medicine Row (inline editable) ────────────────────────────

function MedicineRow({
  index,
  med,
  patientId,
  onUpdate,
  onRemove,
}: {
  index: number;
  med: MedicineFormData;
  patientId: string;
  onUpdate: (index: number, field: keyof MedicineFormData, value: any) => void;
  onRemove: () => void;
}) {
  const { data: allergyResult } = useAllergyCheck(patientId, med?.drugName);
  const badge = getDosageFormBadge(med?.dosageForm);

  if (!med) return null;

  return (
    <div className="group">
      {/* Allergy alert */}
      {allergyResult?.hasAllergy && (
        <div className="flex items-center gap-2 bg-error/10 border-b border-error/30 px-3 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-error shrink-0" />
          <span className="text-xs text-error font-medium">
            Allergy: {allergyResult.matchedAllergies.map((a) => a.allergen).join(', ')}
          </span>
        </div>
      )}

      <div className="grid grid-cols-[minmax(180px,2fr)_100px_100px_110px_100px_72px_1fr_36px] gap-0 border-b last:border-b-0 hover:bg-accent/30 transition-colors">
        {/* Medicine name + generic */}
        <div className="px-3 py-2.5 flex items-start gap-2 min-w-0">
          <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0 mt-0.5 cursor-grab" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium truncate">{med.drugName}</span>
              {badge && (
                <Badge variant="secondary" className="text-[9px] font-bold px-1 py-0 shrink-0">
                  {badge}
                </Badge>
              )}
            </div>
            {med.genericName && (
              <p className="text-[10px] text-muted-foreground uppercase truncate mt-0.5">
                {med.genericName} {med.strength && `(${med.strength})`}
              </p>
            )}
          </div>
        </div>

        {/* Dose */}
        <div className="px-1.5 py-2">
          <Input
            placeholder={med.dosageForm ? `e.g. 1 ${getDosageFormBadge(med.dosageForm) || 'Tab'}` : 'e.g. 1 Tab'}
            className="h-8 text-xs border-dashed"
            value={med.dose || ''}
            onChange={(e) => onUpdate(index, 'dose', e.target.value)}
          />
        </div>

        {/* Frequency dropdown */}
        <div className="px-1.5 py-2">
          <select
            className="flex h-8 w-full rounded-md border border-dashed border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
            value={med.frequency || ''}
            onChange={(e) => {
              const val = e.target.value;
              onUpdate(index, 'frequency', val);
              // Auto-set isPrn for SOS
              onUpdate(index, 'isPrn', val === 'SOS');
            }}
          >
            <option value="">Frequency</option>
            {FREQUENCY_OPTIONS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        {/* Timing dropdown */}
        <div className="px-1.5 py-2">
          <select
            className="flex h-8 w-full rounded-md border border-dashed border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
            value={med.timing || ''}
            onChange={(e) => onUpdate(index, 'timing', e.target.value)}
          >
            <option value="">Timing</option>
            {TIMING_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Duration */}
        <div className="px-1.5 py-2">
          <div className="flex gap-1">
            <Input
              placeholder="eg: 7"
              type="number"
              className="h-8 text-xs border-dashed w-12 px-1.5"
              value={med.durationValue || ''}
              onChange={(e) => onUpdate(index, 'durationValue', e.target.value)}
            />
            <select
              className="flex h-8 rounded-md border border-dashed border-input bg-background px-1 text-[10px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 w-14"
              value={med.durationUnit || 'days'}
              onChange={(e) => onUpdate(index, 'durationUnit', e.target.value)}
            >
              {DURATION_UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Qty — auto-calculated from dose pattern × duration, doctor-overridable */}
        <div className="px-1.5 py-2">
          <QtyCell index={index} med={med} onUpdate={onUpdate} />
        </div>

        {/* Instructions */}
        <div className="px-1.5 py-2">
          <Input
            placeholder="Instructions"
            className="h-8 text-xs border-dashed"
            value={med.instructions || ''}
            onChange={(e) => onUpdate(index, 'instructions', e.target.value)}
          />
        </div>

        {/* Delete */}
        <div className="px-1 py-2 flex items-center justify-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-error hover:bg-error/10 transition-all"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
