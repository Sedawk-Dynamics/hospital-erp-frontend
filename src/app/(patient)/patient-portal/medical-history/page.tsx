'use client';

import { useId, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, Users, AlertTriangle, Plus, Trash2, Save } from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';

// The doctor and nurse write these same rows from the hospital side, so the
// app-wide 60s staleTime / no-refetch-on-focus defaults would leave a patient
// looking at a record their clinician has already updated. Always refetch.
const LIVE = {
  staleTime: 0,
  refetchOnMount: 'always',
  refetchOnWindowFocus: true,
} as const;

type Tab = 'personal' | 'family' | 'allergies';

export default function MedicalHistoryPage() {
  const [tab, setTab] = useState<Tab>('personal');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-2">
          Care Records
        </p>
        <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
          Medical History
        </h1>
        <p className="font-label text-sm text-on-surface-variant mt-1.5">
          Personal habits, family conditions, and allergies
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(
          [
            { key: 'personal', label: 'Personal', icon: Heart },
            { key: 'family', label: 'Family', icon: Users },
            { key: 'allergies', label: 'Allergies', icon: AlertTriangle },
          ] as { key: Tab; label: string; icon: typeof Heart }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-4 py-1.5 font-label text-xs font-bold transition-colors',
              t.key === tab
                ? 'bg-primary text-white'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'personal' && <PersonalTab />}
      {tab === 'family' && <FamilyTab />}
      {tab === 'allergies' && <AllergiesTab />}
    </div>
  );
}

// ───────────────────── Personal Tab ─────────────────────

interface PersonalHistory {
  appetite?: string | null;
  diet?: string | null;
  sleepPattern?: string | null;
  disorders?: string | null;
  exerciseHabits?: string | null;
  smokingStatus?: string | null;
  alcoholConsumption?: string | null;
  notes?: string | null;
}

const FIELD_CLASS =
  'w-full rounded-lg bg-surface-container-low border border-outline-variant/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';

/**
 * These two live at MODULE scope on purpose.
 *
 * They used to be declared inside PersonalTab's body, so every keystroke ran
 * setForm → PersonalTab re-rendered → the component functions were re-created
 * with a fresh identity → React saw a different component type and unmounted /
 * remounted the <input>. The field lost focus after every single character and
 * the tab was unusable. Never define a component inside another component's
 * render.
 */
const LABEL_CLASS = 'font-label text-xs font-bold text-on-surface-variant block mb-1.5';

