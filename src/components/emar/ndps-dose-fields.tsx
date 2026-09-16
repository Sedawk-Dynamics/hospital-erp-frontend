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
  quantityUnit: 'mL',
  containerQuantity: '1',
  residualHandling: '' as '' | 'pending_destruction' | 'sealed_quarantine',
  quarantineLocation: '',
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

export function buildNdpsPatientDose(context: NdpsDoseContext | undefined, form: NdpsDoseForm): NdpsPatientDoseInput | undefined {
  if (!context?.isNdps) return undefined;
  if (context.existingDose) return undefined;
  const labelledQuantity = Number(form.labelledQuantity);
  const administeredQuantity = Number(form.administeredQuantity);
  const containerQuantity = Number(form.containerQuantity);
  const drugBatchId = effectiveNdpsBatch(context, form);
  const ndpsLocationId = effectiveNdpsLocation(context, form);
  if (!drugBatchId) throw new Error('Select the exact batch/container used.');
  if (!ndpsLocationId) throw new Error('Select the NDPS custody location.');
  if (!(labelledQuantity > 0)) throw new Error('Enter the quantity printed on the container label.');
  if (!(administeredQuantity > 0)) throw new Error('Enter the quantity actually administered.');
  if (administeredQuantity > labelledQuantity) throw new Error('Administered quantity cannot exceed labelled quantity.');
  if (!Number.isInteger(containerQuantity) || containerQuantity <= 0) throw new Error('Container count must be a positive whole number.');
  if (!form.quantityUnit.trim()) throw new Error('Enter the quantity unit.');
  const residual = Math.round((labelledQuantity - administeredQuantity) * 10_000) / 10_000;
  const disposition = residual === 0 ? 'none' : 'quarantined';
  if (residual > 0 && !form.residualHandling) {
    throw new Error('Choose whether the remainder should be destroyed or sealed and quarantined.');
  }
  if (residual > 0 && form.residualHandling === 'sealed_quarantine' && !form.quarantineLocation.trim()) {
    throw new Error('Record where the sealed residual will be quarantined.');
  }
  if (context.requiresEmergencyReason && !form.emergencyReason.trim()) {
    throw new Error('Enter why emergency stock was used without a linked pharmacy issue.');
  }
  return {
    drugBatchId,
    ndpsLocationId,
    labelledQuantity,
    administeredQuantity,
    quantityUnit: form.quantityUnit.trim(),
    containerQuantity,
    disposition,
    residualHandling: residual > 0 ? form.residualHandling || undefined : undefined,
    quarantineLocation: residual > 0 && form.residualHandling === 'sealed_quarantine'
      ? form.quarantineLocation.trim()
      : undefined,
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
  const labelled = Number(value.labelledQuantity);
  const administered = Number(value.administeredQuantity);
  const residual = labelled > 0 && administered > 0 && administered <= labelled
    ? Math.round((labelled - administered) * 10_000) / 10_000
    : null;
  const clinical = context.clinicalDetails;
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
            Record what was given and what remains, then select the required handling instruction.
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
          <Input type="number" min="0" step="any" value={value.labelledQuantity} onChange={(event) => set('labelledQuantity', event.target.value)} placeholder="e.g. 2" />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Actually given *</Label>
            <Input type="number" min="0" step="any" value={value.administeredQuantity} onChange={(event) => set('administeredQuantity', event.target.value)} placeholder="e.g. 0.5" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Unit *</Label>
            <Input value={value.quantityUnit} onChange={(event) => set('quantityUnit', event.target.value)} placeholder="mL" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-lg border bg-background p-2 text-center text-xs">
        <div><span className="block text-muted-foreground">Labelled</span><b>{labelled > 0 ? labelled : '-'} {value.quantityUnit}</b></div>
        <div><span className="block text-muted-foreground">Given</span><b>{administered > 0 ? administered : '-'} {value.quantityUnit}</b></div>
        <div><span className="block text-muted-foreground">Remaining (not given)</span><b className={residual && residual > 0 ? 'text-red-700' : ''}>{residual ?? '-'} {value.quantityUnit}</b></div>
      </div>

      {residual !== null && residual > 0 && (
        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-950">Select one *</p>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background p-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-red-700"
              checked={value.residualHandling === 'pending_destruction'}
              onChange={() => set('residualHandling', 'pending_destruction')}
            />
            <span>
              <span className="block text-xs font-semibold">It should be destroyed</span>
              <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                Sends the remainder to Inventory - Stock Transfer - Patient residual disposal. Authorised staff record the witnessed destruction there.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background p-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-amber-700"
              checked={value.residualHandling === 'sealed_quarantine'}
              onChange={() => set('residualHandling', 'sealed_quarantine')}
            />
            <span>
              <span className="block text-xs font-semibold">Seal and quarantine the remainder</span>
              <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                Keep it sealed in secure NDPS storage and record the exact location below.
              </span>
            </span>
          </label>
          {value.residualHandling === 'sealed_quarantine' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Sealed quarantine location *</Label>
              <Input value={value.quarantineLocation} onChange={(event) => set('quarantineLocation', event.target.value)} placeholder="e.g. ICU narcotic safe - residual bin A" />
            </div>
          )}
          {value.residualHandling === 'pending_destruction' && (
            <p className="rounded-md border border-red-200 bg-red-50 p-2 text-[11px] leading-4 text-red-800">
              This is only a destruction request. The remainder stays in the selected NDPS custody location until authorised disposal is completed.
            </p>
          )}
        </div>
      )}

      {context.requiresEmergencyReason && (
        <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <Label className="text-xs text-amber-900">Emergency stock reason *</Label>
          <Textarea value={value.emergencyReason} onChange={(event) => set('emergencyReason', event.target.value)} rows={2} placeholder="Why treatment could not wait for patient-specific pharmacy issue" />
          <p className="text-[10px] text-amber-800">This is billed and moved from the selected ward/batch when the dose is confirmed.</p>
        </div>
      )}

      {clinical && (!clinical.doctorRegistration || !clinical.diagnosis) && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
          Complete the prescriber registration number and diagnosis/clinical justification in the patient record before confirming Form 3E.
        </p>
      )}
    </div>
  );
}
