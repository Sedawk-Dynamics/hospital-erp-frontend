'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CompositionEditor, compositionPreview, parseCompositionText, emptySaltRow,
  type SaltRowInput,
} from './composition-editor';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from '@/components/ui/select';
import { getApiErrorMessage } from '@/lib/utils';
import {
  useCreateFormularyItem,
  useUpdateFormularyItem,
  useFormularyMatches,
  useInwardScan,
  isDuplicateSuspected,
  type FormularyItem,
  type FormularyMatch,
  type DosageForm,
  type CreateFormularyInput,
} from '@/hooks/use-pharmacy';
import { useDebounce } from '@/hooks/use-debounce';
import { useHsnGstRates, matchHsnGstRate } from '@/hooks/use-drug-master';
import { DrugDuplicateResolver } from '@/components/pharmacy/drug-duplicate-resolver';

const DOSAGE_FORMS: DosageForm[] = [
  'tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'other',
];

const CATEGORY_OPTIONS = [
  { value: 'drug', label: 'Medicine' },
  { value: 'consumable', label: 'Consumable' },
  { value: 'surgical_supply', label: 'Surgical Supply' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'other', label: 'Other' },
];

interface FormState {
  drugName: string;
  category: string;
  genericName: string;
  composition: string;
  manufacturer: string;
  dosageForm: string;
  strength: string;
  unitOfMeasurement: string;
  price: string;
  packSize: string;
  looseUnitLabel: string;
  taxPercent: string;
  minStock: string;
  gtin: string;
  hsnCode: string;
  indications: string;
  contraindications: string;
  isLifeSaving: boolean;
  isNarcotic: boolean;
  isReimbursable: boolean;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  drugName: '', category: 'drug', genericName: '', composition: '', manufacturer: '', dosageForm: '',
  strength: '', unitOfMeasurement: '', price: '', packSize: '', looseUnitLabel: '',
  taxPercent: '', minStock: '', gtin: '', hsnCode: '', indications: '', contraindications: '',
  isLifeSaving: false, isNarcotic: false, isReimbursable: true, isActive: true,
};

function formStateFromItem(item: FormularyItem): FormState {
  return {
    drugName: item.drugName,
    category: item.category ?? 'drug',
    genericName: item.genericName ?? '',
    composition: item.composition ?? '',
    manufacturer: item.manufacturer ?? '',
    dosageForm: item.dosageForm ?? '',
    strength: item.strength ?? '',
    unitOfMeasurement: item.unitOfMeasurement ?? '',
    price: item.price != null ? String(item.price) : '',
    packSize: item.packSize != null ? String(item.packSize) : '',
    looseUnitLabel: item.looseUnitLabel ?? '',
    taxPercent: item.taxPercent != null ? String(item.taxPercent) : '',
    minStock: item.minStock != null ? String(item.minStock) : '',
    gtin: item.gtin ?? '',
    hsnCode: item.hsnCode ?? '',
    indications: item.indications ?? '',
    contraindications: item.contraindications ?? '',
    isLifeSaving: item.isLifeSaving ?? false,
    isNarcotic: item.isNarcotic ?? false,
    isReimbursable: item.isReimbursable ?? true,
    isActive: item.isActive ?? true,
  };
}

