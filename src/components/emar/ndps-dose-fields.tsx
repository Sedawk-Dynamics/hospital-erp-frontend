'use client';

import type { Dispatch, SetStateAction } from 'react';
import { ShieldAlert } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { NdpsDoseContext, NdpsPatientDoseInput } from '@/hooks/use-emar';

export const EMPTY_NDPS_FORM = {
  drugBatchId: '',
  ndpsLocationId: '',
  labelledQuantity: '',
  administeredQuantity: '',
  quantityUnit: '',
  containerQuantity: '1',
  emergencyReason: '',
  notes: '',
};

export type NdpsDoseForm = typeof EMPTY_NDPS_FORM;

export function effectiveNdpsBatch(context: NdpsDoseContext, value: NdpsDoseForm) {
  return value.drugBatchId || context.linkedBatchId || context.batches?.[0]?.id || '';
}

export function effectiveNdpsLocation(context: NdpsDoseContext, value: NdpsDoseForm) {
  if (value.ndpsLocationId) return value.ndpsLocationId;
  const locations = context.locations ?? [];
  return locations.find((location) => location.preferred && location.availableContainers > 0)?.id
    ?? locations.find((location) => location.availableContainers > 0)?.id
    ?? locations[0]?.id
    ?? '';
}

export function effectiveLabelledQuantity(context: NdpsDoseContext, value: NdpsDoseForm) {
  return value.labelledQuantity || (context.labelledContents?.quantity
    ? String(context.labelledContents.quantity)
    : '');
}

export function effectiveQuantityUnit(context: NdpsDoseContext, value: NdpsDoseForm) {
  return value.quantityUnit || context.labelledContents?.unit || 'mL';
}

export function buildNdpsPatientDose(context: NdpsDoseContext | undefined, form: NdpsDoseForm): NdpsPatientDoseInput | undefined {
  if (!context?.isNdps) return undefined;
  if (context.existingDose) return undefined;
  const labelledQuantity = Number(effectiveLabelledQuantity(context, form));
  const administeredQuantity = Number(form.administeredQuantity);
  const containerQuantity = Number(form.containerQuantity);
  const quantityUnit = effectiveQuantityUnit(context, form);
  const drugBatchId = effectiveNdpsBatch(context, form);
  const ndpsLocationId = effectiveNdpsLocation(context, form);
  if (!drugBatchId) throw new Error('Select the exact batch/container used.');
  if (!ndpsLocationId) throw new Error('Select the NDPS custody location.');
  if (!(labelledQuantity > 0)) throw new Error('Enter the quantity printed on the container label.');
  if (!(administeredQuantity > 0)) throw new Error('Enter the quantity actually administered.');
  if (administeredQuantity > labelledQuantity) throw new Error('Administered quantity cannot exceed labelled quantity.');
  if (!Number.isInteger(containerQuantity) || containerQuantity <= 0) throw new Error('Container count must be a positive whole number.');
  if (!quantityUnit.trim()) throw new Error('Enter the quantity unit.');
  const residual = Math.round((labelledQuantity - administeredQuantity) * 10_000) / 10_000;
  const disposition = residual === 0 ? 'none' : 'quarantined';
  if (context.requiresEmergencyReason && !form.emergencyReason.trim()) {
    throw new Error('Enter why emergency stock was used without a linked pharmacy issue.');
  }
  return {
    drugBatchId,
    ndpsLocationId,
    labelledQuantity,
    administeredQuantity,
    quantityUnit: quantityUnit.trim(),
    containerQuantity,
    disposition,
    // Bedside staff only record what was administered. Any positive remainder
    // is routed to the existing authorised disposal worklist automatically.
    residualHandling: residual > 0 ? 'pending_destruction' : undefined,
    emergencyUse: Boolean(context.requiresEmergencyReason),
    emergencyReason: form.emergencyReason.trim() || undefined,
    notes: form.notes.trim() || undefined,
  };
}

