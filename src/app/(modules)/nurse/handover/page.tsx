'use client';

import { useState, useCallback, useMemo } from 'react';
import { toInputDateStr, formatDate, formatDateTime, formatTime } from '@/lib/date-utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useActionFormsTrigger } from '@/hooks/use-action-forms-trigger';
import { IntakeFormsModal } from '@/components/forms/intake-forms-modal';
import { PatientFormSubmissionsPanel } from '@/components/forms/patient-form-submissions-panel';
import {
  useHandovers,
  useCreateHandover,
  useAcknowledgeHandover,
  useCompleteHandover,
  useDutyRoster,
  useShiftSummary,
  type ShiftHandover,
} from '@/hooks/use-nurse';
import {
  Sun,
  Sunset,
  Moon,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  ClipboardList,
  Users,
  Activity,
  Pill,
  FileText,
  Clock,
  CheckCircle2,
  Send,
  Loader2,
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────

const SHIFT_CONFIG = {
  morning: { label: 'Morning', icon: Sun, start: '06:00', end: '14:00', color: 'bg-amber-100 text-amber-700', hours: [6, 14] },
  afternoon: { label: 'Afternoon', icon: Sunset, start: '14:00', end: '22:00', color: 'bg-orange-100 text-orange-700', hours: [14, 22] },
  night: { label: 'Night', icon: Moon, start: '22:00', end: '06:00', color: 'bg-indigo-100 text-indigo-700', hours: [22, 6] },
} as const;

type ShiftType = keyof typeof SHIFT_CONFIG;

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-100 text-blue-700',
  acknowledged: 'bg-emerald-100 text-emerald-700',
};

const TABS = [
  { key: 'handover', label: 'Shift Handover', icon: ClipboardList },
  { key: 'roster', label: 'Duty Roster', icon: Users },
] as const;

// ── Helpers ──────────────────────────────────────────────────

function detectCurrentShift(): ShiftType {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return 'morning';
  if (hour >= 14 && hour < 22) return 'afternoon';
  return 'night';
}

// ── Patient Note Row ─────────────────────────────────────────

interface PatientNote {
  patientId: string;
  patientName: string;
  note: string;
  priority: string;
}

