'use client';

// ────────────────────────────────────────────────────────────────────────
// One filter bar for every radiology worklist — the twin of the lab's
// LabOrderFilters, deliberately identical so the two departments look and
// behave the same.
//
// Every radiology tab used to carry a bare search box and nothing else, so
// "urgent studies from last week that nobody has picked up" could not be asked
// at all, and the one date control lived on the dashboard tab only.
//
// Which controls appear is driven by the surface, not the role: a radiologist
// has no business filtering by colleague, so that control is simply not passed
// to their views.
// ────────────────────────────────────────────────────────────────────────

import { Search, X, AlarmClock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ImagingFilters {
  search: string;
  status: string;
  modality: string;
  urgency: string;
  fromDate: string;
  toDate: string;
  assignedTo: string;
  overdue: boolean;
  unassigned: boolean;
}

export const EMPTY_IMAGING_FILTERS: ImagingFilters = {
  search: '',
  status: '',
  modality: '',
  urgency: '',
  fromDate: '',
  toDate: '',
  assignedTo: '',
  overdue: false,
  unassigned: false,
};

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'requested', label: 'Requested' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'no_show', label: 'No-show' },
  { value: 'cancelled', label: 'Cancelled' },
];

const MODALITY_OPTIONS = [
  { value: '', label: 'Any modality' },
  { value: 'xray', label: 'X-Ray' },
  { value: 'ct_scan', label: 'CT' },
  { value: 'mri', label: 'MRI' },
  { value: 'ultrasound', label: 'Ultrasound' },
  { value: 'ecg', label: 'ECG' },
  { value: 'echo', label: 'Echo' },
  { value: 'other', label: 'Other' },
];

const URGENCY_OPTIONS = [
  { value: '', label: 'Any urgency' },
  { value: 'stat', label: 'STAT' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'routine', label: 'Routine' },
];

export interface ImagingOrderFiltersProps {
  value: ImagingFilters;
  onChange: (next: ImagingFilters) => void;
  /** Hidden where a tab already pins the status. */
  showStatus?: boolean;
  /** Admin-only: filter by which radiologist holds the study. */
  radiologists?: { id: string; name: string }[];
  showOverdue?: boolean;
  showUnassigned?: boolean;
}

export function ImagingOrderFilters({
  value,
  onChange,
  showStatus = true,
  radiologists,
  showOverdue = true,
  showUnassigned = false,
}: ImagingOrderFiltersProps) {
  const set = <K extends keyof ImagingFilters>(key: K, v: ImagingFilters[K]) =>
    onChange({ ...value, [key]: v });

  // A date range with only one end is a valid, common ask ("anything since
  // Monday"), so the two ends count independently.
  const activeCount =
    (value.search ? 1 : 0) +
    (value.status ? 1 : 0) +
    (value.modality ? 1 : 0) +
    (value.urgency ? 1 : 0) +
    (value.fromDate ? 1 : 0) +
    (value.toDate ? 1 : 0) +
    (value.assignedTo ? 1 : 0) +
    (value.overdue ? 1 : 0) +
    (value.unassigned ? 1 : 0);

  return (
    <div className="rounded-xl bg-surface-container-lowest p-3 shadow-sanctuary">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[15rem] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
          <Input
            placeholder="Patient, MRN, body part or indication…"
            value={value.search}
            onChange={(e) => set('search', e.target.value)}
            className="pl-9"
          />
        </div>

        {showStatus && (
          <Select
            label="Status"
            value={value.status}
            options={STATUS_OPTIONS}
            onChange={(v) => set('status', v)}
          />
        )}

        <Select
          label="Modality"
          value={value.modality}
          options={MODALITY_OPTIONS}
          onChange={(v) => set('modality', v)}
        />

        <Select
          label="Urgency"
          value={value.urgency}
          options={URGENCY_OPTIONS}
          onChange={(v) => set('urgency', v)}
        />

        {radiologists && (
          <Select
            label="Radiologist"
            value={value.assignedTo}
            options={[
              { value: '', label: 'Anyone' },
              ...radiologists.map((r) => ({ value: r.id, label: r.name })),
            ]}
            onChange={(v) => set('assignedTo', v)}
          />
        )}

        <div className="flex items-center gap-1">
          <Input
            type="date"
            aria-label="From date"
            value={value.fromDate}
            onChange={(e) => set('fromDate', e.target.value)}
            className="w-[9.5rem]"
          />
          <span className="text-xs text-on-surface-variant">to</span>
          <Input
            type="date"
            aria-label="To date"
            value={value.toDate}
            onChange={(e) => set('toDate', e.target.value)}
            className="w-[9.5rem]"
          />
        </div>

        {showOverdue && (
          <Toggle
            active={value.overdue}
            onClick={() => set('overdue', !value.overdue)}
            tone="danger"
            icon={<AlarmClock className="h-3.5 w-3.5" />}
            label="Overdue"
            title="Open more than 24 hours with nothing published"
          />
        )}

        {showUnassigned && (
          <Toggle
            active={value.unassigned}
            onClick={() => set('unassigned', !value.unassigned)}
            label="Unassigned"
            title="Accepted, but nobody has picked these up"
          />
        )}

        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs"
            onClick={() => onChange({ ...EMPTY_IMAGING_FILTERS })}
          >
            <X className="h-3.5 w-3.5" /> Clear {activeCount}
          </Button>
        )}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'h-9 rounded-lg border bg-background px-2.5 text-sm',
        value && 'border-primary/50 bg-primary/5 font-medium',
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  active,
  onClick,
  label,
  title,
  icon,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title: string;
  icon?: React.ReactNode;
  tone?: 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-colors',
        active
          ? tone === 'danger'
            ? 'border-red-300 bg-red-50 text-red-700'
            : 'border-primary/50 bg-primary/10 text-primary'
          : 'bg-background text-on-surface-variant hover:bg-surface-container',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/** Turn the bar's state into the query the requests endpoint expects. */
export function toImagingQuery(f: ImagingFilters) {
  return {
    search: f.search.trim() || undefined,
    status: f.status || undefined,
    imagingType: f.modality || undefined,
    urgency: f.urgency || undefined,
    assignedTechnicianId: f.assignedTo || undefined,
    fromDate: f.fromDate || undefined,
    toDate: f.toDate || undefined,
    overdue: f.overdue || undefined,
    unassigned: f.unassigned || undefined,
  };
}
