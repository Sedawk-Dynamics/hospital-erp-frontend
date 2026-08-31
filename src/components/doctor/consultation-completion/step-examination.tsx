'use client';

import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Activity, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useLatestVitals } from '@/hooks/use-nurse';
import { RecordVitalsDialog } from '@/components/shared/record-vitals-dialog';
import { NurseIntakeComplaint } from '@/components/doctor/nurse-intake-complaint';
import { DiagnosisNameField } from '@/components/clinical/diagnosis-name-field';
import { IcdCodeCombobox } from '@/components/clinical/icd-code-combobox';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import type { ConsultationFormData } from './consultation-completion-schema';
import { temperatureIn, temperatureUnitLabel } from '@/lib/vitals-temperature';
import { useTemperatureUnit } from '@/stores/temperature-unit-store';

interface StepExaminationProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<ConsultationFormData, any, any>;
  patientId?: string;
  /** Encounter key for a vitals reading taken during this consultation. */
  appointmentId?: string;
  visitId?: string;
}

export function StepExamination({ form, patientId, appointmentId, visitId }: StepExaminationProps) {
  const { register, formState: { errors }, control, watch, setValue } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'diagnoses',
  });

  return (
    <div className="space-y-6">
      {/* ── Chief Complaint ── */}
      <div className="space-y-2">
        <Label htmlFor="chiefComplaint" className="text-sm font-semibold">
          Chief Complaint
        </Label>
        <textarea
          id="chiefComplaint"
          {...register('chiefComplaint')}
          placeholder="Patient's main complaint / reason for visit..."
          rows={2}
          className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
        />
        {errors.chiefComplaint && (
          <p className="text-xs text-error">{errors.chiefComplaint.message}</p>
        )}
        {/* What nursing was told at the door. Read-only here — pressing "Use
            this" copies it into the box above, which the doctor then rewrites
            in their own words; the nurse's record is left as recorded. */}
        <NurseIntakeComplaint
          visitId={visitId}
          currentValue={watch('chiefComplaint') ?? ''}
          onUse={(text) => setValue('chiefComplaint', text, { shouldDirty: true })}
        />
      </div>

      {/* ── Examination Notes ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="generalExamination" className="text-sm font-semibold">
            General Examination
          </Label>
          <textarea
            id="generalExamination"
            {...register('generalExamination')}
            placeholder="General appearance, consciousness, pallor, icterus, cyanosis, edema..."
            rows={3}
            className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="systemicExamination" className="text-sm font-semibold">
            Systemic Examination
          </Label>
          <textarea
            id="systemicExamination"
            {...register('systemicExamination')}
            placeholder="CVS, RS, P/A, CNS findings..."
            rows={3}
            className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
          />
        </div>
      </div>

      <Separator />

      {/* ── Vital Signs ── */}
      <VitalsPanel patientId={patientId} appointmentId={appointmentId} visitId={visitId} />

      <Separator />

      {/* ── Diagnoses ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            Diagnosis
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 h-7 text-xs"
            onClick={() => append({ icdCode: '', diagnosisName: '', diagnosisType: 'secondary' })}
          >
            <Plus className="h-3 w-3" />
            Add Diagnosis
          </Button>
        </div>

        {errors.diagnoses?.message && (
          <p className="text-xs text-error">{errors.diagnoses.message}</p>
        )}

        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3">
              <div className="grid flex-1 grid-cols-1 sm:grid-cols-[140px_1fr_140px] gap-2">
                <div>
                  {/* Search by CODE, the same picker the prescription pad uses.
                      This was a bare text box, so the code had to be known and
                      typed by hand — which in practice left it blank. */}
                  <IcdCodeCombobox
                    triggerSize="sm"
                    className="w-full"
                    value={watch(`diagnoses.${index}.icdCode`) || null}
                    onSelect={(icd) => {
                      setValue(`diagnoses.${index}.icdCode`, icd?.code ?? '', { shouldDirty: true });
                      if (icd) {
                        setValue(`diagnoses.${index}.diagnosisName`, icd.title, { shouldDirty: true });
                      }
                    }}
                    placeholder="ICD code"
                  />
                </div>
                <div>
                  {/* Type the diagnosis; picking a suggestion fills the ICD
                      code box beside it. The code was hand-typed before, which
                      in practice meant it was left blank. */}
                  <DiagnosisNameField
                    form={form}
                    index={index}
                    inputClassName="h-8 text-xs"
                    placeholder="Diagnosis name"
                  />
                  {errors.diagnoses?.[index]?.diagnosisName && (
                    <p className="text-[10px] text-error mt-0.5">
                      {errors.diagnoses[index].diagnosisName?.message}
                    </p>
                  )}
                </div>
                <div>
                  <select
                    className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    {...register(`diagnoses.${index}.diagnosisType`)}
                  >
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                    <option value="differential">Differential</option>
                  </select>
                </div>
              </div>
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-error shrink-0"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Vital signs panel ──────────────────────────────────────
//
// Shows the latest reading (whoever took it — nurse or doctor) and lets the
// examining doctor record a fresh one inline. Readings are append-only and each
// stores its author, so the nursing round history stays intact.

function VitalsPanel({
  patientId,
  appointmentId,
  visitId,
}: {
  patientId?: string;
  appointmentId?: string;
  visitId?: string;
}) {
  const [recordOpen, setRecordOpen] = useState(false);
  const { data: latestResp, isLoading } = useLatestVitals(patientId ?? '');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = (latestResp as any)?.data ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recorder = v?.recorder as { firstName?: string; lastName?: string } | undefined;
  const recorderName = recorder
    ? [recorder.firstName, recorder.lastName].filter(Boolean).join(' ').trim() || 'Clinical staff'
    : null;

  // A reading needs an encounter to hang off; without one the backend can't
  // resolve a Visit, so hide the action rather than fail on submit.
  const canRecord = Boolean(patientId && (appointmentId || visitId));
  const [tempUnit] = useTemperatureUnit();

  const tiles = v
    ? [
        {
          label: 'Temp',
          // Stored Celsius, shown in the clinician's chosen unit.
          value: temperatureIn(v.temperature, tempUnit),
          unit: temperatureUnitLabel(tempUnit),
        },
        {
          label: 'BP',
          value:
            v.bloodPressureSystolic && v.bloodPressureDiastolic
              ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`
              : null,
          unit: 'mmHg',
        },
        { label: 'Pulse', value: v.pulseRate ?? v.heartRate ?? null, unit: 'bpm' },
        { label: 'RR', value: v.respiratoryRate ?? null, unit: '/min' },
        { label: 'SpO₂', value: v.oxygenSaturation ?? null, unit: '%' },
        { label: 'Weight', value: v.weightKg ?? v.weight ?? null, unit: 'kg' },
        { label: 'Height', value: v.heightCm ?? v.height ?? null, unit: 'cm' },
        { label: 'BGL', value: v.bloodSugar ?? null, unit: 'mg/dL' },
      ].filter((t) => t.value !== null && t.value !== undefined && t.value !== '')
    : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Vital Signs
        </h3>
        {canRecord && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-[11px]"
            onClick={() => setRecordOpen(true)}
          >
            <Plus className="h-3 w-3" />
            Record Vitals
          </Button>
        )}
      </div>

      {canRecord && (
        <RecordVitalsDialog
          open={recordOpen}
          onOpenChange={setRecordOpen}
          patientId={patientId!}
          appointmentId={appointmentId}
          visitId={visitId}
        />
      )}

      {!patientId ? (
        <p className="text-xs text-muted-foreground">
          Patient context is required to load vitals.
        </p>
      ) : isLoading ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading latest vitals…
        </div>
      ) : !v ? (
        <p className="text-xs text-muted-foreground">
          No vitals recorded yet for this patient.
        </p>
      ) : tiles.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          The latest reading has no numeric values on file.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-outline-variant/40 bg-muted/40 p-3">
            {tiles.map((t) => (
              <div
                key={t.label}
                className="flex items-baseline gap-1 rounded-md bg-background/70 px-2.5 py-1.5"
              >
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t.label}
                </span>
                <span className="text-sm font-bold">{String(t.value)}</span>
                <span className="text-[10px] text-muted-foreground">{t.unit}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {recorderName ? `Recorded by ${recorderName}` : 'Recorded by clinical staff'}
            {v.recordedAt ? ` · ${formatDateTimeAmPm(v.recordedAt)}` : ''}
          </p>
        </>
      )}
    </div>
  );
}