function PatientNoteRow({
  note,
  index,
  onChange,
  onRemove,
}: {
  note: PatientNote;
  index: number;
  onChange: (index: number, field: keyof PatientNote, value: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-low/50 p-3">
      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="Patient name"
            value={note.patientName}
            onChange={(e) => onChange(index, 'patientName', e.target.value)}
            className="h-8 text-xs flex-1"
          />
          <Select
            value={note.priority}
            onValueChange={(value) => {
              if (value) onChange(index, 'priority', value);
            }}
          >
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea
          placeholder="Handover note for this patient..."
          value={note.note}
          onChange={(e) => onChange(index, 'note', e.target.value)}
          className="min-h-[56px] text-xs resize-none"
          rows={2}
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-destructive/70 hover:text-destructive"
        onClick={() => onRemove(index)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ── Shift Info Header ────────────────────────────────────────

function ShiftInfoHeader({ currentShift }: { currentShift: ShiftType }) {
  const config = SHIFT_CONFIG[currentShift];
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-between rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', config.color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-headline text-base font-bold text-on-surface">
            {config.label} Shift
          </h2>
          <p className="font-label text-xs text-on-surface-variant">
            {config.start} &ndash; {config.end}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-headline text-sm font-semibold text-on-surface">
          {formatDate(new Date())}
        </p>
        <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest">
          Today
        </p>
      </div>
    </div>
  );
}

// ── Shift Summary Panel ──────────────────────────────────────

function ShiftSummaryPanel({ currentShift }: { currentShift: ShiftType }) {
  const today = toInputDateStr();
  const { data, isLoading, isError } = useShiftSummary({
    shiftDate: today,
    shiftType: currentShift,
  });

  const counts = data?.data?.counts;

  const items = [
    { icon: Users, label: 'Patients Seen', value: counts?.patientsSeen ?? 0, color: 'bg-primary/10 text-primary' },
    { icon: Activity, label: 'Vitals Recorded', value: counts?.vitalsRecorded ?? 0, color: 'bg-emerald-100 text-emerald-700' },
    { icon: Pill, label: 'Medications Given', value: counts?.medicationsAdministered ?? 0, color: 'bg-blue-100 text-blue-700' },
    { icon: FileText, label: 'Notes Written', value: counts?.nursingNotes ?? 0, color: 'bg-purple-100 text-purple-700' },
  ];

  // Secondary breakdown row (wound care, IV lines, intake/output)
  const extraItems = [
    { label: 'Wound Care', value: counts?.woundCareRecords ?? 0 },
    { label: 'IV Lines', value: counts?.ivLinesInserted ?? 0 },
    { label: 'I/O Entries', value: counts?.intakeOutputEntries ?? 0 },
    { label: 'Handovers In/Out', value: `${counts?.handoversReceived ?? 0} / ${counts?.handoversSubmitted ?? 0}` },
  ];

  return (
    <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-headline text-sm font-bold text-on-surface">
          Shift Summary — {SHIFT_CONFIG[currentShift].label}
        </h3>
        {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-center gap-2.5 rounded-lg border border-outline-variant/20 p-2.5">
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', item.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="font-headline text-lg font-bold leading-none">{item.value}</p>
                <p className="font-label text-[10px] text-on-surface-variant">{item.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Secondary counts — only show when we have actual data */}
      {counts && (
        <div className="mt-3 pt-3 border-t border-outline-variant/20 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {extraItems.map((i) => (
            <div key={i.label} className="flex items-center justify-between rounded-md bg-surface-container-low/40 px-2 py-1">
              <span className="text-on-surface-variant">{i.label}</span>
              <span className="font-semibold text-on-surface">{i.value}</span>
            </div>
          ))}
        </div>
      )}

      {isError && (
        <p className="mt-2 text-[10px] text-red-600">Unable to load shift summary.</p>
      )}
    </div>
  );
}

// ── Create Handover Form ─────────────────────────────────────

function CreateHandoverForm({ currentShift }: { currentShift: ShiftType }) {
  const [isOpen, setIsOpen] = useState(false);
  const [shiftType, setShiftType] = useState<string>(currentShift);
  const [summary, setSummary] = useState('');
  const [patientNotes, setPatientNotes] = useState<PatientNote[]>([]);
  const [tasks, setTasks] = useState<string[]>([]);
  const [newTask, setNewTask] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  const createHandover = useCreateHandover();
  const formsTrigger = useActionFormsTrigger();

  const handlePatientNoteChange = useCallback(
    (index: number, field: keyof PatientNote, value: string) => {
      setPatientNotes((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    [],
  );

  const handleRemovePatientNote = useCallback((index: number) => {
    setPatientNotes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddPatientNote = useCallback(() => {
    setPatientNotes((prev) => [
      ...prev,
      { patientId: '', patientName: '', note: '', priority: 'normal' },
    ]);
  }, []);

  const handleAddTask = useCallback(() => {
    const trimmed = newTask.trim();
    if (!trimmed) return;
    setTasks((prev) => [...prev, trimmed]);
    setNewTask('');
  }, [newTask]);

  const handleRemoveTask = useCallback((index: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!summary.trim()) {
      toast.error('Please enter a handover summary');
      return;
    }

    const validNotes = patientNotes.filter((n) => n.patientName.trim() && n.note.trim());

    try {
      await createHandover.mutateAsync({
        wardId: '', // TODO: fill from nurse's assigned ward
        shiftDate: new Date().toISOString(),
        shiftType,
        content: summary.trim(),
        patientStatuses: validNotes.length > 0 ? validNotes : undefined,
        outstandingTasks: tasks.length > 0 ? tasks : undefined,
      });

      toast.success('Handover submitted successfully');
      setSummary('');
      setPatientNotes([]);
      setTasks([]);
      setSpecialInstructions('');
      setIsOpen(false);

      // Fire any forms assigned to the shift_handover trigger
      formsTrigger.fire('shift_handover', undefined, {});
    } catch {
      toast.error('Failed to submit handover');
    }
  }, [summary, shiftType, patientNotes, tasks, specialInstructions, createHandover, formsTrigger]);

  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary overflow-hidden">
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-surface-container-low/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          <h3 className="font-headline text-sm font-bold text-on-surface">Create Handover</h3>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-on-surface-variant" />
        ) : (
          <ChevronDown className="h-4 w-4 text-on-surface-variant" />
        )}
      </button>

      {/* Form Body */}
      {isOpen && (
        <div className="space-y-4 border-t border-outline-variant/20 p-4">
          {/* Shift Type */}
          <div>
            <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
              Shift Type
            </label>
            <Select value={shiftType} onValueChange={(value) => { if (value) setShiftType(value); }}>
              <SelectTrigger className="h-9 w-48 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">Morning (06:00 - 14:00)</SelectItem>
                <SelectItem value="afternoon">Afternoon (14:00 - 22:00)</SelectItem>
                <SelectItem value="night">Night (22:00 - 06:00)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Summary */}
          <div>
            <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
              Handover Summary *
            </label>
            <Textarea
              placeholder="Overall summary of the shift — key events, issues, and anything the incoming team needs to know..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="min-h-[80px] text-sm resize-none"
              rows={3}
            />
          </div>

          {/* Patient Notes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                Patient-Specific Notes
              </label>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-primary" onClick={handleAddPatientNote}>
                <Plus className="mr-1 h-3 w-3" />
                Add Patient
              </Button>
            </div>
            {patientNotes.length === 0 && (
              <p className="text-xs text-on-surface-variant/60 italic py-2">
                No patient-specific notes added. Click &quot;Add Patient&quot; to include notes for individual patients.
              </p>
            )}
            <div className="space-y-2">
              {patientNotes.map((note, idx) => (
                <PatientNoteRow
                  key={idx}
                  note={note}
                  index={idx}
                  onChange={handlePatientNoteChange}
                  onRemove={handleRemovePatientNote}
                />
              ))}
            </div>
          </div>

          {/* Outstanding Tasks */}
          <div>
            <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
              Outstanding Tasks
            </label>
            <div className="flex gap-2 mb-2">
              <Input
                placeholder="Add a task..."
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTask();
                  }
                }}
                className="h-8 text-xs flex-1"
              />
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleAddTask} disabled={!newTask.trim()}>
                Add
              </Button>
            </div>
            {tasks.length > 0 && (
              <ul className="space-y-1">
                {tasks.map((task, idx) => (
                  <li key={idx} className="flex items-center justify-between rounded-md bg-surface-container-low/50 px-3 py-1.5 text-xs">
                    <span className="text-on-surface">{task}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTask(idx)}
                      className="ml-2 text-destructive/60 hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Special Instructions */}
          <div>
            <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
              Special Instructions
            </label>
            <Textarea
              placeholder="Any special instructions, alerts, or follow-up items..."
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              className="min-h-[56px] text-sm resize-none"
              rows={2}
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSubmit}
              disabled={createHandover.isPending || !summary.trim()}
              className="gap-2"
            >
              {createHandover.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Submit Handover
            </Button>
          </div>
        </div>
      )}

      {/* Forms assigned to shift_handover trigger fire after submission */}
      <IntakeFormsModal
        open={formsTrigger.isOpen}
        trigger="shift_handover"
        tenantId={formsTrigger.tenantId}
        context={formsTrigger.context}
        onComplete={formsTrigger.close}
      />
    </div>
  );
}

// ── Handover Card ────────────────────────────────────────────

function HandoverCard({
  handover,
  currentUserId,
  onAcknowledge,
  isAcknowledging,
  onComplete,
  isCompleting,
}: {
  handover: ShiftHandover;
  currentUserId?: string;
  onAcknowledge: (id: string) => void;
  isAcknowledging: boolean;
  onComplete: (id: string, completionNote?: string) => void;
  isCompleting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const shiftCfg = SHIFT_CONFIG[handover.shiftType as ShiftType] ?? SHIFT_CONFIG.morning;
  const ShiftIcon = shiftCfg.icon;

  const fromName = handover.fromUser
    ? `${handover.fromUser.firstName} ${handover.fromUser.lastName}`
    : 'Unknown';
  const toName = handover.toUser
    ? `${handover.toUser.firstName} ${handover.toUser.lastName}`
    : 'Unassigned';

  const canAcknowledge =
    handover.status === 'submitted' &&
    currentUserId &&
    handover.toUserId !== handover.fromUserId;

  const priorityColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    normal: 'bg-blue-100 text-blue-700',
    low: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary overflow-hidden">
      {/* Card Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-surface-container-low/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', shiftCfg.color)}>
            <ShiftIcon className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-headline text-sm font-semibold text-on-surface">
                {fromName}
              </span>
              <span className="text-[10px] text-on-surface-variant">&rarr;</span>
              <span className="text-xs text-on-surface-variant">{toName}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-label text-[10px] text-on-surface-variant">
                {formatDateTime(handover.createdAt)}
              </span>
              <span className="text-[10px] text-on-surface-variant">&middot;</span>
              <span className="font-label text-[10px] text-on-surface-variant capitalize">
                {shiftCfg.label} shift
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
              STATUS_BADGE[handover.status] ?? STATUS_BADGE.draft,
            )}
          >
            {handover.status}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-on-surface-variant" />
          ) : (
            <ChevronDown className="h-4 w-4 text-on-surface-variant" />
          )}
        </div>
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-outline-variant/20 p-4 space-y-4">
          {/* Summary */}
          <div>
            <h4 className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">
              Summary
            </h4>
            <p className="text-sm text-on-surface whitespace-pre-wrap">{handover.summary}</p>
          </div>

          {/* Patient Notes */}
          {handover.patientNotes && handover.patientNotes.length > 0 && (
            <div>
              <h4 className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">
                Patient Notes
              </h4>
              <div className="space-y-2">
                {handover.patientNotes.map((pn, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-outline-variant/20 bg-surface-container-low/40 p-2.5"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-on-surface">
                        {pn.patientName}
                      </span>
                      {pn.priority && (
                        <span
                          className={cn(
                            'text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize',
                            priorityColors[pn.priority] ?? priorityColors.normal,
                          )}
                        >
                          {pn.priority}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant whitespace-pre-wrap">
                      {pn.note}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outstanding Tasks */}
          {handover.outstandingTasks && handover.outstandingTasks.length > 0 && (
            <div>
              <h4 className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">
                Outstanding Tasks
              </h4>
              <ul className="space-y-1">
                {handover.outstandingTasks.map((task, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs text-on-surface"
                  >
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {task}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Special Instructions */}
          {handover.specialInstructions && (
            <div>
              <h4 className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">
                Special Instructions
              </h4>
              <p className="text-sm text-on-surface whitespace-pre-wrap rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                {handover.specialInstructions}
              </p>
            </div>
          )}

          {/* Acknowledged info */}
          {handover.status === 'acknowledged' && handover.acknowledgedAt && (
            <div className="flex items-center gap-2 text-xs text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Acknowledged at {formatDateTime(handover.acknowledgedAt)}
            </div>
          )}

          {/* Acknowledge + Complete actions */}
          {canAcknowledge && (
            <CompletionActions
              onAcknowledge={() => onAcknowledge(handover.id)}
              isAcknowledging={isAcknowledging}
              onComplete={(note) => onComplete(handover.id, note)}
              isCompleting={isCompleting}
            />
          )}

          {/* Already acknowledged but not yet "finalised" by current user —
              still allow appending a completion note via Mark Complete */}
          {!canAcknowledge && handover.status === 'acknowledged' && (
            <CompletionActions
              onComplete={(note) => onComplete(handover.id, note)}
              isCompleting={isCompleting}
              variant="finalise"
            />
          )}
        </div>
      )}
    </div>
  );
}

function CompletionActions({
  onAcknowledge,
  isAcknowledging,
  onComplete,
  isCompleting,
  variant = 'default',
}: {
  onAcknowledge?: () => void;
  isAcknowledging?: boolean;
  onComplete: (note?: string) => void;
  isCompleting: boolean;
  variant?: 'default' | 'finalise';
}) {
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [completionNote, setCompletionNote] = useState('');

  return (
    <div className="pt-1 space-y-2">
      <div className="flex flex-wrap justify-end gap-2">
        {onAcknowledge && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            onClick={onAcknowledge}
            disabled={isAcknowledging}
          >
            {isAcknowledging ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Acknowledge
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/5"
          onClick={() => setShowCompleteForm((v) => !v)}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {variant === 'finalise' ? 'Add Completion Note' : 'Mark Complete'}
        </Button>
      </div>

      {showCompleteForm && (
        <div className="rounded-lg border border-outline-variant/30 bg-surface-container-low/40 p-2 space-y-2">
          <Textarea
            rows={2}
            className="text-xs resize-none"
            placeholder="Optional closing note (appended to the handover content)..."
            value={completionNote}
            onChange={(e) => setCompletionNote(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="text-xs"
              onClick={() => {
                setShowCompleteForm(false);
                setCompletionNote('');
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => {
                onComplete(completionNote.trim() || undefined);
                setShowCompleteForm(false);
                setCompletionNote('');
              }}
              disabled={isCompleting}
            >
              {isCompleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Confirm
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Handover History List ────────────────────────────────────

function HandoverHistoryList() {
  const { user } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const today = toInputDateStr();

  const { data: handovers, isLoading } = useHandovers({
    shiftDate: today,
    isAcknowledged: statusFilter === 'acknowledged' ? 'true' : statusFilter === 'submitted' ? 'false' : undefined,
  });

  const acknowledgeHandover = useAcknowledgeHandover();
  const completeHandover = useCompleteHandover();

  const handleAcknowledge = useCallback(
    async (id: string) => {
      try {
        await acknowledgeHandover.mutateAsync(id);
        toast.success('Handover acknowledged');
      } catch {
        toast.error('Failed to acknowledge handover');
      }
    },
    [acknowledgeHandover],
  );

  const handleComplete = useCallback(
    async (id: string, completionNote?: string) => {
      try {
        await completeHandover.mutateAsync({ id, completionNote });
        toast.success('Handover marked complete');
      } catch {
        toast.error('Failed to mark handover complete');
      }
    },
    [completeHandover],
  );

  const handoverList = Array.isArray(handovers) ? handovers : [];

  return (
    <div className="space-y-3">
      {/* Filter */}
      <div className="flex items-center justify-between">
        <h3 className="font-headline text-sm font-bold text-on-surface">Handover History</h3>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? '')}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : handoverList.length === 0 ? (
        <div className="rounded-xl bg-surface-container-lowest p-8 shadow-sanctuary text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-on-surface-variant/40 mb-2" />
          <p className="text-sm text-on-surface-variant">No handovers found for today</p>
        </div>
      ) : (
        <div className="space-y-2">
          {handoverList.map((handover) => (
            <HandoverCard
              key={handover.id}
              handover={handover}
              currentUserId={user?.id}
              onAcknowledge={handleAcknowledge}
              isAcknowledging={acknowledgeHandover.isPending}
              onComplete={handleComplete}
              isCompleting={completeHandover.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Duty Roster View ─────────────────────────────────────────

function DutyRosterView() {
  const [date, setDate] = useState(toInputDateStr());
  const [shiftFilter, setShiftFilter] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');

  // Fetch the full roster for this date, unfiltered by department, so we can
  // derive the department list for the filter dropdown. Department filter is
  // applied client-side.
  const { data: roster, isLoading } = useDutyRoster({ date });

  const allRoster = useMemo(() => (Array.isArray(roster) ? roster : []), [roster]);

  const departmentOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of allRoster) {
      if (r.department?.id && r.department.name) {
        map.set(r.department.id, r.department.name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allRoster]);

  const filteredRoster = useMemo(() => {
    return allRoster.filter((r) => {
      if (shiftFilter && shiftFilter !== 'all' && r.shiftType !== shiftFilter) return false;
      if (departmentFilter && departmentFilter !== 'all' && r.department?.id !== departmentFilter) return false;
      return true;
    });
  }, [allRoster, shiftFilter, departmentFilter]);

  return (
    <div className="space-y-4">
      {/* Header + Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-headline text-sm font-bold text-on-surface">
          Duty Roster
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 w-40 text-xs"
          />
          <Select
            value={departmentFilter}
            onValueChange={(value) => setDepartmentFilter(value ?? '')}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departmentOptions.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={shiftFilter} onValueChange={(value) => setShiftFilter(value ?? '')}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="All shifts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Shifts</SelectItem>
              <SelectItem value="morning">Morning</SelectItem>
              <SelectItem value="afternoon">Afternoon</SelectItem>
              <SelectItem value="night">Night</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : filteredRoster.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-on-surface-variant/40 mb-2" />
            <p className="text-sm text-on-surface-variant">No roster entries for today</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px]">
              <thead>
                <tr className="border-b border-outline-variant/20">
                  <th className="px-4 py-2.5 text-left font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                    Staff Name
                  </th>
                  <th className="px-4 py-2.5 text-left font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                    Shift
                  </th>
                  <th className="px-4 py-2.5 text-left font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                    Start Time
                  </th>
                  <th className="px-4 py-2.5 text-left font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                    End Time
                  </th>
                  <th className="px-4 py-2.5 text-left font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                    Department
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRoster.map((entry) => {
                  const cfg = SHIFT_CONFIG[entry.shiftType as ShiftType];
                  return (
                    <tr
                      key={entry.id}
                      className="border-b border-outline-variant/10 last:border-b-0 hover:bg-surface-container-low/30 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-sm font-medium text-on-surface">
                        {entry.staff?.user
                          ? `${entry.staff.user.firstName} ${entry.staff.user.lastName}`
                          : '-'}
                      </td>
                      <td className="px-4 py-2.5">
                        {cfg ? (
                          <span
                            className={cn(
                              'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                              cfg.color,
                            )}
                          >
                            {cfg.label}
                          </span>
                        ) : (
                          <span className="text-xs text-on-surface-variant capitalize">
                            {entry.shiftType}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-on-surface-variant">
                        {formatTime(entry.startTime)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-on-surface-variant">
                        {formatTime(entry.endTime)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-on-surface-variant">
                        {entry.department?.name ?? '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function ShiftHandoverPage() {
  const currentShift = useMemo(() => detectCurrentShift(), []);
  const [activeTab, setActiveTab] = useState<string>('handover');

  return (
    <div className="space-y-4 p-4">
      {/* Page Title */}
      <div className="flex items-center gap-2">
        <Clock className="h-5 w-5 text-primary" />
        <h1 className="font-headline text-lg font-bold text-on-surface">Shift Handover</h1>
      </div>

      {/* Shift Info Header */}
      <ShiftInfoHeader currentShift={currentShift} />

      {/* Shift Summary Panel */}
      <ShiftSummaryPanel currentShift={currentShift} />

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-surface-container-low/60 p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'handover' && (
        <div className="space-y-4">
          <CreateHandoverForm currentShift={currentShift} />
          <HandoverHistoryList />
        </div>
      )}

      {activeTab === 'roster' && <DutyRosterView />}

      {/* Forms assigned by admin to nurse_handover view location appear here */}
      <PatientFormSubmissionsPanel
        title="Handover Forms Submissions"
        viewLocation="nurse_handover"
      />
    </div>
  );
}
