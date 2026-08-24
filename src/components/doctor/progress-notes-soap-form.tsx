'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFormDraft, useUnsavedChangesWarning } from '@/hooks/use-form-draft';
import { useVisit } from '@/hooks/use-clinical';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  FileText,
  Loader2,
  Lock,
  Pin,
  Plus,
  Stethoscope,
  Trash2,
  X,
  Activity,
  ClipboardList,
  BadgeCheck,
  Sparkles,
  History,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  usePhysicalObservationCatalog,
  useCreateProgressNote,
  useUpdateProgressNote,
  useSmartSuggestions,
  type ProgressNote,
  type SoapSectionPayload,
  type PhysicalObservationCatalogEntry,
  type CreateProgressNoteInput,
  type UpdateProgressNoteInput,
  type ProgressNotePinEntry,
} from '@/hooks/use-doctor';
import { useLatestVitals } from '@/hooks/use-nurse';
import { formatDateTime } from '@/lib/date-utils';
import { toast } from 'sonner';
import { VoiceInputButton } from '@/components/doctor/voice-input-button';
import { formatTemperature } from '@/lib/vitals-temperature';
import { useTemperatureUnitStore } from '@/stores/temperature-unit-store';

// Format a Vital record into a single clinical one-liner suitable for
// pasting into the Objective → Vitals Summary field.
function formatVitalSnapshot(v: any): string {
  if (!v) return '';
  const parts: string[] = [];
  if (v.bloodPressureSystolic && v.bloodPressureDiastolic) {
    parts.push(`BP ${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`);
  }
  if (v.pulseRate ?? v.heartRate) parts.push(`HR ${v.pulseRate ?? v.heartRate}`);
  if (v.temperature) parts.push(`T ${formatTemperature(v.temperature, useTemperatureUnitStore.getState().unit)}`);
  if (v.respiratoryRate) parts.push(`RR ${v.respiratoryRate}`);
  if (v.oxygenSaturation) parts.push(`SpO2 ${v.oxygenSaturation}%`);
  if (v.weightKg ?? v.weight) parts.push(`Wt ${v.weightKg ?? v.weight}kg`);
  if (v.bloodSugar) parts.push(`BGL ${v.bloodSugar}`);
  const when = v.recordedAt ? ` (carried from ${formatDateTime(v.recordedAt)})` : '';
  return parts.length > 0 ? `${parts.join(' · ')}${when}` : '';
}

// ── Section config ──────────────────────────────────────────

const SOAP_TABS = [
  { key: 's', label: 'Subjective', icon: Stethoscope },
  { key: 'o', label: 'Objective', icon: Activity },
  { key: 'a', label: 'Assessment', icon: BadgeCheck },
  { key: 'p', label: 'Plan', icon: ClipboardList },
  { key: 'imp', label: 'Impression', icon: Sparkles },
] as const;

const DISCHARGE_SECTIONS: Array<{ key: ProgressNotePinEntry['dischargeSection']; label: string }> = [
  { key: 'diagnosis', label: 'Diagnosis' },
  { key: 'hospital_course', label: 'Hospital Course' },
  { key: 'procedure', label: 'Procedure' },
  { key: 'medication', label: 'Medication' },
  { key: 'follow_up', label: 'Follow-up' },
  { key: 'advice', label: 'Advice' },
  { key: 'general', label: 'General' },
];

const PHYS_OBS_SYSTEMS: Array<{ key: PhysicalObservationCatalogEntry['system']; label: string }> = [
  { key: 'general', label: 'General' },
  { key: 'cardiovascular', label: 'Cardiovascular' },
  { key: 'respiratory', label: 'Respiratory' },
  { key: 'gastrointestinal', label: 'Gastrointestinal' },
  { key: 'neurological', label: 'Neurological' },
  { key: 'musculoskeletal', label: 'Musculoskeletal' },
  { key: 'skin', label: 'Skin' },
  { key: 'ent', label: 'ENT' },
  { key: 'eye', label: 'Eye' },
  { key: 'genitourinary', label: 'Genitourinary' },
  { key: 'psychiatric', label: 'Psychiatric' },
  { key: 'other', label: 'Other' },
];

