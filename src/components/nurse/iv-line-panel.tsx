'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  useIvLineRecords,
  useCreateIvLine,
  useRemoveIvLine,
  type IVLineType,
  type IVRemovalReason,
  type IVLineRecord,
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Plus, Clock, Syringe, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const LINE_TYPES: { value: IVLineType; label: string }[] = [
  { value: 'peripheral', label: 'Peripheral' },
  { value: 'central_picc', label: 'PICC' },
  { value: 'central_subclavian', label: 'Central — Subclavian' },
  { value: 'central_jugular', label: 'Central — Jugular' },
  { value: 'arterial', label: 'Arterial' },
  { value: 'midline', label: 'Midline' },
];

const REMOVAL_REASONS: { value: IVRemovalReason; label: string }[] = [
  { value: 'completed', label: 'Therapy completed' },
  { value: 'scheduled_change', label: 'Scheduled change' },
  { value: 'infiltration', label: 'Infiltration' },
  { value: 'phlebitis', label: 'Phlebitis' },
  { value: 'dislodged', label: 'Dislodged' },
  { value: 'infection', label: 'Infection' },
];

interface FormState {
  lineType: IVLineType | '';
  catheterGauge: string;
  insertionSite: string;
  fluidType: string;
  flowRateMlPerHr: string;
  dressingChangeFrequencyHours: string;
  complications: string;
  notes: string;
}

const INITIAL_FORM: FormState = {
  lineType: '',
  catheterGauge: '',
  insertionSite: '',
  fluidType: '',
  flowRateMlPerHr: '',
  dressingChangeFrequencyHours: '72',
  complications: '',
  notes: '',
};

