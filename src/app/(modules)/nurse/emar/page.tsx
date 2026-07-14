'use client';

import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { toInputDateStr, formatTime, formatDateTime } from '@/lib/date-utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useNurseAdmissions,
  useActivePrescriptions,
  useDrugInteractions,
  type NurseAdmission,
  type Prescription,
  type InteractionPair,
  type InteractionSeverity,
  type InteractionCheckResult,
} from '@/hooks/use-nurse';
import {
  useEmarSchedules,
  useEmarTimeSlots,
  useGiveDose,
  useHoldDose,
  useRefuseDose,
  useAmendDose,
  useTriggerPrn,
  useRegenerateSchedules,
  useEmarAudit,
  type EmarSchedule,
  type EmarDoseStatus,
} from '@/hooks/use-emar';
import Link from 'next/link';
import {
  AlertTriangle,
  Check,
  X,
  Pause,
  Clock,
  Loader2,
  ShieldAlert,
  Pill,
  Plus,
  CircleDot,
  Ban,
  RefreshCw,
  Info,
  History,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Settings as SettingsIcon,
} from 'lucide-react';

// ── Status presentation ──────────────────────────────────────

const STATUS_META: Record<EmarDoseStatus, {
  label: string;
  icon: typeof Check;
  cellClass: string;
  badgeClass: string;
}> = {
  pending:    { label: 'Pending',    icon: CircleDot,   cellClass: 'bg-gray-100 text-gray-600 hover:bg-gray-200',                badgeClass: 'bg-gray-100 text-gray-700' },
  due:        { label: 'Due',        icon: Clock,       cellClass: 'bg-blue-100 text-blue-700 hover:bg-blue-200',                 badgeClass: 'bg-blue-100 text-blue-800' },
  overdue:    { label: 'Overdue',    icon: AlertCircle, cellClass: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 ring-1 ring-yellow-400', badgeClass: 'bg-yellow-100 text-yellow-800' },
  given:      { label: 'Given',      icon: Check,       cellClass: 'bg-green-100 text-green-700',                                 badgeClass: 'bg-green-100 text-green-800' },
  given_late: { label: 'Given Late', icon: CheckCircle2,cellClass: 'bg-emerald-100 text-emerald-800 ring-1 ring-amber-400',       badgeClass: 'bg-emerald-100 text-emerald-800' },
  missed:     { label: 'Missed',     icon: X,           cellClass: 'bg-red-100 text-red-700',                                     badgeClass: 'bg-red-100 text-red-800' },
  held:       { label: 'Held',       icon: Pause,       cellClass: 'bg-amber-100 text-amber-800',                                 badgeClass: 'bg-amber-100 text-amber-800' },
  refused:    { label: 'Refused',    icon: Ban,         cellClass: 'bg-orange-100 text-orange-800',                               badgeClass: 'bg-orange-100 text-orange-800' },
  cancelled:  { label: 'Cancelled',  icon: X,           cellClass: 'bg-gray-100 text-gray-400 line-through',                      badgeClass: 'bg-gray-100 text-gray-500' },
};

const ACTIONABLE: EmarDoseStatus[] = ['pending', 'due', 'overdue'];

function nowTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildIso(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

// ── Page component ───────────────────────────────────────────

export default function EmarPage() {
  const searchParams = useSearchParams();
  const admissionIdParam = searchParams.get('admissionId') ?? '';

  // Initialise from the URL but treat as plain local state thereafter so the
  // user can change selection via the Select dropdown without a route change.
  const [selectedAdmissionId, setSelectedAdmissionId] = useState(admissionIdParam);
  const [selectedDate, setSelectedDate] = useState(toInputDateStr());

  // Action dialog state
  type ActionMode = 'give' | 'hold' | 'refuse' | 'missed' | 'amend';
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    mode: ActionMode;
    schedule: EmarSchedule | null;
  }>({ open: false, mode: 'give', schedule: null });

  const [actualGivenTime, setActualGivenTime] = useState(nowTimeStr());
  const [actionReason, setActionReason] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [amendTargetStatus, setAmendTargetStatus] = useState<'given_late' | 'given' | 'missed' | 'held' | 'refused'>('given_late');

  // PRN dialog state
  const [prnDialog, setPrnDialog] = useState<{ open: boolean; itemId: string; drugName: string; dosage: string; frequency: string }>({
    open: false, itemId: '', drugName: '', dosage: '', frequency: '',
  });
  const [prnTime, setPrnTime] = useState(nowTimeStr());
  const [prnNotes, setPrnNotes] = useState('');

  // Audit drawer
  const [auditScheduleId, setAuditScheduleId] = useState<string | null>(null);

  // Interaction detail
  const [interactionDialog, setInteractionDialog] = useState<{ drugName: string; pairs: InteractionPair[] } | null>(null);

  // ── Data ────────────────────────────────────────────────
  const { data: admissionsRaw, isLoading: admissionsLoading } = useNurseAdmissions({
    status: 'admitted',
    limit: 200,
  });
  const admissions: NurseAdmission[] = useMemo(() => {
    if (!admissionsRaw) return [];
    return Array.isArray(admissionsRaw) ? admissionsRaw : (admissionsRaw as any).data ?? [];
  }, [admissionsRaw]);
  const selectedAdmission = useMemo(
    () => admissions.find((a) => a.id === selectedAdmissionId),
    [admissions, selectedAdmissionId],
  );
  const patientId = selectedAdmission?.patientId ?? '';
  const allergies = selectedAdmission?.patient?.allergies ?? [];

  const { data: timeSlotsRaw } = useEmarTimeSlots();
  const timeSlots = useMemo(() => {
    if (!timeSlotsRaw) return [];
    const arr = Array.isArray(timeSlotsRaw) ? timeSlotsRaw : (timeSlotsRaw as any).data ?? [];
    return arr.filter((s: any) => s.isActive);
  }, [timeSlotsRaw]);

  // Highlight the slot closest to "now" — but only when the board is showing
  // today, so the nurse's eye lands on the doses due around now.
  const currentSlotCode = useMemo<string | null>(() => {
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (selectedDate !== localToday) return null;
    const nowHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const passed = [...timeSlots].filter((s: any) => (s.time as string) <= nowHM).sort((a: any, b: any) => String(a.time).localeCompare(String(b.time)));
    return passed.length ? passed[passed.length - 1].code : (timeSlots[0]?.code ?? null);
  }, [timeSlots, selectedDate]);

  const dayStart = `${selectedDate}T00:00:00.000Z`;
  const dayEnd = `${selectedDate}T23:59:59.999Z`;

  const { data: schedulesRaw, isLoading: schedulesLoading } = useEmarSchedules({
    admissionId: selectedAdmissionId || undefined,
    fromDate: dayStart,
    toDate: dayEnd,
    limit: 500,
  });
  const schedules: EmarSchedule[] = useMemo(() => {
    if (!schedulesRaw) return [];
    return Array.isArray(schedulesRaw) ? schedulesRaw : (schedulesRaw as any).data ?? [];
  }, [schedulesRaw]);

  const { data: prescriptionsRaw } = useActivePrescriptions({
    admissionId: selectedAdmissionId || undefined,
    patientId: !selectedAdmissionId ? patientId || undefined : undefined,
    prescriptionType: 'ip',
    status: 'active',
  });
  const prescriptions: Prescription[] = useMemo(() => {
    if (!prescriptionsRaw) return [];
    return Array.isArray(prescriptionsRaw) ? prescriptionsRaw : (prescriptionsRaw as any).data ?? [];
  }, [prescriptionsRaw]);

  // PRN items come from the prescription, not from generated schedules
  const prnItems = useMemo(() => {
    const out: Array<{ prescriptionId: string; itemId: string; drugName: string; dosage: string; frequency: string; route?: string; instructions?: string }> = [];
    for (const rx of prescriptions) {
      for (const item of rx.items) {
        if (item.isPrn) {
          out.push({
            prescriptionId: rx.id,
            itemId: item.id ?? '',
            drugName: item.drugName,
            dosage: item.dosage,
            frequency: item.frequency,
            route: item.route,
            instructions: item.instructions,
          });
        }
      }
    }
    return out;
  }, [prescriptions]);

  // ── Drug interactions ───────────────────────────────────
  const allDrugNames = useMemo(() => {
    const set = new Set<string>();
    for (const rx of prescriptions) for (const item of rx.items) if (item.drugName) set.add(item.drugName);
    return Array.from(set);
  }, [prescriptions]);
  const { data: interactionsData } = useDrugInteractions(allDrugNames);
  const interactions: InteractionCheckResult | undefined = (interactionsData as any)?.data;
  const interactionsByDrug = useMemo(() => {
    const map = new Map<string, InteractionPair[]>();
    if (!interactions?.pairs) return map;
    for (const pair of interactions.pairs) {
      for (const d of pair.drugs) {
        const k = d.toLowerCase().trim();
        const prev = map.get(k) ?? [];
        prev.push(pair);
        map.set(k, prev);
      }
    }
    return map;
  }, [interactions]);

  // ── Group schedules into rows by drug ───────────────────
  type DrugRow = {
    prescriptionItemId: string;
    drugName: string;
    dosage: string;
    route: string;
    frequency: string;
    instructions?: string;
    isPrn: boolean;
    cellsBySlot: Map<string, EmarSchedule[]>;          // slotCode → schedules at that slot
    untimed: EmarSchedule[];                            // schedules with no slotCode (interval/once)
    interactions: InteractionPair[];
  };
  const drugRows: DrugRow[] = useMemo(() => {
    const byItem = new Map<string, DrugRow>();
    for (const s of schedules) {
      if (s.isPrn) continue;
      const key = s.prescriptionItemId;
      let row = byItem.get(key);
      if (!row) {
        row = {
          prescriptionItemId: s.prescriptionItemId,
          drugName: s.drugName,
          dosage: s.dosage,
          route: s.route,
          frequency: s.prescriptionItem?.frequency ?? s.frequencyCode ?? '',
          instructions: s.prescriptionItem?.instructions ?? undefined,
          isPrn: s.prescriptionItem?.isPrn ?? false,
          cellsBySlot: new Map(),
          untimed: [],
          interactions: interactionsByDrug.get(s.drugName.toLowerCase().trim()) ?? [],
        };
        byItem.set(key, row);
      }
      if (s.slotCode) {
        const arr = row.cellsBySlot.get(s.slotCode) ?? [];
        arr.push(s);
        row.cellsBySlot.set(s.slotCode, arr);
      } else {
        row.untimed.push(s);
      }
    }
    return Array.from(byItem.values()).sort((a, b) => a.drugName.localeCompare(b.drugName));
  }, [schedules, interactionsByDrug]);

  // Stats
  const stats = useMemo(() => {
    let total = 0, given = 0, missed = 0, due = 0, overdue = 0, held = 0, refused = 0;
    for (const s of schedules) {
      if (s.status === 'cancelled') continue;
      total++;
      if (s.status === 'given' || s.status === 'given_late') given++;
      else if (s.status === 'missed') missed++;
      else if (s.status === 'due') due++;
      else if (s.status === 'overdue') overdue++;
      else if (s.status === 'held') held++;
      else if (s.status === 'refused') refused++;
    }
    return { total, given, missed, due, overdue, held, refused };
  }, [schedules]);

  // ── Mutations ───────────────────────────────────────────
  const giveDose = useGiveDose();
  const holdDose = useHoldDose();
  const refuseDose = useRefuseDose();
  const amendDose = useAmendDose();
  const triggerPrn = useTriggerPrn();
  const regenerate = useRegenerateSchedules();

  // ── Handlers ────────────────────────────────────────────
  const openActionDialog = useCallback((schedule: EmarSchedule, mode: ActionMode) => {
    setActionDialog({ open: true, mode, schedule });
    setActualGivenTime(nowTimeStr());
    setActionReason(schedule.reason ?? '');
    setActionNotes('');
    setAmendTargetStatus('given_late');
  }, []);

  const closeActionDialog = useCallback(() => {
    setActionDialog({ open: false, mode: 'give', schedule: null });
    setActionReason('');
    setActionNotes('');
  }, []);

  const submitAction = useCallback(async () => {
    const { mode, schedule } = actionDialog;
    if (!schedule) return;

    const requiresReason = mode === 'hold' || mode === 'refuse';
    if (requiresReason && !actionReason.trim()) {
      toast.error('Reason is required.');
      return;
    }

    try {
      if (mode === 'give') {
        const iso = buildIso(selectedDate, actualGivenTime);
        await giveDose.mutateAsync({ id: schedule.id, actualGivenTime: iso, notes: actionNotes.trim() || undefined });
        toast.success(`${schedule.drugName} marked as given`);
      } else if (mode === 'hold') {
        await holdDose.mutateAsync({ id: schedule.id, reason: actionReason.trim(), notes: actionNotes.trim() || undefined });
        toast.success(`${schedule.drugName} held`);
      } else if (mode === 'refuse') {
        await refuseDose.mutateAsync({ id: schedule.id, reason: actionReason.trim(), notes: actionNotes.trim() || undefined });
        toast.success(`${schedule.drugName} marked as refused`);
      } else if (mode === 'amend') {
        const iso = (amendTargetStatus === 'given' || amendTargetStatus === 'given_late')
          ? buildIso(selectedDate, actualGivenTime)
          : undefined;
        await amendDose.mutateAsync({
          id: schedule.id,
          toStatus: amendTargetStatus,
          actualGivenTime: iso,
          reason: actionReason.trim() || undefined,
          notes: actionNotes.trim() || undefined,
        });
        toast.success(`${schedule.drugName} amended → ${amendTargetStatus}`);
      }
      closeActionDialog();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Action failed');
    }
  }, [actionDialog, actionReason, actionNotes, actualGivenTime, amendTargetStatus, selectedDate, giveDose, holdDose, refuseDose, amendDose, closeActionDialog]);

  const submitPrn = useCallback(async () => {
    if (!prnDialog.itemId) return;
    try {
      const iso = buildIso(selectedDate, prnTime);
      await triggerPrn.mutateAsync({
        prescriptionItemId: prnDialog.itemId,
        actualGivenTime: iso,
        notes: prnNotes.trim() || undefined,
      });
      toast.success(`${prnDialog.drugName} (PRN) recorded`);
      setPrnDialog({ open: false, itemId: '', drugName: '', dosage: '', frequency: '' });
      setPrnNotes('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'PRN failed');
    }
  }, [prnDialog, prnTime, prnNotes, selectedDate, triggerPrn]);

  // ── Render ──────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold">eMAR — Medication Administration Record</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Dose-level execution: each scheduled dose is its own row, tracked independently.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedAdmissionId && prescriptions.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={async () => {
                try {
                  let total = 0;
                  for (const rx of prescriptions) {
                    const r = await regenerate.mutateAsync({ prescriptionId: rx.id });
                    total += (r as any)?.data?.rowsCreated ?? 0;
                  }
                  toast.success(`Regenerated ${total} dose row(s)`);
                } catch {
                  toast.error('Regenerate failed');
                }
              }}
              disabled={regenerate.isPending}
            >
              {regenerate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Regenerate doses
            </Button>
          )}
          <Link href="/nurse/emar/settings">
            <Button size="sm" variant="ghost" className="gap-1.5 text-xs">
              <SettingsIcon className="h-3 w-3" />
              Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* Patient + Date */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[240px]">
            <Label className="text-xs font-medium text-on-surface-variant mb-1 block">Admitted Patient</Label>
            <Select value={selectedAdmissionId} onValueChange={(v) => setSelectedAdmissionId(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select patient..." />
              </SelectTrigger>
              <SelectContent>
                {admissions.map((adm) => (
                  <SelectItem key={adm.id} value={adm.id}>
                    {adm.patient
                      ? `${adm.patient.firstName} ${adm.patient.lastName} (${adm.patient.uhid ?? adm.patient.mrn})`
                      : adm.ipNumber ?? adm.id}
                    {adm.ward ? ` — ${adm.ward.name}` : ''}
                    {adm.bed ? ` / Bed ${adm.bed.bedNumber}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-44">
            <Label className="text-xs font-medium text-on-surface-variant mb-1 block">Date</Label>
            <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Allergy banner */}
      {selectedAdmissionId && allergies.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 shadow-sm">
          <ShieldAlert className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-800">Allergy Alert</p>
            <p className="text-xs text-red-700 mt-0.5">
              Known allergies: <span className="font-bold uppercase">{allergies.join(', ')}</span>
            </p>
            <p className="text-[10px] text-red-600 mt-1">Verify all medications against patient allergy profile before administration.</p>
          </div>
        </div>
      )}

      {/* Interactions banner */}
      {selectedAdmissionId && interactions && interactions.pairs.length > 0 && (
        <InteractionBanner result={interactions} />
      )}

      {!selectedAdmissionId && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-12 text-center">
          <Pill className="h-10 w-10 text-primary/30 mx-auto mb-3" />
          <p className="text-sm text-on-surface-variant">Select an admitted patient to view their medication schedule.</p>
        </div>
      )}

      {selectedAdmissionId && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <StatCard label="Total" value={stats.total} color="text-on-surface" />
            <StatCard label="Given" value={stats.given} color="text-green-700" />
            <StatCard label="Due" value={stats.due} color="text-blue-700" />
            <StatCard label="Overdue" value={stats.overdue} color="text-yellow-700" />
            <StatCard label="Missed" value={stats.missed} color="text-red-700" />
            <StatCard label="Held" value={stats.held} color="text-amber-700" />
            <StatCard label="Refused" value={stats.refused} color="text-orange-700" />
          </div>

          {/* Schedule grid */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
            <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between">
              <h2 className="font-headline text-sm font-bold">Scheduled Medications</h2>
              {schedulesLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            </div>

            {drugRows.length === 0 && !schedulesLoading ? (
              <div className="p-8 text-center text-sm text-on-surface-variant">
                No scheduled doses for this date. {prescriptions.length > 0 && 'If you just added a prescription, click "Regenerate doses" above.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="border-b border-outline-variant bg-surface-container-low/40">
                      <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant text-left px-4 py-2.5 w-[280px] sticky left-0 bg-surface-container-low z-10">
                        Medication
                      </th>
                      {timeSlots.map((slot: any) => {
                        const isNow = slot.code === currentSlotCode;
                        return (
                          <th
                            key={slot.code}
                            className={cn(
                              'font-label text-[10px] uppercase tracking-widest text-center px-1 py-2.5 w-[80px]',
                              isNow ? 'text-primary bg-primary/10' : 'text-on-surface-variant',
                            )}
                          >
                            <div className="flex items-center justify-center gap-1">
                              {slot.label}
                              {isNow && <span className="h-1.5 w-1.5 rounded-full bg-primary" title="Now" />}
                            </div>
                            <div className={cn('text-[9px]', isNow ? 'text-primary/80' : 'text-on-surface-variant/70')}>{slot.time}</div>
                          </th>
                        );
                      })}
                      <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant text-center px-1 py-2.5 w-[120px]">
                        Other doses
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {drugRows.map((drug) => (
                      <tr key={drug.prescriptionItemId} className="border-b border-outline-variant/50 hover:bg-surface-container-low/40 transition-colors">
                        <td className="px-4 py-2.5 sticky left-0 bg-surface-container-lowest z-10">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                              <Pill className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-semibold text-on-surface truncate">{drug.drugName}</span>
                                {drug.interactions.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setInteractionDialog({ drugName: drug.drugName, pairs: drug.interactions })}
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 hover:bg-orange-200"
                                  >
                                    <AlertTriangle className="h-2.5 w-2.5 inline -mt-0.5 mr-0.5" />
                                    {drug.interactions.length} Interaction{drug.interactions.length !== 1 ? 's' : ''}
                                  </button>
                                )}
                              </div>
                              <p className="text-[11px] text-on-surface-variant mt-0.5">
                                {[
                                  drug.dosage && drug.dosage.trim() !== drug.drugName.trim() ? drug.dosage : null,
                                  drug.frequency,
                                  drug.route,
                                ].filter(Boolean).join(' · ')}
                              </p>
                              {drug.instructions && (
                                <p className="text-[10px] text-on-surface-variant italic mt-0.5 truncate max-w-[240px]">{drug.instructions}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        {timeSlots.map((slot: any) => {
                          const cells = drug.cellsBySlot.get(slot.code) ?? [];
                          const isNow = slot.code === currentSlotCode;
                          return (
                            <td key={slot.code} className={cn('text-center px-1 py-2 align-top', isNow && 'bg-primary/5')}>
                              <div className="flex flex-col items-center gap-1">
                                {cells.length === 0 ? (
                                  <span className="text-on-surface-variant/25">–</span>
                                ) : (
                                  cells.map((c) => <DoseButton key={c.id} schedule={c} onClick={(m) => openActionDialog(c, m)} onAudit={(id) => setAuditScheduleId(id)} />)
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td className="text-center px-1 py-2 align-top">
                          <div className="flex flex-col items-center gap-1">
                            {drug.untimed.length === 0 ? (
                              <span className="text-on-surface-variant/25">–</span>
                            ) : (
                              drug.untimed.map((c) => <DoseButton key={c.id} schedule={c} showTime onClick={(m) => openActionDialog(c, m)} onAudit={(id) => setAuditScheduleId(id)} />)
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Legend */}
            <div className="px-4 py-2.5 border-t border-outline-variant/50 flex flex-wrap gap-3">
              {(['pending', 'due', 'overdue', 'given', 'given_late', 'missed', 'held', 'refused'] as EmarDoseStatus[]).map((s) => {
                const meta = STATUS_META[s];
                const Icon = meta.icon;
                return (
                  <span key={s} className="inline-flex items-center gap-1.5 text-[10px] text-on-surface-variant">
                    <span className={cn('inline-flex items-center justify-center w-5 h-5 rounded-full', meta.cellClass)}>
                      <Icon className="h-2.5 w-2.5" />
                    </span>
                    {meta.label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* PRN section */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
            <div className="px-4 py-3 border-b border-outline-variant">
              <h2 className="font-headline text-sm font-bold">PRN Medications (As Needed)</h2>
              <p className="text-[10px] text-on-surface-variant mt-0.5">
                PRN doses are not pre-scheduled. The system enforces a minimum interval since the last administration.
              </p>
            </div>
            {prnItems.length === 0 ? (
              <div className="p-6 text-center text-sm text-on-surface-variant">No PRN orders.</div>
            ) : (
              <div className="divide-y divide-outline-variant/50">
                {prnItems.map((p) => {
                  const lastPrn = schedules
                    .filter((s) => s.isPrn && s.prescriptionItemId === p.itemId && (s.status === 'given' || s.status === 'given_late'))
                    .sort((a, b) => new Date(b.actualGivenTime ?? b.createdAt ?? '').getTime() - new Date(a.actualGivenTime ?? a.createdAt ?? '').getTime())[0];
                  return (
                    <div key={p.itemId} className="flex items-center justify-between px-4 py-3 hover:bg-surface-container-low/40 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-on-surface">{p.drugName}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">PRN</span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant mt-0.5">
                          {[
                            p.dosage && p.dosage.trim() !== p.drugName.trim() ? p.dosage : null,
                            p.frequency,
                            p.route,
                          ].filter(Boolean).join(' · ')}
                        </p>
                        {p.instructions && <p className="text-[10px] text-on-surface-variant italic mt-0.5">{p.instructions}</p>}
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        {lastPrn && (
                          <div className="text-right">
                            <p className="text-[10px] text-on-surface-variant">Last given</p>
                            <p className="text-xs font-medium text-on-surface">{formatTime(lastPrn.actualGivenTime ?? '')}</p>
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs"
                          onClick={() => {
                            setPrnDialog({ open: true, itemId: p.itemId, drugName: p.drugName, dosage: p.dosage, frequency: p.frequency });
                            setPrnTime(nowTimeStr());
                            setPrnNotes('');
                          }}
                        >
                          <Plus className="h-3 w-3" />
                          Record
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Action dialog */}
      <Dialog open={actionDialog.open} onOpenChange={(open) => !open && closeActionDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pill className="h-4 w-4 text-primary" />
              {actionDialog.mode === 'give' && 'Give Dose'}
              {actionDialog.mode === 'hold' && 'Hold Dose'}
              {actionDialog.mode === 'refuse' && 'Refuse Dose'}
              {actionDialog.mode === 'missed' && 'Mark Missed'}
              {actionDialog.mode === 'amend' && 'Amend Dose'}
            </DialogTitle>
          </DialogHeader>

          {actionDialog.schedule && (
            <div className="space-y-4">
              <div className="rounded-lg bg-surface-container-low p-3 space-y-1">
                <p className="text-sm font-semibold">{actionDialog.schedule.drugName}</p>
                <p className="text-xs text-on-surface-variant">
                  Dose: <span className="font-medium text-on-surface">{actionDialog.schedule.dosage}</span>
                  {actionDialog.schedule.route && (
                    <> &middot; Route: <span className="font-medium text-on-surface">{actionDialog.schedule.route}</span></>
                  )}
                </p>
                <p className="text-xs text-on-surface-variant">
                  Scheduled: <span className="font-medium text-on-surface">{formatDateTime(actionDialog.schedule.scheduledAt)}</span>
                </p>
                <p className="text-xs">
                  Current status:{' '}
                  <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full', STATUS_META[actionDialog.schedule.status].badgeClass)}>
                    {STATUS_META[actionDialog.schedule.status].label}
                  </span>
                </p>
              </div>

              {allergies.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <p className="text-[10px] text-amber-800">Patient allergies: <span className="font-bold">{allergies.join(', ')}</span></p>
                </div>
              )}

              {/* Amend mode: pick target status */}
              {actionDialog.mode === 'amend' && (
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Amend to</Label>
                  <Select value={amendTargetStatus} onValueChange={(v) => v && setAmendTargetStatus(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="given_late">Given Late (with delay)</SelectItem>
                      <SelectItem value="given">Given (within grace)</SelectItem>
                      <SelectItem value="missed">Missed</SelectItem>
                      <SelectItem value="held">Held</SelectItem>
                      <SelectItem value="refused">Refused</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-on-surface-variant mt-1">
                    Delay (minutes) is calculated from <code className="text-[10px]">actual given time − scheduled time</code>, not from log entry time.
                  </p>
                </div>
              )}

              {/* Time when give/amend-to-given */}
              {(actionDialog.mode === 'give' ||
                (actionDialog.mode === 'amend' && (amendTargetStatus === 'given' || amendTargetStatus === 'given_late'))) && (
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Actual time given</Label>
                  <Input type="time" value={actualGivenTime} onChange={(e) => setActualGivenTime(e.target.value)} className="w-40" />
                </div>
              )}

              {/* Reason */}
              {(actionDialog.mode === 'hold' || actionDialog.mode === 'refuse' ||
                (actionDialog.mode === 'amend' && (amendTargetStatus === 'held' || amendTargetStatus === 'refused'))) && (
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">
                    Reason <span className="text-red-500">*</span>
                  </Label>
                  <Textarea value={actionReason} onChange={(e) => setActionReason(e.target.value)} rows={2} placeholder="Reason..." />
                </div>
              )}

              <div>
                <Label className="text-xs font-medium mb-1.5 block">Notes</Label>
                <Textarea value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} rows={2} placeholder="Optional notes..." />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={closeActionDialog}>Cancel</Button>
            <Button size="sm" onClick={submitAction} disabled={giveDose.isPending || holdDose.isPending || refuseDose.isPending || amendDose.isPending} className="gap-1.5">
              {(giveDose.isPending || holdDose.isPending || refuseDose.isPending || amendDose.isPending) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PRN dialog */}
      <Dialog open={prnDialog.open} onOpenChange={(open) => !open && setPrnDialog({ ...prnDialog, open: false })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary" />Record PRN Dose</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-surface-container-low p-3 space-y-1">
              <p className="text-sm font-semibold">{prnDialog.drugName}</p>
              <p className="text-xs text-on-surface-variant">Dose: <span className="font-medium text-on-surface">{prnDialog.dosage}</span></p>
              <p className="text-xs text-on-surface-variant">Frequency: {prnDialog.frequency}</p>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Time given</Label>
              <Input type="time" value={prnTime} onChange={(e) => setPrnTime(e.target.value)} className="w-40" />
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Notes</Label>
              <Textarea rows={3} value={prnNotes} onChange={(e) => setPrnNotes(e.target.value)} placeholder="Reason for PRN dose, patient complaint, etc." />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setPrnDialog({ ...prnDialog, open: false })}>Cancel</Button>
            <Button size="sm" onClick={submitPrn} disabled={triggerPrn.isPending} className="gap-1.5">
              {triggerPrn.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit drawer */}
      <AuditDialog scheduleId={auditScheduleId} onClose={() => setAuditScheduleId(null)} />

      {/* Interaction dialog */}
      <Dialog open={!!interactionDialog} onOpenChange={(open) => !open && setInteractionDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              Drug Interactions — {interactionDialog?.drugName}
            </DialogTitle>
          </DialogHeader>
          {interactionDialog && (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {interactionDialog.pairs.map((p, i) => {
                const other = p.drugs.find((d) => d.toLowerCase().trim() !== interactionDialog.drugName.toLowerCase().trim()) ?? '';
                return (
                  <div key={i} className={cn('rounded-lg border p-3', severityClass(p.severity))}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold">with {other}</span>
                      <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded-full', severityBadge(p.severity))}>{p.severity}</span>
                    </div>
                    <p className="text-xs">{p.description}</p>
                  </div>
                );
              })}
            </div>
          )}
          <DialogFooter><Button variant="outline" size="sm" onClick={() => setInteractionDialog(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── DoseButton ───────────────────────────────────────────────

function DoseButton({
  schedule,
  showTime,
  onClick,
  onAudit,
}: {
  schedule: EmarSchedule;
  showTime?: boolean;
  onClick: (mode: 'give' | 'hold' | 'refuse' | 'missed' | 'amend') => void;
  onAudit: (id: string) => void;
}) {
  const meta = STATUS_META[schedule.status];
  const Icon = meta.icon;

  const isActionable = ACTIONABLE.includes(schedule.status);
  const isCompleted = !isActionable && schedule.status !== 'cancelled';
  const hasMenu = isActionable || isCompleted;

  const doseButton = (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center w-9 h-9 rounded-full transition-all',
        'focus:outline-none focus:ring-2 focus:ring-primary/40',
        meta.cellClass,
        'hover:scale-110',
      )}
      title={`${meta.label}${schedule.actualGivenTime ? ` at ${formatTime(schedule.actualGivenTime)}` : ''}${schedule.delayMinutes != null ? ` (delay ${schedule.delayMinutes}m)` : ''}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  return (
    <div className="flex flex-col items-center">
      {/* The action menu is portaled (DropdownMenu) so it never grows the
          horizontally-scrolling grid — clicking the dose opens it below. */}
      {hasMenu ? (
        <DropdownMenu>
          <DropdownMenuTrigger render={doseButton} />
          <DropdownMenuContent align="center" side="bottom" sideOffset={6} className="min-w-[112px] w-auto p-1">
            {isActionable ? (
              <>
                <DropdownMenuItem onClick={() => onClick('give')} className="text-green-700 focus:bg-green-50 focus:text-green-800">
                  <Check className="h-3.5 w-3.5" /> Give
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onClick('hold')} className="text-amber-700 focus:bg-amber-50 focus:text-amber-800">
                  <Pause className="h-3.5 w-3.5" /> Hold
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onClick('refuse')} className="text-orange-700 focus:bg-orange-50 focus:text-orange-800">
                  <Ban className="h-3.5 w-3.5" /> Refuse
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem onClick={() => onClick('amend')} className="text-primary focus:bg-primary/5">
                  <Edit3 className="h-3.5 w-3.5" /> Amend
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAudit(schedule.id)}>
                  <History className="h-3.5 w-3.5" /> Audit
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        doseButton
      )}
      {showTime && (
        <div className="text-[9px] text-on-surface-variant mt-0.5">{formatTime(schedule.scheduledAt)}</div>
      )}
      {schedule.status === 'given_late' && schedule.delayMinutes != null && (
        <div className="text-[9px] text-emerald-700 font-bold mt-0.5">+{schedule.delayMinutes}m</div>
      )}
    </div>
  );
}

// ── AuditDialog ──────────────────────────────────────────────

function AuditDialog({ scheduleId, onClose }: { scheduleId: string | null; onClose: () => void }) {
  const { data, isLoading } = useEmarAudit(scheduleId);
  const entries = useMemo(() => {
    if (!data) return [];
    return Array.isArray(data) ? data : (data as any).data ?? [];
  }, [data]);

  return (
    <Dialog open={!!scheduleId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Audit Trail
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="p-6 text-center"><Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" /></div>
        ) : entries.length === 0 ? (
          <div className="p-6 text-center text-sm text-on-surface-variant">No audit entries.</div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {entries.map((e: any) => (
              <div key={e.id} className="rounded-lg border border-outline-variant p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase text-[10px] text-primary">{e.action}</span>
                  <span className="text-[10px] text-on-surface-variant">{formatDateTime(e.performedAt)}</span>
                </div>
                <p className="mt-1">
                  Status: {e.fromStatus ? <span className="font-mono">{e.fromStatus}</span> : <span className="italic text-on-surface-variant">—</span>} → <span className="font-mono font-bold">{e.toStatus}</span>
                </p>
                {e.delayMinutes != null && <p className="mt-1 text-amber-700">Delay: {e.delayMinutes} min</p>}
                {e.reason && <p className="mt-1"><span className="text-on-surface-variant">Reason:</span> {e.reason}</p>}
                {e.notes && <p className="mt-1"><span className="text-on-surface-variant">Notes:</span> {e.notes}</p>}
                {e.performedBy && (
                  <p className="mt-1 text-on-surface-variant">By {e.performedBy.firstName} {e.performedBy.lastName}</p>
                )}
              </div>
            ))}
          </div>
        )}
        <DialogFooter><Button variant="outline" size="sm" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── helpers ─────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary px-4 py-3">
      <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">{label}</p>
      <p className={cn('text-2xl font-bold mt-0.5', color)}>{value}</p>
    </div>
  );
}

function InteractionBanner({ result }: { result: InteractionCheckResult }) {
  const sevLabel: Record<InteractionSeverity, string> = {
    contraindicated: 'Contraindicated',
    major: 'Major',
    moderate: 'Moderate',
    minor: 'Minor',
  };
  const highest = result.highestSeverity;
  const borderClass = highest === 'contraindicated' || highest === 'major' ? 'border-red-300 bg-red-50' : 'border-orange-300 bg-orange-50';
  const iconClass = highest === 'contraindicated' || highest === 'major' ? 'text-red-600' : 'text-orange-600';
  const textClass = highest === 'contraindicated' || highest === 'major' ? 'text-red-800' : 'text-orange-800';
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border-2 px-4 py-3 shadow-sm', borderClass)}>
      <AlertTriangle className={cn('h-5 w-5 mt-0.5 shrink-0', iconClass)} />
      <div className="flex-1">
        <p className={cn('text-sm font-bold', textClass)}>
          Drug Interaction Warning — {result.pairs.length} {result.pairs.length === 1 ? 'pair' : 'pairs'} detected
          {highest ? ` (highest: ${sevLabel[highest]})` : ''}
        </p>
        <ul className={cn('text-xs mt-1 space-y-0.5', textClass)}>
          {result.pairs.slice(0, 3).map((p, i) => (
            <li key={i}>
              <span className="font-semibold">{p.drugs[0]} + {p.drugs[1]}</span>
              <span className="opacity-80"> — {p.description}</span>
            </li>
          ))}
          {result.pairs.length > 3 && <li className="opacity-80">…and {result.pairs.length - 3} more.</li>}
        </ul>
      </div>
    </div>
  );
}

function severityClass(s: InteractionSeverity): string {
  if (s === 'contraindicated') return 'bg-red-50 border-red-300';
  if (s === 'major') return 'bg-red-50 border-red-200';
  if (s === 'moderate') return 'bg-orange-50 border-orange-200';
  return 'bg-amber-50 border-amber-200';
}
function severityBadge(s: InteractionSeverity): string {
  if (s === 'contraindicated') return 'bg-red-200 text-red-900';
  if (s === 'major') return 'bg-red-100 text-red-800';
  if (s === 'moderate') return 'bg-orange-100 text-orange-800';
  return 'bg-amber-100 text-amber-800';
}
