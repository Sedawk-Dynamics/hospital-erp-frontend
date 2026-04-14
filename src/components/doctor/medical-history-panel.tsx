'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, Users, AlertTriangle, Plus, Trash2, Save } from 'lucide-react';
import { apiGet, apiPut, apiPost, apiDelete } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Tab = 'personal' | 'family' | 'allergies';

export function MedicalHistoryPanel({ patientId }: { patientId: string }) {
  const [tab, setTab] = useState<Tab>('personal');

  return (
    <div>
      <div className="flex gap-1 pb-3">
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
        {tab === 'personal' && <DoctorPersonal patientId={patientId} />}
        {tab === 'family' && <DoctorFamily patientId={patientId} />}
        {tab === 'allergies' && <DoctorAllergies patientId={patientId} />}
      </div>
    </div>
  );
}

function DoctorPersonal({ patientId }: { patientId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['doctor', 'personal-history', patientId],
    queryFn: async () => {
      const res = await apiGet<any>(`/medical-history/${patientId}/personal`);
      return res.data ?? {};
    },
  });
  const [form, setForm] = useState<any>({});
  const current = { ...(data || {}), ...form };
  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      await apiPut(`/medical-history/${patientId}/personal`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctor', 'personal-history', patientId] });
      setForm({});
    },
  });

  const field = (label: string, key: string, textarea = false) => (
    <div>
      <label className="text-[10px] font-medium text-foreground/60 block mb-0.5">{label}</label>
      {textarea ? (
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

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {field('Appetite', 'appetite')}
        {field('Diet', 'diet')}
        {field('Sleep', 'sleepPattern')}
        {field('Exercise', 'exerciseHabits')}
      </div>
      {field('Disorders', 'disorders', true)}
      {field('Notes', 'notes', true)}
      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={Object.keys(form).length === 0 || mutation.isPending}
          onClick={() => mutation.mutate(current)}
          className="gap-1 text-xs h-7"
        >
          <Save className="h-3 w-3" /> Save
        </Button>
      </div>
    </div>
  );
}

function DoctorFamily({ patientId }: { patientId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['doctor', 'family-history', patientId],
    queryFn: async () => {
      const res = await apiGet<any[]>(`/medical-history/${patientId}/family`);
      return res.data ?? [];
    },
  });
  const entries = data ?? [];
  return (
    <div className="space-y-1.5 text-xs">
      <p className="text-[10px] text-muted-foreground italic">Read-only. Patient manages this.</p>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No family history recorded</p>
      ) : (
        entries.map((e: any) => (
          <div key={e.id} className="rounded-md border px-2 py-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold">{e.conditionName}</span>
              <Badge className="text-[9px] px-1 py-0 capitalize">{e.relationSide}</Badge>
              {e.relationship && <span className="text-muted-foreground">· {e.relationship}</span>}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function DoctorAllergies({ patientId }: { patientId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['doctor', 'allergies', patientId],
    queryFn: async () => {
      const res = await apiGet<any[]>(`/medical-history/${patientId}/allergies`);
      return res.data ?? [];
    },
  });
  const [draft, setDraft] = useState<any>({ allergyType: 'drug', severity: 'mild' });
  const add = useMutation({
    mutationFn: async (p: any) => {
      await apiPost(`/medical-history/${patientId}/allergies`, p);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctor', 'allergies', patientId] });
      setDraft({ allergyType: 'drug', severity: 'mild' });
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/medical-history/${patientId}/allergies/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor', 'allergies', patientId] }),
  });

  const entries = data ?? [];

  return (
    <div className="space-y-2 text-xs">
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
      {entries.length === 0 ? (
        <p className="text-muted-foreground italic">No allergies</p>
      ) : (
        entries.map((a: any) => (
          <div key={a.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="font-semibold">{a.allergen}</span>
                <Badge className="text-[9px] px-1 py-0 uppercase">{a.allergyType}</Badge>
                {a.severity && <span className="text-muted-foreground text-[10px]">{a.severity}</span>}
              </div>
              {a.reaction && <span className="text-[10px] text-foreground/70">{a.reaction}</span>}
            </div>
            <button onClick={() => remove.mutate(a.id)} className="p-1">
              <Trash2 className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        ))
      )}
    </div>
  );
}