// ── Form state shape ────────────────────────────────────────
// Each SOAP sub-section is either a freeform textarea, or a
// catalog-backed multi-select. We keep state flat for ease of edit.

interface FormState {
  // Subjective
  chiefComplaints: string;
  presentIllness: string;
  // Objective
  vitalsSummary: string;
  physicalObservations: Array<{
    source: 'catalog' | 'free_text';
    catalogId?: string;
    value: string;
    system?: string;
  }>;
  investigations: string;
  // Assessment
  diagnosis: string;
  diagnosisCertainty: 'provisional' | 'confirmed';
  differential: string;
  // Plan
  medications: string;
  advice: string;
  followUpDate: string;
  followUpNotes: string;
  furtherProcedures: string;
  // Impression
  impression: string;
  // Pins
  pins: Array<{ dischargeSection: ProgressNotePinEntry['dischargeSection']; content: string }>;
}

function emptyState(): FormState {
  return {
    chiefComplaints: '',
    presentIllness: '',
    vitalsSummary: '',
    physicalObservations: [],
    investigations: '',
    diagnosis: '',
    diagnosisCertainty: 'provisional',
    differential: '',
    medications: '',
    advice: '',
    followUpDate: '',
    followUpNotes: '',
    furtherProcedures: '',
    impression: '',
    pins: [],
  };
}

// Rehydrate FormState from a saved ProgressNote (sub/obj/ass/plan JSON).
function hydrateFromNote(note: ProgressNote): FormState {
  const s = (note.subjective as any) ?? {};
  const o = (note.objective as any) ?? {};
  const a = (note.assessment as any) ?? {};
  const p = (note.plan as any) ?? {};
  return {
    chiefComplaints: s.chiefComplaints ?? '',
    presentIllness: s.presentIllness ?? '',
    vitalsSummary: o.vitalsSummary ?? '',
    physicalObservations: Array.isArray(o.physicalObservations) ? o.physicalObservations : [],
    investigations: o.investigations ?? '',
    diagnosis: a.diagnosis ?? '',
    diagnosisCertainty: a.certainty === 'confirmed' ? 'confirmed' : 'provisional',
    differential: a.differential ?? '',
    medications: p.medications ?? '',
    advice: p.advice ?? '',
    followUpDate: p.followUpDate ?? '',
    followUpNotes: p.followUpNotes ?? '',
    furtherProcedures: p.furtherProcedures ?? '',
    impression: note.impressions ?? '',
    pins:
      note.pins?.map((pin) => ({ dischargeSection: pin.dischargeSection, content: pin.content })) ??
      [],
  };
}

// Build a human-readable markdown summary for the backward-compat
// `content` column — keeps the old list renderer working.
function buildContentSummary(s: FormState): string {
  const parts: string[] = [];
  if (s.chiefComplaints.trim()) parts.push(`**Chief Complaints:**\n${s.chiefComplaints.trim()}`);
  if (s.presentIllness.trim()) parts.push(`**Present Illness:**\n${s.presentIllness.trim()}`);
  if (s.vitalsSummary.trim()) parts.push(`**Vitals:**\n${s.vitalsSummary.trim()}`);
  if (s.physicalObservations.length > 0) {
    const lines = s.physicalObservations.map((po) => `- ${po.value}`).join('\n');
    parts.push(`**Physical Observations:**\n${lines}`);
  }
  if (s.investigations.trim()) parts.push(`**Investigations:**\n${s.investigations.trim()}`);
  if (s.diagnosis.trim()) {
    parts.push(`**Diagnosis (${s.diagnosisCertainty}):**\n${s.diagnosis.trim()}`);
  }
  if (s.differential.trim()) parts.push(`**Differential:**\n${s.differential.trim()}`);
  if (s.medications.trim()) parts.push(`**Medications:**\n${s.medications.trim()}`);
  if (s.advice.trim()) parts.push(`**Advice:**\n${s.advice.trim()}`);
  if (s.followUpDate || s.followUpNotes.trim()) {
    const fu = [s.followUpDate, s.followUpNotes.trim()].filter(Boolean).join(' — ');
    parts.push(`**Follow-up:**\n${fu}`);
  }
  if (s.furtherProcedures.trim()) {
    parts.push(`**Further Procedures:**\n${s.furtherProcedures.trim()}`);
  }
  if (s.impression.trim()) parts.push(`**Impression:**\n${s.impression.trim()}`);
  return parts.join('\n\n');
}

