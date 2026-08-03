'use client';

// PatientHistoryPanel
// ──────────────────────────────────────────────────────────────────────────
// The patient's longitudinal history — medical & surgical narrative, personal
// / lifestyle history, family history and allergies — in one tabbed panel.
//
// Used by every clinical surface so the same record is visible wherever the
// patient is being treated:
//   • /doctor/consultation/[patientId]          (OP)
//   • IPPatientWorkspace "History" tab          (IP / emergency / day-care,
//                                                doctor + nurse + admin)
//   • /nurse/forms/[patientId] "History" tab    (nurse, any encounter type)
//
// `readOnly` renders the same content without any write affordance — used for
// roles that hold `patients:read` but not `patients:update` (e.g. nurse_admin).

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, Users, AlertTriangle, Plus, Trash2, Save, Stethoscope, Loader2 } from 'lucide-react';
import { apiGet, apiPut, apiPost, apiDelete } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/date-utils';

type Tab = 'medical' | 'personal' | 'family' | 'allergies';

export interface PatientHistoryPanelProps {
  patientId: string;
  /** Hide every editing affordance (roles without `patients:update`). */
  readOnly?: boolean;
  /** Tab to open on first render. */
  defaultTab?: Tab;
}

export function PatientHistoryPanel({
  patientId,
  readOnly = false,
  defaultTab = 'medical',
}: PatientHistoryPanelProps) {
  // Medical & Surgical leads: it is the clinical narrative (past illnesses,
  // past surgeries, diagnoses and the doctors' own consultation notes).
  // Personal keeps the lifestyle fields it always held.
  const [tab, setTab] = useState<Tab>(defaultTab);

  return (
    <div>
      <div className="flex flex-wrap gap-1 pb-3">
        {(
          [
            { key: 'medical', label: 'Medical & Surgical', icon: Stethoscope },
            { key: 'personal', label: 'Personal', icon: Heart },
            { key: 'family', label: 'Family', icon: Users },
            { key: 'allergies', label: 'Allergies', icon: AlertTriangle },
          ] as { key: Tab; label: string; icon: any }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium',
              t.key === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            <t.icon className="h-3 w-3" />
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'medical' && <MedicalSurgicalTab patientId={patientId} readOnly={readOnly} />}
        {tab === 'personal' && <PersonalTab patientId={patientId} readOnly={readOnly} />}
        {tab === 'family' && <FamilyTab patientId={patientId} readOnly={readOnly} />}
        {tab === 'allergies' && <AllergiesTab patientId={patientId} readOnly={readOnly} />}
      </div>
    </div>
  );
}

// Query keys are shared across roles on purpose — a nurse saving the personal
// history in the IP workspace should invalidate the doctor's copy of it.
export const personalKey = (patientId: string) => ['patient-history', 'personal', patientId] as const;
export const medicalKey = (patientId: string) => ['patient-history', 'medical-surgical', patientId] as const;
export const familyKey = (patientId: string) => ['patient-history', 'family', patientId] as const;
export const allergiesKey = (patientId: string) => ['patient-history', 'allergies', patientId] as const;

// These rows have three authors — the patient (portal), the doctor and the
// nurse — so the app-wide 60s staleTime / no-refetch-on-focus defaults are
// wrong here: a doctor would keep looking at habits the patient changed
// minutes ago. Always refetch on mount and when the tab regains focus.
export const LIVE = {
  staleTime: 0,
  refetchOnMount: 'always',
  refetchOnWindowFocus: true,
} as const;

// ── Medical & Surgical History ───────────────────────────────────────────
//
// Past medical treatments, past surgeries, every diagnosis on file, and the
// consultation notes/summaries the doctors have written.

interface MedicalSurgical {
  pastMedicalHistory: string | null;
  pastSurgicalHistory: string | null;
  disorders: string | null;
  diagnoses: Array<{
    id: string;
    diagnosisName: string;
    icdCode: string | null;
    diagnosisType: string;
    notes: string | null;
    recordedAt: string;
    visitType: string | null;
    doctorName: string | null;
  }>;
  consultationNotes: Array<{
    id: string;
    noteType: string | null;
    content: string;
    impressions: string | null;
    conclusions: string | null;
    recordedAt: string;
    visitType: string | null;
    isInpatient: boolean;
    doctorName: string | null;
  }>;
}

function MedicalSurgicalTab({ patientId, readOnly }: { patientId: string; readOnly: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: medicalKey(patientId),
    queryFn: async () => {
      const res = await apiGet<MedicalSurgical>(`/medical-history/${patientId}/medical-surgical`);
      return res.data ?? null;
    },
    ...LIVE,
  });

  // The narrative columns live on the personal-history record, so editing them
  // writes back through that endpoint — but only the edited keys; the server
  // merges the rest.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: async () => {
      // Only the edited fields — the server merges. Sending the whole record
      // back would let a page opened before the patient's last portal save
      // overwrite it.
      await apiPut(`/medical-history/${patientId}/personal`, draft);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: medicalKey(patientId) });
      qc.invalidateQueries({ queryKey: personalKey(patientId) });
      setDraft({});
    },
  });

  const narrativeField = (label: string, key: keyof MedicalSurgical & string, placeholder: string) => {
    const value = draft[key] ?? (data?.[key] as string | null) ?? '';
    if (readOnly) {
      return (
        <div>
          <label className="mb-0.5 block text-[10px] font-medium text-foreground/60">{label}</label>
          <p className="whitespace-pre-wrap rounded-md border bg-surface-container-low/50 px-2 py-1 text-xs">
            {value || <span className="italic text-muted-foreground">Not recorded</span>}
          </p>
        </div>
      );
    }
    return (
      <div>
        <label className="mb-0.5 block text-[10px] font-medium text-foreground/60">{label}</label>
        <textarea
          value={value}
          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
          rows={3}
          placeholder={placeholder}
          className="w-full rounded-md border bg-background px-2 py-1 text-xs"
        />
      </div>
    );
  };

  if (isLoading) {
    return (
      <p className="flex items-center gap-1.5 py-4 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading history…
      </p>
    );
  }

  const diagnoses = data?.diagnoses ?? [];
  const notes = data?.consultationNotes ?? [];

  return (
    <div className="space-y-4 text-xs">
      <div className="space-y-2">
        {narrativeField(
          'Past Medical History',
          'pastMedicalHistory',
          'Past illnesses and treatments — diabetes since 2019, hypertension on amlodipine, TB treated 2015…',
        )}
        {narrativeField(
          'Past Surgical History',
          'pastSurgicalHistory',
          'Past procedures with dates — appendicectomy 2018, LSCS 2021…',
        )}
        {narrativeField('Known Disorders', 'disorders', 'Chronic / ongoing disorders')}
        {!readOnly && (
          <div className="flex justify-end">
            <Button
              size="sm"
              className="h-7 gap-1 text-xs"
              disabled={Object.keys(draft).length === 0 || save.isPending}
              onClick={() => save.mutate()}
            >
              <Save className="h-3 w-3" /> Save
            </Button>
          </div>
        )}
      </div>

      <div>
        <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/60">
          Diagnoses ({diagnoses.length})
        </h4>
        {diagnoses.length === 0 ? (
          <p className="italic text-muted-foreground">No diagnoses recorded</p>
        ) : (
          <div className="space-y-1">
            {diagnoses.map((d) => (
              <div key={d.id} className="rounded-md border px-2 py-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold">{d.diagnosisName}</span>
                  {d.icdCode && (
                    <Badge variant="outline" className="px-1 py-0 text-[9px]">
                      {d.icdCode}
                    </Badge>
                  )}
                  <Badge className="px-1 py-0 text-[9px] capitalize">{d.diagnosisType}</Badge>
                  {d.visitType && (
                    <span className="text-[10px] uppercase text-muted-foreground">{d.visitType}</span>
                  )}
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {formatDate(d.recordedAt)}
                  {d.doctorName ? ` · ${d.doctorName}` : ''}
                </p>
                {d.notes && <p className="mt-0.5 text-[11px]">{d.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/60">
          Consultation Notes &amp; Summaries ({notes.length})
        </h4>
        {notes.length === 0 ? (
          <p className="italic text-muted-foreground">No consultation notes recorded</p>
        ) : (
          <div className="space-y-1">
            {notes.map((n) => (
              <div key={n.id} className="rounded-md border px-2 py-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge className="px-1 py-0 text-[9px] capitalize">
                    {n.isInpatient ? 'IP' : (n.visitType ?? 'OP')}
                  </Badge>
                  {n.noteType && (
                    <span className="text-[10px] capitalize text-muted-foreground">
                      {n.noteType.replace(/_/g, ' ')}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {formatDate(n.recordedAt)}
                    {n.doctorName ? ` · ${n.doctorName}` : ''}
                  </span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-[11px]">{n.content}</p>
                {n.impressions && (
                  <p className="mt-0.5 text-[11px]">
                    <span className="text-muted-foreground">Impression: </span>
                    {n.impressions}
                  </p>
                )}
                {n.conclusions && (
                  <p className="mt-0.5 text-[11px]">
                    <span className="text-muted-foreground">Conclusion: </span>
                    {n.conclusions}
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

// ── Personal / lifestyle history ─────────────────────────────────────────

const SMOKING_OPTIONS = [
  { value: '', label: '—' },
  { value: 'never', label: 'Never' },
  { value: 'former', label: 'Former' },
  { value: 'current', label: 'Current' },
];
const ALCOHOL_OPTIONS = [
  { value: '', label: '—' },
  { value: 'none', label: 'None' },
  { value: 'occasional', label: 'Occasional' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'heavy', label: 'Heavy' },
];

function PersonalTab({ patientId, readOnly }: { patientId: string; readOnly: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: personalKey(patientId),
    queryFn: async () => {
      const res = await apiGet<any>(`/medical-history/${patientId}/personal`);
      return res.data ?? {};
    },
    ...LIVE,
  });
  const [form, setForm] = useState<any>({});
  const current = { ...(data || {}), ...form };
  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      await apiPut(`/medical-history/${patientId}/personal`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: personalKey(patientId) });
      qc.invalidateQueries({ queryKey: medicalKey(patientId) });
      setForm({});
    },
  });

  const readValue = (key: string) => {
    const v = current[key];
    return v ? String(v) : null;
  };

  const field = (label: string, key: string, textarea = false) => (
    <div>
      <label className="text-[10px] font-medium text-foreground/60 block mb-0.5">{label}</label>
      {readOnly ? (
        <p className="whitespace-pre-wrap rounded-md border bg-surface-container-low/50 px-2 py-1 text-xs">
          {readValue(key) ?? <span className="italic text-muted-foreground">Not recorded</span>}
        </p>
      ) : textarea ? (
        <textarea
          value={current[key] ?? ''}
          onChange={(e) => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
          rows={2}
          className="w-full rounded-md border bg-background px-2 py-1 text-xs"
        />
      ) : (
        <input
          value={current[key] ?? ''}
          onChange={(e) => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
          className="w-full rounded-md border bg-background px-2 py-1 text-xs"
        />
      )}
    </div>
  );

  // Smoking / alcohol are enum columns on the record and part of every
  // clinical personal-history sheet — they had no UI at all before.
  const choice = (label: string, key: string, options: { value: string; label: string }[]) => (
    <div>
      <label className="text-[10px] font-medium text-foreground/60 block mb-0.5">{label}</label>
      {readOnly ? (
        <p className="rounded-md border bg-surface-container-low/50 px-2 py-1 text-xs capitalize">
          {readValue(key) ?? <span className="italic text-muted-foreground">Not recorded</span>}
        </p>
      ) : (
        <select
          value={current[key] ?? ''}
          onChange={(e) =>
            setForm((f: any) => ({ ...f, [key]: e.target.value === '' ? null : e.target.value }))
          }
          className="w-full rounded-md border bg-background px-2 py-1 text-xs"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <p className="flex items-center gap-1.5 py-4 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading personal history…
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {field('Appetite', 'appetite')}
        {field('Diet', 'diet')}
        {field('Sleep', 'sleepPattern')}
        {field('Exercise', 'exerciseHabits')}
        {choice('Smoking', 'smokingStatus', SMOKING_OPTIONS)}
        {choice('Alcohol', 'alcoholConsumption', ALCOHOL_OPTIONS)}
      </div>
      {field('Disorders', 'disorders', true)}
      {field('Notes', 'notes', true)}
      {!readOnly && (
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={Object.keys(form).length === 0 || mutation.isPending}
            onClick={() => mutation.mutate(form)}
            className="gap-1 text-xs h-7"
          >
            <Save className="h-3 w-3" /> Save
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Family history ───────────────────────────────────────────────────────

interface FamilyEntry {
  id: string;
  conditionName: string;
  relationSide: 'maternal' | 'paternal';
  relationship?: string | null;
  notes?: string | null;
}

function FamilyTab({ patientId, readOnly }: { patientId: string; readOnly: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: familyKey(patientId),
    queryFn: async () => {
      const res = await apiGet<FamilyEntry[]>(`/medical-history/${patientId}/family`);
      return res.data ?? [];
    },
    ...LIVE,
  });
  const [draft, setDraft] = useState<{ conditionName: string; relationSide: string; relationship: string }>({
    conditionName: '',
    relationSide: 'maternal',
    relationship: '',
  });

  const add = useMutation({
    mutationFn: async () => {
      await apiPost(`/medical-history/${patientId}/family`, {
        conditionName: draft.conditionName.trim(),
        relationSide: draft.relationSide,
        ...(draft.relationship.trim() ? { relationship: draft.relationship.trim() } : {}),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: familyKey(patientId) });
      setDraft({ conditionName: '', relationSide: 'maternal', relationship: '' });
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/medical-history/${patientId}/family/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: familyKey(patientId) }),
  });

  const entries = data ?? [];

  return (
    <div className="space-y-1.5 text-xs">
      {readOnly ? (
        <p className="text-[10px] italic text-muted-foreground">
          Read-only. The patient and the treating team manage this.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1">
          <input
            placeholder="Condition (e.g. Diabetes)"
            value={draft.conditionName}
            onChange={(e) => setDraft((d) => ({ ...d, conditionName: e.target.value }))}
            className="min-w-[8rem] flex-1 rounded-md border bg-background px-2 py-1 text-xs"
          />
          <input
            placeholder="Relation (e.g. Mother)"
            value={draft.relationship}
            onChange={(e) => setDraft((d) => ({ ...d, relationship: e.target.value }))}
            className="w-28 rounded-md border bg-background px-2 py-1 text-xs"
          />
          <select
            value={draft.relationSide}
            onChange={(e) => setDraft((d) => ({ ...d, relationSide: e.target.value }))}
            className="rounded-md border bg-background px-1 text-xs"
          >
            <option value="maternal">Maternal</option>
            <option value="paternal">Paternal</option>
          </select>
          <Button
            size="sm"
            disabled={!draft.conditionName.trim() || add.isPending}
            onClick={() => add.mutate()}
            className="h-7 px-2"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">No family history recorded</p>
      ) : (
        entries.map((e) => (
          <div key={e.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold">{e.conditionName}</span>
                <Badge className="px-1 py-0 text-[9px] capitalize">{e.relationSide}</Badge>
                {e.relationship && <span className="text-muted-foreground">· {e.relationship}</span>}
              </div>
              {e.notes && <p className="text-[10px] text-foreground/70">{e.notes}</p>}
            </div>
            {!readOnly && (
              <button onClick={() => remove.mutate(e.id)} className="p-1" aria-label="Remove entry">
                <Trash2 className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ── Allergies ────────────────────────────────────────────────────────────

function AllergiesTab({ patientId, readOnly }: { patientId: string; readOnly: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: allergiesKey(patientId),
    queryFn: async () => {
      const res = await apiGet<any[]>(`/medical-history/${patientId}/allergies`);
      return res.data ?? [];
    },
    ...LIVE,
  });
  const [draft, setDraft] = useState<any>({ allergyType: 'drug', severity: 'mild' });
  const add = useMutation({
    mutationFn: async (p: any) => {
      await apiPost(`/medical-history/${patientId}/allergies`, p);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: allergiesKey(patientId) });
      setDraft({ allergyType: 'drug', severity: 'mild' });
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/medical-history/${patientId}/allergies/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: allergiesKey(patientId) }),
  });

  const entries = data ?? [];

  return (
    <div className="space-y-2 text-xs">
      {!readOnly && (
        <div className="flex gap-1">
          <input
            placeholder="Allergen"
            value={draft.allergen ?? ''}
            onChange={(e) => setDraft((d: any) => ({ ...d, allergen: e.target.value }))}
            className="flex-1 rounded-md border bg-background px-2 py-1 text-xs"
          />
          <select
            value={draft.allergyType}
            onChange={(e) => setDraft((d: any) => ({ ...d, allergyType: e.target.value }))}
            className="rounded-md border bg-background px-1 text-xs"
          >
            <option value="drug">Drug</option>
            <option value="food">Food</option>
            <option value="environmental">Env</option>
            <option value="other">Other</option>
          </select>
          <select
            value={draft.severity}
            onChange={(e) => setDraft((d: any) => ({ ...d, severity: e.target.value }))}
            className="rounded-md border bg-background px-1 text-xs"
          >
            <option value="mild">Mild</option>
            <option value="moderate">Mod</option>
            <option value="severe">Severe</option>
            <option value="life_threatening">LT</option>
          </select>
          <Button
            size="sm"
            disabled={!draft.allergen || add.isPending}
            onClick={() => add.mutate(draft)}
            className="h-7 px-2"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="italic text-muted-foreground">No allergies</p>
      ) : (
        entries.map((a: any) => (
          <div key={a.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-error" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1">
                <span className="font-semibold">{a.allergen}</span>
                <Badge className="px-1 py-0 text-[9px] uppercase">{a.allergyType}</Badge>
                {a.severity && <span className="text-[10px] text-muted-foreground">{a.severity}</span>}
              </div>
              {a.reaction && <span className="text-[10px] text-foreground/70">{a.reaction}</span>}
            </div>
            {!readOnly && (
              <button onClick={() => remove.mutate(a.id)} className="p-1" aria-label="Remove allergy">
                <Trash2 className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
