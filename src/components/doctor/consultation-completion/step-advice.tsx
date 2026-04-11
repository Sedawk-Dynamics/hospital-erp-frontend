'use client';

import { type UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Stethoscope, Pill, Activity, CalendarDays, ClipboardList } from 'lucide-react';
import type { ConsultationFormData } from './consultation-completion-schema';

interface StepAdviceProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<ConsultationFormData, any, any>;
}

export function StepAdvice({ form }: StepAdviceProps) {
  const { register, watch } = form;
  const diagnoses = watch('diagnoses');
  const medicines = watch('medicines');
  const vitals = watch('vitals');

  // Count filled vitals
  const vitalsCount = Object.values(vitals).filter((v) => v !== undefined && v !== null && v !== 0).length;
  const diagnosisCount = diagnoses.filter((d) => d.diagnosisName).length;

  return (
    <div className="space-y-6">
      {/* ── Advice to Patient ── */}
      <div className="space-y-2">
        <Label htmlFor="advice" className="text-sm font-semibold">
          Advice to Patient
        </Label>
        <textarea
          id="advice"
          {...register('advice')}
          placeholder="Diet recommendations, exercise, precautions, lifestyle modifications, rest, hydration..."
          rows={3}
          className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
        />
      </div>

      {/* ── Follow-up ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="followUpDate" className="text-sm font-semibold flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            Follow-up Date
          </Label>
          <Input
            id="followUpDate"
            type="date"
            className="h-9"
            {...register('followUpDate')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="followUpNotes" className="text-sm font-semibold">
            Follow-up Instructions
          </Label>
          <Input
            id="followUpNotes"
            placeholder="e.g. Review after 1 week with blood reports"
            className="h-9 text-sm"
            {...register('followUpNotes')}
          />
        </div>
      </div>

      {/* ── Referral ── */}
      <div className="space-y-2">
        <Label htmlFor="referralNotes" className="text-sm font-semibold">
          Referral Notes
        </Label>
        <textarea
          id="referralNotes"
          {...register('referralNotes')}
          placeholder="Refer to specialist if needed... (e.g. Refer to cardiologist for further evaluation)"
          rows={2}
          className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
        />
      </div>

      {/* ── Additional Notes ── */}
      <div className="space-y-2">
        <Label htmlFor="additionalNotes" className="text-sm font-semibold">
          Additional Notes
        </Label>
        <textarea
          id="additionalNotes"
          {...register('additionalNotes')}
          placeholder="Any other notes for internal records..."
          rows={2}
          className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
        />
      </div>

      <Separator />

      {/* ── Consultation Summary Preview ── */}
      <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          Consultation Summary
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard
            icon={<Activity className="h-4 w-4" />}
            label="Vitals Recorded"
            value={vitalsCount}
            color="text-blue-600 bg-blue-50"
          />
          <SummaryCard
            icon={<Stethoscope className="h-4 w-4" />}
            label="Diagnoses"
            value={diagnosisCount}
            color="text-purple-600 bg-purple-50"
          />
          <SummaryCard
            icon={<Pill className="h-4 w-4" />}
            label="Medicines"
            value={medicines.length}
            color="text-emerald-600 bg-emerald-50"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          On completing, all records will be saved and the appointment will be marked as completed.
          The prescription will be visible to the patient in their portal.
        </p>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-3 text-center">
      <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${color} mb-1`}>
        {icon}
      </div>
      <p className="font-headline text-lg font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
