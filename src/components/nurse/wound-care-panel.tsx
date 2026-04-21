'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  useWoundCareRecords,
  useCreateWoundCare,
  type WoundType,
  type WoundStage,
  type ExudateType,
  type ExudateAmount,
  type WoundStatus,
} from '@/hooks/use-nurse';
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
import { Loader2, Plus, Clock, Bandage } from 'lucide-react';
import { cn } from '@/lib/utils';

const WOUND_TYPES: { value: WoundType; label: string }[] = [
  { value: 'surgical', label: 'Surgical' },
  { value: 'pressure_ulcer', label: 'Pressure Ulcer' },
  { value: 'laceration', label: 'Laceration' },
  { value: 'burn', label: 'Burn' },
  { value: 'diabetic_ulcer', label: 'Diabetic Ulcer' },
  { value: 'other', label: 'Other' },
];
const WOUND_STAGES: { value: WoundStage; label: string }[] = [
  { value: 'stage_1', label: 'Stage 1' },
  { value: 'stage_2', label: 'Stage 2' },
  { value: 'stage_3', label: 'Stage 3' },
  { value: 'stage_4', label: 'Stage 4' },
  { value: 'unstageable', label: 'Unstageable' },
];
const EXUDATE_TYPES: { value: ExudateType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'serous', label: 'Serous' },
  { value: 'sanguineous', label: 'Sanguineous' },
  { value: 'purulent', label: 'Purulent' },
];
const EXUDATE_AMOUNTS: { value: ExudateAmount; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'scant', label: 'Scant' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'heavy', label: 'Heavy' },
];
const WOUND_STATUSES: { value: WoundStatus; label: string; color: string }[] = [
  { value: 'active', label: 'Active', color: 'bg-amber-100 text-amber-700' },
  { value: 'healing', label: 'Healing', color: 'bg-blue-100 text-blue-700' },
  { value: 'healed', label: 'Healed', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'worsening', label: 'Worsening', color: 'bg-red-100 text-red-700' },
];

interface FormState {
  woundLocation: string;
  woundType: WoundType | '';
  woundStage: WoundStage | '';
  lengthCm: string;
  widthCm: string;
  depthCm: string;
  exudateType: ExudateType | '';
  exudateAmount: ExudateAmount | '';
  dressingApplied: string;
  treatmentNotes: string;
  status: WoundStatus;
}

const INITIAL_FORM: FormState = {
  woundLocation: '',
  woundType: '',
  woundStage: '',
  lengthCm: '',
  widthCm: '',
  depthCm: '',
  exudateType: '',
  exudateAmount: '',
  dressingApplied: '',
  treatmentNotes: '',
  status: 'active',
};

function parseNum(v: string): number | undefined {
  const n = parseFloat(v);
  return isNaN(n) || n <= 0 ? undefined : n;
}

