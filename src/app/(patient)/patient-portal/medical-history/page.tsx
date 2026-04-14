'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, Users, AlertTriangle, Plus, Trash2, Save } from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Tab = 'personal' | 'family' | 'allergies';

export default function MedicalHistoryPage() {
  const [tab, setTab] = useState<Tab>('personal');

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Heart className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Medical History</h1>
          <p className="text-xs text-muted-foreground">
            Personal habits, family conditions, and allergies.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {(
          [
            { key: 'personal', label: 'Personal', icon: Heart },
            { key: 'family', label: 'Family', icon: Users },
            { key: 'allergies', label: 'Allergies', icon: AlertTriangle },
          ] as { key: Tab; label: string; icon: any }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              t.key === tab
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground',
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

function PersonalTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['patient', 'personal-history'],
    queryFn: async () => {
      const res = await apiGet<PersonalHistory | null>('/patient-portal/medical-history/personal');
      return res.data ?? {};
    },
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
  });

  if (isLoading) return <Loader />;

  const Input = ({ label, field, textarea }: { label: string; field: keyof PersonalHistory; textarea?: boolean }) => (
    <div>
      <label className="text-xs font-medium text-foreground/80 block mb-1">{label}</label>
      {textarea ? (
        <textarea
          value={(current as any)[field] ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
          rows={3}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      ) : (
        <input
          value={(current as any)[field] ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      )}
    </div>
  );

  const Select = ({
    label,
    field,
    options,
  }: {
    label: string;
    field: keyof PersonalHistory;
    options: string[];
  }) => (
    <div>
      <label className="text-xs font-medium text-foreground/80 block mb-1">{label}</label>
      <select
        value={(current as any)[field] ?? ''}
        onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value || null }))}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
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

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Appetite" field="appetite" />
        <Input label="Diet" field="diet" />
        <Input label="Sleep Pattern" field="sleepPattern" />
        <Input label="Exercise Habits" field="exerciseHabits" />
        <Select label="Smoking" field="smokingStatus" options={['never', 'former', 'current']} />
        <Select
          label="Alcohol"
          field="alcoholConsumption"
          options={['none', 'occasional', 'moderate', 'heavy']}
        />
      </div>
      <Input label="Disorders" field="disorders" textarea />
      <Input label="Notes" field="notes" textarea />

      <div className="flex justify-end">
        <Button
          disabled={mutation.isPending || Object.keys(form).length === 0}
          onClick={() => mutation.mutate(current)}
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
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/patient-portal/medical-history/family/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient', 'family-history'] }),
  });

  const entries = data ?? [];
  const maternal = entries.filter((e) => e.relationSide === 'maternal');
  const paternal = entries.filter((e) => e.relationSide === 'paternal');

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs font-semibold mb-2">Add condition</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            placeholder="Condition (e.g. Diabetes)"
            value={draft.conditionName ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, conditionName: e.target.value }))}
            className="rounded-md border bg-background px-3 py-2 text-sm md:col-span-2"
          />
          <select
            value={draft.relationSide}
            onChange={(e) => setDraft((d) => ({ ...d, relationSide: e.target.value as any }))}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="maternal">Maternal</option>
            <option value="paternal">Paternal</option>
          </select>
          <input
            placeholder="Relationship (e.g. Mother)"
            value={draft.relationship ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, relationship: e.target.value }))}
            className="rounded-md border bg-background px-3 py-2 text-sm"
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

function FamilyColumn({ label, entries, onRemove }: { label: string; entries: FamilyEntry[]; onRemove: (id: string) => void }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-semibold text-foreground/70 mb-2">{label}</p>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No entries</p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="flex items-start gap-2 rounded-md border px-3 py-2 text-xs">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">{e.conditionName}</p>
                {e.relationship && <p className="text-muted-foreground">{e.relationship}</p>}
                {e.notes && <p className="text-foreground/70 mt-0.5">{e.notes}</p>}
              </div>
              <button onClick={() => onRemove(e.id)} className="shrink-0 p-1 hover:bg-muted rounded">
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
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
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/patient-portal/medical-history/allergies/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient', 'allergies'] }),
  });

  const entries = data ?? [];

  const severityColor: Record<string, string> = {
    mild: 'bg-green-100 text-green-700',
    moderate: 'bg-amber-100 text-amber-700',
    severe: 'bg-orange-100 text-orange-700',
    life_threatening: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs font-semibold mb-2">Add allergy</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            placeholder="Allergen (e.g. Penicillin)"
            value={draft.allergen ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, allergen: e.target.value }))}
            className="rounded-md border bg-background px-3 py-2 text-sm md:col-span-2"
          />
          <select
            value={draft.allergyType}
            onChange={(e) => setDraft((d) => ({ ...d, allergyType: e.target.value as any }))}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="drug">Drug</option>
            <option value="food">Food</option>
            <option value="environmental">Environmental</option>
            <option value="other">Other</option>
          </select>
          <select
            value={draft.severity ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, severity: e.target.value || null }))}
            className="rounded-md border bg-background px-3 py-2 text-sm"
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
          className="w-full rounded-md border bg-background px-3 py-2 text-sm mt-2"
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
        <div className="rounded-xl border bg-card p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium">No allergies recorded</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((a) => (
            <div key={a.id} className="flex items-start gap-3 rounded-xl border-2 bg-card p-3">
              <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-bold">{a.allergen}</p>
                  <Badge className="text-[10px] px-1.5 py-0 uppercase">{a.allergyType}</Badge>
                  {a.severity && (
                    <Badge className={cn('text-[10px] px-1.5 py-0', severityColor[a.severity])}>
                      {a.severity.replace('_', ' ')}
                    </Badge>
                  )}
                </div>
                {a.reaction && <p className="text-xs text-foreground/70 mt-1">{a.reaction}</p>}
              </div>
              <button onClick={() => remove.mutate(a.id)} className="shrink-0 p-1 hover:bg-muted rounded">
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
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
