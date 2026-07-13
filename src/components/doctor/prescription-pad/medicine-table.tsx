'use client';

import { useCallback, useState } from 'react';
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
 * Shared, controlled medicine table — the same M-A-N dose / frequency / timing /
 * duration / auto-Qty capture the OP prescription pad uses, extracted so the IP
 * prescription flow writes medicines identically (and the auto-computed Qty
 * reaches the pharmacy). Operates on a plain MedicineFormData[] + onChange, so
 * it works outside react-hook-form.
 *
 * Column grid (scrolls horizontally on narrow dialogs):
 *   Medicine · Dose · Frequency · Timing · Route · Duration · Qty · Instructions · ✕
 */
const GRID = 'grid grid-cols-[minmax(150px,2fr)_84px_92px_100px_84px_92px_60px_minmax(110px,1fr)_30px] gap-0';

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
          <div className="overflow-x-auto rounded-lg border">
            <div className="min-w-[880px]">
              <div className={cn(GRID, 'border-b bg-muted/50 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider')}>
                <div className="px-3 py-2">Medicine</div>
                <div className="px-2 py-2" title="Units taken per intake (default 1)">Dose</div>
                <div className="px-2 py-2">Frequency</div>
                <div className="px-2 py-2">Timing</div>
                <div className="px-2 py-2">Route</div>
                <div className="px-2 py-2">Duration</div>
                <div className="px-2 py-2" title="Total units = dose pattern × duration × dose">Qty</div>
                <div className="px-2 py-2">Instructions</div>
                <div className="px-1 py-2" />
              </div>
              {medicines.map((med, index) => (
                <MedRow
                  key={index}
                  index={index}
                  med={med}
                  patientId={patientId}
                  onUpdate={updateField}
                  onRemove={() => removeAt(index)}
                />
              ))}
            </div>
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
                    {drug.source === 'master' && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground border-muted-foreground/30 shrink-0">
                        catalog
                      </Badge>
                    )}
                    {drug.id == null && drug.source !== 'master' && (
                      <span className="ml-auto text-[10px] text-amber-600 shrink-0">not stocked</span>
                    )}
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

function MedRow({ index, med, patientId, onUpdate, onRemove }: {
  index: number; med: MedicineFormData; patientId: string;
  onUpdate: (i: number, f: keyof MedicineFormData, v: any) => void; onRemove: () => void;
}) {
  const { data: allergyResult } = useAllergyCheck(patientId, med?.drugName);
  const badge = getDosageFormBadge(med?.dosageForm);
  if (!med) return null;

  const selectCls = 'flex h-7 w-full rounded-md border border-dashed border-input bg-background px-1 text-[11px]';

  return (
    <div className="group">
      {allergyResult?.hasAllergy && (
        <div className="flex items-center gap-2 bg-error/10 border-b border-error/30 px-3 py-1">
          <AlertTriangle className="h-3 w-3 text-error" />
          <span className="text-[11px] text-error font-medium">
            Allergy: {allergyResult.matchedAllergies.map((a) => a.allergen).join(', ')}
          </span>
        </div>
      )}
      <div className={cn(GRID, 'border-b last:border-b-0 hover:bg-accent/20 transition-colors')}>
        <div className="px-3 py-2 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium truncate">{med.drugName}</span>
            {badge && <Badge variant="secondary" className="text-[8px] font-bold px-1 py-0">{badge}</Badge>}
            {!med.drugId && <span className="text-[9px] text-amber-600 shrink-0">free-text</span>}
          </div>
          {med.genericName && (
            <p className="text-[9px] text-muted-foreground uppercase truncate">
              {med.genericName} {med.strength && `(${med.strength})`}
            </p>
          )}
        </div>
        <div className="px-1 py-1.5">
          <div className="flex items-center gap-0.5">
            <Input
              type="number" min={0} step="0.5" placeholder="1"
              title="Units per intake (default 1) — multiplied into Qty"
              className="h-7 w-10 px-1 text-center text-[11px] border-dashed"
              value={med.doseQuantity ?? 1}
              onChange={(e) => onUpdate(index, 'doseQuantity', e.target.value === '' ? 1 : Number(e.target.value))}
            />
            <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{getDoseUnitLabel(med.dosageForm)}</span>
          </div>
        </div>
        <div className="px-1 py-1.5">
          <select
            className={selectCls}
            value={med.frequency || ''}
            onChange={(e) => { onUpdate(index, 'frequency', e.target.value); onUpdate(index, 'isPrn', e.target.value === 'SOS'); }}
          >
            <option value="">--</option>
            {FREQUENCY_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="px-1 py-1.5">
          <select className={selectCls} value={med.timing || ''} onChange={(e) => onUpdate(index, 'timing', e.target.value)}>
            <option value="">--</option>
            {TIMING_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="px-1 py-1.5">
          <select className={selectCls} value={med.route || 'oral'} onChange={(e) => onUpdate(index, 'route', e.target.value)}>
            {ROUTE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div className="px-1 py-1.5 flex gap-0.5">
          <Input placeholder="7" type="number" className="h-7 text-[11px] border-dashed w-10 px-1" value={med.durationValue || ''} onChange={(e) => onUpdate(index, 'durationValue', e.target.value)} />
          <select className="flex h-7 rounded-md border border-dashed border-input bg-background px-0.5 text-[10px] w-12" value={med.durationUnit || 'days'} onChange={(e) => onUpdate(index, 'durationUnit', e.target.value)}>
            {DURATION_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="px-1 py-1.5">
          <QtyCell index={index} med={med} onUpdate={onUpdate} compact />
        </div>
        <div className="px-1 py-1.5">
          <Input placeholder="Instructions" className="h-7 text-[11px] border-dashed" value={med.instructions || ''} onChange={(e) => onUpdate(index, 'instructions', e.target.value)} />
        </div>
        <div className="px-0.5 py-1.5 flex items-center">
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 opacity-60 group-hover:opacity-100 text-muted-foreground hover:text-error" onClick={onRemove}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