function formStateToInput(form: FormState): CreateFormularyInput {
  const out: CreateFormularyInput = { drugName: form.drugName.trim() };
  if (form.category) out.category = form.category as CreateFormularyInput['category'];
  if (form.genericName.trim()) out.genericName = form.genericName.trim();
  if (form.composition.trim()) out.composition = form.composition.trim();
  if (form.manufacturer.trim()) out.manufacturer = form.manufacturer.trim();
  if (form.dosageForm) out.dosageForm = form.dosageForm as DosageForm;
  if (form.strength.trim()) out.strength = form.strength.trim();
  if (form.unitOfMeasurement.trim()) out.unitOfMeasurement = form.unitOfMeasurement.trim();
  if (form.price && !isNaN(parseFloat(form.price))) out.price = parseFloat(form.price);
  if (form.packSize && !isNaN(parseInt(form.packSize, 10))) out.packSize = parseInt(form.packSize, 10);
  if (form.looseUnitLabel.trim()) out.looseUnitLabel = form.looseUnitLabel.trim();
  if (form.taxPercent && !isNaN(parseFloat(form.taxPercent))) out.taxPercent = parseFloat(form.taxPercent);
  if (form.minStock && !isNaN(parseInt(form.minStock, 10))) out.minStock = parseInt(form.minStock, 10);
  if (form.gtin.trim()) out.gtin = form.gtin.trim();
  if (form.hsnCode.trim()) out.hsnCode = form.hsnCode.trim();
  if (form.indications.trim()) out.indications = form.indications.trim();
  if (form.contraindications.trim()) out.contraindications = form.contraindications.trim();
  out.isLifeSaving = form.isLifeSaving;
  out.isNarcotic = form.isNarcotic;
  out.isReimbursable = form.isReimbursable;
  out.isActive = form.isActive;
  return out;
}

// Multi-value input for generic names — a brand can map to more than one
// molecule. Stored as a comma-joined string in the single `genericName` column;
// this renders each as a removable chip.
function GenericNamesInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState('');
  const names = value.split(',').map((s) => s.trim()).filter(Boolean);

  const commit = () => {
    const t = draft.trim().replace(/,+$/, '').trim();
    if (t && !names.some((n) => n.toLowerCase() === t.toLowerCase())) {
      onChange([...names, t].join(', '));
    }
    setDraft('');
  };
  const remove = (n: string) => onChange(names.filter((x) => x !== n).join(', '));

  return (
    <div className="flex min-h-8 flex-wrap items-center gap-1 rounded-xl bg-surface-container-low px-2 py-1">
      {names.map((n) => (
        <span key={n} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
          {n}
          <button type="button" onClick={() => remove(n)} className="hover:opacity-70" aria-label={`Remove ${n}`}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
          else if (e.key === 'Backspace' && !draft && names.length) remove(names[names.length - 1]);
        }}
        onBlur={commit}
        placeholder={names.length ? 'Add another…' : 'e.g. Acetaminophen'}
        className="min-w-[110px] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-on-surface-variant/50"
      />
    </div>
  );
}

/**
 * Create / edit a formulary drug — the full master form (identity, pricing,
 * loose-unit, GTIN→auto-fill, HSN→GST, compliance flags) with a live
 * duplicate hint and the "use existing instead" resolver.
 *
 * Extracted from the old /inventory/drug-formulary page so the same form can be
 * mounted from the unified Storage list (which is now the single drug home).
 * `onUseExisting` lets the host add stock to a matched drug instead of creating
 * a duplicate.
 */
