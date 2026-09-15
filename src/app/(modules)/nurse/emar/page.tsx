'use client';

import { useState, useMemo, useCallback, type Dispatch, type SetStateAction } from 'react';
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
import { PatientSafetyBanner } from '@/components/shared/patient-safety-banner';
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
  useEmarFrequencies,
  useGiveDose,
  useHoldDose,
  useRefuseDose,
  useAmendDose,
  useTriggerPrn,
  useRegenerateSchedules,
  useCatchUpDose,
  useEmarAudit,
  useNdpsDoseContext,
  type EmarSchedule,
  type EmarDoseStatus,
  type NdpsPatientDoseInput,
  type NdpsDoseContext,
} from '@/hooks/use-emar';
import { useUsersList } from '@/hooks/use-users';
import { useAuthStore } from '@/stores/auth-store';
import { WitnessCosignDialog } from '@/components/pharmacy/witness-cosign-dialog';
import Link from 'next/link';
import {
  AlertTriangle,
  Check,
  X,
  Pause,
  Clock,
  Loader2,
  Pill,
  Plus,
  CircleDot,
  Ban,
  RefreshCw,
  History,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Settings as SettingsIcon,
  ShieldAlert,
} from 'lucide-react';
import { fullName } from '@/lib/person-name';

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

const EMPTY_NDPS_FORM = {
  drugBatchId: '', ndpsLocationId: '', labelledQuantity: '', administeredQuantity: '',
  quantityUnit: 'mL', containerQuantity: '1', disposition: 'quarantined' as 'destroyed' | 'quarantined',
  disposalMethod: '', quarantineLocation: '', emergencyReason: '', notes: '',
};

function effectiveNdpsBatch(context: NdpsDoseContext, value: typeof EMPTY_NDPS_FORM) {
  return value.drugBatchId || context.linkedBatchId || context.batches?.[0]?.id || '';
}

function effectiveNdpsLocation(context: NdpsDoseContext, value: typeof EMPTY_NDPS_FORM) {
  if (value.ndpsLocationId) return value.ndpsLocationId;
  const locations = context.locations ?? [];
  return locations.find((location) => location.preferred && location.availableContainers > 0)?.id
    ?? locations.find((location) => location.availableContainers > 0)?.id
    ?? locations[0]?.id
    ?? '';
}

// ── Page component ───────────────────────────────────────────

