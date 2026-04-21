'use client';

import { useState, useMemo, useCallback } from 'react';
import { toInputDateStr, formatDate, formatTime } from '@/lib/date-utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import { useAuthStore } from '@/stores/auth-store';
import {
  useNurseAdmissions,
  useActivePrescriptions,
  useAdministrationRecords,
  useRecordAdministration,
  useDrugInteractions,
  type NurseAdmission,
  type Prescription,
  type AdministrationRecord,
  type InteractionCheckResult,
  type InteractionPair,
  type InteractionSeverity,
} from '@/hooks/use-nurse';
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
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────

const TIME_SLOTS = [
  { label: '6 AM', hour: 6 },
  { label: '8 AM', hour: 8 },
  { label: '10 AM', hour: 10 },
  { label: '12 PM', hour: 12 },
  { label: '2 PM', hour: 14 },
  { label: '4 PM', hour: 16 },
  { label: '6 PM', hour: 18 },
  { label: '8 PM', hour: 20 },
  { label: '10 PM', hour: 22 },
  { label: '12 AM', hour: 0 },
] as const;

const STATUS_OPTIONS = [
  { value: 'administered', label: 'Administered', icon: Check, color: 'text-green-600' },
  { value: 'missed', label: 'Missed', icon: X, color: 'text-red-600' },
  { value: 'held', label: 'Held', icon: Pause, color: 'text-amber-600' },
  { value: 'refused', label: 'Refused', icon: Ban, color: 'text-orange-600' },
] as const;

const CELL_STYLES: Record<string, string> = {
  scheduled: 'bg-gray-100 text-gray-500 hover:bg-gray-200',
  administered: 'bg-green-100 text-green-700',
  missed: 'bg-red-100 text-red-700',
  held: 'bg-amber-100 text-amber-700',
  refused: 'bg-orange-100 text-orange-700',
};

const CELL_ICONS: Record<string, typeof Check> = {
  scheduled: CircleDot,
  administered: Check,
  missed: X,
  held: Pause,
  refused: Ban,
};

const BADGE_STYLES: Record<string, string> = {
  administered: 'bg-green-100 text-green-800',
  missed: 'bg-red-100 text-red-800',
  held: 'bg-amber-100 text-amber-800',
  refused: 'bg-orange-100 text-orange-800',
  scheduled: 'bg-gray-100 text-gray-700',
};

/** Map frequency strings to the hour slots the dose is expected */
function frequencyToSlotHours(frequency: string): number[] {
  const f = frequency.toLowerCase().replace(/\s+/g, ' ').trim();
  if (f.includes('once daily') || f === 'od' || f === 'qd') return [8];
  if (f.includes('twice') || f === 'bd' || f === 'bid') return [8, 20];
  if (f.includes('thrice') || f === 'tid' || f === 'tds') return [8, 14, 22];
  if (f.includes('four') || f === 'qid' || f === 'qds') return [6, 12, 18, 0];
  if (f.includes('every 4') || f === 'q4h') return [6, 10, 14, 18, 22];
  if (f.includes('every 6') || f === 'q6h') return [6, 12, 18, 0];
  if (f.includes('every 8') || f === 'q8h') return [6, 14, 22];
  if (f.includes('every 12') || f === 'q12h') return [8, 20];
  if (f.includes('morning') || f.includes('am') || f === 'mane') return [8];
  if (f.includes('night') || f.includes('bedtime') || f === 'hs' || f === 'nocte') return [22];
  if (f.includes('stat')) return []; // one-time, no recurring slots
  if (f.includes('prn') || f.includes('as needed') || f.includes('sos')) return []; // PRN
  return [8]; // fallback: once daily
}

function isPRN(frequency: string): boolean {
  const f = frequency.toLowerCase();
  return f.includes('prn') || f.includes('as needed') || f.includes('sos') || f.includes('when required');
}

