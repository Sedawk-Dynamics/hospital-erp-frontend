'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Stethoscope, Search, Plus, Trash2, Pill, AlertTriangle,
  GripVertical, FlaskConical, ClipboardList, StickyNote,
  UserCheck, CalendarDays, Eye,
  Printer, CheckCircle2, RotateCcw, ChevronDown,
  Clock, Eye as ObservationIcon, Sparkles, Pin,
} from 'lucide-react';
import { useFormularySearch, useAllergyCheck, usePatientVitals, usePatientDiagnoses, usePrescriptions, useProgressNotes, type FormularyDrug } from '@/hooks/use-doctor';
import { useLatestVitals } from '@/hooks/use-nurse';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import {
  consultationCompletionSchema,
  defaultFormValues,
  defaultMedicine,
  FREQUENCY_OPTIONS,
  TIMING_OPTIONS,
  DURATION_UNITS,
  ROUTE_OPTIONS,
  FOLLOW_UP_PRESETS,
  getDosageFormBadge,
  type ConsultationFormData,
  type MedicineFormData,
} from '../consultation-completion/consultation-completion-schema';
import { useConsultationCompletion } from '../consultation-completion/use-consultation-completion';
import { VoiceInputButton } from '../voice-input-button';
import { PhysicalObservationsPicker } from '../physical-observations-picker';
import { DischargePinEditor } from '../discharge-pin-editor';
import { SmartSuggestionsCard } from '../smart-suggestions-card';

/** Build the localStorage key where the consultation draft is stored. */
export function getConsultationDraftKey(appointmentId: string, visitId?: string): string {
  return `consult-draft:${visitId ? `edit:${visitId}` : appointmentId || 'unknown'}`;
}

/** Remove any persisted draft for this appointment / edit session. */
export function clearConsultationDraft(appointmentId: string, visitId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getConsultationDraftKey(appointmentId, visitId));
  } catch {
    /* ignore */
  }
}

interface PrescriptionPadProps {
  patientId: string;
  patientName: string;
  patientAge?: string;
  patientGender?: string;
  patientPhone?: string;
  appointmentId: string;
  doctorProfileId: string;
  doctorUserId: string;
  onComplete?: () => void;
  onBack?: () => void;
  /** Hide the built-in patient header (when page already shows one) */
  hideHeader?: boolean;
  /** Pre-fill the form with existing data (used when editing a completed consultation within 24h) */
  initialValues?: Partial<ConsultationFormData>;
  /** Edit mode: update existing records in-place and don't change appointment status */
  editMode?: {
    visitId: string;
    progressNoteId?: string;
    prescriptionId?: string;
  };
}