export function IvLinePanel({
  patientId,
  admissionId,
}: {
  patientId: string;
  admissionId?: string;
}) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const { data, isLoading } = useIvLineRecords({ patientId, limit: 20 });
  const records = data?.data ?? [];
  const createLine = useCreateIvLine();

  const activeLines = useMemo(
    () => records.filter((r) => r.status === 'active'),
    [records],
  );
  const historical = useMemo(
    () => records.filter((r) => r.status !== 'active'),
    [records],
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    if (!form.lineType) {
      toast.error('Line type is required');
      return;
    }
    if (!form.insertionSite.trim()) {
      toast.error('Insertion site is required');
      return;
    }
    createLine.mutate(
      {
        patientId,
        admissionId,
        lineType: form.lineType,
        catheterGauge: form.catheterGauge || undefined,
        insertionSite: form.insertionSite.trim(),
        fluidType: form.fluidType || undefined,
        flowRateMlPerHr: form.flowRateMlPerHr ? parseInt(form.flowRateMlPerHr, 10) : undefined,
        dressingChangeFrequencyHours: form.dressingChangeFrequencyHours
          ? parseInt(form.dressingChangeFrequencyHours, 10)
          : undefined,
        complications: form.complications || undefined,
        notes: form.notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success('IV line recorded');
          setForm(INITIAL_FORM);
        },
        onError: (err: unknown) => {
          toast.error((err as { message?: string })?.message ?? 'Failed to save IV line');
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Form ─────────────────────────────────────── */}
      <div className="rounded-lg border border-outline-variant/30 p-3">
        <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-3">
          New IV Line
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Line Type *">
            <Select value={form.lineType || null} onValueChange={(v) => update('lineType', (v ?? '') as IVLineType | '')}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {LINE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Catheter Gauge">
            <Input
              value={form.catheterGauge}
              onChange={(e) => update('catheterGauge', e.target.value)}
              placeholder="e.g. 18G, 20G"
            />
          </Field>
          <Field label="Insertion Site *">
            <Input
              value={form.insertionSite}
              onChange={(e) => update('insertionSite', e.target.value)}
              placeholder="e.g. Left forearm"
            />
          </Field>
          <Field label="Fluid Type">
            <Input
              value={form.fluidType}
              onChange={(e) => update('fluidType', e.target.value)}
              placeholder="e.g. NS, RL, D5W"
            />
          </Field>
          <Field label="Flow Rate (ml/hr)">
            <Input
              type="number" min="0"
              value={form.flowRateMlPerHr}
              onChange={(e) => update('flowRateMlPerHr', e.target.value)}
              placeholder="100"
            />
          </Field>
          <Field label="Dressing Freq (hrs)">
            <Input
              type="number" min="1" max="336"
              value={form.dressingChangeFrequencyHours}
              onChange={(e) => update('dressingChangeFrequencyHours', e.target.value)}
              placeholder="72"
            />
          </Field>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Complications">
            <Input
              value={form.complications}
              onChange={(e) => update('complications', e.target.value)}
              placeholder="Any issues observed..."
            />
          </Field>
          <Field label="Notes">
            <Input
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Additional details"
            />
          </Field>
        </div>

        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={createLine.isPending}
            className="gap-1.5"
          >
            {createLine.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Save IV Line
          </Button>
        </div>
      </div>

      {/* ── Active Lines ─────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <Section title="Active IV Lines" count={activeLines.length}>
            {activeLines.length === 0 ? (
              <p className="text-sm text-on-surface-variant py-2">
                No active IV lines
              </p>
            ) : (
              <div className="space-y-2">
                {activeLines.map((r) => (
                  <IvLineRow key={r.id} record={r} active />
                ))}
              </div>
            )}
          </Section>

          {historical.length > 0 && (
            <Section title="History" count={historical.length}>
              <div className="space-y-2">
                {historical.map((r) => (
                  <IvLineRow key={r.id} record={r} active={false} />
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-on-surface mb-2 flex items-center gap-2">
        {title}
        <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-surface-container text-on-surface-variant">
          {count}
        </span>
      </h3>
      {children}
    </div>
  );
}

function IvLineRow({ record, active }: { record: IVLineRecord; active: boolean }) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        active
          ? 'border-primary/40 bg-primary/5'
          : 'border-outline-variant/20 bg-surface-container-lowest',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Syringe className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold text-sm capitalize">
            {record.lineType.replace('_', ' ').replace('central ', 'Central — ')}
          </span>
          {record.catheterGauge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-surface-container text-on-surface-variant">
              {record.catheterGauge}
            </span>
          )}
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize">
            <span
              className={cn(
                record.status === 'active'
                  ? 'bg-emerald-100 text-emerald-700'
                  : record.status === 'removed'
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-blue-100 text-blue-700',
                'px-2 py-0.5 rounded-full',
              )}
            >
              {record.status}
            </span>
          </span>
        </div>
        <span className="text-[10px] text-on-surface-variant whitespace-nowrap flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Inserted {formatDateTime(record.insertedAt)}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-on-surface-variant">
        <span><strong>Site:</strong> {record.insertionSite}</span>
        {record.fluidType && <span><strong>Fluid:</strong> {record.fluidType}</span>}
        {record.flowRateMlPerHr != null && (
          <span><strong>Rate:</strong> {record.flowRateMlPerHr} ml/hr</span>
        )}
        {record.lastFlushedAt && (
          <span><strong>Last flush:</strong> {formatDateTime(record.lastFlushedAt)}</span>
        )}
        {record.lastDressingChangeAt && (
          <span><strong>Last dressing:</strong> {formatDateTime(record.lastDressingChangeAt)}</span>
        )}
        {record.inserter && (
          <span><strong>By:</strong> {record.inserter.firstName} {record.inserter.lastName}</span>
        )}
      </div>

      {record.complications && (
        <p className="text-xs mt-1 text-red-700">
          <strong>Complications:</strong> {record.complications}
        </p>
      )}
      {record.notes && (
        <p className="text-sm mt-1 text-on-surface whitespace-pre-wrap">{record.notes}</p>
      )}

      {record.removedAt && (
        <div className="mt-2 pt-2 border-t border-outline-variant/20 text-xs text-on-surface-variant">
          <span className="font-medium">Removed:</span> {formatDateTime(record.removedAt)}
          {record.removalReason && <> · Reason: <em className="capitalize">{record.removalReason.replace('_', ' ')}</em></>}
          {record.remover && <> · by {record.remover.firstName} {record.remover.lastName}</>}
        </div>
      )}

      {active && (
        <div className="mt-2 flex justify-end">
          <RemoveLineDialog line={record} />
        </div>
      )}
    </div>
  );
}

function RemoveLineDialog({ line }: { line: IVLineRecord }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<IVRemovalReason | ''>('');
  const [notes, setNotes] = useState('');
  const removeLine = useRemoveIvLine();

  function handleRemove() {
    if (!reason) {
      toast.error('Removal reason is required');
      return;
    }
    removeLine.mutate(
      { id: line.id, removalReason: reason, notes: notes || undefined, status: 'removed' },
      {
        onSuccess: () => {
          toast.success('IV line removed');
          setOpen(false);
          setReason('');
          setNotes('');
        },
        onError: (err: unknown) => {
          toast.error((err as { message?: string })?.message ?? 'Failed to remove IV line');
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
            <XCircle className="h-3.5 w-3.5" />
            Remove
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base">Remove IV Line</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-on-surface-variant">
            {line.insertionSite} — <span className="capitalize">{line.lineType.replace('_', ' ')}</span>
          </p>
          <div>
            <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
              Removal Reason *
            </label>
            <Select value={reason || null} onValueChange={(v) => setReason((v ?? '') as IVRemovalReason | '')}>
              <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
              <SelectContent>
                {REMOVAL_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
              Notes
            </label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional details..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={handleRemove}
            disabled={removeLine.isPending}
            className="gap-1.5"
          >
            {removeLine.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Confirm Removal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
        {label}
      </label>
      {children}
    </div>
  );
}