export default function EmarPage() {
  const searchParams = useSearchParams();
  const admissionIdParam = searchParams.get('admissionId') ?? '';
  // `?focus=overdue|due` arrives from the nurse dashboard's medication tiles.
  // Those counts are ward-wide, so landing on the per-patient board and asking
  // the nurse to guess which admission to open is the extra step QA reported.
  // With a focus set, the page leads with exactly those doses across every
  // patient, each row opening that patient's own chart.
  const focusParam = searchParams.get('focus');
  const focus: 'overdue' | 'due' | null =
    focusParam === 'overdue' || focusParam === 'due' ? focusParam : null;

  // Initialise from the URL but treat as plain local state thereafter so the
  // user can change selection via the Select dropdown without a route change.
  const [selectedAdmissionId, setSelectedAdmissionId] = useState(admissionIdParam);
  const [selectedDate, setSelectedDate] = useState(toInputDateStr());

  // Action dialog state
  type ActionMode = 'give' | 'hold' | 'refuse' | 'missed' | 'amend';
  // A "catch-up" target has no schedule row yet — it's a slot whose dose was
  // never generated (its time had passed at ordering). The row is created on
  // submit via the catch-up endpoint.
  type CatchUpTarget = {
    prescriptionItemId: string;
    slotCode: string;
    date: string;
    drugName: string;
    dosage: string;
    route: string;
    scheduledAt: string;
  };
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    mode: ActionMode;
    schedule: EmarSchedule | null;
    catchUp: CatchUpTarget | null;
  }>({ open: false, mode: 'give', schedule: null, catchUp: null });

  const [actualGivenTime, setActualGivenTime] = useState(nowTimeStr());
  const [actionReason, setActionReason] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [amendTargetStatus, setAmendTargetStatus] = useState<'given_late' | 'given' | 'missed' | 'held' | 'refused'>('given_late');
  const [ndpsForm, setNdpsForm] = useState(EMPTY_NDPS_FORM);
  const [ndpsWitnessOpen, setNdpsWitnessOpen] = useState(false);
  const [pendingNdpsGive, setPendingNdpsGive] = useState<NdpsPatientDoseInput | null>(null);

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

  const ndpsScheduleId = actionDialog.open && actionDialog.mode === 'give'
    ? actionDialog.schedule?.id ?? null
    : null;
  const ndpsContextQ = useNdpsDoseContext(ndpsScheduleId);
  const ndpsContext = ndpsContextQ.data;
  const { data: witnessUsers } = useUsersList({ isActive: 'true', limit: 200 });
  const currentUserId = useAuthStore((state) => state.user?.id) ?? null;
  const witnessOptions = useMemo(
    () => (witnessUsers?.data ?? [])
      .filter((user) => user.id !== currentUserId)
      .map((user) => ({
        id: user.id,
        name: `${user.firstName} ${user.lastName ?? ''}`.trim(),
        role: user.userRoles?.[0]?.role?.name ?? null,
      })),
    [witnessUsers, currentUserId],
  );

  // Every dose in the focused state, across all patients on the ward.
  const { data: focusDosesRaw, isLoading: focusLoading } = useEmarSchedules({
    allPatients: !!focus,
    // "Overdue" is its own status; "due" is what is live right now and has not
    // been actioned, which includes doses that have just tipped over.
    status: focus === 'overdue' ? 'overdue' : focus === 'due' ? ['due', 'overdue'] : undefined,
    includePrn: false,
    limit: 200,
  });
  const focusDoses = useMemo(
    () => (Array.isArray(focusDosesRaw) ? focusDosesRaw : ((focusDosesRaw as any)?.data ?? [])) as EmarSchedule[],
    [focusDosesRaw],
  );

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

  const { data: timeSlotsRaw } = useEmarTimeSlots();
  const timeSlots = useMemo(() => {
    if (!timeSlotsRaw) return [];
    const arr = Array.isArray(timeSlotsRaw) ? timeSlotsRaw : (timeSlotsRaw as any).data ?? [];
    return arr.filter((s: any) => s.isActive);
  }, [timeSlotsRaw]);

  // Frequency master → resolve a frequencyCode to the slots that frequency
  // normally targets, so we can tell "this drug isn't a morning drug" apart
  // from "the morning dose already elapsed before this order was placed today".
  const { data: frequenciesRaw } = useEmarFrequencies();
  const slotsByFreqCode = useMemo(() => {
    const map = new Map<string, string[]>();
    const arr = frequenciesRaw
      ? (Array.isArray(frequenciesRaw) ? frequenciesRaw : (frequenciesRaw as any).data ?? [])
      : [];
    for (const f of arr) map.set(f.code, f.slotCodes ?? []);
    return map;
  }, [frequenciesRaw]);
  // Inline patterns (e.g. "1-1-1") are stored as INLINE_MORNING_AFTERNOON_NIGHT —
  // decode them without a master lookup.
  const intendedSlotsFor = useCallback((frequencyCode: string | null | undefined): string[] => {
    if (!frequencyCode) return [];
    if (frequencyCode.startsWith('INLINE_')) return frequencyCode.slice('INLINE_'.length).split('_').filter(Boolean);
    return slotsByFreqCode.get(frequencyCode) ?? [];
  }, [slotsByFreqCode]);

  // Highlight the slot closest to "now" — but only when the board is showing
  // today, so the nurse's eye lands on the doses due around now.
  const { isToday, isPastDate, nowHM } = useMemo(() => {
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return {
      isToday: selectedDate === localToday,
      isPastDate: selectedDate < localToday,
      nowHM: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    };
  }, [selectedDate]);
  const currentSlotCode = useMemo<string | null>(() => {
    if (!isToday) return null;
    const passed = [...timeSlots].filter((s: any) => (s.time as string) <= nowHM).sort((a: any, b: any) => String(a.time).localeCompare(String(b.time)));
    return passed.length ? passed[passed.length - 1].code : (timeSlots[0]?.code ?? null);
  }, [timeSlots, isToday, nowHM]);

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
    intendedSlots: Set<string>;                        // slots this drug's frequency normally targets
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
          intendedSlots: new Set(intendedSlotsFor(s.frequencyCode)),
          interactions: interactionsByDrug.get(s.drugName.toLowerCase().trim()) ?? [],
        };
        byItem.set(key, row);
      }
      // A drug's intended slots come from its frequency, but always union in any
      // slot that actually has a dose today (covers custom/edge frequencies).
      if (s.slotCode) {
        row.intendedSlots.add(s.slotCode);
        const arr = row.cellsBySlot.get(s.slotCode) ?? [];
        arr.push(s);
        row.cellsBySlot.set(s.slotCode, arr);
      } else {
        row.untimed.push(s);
      }
    }
    return Array.from(byItem.values()).sort((a, b) => a.drugName.localeCompare(b.drugName));
  }, [schedules, interactionsByDrug, intendedSlotsFor]);

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
  const catchUpDose = useCatchUpDose();

  // ── Handlers ────────────────────────────────────────────
  const openActionDialog = useCallback((schedule: EmarSchedule, mode: ActionMode) => {
    setActionDialog({ open: true, mode, schedule, catchUp: null });
    setActualGivenTime(nowTimeStr());
    setActionReason(schedule.reason ?? '');
    setActionNotes('');
    setAmendTargetStatus('given_late');
    setNdpsForm(EMPTY_NDPS_FORM);
    setPendingNdpsGive(null);
  }, []);

  // Open the action dialog for a slot that has no dose row yet (its time had
  // passed at ordering). Only give/hold/refuse/missed apply — no amend.
  const openCatchUpDialog = useCallback((target: CatchUpTarget, mode: Exclude<ActionMode, 'amend'>) => {
    setActionDialog({ open: true, mode, schedule: null, catchUp: target });
    setActualGivenTime(nowTimeStr());
    setActionReason('');
    setActionNotes('');
    setNdpsForm(EMPTY_NDPS_FORM);
    setPendingNdpsGive(null);
  }, []);

  const buildNdpsDose = useCallback((): NdpsPatientDoseInput | undefined => {
    if (!ndpsContext?.isNdps) return undefined;
    const labelledQuantity = Number(ndpsForm.labelledQuantity);
    const administeredQuantity = Number(ndpsForm.administeredQuantity);
    const containerQuantity = Number(ndpsForm.containerQuantity);
    const drugBatchId = effectiveNdpsBatch(ndpsContext, ndpsForm);
    const ndpsLocationId = effectiveNdpsLocation(ndpsContext, ndpsForm);
    if (!drugBatchId) throw new Error('Select the exact batch/container used.');
    if (!ndpsLocationId) throw new Error('Select the NDPS custody location.');
    if (!(labelledQuantity > 0)) throw new Error('Enter the quantity printed on the container label.');
    if (!(administeredQuantity > 0)) throw new Error('Enter the quantity actually administered.');
    if (administeredQuantity > labelledQuantity) throw new Error('Administered quantity cannot exceed labelled quantity.');
    if (!Number.isInteger(containerQuantity) || containerQuantity <= 0) throw new Error('Container count must be a positive whole number.');
    if (!ndpsForm.quantityUnit.trim()) throw new Error('Enter the quantity unit.');
    const residual = Math.round((labelledQuantity - administeredQuantity) * 10_000) / 10_000;
    const disposition = residual === 0 ? 'none' : ndpsForm.disposition;
    if (residual > 0 && disposition === 'destroyed' && !ndpsForm.disposalMethod.trim()) {
      throw new Error('Record the immediate destruction method.');
    }
    if (residual > 0 && disposition === 'quarantined' && !ndpsForm.quarantineLocation.trim()) {
      throw new Error('Record where the sealed residual will be quarantined.');
    }
    if (ndpsContext.requiresEmergencyReason && !ndpsForm.emergencyReason.trim()) {
      throw new Error('Enter why emergency stock was used without a linked pharmacy issue.');
    }
    return {
      drugBatchId,
      ndpsLocationId,
      labelledQuantity,
      administeredQuantity,
      quantityUnit: ndpsForm.quantityUnit.trim(),
      containerQuantity,
      disposition,
      disposalMethod: ndpsForm.disposalMethod.trim() || undefined,
      quarantineLocation: ndpsForm.quarantineLocation.trim() || undefined,
      emergencyUse: Boolean(ndpsContext.requiresEmergencyReason),
      emergencyReason: ndpsForm.emergencyReason.trim() || undefined,
      notes: ndpsForm.notes.trim() || undefined,
    };
  }, [ndpsContext, ndpsForm]);

  const makeCatchUpTarget = useCallback(
    (
      drug: { prescriptionItemId: string; drugName: string; dosage: string; route: string },
      slot: { code: string; time: string },
    ): CatchUpTarget => ({
      prescriptionItemId: drug.prescriptionItemId,
      slotCode: slot.code,
      date: selectedDate,
      drugName: drug.drugName,
      dosage: drug.dosage,
      route: drug.route,
      scheduledAt: buildIso(selectedDate, slot.time),
    }),
    [selectedDate],
  );

  const closeActionDialog = useCallback(() => {
    setActionDialog({ open: false, mode: 'give', schedule: null, catchUp: null });
    setActionReason('');
    setActionNotes('');
  }, []);

  const submitAction = useCallback(async () => {
    const { mode, schedule, catchUp } = actionDialog;
    if (!schedule && !catchUp) return;

    const requiresReason = mode === 'hold' || mode === 'refuse';
    if (requiresReason && !actionReason.trim()) {
      toast.error('Reason is required.');
      return;
    }

    try {
      // Catch-up target: materialize the skipped slot + record its outcome in one call.
      if (catchUp) {
        if (mode === 'amend') return;
        const iso = mode === 'give' ? buildIso(catchUp.date, actualGivenTime) : undefined;
        await catchUpDose.mutateAsync({
          prescriptionItemId: catchUp.prescriptionItemId,
          slotCode: catchUp.slotCode,
          date: catchUp.date,
          action: mode,
          actualGivenTime: iso,
          reason: actionReason.trim() || undefined,
          notes: actionNotes.trim() || undefined,
        });
        const verb = mode === 'give' ? 'given' : mode === 'hold' ? 'held' : mode === 'refuse' ? 'refused' : 'marked missed';
        toast.success(`${catchUp.drugName} — dose ${verb}`);
        closeActionDialog();
        return;
      }
      if (!schedule) return;

      if (mode === 'give') {
        const iso = buildIso(selectedDate, actualGivenTime);
        const ndps = buildNdpsDose();
        const residual = ndps ? ndps.labelledQuantity - ndps.administeredQuantity : 0;
        if (ndps && residual > 0 && ndps.disposition === 'destroyed') {
          setPendingNdpsGive(ndps);
          setNdpsWitnessOpen(true);
          return;
        }
        await giveDose.mutateAsync({ id: schedule.id, actualGivenTime: iso, notes: actionNotes.trim() || undefined, ndps });
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
  }, [actionDialog, actionReason, actionNotes, actualGivenTime, amendTargetStatus, selectedDate, giveDose, holdDose, refuseDose, amendDose, catchUpDose, closeActionDialog, buildNdpsDose]);

  const confirmNdpsWitness = useCallback(async (witnessedById: string, witnessPassword: string) => {
    const schedule = actionDialog.schedule;
    if (!schedule || !pendingNdpsGive) return;
    try {
      await giveDose.mutateAsync({
        id: schedule.id,
        actualGivenTime: buildIso(selectedDate, actualGivenTime),
        notes: actionNotes.trim() || undefined,
        ndps: { ...pendingNdpsGive, witnessedById, witnessPassword },
      });
      toast.success(`${schedule.drugName} given and residual destroyed under witness`);
      setNdpsWitnessOpen(false);
      setPendingNdpsGive(null);
      closeActionDialog();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? err?.message ?? 'NDPS dose could not be recorded');
    }
  }, [actionDialog.schedule, pendingNdpsGive, giveDose, selectedDate, actualGivenTime, actionNotes, closeActionDialog]);

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

  // Action-dialog display target: a real schedule row, or a catch-up slot with
  // no row yet (both carry drugName/dosage/route/scheduledAt for the header).
  const dlgTarget = actionDialog.schedule ?? actionDialog.catchUp;
  const anyActionPending = giveDose.isPending || holdDose.isPending || refuseDose.isPending || amendDose.isPending || catchUpDose.isPending;

  // ── Render ──────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Arrived from a dashboard medication tile. Show exactly the doses that
          count referred to, across every patient, so the answer to "which
          patients?" is on screen instead of behind an admission picker. */}
      {focus && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/50 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-headline text-sm font-bold text-amber-900">
              {focus === 'overdue' ? 'Overdue doses' : 'Doses due now'}
              {focusDoses.length > 0 && (
                <span className="ml-1.5 font-normal text-amber-700">({focusDoses.length})</span>
              )}
            </h2>
            <Link
              href="/nurse/emar"
              className="text-[11px] font-medium text-amber-800 underline underline-offset-2"
            >
              Show the full chart instead
            </Link>
          </div>

          {focusLoading ? (
            <p className="py-2 text-xs text-amber-800">Loading…</p>
          ) : focusDoses.length === 0 ? (
            <p className="py-2 text-xs text-amber-800">
              Nothing {focus === 'overdue' ? 'overdue' : 'due'} right now — the round is clear.
            </p>
          ) : (
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {focusDoses.map((d) => {
                const name = d.patient
                  ? `${d.patient.firstName} ${d.patient.lastName ?? ''}`.trim()
                  : 'Patient';
                return (
                  <button
                    key={d.id}
                    type="button"
                    // Selecting the admission here is the whole point — one
                    // click from the count to that patient's chart.
                    onClick={() => {
                      if (d.admissionId) setSelectedAdmissionId(d.admissionId);
                      setSelectedDate(toInputDateStr(new Date(d.scheduledAt)));
                    }}
                    className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-surface-container-lowest px-3 py-2 text-left transition-colors hover:border-amber-400"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {d.drugName}
                        <span className="ml-1.5 font-normal text-on-surface-variant">
                          {d.dosage} · {d.route}
                        </span>
                      </div>
                      <div className="truncate text-[11px] text-on-surface-variant">
                        {name}
                        {d.patient?.mrn ? ` · ${d.patient.mrn}` : ''}
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-amber-800">
                      {new Date(d.scheduledAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

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
                      ? `${fullName(adm.patient)} (${adm.patient.uhid ?? adm.patient.mrn})`
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

      {/* Allergy banner. This used to be hand-rolled from
          `selectedAdmission.patient.allergies`, which the admissions endpoint
          has never returned — so it silently never rendered, on the one screen
          where an allergy matters most. PatientSafetyBanner fetches them itself
          and shows severity + reaction. */}
      {selectedAdmissionId && patientId && (
        <>
          <PatientSafetyBanner patientId={patientId} />
          <p className="-mt-2 text-[10px] text-red-600">
            Verify every medication against the allergy profile before administration.
          </p>
        </>
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
                                {drug.intendedSlots.size > 0 && (
                                  <span
                                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0"
                                    title={`Scheduled ${drug.intendedSlots.size}× per day`}
                                  >
                                    {drug.intendedSlots.size}×/day
                                  </span>
                                )}
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
                          // Empty but the drug IS a "this slot" drug, and the slot
                          // time has already passed (a past date, or earlier today)
                          // → the dose wasn't dropped, its window elapsed before the
                          // order. Offer to record its status rather than a bare dash.
                          const elapsedBeforeOrder =
                            cells.length === 0 &&
                            drug.intendedSlots.has(slot.code) &&
                            (isPastDate || (isToday && (slot.time as string) < nowHM));
                          return (
                            <td key={slot.code} className={cn('text-center px-1 py-2 align-top', isNow && 'bg-primary/5')}>
                              <div className="flex flex-col items-center gap-1">
                                {cells.length > 0 ? (
                                  cells.map((c) => <DoseButton key={c.id} schedule={c} onClick={(m) => openActionDialog(c, m)} onAudit={(id) => setAuditScheduleId(id)} />)
                                ) : elapsedBeforeOrder ? (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger
                                      render={
                                        <button
                                          type="button"
                                          className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-dashed border-outline-variant text-on-surface-variant/50 hover:text-primary hover:border-primary/60 transition-colors"
                                          title="Dose time passed before this order — click to record its status"
                                        >
                                          <Clock className="h-3.5 w-3.5" />
                                        </button>
                                      }
                                    />
                                    <DropdownMenuContent align="center" side="bottom" sideOffset={6} className="min-w-[136px] w-auto p-1">
                                      <DropdownMenuItem
                                        onClick={() => openCatchUpDialog(makeCatchUpTarget(drug, slot), 'give')}
                                        className="text-green-700 focus:bg-green-50 focus:text-green-800"
                                      >
                                        <Check className="h-3.5 w-3.5" /> Give (late)
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => openCatchUpDialog(makeCatchUpTarget(drug, slot), 'hold')}
                                        className="text-amber-700 focus:bg-amber-50 focus:text-amber-800"
                                      >
                                        <Pause className="h-3.5 w-3.5" /> Hold
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => openCatchUpDialog(makeCatchUpTarget(drug, slot), 'refuse')}
                                        className="text-orange-700 focus:bg-orange-50 focus:text-orange-800"
                                      >
                                        <Ban className="h-3.5 w-3.5" /> Refuse
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => openCatchUpDialog(makeCatchUpTarget(drug, slot), 'missed')}
                                        className="text-red-700 focus:bg-red-50 focus:text-red-800"
                                      >
                                        <X className="h-3.5 w-3.5" /> Mark missed
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                ) : (
                                  <span className="text-on-surface-variant/25">–</span>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
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

          {dlgTarget && (
            <div className="space-y-4">
              <div className="rounded-lg bg-surface-container-low p-3 space-y-1">
                <p className="text-sm font-semibold">{dlgTarget.drugName}</p>
                <p className="text-xs text-on-surface-variant">
                  Dose: <span className="font-medium text-on-surface">{dlgTarget.dosage}</span>
                  {dlgTarget.route && (
                    <> &middot; Route: <span className="font-medium text-on-surface">{dlgTarget.route}</span></>
                  )}
                </p>
                <p className="text-xs text-on-surface-variant">
                  Scheduled: <span className="font-medium text-on-surface">{formatDateTime(dlgTarget.scheduledAt)}</span>
                </p>
                {actionDialog.schedule ? (
                  <p className="text-xs">
                    Current status:{' '}
                    <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full', STATUS_META[actionDialog.schedule.status].badgeClass)}>
                      {STATUS_META[actionDialog.schedule.status].label}
                    </span>
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    This dose time already passed and was not auto-scheduled. Recording it now adds it to the chart.
                  </p>
                )}
              </div>

              {/* Last chance to catch it — this dialog is the act of giving
                  the drug. Same dead-data bug as the page-level banner. */}
              {patientId && <PatientSafetyBanner patientId={patientId} />}

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

              {actionDialog.mode === 'give' && actionDialog.schedule && ndpsContextQ.isLoading && (
                <div className="flex items-center gap-2 rounded-lg border p-3 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking controlled-drug requirements…
                </div>
              )}

              {actionDialog.mode === 'give' && actionDialog.schedule && ndpsContext?.isNdps && (
                <NdpsDoseFields context={ndpsContext} value={ndpsForm} onChange={setNdpsForm} />
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
            <Button size="sm" onClick={submitAction} disabled={anyActionPending || ndpsContextQ.isLoading} className="gap-1.5">
              {anyActionPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WitnessCosignDialog
        open={ndpsWitnessOpen}
        onOpenChange={(open) => {
          setNdpsWitnessOpen(open);
          if (!open) setPendingNdpsGive(null);
        }}
        title="Witness residual destruction"
        description="A second authorised person must observe the measured residual being destroyed and enter their own password. The dose and disposal will then be confirmed together."
        witnessOptions={witnessOptions}
        busy={giveDose.isPending}
        onConfirm={confirmNdpsWitness}
      />

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
                      <div className="flex items-center gap-1.5">
                        {p.source === 'catalogue' && (
                          <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
                            catalogue
                          </span>
                        )}
                        <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded-full', severityBadge(p.severity))}>{p.severity}</span>
                      </div>
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

function NdpsDoseFields({
  context,
  value,
  onChange,
}: {
  context: NdpsDoseContext;
  value: typeof EMPTY_NDPS_FORM;
  onChange: Dispatch<SetStateAction<typeof EMPTY_NDPS_FORM>>;
}) {
  const set = (key: keyof typeof EMPTY_NDPS_FORM, next: string) =>
    onChange((current) => ({ ...current, [key]: next }));
  const labelled = Number(value.labelledQuantity);
  const administered = Number(value.administeredQuantity);
  const residual = labelled > 0 && administered > 0 && administered <= labelled
    ? Math.round((labelled - administered) * 10_000) / 10_000
    : null;
  const clinical = context.clinicalDetails;
  const selectedBatchId = effectiveNdpsBatch(context, value);
  const selectedLocationId = effectiveNdpsLocation(context, value);

  return (
    <div className="space-y-3 rounded-xl border border-red-200 bg-red-50/40 p-3">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
        <div>
          <p className="text-xs font-semibold text-red-900">NDPS patient-dose reconciliation</p>
          <p className="text-[11px] text-red-800">
            Record the exact batch and contents now. An opened residual can only be destroyed under witness or sealed for the NDPS disposal worklist.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Batch / container *</Label>
          <Select value={selectedBatchId} onValueChange={(next) => next && set('drugBatchId', next)}>
            <SelectTrigger><SelectValue placeholder="Select exact batch" /></SelectTrigger>
            <SelectContent>
              {(context.batches ?? []).map((batch) => (
                <SelectItem key={batch.id} value={batch.id}>
                  {batch.batchNumber} · exp {formatDateTime(batch.expiryDate).split(',')[0]}
                  {batch.id === context.linkedBatchId ? ' · linked issue' : ` · ${batch.quantityInStock} available`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Custody location *</Label>
          <Select value={selectedLocationId} onValueChange={(next) => next && set('ndpsLocationId', next)}>
            <SelectTrigger><SelectValue placeholder="Select safe / ward cart" /></SelectTrigger>
            <SelectContent>
              {(context.locations ?? []).map((location) => (
                <SelectItem key={location.id} value={location.id} disabled={location.availableContainers <= 0}>
                  {location.name} · {location.availableContainers} container(s){location.preferred ? ' · current ward' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Labelled contents *</Label>
          <Input type="number" min="0" step="any" value={value.labelledQuantity} onChange={(event) => set('labelledQuantity', event.target.value)} placeholder="e.g. 2" />
        </div>
        <div className="grid grid-cols-[1fr_88px] gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Actually given *</Label>
            <Input type="number" min="0" step="any" value={value.administeredQuantity} onChange={(event) => set('administeredQuantity', event.target.value)} placeholder="e.g. 0.5" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Unit *</Label>
            <Input value={value.quantityUnit} onChange={(event) => set('quantityUnit', event.target.value)} placeholder="mL" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-lg border bg-background p-2 text-center text-xs">
        <div><span className="block text-muted-foreground">Labelled</span><b>{labelled > 0 ? labelled : '—'} {value.quantityUnit}</b></div>
        <div><span className="block text-muted-foreground">Given</span><b>{administered > 0 ? administered : '—'} {value.quantityUnit}</b></div>
        <div><span className="block text-muted-foreground">Residual</span><b className={residual && residual > 0 ? 'text-red-700' : ''}>{residual ?? '—'} {value.quantityUnit}</b></div>
      </div>

      {residual !== null && residual > 0 && (
        <div className="space-y-2">
          <Label className="text-xs">Residual action *</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" size="sm" variant={value.disposition === 'destroyed' ? 'default' : 'outline'} onClick={() => set('disposition', 'destroyed')}>
              Destroy now under witness
            </Button>
            <Button type="button" size="sm" variant={value.disposition === 'quarantined' ? 'default' : 'outline'} onClick={() => set('disposition', 'quarantined')}>
              Seal and quarantine
            </Button>
          </div>
          {value.disposition === 'destroyed' ? (
            <div className="space-y-1">
              <Label className="text-xs">Approved destruction method *</Label>
              <Input value={value.disposalMethod} onChange={(event) => set('disposalMethod', event.target.value)} placeholder="e.g. denatured, then placed in pharmaceutical waste container" />
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">Sealed quarantine location *</Label>
              <Input value={value.quarantineLocation} onChange={(event) => set('quarantineLocation', event.target.value)} placeholder="e.g. ICU narcotic safe · residual bin A" />
            </div>
          )}
        </div>
      )}

      {context.requiresEmergencyReason && (
        <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-2">
          <Label className="text-xs text-amber-900">Emergency stock reason *</Label>
          <Textarea value={value.emergencyReason} onChange={(event) => set('emergencyReason', event.target.value)} rows={2} placeholder="Why treatment could not wait for patient-specific pharmacy issue" />
          <p className="text-[10px] text-amber-800">This is billed and moved from the selected ward/batch when the dose is confirmed.</p>
        </div>
      )}

      {clinical && (!clinical.doctorRegistration || !clinical.diagnosis) && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
          Complete the prescriber registration number and diagnosis/clinical justification in the patient record before confirming Form 3E.
        </p>
      )}
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
      {schedule.ndpsPatientDose && (
        <div
          className={cn(
            'mt-1 max-w-[92px] rounded px-1 py-0.5 text-center text-[8px] font-semibold leading-tight',
            schedule.ndpsPatientDose.status === 'quarantined'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-red-100 text-red-800',
          )}
          title={`NDPS: ${Number(schedule.ndpsPatientDose.administeredQuantity)} ${schedule.ndpsPatientDose.quantityUnit} given; ${Number(schedule.ndpsPatientDose.residualQuantity)} ${schedule.ndpsPatientDose.quantityUnit} residual ${schedule.ndpsPatientDose.status}`}
        >
          {Number(schedule.ndpsPatientDose.administeredQuantity)} given · {Number(schedule.ndpsPatientDose.residualQuantity)} {schedule.ndpsPatientDose.status === 'quarantined' ? 'sealed' : 'destroyed'}
        </div>
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
