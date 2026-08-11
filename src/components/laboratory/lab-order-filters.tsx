'use client';

// ────────────────────────────────────────────────────────────────────────
// One filter bar for every lab worklist.
//
// Each tab used to carry its own half-set — search plus maybe a status
// dropdown, maybe a single date — so what you could narrow by depended on which
// tab you happened to be on, and none of them could answer "urgent work from
// last week that nobody has picked up".
//
// Which controls appear is driven by what the surface needs, not by the role:
// a technician has no business filtering by assignee, so that control simply is
// not passed to their views.
// ────────────────────────────────────────────────────────────────────────

import { Search, X, AlarmClock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface LabFilters {
  search: string;
  status: string;
  urgency: string;
  fromDate: string;
  toDate: string;
  assignedTo: string;
  overdue: boolean;
  unassigned: boolean;
}

export const EMPTY_LAB_FILTERS: LabFilters = {
  search: '',
  status: '',
  urgency: '',
  fromDate: '',
  toDate: '',
  assignedTo: '',
  overdue: false,
  unassigned: false,
};

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'sample_collected', label: 'Sample collected' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'received', label: 'Received' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const URGENCY_OPTIONS = [
  { value: '', label: 'Any urgency' },
  { value: 'stat', label: 'STAT' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'routine', label: 'Routine' },
];

export interface LabOrderFiltersProps {
  value: LabFilters;
  onChange: (next: LabFilters) => void;
  /** Hidden where a tab already pins the status (e.g. the approval queue). */
  showStatus?: boolean;
  /** Supervisor-only: filter by which technician holds the work. */
  technicians?: { id: string; name: string }[];
  /** Hidden on a tab that IS the overdue list. */
  showOverdue?: boolean;
  showUnassigned?: boolean;
}

export function LabOrderFilters({
  value,
  onChange,
  showStatus = true,
  technicians,
  showOverdue = true,
  showUnassigned = false,
}: LabOrderFiltersProps) {
  const set = <K extends keyof LabFilters>(key: K, v: LabFilters[K]) =>
    onChange({ ...value, [key]: v });

  // A date range with only one end is a valid, common thing to ask for
  // ("anything since Monday"), so this counts them independently.
  const activeCount =
    (value.search ? 1 : 0) +
    (value.status ? 1 : 0) +
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
            placeholder="Patient, MRN, order no. or test…"
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
          label="Urgency"
          value={value.urgency}
          options={URGENCY_OPTIONS}
          onChange={(v) => set('urgency', v)}
        />

        {technicians && (
          <Select
            label="Technician"
            value={value.assignedTo}
            options={[
              { value: '', label: 'Anyone' },
              ...technicians.map((t) => ({ value: t.id, label: t.name })),
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
            title="Open more than 24 hours with no report out"
          />
        )}

        {showUnassigned && (
          <Toggle
            active={value.unassigned}
            onClick={() => set('unassigned', !value.unassigned)}
            label="Unassigned"
            title="Nobody has picked these up yet"
          />
        )}

        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs"
            onClick={() => onChange({ ...EMPTY_LAB_FILTERS })}
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

/** Turn the bar's state into the query the orders endpoint expects. */
export function toLabQuery(f: LabFilters) {
  return {
    search: f.search.trim() || undefined,
    status: f.status || undefined,
    urgency: f.urgency || undefined,
    assignedTo: f.assignedTo || undefined,
    fromDate: f.fromDate || undefined,
    toDate: f.toDate || undefined,
    overdue: f.overdue || undefined,
    unassigned: f.unassigned || undefined,
  };
}
