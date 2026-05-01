'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  useIntakeOutputRecords,
  useCreateIntakeOutput,
  useIvLineRecords,
  type IOEntryType,
  type IOCategory,
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
import { Loader2, Plus, Clock, ArrowUpCircle, ArrowDownCircle, Droplets } from 'lucide-react';
import { cn } from '@/lib/utils';

const INTAKE_CATEGORIES: IOCategory[] = ['oral', 'iv_fluid', 'blood_product', 'tube_feed', 'other'];
const OUTPUT_CATEGORIES: IOCategory[] = ['urine', 'drain', 'vomit', 'stool', 'blood_loss', 'other'];

const CATEGORY_LABELS: Record<IOCategory, string> = {
  oral: 'Oral',
  iv_fluid: 'IV Fluid',
  blood_product: 'Blood Product',
  tube_feed: 'Tube Feed',
  urine: 'Urine',
  drain: 'Drain',
  vomit: 'Vomit',
  stool: 'Stool',
  blood_loss: 'Blood Loss',
  other: 'Other',
};

export function IntakeOutputPanel({
  patientId,
  admissionId,
}: {
  patientId: string;
  admissionId?: string;
}) {
  // Filter: last 24 hours by default
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setHours(d.getHours() - 24);
    return d.toISOString();
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString());

  const { data, isLoading } = useIntakeOutputRecords({
    patientId,
    fromDate,
    toDate,
    limit: 100,
  });
  const records = data?.data ?? [];
  const summary = data?.summary ?? { intakeMl: 0, outputMl: 0, balanceMl: 0 };

  // IV lines available for linking (active only)
  const { data: ivData } = useIvLineRecords({ patientId, status: 'active' });
  const ivLines = ivData?.data ?? [];

  return (
    <div className="space-y-4">
      {/* ── 24h Summary ─────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          label="Intake (24h)"
          value={summary.intakeMl}
          unit="ml"
          icon={<ArrowDownCircle className="h-4 w-4 text-blue-600" />}
          bg="bg-blue-50"
        />
        <SummaryCard
          label="Output (24h)"
          value={summary.outputMl}
          unit="ml"
          icon={<ArrowUpCircle className="h-4 w-4 text-amber-600" />}
          bg="bg-amber-50"
        />
        <SummaryCard
          label="Balance"
          value={summary.balanceMl}
          unit="ml"
          icon={<Droplets className="h-4 w-4" />}
          bg={summary.balanceMl >= 0 ? 'bg-emerald-50' : 'bg-red-50'}
          valueClassName={summary.balanceMl >= 0 ? 'text-emerald-700' : 'text-red-700'}
        />
      </div>

      {/* ── Date Range Filter ───────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-on-surface-variant">Range:</span>
        <Input
          type="datetime-local"
          className="h-8 text-xs w-[180px]"
          value={toLocalInput(fromDate)}
          onChange={(e) => setFromDate(fromLocalInput(e.target.value))}
        />
        <span className="text-on-surface-variant">to</span>
        <Input
          type="datetime-local"
          className="h-8 text-xs w-[180px]"
          value={toLocalInput(toDate)}
          onChange={(e) => setToDate(fromLocalInput(e.target.value))}
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => {
            const d = new Date();
            d.setHours(d.getHours() - 24);
            setFromDate(d.toISOString());
            setToDate(new Date().toISOString());
          }}
        >
          Last 24h
        </Button>
      </div>

      {/* ── Entry Form ──────────────────────────────── */}
      <EntryForm
        patientId={patientId}
        admissionId={admissionId}
        ivLineOptions={ivLines.map((l) => ({
          id: l.id,
          label: `${l.insertionSite} (${l.lineType.replace('_', ' ')})`,
        }))}
      />

      {/* ── Records List ────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : records.length === 0 ? (
        <p className="text-sm text-on-surface-variant text-center py-8">
          No entries in the selected range
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/30">
                {['Time', 'Type', 'Category', 'Volume', 'Description', 'Nurse'].map((h) => (
                  <th
                    key={h}
                    className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant text-left py-2 px-2"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-surface-container-low/30">
                  <td className="py-2 px-2 text-xs whitespace-nowrap text-on-surface-variant flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDateTime(r.recordDatetime)}
                  </td>
                  <td className="py-2 px-2">
                    <span
                      className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full',
                        r.entryType === 'intake'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700',
                      )}
                    >
                      {r.entryType === 'intake' ? 'IN' : 'OUT'}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-xs capitalize">
                    {CATEGORY_LABELS[r.category] ?? r.category}
                  </td>
                  <td className="py-2 px-2 text-sm font-medium">
                    {r.volumeMl} ml
                  </td>
                  <td className="py-2 px-2 text-xs text-on-surface-variant">
                    {r.fluidDescription ?? '-'}
                    {r.ivLine && (
                      <span className="ml-1 text-[10px] text-primary">
                        [{r.ivLine.insertionSite}]
                      </span>
                    )}
                    {r.notes && <div className="text-[10px] opacity-70">{r.notes}</div>}
                  </td>
                  <td className="py-2 px-2 text-xs text-on-surface-variant">
                    {r.nurse ? `${r.nurse.firstName} ${r.nurse.lastName}` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Entry Form ───────────────────────────────────────────

function EntryForm({
  patientId,
  admissionId,
  ivLineOptions,
}: {
  patientId: string;
  admissionId?: string;
  ivLineOptions: { id: string; label: string }[];
}) {
  const [entryType, setEntryType] = useState<IOEntryType>('intake');
  const [category, setCategory] = useState<IOCategory | ''>('');
  const [volumeMl, setVolumeMl] = useState('');
  const [fluidDescription, setFluidDescription] = useState('');
  const [ivLineId, setIvLineId] = useState<string>('');
  const [recordDatetime, setRecordDatetime] = useState<string>(() => new Date().toISOString());
  const [notes, setNotes] = useState('');

  const categories = entryType === 'intake' ? INTAKE_CATEGORIES : OUTPUT_CATEGORIES;
  const createIO = useCreateIntakeOutput();

  function handleSubmit() {
    if (!category) {
      toast.error('Category is required');
      return;
    }
    const vol = parseInt(volumeMl, 10);
    if (isNaN(vol) || vol < 0) {
      toast.error('Valid volume is required');
      return;
    }
    createIO.mutate(
      {
        patientId,
        admissionId,
        entryType,
        category,
        volumeMl: vol,
        recordDatetime,
        fluidDescription: fluidDescription || undefined,
        ivLineId: entryType === 'intake' && category === 'iv_fluid' && ivLineId ? ivLineId : undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success(`${entryType === 'intake' ? 'Intake' : 'Output'} recorded`);
          setCategory('');
          setVolumeMl('');
          setFluidDescription('');
          setIvLineId('');
          setNotes('');
          setRecordDatetime(new Date().toISOString());
        },
        onError: (err: unknown) => {
          toast.error((err as { message?: string })?.message ?? 'Failed to save entry');
        },
      },
    );
  }

  return (
    <div className="rounded-lg border border-outline-variant/30 p-3">
      <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-3">
        New Entry
      </p>

      {/* Entry type toggle */}
      <div className="flex gap-2 mb-3">
        {(['intake', 'output'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setEntryType(t);
              setCategory('');
              setIvLineId('');
            }}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors',
              entryType === t
                ? t === 'intake'
                  ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                  : 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high',
            )}
          >
            {t === 'intake' ? (
              <ArrowDownCircle className="h-4 w-4" />
            ) : (
              <ArrowUpCircle className="h-4 w-4" />
            )}
            {t === 'intake' ? 'Intake' : 'Output'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <Field label="Category *">
          <Select value={category || null} onValueChange={(v) => setCategory((v ?? '') as IOCategory | '')}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Volume (ml) *">
          <Input
            type="number" min="0"
            value={volumeMl}
            onChange={(e) => setVolumeMl(e.target.value)}
            placeholder="e.g. 250"
          />
        </Field>
        <Field label="Time">
          <Input
            type="datetime-local"
            value={toLocalInput(recordDatetime)}
            onChange={(e) => setRecordDatetime(fromLocalInput(e.target.value))}
          />
        </Field>

        <Field label="Description" wide>
          <Input
            value={fluidDescription}
            onChange={(e) => setFluidDescription(e.target.value)}
            placeholder={entryType === 'intake' ? 'e.g. Water, NS, RL' : 'e.g. Clear yellow, serosanguineous'}
          />
        </Field>

        {entryType === 'intake' && category === 'iv_fluid' && ivLineOptions.length > 0 && (
          <Field label="IV Line (optional)">
            <Select value={ivLineId || null} onValueChange={(v) => setIvLineId(v ?? '')}>
              <SelectTrigger><SelectValue placeholder="Link to IV line" /></SelectTrigger>
              <SelectContent>
                {ivLineOptions.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>

      <div className="mt-3">
        <Field label="Notes">
          <Textarea
            rows={1}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional details..."
          />
        </Field>
      </div>

      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={createIO.isPending}
          className="gap-1.5"
        >
          {createIO.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Record {entryType === 'intake' ? 'Intake' : 'Output'}
        </Button>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  unit,
  icon,
  bg,
  valueClassName,
}: {
  label: string;
  value: number;
  unit: string;
  icon: React.ReactNode;
  bg: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn('rounded-lg px-3 py-2', bg)}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-medium">
          {label}
        </p>
      </div>
      <p className={cn('text-xl font-bold', valueClassName)}>
        {value >= 0 ? value : `+${Math.abs(value)}`}{' '}
        <span className="text-[10px] font-normal opacity-70">{unit}</span>
      </p>
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

// ── Local datetime-local helpers ─────────────────────────

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(local: string): string {
  if (!local) return new Date().toISOString();
  const d = new Date(local);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

