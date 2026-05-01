'use client';

// One consolidated module for all six nursing-form entry dialogs. Each dialog
// is a thin form bound to its mutation hook from use-nursing-forms.ts. Kept
// terse on purpose — these are nurse data-entry forms, not deep clinical
// scoring tools, so the validation lives server-side and the UI only enforces
// the bare minimum (numeric ranges, required fields).

import { useState, useEffect, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCreateAdmissionAssessment,
  useCreatePainAssessment,
  useCreateFallRisk,
  useCreateIntakeOutput,
  useCreateWoundCare,
  useCreateNursingNote,
  type ArrivalMode,
  type ConsciousnessLevel,
  type PainScale,
  type IOEntryType,
  type IOCategory,
  type WoundType,
  type WoundStage,
  type ExudateType,
  type ExudateAmount,
  type WoundStatus,
  type NursingNoteType,
} from '@/hooks/use-nursing-forms';

// ── Shared context for all dialogs ────────────────────────
//
// Pass at least one of visitId / admissionId / appointmentId. The backend
// resolves the missing pieces (Admission ↔ Visit join for IPD, Appointment →
// Visit lookup/auto-create for OPD). The nurse list page hands over
// admissionId for IPD rows, visitId-or-appointmentId for OPD rows.
export interface FormDialogContext {
  patientId: string;
  visitId?: string;
  admissionId?: string;
  appointmentId?: string;
}

interface BaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ctx: FormDialogContext;
  onSuccess?: () => void;
}

function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
}

function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label className="text-xs font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// 1. Admission Assessment
// ──────────────────────────────────────────────────────────