function TextField({
  label,
  value,
  onChange,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
}) {
  // The label was a bare sibling of the control, so nothing tied the two
  // together — a screen reader read an unlabelled box, and clicking the label
  // didn't focus the field.
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      {textarea ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={FIELD_CLASS}
        />
      ) : (
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={FIELD_CLASS}
        />
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD_CLASS}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function PersonalTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['patient', 'personal-history'],
    queryFn: async () => {
      const res = await apiGet<PersonalHistory | null>('/patient-portal/medical-history/personal');
      return res.data ?? {};
    },
    ...LIVE,
  });
  const [form, setForm] = useState<PersonalHistory>({});
  const current = { ...(data || {}), ...form };

  const mutation = useMutation({
    mutationFn: async (payload: PersonalHistory) => {
      const res = await apiPut<PersonalHistory>('/patient-portal/medical-history/personal', payload);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', 'personal-history'] });
      setForm({});
    },
    // Without this the failure was invisible AND the typed values stayed on
    // screen — `setForm({})` only runs on success and the fields render
    // `{...data, ...form}`, so a rejected save looked exactly like a saved one.
    onError: (err) => toast.error(getApiErrorMessage(err) || 'Could not save your history'),
  });

  const valueOf = (field: keyof PersonalHistory) =>
    ((current as Record<string, unknown>)[field] as string | null | undefined) ?? '';
  // Text fields keep '' (the column is nullable but an empty string round-trips
  // fine); a cleared SELECT writes null so "no answer" is distinguishable.
  const setText = (field: keyof PersonalHistory) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }));
  const setChoice = (field: keyof PersonalHistory) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value || null }));

  if (isLoading) return <Loader />;

  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField label="Appetite" value={valueOf('appetite')} onChange={setText('appetite')} />
        <TextField label="Diet" value={valueOf('diet')} onChange={setText('diet')} />
        <TextField label="Sleep Pattern" value={valueOf('sleepPattern')} onChange={setText('sleepPattern')} />
        <TextField label="Exercise Habits" value={valueOf('exerciseHabits')} onChange={setText('exerciseHabits')} />
        <SelectField
          label="Smoking"
          value={valueOf('smokingStatus')}
          onChange={setChoice('smokingStatus')}
          options={['never', 'former', 'current']}
        />
        <SelectField
          label="Alcohol"
          value={valueOf('alcoholConsumption')}
          onChange={setChoice('alcoholConsumption')}
          options={['none', 'occasional', 'moderate', 'heavy']}
        />
      </div>
      <TextField label="Disorders" value={valueOf('disorders')} onChange={setText('disorders')} textarea />
      <TextField label="Notes" value={valueOf('notes')} onChange={setText('notes')} textarea />

      <div className="flex justify-end">
        <Button
          disabled={mutation.isPending || Object.keys(form).length === 0}
          onClick={() => mutation.mutate(form)}
          className="gap-1.5"
        >
          <Save className="h-3.5 w-3.5" />
          {mutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

// ───────────────────── Family Tab ─────────────────────

interface FamilyEntry {
  id: string;
  conditionName: string;
  relationSide: 'maternal' | 'paternal';
  relationship?: string | null;
  notes?: string | null;
}

function FamilyTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['patient', 'family-history'],
    queryFn: async () => {
      const res = await apiGet<FamilyEntry[]>('/patient-portal/medical-history/family');
      return res.data ?? [];
    },
    ...LIVE,
  });
  const [draft, setDraft] = useState<Partial<FamilyEntry>>({ relationSide: 'maternal' });

  const add = useMutation({
    mutationFn: async (payload: Partial<FamilyEntry>) => {
      await apiPost('/patient-portal/medical-history/family', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', 'family-history'] });
      setDraft({ relationSide: 'maternal' });
    },
    onError: (err) => toast.error(getApiErrorMessage(err) || 'Could not add that family history'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/patient-portal/medical-history/family/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient', 'family-history'] }),
    onError: (err) => toast.error(getApiErrorMessage(err) || 'Could not remove that entry'),
  });

  const entries = data ?? [];
  const maternal = entries.filter((e) => e.relationSide === 'maternal');
  const paternal = entries.filter((e) => e.relationSide === 'paternal');

  const inputClass =
    'rounded-lg bg-surface-container-low border border-outline-variant/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-5">
        <p className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">
          Add condition
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            placeholder="Condition (e.g. Diabetes)"
            value={draft.conditionName ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, conditionName: e.target.value }))}
            className={cn(inputClass, 'md:col-span-2')}
          />
          <select
            value={draft.relationSide}
            onChange={(e) =>
              setDraft((d) => ({ ...d, relationSide: e.target.value as 'maternal' | 'paternal' }))
            }
            className={inputClass}
          >
            <option value="maternal">Maternal</option>
            <option value="paternal">Paternal</option>
          </select>
          <input
            placeholder="Relationship (e.g. Mother)"
            value={draft.relationship ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, relationship: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div className="flex justify-end mt-3">
          <Button
            size="sm"
            disabled={!draft.conditionName || add.isPending}
            onClick={() => add.mutate(draft)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Loader />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FamilyColumn label="Maternal Side" entries={maternal} onRemove={(id) => remove.mutate(id)} />
          <FamilyColumn label="Paternal Side" entries={paternal} onRemove={(id) => remove.mutate(id)} />
        </div>
      )}
    </div>
  );
}