export function WoundCarePanel({
  patientId,
  admissionId,
}: {
  patientId: string;
  admissionId?: string;
}) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);

  const { data, isLoading } = useWoundCareRecords({ patientId, limit: 20 });
  const records = data?.data ?? [];
  const createWound = useCreateWoundCare();

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    if (!form.woundLocation.trim()) {
      toast.error('Wound location is required');
      return;
    }
    createWound.mutate(
      {
        patientId,
        admissionId,
        woundLocation: form.woundLocation.trim(),
        woundType: form.woundType || undefined,
        woundStage: form.woundStage || undefined,
        lengthCm: parseNum(form.lengthCm),
        widthCm: parseNum(form.widthCm),
        depthCm: parseNum(form.depthCm),
        exudateType: form.exudateType || undefined,
        exudateAmount: form.exudateAmount || undefined,
        dressingApplied: form.dressingApplied || undefined,
        treatmentNotes: form.treatmentNotes || undefined,
        status: form.status,
      },
      {
        onSuccess: () => {
          toast.success('Wound care record added');
          setForm(INITIAL_FORM);
        },
        onError: (err: unknown) => {
          toast.error(
            (err as { message?: string })?.message ?? 'Failed to save wound care record',
          );
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Form ─────────────────────────────────────── */}
      <div className="rounded-lg border border-outline-variant/30 p-3">
        <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-3">
          New Wound Care Record
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Wound Location *" wide>
            <Input
              value={form.woundLocation}
              onChange={(e) => update('woundLocation', e.target.value)}
              placeholder="e.g. Left heel, Sacrum"
            />
          </Field>

          <Field label="Wound Type">
            <Select value={form.woundType || undefined} onValueChange={(v) => update('woundType', (v ?? '') as WoundType | '')}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {WOUND_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Stage">
            <Select value={form.woundStage || undefined} onValueChange={(v) => update('woundStage', (v ?? '') as WoundStage | '')}>
              <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
              <SelectContent>
                {WOUND_STAGES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Length (cm)">
            <Input
              type="number" step="0.1" min="0"
              value={form.lengthCm}
              onChange={(e) => update('lengthCm', e.target.value)}
              placeholder="0.0"
            />
          </Field>
          <Field label="Width (cm)">
            <Input
              type="number" step="0.1" min="0"
              value={form.widthCm}
              onChange={(e) => update('widthCm', e.target.value)}
              placeholder="0.0"
            />
          </Field>
          <Field label="Depth (cm)">
            <Input
              type="number" step="0.1" min="0"
              value={form.depthCm}
              onChange={(e) => update('depthCm', e.target.value)}
              placeholder="0.0"
            />
          </Field>

          <Field label="Exudate Type">
            <Select value={form.exudateType || undefined} onValueChange={(v) => update('exudateType', (v ?? '') as ExudateType | '')}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {EXUDATE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Exudate Amount">
            <Select value={form.exudateAmount || undefined} onValueChange={(v) => update('exudateAmount', (v ?? '') as ExudateAmount | '')}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {EXUDATE_AMOUNTS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onValueChange={(v) => update('status', (v ?? 'active') as WoundStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WOUND_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Dressing Applied" wide>
            <Input
              value={form.dressingApplied}
              onChange={(e) => update('dressingApplied', e.target.value)}
              placeholder="e.g. Hydrocolloid 10x10cm"
            />
          </Field>
        </div>

        <div className="mt-3">
          <Field label="Treatment Notes">
            <Textarea
              rows={2}
              value={form.treatmentNotes}
              onChange={(e) => update('treatmentNotes', e.target.value)}
              placeholder="Cleansing, debridement, topical agents applied..."
            />
          </Field>
        </div>

        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={createWound.isPending}
            className="gap-1.5"
          >
            {createWound.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Save Wound Care Record
          </Button>
        </div>
      </div>

      {/* ── List ─────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : records.length === 0 ? (
        <p className="text-sm text-on-surface-variant text-center py-8">
          No wound care records yet
        </p>
      ) : (
        <div className="space-y-2">
          {records.map((r) => {
            const st = WOUND_STATUSES.find((s) => s.value === r.status);
            const dimensions = [r.lengthCm, r.widthCm, r.depthCm]
              .filter((x) => x != null)
              .join(' × ');
            return (
              <div
                key={r.id}
                className="rounded-lg border border-outline-variant/20 p-3 hover:bg-surface-container-low/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Bandage className="h-3.5 w-3.5 text-primary" />
                    <span className="font-semibold text-sm">{r.woundLocation}</span>
                    {r.woundType && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary capitalize">
                        {r.woundType.replace('_', ' ')}
                      </span>
                    )}
                    {r.woundStage && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-surface-container text-on-surface-variant capitalize">
                        {r.woundStage.replace('_', ' ')}
                      </span>
                    )}
                    {st && (
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', st.color)}>
                        {st.label}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-on-surface-variant whitespace-nowrap flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDateTime(r.assessedAt)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-on-surface-variant">
                  {dimensions && <span><strong>Size:</strong> {dimensions} cm</span>}
                  {r.exudateType && <span><strong>Exudate:</strong> {r.exudateType} / {r.exudateAmount}</span>}
                  {r.dressingApplied && <span className="sm:col-span-3"><strong>Dressing:</strong> {r.dressingApplied}</span>}
                </div>
                {r.treatmentNotes && (
                  <p className="text-sm mt-2 text-on-surface whitespace-pre-wrap">
                    {r.treatmentNotes}
                  </p>
                )}
                {r.nurse && (
                  <p className="text-[10px] text-on-surface-variant mt-1">
                    by {r.nurse.firstName} {r.nurse.lastName}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? 'sm:col-span-2 md:col-span-3' : ''}>
      <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
        {label}
      </label>
      {children}
    </div>
  );
}
