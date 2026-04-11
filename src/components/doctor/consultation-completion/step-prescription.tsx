'use client';

import { useState, useCallback } from 'react';
import { type UseFormReturn, useFieldArray } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Trash2, Pill, AlertTriangle, Sun, Cloud, Sunset, Moon, Clock, UtensilsCrossed } from 'lucide-react';
import { useFormularySearch, useAllergyCheck, type FormularyDrug } from '@/hooks/use-doctor';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import {
  TIMING_SLOTS,
  MEAL_OPTIONS,
  ROUTE_OPTIONS,
  DURATION_UNITS,
  defaultMedicine,
  type ConsultationFormData,
  type MedicineFormData,
} from './consultation-completion-schema';

interface StepPrescriptionProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<ConsultationFormData, any, any>;
  patientId: string;
}

export function StepPrescription({ form, patientId }: StepPrescriptionProps) {
  const { control, watch } = form;
  const medicines = watch('medicines');
  const { fields, append, remove } = useFieldArray({ control, name: 'medicines' });

  // ── Current drug being added ──
  const [currentDrug, setCurrentDrug] = useState<MedicineFormData>({ ...defaultMedicine });
  const [drugSearch, setDrugSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const debouncedSearch = useDebounce(drugSearch, 300);

  const { data: formularyResults } = useFormularySearch(debouncedSearch);
  const { data: allergyResult } = useAllergyCheck(patientId, currentDrug.drugName);

  // ── Select drug from formulary ──
  const handleSelectDrug = useCallback((drug: FormularyDrug) => {
    setCurrentDrug((prev) => ({
      ...prev,
      drugId: drug.id,
      drugName: drug.drugName,
      genericName: drug.genericName || '',
      dosage: drug.strength || '',
    }));
    setDrugSearch('');
    setShowDropdown(false);
  }, []);

  // ── Toggle timing slot ──
  const toggleTiming = useCallback((slot: string) => {
    setCurrentDrug((prev) => ({
      ...prev,
      timings: { ...prev.timings, [slot]: !prev.timings[slot as keyof typeof prev.timings] },
    }));
  }, []);

  // ── Add drug to list ──
  const handleAddDrug = useCallback(() => {
    if (!currentDrug.drugName || !currentDrug.dosage) return;

    const hasAnyTiming = TIMING_SLOTS.some((s) => currentDrug.timings[s]);
    if (!currentDrug.isPrn && !hasAnyTiming) return;

    if (!currentDrug.isPrn && !currentDrug.durationValue) return;

    append(currentDrug);
    setCurrentDrug({ ...defaultMedicine });
    setDrugSearch('');
  }, [currentDrug, append]);

  // Filter out already-added drugs
  const filteredResults = (formularyResults ?? []).filter(
    (d) => !medicines.some((m) => m.drugId === d.id),
  );

  const canAdd =
    currentDrug.drugName &&
    currentDrug.dosage &&
    (currentDrug.isPrn || TIMING_SLOTS.some((s) => currentDrug.timings[s])) &&
    (currentDrug.isPrn || currentDrug.durationValue);

  return (
    <div className="space-y-6">
      {/* ── Drug search ── */}
      <div className="rounded-xl border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Pill className="h-4 w-4 text-primary" />
          Add Medicine
        </h3>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search medicine from formulary..."
            className="pl-8 h-9 text-sm"
            value={drugSearch}
            onChange={(e) => {
              setDrugSearch(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
          />
          {showDropdown && filteredResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border bg-popover shadow-lg">
              {filteredResults.map((drug) => (
                <button
                  key={drug.id}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                  onClick={() => handleSelectDrug(drug)}
                >
                  <Pill className="h-3 w-3 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{drug.drugName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {[drug.genericName, drug.dosageForm, drug.strength].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Allergy alert */}
        {allergyResult?.hasAllergy && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Allergy Alert!</p>
              <p className="text-xs text-red-700">
                Patient has allergies matching this drug:{' '}
                {allergyResult.matchedAllergies.map((a) => a.allergen).join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* Drug details form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Drug Name *</Label>
            <Input
              placeholder="Drug name"
              className="h-8 text-xs"
              value={currentDrug.drugName}
              onChange={(e) => setCurrentDrug((p) => ({ ...p, drugName: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Dosage *</Label>
            <Input
              placeholder="e.g. 500mg, 10ml"
              className="h-8 text-xs"
              value={currentDrug.dosage}
              onChange={(e) => setCurrentDrug((p) => ({ ...p, dosage: e.target.value }))}
            />
          </div>
        </div>

        {/* Timing */}
        <div className="space-y-2">
          <Label className="text-[11px] text-muted-foreground">Timing *</Label>
          <div className="flex flex-wrap gap-2">
            {TIMING_SLOTS.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => toggleTiming(slot)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors border',
                  currentDrug.timings[slot]
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted',
                )}
              >
                {slot}
              </button>
            ))}
            <Separator orientation="vertical" className="h-7 mx-1" />
            <button
              type="button"
              onClick={() => setCurrentDrug((p) => ({ ...p, isPrn: !p.isPrn }))}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors border',
                currentDrug.isPrn
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted',
              )}
            >
              SOS / As Needed
            </button>
          </div>
        </div>

        {/* Meal relation */}
        {!currentDrug.isPrn && (
          <div className="space-y-2">
            <Label className="text-[11px] text-muted-foreground">Meal Relation</Label>
            <div className="flex gap-2">
              {MEAL_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCurrentDrug((p) => ({ ...p, mealRelation: option }))}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors border',
                    currentDrug.mealRelation === option
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted',
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Duration, Route, Quantity, Instructions */}
        <div className="space-y-3">
          {/* Row 1: Duration + Route + Quantity */}
          <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto] gap-3">
            {!currentDrug.isPrn && (
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Duration *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Enter number"
                    type="number"
                    className="h-10 text-sm"
                    value={currentDrug.durationValue}
                    onChange={(e) => setCurrentDrug((p) => ({ ...p, durationValue: e.target.value }))}
                  />
                  <select
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    value={currentDrug.durationUnit}
                    onChange={(e) => setCurrentDrug((p) => ({ ...p, durationUnit: e.target.value as 'days' | 'weeks' | 'months' }))}
                  >
                    {DURATION_UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Route</Label>
              <select
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                value={currentDrug.route}
                onChange={(e) => setCurrentDrug((p) => ({ ...p, route: e.target.value }))}
              >
                {ROUTE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Quantity</Label>
              <Input
                placeholder="Qty"
                type="number"
                className="h-10 text-sm w-24"
                value={currentDrug.quantity ?? ''}
                onChange={(e) => setCurrentDrug((p) => ({ ...p, quantity: e.target.value ? Number(e.target.value) : undefined }))}
              />
            </div>
          </div>

          {/* Row 2: Instructions — full width */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Instructions</Label>
            <Input
              placeholder="Special instructions (e.g. Take with warm water, avoid dairy...)"
              className="h-10 text-sm"
              value={currentDrug.instructions}
              onChange={(e) => setCurrentDrug((p) => ({ ...p, instructions: e.target.value }))}
            />
          </div>
        </div>

        <Button
          type="button"
          onClick={handleAddDrug}
          disabled={!canAdd}
          className="gap-1.5"
          size="sm"
        >
          <Plus className="h-3.5 w-3.5" />
          Add to Prescription
        </Button>
      </div>

      {/* ── Prescribed Medicines ── */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">
          Prescribed Medicines ({fields.length})
        </h3>

        {fields.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center">
            <Pill className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No medicines added yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Search and add medicines from the form above</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {fields.map((field, index) => {
              const med = medicines[index];
              if (!med) return null;
              return (
                <MedicineCard
                  key={field.id}
                  med={med}
                  index={index}
                  onRemove={() => remove(index)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Timing slot config ─────────────────────────────────────

const TIMING_ICON_MAP: Record<string, typeof Sun> = {
  Morning: Sun,
  Afternoon: Cloud,
  Evening: Sunset,
  Night: Moon,
};

// ── Medicine Card ──────────────────────────────────────────

function MedicineCard({
  med,
  index,
  onRemove,
}: {
  med: MedicineFormData;
  index: number;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 relative group transition-colors hover:border-primary/30">
      {/* Remove button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
        onClick={onRemove}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      {/* Header: number + drug name + dosage + route */}
      <div className="flex items-start gap-3 pr-8">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
          <span className="text-xs font-bold">{index + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">{med.drugName}</p>
            <Badge variant="outline" className="text-[10px] font-semibold">
              {med.dosage}
            </Badge>
            <Badge variant="outline" className="text-[10px] capitalize text-muted-foreground">
              {med.route}
            </Badge>
          </div>
          {med.genericName && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{med.genericName}</p>
          )}
        </div>
      </div>

      {/* Timing + Meal + Duration row */}
      {med.isPrn ? (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-xs font-semibold text-amber-700">Take as needed (SOS)</span>
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          {/* Timing pills */}
          <div className="flex items-center gap-1">
            {TIMING_SLOTS.map((slot) => {
              const Icon = TIMING_ICON_MAP[slot];
              const isActive = med.timings[slot];
              return (
                <div
                  key={slot}
                  className={cn(
                    'flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted/50 text-muted-foreground/30',
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {isActive && <span>{slot.slice(0, 3)}</span>}
                </div>
              );
            })}
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* Meal relation */}
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <UtensilsCrossed className="h-3 w-3" />
            <span>{med.mealRelation}</span>
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* Duration */}
          <div className="flex items-center gap-1 text-[11px] font-semibold text-foreground">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span>{med.durationValue} {med.durationUnit}</span>
          </div>

          {/* Quantity if present */}
          {med.quantity && (
            <>
              <Separator orientation="vertical" className="h-5" />
              <span className="text-[11px] text-muted-foreground">
                Qty: <span className="font-semibold text-foreground">{med.quantity}</span>
              </span>
            </>
          )}
        </div>
      )}

      {/* Instructions */}
      {med.instructions && (
        <p className="text-[11px] text-muted-foreground italic border-t pt-2">
          {med.instructions}
        </p>
      )}
    </div>
  );
}
