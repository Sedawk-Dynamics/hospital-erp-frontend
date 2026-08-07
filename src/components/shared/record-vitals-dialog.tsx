'use client';

import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Activity } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useRecordVitals } from '@/hooks/use-nurse';
import { getApiErrorMessage } from '@/lib/utils';

/**
 * Vital-sign entry, shared by the nursing module and the doctor's consultation
 * / IP workspace. Nursing runs the routine rounds, but a doctor examining a
 * patient records their own reading here too — the backend stamps `recordedBy`
 * so authorship is never ambiguous.
 *
 * Exactly one encounter key (visitId / admissionId / appointmentId) should be
 * supplied; the backend resolves it to a Visit.
 */
export interface RecordVitalsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  visitId?: string;
  admissionId?: string;
  appointmentId?: string;
  patientName?: string;
  onRecorded?: () => void;
}

const EMPTY_FORM = {
  bloodPressureSystolic: '',
  bloodPressureDiastolic: '',
  temperature: '',
  pulseRate: '',
  respiratoryRate: '',
  oxygenSaturation: '',
  weightKg: '',
  heightCm: '',
  bloodSugar: '',
  notes: '',
};

type FormState = typeof EMPTY_FORM;

/**
 * Field rules mirror `recordVitalsSchema` on the server. They are repeated here
 * on purpose: the server answers a range or integer violation with a bare
 * "Validation error" 400, which reached the user as "Request failed with status
 * code 400" — no clue which box was wrong. Checking here names the field before
 * the request is ever made.
 */
const NUMERIC_FIELDS: {
  key: keyof FormState;
  label: string;
  unit: string;
  step?: string;
  min: number;
  max: number;
  /** The server rejects a decimal for these (`z.number().int()`). */
  integer?: boolean;
}[] = [
  { key: 'bloodPressureSystolic', label: 'BP Systolic', unit: 'mmHg', min: 0, max: 400, integer: true },
  { key: 'bloodPressureDiastolic', label: 'BP Diastolic', unit: 'mmHg', min: 0, max: 300, integer: true },
  { key: 'pulseRate', label: 'Pulse', unit: 'bpm', min: 0, max: 300, integer: true },
  { key: 'temperature', label: 'Temperature', unit: '°C', step: '0.1', min: 25, max: 50 },
  { key: 'respiratoryRate', label: 'Respiratory Rate', unit: '/min', min: 0, max: 100, integer: true },
  { key: 'oxygenSaturation', label: 'SpO₂', unit: '%', min: 0, max: 100 },
  { key: 'weightKg', label: 'Weight', unit: 'kg', step: '0.1', min: 0, max: 700 },
  { key: 'heightCm', label: 'Height', unit: 'cm', step: '0.1', min: 0, max: 300 },
  { key: 'bloodSugar', label: 'Blood Sugar', unit: 'mg/dL', min: 0, max: 2000 },
];

function parseNum(v: string): number | undefined {
  const n = parseFloat(v);
  return isNaN(n) ? undefined : n;
}

/**
 * An encounter key that arrived as an empty string is not a missing key — it is
 * a key the server will reject as a malformed uuid. Callers pass
 * `appointmentId={appointmentId || ''}` down through required-string props, so
 * a doctor recording vitals with no appointment in the URL sent `""` and got a
 * flat 400. Blank means absent.
 */
function cleanId(id?: string): string | undefined {
  const t = id?.trim();
  return t ? t : undefined;
}

const F_TO_C = (f: number) => Math.round(((f - 32) * 5) / 9 * 10) / 10;