function FamilyColumn({
  label,
  entries,
  onRemove,
}: {
  label: string;
  entries: FamilyEntry[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-5">
      <p className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">
        {label}
      </p>
      {entries.length === 0 ? (
        <p className="font-label text-xs text-outline italic">No entries</p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-start gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-xs"
            >
              <div className="flex-1 min-w-0">
                <p className="font-label font-bold text-on-surface">{e.conditionName}</p>
                {e.relationship && (
                  <p className="font-label text-on-surface-variant">{e.relationship}</p>
                )}
                {e.notes && (
                  <p className="font-label text-on-surface-variant mt-0.5">{e.notes}</p>
                )}
              </div>
              <button
                onClick={() => onRemove(e.id)}
                className="shrink-0 p-1 hover:bg-error-container/40 hover:text-error rounded-md text-on-surface-variant transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ───────────────────── Allergies Tab ─────────────────────

interface AllergyEntry {
  id: string;
  allergen: string;
  allergyType: 'drug' | 'food' | 'environmental' | 'other';
  severity?: string | null;
  reaction?: string | null;
}

function AllergiesTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['patient', 'allergies'],
    queryFn: async () => {
      const res = await apiGet<AllergyEntry[]>('/patient-portal/medical-history/allergies');
      return res.data ?? [];
    },
    ...LIVE,
  });
  const [draft, setDraft] = useState<Partial<AllergyEntry>>({ allergyType: 'drug', severity: 'mild' });

  const add = useMutation({
    mutationFn: async (payload: Partial<AllergyEntry>) => {
      await apiPost('/patient-portal/medical-history/allergies', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', 'allergies'] });
      setDraft({ allergyType: 'drug', severity: 'mild' });
    },
    // An allergy the patient believes is recorded but is not is the worst of
    // these to lose quietly — it feeds the prescribing safety check.
    onError: (err) => toast.error(getApiErrorMessage(err) || 'Could not record that allergy'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/patient-portal/medical-history/allergies/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient', 'allergies'] }),
    onError: (err) => toast.error(getApiErrorMessage(err) || 'Could not remove that allergy'),
  });

  const entries = data ?? [];

  const severityColor: Record<string, string> = {
    mild: 'bg-primary/10 text-primary',
    moderate: 'bg-secondary/10 text-secondary',
    severe: 'bg-secondary/10 text-secondary',
    life_threatening: 'bg-error/10 text-error',
  };

  const inputClass =
    'rounded-lg bg-surface-container-low border border-outline-variant/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-5">
        <p className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">
          Add allergy
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            placeholder="Allergen (e.g. Penicillin)"
            value={draft.allergen ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, allergen: e.target.value }))}
            className={cn(inputClass, 'md:col-span-2')}
          />
          <select
            value={draft.allergyType}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                allergyType: e.target.value as AllergyEntry['allergyType'],
              }))
            }
            className={inputClass}
          >
            <option value="drug">Drug</option>
            <option value="food">Food</option>
            <option value="environmental">Environmental</option>
            <option value="other">Other</option>
          </select>
          <select
            value={draft.severity ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, severity: e.target.value || null }))}
            className={inputClass}
          >
            <option value="">Severity</option>
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
            <option value="life_threatening">Life-threatening</option>
          </select>
        </div>
        <input
          placeholder="Reaction (e.g. Rash, anaphylaxis)"
          value={draft.reaction ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, reaction: e.target.value }))}
          className={cn(inputClass, 'w-full mt-2')}
        />
        <div className="flex justify-end mt-3">
          <Button
            size="sm"
            disabled={!draft.allergen || add.isPending}
            onClick={() => add.mutate(draft)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Loader />
      ) : entries.length === 0 ? (
        <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-10 text-center">
          <div className="w-12 h-12 mx-auto bg-surface-container-high rounded-full flex items-center justify-center text-outline mb-3">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <p className="font-label text-sm font-semibold text-on-surface">No allergies recorded</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-3 rounded-xl bg-surface-container-lowest shadow-sanctuary p-4"
            >
              <div className="h-10 w-10 rounded-xl bg-error/10 text-error flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-label text-sm font-bold text-on-surface">{a.allergen}</p>
                  <span className="text-[10px] font-bold font-label px-2 py-0.5 rounded-full uppercase bg-tertiary-fixed text-on-tertiary-fixed-variant">
                    {a.allergyType}
                  </span>
                  {a.severity && (
                    <span
                      className={cn(
                        'text-[10px] font-bold font-label px-2 py-0.5 rounded-full capitalize',
                        severityColor[a.severity],
                      )}
                    >
                      {a.severity.replace('_', ' ')}
                    </span>
                  )}
                </div>
                {a.reaction && (
                  <p className="font-label text-xs text-on-surface-variant mt-1">{a.reaction}</p>
                )}
              </div>
              <button
                onClick={() => remove.mutate(a.id)}
                className="shrink-0 p-1 hover:bg-error-container/40 hover:text-error rounded-md text-on-surface-variant transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Loader() {
  return (
    <div className="flex justify-center py-12">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
