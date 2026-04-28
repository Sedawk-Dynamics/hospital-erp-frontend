'use client';

import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Activity, Lock, Loader2 } from 'lucide-react';
import { useLatestVitals } from '@/hooks/use-nurse';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import type { ConsultationFormData } from './consultation-completion-schema';

interface StepExaminationProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<ConsultationFormData, any, any>;
  patientId?: string;
}

export function StepExamination({ form, patientId }: StepExaminationProps) {
  const { register, formState: { errors }, control } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'diagnoses',
  });

  return (
    <div className="space-y-6">
      {/* ── Chief Complaint ── */}
      <div className="space-y-2">
        <Label htmlFor="chiefComplaint" className="text-sm font-semibold">
          Chief Complaint <span className="text-error">*</span>
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

      {/* ── Vital Signs (read-only — recorded by nursing team) ── */}
      <VitalsReadOnlyPanel patientId={patientId} />

      <Separator />

      {/* ── Diagnoses ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            Diagnosis <span className="text-error">*</span>
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
              <div className="grid flex-1 grid-cols-1 sm:grid-cols-[100px_1fr_140px] gap-2">
                <div>
                  <Input
                    placeholder="ICD Code"
                    className="h-8 text-xs"
                    {...register(`diagnoses.${index}.icdCode`)}
                  />
                </div>
                <div>
                  <Input
                    placeholder="Diagnosis name *"
                    className="h-8 text-xs"
                    {...register(`diagnoses.${index}.diagnosisName`)}
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

// ── Vital signs read-only panel ────────────────────────────
//
// Vitals are owned by the nursing team. Doctors can only view the latest
// reading on this step — recording or correcting requires a nurse to do it
// from the nursing module. This panel pulls `/clinical/vitals/:patientId/latest`
// and renders a tile strip plus a "recorded by …" attribution line.

function VitalsReadOnlyPanel({ patientId }: { patientId?: string }) {
  const { data: latestResp, isLoading } = useLatestVitals(patientId ?? '');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = (latestResp as any)?.data ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recorder = v?.recorder as { firstName?: string; lastName?: string } | undefined;
  const recorderName = recorder
    ? [recorder.firstName, recorder.lastName].filter(Boolean).join(' ').trim() || 'Nurse'
    : null;

  const tiles = v
    ? [
        {
          label: 'Temp',
          value: v.temperature ?? null,
          unit: '°C',
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
        <Badge
          variant="outline"
          className="gap-1 border-secondary/40 bg-secondary/10 text-secondary text-[10px]"
        >
          <Lock className="h-3 w-3" />
          Nurse-recorded · read only
        </Badge>
      </div>

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
          No vitals recorded yet. Ask the assigned nurse to record vitals from the Nursing module.
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
            {recorderName ? `Recorded by ${recorderName}` : 'Recorded by nursing team'}
            {v.recordedAt ? ` · ${formatDateTimeAmPm(v.recordedAt)}` : ''}
          </p>
        </>
      )}
    </div>
  );
}