export function NdpsDoseFields({
  context,
  value,
  onChange,
}: {
  context: NdpsDoseContext;
  value: NdpsDoseForm;
  onChange: Dispatch<SetStateAction<NdpsDoseForm>>;
}) {
  const set = (key: keyof NdpsDoseForm, next: string) =>
    onChange((current) => ({ ...current, [key]: next }));
  const labelledQuantityValue = effectiveLabelledQuantity(context, value);
  const quantityUnit = effectiveQuantityUnit(context, value);
  const labelled = Number(labelledQuantityValue);
  const administered = Number(value.administeredQuantity);
  const residual = labelled > 0 && administered > 0 && administered <= labelled
    ? Math.round((labelled - administered) * 10_000) / 10_000
    : null;
  const selectedBatchId = effectiveNdpsBatch(context, value);
  const selectedLocationId = effectiveNdpsLocation(context, value);

  return (
    <div className="space-y-4 rounded-xl border border-red-200 bg-red-50/40 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700">
          <ShieldAlert className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-red-950">NDPS patient-dose reconciliation</p>
          <p className="mt-0.5 text-xs leading-5 text-red-800">
            Record what was given and what remains. Any remainder is sent to the authorised disposal worklist automatically.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Batch / container *</Label>
          <Select value={selectedBatchId} onValueChange={(next) => next && set('drugBatchId', next)}>
            <SelectTrigger className="w-full min-w-0">
              <SelectValue placeholder="Select exact batch" />
            </SelectTrigger>
            <SelectContent>
              {(context.batches ?? []).map((batch) => (
                <SelectItem key={batch.id} value={batch.id} disabled={batch.quantityInStock <= 0 && batch.id !== context.linkedBatchId}>
                  {batch.batchNumber} - exp {new Date(batch.expiryDate).toLocaleDateString()}
                  {batch.id === context.linkedBatchId ? ' - linked issue' : ` - ${batch.quantityInStock} available`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Custody location *</Label>
          <Select value={selectedLocationId} onValueChange={(next) => next && set('ndpsLocationId', next)}>
            <SelectTrigger className="w-full min-w-0">
              <SelectValue placeholder="Select safe / ward cart" />
            </SelectTrigger>
            <SelectContent>
              {(context.locations ?? []).map((location) => (
                <SelectItem key={location.id} value={location.id} disabled={location.availableContainers <= 0}>
                  {location.name} - {location.availableContainers} container(s){location.preferred ? ' - current ward' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Labelled contents *</Label>
          <Input
            type="number"
            min="0"
            step="any"
            value={labelledQuantityValue}
            readOnly
            aria-readonly="true"
            className="cursor-not-allowed bg-surface-container-high text-on-surface-variant"
            placeholder="Not available"
          />
          <p className={`text-[10px] ${context.labelledContents ? 'text-muted-foreground' : 'text-red-700'}`}>
            {context.labelledContents
              ? `Locked from drug strength: ${context.labelledContents.sourceText}`
              : 'Labelled contents are unavailable. Update the drug strength in the formulary.'}
          </p>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Actually given *</Label>
            <Input type="number" min="0" step="any" value={value.administeredQuantity} onChange={(event) => set('administeredQuantity', event.target.value)} placeholder="e.g. 0.5" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Unit *</Label>
            <Input value={quantityUnit} onChange={(event) => set('quantityUnit', event.target.value)} placeholder="mL" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-lg border bg-background p-2 text-center text-xs">
        <div><span className="block text-muted-foreground">Labelled</span><b>{labelled > 0 ? labelled : '-'} {quantityUnit}</b></div>
        <div><span className="block text-muted-foreground">Given</span><b>{administered > 0 ? administered : '-'} {quantityUnit}</b></div>
        <div><span className="block text-muted-foreground">Remaining (not given)</span><b className={residual && residual > 0 ? 'text-red-700' : ''}>{residual ?? '-'} {quantityUnit}</b></div>
      </div>

      {context.requiresEmergencyReason && (
        <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <Label className="text-xs text-amber-900">Emergency stock reason *</Label>
          <Textarea value={value.emergencyReason} onChange={(event) => set('emergencyReason', event.target.value)} rows={2} placeholder="Why treatment could not wait for patient-specific pharmacy issue" />
          <p className="text-[10px] text-amber-800">This is billed and moved from the selected ward/batch when the dose is confirmed.</p>
        </div>
      )}

    </div>
  );
}