function nowTimeStr(): string {
  const d = new Date();
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

// ── Types ────────────────────────────────────────────────────

interface ScheduleCell {
  hour: number;
  status: 'scheduled' | 'administered' | 'missed' | 'held' | 'refused' | 'none';
  administrationId?: string;
  administeredTime?: string;
  reason?: string;
  notes?: string;
}

interface DrugRow {
  prescriptionId: string;
  prescriptionItemId: string;
  drugName: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  route?: string;
  instructions?: string;
  isPRN: boolean;
  interactions?: string[];
  cells: ScheduleCell[];
  lastAdminTime?: string;
}

interface AdminDialogState {
  open: boolean;
  drugRow: DrugRow | null;
  cell: ScheduleCell | null;
  slotIndex: number;
}

// ── Page Component ───────────────────────────────────────────

export default function EmarPage() {
  const user = useAuthStore((s) => s.user);

  // Selection state
  const [selectedAdmissionId, setSelectedAdmissionId] = useState('');
  const [selectedDate, setSelectedDate] = useState(toInputDateStr());

  // Administration dialog
  const [adminDialog, setAdminDialog] = useState<AdminDialogState>({
    open: false,
    drugRow: null,
    cell: null,
    slotIndex: -1,
  });
  const [adminStatus, setAdminStatus] = useState<'administered' | 'missed' | 'held' | 'refused'>('administered');
  const [adminTime, setAdminTime] = useState(nowTimeStr());
  const [adminReason, setAdminReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  // PRN dialog
  const [prnDialogOpen, setPrnDialogOpen] = useState(false);
  const [prnDrug, setPrnDrug] = useState<DrugRow | null>(null);
  const [prnTime, setPrnTime] = useState(nowTimeStr());
  const [prnNotes, setPrnNotes] = useState('');

  // ── Data fetching ────────────────────────────────────────
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

  const { data: prescriptionsRaw, isLoading: prescriptionsLoading } = useActivePrescriptions({
    // admissionId scopes to the current admission; patientId is fallback for tests/older data.
    admissionId: selectedAdmissionId || undefined,
    patientId: !selectedAdmissionId ? patientId || undefined : undefined,
    prescriptionType: 'ip',
    status: 'active',
  });
  const prescriptions: Prescription[] = useMemo(() => {
    if (!prescriptionsRaw) return [];
    return Array.isArray(prescriptionsRaw) ? prescriptionsRaw : (prescriptionsRaw as any).data ?? [];
  }, [prescriptionsRaw]);

  const { data: adminRecordsRaw, isLoading: adminRecordsLoading } = useAdministrationRecords({
    patientId: patientId || undefined,
    fromDate: selectedDate,
    toDate: selectedDate,
  });
  const adminRecords: AdministrationRecord[] = useMemo(() => {
    if (!adminRecordsRaw) return [];
    return Array.isArray(adminRecordsRaw) ? adminRecordsRaw : (adminRecordsRaw as any).data ?? [];
  }, [adminRecordsRaw]);

  const recordAdmin = useRecordAdministration();

  // ── Drug Interaction Check ────────────────────────────────
  // Collect unique drug names across all prescription items → query once per set.
  const allDrugNames = useMemo(() => {
    const names = new Set<string>();
    for (const rx of prescriptions) {
      for (const item of rx.items) {
        if (item.drugName) names.add(item.drugName);
      }
    }
    return Array.from(names);
  }, [prescriptions]);

  const { data: interactionsData } = useDrugInteractions(allDrugNames);
  const interactions: InteractionCheckResult | undefined = interactionsData?.data;

  // Build a drug → [pairs involving that drug] map for quick row-level lookup.
  const interactionsByDrug = useMemo(() => {
    const map = new Map<string, InteractionPair[]>();
    if (!interactions?.pairs) return map;
    for (const pair of interactions.pairs) {
      for (const d of pair.drugs) {
        const key = d.toLowerCase().trim();
        const existing = map.get(key) ?? [];
        existing.push(pair);
        map.set(key, existing);
      }
    }
    return map;
  }, [interactions]);

  const contraindicationsByDrug = useMemo(() => {
    const map = new Map<string, string>();
    if (!interactions?.perDrug) return map;
    for (const entry of interactions.perDrug) {
      if (entry.contraindications) {
        map.set(entry.drugName.toLowerCase().trim(), entry.contraindications);
      }
    }
    return map;
  }, [interactions]);

  // Interaction detail dialog state
  const [interactionDialog, setInteractionDialog] = useState<{
    drugName: string;
    pairs: InteractionPair[];
    contraindications?: string;
  } | null>(null);

  const openInteractionDialog = useCallback(
    (drugName: string) => {
      const pairs = interactionsByDrug.get(drugName.toLowerCase().trim()) ?? [];
      const contraindications = contraindicationsByDrug.get(drugName.toLowerCase().trim());
      setInteractionDialog({ drugName, pairs, contraindications });
    },
    [interactionsByDrug, contraindicationsByDrug],
  );

  // ── Build drug rows ──────────────────────────────────────
  const { regularDrugs, prnDrugs } = useMemo(() => {
    const regular: DrugRow[] = [];
    const prn: DrugRow[] = [];

    for (const rx of prescriptions) {
      for (const item of rx.items) {
        const itemId = item.id ?? `${rx.id}-${item.drugName}`;
        const prn_ = isPRN(item.frequency);
        const slotHours = prn_ ? [] : frequencyToSlotHours(item.frequency);

        // Build cells for this drug across time slots
        const cells: ScheduleCell[] = TIME_SLOTS.map((slot) => {
          const isScheduled = slotHours.includes(slot.hour);
          if (!isScheduled) {
            return { hour: slot.hour, status: 'none' as const };
          }
          // Find matching admin record
          const record = adminRecords.find(
            (r) =>
              r.prescriptionId === rx.id &&
              (r.prescriptionItemId === itemId || r.drugName === item.drugName) &&
              matchHour(r.scheduledTime, slot.hour),
          );
          if (record) {
            return {
              hour: slot.hour,
              status: record.status,
              administrationId: record.id,
              administeredTime: record.administeredTime,
              reason: record.reason,
              notes: record.notes,
            };
          }
          return { hour: slot.hour, status: 'scheduled' as const };
        });

        // For PRN, find last administration time
        const prnRecords = prn_
          ? adminRecords
              .filter((r) => r.prescriptionId === rx.id && (r.prescriptionItemId === itemId || r.drugName === item.drugName))
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          : [];

        const pairsForDrug = interactionsByDrug.get(item.drugName.toLowerCase().trim()) ?? [];
        const row: DrugRow = {
          prescriptionId: rx.id,
          prescriptionItemId: itemId,
          drugName: item.drugName,
          genericName: item.genericName,
          dosage: item.dosage,
          frequency: item.frequency,
          route: item.route,
          instructions: item.instructions,
          isPRN: prn_,
          interactions: pairsForDrug.map((p) => {
            const other = p.drugs.find((d) => d.toLowerCase().trim() !== item.drugName.toLowerCase().trim()) ?? '';
            return `${other} — ${p.severity}`;
          }),
          cells,
          lastAdminTime: prnRecords.length > 0 ? prnRecords[0].administeredTime ?? prnRecords[0].createdAt : undefined,
        };

        if (prn_) {
          prn.push(row);
        } else {
          regular.push(row);
        }
      }
    }

    return { regularDrugs: regular, prnDrugs: prn };
  }, [prescriptions, adminRecords, interactionsByDrug]);

  const isLoading = admissionsLoading || prescriptionsLoading || adminRecordsLoading;

  // ── Handlers ─────────────────────────────────────────────
  const openAdminDialog = useCallback(
    (drug: DrugRow, cell: ScheduleCell, slotIndex: number) => {
      if (cell.status === 'none') return;
      setAdminDialog({ open: true, drugRow: drug, cell, slotIndex });
      setAdminStatus(cell.status === 'scheduled' ? 'administered' : cell.status as any);
      setAdminTime(cell.administeredTime ? formatTimeForInput(cell.administeredTime) : nowTimeStr());
      setAdminReason(cell.reason ?? '');
      setAdminNotes(cell.notes ?? '');
    },
    [],
  );

  const closeAdminDialog = useCallback(() => {
    setAdminDialog({ open: false, drugRow: null, cell: null, slotIndex: -1 });
    setAdminReason('');
    setAdminNotes('');
  }, []);

  const submitAdministration = useCallback(async () => {
    const { drugRow, cell, slotIndex } = adminDialog;
    if (!drugRow || !cell) return;
    if ((adminStatus === 'missed' || adminStatus === 'held' || adminStatus === 'refused') && !adminReason.trim()) {
      toast.error('Reason is required when status is missed, held, or refused.');
      return;
    }

    const scheduledTime = buildISOFromDateAndHour(selectedDate, cell.hour);
    const administeredTime =
      adminStatus === 'administered' ? buildISOFromDateAndTime(selectedDate, adminTime) : undefined;

    try {
      const statusMap: Record<string, 'given' | 'missed' | 'refused' | 'held'> = {
        administered: 'given',
        given: 'given',
        missed: 'missed',
        refused: 'refused',
        held: 'held',
      };
      await recordAdmin.mutateAsync({
        prescriptionItemId: drugRow.prescriptionItemId,
        patientId,
        administeredAt: administeredTime ?? scheduledTime,
        doseGiven: drugRow.dosage,
        status: statusMap[adminStatus] ?? 'given',
        notes: [adminReason.trim(), adminNotes.trim()].filter(Boolean).join(' — ') || undefined,
      });
      toast.success(`${drugRow.drugName} marked as ${adminStatus}`);
      closeAdminDialog();
    } catch {
      toast.error('Failed to record administration');
    }
  }, [adminDialog, adminStatus, adminTime, adminReason, adminNotes, selectedDate, patientId, recordAdmin, closeAdminDialog]);

  const openPrnDialog = useCallback((drug: DrugRow) => {
    setPrnDrug(drug);
    setPrnTime(nowTimeStr());
    setPrnNotes('');
    setPrnDialogOpen(true);
  }, []);

  const submitPrnAdmin = useCallback(async () => {
    if (!prnDrug) return;
    const administeredTime = buildISOFromDateAndTime(selectedDate, prnTime);
    try {
      await recordAdmin.mutateAsync({
        prescriptionItemId: prnDrug.prescriptionItemId,
        patientId,
        administeredAt: administeredTime,
        doseGiven: prnDrug.dosage,
        status: 'given',
        notes: prnNotes.trim() || undefined,
      });
      toast.success(`PRN ${prnDrug.drugName} recorded`);
      setPrnDialogOpen(false);
      setPrnDrug(null);
    } catch {
      toast.error('Failed to record PRN administration');
    }
  }, [prnDrug, prnTime, prnNotes, selectedDate, patientId, recordAdmin]);

  // ── Summary stats ────────────────────────────────────────
  const stats = useMemo(() => {
    let total = 0;
    let administered = 0;
    let missed = 0;
    let pending = 0;
    for (const drug of regularDrugs) {
      for (const cell of drug.cells) {
        if (cell.status === 'none') continue;
        total++;
        if (cell.status === 'administered') administered++;
        else if (cell.status === 'missed') missed++;
        else if (cell.status === 'scheduled') pending++;
      }
    }
    return { total, administered, missed, pending };
  }, [regularDrugs]);

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-fade-in-up">
      <h1 className="font-headline text-xl font-bold">eMAR — Medication Administration Record</h1>

      {/* ── Patient Selector + Date ───────────────────────── */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[240px]">
            <Label className="text-xs font-medium text-on-surface-variant mb-1 block">Admitted Patient</Label>
            <Select
              value={selectedAdmissionId}
              onValueChange={(v) => setSelectedAdmissionId(v ?? '')}
            >
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
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="text-xs text-on-surface-variant self-center">
            {selectedDate && formatDate(selectedDate + 'T00:00:00')}
          </div>
        </div>
      </div>

      {/* ── Allergy Alert Banner ─────────────────────────── */}
      {selectedAdmissionId && allergies.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 shadow-sm">
          <ShieldAlert className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-800">Allergy Alert</p>
            <p className="text-xs text-red-700 mt-0.5">
              Known allergies:{' '}
              {allergies.map((a, i) => (
                <span key={a}>
                  <span className="font-semibold uppercase">{a}</span>
                  {i < allergies.length - 1 && ', '}
                </span>
              ))}
            </p>
            <p className="text-[10px] text-red-600 mt-1">
              Verify all medications against patient allergy profile before administration.
            </p>
          </div>
        </div>
      )}

      {/* ── Drug Interaction Banner ──────────────────────── */}
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
          {/* ── Stats Row ─────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Doses" value={stats.total} color="text-on-surface" />
            <StatCard label="Administered" value={stats.administered} color="text-green-700" />
            <StatCard label="Missed" value={stats.missed} color="text-red-700" />
            <StatCard label="Pending" value={stats.pending} color="text-amber-700" />
          </div>

          {/* ── Medication Schedule Grid ──────────────────── */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
            <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between">
              <h2 className="font-headline text-sm font-bold">Medication Schedule</h2>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            </div>

            {regularDrugs.length === 0 && !isLoading ? (
              <div className="p-8 text-center text-sm text-on-surface-variant">
                No scheduled medications found for this date.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="border-b border-outline-variant">
                      <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant text-left px-4 py-2.5 w-[260px] sticky left-0 bg-surface-container-lowest z-10">
                        Medication
                      </th>
                      {TIME_SLOTS.map((slot) => (
                        <th
                          key={slot.hour}
                          className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant text-center px-1 py-2.5 w-[72px]"
                        >
                          {slot.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {regularDrugs.map((drug) => (
                      <tr
                        key={`${drug.prescriptionId}-${drug.prescriptionItemId}`}
                        className="border-b border-outline-variant/50 hover:bg-surface-container-low/40 transition-colors"
                      >
                        <td className="px-4 py-2.5 sticky left-0 bg-surface-container-lowest z-10">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-semibold text-on-surface truncate">
                                  {drug.drugName}
                                </span>
                                {drug.interactions && drug.interactions.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => openInteractionDialog(drug.drugName)}
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 hover:bg-orange-200 whitespace-nowrap"
                                    title="View drug interactions"
                                  >
                                    <AlertTriangle className="h-2.5 w-2.5 inline -mt-0.5 mr-0.5" />
                                    {drug.interactions.length} Interaction{drug.interactions.length !== 1 ? 's' : ''}
                                  </button>
                                )}
                              </div>
                              {drug.genericName && (
                                <p className="text-[10px] text-on-surface-variant">{drug.genericName}</p>
                              )}
                              <p className="text-[10px] text-on-surface-variant mt-0.5">
                                {drug.dosage} &middot; {drug.frequency}
                                {drug.route ? ` &middot; ${drug.route}` : ''}
                              </p>
                              {drug.instructions && (
                                <p className="text-[10px] text-on-surface-variant italic mt-0.5 truncate max-w-[220px]">
                                  {drug.instructions}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        {drug.cells.map((cell, idx) => (
                          <td key={TIME_SLOTS[idx].hour} className="text-center px-1 py-2">
                            {cell.status === 'none' ? (
                              <span className="text-gray-200">&mdash;</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openAdminDialog(drug, cell, idx)}
                                className={cn(
                                  'inline-flex items-center justify-center w-8 h-8 rounded-full transition-all',
                                  'focus:outline-none focus:ring-2 focus:ring-primary/40',
                                  CELL_STYLES[cell.status],
                                  cell.status === 'scheduled' && 'cursor-pointer',
                                  cell.status !== 'scheduled' && 'cursor-pointer opacity-90 hover:opacity-100',
                                )}
                                title={
                                  cell.status === 'scheduled'
                                    ? `Scheduled — click to record`
                                    : `${cell.status}${cell.administeredTime ? ` at ${formatTime(cell.administeredTime)}` : ''}`
                                }
                              >
                                {(() => {
                                  const Icon = CELL_ICONS[cell.status];
                                  return <Icon className="h-3.5 w-3.5" />;
                                })()}
                              </button>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Legend */}
            <div className="px-4 py-2.5 border-t border-outline-variant/50 flex flex-wrap gap-4">
              {[
                { status: 'scheduled', label: 'Scheduled' },
                { status: 'administered', label: 'Administered' },
                { status: 'missed', label: 'Missed' },
                { status: 'held', label: 'Held' },
                { status: 'refused', label: 'Refused' },
              ].map(({ status, label }) => {
                const Icon = CELL_ICONS[status];
                return (
                  <span key={status} className="inline-flex items-center gap-1.5 text-[10px] text-on-surface-variant">
                    <span
                      className={cn(
                        'inline-flex items-center justify-center w-5 h-5 rounded-full',
                        CELL_STYLES[status],
                      )}
                    >
                      <Icon className="h-2.5 w-2.5" />
                    </span>
                    {label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* ── PRN Medications ───────────────────────────── */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
            <div className="px-4 py-3 border-b border-outline-variant">
              <h2 className="font-headline text-sm font-bold">PRN Medications (As Needed)</h2>
            </div>

            {prnDrugs.length === 0 ? (
              <div className="p-6 text-center text-sm text-on-surface-variant">
                No PRN medications prescribed.
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/50">
                {prnDrugs.map((drug) => (
                  <div
                    key={`${drug.prescriptionId}-${drug.prescriptionItemId}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-surface-container-low/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-on-surface">{drug.drugName}</span>
                        {drug.interactions && drug.interactions.length > 0 && (
                          <button
                            type="button"
                            onClick={() => openInteractionDialog(drug.drugName)}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 hover:bg-orange-200"
                            title="View drug interactions"
                          >
                            <AlertTriangle className="h-2.5 w-2.5 inline -mt-0.5 mr-0.5" />
                            {drug.interactions.length} Interaction{drug.interactions.length !== 1 ? 's' : ''}
                          </button>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                          PRN
                        </span>
                      </div>
                      <p className="text-[10px] text-on-surface-variant mt-0.5">
                        {drug.dosage} &middot; {drug.frequency}
                        {drug.route ? ` &middot; ${drug.route}` : ''}
                      </p>
                      {drug.instructions && (
                        <p className="text-[10px] text-on-surface-variant italic mt-0.5">{drug.instructions}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {drug.lastAdminTime && (
                        <div className="text-right">
                          <p className="text-[10px] text-on-surface-variant">Last given</p>
                          <p className="text-xs font-medium text-on-surface">{formatTime(drug.lastAdminTime)}</p>
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        onClick={() => openPrnDialog(drug)}
                      >
                        <Plus className="h-3 w-3" />
                        Record
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Administration Dialog ─────────────────────────── */}
      <Dialog open={adminDialog.open} onOpenChange={(open) => !open && closeAdminDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pill className="h-4 w-4 text-primary" />
              Record Administration
            </DialogTitle>
          </DialogHeader>

          {adminDialog.drugRow && adminDialog.cell && (
            <div className="space-y-4">
              {/* Drug info */}
              <div className="rounded-lg bg-surface-container-low p-3 space-y-1">
                <p className="text-sm font-semibold">{adminDialog.drugRow.drugName}</p>
                <p className="text-xs text-on-surface-variant">
                  Dose: <span className="font-medium text-on-surface">{adminDialog.drugRow.dosage}</span>
                  {adminDialog.drugRow.route && (
                    <>
                      {' '}&middot; Route: <span className="font-medium text-on-surface">{adminDialog.drugRow.route}</span>
                    </>
                  )}
                </p>
                <p className="text-xs text-on-surface-variant">
                  Scheduled: <span className="font-medium text-on-surface">{TIME_SLOTS[adminDialog.slotIndex]?.label}</span>
                </p>
              </div>

              {/* Allergy warning within dialog */}
              {allergies.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <p className="text-[10px] text-amber-800">
                    Patient allergies: <span className="font-bold">{allergies.join(', ')}</span>
                  </p>
                </div>
              )}

              {/* Per-drug interaction warning in the administration dialog */}
              {adminDialog.drugRow && adminDialog.drugRow.interactions && adminDialog.drugRow.interactions.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-600 mt-0.5 shrink-0" />
                  <div className="text-[10px] text-orange-800 flex-1">
                    <p className="font-bold mb-0.5">Interactions detected</p>
                    <ul className="space-y-0.5">
                      {adminDialog.drugRow.interactions.map((s, i) => (
                        <li key={i}>• {s}</li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => adminDialog.drugRow && openInteractionDialog(adminDialog.drugRow.drugName)}
                      className="mt-1 underline font-semibold"
                    >
                      View details
                    </button>
                  </div>
                </div>
              )}

              {/* Status */}
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Status</Label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const selected = adminStatus === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setAdminStatus(opt.value as typeof adminStatus)}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all',
                          selected
                            ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/30'
                            : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low',
                        )}
                      >
                        <Icon className={cn('h-3.5 w-3.5', selected ? 'text-primary' : opt.color)} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time */}
              {adminStatus === 'administered' && (
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Time Administered</Label>
                  <Input
                    type="time"
                    value={adminTime}
                    onChange={(e) => setAdminTime(e.target.value)}
                    className="w-40"
                  />
                </div>
              )}

              {/* Reason (required for non-administered) */}
              {adminStatus !== 'administered' && (
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">
                    Reason <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    placeholder={`Reason for ${adminStatus} status...`}
                    value={adminReason}
                    onChange={(e) => setAdminReason(e.target.value)}
                    rows={2}
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Notes</Label>
                <Textarea
                  placeholder="Optional notes..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={closeAdminDialog}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={submitAdministration}
              disabled={recordAdmin.isPending}
              className="gap-1.5"
            >
              {recordAdmin.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── PRN Administration Dialog ────────────────────── */}
      <Dialog open={prnDialogOpen} onOpenChange={(open) => !open && setPrnDialogOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Record PRN Administration
            </DialogTitle>
          </DialogHeader>

          {prnDrug && (
            <div className="space-y-4">
              <div className="rounded-lg bg-surface-container-low p-3 space-y-1">
                <p className="text-sm font-semibold">{prnDrug.drugName}</p>
                <p className="text-xs text-on-surface-variant">
                  Dose: <span className="font-medium text-on-surface">{prnDrug.dosage}</span>
                  {prnDrug.route && (
                    <>
                      {' '}&middot; Route: <span className="font-medium text-on-surface">{prnDrug.route}</span>
                    </>
                  )}
                </p>
                <p className="text-xs text-on-surface-variant">Frequency: {prnDrug.frequency}</p>
              </div>

              {allergies.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <p className="text-[10px] text-amber-800">
                    Patient allergies: <span className="font-bold">{allergies.join(', ')}</span>
                  </p>
                </div>
              )}

              <div>
                <Label className="text-xs font-medium mb-1.5 block">Time Administered</Label>
                <Input
                  type="time"
                  value={prnTime}
                  onChange={(e) => setPrnTime(e.target.value)}
                  className="w-40"
                />
              </div>

              <div>
                <Label className="text-xs font-medium mb-1.5 block">Notes</Label>
                <Textarea
                  placeholder="Reason for PRN administration, patient complaint, etc."
                  value={prnNotes}
                  onChange={(e) => setPrnNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setPrnDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={submitPrnAdmin}
              disabled={recordAdmin.isPending}
              className="gap-1.5"
            >
              {recordAdmin.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Drug Interaction Detail Dialog ────────────────── */}
      <Dialog
        open={!!interactionDialog}
        onOpenChange={(open) => !open && setInteractionDialog(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              Drug Interactions — {interactionDialog?.drugName}
            </DialogTitle>
          </DialogHeader>
          {interactionDialog && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {interactionDialog.pairs.length === 0 && !interactionDialog.contraindications ? (
                <p className="text-sm text-on-surface-variant">
                  No interactions or contraindications found.
                </p>
              ) : (
                <>
                  {interactionDialog.pairs.length > 0 && (
                    <div>
                      <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">
                        Interactions with co-prescribed drugs
                      </p>
                      <div className="space-y-2">
                        {interactionDialog.pairs.map((p, i) => {
                          const other =
                            p.drugs.find(
                              (d) =>
                                d.toLowerCase().trim() !==
                                interactionDialog.drugName.toLowerCase().trim(),
                            ) ?? '';
                          return (
                            <div
                              key={i}
                              className={cn(
                                'rounded-lg border p-3',
                                severityStyles(p.severity),
                              )}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-semibold">with {other}</span>
                                <span
                                  className={cn(
                                    'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full',
                                    severityBadge(p.severity),
                                  )}
                                >
                                  {p.severity}
                                </span>
                              </div>
                              <p className="text-xs">{p.description}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {interactionDialog.contraindications && (
                    <div>
                      <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">
                        Formulary contraindications
                      </p>
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 whitespace-pre-wrap">
                        {interactionDialog.contraindications}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setInteractionDialog(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Helper Components ──────────────────────────────────────────

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
  const borderClass =
    highest === 'contraindicated' || highest === 'major'
      ? 'border-red-300 bg-red-50'
      : 'border-orange-300 bg-orange-50';
  const iconClass =
    highest === 'contraindicated' || highest === 'major' ? 'text-red-600' : 'text-orange-600';
  const textClass =
    highest === 'contraindicated' || highest === 'major' ? 'text-red-800' : 'text-orange-800';
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border-2 px-4 py-3 shadow-sm', borderClass)}>
      <AlertTriangle className={cn('h-5 w-5 mt-0.5 shrink-0', iconClass)} />
      <div className="flex-1">
        <p className={cn('text-sm font-bold', textClass)}>
          Drug Interaction Warning — {result.pairs.length} {result.pairs.length === 1 ? 'pair' : 'pairs'}{' '}
          detected{highest ? ` (highest: ${sevLabel[highest]})` : ''}
        </p>
        <ul className={cn('text-xs mt-1 space-y-0.5', textClass)}>
          {result.pairs.slice(0, 3).map((p, i) => (
            <li key={i}>
              <span className="font-semibold">{p.drugs[0]} + {p.drugs[1]}</span>
              <span className="opacity-80"> — {p.description}</span>
            </li>
          ))}
          {result.pairs.length > 3 && (
            <li className="opacity-80">…and {result.pairs.length - 3} more. Click a drug's interaction badge for details.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function severityStyles(s: InteractionSeverity): string {
  switch (s) {
    case 'contraindicated':
      return 'bg-red-50 border-red-300';
    case 'major':
      return 'bg-red-50 border-red-200';
    case 'moderate':
      return 'bg-orange-50 border-orange-200';
    case 'minor':
    default:
      return 'bg-amber-50 border-amber-200';
  }
}

function severityBadge(s: InteractionSeverity): string {
  switch (s) {
    case 'contraindicated':
      return 'bg-red-200 text-red-900';
    case 'major':
      return 'bg-red-100 text-red-800';
    case 'moderate':
      return 'bg-orange-100 text-orange-800';
    case 'minor':
    default:
      return 'bg-amber-100 text-amber-800';
  }
}

// ── Utility Helpers ────────────────────────────────────────────

function matchHour(isoStr: string, hour: number): boolean {
  try {
    const d = new Date(isoStr);
    return d.getHours() === hour;
  } catch {
    return false;
  }
}

function formatTimeForInput(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  } catch {
    return nowTimeStr();
  }
}

function buildISOFromDateAndHour(dateStr: string, hour: number): string {
  return `${dateStr}T${hour.toString().padStart(2, '0')}:00:00`;
}

function buildISOFromDateAndTime(dateStr: string, timeStr: string): string {
  return `${dateStr}T${timeStr}:00`;
}
