import { calcQuantity } from '@/lib/dosage-calc';
import {
  encodeFrequency,
  encodeDuration,
  type MedicineFormData,
} from '@/components/doctor/consultation-completion/consultation-completion-schema';

// ---------------------------------------------------------------------------
// Turn the prescription pad's medicine rows into the payload POST /prescriptions
// expects.
//
// Shared because more than one surface writes a prescription — the IP
// prescription dialog and the IP progress note composer — and the dispense
// quantity must be computed the SAME way in each. A second copy of this that
// drifted would send the pharmacy a different number of tablets depending on
// which screen the doctor happened to use.
// ---------------------------------------------------------------------------

const ALLOWED_ROUTES = new Set([
  'oral',
  'iv',
  'im',
  'topical',
  'sublingual',
  'inhalation',
  'other',
]);

export interface PrescriptionItemPayload {
  drugId?: string;
  drugName: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  duration?: string;
  route: string;
  instructions?: string;
  doseQuantity: number;
  quantity?: number;
  isPrn: boolean;
}

/** Rows with no drug name are dropped — they are half-typed, not prescriptions. */
export function buildPrescriptionItems(medicines: MedicineFormData[]): PrescriptionItemPayload[] {
  return medicines
    .filter((m) => m.drugName.trim())
    .map((med) => {
      const durationUnit = med.durationUnit || 'days';
      // An explicitly typed quantity always wins over the M-A-N × duration
      // calculation — the doctor may be dispensing a part pack deliberately.
      const explicitQty =
        typeof med.quantity === 'number' && !Number.isNaN(med.quantity) && med.quantity > 0
          ? med.quantity
          : undefined;
      const autoQty = calcQuantity(med.frequency, med.durationValue, durationUnit, med.doseQuantity);
      const total = explicitQty ?? autoQty ?? undefined;
      const route = (med.route || 'oral').toLowerCase();
      return {
        drugId: med.drugId || undefined,
        drugName: med.drugName.trim(),
        genericName: med.genericName || undefined,
        // Dosage is required by the API — fall back to strength / name.
        dosage: (med.dosage || med.strength || med.drugName).trim(),
        // "1-0-1 - After Meal" / "As Needed (SOS)" / "Stat" — parseable downstream.
        frequency: encodeFrequency(med.frequency, med.timing, med.isPrn) || 'As directed',
        duration: med.durationValue ? encodeDuration(med.durationValue, durationUnit) : undefined,
        route: ALLOWED_ROUTES.has(route) ? route : 'other',
        instructions: med.instructions || undefined,
        doseQuantity: Number(med.doseQuantity) > 0 ? Number(med.doseQuantity) : 1,
        quantity: total != null ? Math.max(1, Math.round(total)) : undefined,
        isPrn: med.isPrn ?? false,
      };
    });
}
