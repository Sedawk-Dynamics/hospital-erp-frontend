'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { Search, Pill, AlertTriangle, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { useFormularySearch, useAllergyCheck, type FormularyDrug } from '@/hooks/use-doctor';
import {
  FREQUENCY_OPTIONS,
  TIMING_OPTIONS,
  DURATION_UNITS,
  ROUTE_OPTIONS,
  defaultMedicine,
  getDosageFormBadge,
  getDoseUnitLabel,
  type MedicineFormData,
} from '@/components/doctor/consultation-completion/consultation-completion-schema';
import { QtyCell } from '@/components/doctor/prescription-qty-cell';

/**
 * Shared, controlled medicine capture — the same M-A-N dose / frequency / timing
 * / duration / auto-Qty the OP prescription pad uses, so the IP flow writes
 * medicines identically (and the auto-computed Qty reaches the pharmacy).
 *
 * Each medicine is a responsive CARD with a wrapping field grid (2 cols on
 * mobile → 6 on desktop) — no fixed-width table, no horizontal scroll box.
 * Operates on a plain MedicineFormData[] + onChange, so it works outside
 * react-hook-form.
 */
export function MedicineTable({
  medicines,
  onChange,
  patientId,
}: {
  medicines: MedicineFormData[];
  onChange: (next: MedicineFormData[]) => void;
  patientId: string;
}) {
  const [drugSearch, setDrugSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const debouncedSearch = useDebounce(drugSearch, 300);
  const { data: formularyResults } = useFormularySearch(debouncedSearch);

  const filteredResults = (formularyResults ?? []).filter(
    (d: FormularyDrug) => d.id == null || !medicines.some((m) => m.drugId === d.id),
  );

  const selectDrug = useCallback((drug: FormularyDrug) => {
    onChange([
      ...medicines,
      {
        ...defaultMedicine,
        drugId: drug.id ?? undefined,
        drugName: drug.drugName,
        genericName: drug.genericName || '',
        dosageForm: drug.dosageForm || '',
        strength: drug.strength || '',
        dosage: drug.strength || '',
      },
    ]);
    setDrugSearch('');
    setShowDropdown(false);
  }, [medicines, onChange]);

  const addCustom = useCallback(() => {
    if (!drugSearch.trim()) return;
    onChange([...medicines, { ...defaultMedicine, drugName: drugSearch.trim() }]);
    setDrugSearch('');
    setShowDropdown(false);
  }, [drugSearch, medicines, onChange]);

  const updateField = useCallback(
    (index: number, field: keyof MedicineFormData, value: any) => {
      onChange(medicines.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
    },
    [medicines, onChange],
  );

  // Merge several fields in ONE update — needed when a single change touches
  // more than one field (e.g. frequency also sets isPrn). Calling updateField
  // twice would rebuild the array from the same stale `medicines` closure, so
  // the second call would clobber the first.
  const updateFields = useCallback(
    (index: number, patch: Partial<MedicineFormData>) => {
      onChange(medicines.map((m, i) => (i === index ? { ...m, ...patch } : m)));
    },
    [medicines, onChange],
  );

  const removeAt = useCallback(
    (index: number) => onChange(medicines.filter((_, i) => i !== index)),
    [medicines, onChange],
  );

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Pill className="h-4 w-4 text-primary shrink-0" />
        <h3 className="text-sm font-semibold flex-1">Medications</h3>
        <span className="text-xs text-muted-foreground">{medicines.length} medicine{medicines.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="px-3 pb-3 space-y-3">
        {medicines.length > 0 && (
          <div className="space-y-2">
            {medicines.map((med, index) => (
              <MedCard
                key={index}
                index={index}
                med={med}
                patientId={patientId}
                onUpdate={updateField}
                onUpdateMany={updateFields}
                onRemove={() => removeAt(index)}
              />
            ))}
          </div>
        )}

        {/* Drug search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Start typing medicines…"
            className="pl-9 h-10 text-sm"
            value={drugSearch}
            onChange={(e) => { setDrugSearch(e.target.value); setShowDropdown(true); }}
            onFocus={() => drugSearch.length >= 2 && setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                filteredResults.length > 0 ? selectDrug(filteredResults[0]) : drugSearch.trim() && addCustom();
              }
            }}
          />
          {showDropdown && drugSearch.length >= 2 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border bg-popover shadow-lg">
              {filteredResults.map((drug) => {
                const badge = getDosageFormBadge(drug.dosageForm ?? undefined);
                return (
                  <button
                    key={drug.id ?? drug.drugMasterId ?? drug.drugName}
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors border-b last:border-b-0"
                    onClick={() => selectDrug(drug)}
                  >
                    {badge && (
                      <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0">{badge}</Badge>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{drug.drugName}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">
                        {[drug.genericName, drug.strength && `(${drug.strength})`].filter(Boolean).join(' ')}
                      </p>
                    </div>
                    {/* Availability in this hospital's pharmacy */}
                    <div className="ml-auto shrink-0">
                      {drug.source === 'master' ? (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground border-muted-foreground/30">
                          catalog · not stocked
                        </Badge>
                      ) : (drug.availableStock ?? 0) > 0 ? (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          {drug.availableStock} in stock
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                          out of stock
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              {filteredResults.length === 0 && (
                <button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent" onClick={addCustom}>
                  <Pill className="h-4 w-4 text-muted-foreground" />
                  <span>Add &quot;{drugSearch}&quot; as custom medicine</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** A small labelled field wrapper for the card grid. */
function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <label className="mb-0.5 block text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function MedCard({ index, med, patientId, onUpdate, onUpdateMany, onRemove }: {
  index: number; med: MedicineFormData; patientId: string;
  onUpdate: (i: number, f: keyof MedicineFormData, v: any) => void;
  onUpdateMany: (i: number, patch: Partial<MedicineFormData>) => void;
  onRemove: () => void;
}) {
  const { data: allergyResult } = useAllergyCheck(patientId, med?.drugName);
  const badge = getDosageFormBadge(med?.dosageForm);
  if (!med) return null;

  const selectCls = 'flex h-8 w-full rounded-md border border-input bg-background px-1.5 text-xs';

  return (
    <div className="rounded-lg border bg-background">
      {allergyResult?.hasAllergy && (
        <div className="flex items-center gap-2 rounded-t-lg bg-error/10 border-b border-error/30 px-3 py-1">
          <AlertTriangle className="h-3 w-3 text-error" />
          <span className="text-[11px] text-error font-medium">
            Allergy: {allergyResult.matchedAllergies.map((a) => a.allergen).join(', ')}
          </span>
        </div>
      )}
      <div className="p-3">
        {/* Drug name + remove */}
        <div className="mb-2.5 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-semibold text-foreground">{med.drugName}</span>
              {badge && <Badge variant="secondary" className="text-[8px] font-bold px-1 py-0">{badge}</Badge>}
              {!med.drugId && <span className="text-[9px] text-amber-600">free-text</span>}
            </div>
            {med.genericName && (
              <p className="text-[10px] text-muted-foreground uppercase truncate">
                {med.genericName} {med.strength && `(${med.strength})`}
              </p>
            )}
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-error" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Responsive field grid: 2 cols (mobile) → 3 (sm+). Kept at 3 so each
            field — especially Duration (value + unit) — has room to render. */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-2.5 sm:grid-cols-3">
          <Field label="Dose">
            <div className="flex items-center gap-1">
              <Input
                type="number" min={0} step="0.5" placeholder="1"
                title="Units per intake (default 1) — multiplied into Qty"
                className="h-8 w-full px-1 text-center text-xs"
                value={med.doseQuantity ?? 1}
                onChange={(e) => onUpdate(index, 'doseQuantity', e.target.value === '' ? 1 : Number(e.target.value))}
              />
              <span className="text-[9px] uppercase tracking-wide text-muted-foreground shrink-0">{getDoseUnitLabel(med.dosageForm)}</span>
            </div>
          </Field>
          <Field label="Frequency">
            <select
              className={selectCls}
              value={med.frequency || ''}
              onChange={(e) => onUpdateMany(index, { frequency: e.target.value, isPrn: e.target.value === 'SOS' })}
            >
              <option value="">--</option>
              {FREQUENCY_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
          <Field label="Timing">
            <select className={selectCls} value={med.timing || ''} onChange={(e) => onUpdate(index, 'timing', e.target.value)}>
              <option value="">--</option>
              {TIMING_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Route">
            <select className={selectCls} value={med.route || 'oral'} onChange={(e) => onUpdate(index, 'route', e.target.value)}>
              {ROUTE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="Duration">
            <div className="flex items-center gap-1">
              <Input placeholder="7" type="number" className="h-8 w-10 min-w-0 flex-1 px-1 text-center text-xs" value={med.durationValue || ''} onChange={(e) => onUpdate(index, 'durationValue', e.target.value)} />
              <select className="h-8 w-16 shrink-0 rounded-md border border-input bg-background px-1 text-[11px]" value={med.durationUnit || 'days'} onChange={(e) => onUpdate(index, 'durationUnit', e.target.value)}>
                {DURATION_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </Field>
          <Field label="Qty">
            <QtyCell index={index} med={med} onUpdate={onUpdate} compact />
          </Field>
        </div>

        {/* Instructions — full width */}
        <div className="mt-2">
          <Field label="Instructions">
            <Input placeholder="e.g. Take after food, complete the course" className="h-8 text-xs" value={med.instructions || ''} onChange={(e) => onUpdate(index, 'instructions', e.target.value)} />
          </Field>
        </div>
      </div>
    </div>
  );
}
