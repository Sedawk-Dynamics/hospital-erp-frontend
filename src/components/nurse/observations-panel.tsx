'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  useClinicalObservations,
  useCreateObservation,
  AVPU_LABELS,
  GENERAL_CONDITION_LABELS,
  MOBILITY_LABELS,
  type ClinicalObservation,
  type AvpuLevel,
  type GeneralCondition,
  type MobilityLevel,
} from '@/hooks/use-nursing-forms';
import { formatDateTime } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Clock, Activity, Eye } from 'lucide-react';

interface FormState {
  painScore: string;
  painLocation: string;
  consciousnessAvpu: AvpuLevel | '';
  generalCondition: GeneralCondition | '';
  mobility: MobilityLevel | '';
  fluidIntakeMl: string;
  foodIntakeNotes: string;
  urineOutputMl: string;
  stoolPassed: 'yes' | 'no' | '';
  stoolCount: string;
  notes: string;
}

const INITIAL: FormState = {
  painScore: '',
  painLocation: '',
  consciousnessAvpu: '',
  generalCondition: '',
  mobility: '',
  fluidIntakeMl: '',
  foodIntakeNotes: '',
  urineOutputMl: '',
  stoolPassed: '',
  stoolCount: '',
  notes: '',
};

export function ObservationsPanel({
  patientId,
  admissionId,
}: {
  patientId: string;
  admissionId?: string;
}) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const { data, isLoading } = useClinicalObservations(
    { patientId, limit: 30 },
    { enabled: !!patientId },
  );
  const createObs = useCreateObservation();

  const items: ClinicalObservation[] = Array.isArray(data?.data)
    ? (data!.data as ClinicalObservation[])
    : [];

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  function parseNum(v: string): number | undefined {
    const n = parseFloat(v);
    return isNaN(n) ? undefined : n;
  }

  function submit() {
    const hasAny =
      form.painScore ||
      form.consciousnessAvpu ||
      form.generalCondition ||
      form.mobility ||
      form.fluidIntakeMl ||
      form.urineOutputMl ||
      form.stoolPassed ||
      form.notes.trim();
    if (!hasAny) {
      toast.error('Enter at least one observation field');
      return;
    }

    createObs.mutate(
      {
        patientId,
        admissionId,
        painScore: parseNum(form.painScore),
        painLocation: form.painLocation || undefined,
        consciousnessAvpu: form.consciousnessAvpu || undefined,
        generalCondition: form.generalCondition || undefined,
        mobility: form.mobility || undefined,
        fluidIntakeMl: parseNum(form.fluidIntakeMl),
        foodIntakeNotes: form.foodIntakeNotes || undefined,
        urineOutputMl: parseNum(form.urineOutputMl),
        stoolPassed: form.stoolPassed === '' ? undefined : form.stoolPassed === 'yes',
        stoolCount: parseNum(form.stoolCount),
        notes: form.notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Observation recorded');
          setForm(INITIAL);
        },
        onError: (err: unknown) => {
          toast.error((err as { message?: string })?.message ?? 'Failed to record');
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-outline-variant/30 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">New Observation</h3>
        </div>

        {/* Pain */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
              Pain Score (0-10)
            </label>
            <Input
              type="number"
              min={0}
              max={10}
              value={form.painScore}
              onChange={(e) => set('painScore', e.target.value)}
              placeholder="0-10"
            />
          </div>
          <div className="md:col-span-2">
            <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
              Pain Location
            </label>
            <Input
              value={form.painLocation}
              onChange={(e) => set('painLocation', e.target.value)}
              placeholder="e.g. right leg, lower back"
            />
          </div>
        </div>

        {/* Consciousness / Condition / Mobility */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
              Consciousness (AVPU)
            </label>
            <Select
              value={form.consciousnessAvpu || null}
              onValueChange={(v) => set('consciousnessAvpu', (v ?? '') as AvpuLevel | '')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AVPU_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
              General Condition
            </label>
            <Select
              value={form.generalCondition || null}
              onValueChange={(v) => set('generalCondition', (v ?? '') as GeneralCondition | '')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(GENERAL_CONDITION_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
              Mobility
            </label>
            <Select
              value={form.mobility || null}
              onValueChange={(v) => set('mobility', (v ?? '') as MobilityLevel | '')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MOBILITY_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Intake / Output snapshot */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
              Fluid Intake (ml)
            </label>
            <Input
              type="number"
              min={0}
              value={form.fluidIntakeMl}
              onChange={(e) => set('fluidIntakeMl', e.target.value)}
            />
          </div>
          <div>
            <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
              Urine Output (ml)
            </label>
            <Input
              type="number"
              min={0}
              value={form.urineOutputMl}
              onChange={(e) => set('urineOutputMl', e.target.value)}
            />
          </div>
          <div>
            <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
              Stool
            </label>
            <Select
              value={form.stoolPassed || null}
              onValueChange={(v) => set('stoolPassed', (v ?? '') as 'yes' | 'no' | '')}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
              Stool Count
            </label>
            <Input
              type="number"
              min={0}
              value={form.stoolCount}
              onChange={(e) => set('stoolCount', e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
            Food Intake / Diet Notes
          </label>
          <Textarea
            rows={2}
            value={form.foodIntakeNotes}
            onChange={(e) => set('foodIntakeNotes', e.target.value)}
            placeholder="Diet, appetite, oral intake notes…"
          />
        </div>

        <div>
          <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
            Observation Notes
          </label>
          <Textarea
            rows={2}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Free-text observations…"
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={submit} disabled={createObs.isPending} size="sm" className="gap-1.5">
            {createObs.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Record Observation
          </Button>
        </div>
      </div>

      {/* History */}
      <div>
        <h3 className="text-xs font-semibold text-on-surface mb-2 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" />
          Recent Observations
        </h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-on-surface-variant text-center py-6">
            No observations yet
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((o) => (
              <div
                key={o.id}
                className="rounded-lg border border-outline-variant/20 p-3 hover:bg-surface-container-low/30"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {o.painScore != null && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                        Pain {o.painScore}/10
                      </span>
                    )}
                    {o.consciousnessAvpu && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {AVPU_LABELS[o.consciousnessAvpu]}
                      </span>
                    )}
                    {o.generalCondition && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        {GENERAL_CONDITION_LABELS[o.generalCondition]}
                      </span>
                    )}
                    {o.mobility && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary-foreground">
                        {MOBILITY_LABELS[o.mobility]}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-on-surface-variant whitespace-nowrap flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDateTime(o.observedAt)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant">
                  {o.painLocation && <span>Location: {o.painLocation}</span>}
                  {o.fluidIntakeMl != null && <span>In: {o.fluidIntakeMl} ml</span>}
                  {o.urineOutputMl != null && <span>Urine: {o.urineOutputMl} ml</span>}
                  {o.stoolPassed != null && (
                    <span>Stool: {o.stoolPassed ? `Yes${o.stoolCount ? ` (${o.stoolCount})` : ''}` : 'No'}</span>
                  )}
                </div>
                {o.notes && (
                  <p className="text-sm text-on-surface mt-1 whitespace-pre-wrap">{o.notes}</p>
                )}
                {o.nurse && (
                  <p className="text-[10px] text-on-surface-variant mt-1">
                    by {o.nurse.firstName} {o.nurse.lastName ?? ''}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