export function PrescriptionPad({
  patientId,
  patientName,
  patientAge,
  patientGender,
  patientPhone,
  appointmentId,
  doctorProfileId,
  doctorUserId,
  onComplete,
  onBack,
  hideHeader,
  initialValues,
  editMode,
}: PrescriptionPadProps) {
  // Draft key — persists in-progress form state across navigation so the
  // doctor doesn't lose work when they hit Back or accidentally unmount.
  const draftKey = useMemo(
    () => getConsultationDraftKey(appointmentId, editMode?.visitId),
    [appointmentId, editMode?.visitId],
  );

  // Lazy read draft from localStorage (runs once on mount). In edit mode
  // we DISCARD the draft so the server prefill is authoritative — the
  // doctor's saved values always win over any stale WIP that might have
  // accumulated from a previous session. For fresh consultations the
  // draft protects against unmount / back-navigation data loss.
  const draft = useMemo<Partial<ConsultationFormData> | null>(() => {
    if (typeof window === 'undefined') return null;
    if (editMode?.visitId) {
      // Editing a saved visit — nuke any leftover draft for this key
      // before it has a chance to override initialValues.
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      return null;
    }
    try {
      const raw = window.localStorage.getItem(draftKey);
      return raw ? (JSON.parse(raw) as Partial<ConsultationFormData>) : null;
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, editMode?.visitId]);

  // In edit mode the prefill is the source of truth. For fresh notes the
  // draft protects WIP across unmounts. We also merge seed onto defaults
  // *field-by-field* so that a seed with missing keys (e.g. older API
  // responses) doesn't overwrite sensible defaults with undefined.
  const seed = editMode?.visitId ? initialValues : (draft ?? initialValues);

  const form = useForm<ConsultationFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(consultationCompletionSchema) as any,
    defaultValues: {
      ...defaultFormValues,
      ...(seed ?? {}),
      diagnoses:
        seed?.diagnoses && seed.diagnoses.length > 0
          ? seed.diagnoses
          : defaultFormValues.diagnoses,
      medicines:
        seed?.medicines && seed.medicines.length > 0
          ? seed.medicines.map((m: any) => ({ ...defaultMedicine, ...m }))
          : defaultFormValues.medicines,
      physicalObservations:
        seed?.physicalObservations && seed.physicalObservations.length > 0
          ? seed.physicalObservations
          : defaultFormValues.physicalObservations,
      pins:
        seed?.pins && seed.pins.length > 0 ? seed.pins : defaultFormValues.pins,
    },
  });

  const { register, watch, setValue, formState: { errors } } = form;
  const { submitConsultation, isSubmitting, error: submitError, currentStep } = useConsultationCompletion();

  // Persist form state to localStorage (debounced) so the draft survives
  // Back navigation, remounts, and accidental tab closes.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const subscription = form.watch((value) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          window.localStorage.setItem(draftKey, JSON.stringify(value));
        } catch {
          /* quota / serialization errors — ignore */
        }
      }, 400);
    });
    return () => {
      subscription.unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [form, draftKey]);

  const clearDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.removeItem(draftKey); } catch { /* ignore */ }
  }, [draftKey]);

  // Section collapse state
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => setCollapsed((p) => ({ ...p, [key]: !p[key] }));

  // Past data hooks
  const { data: pastVitals } = usePatientVitals(patientId);
  const { data: pastDiagnoses } = usePatientDiagnoses(patientId);
  const { data: pastPrescriptions } = usePrescriptions({ patientId, limit: 5 });
  const { data: pastNotes } = useProgressNotes({ patientId, limit: 5 });
  // Latest nurse-recorded vitals → displayed read-only in the Objective
  // section. The doctor cannot edit them; if a fresh reading is needed they
  // ask the assigned nurse to capture it from the Nursing module.
  const { data: latestVitalsResp } = useLatestVitals(patientId);
  const latestVital = (latestVitalsResp as any)?.data ?? null;

  // Watched SOAP extras — reading the field array this way keeps the
  // render in sync without subscribing the whole form to every keystroke.
  const physicalObservations = watch('physicalObservations') ?? [];
  const impression = watch('impression') ?? '';
  const pins = watch('pins') ?? [];

  // SOAP-letter badge shown next to each section title. Keeps the
  // doctor oriented inside a flat vertical scroll without forcing a
  // tabbed UI. `s/o/a/p` map to the SOAP category each field belongs to.
  const SoapBadge = ({ letter }: { letter: 'S' | 'O' | 'A' | 'P' }) => (
    <span
      className={cn(
        'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
        'bg-primary/10 text-primary',
      )}
      title={
        { S: 'Subjective', O: 'Objective', A: 'Assessment', P: 'Plan' }[letter]
      }
    >
      {letter}
    </span>
  );

  // ── Handle Submit ──
  const handleFinish = useCallback(async () => {
    const valid = await form.trigger();
    if (!valid) return;

    try {
      await submitConsultation({
        formData: form.getValues(),
        patientId,
        appointmentId,
        doctorProfileId,
        doctorUserId,
        editMode,
      });
      clearDraft();
      onComplete?.();
    } catch {
      // error is set in hook
    }
  }, [form, submitConsultation, patientId, appointmentId, doctorProfileId, doctorUserId, editMode, onComplete, clearDraft]);

  // ── Handle Clear ──
  const handleClear = useCallback(() => {
    form.reset(defaultFormValues);
    clearDraft();
  }, [form, clearDraft]);

  return (
    <div className="bg-background">
      {/* ── Patient Header (only if not hidden by parent page) ── */}
      {!hideHeader && (
        <div className="flex items-center gap-4 px-5 py-3 border-b bg-card sticky top-0 z-20 rounded-t-xl">
          {onBack && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
              <ChevronDown className="h-4 w-4 rotate-90" />
            </Button>
          )}
          <div className="flex items-center gap-3 flex-1">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">
                {patientName?.charAt(0)?.toUpperCase() || 'P'}
              </span>
            </div>
            <div>
              <h2 className="text-sm font-bold">{patientName}</h2>
              <p className="text-xs text-muted-foreground">
                {[patientAge, patientGender, patientPhone].filter(Boolean).join(' | ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Sections (SOAP flow top → bottom) ── */}
      <div className="space-y-4 pb-4">
        {/* ─── S · Subjective ─── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pt-1">
            <SoapBadge letter="S" />
            <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">
              Subjective · what the patient reports
            </span>
          </div>
            <PadSection
              icon={<Stethoscope className="h-4 w-4" />}
              title="Chief Complaints"
              badge="Symptoms"
              collapsed={collapsed.symptoms}
              onToggle={() => toggleSection('symptoms')}
              color="text-primary-container"
              actions={
                <div onClick={(e) => e.stopPropagation()} className="contents">
                  <VoiceInputButton
                    value={watch('chiefComplaint') ?? ''}
                    onChange={(v) => setValue('chiefComplaint', v, { shouldDirty: true })}
                    fieldLabel="Chief Complaints"
                  />
                </div>
              }
            >
              <textarea
                {...register('chiefComplaint')}
                placeholder="e.g. Fever × 3 days, dry cough, fatigue · chronology, severity, related history…"
                rows={6}
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 resize-y"
              />
              {errors.chiefComplaint && (
                <p className="text-xs text-error mt-1">{errors.chiefComplaint.message}</p>
              )}
            </PadSection>

        </div>

        {/* ─── O · Objective ─── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pt-1">
            <SoapBadge letter="O" />
            <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">
              Objective · what you measure & observe
            </span>
          </div>
            {/* Vitals are shown in the right-hand sidebar (read-only, nurse-recorded). */}

            {/* PHYSICAL OBSERVATIONS */}
            <PadSection
              icon={<ObservationIcon className="h-4 w-4" />}
              title="Physical Observations"
              badge="Catalog"
              collapsed={collapsed.physObs}
              onToggle={() => toggleSection('physObs')}
              color="text-primary-container"
            >
              <PhysicalObservationsPicker
                value={physicalObservations}
                onChange={(next) => setValue('physicalObservations', next, { shouldDirty: true })}
              />
            </PadSection>

            {/* EXAMINATION FINDINGS */}
            <PadSection
              icon={<Search className="h-4 w-4" />}
              title="Examination Findings"
              badge="O/E"
              collapsed={collapsed.exam}
              onToggle={() => toggleSection('exam')}
              color="text-primary"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">General Examination</label>
                    <VoiceInputButton
                      value={watch('generalExamination') ?? ''}
                      onChange={(v) => setValue('generalExamination', v, { shouldDirty: true })}
                      fieldLabel="General Examination"
                    />
                  </div>
                  <textarea
                    {...register('generalExamination')}
                    placeholder="General appearance, consciousness, pallor, icterus..."
                    rows={3}
                    className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Systemic Examination</label>
                    <VoiceInputButton
                      value={watch('systemicExamination') ?? ''}
                      onChange={(v) => setValue('systemicExamination', v, { shouldDirty: true })}
                      fieldLabel="Systemic Examination"
                    />
                  </div>
                  <textarea
                    {...register('systemicExamination')}
                    placeholder="CVS, RS, P/A, CNS findings..."
                    rows={3}
                    className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 resize-none"
                  />
                </div>
              </div>
            </PadSection>

            {/* LAB INVESTIGATIONS — placeholder; real orders happen via Order Lab/Imaging */}
            <PadSection
              icon={<FlaskConical className="h-4 w-4" />}
              title="Investigations Summary"
              collapsed={collapsed.lab}
              onToggle={() => toggleSection('lab')}
              color="text-tertiary"
            >
              <Input
                placeholder="Notable labs / imaging already done…"
                className="h-10 text-sm"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Use <strong>Order Lab</strong> / <strong>Order Imaging</strong> in the top bar to
                place new orders — they flow back into the Orders panel.
              </p>
            </PadSection>

        </div>

        {/* ─── A · Assessment ─── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pt-1">
            <SoapBadge letter="A" />
            <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">
              Assessment · diagnosis & clinical judgement
            </span>
          </div>
            <DiagnosisSection form={form} />

            <PadSection
              icon={<StickyNote className="h-4 w-4" />}
              title="Impression"
              badge="Clinical Note"
              collapsed={collapsed.impression}
              onToggle={() => toggleSection('impression')}
              color="text-secondary"
              actions={
                <div onClick={(e) => e.stopPropagation()} className="contents">
                  <VoiceInputButton
                    value={impression}
                    onChange={(v) => setValue('impression', v, { shouldDirty: true })}
                    fieldLabel="Impression"
                  />
                </div>
              }
            >
              <textarea
                value={impression}
                onChange={(e) => setValue('impression', e.target.value, { shouldDirty: true })}
                placeholder="Clinical impression — serves as the official narrative note…"
                rows={4}
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 resize-y"
              />
            </PadSection>

        </div>

        {/* ─── P · Plan ─── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pt-1">
            <SoapBadge letter="P" />
            <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">
              Plan · treatment, advice & next steps
            </span>
          </div>
            {/* AI Smart Suggestions sit at the top of P so the doctor can use
               them to guide treatment/next-step choices below. */}
            <div className="rounded-xl border bg-card p-3">
              <SmartSuggestionsCard
                buildInput={() => ({
                  chiefComplaints: watch('chiefComplaint') || undefined,
                  presentIllness:
                    [watch('generalExamination'), watch('systemicExamination')]
                      .filter(Boolean)
                      .join('\n') || undefined,
                  vitalsSummary: (() => {
                    // Pull from the latest nurse-recorded reading. The doctor
                    // no longer captures vitals inline.
                    const v = latestVital;
                    if (!v) return undefined;
                    const parts: string[] = [];
                    if (v.bloodPressureSystolic && v.bloodPressureDiastolic)
                      parts.push(`BP ${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`);
                    const hr = v.pulseRate ?? v.heartRate;
                    if (hr) parts.push(`HR ${hr}`);
                    if (v.temperature) parts.push(`T ${v.temperature}`);
                    if (v.respiratoryRate) parts.push(`RR ${v.respiratoryRate}`);
                    if (v.oxygenSaturation) parts.push(`SpO2 ${v.oxygenSaturation}%`);
                    return parts.join(' · ') || undefined;
                  })(),
                  physicalObservations: physicalObservations.map((po) => ({
                    value: po.value,
                    system: po.system,
                  })),
                  diagnosis: (watch('diagnoses') ?? [])
                    .map((d: any) => d.diagnosisName)
                    .filter(Boolean)
                    .join(', ') || undefined,
                  medications: (watch('medicines') ?? [])
                    .map((m: any) => m.drugName)
                    .filter(Boolean)
                    .join(', ') || undefined,
                  advice: watch('advice') || undefined,
                })}
                onAdopt={(s) => {
                  const current = watch('advice') ?? '';
                  const next = current ? `${current}\n- ${s}` : `- ${s}`;
                  setValue('advice', next, { shouldDirty: true });
                }}
              />
            </div>

            <MedicationsSection form={form} patientId={patientId} />

            <PadSection
              icon={<StickyNote className="h-4 w-4" />}
              title="Notes for Patient"
              badge="Treatment / Surgical / Other"
              collapsed={collapsed.notes}
              onToggle={() => toggleSection('notes')}
              color="text-primary"
              actions={
                <div onClick={(e) => e.stopPropagation()} className="contents">
                  <VoiceInputButton
                    value={watch('advice') ?? ''}
                    onChange={(v) => setValue('advice', v, { shouldDirty: true })}
                    fieldLabel="Notes / Advice"
                  />
                </div>
              }
            >
              <textarea
                {...register('advice')}
                placeholder="Add notes…"
                rows={4}
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 resize-y"
              />
            </PadSection>

            <FollowUpSection form={form} />

            <PadSection
              icon={<UserCheck className="h-4 w-4" />}
              title="Refer to a Doctor"
              collapsed={collapsed.refer}
              onToggle={() => toggleSection('refer')}
              color="text-tertiary"
              actions={
                <div onClick={(e) => e.stopPropagation()} className="contents">
                  <VoiceInputButton
                    value={watch('referralNotes') ?? ''}
                    onChange={(v) => setValue('referralNotes', v, { shouldDirty: true })}
                    fieldLabel="Referral"
                  />
                </div>
              }
            >
              <textarea
                {...register('referralNotes')}
                placeholder="Start typing doctor name or speciality / Add referral notes…"
                rows={2}
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 resize-none"
              />
            </PadSection>

            <PadSection
              icon={<Pin className="h-4 w-4" />}
              title="Pin to Discharge Summary"
              badge={pins.length > 0 ? `${pins.length} pinned` : 'IP only'}
              collapsed={collapsed.pins}
              onToggle={() => toggleSection('pins')}
              color="text-primary"
            >
              <DischargePinEditor
                value={pins}
                onChange={(next) => setValue('pins', next, { shouldDirty: true })}
              />
            </PadSection>
        </div>
      </div>

      {/* ── Sticky Bottom Action Bar ── */}
      <div className="sticky bottom-0 z-20 flex items-center gap-3 px-4 py-3 border-t bg-card/95 backdrop-blur-sm rounded-b-xl">
        <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Clear
        </Button>
        <Button variant="outline" size="sm">
          <Eye className="h-3.5 w-3.5 mr-1.5" />
          Preview
        </Button>

        <div className="flex-1" />

        {submitError && (
          <span className="text-xs text-error mr-2">{submitError}</span>
        )}
        {isSubmitting && (
          <span className="text-xs text-muted-foreground mr-2">{currentStep}</span>
        )}

        <Button variant="outline" size="sm">
          <Printer className="h-3.5 w-3.5 mr-1.5" />
          Print
        </Button>
        <Button
          size="sm"
          className="gap-1.5 bg-primary hover:bg-primary/90 min-w-[160px]"
          onClick={handleFinish}
          disabled={isSubmitting}
        >
          <CheckCircle2 className="h-4 w-4" />
          {isSubmitting ? 'Saving...' : editMode ? 'Save Changes' : 'Finish Prescription'}
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Section wrapper component (eka.care-style card)
// ═══════════════════════════════════════════════════════════

function PadSection({
  icon,
  title,
  badge,
  children,
  collapsed,
  onToggle,
  color = 'text-primary',
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  children: React.ReactNode;
  collapsed?: boolean;
  onToggle?: () => void;
  color?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <div className={cn('shrink-0', color)}>{icon}</div>
        <h3 className="text-sm font-bold flex-1">{title}</h3>
        {badge && (
          <Badge variant="secondary" className="text-[10px] font-medium">
            {badge}
          </Badge>
        )}
        {actions}
        {onToggle && (
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', collapsed && '-rotate-90')} />
        )}
      </div>
      {!collapsed && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
// Diagnosis Section (with ICD-10 badge)
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DiagnosisSection({ form }: { form: any }) {
  const { register, control, formState: { errors } } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'diagnoses' });

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3">
        <ClipboardList className="h-4 w-4 text-error shrink-0" />
        <h3 className="text-sm font-bold flex-1">Diagnosis</h3>
        <Badge variant="secondary" className="text-[10px] font-medium">ICD-10</Badge>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => append({ icdCode: '', diagnosisName: '', diagnosisType: 'secondary' })}
        >
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      <div className="px-4 pb-4 space-y-2">
        {errors.diagnoses?.message && (
          <p className="text-xs text-error">{errors.diagnoses.message}</p>
        )}
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <Input
              placeholder="ICD Code"
              className="h-8 text-xs w-24 shrink-0"
              {...register(`diagnoses.${index}.icdCode`)}
            />
            <Input
              placeholder="Start typing Diagnosis..."
              className="h-8 text-sm flex-1"
              {...register(`diagnoses.${index}.diagnosisName`)}
            />
            <select
              className="flex h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 w-28 shrink-0"
              {...register(`diagnoses.${index}.diagnosisType`)}
            >
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
              <option value="differential">Differential</option>
            </select>
            {fields.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-error"
                onClick={() => remove(index)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Medications Section (inline table)
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MedicationsSection({ form, patientId }: { form: any; patientId: string }) {
  const { control, watch, setValue } = form;
  const medicines = watch('medicines');
  const { fields, append, remove } = useFieldArray({ control, name: 'medicines' });

  const [drugSearch, setDrugSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const debouncedSearch = useDebounce(drugSearch, 300);
  const { data: formularyResults } = useFormularySearch(debouncedSearch);

  const filteredResults = (formularyResults ?? []).filter(
    (d: FormularyDrug) => !medicines.some((m: MedicineFormData) => m.drugId === d.id),
  );

  const handleSelectDrug = useCallback((drug: FormularyDrug) => {
    append({
      ...defaultMedicine,
      drugId: drug.id,
      drugName: drug.drugName,
      genericName: drug.genericName || '',
      dosageForm: drug.dosageForm || '',
      strength: drug.strength || '',
      dosage: drug.strength || '',
    });
    setDrugSearch('');
    setShowDropdown(false);
  }, [append]);

  const handleAddCustom = useCallback(() => {
    if (!drugSearch.trim()) return;
    append({ ...defaultMedicine, drugName: drugSearch.trim() });
    setDrugSearch('');
    setShowDropdown(false);
  }, [drugSearch, append]);

  const updateField = useCallback(
    (index: number, field: keyof MedicineFormData, value: any) => {
      setValue(`medicines.${index}.${field}` as any, value, { shouldDirty: true });
    },
    [setValue],
  );

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3">
        <Pill className="h-4 w-4 text-error shrink-0" />
        <h3 className="text-sm font-bold flex-1">Medications</h3>
        <span className="text-xs text-muted-foreground">{fields.length} medicine{fields.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* Medication table */}
        {fields.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <div className="grid grid-cols-[minmax(160px,2fr)_90px_95px_105px_95px_1fr_32px] gap-0 border-b bg-muted/50 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="px-3 py-2">Medicine</div>
              <div className="px-2 py-2">Dose</div>
              <div className="px-2 py-2">Frequency</div>
              <div className="px-2 py-2">Timing</div>
              <div className="px-2 py-2">Duration</div>
              <div className="px-2 py-2">Instructions</div>
              <div className="px-1 py-2" />
            </div>
            {fields.map((field, index) => (
              <MedRow
                key={field.id}
                index={index}
                med={medicines[index]}
                patientId={patientId}
                onUpdate={updateField}
                onRemove={() => remove(index)}
              />
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Start typing Medicines..."
            className="pl-9 h-10 text-sm"
            value={drugSearch}
            onChange={(e) => { setDrugSearch(e.target.value); setShowDropdown(true); }}
            onFocus={() => drugSearch.length >= 2 && setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                filteredResults.length > 0 ? handleSelectDrug(filteredResults[0]) : drugSearch.trim() && handleAddCustom();
              }
            }}
          />
          {showDropdown && drugSearch.length >= 2 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border bg-popover shadow-lg">
              {filteredResults.map((drug) => {
                const badge = getDosageFormBadge(drug.dosageForm);
                return (
                  <button
                    key={drug.id}
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors border-b last:border-b-0"
                    onClick={() => handleSelectDrug(drug)}
                  >
                    {badge && (
                      <Badge variant="outline" className={cn('text-[10px] font-bold px-1.5 py-0',
                        drug.dosageForm === 'tablet' && 'bg-primary-container/10 text-primary-container border-primary-container/30',
                        drug.dosageForm === 'capsule' && 'bg-primary/10 text-primary border-primary/30',
                        drug.dosageForm === 'injection' && 'bg-error/10 text-error border-error/30',
                      )}>
                        {badge}
                      </Badge>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{drug.drugName}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">
                        {[drug.genericName, drug.strength && `(${drug.strength})`].filter(Boolean).join(' ')}
                      </p>
                    </div>
                  </button>
                );
              })}
              {filteredResults.length === 0 && (
                <button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent" onClick={handleAddCustom}>
                  <Pill className="h-4 w-4 text-muted-foreground" />
                  <span>Add &quot;{drugSearch}&quot; as custom medicine</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Medication row
function MedRow({ index, med, patientId, onUpdate, onRemove }: {
  index: number; med: MedicineFormData; patientId: string;
  onUpdate: (i: number, f: keyof MedicineFormData, v: any) => void; onRemove: () => void;
}) {
  const { data: allergyResult } = useAllergyCheck(patientId, med?.drugName);
  const badge = getDosageFormBadge(med?.dosageForm);
  if (!med) return null;

  return (
    <div className="group">
      {allergyResult?.hasAllergy && (
        <div className="flex items-center gap-2 bg-error/10 border-b border-error/30 px-3 py-1">
          <AlertTriangle className="h-3 w-3 text-error" />
          <span className="text-[11px] text-error font-medium">
            Allergy: {allergyResult.matchedAllergies.map((a) => a.allergen).join(', ')}
          </span>
        </div>
      )}
      <div className="grid grid-cols-[minmax(160px,2fr)_90px_95px_105px_95px_1fr_32px] gap-0 border-b last:border-b-0 hover:bg-accent/20 transition-colors">
        <div className="px-3 py-2 flex items-start gap-1.5 min-w-0">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/20 shrink-0 mt-1 cursor-grab" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium truncate">{med.drugName}</span>
              {badge && <Badge variant="secondary" className="text-[8px] font-bold px-1 py-0">{badge}</Badge>}
            </div>
            {med.genericName && (
              <p className="text-[9px] text-muted-foreground uppercase truncate">
                {med.genericName} {med.strength && `(${med.strength})`}
              </p>
            )}
          </div>
        </div>
        <div className="px-1 py-1.5">
          <Input placeholder="e.g. 1 Tab" className="h-7 text-[11px] border-dashed" value={med.dose || ''} onChange={(e) => onUpdate(index, 'dose', e.target.value)} />
        </div>
        <div className="px-1 py-1.5">
          <select className="flex h-7 w-full rounded-md border border-dashed border-input bg-background px-1 text-[11px]" value={med.frequency || ''} onChange={(e) => { onUpdate(index, 'frequency', e.target.value); onUpdate(index, 'isPrn', e.target.value === 'SOS'); }}>
            <option value="">--</option>
            {FREQUENCY_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="px-1 py-1.5">
          <select className="flex h-7 w-full rounded-md border border-dashed border-input bg-background px-1 text-[11px]" value={med.timing || ''} onChange={(e) => onUpdate(index, 'timing', e.target.value)}>
            <option value="">--</option>
            {TIMING_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="px-1 py-1.5 flex gap-0.5">
          <Input placeholder="7" type="number" className="h-7 text-[11px] border-dashed w-10 px-1" value={med.durationValue || ''} onChange={(e) => onUpdate(index, 'durationValue', e.target.value)} />
          <select className="flex h-7 rounded-md border border-dashed border-input bg-background px-0.5 text-[10px] w-12" value={med.durationUnit || 'days'} onChange={(e) => onUpdate(index, 'durationUnit', e.target.value)}>
            {DURATION_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="px-1 py-1.5">
          <Input placeholder="Instructions" className="h-7 text-[11px] border-dashed" value={med.instructions || ''} onChange={(e) => onUpdate(index, 'instructions', e.target.value)} />
        </div>
        <div className="px-0.5 py-1.5 flex items-center">
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-error" onClick={onRemove}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Follow Up Section (duration ↔ date interconnected)
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FollowUpSection({ form }: { form: any }) {
  const { watch, setValue, register } = form;
  const followUpDate = watch('followUpDate');
  const followUpDuration = watch('followUpDuration');
  const followUpDurationUnit = watch('followUpDurationUnit') || 'days';

  /** Calculate date from duration */
  const handleDurationChange = useCallback(
    (dur: string, unit: string) => {
      setValue('followUpDuration', dur, { shouldDirty: true });
      setValue('followUpDurationUnit', unit, { shouldDirty: true });
      const n = parseInt(dur, 10);
      if (!n || n <= 0) return;
      const date = new Date();
      if (unit === 'days') date.setDate(date.getDate() + n);
      else if (unit === 'weeks') date.setDate(date.getDate() + n * 7);
      else if (unit === 'months') date.setMonth(date.getMonth() + n);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      setValue('followUpDate', `${yyyy}-${mm}-${dd}`, { shouldDirty: true });
    },
    [setValue],
  );

  /** Calculate duration from date */
  const handleDateChange = useCallback(
    (dateStr: string) => {
      setValue('followUpDate', dateStr, { shouldDirty: true });
      if (!dateStr) {
        setValue('followUpDuration', '', { shouldDirty: true });
        return;
      }
      const target = new Date(dateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      target.setHours(0, 0, 0, 0);
      const diffMs = target.getTime() - today.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) {
        setValue('followUpDuration', '', { shouldDirty: true });
        return;
      }
      // Pick the most natural unit
      if (diffDays % 30 === 0 && diffDays >= 30) {
        setValue('followUpDuration', String(diffDays / 30), { shouldDirty: true });
        setValue('followUpDurationUnit', 'months', { shouldDirty: true });
      } else if (diffDays % 7 === 0 && diffDays >= 7) {
        setValue('followUpDuration', String(diffDays / 7), { shouldDirty: true });
        setValue('followUpDurationUnit', 'weeks', { shouldDirty: true });
      } else {
        setValue('followUpDuration', String(diffDays), { shouldDirty: true });
        setValue('followUpDurationUnit', 'days', { shouldDirty: true });
      }
    },
    [setValue],
  );

  /** Handle preset click */
  const handlePreset = useCallback(
    (preset: { value: number; unit: string }) => {
      handleDurationChange(String(preset.value), preset.unit);
    },
    [handleDurationChange],
  );

  /** Clear follow-up */
  const handleClear = useCallback(() => {
    setValue('followUpDate', '', { shouldDirty: true });
    setValue('followUpDuration', '', { shouldDirty: true });
    setValue('followUpDurationUnit', 'days', { shouldDirty: true });
    setValue('followUpNotes', '', { shouldDirty: true });
  }, [setValue]);

  // Compute display date string for the info box
  const displayDate = followUpDate
    ? new Date(followUpDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  const hasFollowUp = !!(followUpDate || followUpDuration);

  return (
    <PadSection
      icon={<CalendarDays className="h-4 w-4" />}
      title="Follow Up"
      collapsed={false}
      color="text-secondary"
      actions={
        hasFollowUp ? (
          <button
            type="button"
            className="text-[10px] text-muted-foreground hover:text-error transition-colors mr-1"
            onClick={(e) => { e.stopPropagation(); handleClear(); }}
          >
            Clear
          </button>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {/* Quick presets */}
        <div className="flex flex-wrap gap-1.5">
          {FOLLOW_UP_PRESETS.map((preset) => {
            const isActive =
              followUpDuration === String(preset.value) &&
              followUpDurationUnit === preset.unit;
            return (
              <button
                key={preset.label}
                type="button"
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  isActive
                    ? 'bg-secondary/10 text-secondary border-secondary/30 ring-1 ring-secondary/30'
                    : 'bg-muted/40 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground',
                )}
                onClick={() => handlePreset(preset)}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Duration + Date inputs row */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_1.5fr] gap-2 items-end">
          {/* Duration number */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">After</label>
            <div className="flex gap-1">
              <Input
                type="number"
                min={1}
                placeholder="e.g. 7"
                className="h-9 text-sm w-20"
                value={followUpDuration || ''}
                onChange={(e) => handleDurationChange(e.target.value, followUpDurationUnit)}
              />
              <select
                className="flex h-9 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
                value={followUpDurationUnit}
                onChange={(e) => handleDurationChange(followUpDuration || '', e.target.value)}
              >
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
              </select>
            </div>
          </div>

          {/* Arrow connector */}
          <div className="hidden sm:flex items-center justify-center pb-1">
            <span className="text-xs text-muted-foreground/50">⟷</span>
          </div>

          {/* Date picker */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Date</label>
            <Input
              type="date"
              className="h-9 text-sm"
              value={followUpDate || ''}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => handleDateChange(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
            <Input
              placeholder="e.g. Review with blood reports"
              className="h-9 text-sm"
              {...register('followUpNotes')}
            />
          </div>
        </div>

        {/* Follow-up confirmation banner */}
        {hasFollowUp && displayDate && (
          <div className="flex items-center gap-2 rounded-lg bg-secondary/10 border border-secondary/30 px-3 py-2">
            <CalendarDays className="h-4 w-4 text-secondary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-secondary">
                Follow-up scheduled for {displayDate}
              </p>
              <p className="text-[10px] text-secondary/80">
                Patient will see a follow-up reminder in their portal and can book the appointment themselves.
              </p>
            </div>
          </div>
        )}
      </div>
    </PadSection>
  );
}

// ═══════════════════════════════════════════════════════════
// Patient History Section — Unified (all details per visit)
// ═══════════════════════════════════════════════════════════

/** Parse a progress note's markdown content into sections */
function parseNoteContent(content?: string): Record<string, string> {
  if (!content) return {};
  const sections: Record<string, string> = {};
  const blocks = content.split(/\n\n/);
  let currentKey = '';
  for (const block of blocks) {
    const headerMatch = block.match(/^\*\*(.+?):\*\*\s*([\s\S]*)/);
    if (headerMatch) {
      currentKey = headerMatch[1].trim();
      sections[currentKey] = headerMatch[2]?.trim() || '';
    } else if (currentKey) {
      sections[currentKey] = (sections[currentKey] ? sections[currentKey] + '\n' : '') + block.trim();
    }
  }
  return sections;
}

/** Section label → color mapping */
const SECTION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Chief Complaint': { bg: 'bg-primary-container/10', text: 'text-primary-container', border: 'border-primary-container/30' },
  'Diagnosis': { bg: 'bg-error/10', text: 'text-error', border: 'border-error/30' },
  'Prescription': { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/30' },
  'Vitals': { bg: 'bg-secondary/10', text: 'text-secondary', border: 'border-secondary/30' },
  'Advice': { bg: 'bg-tertiary/10', text: 'text-tertiary', border: 'border-tertiary/30' },
  'Follow-up': { bg: 'bg-primary-container/10', text: 'text-primary-container', border: 'border-primary-container/30' },
  'General Examination': { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/30' },
  'Systemic Examination': { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/30' },
  'Referral': { bg: 'bg-tertiary/10', text: 'text-tertiary', border: 'border-tertiary/30' },
  'Additional Notes': { bg: 'bg-surface-container-high', text: 'text-on-surface-variant', border: 'border-outline-variant/30' },
};

function PatientHistorySection({
  pastNotes,
  pastPrescriptions,
  pastDiagnoses,
  pastVitals,
  collapsed,
  onToggle,
}: {
  pastNotes: any;
  pastPrescriptions: any;
  pastDiagnoses: any;
  pastVitals: any;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const notesList: any[] = pastNotes?.data || pastNotes || [];
  const rxList: any[] = pastPrescriptions?.data || pastPrescriptions || [];
  const diagList: any[] = pastDiagnoses?.data || pastDiagnoses || [];
  const vitalsList: any[] = pastVitals?.data || pastVitals || [];
  const [expandedVisit, setExpandedVisit] = useState<number | null>(0);

  // Merge visits: notes-based + standalone prescriptions
  const standaloneRx = rxList.filter((rx: any) => !notesList.some((n: any) => n.visitId === rx.visitId));
  const totalVisits = notesList.length + standaloneRx.length;

  return (
    <PadSection
      icon={<Clock className="h-4 w-4" />}
      title="Patient History"
      badge={totalVisits > 0 ? `${totalVisits} visit${totalVisits !== 1 ? 's' : ''}` : undefined}
      collapsed={collapsed}
      onToggle={onToggle}
      color="text-on-surface-variant"
    >
      {totalVisits === 0 ? (
        <div className="text-center py-6">
          <Clock className="h-5 w-5 text-muted-foreground/30 mx-auto mb-1.5" />
          <p className="text-xs text-muted-foreground">No past visits found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* ── Visit cards from progress notes ── */}
          {notesList.map?.((note: any, i: number) => {
            const sections = parseNoteContent(note.content);
            const sectionKeys = Object.keys(sections);
            const isExpanded = expandedVisit === i;
            const dateStr = note.createdAt
              ? new Date(note.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'Visit';
            const matchingRx = rxList.find?.((rx: any) => rx.visitId === note.visitId);
            const matchingDiags = diagList.filter((d: any) => d.visitId === note.visitId);

            // Build a flat list of display items
            const items: { label: string; color: string; content: React.ReactNode }[] = [];

            // Chief Complaint
            if (sections['Chief Complaint']) {
              items.push({ label: 'Symptoms', color: 'text-primary-container', content: <span className="text-[11px]">{sections['Chief Complaint']}</span> });
            }

            // Diagnosis (from note or API)
            if (sections['Diagnosis']) {
              items.push({ label: 'Diagnosis', color: 'text-error', content: <DiagnosisList content={sections['Diagnosis']} /> });
            } else if (matchingDiags.length > 0) {
              items.push({
                label: 'Diagnosis', color: 'text-error',
                content: (
                  <div className="flex flex-wrap gap-1.5">
                    {matchingDiags.map((d: any, idx: number) => (
                      <span key={d.id || idx} className="text-[11px]">
                        {d.diagnosisName}{d.icdCode ? ` (${d.icdCode})` : ''}{idx < matchingDiags.length - 1 ? ',' : ''}
                      </span>
                    ))}
                  </div>
                ),
              });
            }

            // Prescription (from note or API)
            const rxItems = matchingRx?.items || matchingRx?.prescriptionItems || [];
            if (sections['Prescription']) {
              items.push({ label: `Medicines`, color: 'text-primary', content: <PrescriptionLines content={sections['Prescription']} /> });
            } else if (rxItems.length > 0) {
              items.push({
                label: `Medicines (${rxItems.length})`, color: 'text-primary',
                content: (
                  <div className="space-y-0.5">
                    {rxItems.map((item: any, idx: number) => (
                      <span key={idx} className="text-[11px] block">
                        {idx + 1}. <span className="font-medium">{item.drugName}</span>
                        <span className="text-muted-foreground"> {[item.dosage, item.frequency, item.duration].filter(Boolean).join(' · ')}</span>
                      </span>
                    ))}
                  </div>
                ),
              });
            }

            // Vitals (from note text)
            if (sections['Vitals']) {
              items.push({ label: 'Vitals', color: 'text-secondary', content: <VitalsGrid content={sections['Vitals']} /> });
            }

            // Other sections: Advice, Follow-up, Exam, Referral
            for (const key of ['Advice', 'Follow-up', 'General Examination', 'Systemic Examination', 'Referral']) {
              if (sections[key]) {
                const c = SECTION_COLORS[key] || { text: 'text-on-surface-variant' };
                items.push({ label: key, color: c.text, content: <span className="text-[11px]">{sections[key]}</span> });
              }
            }

            return (
              <div key={note.id || i} className="rounded-lg border overflow-hidden">
                {/* Visit header */}
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                  onClick={() => setExpandedVisit(isExpanded ? null : i)}
                >
                  <CalendarDays className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs font-bold text-primary flex-1">{dateStr}</span>
                  {note.doctor?.user && (
                    <span className="text-[10px] text-muted-foreground">
                      Dr. {note.doctor.user.firstName}
                    </span>
                  )}
                  <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform ml-1', isExpanded && 'rotate-180')} />
                </button>

                {/* Collapsed: one-line summary */}
                {!isExpanded && items.length > 0 && (
                  <div className="px-3 py-1.5 border-t border-dashed text-[11px] text-muted-foreground truncate">
                    {items.slice(0, 3).map((item, idx) => (
                      <span key={item.label}>
                        {idx > 0 && <span className="mx-1.5">·</span>}
                        <span className={cn('font-semibold', item.color)}>{item.label}</span>
                      </span>
                    ))}
                    {items.length > 3 && <span className="ml-1.5 text-muted-foreground/50">+{items.length - 3} more</span>}
                  </div>
                )}

                {/* Expanded: clean flat list */}
                {isExpanded && (
                  <div className="divide-y">
                    {items.map((item) => (
                      <div key={item.label} className="px-3 py-2">
                        <span className={cn('text-[10px] font-bold uppercase tracking-wide', item.color)}>{item.label}</span>
                        <div className="mt-0.5 text-foreground/80 leading-relaxed">{item.content}</div>
                      </div>
                    ))}
                    {items.length === 0 && note.content && (
                      <div className="px-3 py-2">
                        <p className="text-[11px] text-muted-foreground whitespace-pre-line">{note.content}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          }) || null}

          {/* ── Standalone prescriptions (no matching note) ── */}
          {standaloneRx.map?.((rx: any, i: number) => {
            const rxDate = rx.createdAt
              ? new Date(rx.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'Prescription';
            const rxItems = rx.items || rx.prescriptionItems || [];
            const rxDiags = diagList.filter((d: any) => d.visitId === rx.visitId);

            return (
              <div key={`rx-${rx.id || i}`} className="rounded-lg border overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
                  <CalendarDays className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs font-bold text-primary flex-1">{rxDate}</span>
                  <Badge variant="outline" className="text-[9px] capitalize">{rx.status}</Badge>
                </div>
                <div className="divide-y">
                  {rxDiags.length > 0 && (
                    <div className="px-3 py-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-error">Diagnosis</span>
                      <div className="mt-0.5 text-[11px]">
                        {rxDiags.map((d: any) => d.diagnosisName).join(', ')}
                      </div>
                    </div>
                  )}
                  {rxItems.length > 0 && (
                    <div className="px-3 py-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-primary">Medicines ({rxItems.length})</span>
                      <div className="mt-0.5 space-y-0.5">
                        {rxItems.map((item: any, idx: number) => (
                          <span key={idx} className="text-[11px] block">
                            {idx + 1}. <span className="font-medium">{item.drugName}</span>
                            <span className="text-muted-foreground"> {[item.dosage, item.frequency, item.duration].filter(Boolean).join(' · ')}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          }) || null}
        </div>
      )}
    </PadSection>
  );
}

/** Render prescription lines from progress note content */
function PrescriptionLines({ content }: { content: string }) {
  const lines = content.split('\n').filter((l) => l.trim().startsWith('-'));
  if (lines.length === 0) return <span className="text-[11px]">{content}</span>;

  return (
    <div className="space-y-0.5">
      {lines.map((line, idx) => {
        const cleaned = line.replace(/^-\s*/, '');
        const parts = cleaned.split(' | ');
        const drugName = parts[0] || cleaned;
        const rest = parts.slice(1).join(' · ');
        return (
          <span key={idx} className="text-[11px] block">
            {idx + 1}. <span className="font-medium">{drugName}</span>
            {rest && <span className="text-muted-foreground"> {rest}</span>}
          </span>
        );
      })}
    </div>
  );
}

/** Render vitals in a compact inline format (from progress note text) */
function VitalsGrid({ content }: { content: string }) {
  const lines = content.split('\n').filter((l) => l.trim());
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-0.5">
      {lines.map((line, idx) => {
        const [label, value] = line.split(':').map((s) => s.trim());
        return (
          <span key={idx} className="text-[11px]">
            <span className="text-muted-foreground">{label}:</span> <span className="font-semibold">{value}</span>
          </span>
        );
      })}
    </div>
  );
}

/** Render diagnosis list with badges */
function DiagnosisList({ content }: { content: string }) {
  const lines = content.split('\n').filter((l) => l.trim().startsWith('-'));
  if (lines.length === 0) return <span className="text-[11px]">{content}</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {lines.map((line, idx) => {
        const cleaned = line.replace(/^-\s*/, '');
        const typeMatch = cleaned.match(/\[(\w+)\]$/);
        const diagType = typeMatch?.[1];
        const nameOnly = cleaned.replace(/\s*\[\w+\]\s*$/, '');

        return (
          <span key={idx} className="text-[11px]">
            {nameOnly}
            {diagType && (
              <Badge variant="outline" className={cn(
                'text-[8px] px-1 py-0 capitalize ml-1',
                diagType === 'primary' ? 'border-error/30 text-error' : 'border-outline-variant/30 text-on-surface-variant',
              )}>
                {diagType}
              </Badge>
            )}
            {idx < lines.length - 1 && ','}
          </span>
        );
      })}
    </div>
  );
}