export function AdmissionAssessmentDialog({ open, onOpenChange, ctx, onSuccess }: BaseDialogProps) {
  const [arrivalMode, setArrivalMode] = useState<ArrivalMode | ''>('');
  const [consciousnessLevel, setConsciousnessLevel] = useState<ConsciousnessLevel | ''>('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [allergies, setAllergies] = useState('');
  const [currentMedications, setCurrentMedications] = useState('');
  const [skinCondition, setSkinCondition] = useState('');
  const [mobility, setMobility] = useState('');
  const [nutritionStatus, setNutritionStatus] = useState('');
  const [elimination, setElimination] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('');
  const [religiousNeeds, setReligiousNeeds] = useState('');
  const [kinName, setKinName] = useState('');
  const [kinRelationship, setKinRelationship] = useState('');
  const [kinPhone, setKinPhone] = useState('');
  const [notes, setNotes] = useState('');

  const mutate = useCreateAdmissionAssessment();

  useEffect(() => {
    if (open) return;
    setArrivalMode('');
    setConsciousnessLevel('');
    setChiefComplaint('');
    setAllergies('');
    setCurrentMedications('');
    setSkinCondition('');
    setMobility('');
    setNutritionStatus('');
    setElimination('');
    setPreferredLanguage('');
    setReligiousNeeds('');
    setKinName('');
    setKinRelationship('');
    setKinPhone('');
    setNotes('');
  }, [open]);

  const submit = async () => {
    try {
      await mutate.mutateAsync({
        ...ctx,
        arrivalMode: arrivalMode || undefined,
        consciousnessLevel: consciousnessLevel || undefined,
        chiefComplaint: chiefComplaint || undefined,
        allergies: allergies || undefined,
        currentMedications: currentMedications || undefined,
        skinCondition: skinCondition || undefined,
        mobility: mobility || undefined,
        nutritionStatus: nutritionStatus || undefined,
        elimination: elimination || undefined,
        preferredLanguage: preferredLanguage || undefined,
        religiousNeeds: religiousNeeds || undefined,
        nextOfKin:
          kinName || kinRelationship || kinPhone
            ? { name: kinName || undefined, relationship: kinRelationship || undefined, phone: kinPhone || undefined }
            : undefined,
        notes: notes || undefined,
      });
      toast.success('Admission assessment recorded');
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to record');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Admission Assessment</DialogTitle>
          <DialogDescription>Initial nursing intake on admission/arrival.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <FieldRow>
            <Field label="Arrival mode">
              <Select value={arrivalMode || null} onValueChange={(v) => setArrivalMode((v ?? '') as ArrivalMode | '')}>
                <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ambulance">Ambulance</SelectItem>
                  <SelectItem value="walk_in">Walk-in</SelectItem>
                  <SelectItem value="wheelchair">Wheelchair</SelectItem>
                  <SelectItem value="stretcher">Stretcher</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Consciousness level">
              <Select value={consciousnessLevel || null} onValueChange={(v) => setConsciousnessLevel((v ?? '') as ConsciousnessLevel | '')}>
                <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alert">Alert</SelectItem>
                  <SelectItem value="drowsy">Drowsy</SelectItem>
                  <SelectItem value="confused">Confused</SelectItem>
                  <SelectItem value="unresponsive">Unresponsive</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldRow>

          <Field label="Chief complaint">
            <Textarea value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} rows={2} />
          </Field>

          <FieldRow>
            <Field label="Allergies">
              <Textarea value={allergies} onChange={(e) => setAllergies(e.target.value)} rows={2} />
            </Field>
            <Field label="Current medications">
              <Textarea value={currentMedications} onChange={(e) => setCurrentMedications(e.target.value)} rows={2} />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Skin condition">
              <Input value={skinCondition} onChange={(e) => setSkinCondition(e.target.value)} />
            </Field>
            <Field label="Mobility">
              <Input value={mobility} onChange={(e) => setMobility(e.target.value)} />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Nutrition status">
              <Input value={nutritionStatus} onChange={(e) => setNutritionStatus(e.target.value)} />
            </Field>
            <Field label="Elimination">
              <Input value={elimination} onChange={(e) => setElimination(e.target.value)} />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Preferred language">
              <Input value={preferredLanguage} onChange={(e) => setPreferredLanguage(e.target.value)} />
            </Field>
            <Field label="Religious / cultural needs">
              <Input value={religiousNeeds} onChange={(e) => setReligiousNeeds(e.target.value)} />
            </Field>
          </FieldRow>

          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Next of kin</p>
            <FieldRow>
              <Field label="Name">
                <Input value={kinName} onChange={(e) => setKinName(e.target.value)} />
              </Field>
              <Field label="Relationship">
                <Input value={kinRelationship} onChange={(e) => setKinRelationship(e.target.value)} />
              </Field>
            </FieldRow>
            <Field label="Phone">
              <Input value={kinPhone} onChange={(e) => setKinPhone(e.target.value)} />
            </Field>
          </div>

          <Field label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={mutate.isPending}>
            {mutate.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────────────
// 2. Pain Assessment
// ──────────────────────────────────────────────────────────

export function PainAssessmentDialog({ open, onOpenChange, ctx, onSuccess }: BaseDialogProps) {
  const [painScore, setPainScore] = useState(0);
  const [painScale, setPainScale] = useState<PainScale>('numeric');
  const [painLocation, setPainLocation] = useState('');
  const [painCharacter, setPainCharacter] = useState('');
  const [painOnsetAt, setPainOnsetAt] = useState('');
  const [aggravatingFactors, setAggravatingFactors] = useState('');
  const [relievingFactors, setRelievingFactors] = useState('');
  const [intervention, setIntervention] = useState('');
  const [reassessmentDueAt, setReassessmentDueAt] = useState('');
  const [notes, setNotes] = useState('');

  const mutate = useCreatePainAssessment();

  useEffect(() => {
    if (open) return;
    setPainScore(0);
    setPainScale('numeric');
    setPainLocation('');
    setPainCharacter('');
    setPainOnsetAt('');
    setAggravatingFactors('');
    setRelievingFactors('');
    setIntervention('');
    setReassessmentDueAt('');
    setNotes('');
  }, [open]);

  const submit = async () => {
    try {
      await mutate.mutateAsync({
        ...ctx,
        painScore,
        painScale,
        painLocation: painLocation || undefined,
        painCharacter: painCharacter || undefined,
        painOnsetAt: painOnsetAt ? new Date(painOnsetAt).toISOString() : undefined,
        aggravatingFactors: aggravatingFactors || undefined,
        relievingFactors: relievingFactors || undefined,
        intervention: intervention || undefined,
        reassessmentDueAt: reassessmentDueAt ? new Date(reassessmentDueAt).toISOString() : undefined,
        notes: notes || undefined,
      });
      toast.success('Pain assessment recorded');
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to record');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Pain Assessment</DialogTitle>
          <DialogDescription>0–10 score with location & intervention.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <FieldRow>
            <Field label="Pain score (0–10)" required>
              <Input
                type="number"
                min={0}
                max={10}
                value={painScore}
                onChange={(e) => setPainScore(Math.min(10, Math.max(0, Number(e.target.value) || 0)))}
              />
            </Field>
            <Field label="Scale">
              <Select value={painScale} onValueChange={(v) => setPainScale((v ?? 'numeric') as PainScale)}>
                <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="numeric">Numeric (0–10)</SelectItem>
                  <SelectItem value="faces">Wong-Baker Faces</SelectItem>
                  <SelectItem value="flacc">FLACC</SelectItem>
                  <SelectItem value="pqrst">PQRST</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Location">
              <Input value={painLocation} onChange={(e) => setPainLocation(e.target.value)} />
            </Field>
            <Field label="Character (e.g. dull, sharp)">
              <Input value={painCharacter} onChange={(e) => setPainCharacter(e.target.value)} />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Onset">
              <Input
                type="datetime-local"
                value={painOnsetAt}
                onChange={(e) => setPainOnsetAt(e.target.value)}
              />
            </Field>
            <Field label="Reassessment due">
              <Input
                type="datetime-local"
                value={reassessmentDueAt}
                onChange={(e) => setReassessmentDueAt(e.target.value)}
              />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Aggravating factors">
              <Textarea value={aggravatingFactors} onChange={(e) => setAggravatingFactors(e.target.value)} rows={2} />
            </Field>
            <Field label="Relieving factors">
              <Textarea value={relievingFactors} onChange={(e) => setRelievingFactors(e.target.value)} rows={2} />
            </Field>
          </FieldRow>

          <Field label="Intervention given">
            <Textarea value={intervention} onChange={(e) => setIntervention(e.target.value)} rows={2} />
          </Field>

          <Field label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={mutate.isPending}>
            {mutate.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────────────
// 3. Fall Risk (Morse)
// ──────────────────────────────────────────────────────────

const MORSE_OPTIONS = {
  historyOfFalling: [
    { value: 0, label: 'No' },
    { value: 25, label: 'Yes' },
  ],
  secondaryDiagnosis: [
    { value: 0, label: 'No' },
    { value: 15, label: 'Yes' },
  ],
  ambulatoryAid: [
    { value: 0, label: 'None / bedrest / nurse assist' },
    { value: 15, label: 'Crutches / cane / walker' },
    { value: 30, label: 'Furniture' },
  ],
  ivOrSalineLock: [
    { value: 0, label: 'No' },
    { value: 20, label: 'Yes' },
  ],
  gait: [
    { value: 0, label: 'Normal / bedrest / wheelchair' },
    { value: 10, label: 'Weak' },
    { value: 20, label: 'Impaired' },
  ],
  mentalStatus: [
    { value: 0, label: 'Oriented to own ability' },
    { value: 15, label: 'Forgets limitations' },
  ],
} as const;

function classify(total: number): { label: string; color: string } {
  if (total >= 45) return { label: 'High', color: 'bg-red-100 text-red-700' };
  if (total >= 25) return { label: 'Moderate', color: 'bg-amber-100 text-amber-700' };
  return { label: 'Low', color: 'bg-emerald-100 text-emerald-700' };
}

export function FallRiskDialog({ open, onOpenChange, ctx, onSuccess }: BaseDialogProps) {
  const [historyOfFalling, setHistoryOfFalling] = useState<0 | 25>(0);
  const [secondaryDiagnosis, setSecondaryDiagnosis] = useState<0 | 15>(0);
  const [ambulatoryAid, setAmbulatoryAid] = useState<0 | 15 | 30>(0);
  const [ivOrSalineLock, setIvOrSalineLock] = useState<0 | 20>(0);
  const [gait, setGait] = useState<0 | 10 | 20>(0);
  const [mentalStatus, setMentalStatus] = useState<0 | 15>(0);
  const [intervention, setIntervention] = useState('');
  const [notes, setNotes] = useState('');

  const total =
    historyOfFalling + secondaryDiagnosis + ambulatoryAid + ivOrSalineLock + gait + mentalStatus;
  const band = classify(total);

  const mutate = useCreateFallRisk();

  useEffect(() => {
    if (open) return;
    setHistoryOfFalling(0);
    setSecondaryDiagnosis(0);
    setAmbulatoryAid(0);
    setIvOrSalineLock(0);
    setGait(0);
    setMentalStatus(0);
    setIntervention('');
    setNotes('');
  }, [open]);

  const submit = async () => {
    try {
      await mutate.mutateAsync({
        ...ctx,
        historyOfFalling,
        secondaryDiagnosis,
        ambulatoryAid,
        ivOrSalineLock,
        gait,
        mentalStatus,
        intervention: intervention || undefined,
        notes: notes || undefined,
      });
      toast.success('Fall risk recorded');
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to record');
    }
  };

  function MorseField<T extends number>({
    label,
    value,
    onChange,
    options,
  }: {
    label: string;
    value: T;
    onChange: (v: T) => void;
    options: ReadonlyArray<{ value: number; label: string }>;
  }) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center py-1.5 border-b last:border-0">
        <Label className="text-xs font-medium sm:col-span-1">{label}</Label>
        <div className="sm:col-span-2 flex flex-wrap gap-1.5">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={cn(
                'rounded-md border px-2.5 py-1 text-[11px] transition-colors',
                value === (o.value as number)
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-input hover:bg-muted',
              )}
              onClick={() => onChange(o.value as T)}
            >
              {o.label} <span className="opacity-70">({o.value})</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Morse Fall Scale</DialogTitle>
          <DialogDescription>Pick one option per row. Score & risk band update live.</DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <MorseField label="History of falling" value={historyOfFalling} onChange={setHistoryOfFalling} options={MORSE_OPTIONS.historyOfFalling} />
          <MorseField label="Secondary diagnosis" value={secondaryDiagnosis} onChange={setSecondaryDiagnosis} options={MORSE_OPTIONS.secondaryDiagnosis} />
          <MorseField label="Ambulatory aid" value={ambulatoryAid} onChange={setAmbulatoryAid} options={MORSE_OPTIONS.ambulatoryAid} />
          <MorseField label="IV / saline lock" value={ivOrSalineLock} onChange={setIvOrSalineLock} options={MORSE_OPTIONS.ivOrSalineLock} />
          <MorseField label="Gait" value={gait} onChange={setGait} options={MORSE_OPTIONS.gait} />
          <MorseField label="Mental status" value={mentalStatus} onChange={setMentalStatus} options={MORSE_OPTIONS.mentalStatus} />
        </div>

        <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
          <span className="text-sm font-semibold">Total: {total}</span>
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', band.color)}>{band.label} risk</span>
        </div>

        <Field label="Intervention plan">
          <Textarea value={intervention} onChange={(e) => setIntervention(e.target.value)} rows={2} />
        </Field>

        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={mutate.isPending}>
            {mutate.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────────────
// 4. Intake / Output
// ──────────────────────────────────────────────────────────

const IO_INTAKE_CATS: IOCategory[] = ['oral', 'iv_fluid', 'blood_product', 'tube_feed', 'other'];
const IO_OUTPUT_CATS: IOCategory[] = ['urine', 'drain', 'vomit', 'stool', 'other'];
const IO_LABEL: Record<IOCategory, string> = {
  oral: 'Oral',
  iv_fluid: 'IV Fluid',
  blood_product: 'Blood Product',
  tube_feed: 'Tube Feed',
  urine: 'Urine',
  drain: 'Drain',
  vomit: 'Vomit',
  stool: 'Stool',
  other: 'Other',
};

export function IntakeOutputDialog({ open, onOpenChange, ctx, onSuccess }: BaseDialogProps) {
  const [entryType, setEntryType] = useState<IOEntryType>('intake');
  const [category, setCategory] = useState<IOCategory>('oral');
  const [volumeMl, setVolumeMl] = useState(0);
  const [recordDatetime, setRecordDatetime] = useState(() => new Date().toISOString().slice(0, 16));
  const [fluidDescription, setFluidDescription] = useState('');
  const [notes, setNotes] = useState('');

  const mutate = useCreateIntakeOutput();

  useEffect(() => {
    if (open) return;
    setEntryType('intake');
    setCategory('oral');
    setVolumeMl(0);
    setRecordDatetime(new Date().toISOString().slice(0, 16));
    setFluidDescription('');
    setNotes('');
  }, [open]);

  // Snap category to the right side when entry type flips
  useEffect(() => {
    if (entryType === 'intake' && !IO_INTAKE_CATS.includes(category)) setCategory('oral');
    if (entryType === 'output' && !IO_OUTPUT_CATS.includes(category)) setCategory('urine');
  }, [entryType, category]);

  const cats = entryType === 'intake' ? IO_INTAKE_CATS : IO_OUTPUT_CATS;

  const submit = async () => {
    if (volumeMl <= 0) {
      toast.error('Volume must be > 0');
      return;
    }
    try {
      await mutate.mutateAsync({
        visitId: ctx.visitId,
        admissionId: ctx.admissionId,
        appointmentId: ctx.appointmentId,
        patientId: ctx.patientId,
        entryType,
        category,
        volumeMl,
        recordDatetime: new Date(recordDatetime).toISOString(),
        fluidDescription: fluidDescription || undefined,
        notes: notes || undefined,
      });
      toast.success('Recorded');
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to record');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Intake / Output</DialogTitle>
          <DialogDescription>Fluid balance entry.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <FieldRow>
            <Field label="Type" required>
              <Select value={entryType} onValueChange={(v) => setEntryType((v ?? 'intake') as IOEntryType)}>
                <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="intake">Intake</SelectItem>
                  <SelectItem value="output">Output</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Category" required>
              <Select value={category} onValueChange={(v) => setCategory((v ?? 'oral') as IOCategory)}>
                <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cats.map((c) => <SelectItem key={c} value={c}>{IO_LABEL[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Volume (ml)" required>
              <Input
                type="number"
                min={0}
                value={volumeMl}
                onChange={(e) => setVolumeMl(Math.max(0, Number(e.target.value) || 0))}
              />
            </Field>
            <Field label="Date / time" required>
              <Input
                type="datetime-local"
                value={recordDatetime}
                onChange={(e) => setRecordDatetime(e.target.value)}
              />
            </Field>
          </FieldRow>

          <Field label="Description">
            <Input value={fluidDescription} onChange={(e) => setFluidDescription(e.target.value)} placeholder="e.g. Normal saline 0.9%" />
          </Field>

          <Field label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={mutate.isPending}>
            {mutate.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────────────
// 5. Wound Care
// ──────────────────────────────────────────────────────────

export function WoundCareDialog({ open, onOpenChange, ctx, onSuccess }: BaseDialogProps) {
  const [woundLocation, setWoundLocation] = useState('');
  const [woundType, setWoundType] = useState<WoundType | ''>('');
  const [woundStage, setWoundStage] = useState<WoundStage | ''>('');
  const [lengthCm, setLengthCm] = useState<string>('');
  const [widthCm, setWidthCm] = useState<string>('');
  const [depthCm, setDepthCm] = useState<string>('');
  const [exudateType, setExudateType] = useState<ExudateType | ''>('');
  const [exudateAmount, setExudateAmount] = useState<ExudateAmount | ''>('');
  const [dressingApplied, setDressingApplied] = useState('');
  const [treatmentNotes, setTreatmentNotes] = useState('');
  const [assessedAt, setAssessedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [nextAssessmentDue, setNextAssessmentDue] = useState('');
  const [status, setStatus] = useState<WoundStatus>('active');

  const mutate = useCreateWoundCare();

  useEffect(() => {
    if (open) return;
    setWoundLocation('');
    setWoundType('');
    setWoundStage('');
    setLengthCm('');
    setWidthCm('');
    setDepthCm('');
    setExudateType('');
    setExudateAmount('');
    setDressingApplied('');
    setTreatmentNotes('');
    setAssessedAt(new Date().toISOString().slice(0, 16));
    setNextAssessmentDue('');
    setStatus('active');
  }, [open]);

  const submit = async () => {
    if (!woundLocation.trim()) {
      toast.error('Wound location is required');
      return;
    }
    try {
      await mutate.mutateAsync({
        visitId: ctx.visitId,
        admissionId: ctx.admissionId,
        appointmentId: ctx.appointmentId,
        patientId: ctx.patientId,
        woundLocation: woundLocation.trim(),
        woundType: woundType || undefined,
        woundStage: woundStage || undefined,
        lengthCm: lengthCm ? Number(lengthCm) : undefined,
        widthCm: widthCm ? Number(widthCm) : undefined,
        depthCm: depthCm ? Number(depthCm) : undefined,
        exudateType: exudateType || undefined,
        exudateAmount: exudateAmount || undefined,
        dressingApplied: dressingApplied || undefined,
        treatmentNotes: treatmentNotes || undefined,
        assessedAt: new Date(assessedAt).toISOString(),
        nextAssessmentDue: nextAssessmentDue ? new Date(nextAssessmentDue).toISOString() : undefined,
        status,
      });
      toast.success('Wound care recorded');
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to record');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Wound Care</DialogTitle>
          <DialogDescription>Wound assessment & dressing.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <FieldRow>
            <Field label="Location" required>
              <Input value={woundLocation} onChange={(e) => setWoundLocation(e.target.value)} placeholder="e.g. Sacrum" />
            </Field>
            <Field label="Type">
              <Select value={woundType || null} onValueChange={(v) => setWoundType((v ?? '') as WoundType | '')}>
                <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="surgical">Surgical</SelectItem>
                  <SelectItem value="pressure_ulcer">Pressure ulcer</SelectItem>
                  <SelectItem value="laceration">Laceration</SelectItem>
                  <SelectItem value="burn">Burn</SelectItem>
                  <SelectItem value="diabetic_ulcer">Diabetic ulcer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Stage">
              <Select value={woundStage || null} onValueChange={(v) => setWoundStage((v ?? '') as WoundStage | '')}>
                <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stage_1">Stage 1</SelectItem>
                  <SelectItem value="stage_2">Stage 2</SelectItem>
                  <SelectItem value="stage_3">Stage 3</SelectItem>
                  <SelectItem value="stage_4">Stage 4</SelectItem>
                  <SelectItem value="unstageable">Unstageable</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={status} onValueChange={(v) => setStatus((v ?? 'active') as WoundStatus)}>
                <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="healing">Healing</SelectItem>
                  <SelectItem value="healed">Healed</SelectItem>
                  <SelectItem value="worsening">Worsening</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldRow>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Length (cm)">
              <Input type="number" step="0.1" value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} />
            </Field>
            <Field label="Width (cm)">
              <Input type="number" step="0.1" value={widthCm} onChange={(e) => setWidthCm(e.target.value)} />
            </Field>
            <Field label="Depth (cm)">
              <Input type="number" step="0.1" value={depthCm} onChange={(e) => setDepthCm(e.target.value)} />
            </Field>
          </div>

          <FieldRow>
            <Field label="Exudate type">
              <Select value={exudateType || null} onValueChange={(v) => setExudateType((v ?? '') as ExudateType | '')}>
                <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="serous">Serous</SelectItem>
                  <SelectItem value="sanguineous">Sanguineous</SelectItem>
                  <SelectItem value="purulent">Purulent</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Exudate amount">
              <Select value={exudateAmount || null} onValueChange={(v) => setExudateAmount((v ?? '') as ExudateAmount | '')}>
                <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="scant">Scant</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="heavy">Heavy</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldRow>

          <Field label="Dressing applied">
            <Input value={dressingApplied} onChange={(e) => setDressingApplied(e.target.value)} />
          </Field>

          <Field label="Treatment notes">
            <Textarea value={treatmentNotes} onChange={(e) => setTreatmentNotes(e.target.value)} rows={3} />
          </Field>

          <FieldRow>
            <Field label="Assessed at" required>
              <Input type="datetime-local" value={assessedAt} onChange={(e) => setAssessedAt(e.target.value)} />
            </Field>
            <Field label="Next assessment due">
              <Input type="datetime-local" value={nextAssessmentDue} onChange={(e) => setNextAssessmentDue(e.target.value)} />
            </Field>
          </FieldRow>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={mutate.isPending}>
            {mutate.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────────────
// 6. Nursing Daily Note
// ──────────────────────────────────────────────────────────

export function NursingNoteDialog({ open, onOpenChange, ctx, onSuccess }: BaseDialogProps) {
  const [noteType, setNoteType] = useState<NursingNoteType>('general');
  const [content, setContent] = useState('');

  const mutate = useCreateNursingNote();

  useEffect(() => {
    if (open) return;
    setNoteType('general');
    setContent('');
  }, [open]);

  const submit = async () => {
    if (!content.trim()) {
      toast.error('Note content is required');
      return;
    }
    try {
      await mutate.mutateAsync({
        visitId: ctx.visitId,
        patientId: ctx.patientId,
        admissionId: ctx.admissionId,
        appointmentId: ctx.appointmentId,
        noteType,
        content: content.trim(),
      });
      toast.success('Note saved');
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to save');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Nursing Note</DialogTitle>
          <DialogDescription>Free-text shift observation.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Type">
            <Select value={noteType} onValueChange={(v) => setNoteType((v ?? 'general') as NursingNoteType)}>
              <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="observation">Observation</SelectItem>
                <SelectItem value="wound_care">Wound care</SelectItem>
                <SelectItem value="iv_line">IV line</SelectItem>
                <SelectItem value="intake_output">Intake / output</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Content" required>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={mutate.isPending}>
            {mutate.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