export function DrugFormDialog({
  open,
  drug,
  onOpenChange,
  onSaved,
  onUseExisting,
}: {
  open: boolean;
  drug?: FormularyItem | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  onUseExisting?: (match: FormularyMatch) => void;
}) {
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          {open && (
            <DrugForm
              drug={drug ?? null}
              onClose={() => onOpenChange(false)}
              onSaved={onSaved}
              onUseExisting={onUseExisting}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function DrugForm({
  drug,
  onClose,
  onSaved,
  onUseExisting,
}: {
  drug: FormularyItem | null;
  onClose: () => void;
  onSaved?: () => void;
  onUseExisting?: (match: FormularyMatch) => void;
}) {
  const editing = drug;
  const [formData, setFormData] = useState<FormState>(() =>
    drug ? formStateFromItem(drug) : EMPTY_FORM,
  );
  // Seeded from the stored composition text, so editing an existing drug opens
  // with its molecules already in rows rather than a string to re-type.
  const [saltRows, setSaltRows] = useState<SaltRowInput[]>(() => {
    const parsed = parseCompositionText(drug?.composition ?? '');
    return parsed.length ? parsed : [emptySaltRow()];
  });
  const [duplicate, setDuplicate] = useState<{ matches: FormularyMatch[] } | null>(null);

  const createItem = useCreateFormularyItem();
  const updateItem = useUpdateFormularyItem();
  const { data: hsnRates = [] } = useHsnGstRates();
  const inwardScan = useInwardScan();

  const updateField = (field: keyof FormState, value: string | boolean) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  // Live duplicate hint (create mode only).
  const debouncedName = useDebounce(formData.drugName, 400);
  const liveEnabled = !editing;
  const { data: liveMatches = [] } = useFormularyMatches(
    {
      name: debouncedName,
      genericName: formData.genericName || undefined,
      manufacturer: formData.manufacturer || undefined,
      strength: formData.strength || undefined,
      dosageForm: formData.dosageForm || undefined,
    },
    liveEnabled,
  );
  const topLiveMatch = liveEnabled && liveMatches.length && liveMatches[0].score >= 70 ? liveMatches[0] : null;

  const gstForHsnCode = (code: string): string => {
    const hit = matchHsnGstRate(code, hsnRates);
    return hit ? String(hit.gstRate) : '';
  };
  const updateHsn = (value: string) =>
    setFormData((prev) => {
      const next = { ...prev, hsnCode: value };
      const newGst = gstForHsnCode(value);
      if (newGst) next.taxPercent = newGst;
      return next;
    });

  const resolveGtin = async (code: string) => {
    const c = code.trim();
    if (!/^\d{8,14}$/.test(c) && !c.includes(String.fromCharCode(29))) return;
    try {
      const res = await inwardScan.mutateAsync(c);
      const L = res.line;
      if (res.resolvedVia === 'none' && !L.drugName) return;
      setFormData((prev) => {
        const next = { ...prev, gtin: res.gtin ?? c };
        if (!next.drugName.trim() && L.drugName) next.drugName = L.drugName;
        if (!next.genericName.trim() && L.genericName) next.genericName = L.genericName;
        if (!next.manufacturer.trim() && L.manufacturer) next.manufacturer = L.manufacturer;
        if (!next.strength.trim() && L.strength) next.strength = L.strength;
        if (!next.dosageForm.trim() && L.dosageForm) next.dosageForm = L.dosageForm;
        if (!next.packSize.trim() && L.packSize != null) next.packSize = String(L.packSize);
        if (!next.hsnCode.trim() && L.hsnCode) {
          next.hsnCode = L.hsnCode;
          if (!next.taxPercent.trim()) {
            const hit = matchHsnGstRate(L.hsnCode, hsnRates);
            if (hit) next.taxPercent = String(hit.gstRate);
          }
        }
        return next;
      });
      if (L.drugName) {
        const src =
          res.resolvedVia === 'formulary_gtin' ? 'your stock'
            : res.resolvedVia === 'drugmaster_gtin' ? 'the catalog'
              : 'the barcode';
        toast.success(`Filled from ${src}: ${L.drugName}`);
      }
    } catch {
      // Best-effort — leave the typed GTIN for manual completion.
    }
  };

  const doCreate = async (force: boolean) => {
    try {
      const payload = formStateToInput(formData);
      if (force) payload.force = true;
      const result = await createItem.mutateAsync(payload);
      if (isDuplicateSuspected(result)) {
        setDuplicate({ matches: result.matches });
        return;
      }
      toast.success('Drug added to formulary');
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to save drug'));
    }
  };

  const handleSubmit = async () => {
    if (!formData.drugName.trim()) {
      toast.error('Drug name is required');
      return;
    }
    if (editing) {
      try {
        await updateItem.mutateAsync({
          id: editing.id,
          ...formStateToInput(formData),
          gtin: formData.gtin.trim() || null,
        });
        toast.success('Drug updated');
        onSaved?.();
        onClose();
      } catch (err) {
        toast.error(getApiErrorMessage(err, 'Failed to save drug'));
      }
      return;
    }
    await doCreate(false);
  };

  const handleUseExisting = (m: FormularyMatch) => {
    setDuplicate(null);
    onClose();
    onUseExisting?.(m);
  };

  const pending = createItem.isPending || updateItem.isPending;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? 'Edit Drug' : 'Add Drug to Formulary'}</DialogTitle>
        <DialogDescription>
          {editing
            ? 'Update the drug details. Fields marked with * are required.'
            : 'Enter the drug details. Fields marked with * are required.'}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="drugName">Drug Name *</Label>
            <Input
              id="drugName"
              value={formData.drugName}
              onChange={(e) => updateField('drugName', e.target.value)}
              placeholder="e.g. Paracetamol 500mg"
            />
            {topLiveMatch && (
              <button
                type="button"
                onClick={() => handleUseExisting(topLiveMatch)}
                className="flex w-full items-start gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-left text-[11px] text-amber-700 hover:bg-amber-500/20"
              >
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                <span>
                  Possible duplicate: <span className="font-medium">{topLiveMatch.drugName}</span>{' '}
                  ({topLiveMatch.score}% · stock {topLiveMatch.totalStock}). Click to add stock to it instead.
                </span>
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="genericName">Generic Name(s)</Label>
            <GenericNamesInput value={formData.genericName} onChange={(v) => updateField('genericName', v)} />
            <p className="text-[10px] text-on-surface-variant">Add one or more — press Enter or comma after each.</p>
          </div>
        </div>

        {/* Composition — the salt composition, separate from the generic name(s).
            Entered as data (molecule / quantity / unit) rather than as a
            sentence, because that is how it is stored and how the schedule is
            decided. The text form is rendered from the rows. */}
        <CompositionEditor
          rows={saltRows}
          onChange={(rows) => {
            setSaltRows(rows);
            updateField('composition', compositionPreview(rows));
          }}
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={formData.category} onValueChange={(value) => updateField('category', value ?? 'drug')}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Dosage Form</Label>
            <Select value={formData.dosageForm} onValueChange={(value) => updateField('dosageForm', value ?? '')}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select form" /></SelectTrigger>
              <SelectContent>
                {DOSAGE_FORMS.map((form) => (<SelectItem key={form} value={form} className="capitalize">{form}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="strength">Strength</Label>
            <Input id="strength" value={formData.strength} onChange={(e) => updateField('strength', e.target.value)} placeholder="e.g. 500mg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="unitOfMeasurement">Unit</Label>
            <Input id="unitOfMeasurement" value={formData.unitOfMeasurement} onChange={(e) => updateField('unitOfMeasurement', e.target.value)} placeholder="e.g. Strip" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="price">Price / unit (₹)</Label>
            <Input id="price" type="number" step="0.01" value={formData.price} onChange={(e) => updateField('price', e.target.value)} placeholder="0.00" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="packSize">Pack Size</Label>
            <Input id="packSize" type="number" min={1} value={formData.packSize} onChange={(e) => updateField('packSize', e.target.value)} placeholder="e.g. 10 (tabs/strip)" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="looseUnitLabel">Loose Unit</Label>
            <Input id="looseUnitLabel" value={formData.looseUnitLabel} onChange={(e) => updateField('looseUnitLabel', e.target.value)} placeholder="e.g. Tablet" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="taxPercent">GST %</Label>
            <Input id="taxPercent" type="number" step="0.01" value={formData.taxPercent} onChange={(e) => updateField('taxPercent', e.target.value)} placeholder="12" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="manufacturer">Manufacturer</Label>
            <Input id="manufacturer" value={formData.manufacturer} onChange={(e) => updateField('manufacturer', e.target.value)} placeholder="Company name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="minStock">Reorder Level</Label>
            <Input id="minStock" type="number" min={0} value={formData.minStock} onChange={(e) => updateField('minStock', e.target.value)} placeholder="e.g. 20" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="gtin">GTIN / Barcode</Label>
            <Input
              id="gtin"
              className="font-mono"
              value={formData.gtin}
              onChange={(e) => updateField('gtin', e.target.value)}
              onBlur={(e) => resolveGtin(e.target.value)}
              placeholder="e.g. 8901234567890 → auto-fills"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hsnCode">HSN Code</Label>
            <Input id="hsnCode" className="font-mono" value={formData.hsnCode} onChange={(e) => updateHsn(e.target.value)} placeholder="e.g. 3004" />
            {(() => {
              const hit = matchHsnGstRate(formData.hsnCode, hsnRates);
              return hit ? (
                <p className="text-[11px] leading-tight text-primary">
                  {hit.gstRate}% GST{hit.description ? ` · ${hit.description}` : ''}
                </p>
              ) : null;
            })()}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="indications">Indications</Label>
          <Textarea id="indications" value={formData.indications} onChange={(e) => updateField('indications', e.target.value)} placeholder="Conditions this drug treats..." rows={2} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contraindications">Contraindications</Label>
          <Textarea id="contraindications" value={formData.contraindications} onChange={(e) => updateField('contraindications', e.target.value)} placeholder="When this drug should NOT be used..." rows={2} />
        </div>
        <label className="flex items-start gap-2 rounded-md border p-2.5 text-sm">
          <input type="checkbox" className="mt-0.5" checked={formData.isLifeSaving} onChange={(e) => updateField('isLifeSaving', e.target.checked)} />
          <span>
            <span className="font-medium">Vital / life-saving drug</span>
            <span className="block text-[11px] text-muted-foreground">
              Bypasses the IP cash-patient credit-clearance gate so emergency dosing is never withheld for money.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 rounded-md border p-2.5 text-sm">
          <input type="checkbox" className="mt-0.5" checked={formData.isNarcotic} onChange={(e) => updateField('isNarcotic', e.target.checked)} />
          <span>
            <span className="font-medium">NDPS narcotic drug</span>
            <span className="block text-[11px] text-muted-foreground">
              Governs this drug under the narcotic accounting workflow (Form 3C/3E/3H, vault custody, dual-auth).
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 rounded-md border p-2.5 text-sm">
          <input type="checkbox" className="mt-0.5" checked={formData.isReimbursable} onChange={(e) => updateField('isReimbursable', e.target.checked)} />
          <span>
            <span className="font-medium">TPA reimbursable</span>
            <span className="block text-[11px] text-muted-foreground">
              Claimed from the insurer/TPA for cashless patients. Uncheck for disposables/consumables the patient pays out-of-pocket.
            </span>
          </span>
        </label>
        {editing && (
          <label className="flex items-start gap-2 rounded-md border p-2.5 text-sm">
            <input type="checkbox" className="mt-0.5" checked={formData.isActive} onChange={(e) => updateField('isActive', e.target.checked)} />
            <span>
              <span className="font-medium">Available for prescribing / dispensing</span>
              <span className="block text-[11px] text-muted-foreground">
                Uncheck to retire the drug — it stays on record but stops appearing in search, prescribing and the POS.
              </span>
            </span>
          </label>
        )}
        <p className="text-[11px] text-muted-foreground">
          Supplier and batch-level info (mfg date, expiry, batch qty) are managed under Batches.
        </p>
      </div>

      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button onClick={handleSubmit} disabled={pending}>
          {pending ? 'Saving...' : editing ? 'Save Changes' : 'Add Drug'}
        </Button>
      </DialogFooter>

      {/* Server flagged a likely duplicate on create — offer to map onto it. */}
      {duplicate && (
        <DrugDuplicateResolver
          open
          onOpenChange={(o) => !o && setDuplicate(null)}
          incoming={{
            drugName: formData.drugName,
            genericName: formData.genericName || undefined,
            manufacturer: formData.manufacturer || undefined,
            strength: formData.strength || undefined,
            dosageForm: formData.dosageForm || undefined,
          }}
          matches={duplicate.matches}
          onUseExisting={handleUseExisting}
          onCreateAnyway={() => { setDuplicate(null); void doCreate(true); }}
          creating={createItem.isPending}
        />
      )}
    </>
  );
}