// Convert FormState → backend SOAP payload.
function toSoapPayload(s: FormState): {
  subjective: SoapSectionPayload;
  objective: SoapSectionPayload;
  assessment: SoapSectionPayload;
  plan: SoapSectionPayload;
} {
  return {
    subjective: {
      chiefComplaints: s.chiefComplaints,
      presentIllness: s.presentIllness,
    } as any,
    objective: {
      vitalsSummary: s.vitalsSummary,
      physicalObservations: s.physicalObservations,
      investigations: s.investigations,
    } as any,
    assessment: {
      diagnosis: s.diagnosis,
      certainty: s.diagnosisCertainty,
      differential: s.differential,
    } as any,
    plan: {
      medications: s.medications,
      advice: s.advice,
      followUpDate: s.followUpDate,
      followUpNotes: s.followUpNotes,
      furtherProcedures: s.furtherProcedures,
    } as any,
  };
}

// ── Physical observations picker ─────────────────────────────

function PhysicalObservationsPicker({
  value,
  onChange,
}: {
  value: FormState['physicalObservations'];
  onChange: (next: FormState['physicalObservations']) => void;
}) {
  const [search, setSearch] = useState('');
  const [system, setSystem] = useState<PhysicalObservationCatalogEntry['system'] | 'all'>('all');
  const [freeText, setFreeText] = useState('');

  const { data: catalog = [], isLoading } = usePhysicalObservationCatalog(
    system !== 'all' ? { system, search } : { search },
  );

  const selectedCatalogIds = useMemo(
    () => new Set(value.filter((v) => v.source === 'catalog').map((v) => v.catalogId)),
    [value],
  );

  const addFromCatalog = (entry: PhysicalObservationCatalogEntry) => {
    if (selectedCatalogIds.has(entry.id)) return;
    onChange([
      ...value,
      { source: 'catalog', catalogId: entry.id, value: entry.name, system: entry.system },
    ]);
  };

  const addFreeText = () => {
    const v = freeText.trim();
    if (!v) return;
    onChange([...value, { source: 'free_text', value: v }]);
    setFreeText('');
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      {/* Selected chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((po, idx) => (
            <span
              key={`${po.catalogId ?? 'ft'}-${idx}`}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                po.source === 'catalog'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-secondary/10 text-secondary',
              )}
            >
              {po.value}
              <button
                type="button"
                onClick={() => remove(idx)}
                className="rounded-full hover:bg-background/50 p-0.5"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Filter + search */}
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={system}
          onChange={(e) => setSystem(e.target.value as any)}
          className="h-8 rounded-md border bg-background px-2 text-xs"
        >
          <option value="all">All systems</option>
          {PHYS_OBS_SYSTEMS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search physical findings..."
          className="h-8 text-xs flex-1"
        />
      </div>

      {/* Catalog results */}
      <div className="max-h-40 overflow-y-auto rounded-md border bg-surface-container-lowest">
        {isLoading ? (
          <div className="p-3 text-center text-xs text-muted-foreground">
            <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
            Loading…
          </div>
        ) : catalog.length === 0 ? (
          <div className="p-3 text-center text-xs text-muted-foreground">
            No matching entries — add a custom one below.
          </div>
        ) : (
          <ul className="divide-y">
            {catalog.map((entry) => {
              const selected = selectedCatalogIds.has(entry.id);
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    disabled={selected}
                    onClick={() => addFromCatalog(entry)}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-muted/50',
                      selected && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    <span>{entry.name}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {entry.system}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Free-text entry */}
      <div className="flex gap-2">
        <Input
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addFreeText();
            }
          }}
          placeholder="Custom finding (press Enter to add)"
          className="h-8 text-xs"
        />
        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={addFreeText}>
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>
    </div>
  );
}

// ── Pin editor ───────────────────────────────────────────────

function PinEditor({
  value,
  onChange,
}: {
  value: FormState['pins'];
  onChange: (next: FormState['pins']) => void;
}) {
  const addPin = () => {
    onChange([...value, { dischargeSection: 'general', content: '' }]);
  };
  const removePin = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  const updatePin = (idx: number, patch: Partial<FormState['pins'][number]>) => {
    onChange(value.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  return (
    <div className="space-y-2">
      {value.map((pin, idx) => (
        <div key={idx} className="flex flex-col sm:flex-row gap-2 items-start">
          <select
            value={pin.dischargeSection}
            onChange={(e) =>
              updatePin(idx, {
                dischargeSection: e.target.value as ProgressNotePinEntry['dischargeSection'],
              })
            }
            className="h-8 rounded-md border bg-background px-2 text-xs shrink-0"
          >
            {DISCHARGE_SECTIONS.map((ds) => (
              <option key={ds.key} value={ds.key}>
                {ds.label}
              </option>
            ))}
          </select>
          <Textarea
            value={pin.content}
            onChange={(e) => updatePin(idx, { content: e.target.value })}
            placeholder="Text to carry into the discharge summary for this section…"
            className="flex-1 min-h-[48px] text-xs"
            rows={2}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => removePin(idx)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addPin}>
        <Pin className="h-3 w-3 mr-1" />
        Add discharge pin
      </Button>
      {value.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Pins feed the auto-built discharge summary. Add one per discharge section you want this
          note to contribute to.
        </p>
      )}
    </div>
  );
}

// ── Field block helper ───────────────────────────────────────

function FieldBlock({
  label,
  required,
  children,
  hint,
  voice,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
  /** When set, a mic button is rendered next to the label for dictation. */
  voice?: { value: string; onChange: (next: string) => void };
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        {voice && (
          <VoiceInputButton value={voice.value} onChange={voice.onChange} fieldLabel={label} />
        )}
      </div>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── Main form ───────────────────────────────────────────────

export interface SoapNoteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingNote: ProgressNote | null;
  patient: { id: string; firstName: string; lastName?: string; mrn?: string } | null;
  visitId: string | null;
  admissionId?: string | null;
  onAmendmentsClick?: (note: ProgressNote) => void;
}

export function SoapNoteFormDialog({
  open,
  onOpenChange,
  editingNote,
  patient,
  visitId,
  admissionId,
  onAmendmentsClick,
}: SoapNoteFormDialogProps) {
  // The nurse's intake complaint for this encounter, if one was recorded.
  const { data: visit } = useVisit(open ? visitId : null);
  const nurseComplaint = visit?.nurseChiefComplaint?.trim() || '';
  const isEditing = !!editingNote;
  const wasSigned = !!editingNote?.signedAt;

  const [active, setActive] = useState<string>('s');
  const [state, setState] = useState<FormState>(emptyState());
  const [amendmentReason, setAmendmentReason] = useState('');
  const [saving, setSaving] = useState(false);

  const createMut = useCreateProgressNote();
  const updateMut = useUpdateProgressNote();
  const suggestMut = useSmartSuggestions();
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Latest vitals for carry-forward. Enabled only when we know the
  // patient — editing mode uses the note's own patientId, create mode
  // uses the selected patient.
  const activePatientId = isEditing ? editingNote?.patient?.id ?? '' : patient?.id ?? '';
  const { data: latestVitalsResp } = useLatestVitals(activePatientId);
  const latestVital = (latestVitalsResp as any)?.data ?? null;

  const fetchSuggestions = async () => {
    try {
      const res = await suggestMut.mutateAsync({
        chiefComplaints: state.chiefComplaints || undefined,
        presentIllness: state.presentIllness || undefined,
        vitalsSummary: state.vitalsSummary || undefined,
        physicalObservations: state.physicalObservations.map((po) => ({
          value: po.value,
          system: po.system,
        })),
        investigations: state.investigations || undefined,
        diagnosis: state.diagnosis || undefined,
        certainty: state.diagnosisCertainty,
        medications: state.medications || undefined,
        advice: state.advice || undefined,
        // The server resolves this patient's published labs from here. Sending
        // the id rather than the values keeps the browser out of deciding
        // which results reach a clinical prompt.
        patientId: patient?.id ?? editingNote?.patient?.id,
      });
      setSuggestions(res?.suggestions ?? []);
      if (!res?.suggestions || res.suggestions.length === 0) {
        toast.info('AI returned no suggestions for this note.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to get AI suggestions');
    }
  };

  const appendToAdvice = (text: string) => {
    const next = state.advice ? `${state.advice}\n- ${text}` : `- ${text}`;
    setState((p) => ({ ...p, advice: next }));
    toast.success('Added to Advice');
  };

  // Reset state whenever the dialog opens or the edit target changes.
  useEffect(() => {
    if (!open) return;
    if (editingNote) {
      setState(hydrateFromNote(editingNote));
    } else {
      setState(emptyState());
    }
    setActive('s');
    setAmendmentReason('');
  }, [open, editingNote]);

  // Draft recovery. A note lived in React state until Save, and the access
  // token is 15 minutes — any refresh failure, tab crash or stray reload
  // mid-consultation took the whole thing. Keyed by note or by patient +
  // encounter so one patient's draft can never surface on another's chart.
  const draftKey = editingNote
    ? `soap:note:${editingNote.id}`
    : patient && (visitId || admissionId)
      ? `soap:new:${patient.id}:${visitId ?? admissionId}`
      : null;

  const draft = useFormDraft<FormState>(draftKey, state, open, {
    // An untouched form is not a draft; writing it would overwrite a real one
    // before the doctor has answered the restore prompt.
    isEmpty: (v) => buildContentSummary(v).trim().length === 0,
  });

  // Nag on reload/close only while there is something unsaved to lose.
  useUnsavedChangesWarning(open && buildContentSummary(state).trim().length > 0);

  const canSave = useMemo(() => {
    if (!isEditing && (!patient || !visitId)) return false;
    const content = buildContentSummary(state).trim();
    return content.length > 0;
  }, [isEditing, patient, visitId, state]);

  const handleSave = async () => {
    if (!canSave) {
      toast.error('Please fill in at least one section before saving.');
      return;
    }
    if (wasSigned && !amendmentReason.trim()) {
      toast.error('Amendment reason is required when editing a signed note.');
      return;
    }

    setSaving(true);
    try {
      const content = buildContentSummary(state);
      const soap = toSoapPayload(state);

      if (isEditing && editingNote) {
        const payload: UpdateProgressNoteInput = {
          content,
          impressions: state.impression || null,
          subjective: soap.subjective,
          objective: soap.objective,
          assessment: soap.assessment,
          plan: soap.plan,
          pins: state.pins.filter((p) => p.content.trim().length > 0),
          amendmentReason: amendmentReason.trim() || undefined,
        };
        await updateMut.mutateAsync({ id: editingNote.id, data: payload });
        toast.success('Note updated');
      } else if (patient && visitId) {
        const payload: CreateProgressNoteInput = {
          patientId: patient.id,
          visitId,
          admissionId: admissionId ?? null,
          content,
          impressions: state.impression || null,
          subjective: soap.subjective,
          objective: soap.objective,
          assessment: soap.assessment,
          plan: soap.plan,
          pins: state.pins.filter((p) => p.content.trim().length > 0),
        };
        await createMut.mutateAsync(payload);
        toast.success('Note created');
      }

      // The note is on the server now — the local copy has done its job.
      draft.clear();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            {isEditing ? 'Edit Progress Note (SOAP)' : 'New Progress Note (SOAP)'}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 flex-wrap">
            {patient ? (
              <span className="text-sm">
                {patient.firstName} {patient.lastName ?? ''}{' '}
                {patient.mrn && (
                  <Badge variant="outline" className="text-[10px] ml-1">
                    MRN: {patient.mrn}
                  </Badge>
                )}
              </span>
            ) : isEditing && editingNote?.patient ? (
              <span className="text-sm">
                {editingNote.patient.firstName} {editingNote.patient.lastName}
              </span>
            ) : (
              <span className="text-muted-foreground text-xs">Select a patient first.</span>
            )}
            {wasSigned && (
              <Badge className="gap-1 bg-primary/10 text-primary">
                <Lock className="h-2.5 w-2.5" />
                Previously Signed
              </Badge>
            )}
            {isEditing && editingNote?._count?.amendments ? (
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                onClick={() => onAmendmentsClick?.(editingNote)}
              >
                <History className="h-3 w-3" />
                {editingNote._count.amendments} amendment
                {editingNote._count.amendments === 1 ? '' : 's'}
              </button>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {/* An unsaved note found from a previous session. Offered rather than
            applied silently: the doctor has to be able to see what is about to
            replace what is on screen, and a note is not something to overwrite
            on a guess. */}
        {draft.pending && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50/60 px-3 py-2">
            <RotateCcw className="h-4 w-4 shrink-0 text-amber-700" />
            <p className="flex-1 text-xs text-amber-900">
              An unsaved note from {formatDateTime(new Date(draft.pending.savedAt).toISOString())}{' '}
              was recovered for this patient.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => {
                const data = draft.restore();
                if (data) {
                  setState(data);
                  toast.success('Draft restored');
                }
              }}
            >
              Restore it
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => draft.discard()}
            >
              Discard
            </Button>
          </div>
        )}

        <Tabs value={active} onValueChange={setActive} className="mt-2">
          <TabsList variant="line" className="w-full overflow-x-auto">
            {SOAP_TABS.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger key={t.key} value={t.key} className="gap-1">
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* S — Subjective */}
          <TabsContent value="s" className="space-y-4 pt-4">
            {/* What the nurse was told at intake. Shown as its own statement
                rather than pre-filling the doctor's box: the two are different
                clinical records — the patient's words at the door, and the
                clinician's framing of the problem — and overwriting one with
                the other is what lost the nurse's version before. Copy it in
                if it says what needs saying. */}
            {nurseComplaint && (
              <div className="rounded-xl border border-secondary/30 bg-secondary/5 px-3 py-2">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-label text-[10px] uppercase tracking-widest text-secondary">
                    Nurse intake note
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setState((p) => ({
                        ...p,
                        chiefComplaints: p.chiefComplaints.trim()
                          ? `${p.chiefComplaints.trim()}\n${nurseComplaint}`
                          : nurseComplaint,
                      }))
                    }
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    Copy into my note
                  </button>
                </div>
                <p className="text-sm text-on-surface">{nurseComplaint}</p>
              </div>
            )}
            <FieldBlock
              label="Chief Complaints / Symptoms"
              hint="What the patient reports. Use short phrases separated by commas or new lines."
              voice={{
                value: state.chiefComplaints,
                onChange: (v) => setState((p) => ({ ...p, chiefComplaints: v })),
              }}
            >
              <Textarea
                value={state.chiefComplaints}
                onChange={(e) => setState((p) => ({ ...p, chiefComplaints: e.target.value }))}
                className="min-h-[80px] text-sm"
                rows={3}
                placeholder="e.g. Fever × 3 days, dry cough, fatigue"
              />
            </FieldBlock>
            <FieldBlock
              label="Present Illness / History"
              hint="Timeline, prior treatments, relevant history."
              voice={{
                value: state.presentIllness,
                onChange: (v) => setState((p) => ({ ...p, presentIllness: v })),
              }}
            >
              <Textarea
                value={state.presentIllness}
                onChange={(e) => setState((p) => ({ ...p, presentIllness: e.target.value }))}
                className="min-h-[80px] text-sm"
                rows={3}
              />
            </FieldBlock>
          </TabsContent>

          {/* O — Objective */}
          <TabsContent value="o" className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                  Vitals Summary
                </Label>
                <div className="flex items-center gap-1">
                  {latestVital && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] gap-1"
                      onClick={() => {
                        const snapshot = formatVitalSnapshot(latestVital);
                        if (!snapshot) {
                          toast.error('No recent vitals available to carry forward.');
                          return;
                        }
                        setState((p) => ({ ...p, vitalsSummary: snapshot }));
                        toast.success('Last vitals carried forward');
                      }}
                      title={
                        latestVital.recordedAt
                          ? `Last vitals: ${formatDateTime(latestVital.recordedAt)}`
                          : 'Last vitals'
                      }
                    >
                      <Activity className="h-3 w-3" />
                      Carry forward last
                    </Button>
                  )}
                  <VoiceInputButton
                    value={state.vitalsSummary}
                    onChange={(v) => setState((p) => ({ ...p, vitalsSummary: v }))}
                    fieldLabel="Vitals Summary"
                  />
                </div>
              </div>
              <Textarea
                value={state.vitalsSummary}
                onChange={(e) => setState((p) => ({ ...p, vitalsSummary: e.target.value }))}
                className="min-h-[60px] text-sm"
                rows={2}
                placeholder="e.g. BP 118/76 · HR 88 · T 37.4 · SpO2 97%"
              />
              <p className="text-[11px] text-muted-foreground">
                Stable since last reading? Click <em>Carry forward last</em> to reuse the
                previous snapshot without retyping.
              </p>
            </div>
            <FieldBlock label="Physical Observations" hint="Pick common findings or add custom ones.">
              <PhysicalObservationsPicker
                value={state.physicalObservations}
                onChange={(next) => setState((p) => ({ ...p, physicalObservations: next }))}
              />
            </FieldBlock>
            <FieldBlock
              label="Investigations"
              hint="Lab + imaging results/orders."
              voice={{
                value: state.investigations,
                onChange: (v) => setState((p) => ({ ...p, investigations: v })),
              }}
            >
              <Textarea
                value={state.investigations}
                onChange={(e) => setState((p) => ({ ...p, investigations: e.target.value }))}
                className="min-h-[80px] text-sm"
                rows={3}
                placeholder="e.g. CBC pending · CXR – no acute findings"
              />
            </FieldBlock>
          </TabsContent>

          {/* A — Assessment */}
          <TabsContent value="a" className="space-y-4 pt-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <FieldBlock
                  label="Diagnosis"
                  voice={{
                    value: state.diagnosis,
                    onChange: (v) => setState((p) => ({ ...p, diagnosis: v })),
                  }}
                >
                  <Textarea
                    value={state.diagnosis}
                    onChange={(e) => setState((p) => ({ ...p, diagnosis: e.target.value }))}
                    className="min-h-[80px] text-sm"
                    rows={3}
                    placeholder="e.g. Community-acquired pneumonia"
                  />
                </FieldBlock>
              </div>
              <div>
                <FieldBlock label="Certainty">
                  <div className="flex gap-2">
                    {(['provisional', 'confirmed'] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setState((p) => ({ ...p, diagnosisCertainty: c }))}
                        className={cn(
                          'flex-1 rounded-md border px-2 py-1 text-xs capitalize',
                          state.diagnosisCertainty === c
                            ? 'bg-primary text-on-primary border-primary'
                            : 'bg-background hover:bg-muted',
                        )}
                      >
                        {c === 'confirmed' && <CheckCircle2 className="inline h-3 w-3 mr-1" />}
                        {c}
                      </button>
                    ))}
                  </div>
                </FieldBlock>
              </div>
            </div>
            <FieldBlock
              label="Differential"
              hint="Alternatives to rule in/out."
              voice={{
                value: state.differential,
                onChange: (v) => setState((p) => ({ ...p, differential: v })),
              }}
            >
              <Textarea
                value={state.differential}
                onChange={(e) => setState((p) => ({ ...p, differential: e.target.value }))}
                className="min-h-[60px] text-sm"
                rows={2}
              />
            </FieldBlock>
          </TabsContent>

          {/* P — Plan */}
          <TabsContent value="p" className="space-y-4 pt-4">
            {/* AI Smart Suggestions */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="font-label text-[10px] uppercase tracking-widest text-primary font-semibold">
                    Smart Suggestions
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={fetchSuggestions}
                  disabled={suggestMut.isPending}
                >
                  {suggestMut.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  {suggestions.length > 0 ? 'Regenerate' : 'Suggest next steps'}
                </Button>
              </div>
              {suggestions.length > 0 ? (
                <ul className="space-y-1.5">
                  {suggestions.map((s, i) => (
                    <li
                      key={i}
                      className="flex items-start justify-between gap-2 rounded-md bg-surface-container-lowest p-2"
                    >
                      <span className="text-xs flex-1">{s}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] shrink-0"
                        onClick={() => appendToAdvice(s)}
                      >
                        Add to advice
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Uses the current SOAP state to suggest 3 next steps (investigations, treatment
                  tweaks, follow-up). Always review before acting.
                </p>
              )}
            </div>

            <FieldBlock
              label="Medications"
              voice={{
                value: state.medications,
                onChange: (v) => setState((p) => ({ ...p, medications: v })),
              }}
            >
              <Textarea
                value={state.medications}
                onChange={(e) => setState((p) => ({ ...p, medications: e.target.value }))}
                className="min-h-[80px] text-sm"
                rows={3}
                placeholder="Attach via the Prescription Pad for actual drug orders."
              />
            </FieldBlock>
            <FieldBlock
              label="Advice"
              voice={{
                value: state.advice,
                onChange: (v) => setState((p) => ({ ...p, advice: v })),
              }}
            >
              <Textarea
                value={state.advice}
                onChange={(e) => setState((p) => ({ ...p, advice: e.target.value }))}
                className="min-h-[60px] text-sm"
                rows={2}
              />
            </FieldBlock>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <FieldBlock label="Follow-up Date">
                  <Input
                    type="date"
                    value={state.followUpDate}
                    onChange={(e) => setState((p) => ({ ...p, followUpDate: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </FieldBlock>
              </div>
              <div className="md:col-span-2">
                <FieldBlock
                  label="Follow-up Notes"
                  voice={{
                    value: state.followUpNotes,
                    onChange: (v) => setState((p) => ({ ...p, followUpNotes: v })),
                  }}
                >
                  <Input
                    value={state.followUpNotes}
                    onChange={(e) => setState((p) => ({ ...p, followUpNotes: e.target.value }))}
                    className="h-8 text-sm"
                    placeholder="e.g. Review labs; reassess symptoms"
                  />
                </FieldBlock>
              </div>
            </div>
            <FieldBlock
              label="Further Procedures"
              voice={{
                value: state.furtherProcedures,
                onChange: (v) => setState((p) => ({ ...p, furtherProcedures: v })),
              }}
            >
              <Textarea
                value={state.furtherProcedures}
                onChange={(e) => setState((p) => ({ ...p, furtherProcedures: e.target.value }))}
                className="min-h-[60px] text-sm"
                rows={2}
              />
            </FieldBlock>
          </TabsContent>

          {/* Impression */}
          <TabsContent value="imp" className="space-y-4 pt-4">
            <FieldBlock
              label="Impression (Clinical Notes)"
              hint="Free narrative — serves as the official clinical note."
              voice={{
                value: state.impression,
                onChange: (v) => setState((p) => ({ ...p, impression: v })),
              }}
            >
              <Textarea
                value={state.impression}
                onChange={(e) => setState((p) => ({ ...p, impression: e.target.value }))}
                className="min-h-[200px] text-sm"
                rows={8}
              />
            </FieldBlock>
          </TabsContent>
        </Tabs>

        {/* Pins — always visible under the tabs */}
        <div className="mt-4 space-y-2 rounded-lg border p-3 bg-surface-container-lowest">
          <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant flex items-center gap-1">
            <Pin className="h-3 w-3" />
            Pin To Discharge Summary
          </Label>
          <PinEditor
            value={state.pins}
            onChange={(pins) => setState((p) => ({ ...p, pins }))}
          />
        </div>

        {/* Amendment reason — only shown when editing a signed note */}
        {wasSigned && (
          <div className="mt-4 space-y-1.5 rounded-lg border border-secondary/50 p-3 bg-secondary/5">
            <div className="flex items-center justify-between gap-2">
              <Label className="font-label text-[10px] uppercase tracking-widest text-secondary">
                Amendment Reason <span className="text-destructive">*</span>
              </Label>
              <VoiceInputButton
                value={amendmentReason}
                onChange={setAmendmentReason}
                fieldLabel="Amendment Reason"
              />
            </div>
            <Textarea
              value={amendmentReason}
              onChange={(e) => setAmendmentReason(e.target.value)}
              placeholder="Why are you amending this signed note? (Required)"
              className="min-h-[60px] text-sm"
              rows={2}
            />
            <p className="text-[11px] text-muted-foreground">
              The original note stays intact. Each changed field becomes a separate amendment entry
              with previous/new values, your user ID, and this reason.
            </p>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={!canSave || saving}>
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            {isEditing ? 'Save Amendment' : 'Save Note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