export function RecordVitalsDialog({
  open,
  onOpenChange,
  patientId,
  visitId,
  admissionId,
  appointmentId,
  patientName,
  onRecorded,
}: RecordVitalsDialogProps) {
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  // Wards here record temperature in °F as often as °C, and the server only
  // accepts 25–50 (°C) — so 98.6 came back as a bare 400. Record in either and
  // convert on the way out; the stored value is always °C.
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C');
  const fieldIdPrefix = useId();
  const recordVitals = useRecordVitals();
  const queryClient = useQueryClient();

  const encounter = {
    visitId: cleanId(visitId),
    admissionId: cleanId(admissionId),
    appointmentId: cleanId(appointmentId),
  };
  const hasEncounter = Boolean(
    encounter.visitId || encounter.admissionId || encounter.appointmentId,
  );

  const set = (key: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const hasAnyReading = NUMERIC_FIELDS.some((f) => form[f.key].trim() !== '');

  const handleOpenChange = (next: boolean) => {
    if (!next) setForm({ ...EMPTY_FORM });
    onOpenChange(next);
  };

  /** Server-mirrored checks, so a bad box is named instead of 400ing blind. */
  const validate = (): string | null => {
    for (const f of NUMERIC_FIELDS) {
      const raw = form[f.key].trim();
      if (!raw) continue;
      const n = parseNum(raw);
      if (n === undefined) return `${f.label} is not a number`;
      if (f.key === 'temperature') continue; // range-checked after conversion
      if (f.integer && !Number.isInteger(n)) return `${f.label} must be a whole number`;
      if (n < f.min || n > f.max) return `${f.label} must be between ${f.min} and ${f.max} ${f.unit}`;
    }
    const t = temperatureCelsius();
    if (t !== undefined && (t < 25 || t > 50)) {
      return tempUnit === 'F'
        ? 'Temperature must be between 77 and 122 °F'
        : 'Temperature must be between 25 and 50 °C';
    }
    return null;
  };

  function temperatureCelsius(): number | undefined {
    const n = parseNum(form.temperature);
    if (n === undefined) return undefined;
    return tempUnit === 'F' ? F_TO_C(n) : n;
  }

  const handleSave = async () => {
    if (!patientId) {
      toast.error('Patient context is required to record vitals');
      return;
    }
    if (!hasEncounter) {
      toast.error('No visit, admission or appointment context for this reading');
      return;
    }
    if (!hasAnyReading) {
      toast.error('Enter at least one reading');
      return;
    }
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }

    try {
      await recordVitals.mutateAsync({
        patientId,
        ...encounter,
        temperature: temperatureCelsius(),
        bloodPressureSystolic: parseNum(form.bloodPressureSystolic),
        bloodPressureDiastolic: parseNum(form.bloodPressureDiastolic),
        pulseRate: parseNum(form.pulseRate),
        respiratoryRate: parseNum(form.respiratoryRate),
        oxygenSaturation: parseNum(form.oxygenSaturation),
        weightKg: parseNum(form.weightKg),
        heightCm: parseNum(form.heightCm),
        bloodSugar: parseNum(form.bloodSugar),
        notes: form.notes.trim() || undefined,
      });
      // The doctor-side panels read through their own query namespaces.
      queryClient.invalidateQueries({ queryKey: ['nurse'] });
      queryClient.invalidateQueries({ queryKey: ['doctor'] });
      toast.success('Vitals recorded');
      onRecorded?.();
      handleOpenChange(false);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to record vitals'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Record Vitals
          </DialogTitle>
          <DialogDescription>
            {patientName
              ? `New vital-sign reading for ${patientName}. Leave any field blank to skip it.`
              : 'New vital-sign reading. Leave any field blank to skip it.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {NUMERIC_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              {/* Tied to the input — these were bare siblings, so every vital
                  field was unlabelled to a screen reader. The unit switch sits
                  OUTSIDE the label: a button inside one steals the click. */}
              <div className="flex items-center gap-1">
                <Label
                  htmlFor={`${fieldIdPrefix}-${f.key}`}
                  className="font-label text-[11px] text-on-surface-variant"
                >
                  {f.label}{' '}
                  {f.key !== 'temperature' && <span className="text-outline">({f.unit})</span>}
                </Label>
                {f.key === 'temperature' && (
                  <span className="inline-flex overflow-hidden rounded border">
                    {(['C', 'F'] as const).map((u) => (
                      <button
                        key={u}
                        type="button"
                        aria-pressed={tempUnit === u}
                        onClick={() => setTempUnit(u)}
                        className={
                          tempUnit === u
                            ? 'bg-primary px-1.5 text-[10px] font-semibold text-on-primary'
                            : 'px-1.5 text-[10px] text-on-surface-variant hover:bg-surface-container'
                        }
                      >
                        °{u}
                      </button>
                    ))}
                  </span>
                )}
              </div>
              <Input
                id={`${fieldIdPrefix}-${f.key}`}
                type="number"
                inputMode="decimal"
                step={f.step ?? '1'}
                value={form[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                className="h-9"
              />
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <Label htmlFor={`${fieldIdPrefix}-notes`} className="font-label text-[11px] text-on-surface-variant">
            Notes
          </Label>
          <Textarea
            id={`${fieldIdPrefix}-notes`}
            rows={2}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Anything worth noting about this reading..."
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={recordVitals.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!hasAnyReading || recordVitals.isPending}>
            {recordVitals.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              'Save Vitals'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
