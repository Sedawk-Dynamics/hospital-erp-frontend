'use client';

import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Thermometer, Heart, Wind, Droplets, Weight, Ruler, Activity } from 'lucide-react';
import type { ConsultationFormData } from './consultation-completion-schema';

interface StepExaminationProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<ConsultationFormData, any, any>;
}

export function StepExamination({ form }: StepExaminationProps) {
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
          Chief Complaint <span className="text-red-500">*</span>
        </Label>
        <textarea
          id="chiefComplaint"
          {...register('chiefComplaint')}
          placeholder="Patient's main complaint / reason for visit..."
          rows={2}
          className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
        />
        {errors.chiefComplaint && (
          <p className="text-xs text-red-500">{errors.chiefComplaint.message}</p>
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

      {/* ── Vital Signs ── */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Vital Signs
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <VitalField
            icon={<Thermometer className="h-3.5 w-3.5" />}
            label="Temp (°C)"
            placeholder="37"
            error={(errors.vitals as any)?.temperature?.message}
            {...register('vitals.temperature')}
          />
          <VitalField
            icon={<Heart className="h-3.5 w-3.5" />}
            label="BP Systolic"
            placeholder="120"
            error={(errors.vitals as any)?.bloodPressureSystolic?.message}
            {...register('vitals.bloodPressureSystolic')}
          />
          <VitalField
            icon={<Heart className="h-3.5 w-3.5" />}
            label="BP Diastolic"
            placeholder="80"
            error={(errors.vitals as any)?.bloodPressureDiastolic?.message}
            {...register('vitals.bloodPressureDiastolic')}
          />
          <VitalField
            icon={<Activity className="h-3.5 w-3.5" />}
            label="Pulse (bpm)"
            placeholder="72"
            error={(errors.vitals as any)?.pulseRate?.message}
            {...register('vitals.pulseRate')}
          />
          <VitalField
            icon={<Wind className="h-3.5 w-3.5" />}
            label="RR (/min)"
            placeholder="16"
            error={(errors.vitals as any)?.respiratoryRate?.message}
            {...register('vitals.respiratoryRate')}
          />
          <VitalField
            icon={<Droplets className="h-3.5 w-3.5" />}
            label="SpO₂ (%)"
            placeholder="98"
            error={(errors.vitals as any)?.oxygenSaturation?.message}
            {...register('vitals.oxygenSaturation')}
          />
          <VitalField
            icon={<Weight className="h-3.5 w-3.5" />}
            label="Weight (kg)"
            placeholder="70"
            error={(errors.vitals as any)?.weightKg?.message}
            {...register('vitals.weightKg')}
          />
          <VitalField
            icon={<Ruler className="h-3.5 w-3.5" />}
            label="Height (cm)"
            placeholder="170"
            error={(errors.vitals as any)?.heightCm?.message}
            {...register('vitals.heightCm')}
          />
          <VitalField
            icon={<Droplets className="h-3.5 w-3.5" />}
            label="Blood Sugar"
            placeholder="100"
            error={(errors.vitals as any)?.bloodSugar?.message}
            {...register('vitals.bloodSugar')}
          />
        </div>
      </div>

      <Separator />

      {/* ── Diagnoses ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            Diagnosis <span className="text-red-500">*</span>
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
          <p className="text-xs text-red-500">{errors.diagnoses.message}</p>
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
                    <p className="text-[10px] text-red-500 mt-0.5">
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
                  className="h-8 w-8 text-muted-foreground hover:text-red-500 shrink-0"
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

// ── Vital input field component ────────────────────────────

import { forwardRef } from 'react';

interface VitalFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon: React.ReactNode;
  label: string;
  error?: string;
}

const VitalField = forwardRef<HTMLInputElement, VitalFieldProps>(
  ({ icon, label, error, ...props }, ref) => {
    return (
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          {icon} {label}
        </Label>
        <Input
          ref={ref}
          type="number"
          step="any"
          className={`h-8 text-xs ${error ? 'ring-2 ring-red-300' : ''}`}
          {...props}
        />
        {error && <p className="text-[10px] text-red-500">{error}</p>}
      </div>
    );
  },
);

VitalField.displayName = 'VitalField';
