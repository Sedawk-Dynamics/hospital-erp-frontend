'use client';

// /nurse/vitals — dedicated vital-records workspace.
//
// Surfaces both IPD admitted patients and OPD confirmed appointments scoped to
// the nurse's assigned doctors so a nurse can capture readings, see the latest
// snapshot, scan trends, and review history without leaving the page.
//
// The backend vitals endpoint accepts visitId | admissionId | appointmentId
// (see clinical.validation.ts:recordVitalsSchema). For confirmed OPD
// appointments without a Visit yet, we pass appointmentId and the server
// auto-creates the Visit (parallels nursing-forms.resolveVisitContext).

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BedDouble,
  Clock,
  Droplets,
  Heart,
  HeartPulse,
  Loader2,
  Plus,
  Scale,
  Search,
  Stethoscope,
  Thermometer,
  TrendingUp,
  Wind,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PatientSafetyBanner } from '@/components/shared/patient-safety-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatDateTime, formatTime } from '@/lib/date-utils';
import {
  useAllVitals,
  useLatestVitals,
  useNurseAdmissions,
  usePatientVitals,
  useRecordVitals,
  useCreateNotification,
  type NurseAdmission,
  type Vital,
} from '@/hooks/use-nurse';
import {
  useMyAssignedDoctors,
  useMyPatients,
  type MyPatientRecord,
} from '@/hooks/use-nurse-doctor-assignments';
import { VitalTrendChart } from '@/components/nurse/vital-trend-chart';

// ── Abnormal-value helpers ─────────────────────────────────

function isBpSystolicAbnormal(v?: number) {
  return v != null && (v > 140 || v < 90);
}
function isBpDiastolicAbnormal(v?: number) {
  return v != null && (v > 90 || v < 60);
}
function isTempAbnormal(v?: number) {
  return v != null && (v > 38 || v < 35);
}
function isSpO2Abnormal(v?: number) {
  return v != null && v < 94;
}
function isPulseAbnormal(v?: number) {
  return v != null && (v > 100 || v < 60);
}
function isRRAbnormal(v?: number) {
  return v != null && (v > 20 || v < 12);
}

function isValueAbnormal(key: string, value?: number): boolean {
  if (value == null) return false;
  switch (key) {
    case 'bloodPressureSystolic':
      return isBpSystolicAbnormal(value);
    case 'bloodPressureDiastolic':
      return isBpDiastolicAbnormal(value);
    case 'temperature':
      return isTempAbnormal(value);
    case 'oxygenSaturation':
      return isSpO2Abnormal(value);
    case 'pulseRate':
      return isPulseAbnormal(value);
    case 'respiratoryRate':
      return isRRAbnormal(value);
    default:
      return false;
  }
}

const NORMAL_RANGES: Record<string, string> = {
  bloodPressureSystolic: '90–140 mmHg',
  bloodPressureDiastolic: '60–90 mmHg',
  temperature: '35–38 °C',
  pulseRate: '60–100 bpm',
  respiratoryRate: '12–20 /min',
  oxygenSaturation: '94–100 %',
};

const VITAL_FIELDS = [
  { key: 'bloodPressureSystolic', label: 'BP Systolic', unit: 'mmHg', icon: Activity, placeholder: '120' },
  { key: 'bloodPressureDiastolic', label: 'BP Diastolic', unit: 'mmHg', icon: Activity, placeholder: '80' },
  { key: 'temperature', label: 'Temperature', unit: '°C', icon: Thermometer, placeholder: '36.6' },
  { key: 'pulseRate', label: 'Pulse Rate', unit: 'bpm', icon: Heart, placeholder: '72' },
  { key: 'respiratoryRate', label: 'Respiratory Rate', unit: '/min', icon: Wind, placeholder: '16' },
  { key: 'oxygenSaturation', label: 'SpO2', unit: '%', icon: Droplets, placeholder: '98' },
  { key: 'weightKg', label: 'Weight', unit: 'kg', icon: Scale, placeholder: '70' },
  { key: 'bloodSugar', label: 'Blood Sugar', unit: 'mg/dL', icon: TrendingUp, placeholder: '100' },
] as const;

const EMPTY_FORM = {
  bloodPressureSystolic: '',
  bloodPressureDiastolic: '',
  temperature: '',
  pulseRate: '',
  respiratoryRate: '',
  oxygenSaturation: '',
  weightKg: '',
  heightCm: '',
  bloodSugar: '',
  notes: '',
};

function parseNum(v: string): number | undefined {
  const n = parseFloat(v);
  return isNaN(n) ? undefined : n;
}

// Backend persists the timestamp as `recordedAt` (see Vital prisma model);
// older code paths exposed `createdAt`, so fall back for safety.
function vitalTimestamp(v: Vital): string | undefined {
  return v.recordedAt ?? v.createdAt;
}

// ── Unified encounter view ─────────────────────────────────
//
// Both admissions and appointments map onto the same set of fields the
// workspace cares about — patient header, doctor (for notifications), visit
// linkage, ward/bed (IPD only), allergies (IPD only). Normalising up front
// keeps the rest of the page agnostic to the source.

type EncounterKind = 'ipd' | 'opd';

interface Encounter {
  kind: EncounterKind;
  /** Stable per-row id (admission id / appointment id) — used for list keys. */
  rowId: string;
  patientId: string;
  patient: {
    firstName: string;
    lastName: string | null;
    mrn?: string | null;
    allergies?: string[];
  };
  doctor: {
    id: string;
    userId?: string;
    firstName: string;
    lastName: string | null;
  };
  /** Set when there's already a Visit row attached. */
  visitId?: string | null;
  /** Set for IPD encounters. */
  admissionId?: string;
  /** Set for OPD encounters. */
  appointmentId?: string;
  ipNumber?: string | null;
  ward?: { id: string; name: string } | null;
  bed?: { id: string; bedNumber: string } | null;
  /** OPD scheduling time, used in list subtitle. */
  startTime?: string;
  status?: string;
}

function admissionToEncounter(a: NurseAdmission): Encounter | null {
  if (!a.patient || !a.doctor) return null;
  return {
    kind: 'ipd',
    rowId: a.id,
    patientId: a.patientId,
    patient: {
      firstName: a.patient.firstName,
      lastName: a.patient.lastName ?? null,
      mrn: a.patient.mrn ?? null,
      allergies: a.patient.allergies,
    },
    doctor: {
      id: a.doctor.id,
      userId: a.doctor.userId,
      firstName: a.doctor.user?.firstName ?? '',
      lastName: a.doctor.user?.lastName ?? null,
    },
    visitId: a.visitId ?? null,
    admissionId: a.id,
    ipNumber: a.ipNumber ?? null,
    ward: a.ward ?? null,
    bed: a.bed ?? null,
    status: a.status,
  };
}

function appointmentToEncounter(r: MyPatientRecord): Encounter | null {
  if (r.recordType !== 'appointment') return null;
  return {
    kind: 'opd',
    rowId: r.id,
    patientId: r.patientId,
    patient: {
      firstName: r.patient.firstName,
      lastName: r.patient.lastName ?? null,
      mrn: r.patient.mrn ?? null,
    },
    doctor: {
      id: r.doctor.id,
      // MyPatientRecord doesn't surface the doctor's userId directly, so
      // abnormal-vitals notifications fall back to "no assigned doctor on
      // record" for OPD until that field is added upstream.
      firstName: r.doctor.user.firstName,
      lastName: r.doctor.user.lastName ?? null,
    },
    visitId: r.visitId ?? null,
    appointmentId: r.appointmentId ?? r.id,
    startTime: r.startTime,
    status: r.status,
  };
}

// ── Patient list item ──────────────────────────────────────

function EncounterListItem({
  encounter,
  isActive,
  hasOverdueVitals,
  onClick,
}: {
  encounter: Encounter;
  isActive: boolean;
  hasOverdueVitals: boolean;
  onClick: () => void;
}) {
  const initials =
    `${encounter.patient.firstName?.[0] ?? ''}${encounter.patient.lastName?.[0] ?? ''}`.toUpperCase() ||
    '?';
  const fullName =
    `${encounter.patient.firstName} ${encounter.patient.lastName ?? ''}`.trim() || 'Unknown';

  const subtitle = (
    encounter.kind === 'ipd'
      ? [
          encounter.patient.mrn ? `MRN ${encounter.patient.mrn}` : null,
          encounter.bed?.bedNumber ? `Bed ${encounter.bed.bedNumber}` : null,
          encounter.ward?.name ?? null,
        ]
      : [
          encounter.patient.mrn ? `MRN ${encounter.patient.mrn}` : null,
          encounter.startTime ? formatTime(encounter.startTime) : null,
          encounter.status ? STATUS_SHORT[encounter.status] ?? encounter.status : null,
        ]
  )
    .filter(Boolean)
    .join(' · ');

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
        isActive
          ? 'bg-primary/10 ring-1 ring-primary/30'
          : 'hover:bg-surface-container-low',
      )}
    >
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-foreground">{fullName}</p>
        <p className="truncate text-[10px] text-muted-foreground">{subtitle || '—'}</p>
      </div>
      {hasOverdueVitals && (
        <span
          title="Vitals overdue"
          className="flex h-2 w-2 flex-shrink-0 rounded-full bg-red-500"
        />
      )}
    </button>
  );
}

const STATUS_SHORT: Record<string, string> = {
  confirmed: 'Confirmed',
  checked_in: 'Checked In',
  waiting: 'Waiting',
  in_consultation: 'In Consult',
};

// ── Latest vitals card ─────────────────────────────────────

function LatestVitalsCard({ vitals }: { vitals: Vital | undefined }) {
  if (!vitals) {
    return (
      <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
        <h2 className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">
          Latest Vitals
        </h2>
        <p className="text-xs text-muted-foreground">No vital records yet for this patient.</p>
      </div>
    );
  }
  const items = [
    {
      label: 'BP',
      value:
        vitals.bloodPressureSystolic != null
          ? `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic ?? '-'}`
          : '-',
      abnormal:
        isBpSystolicAbnormal(vitals.bloodPressureSystolic) ||
        isBpDiastolicAbnormal(vitals.bloodPressureDiastolic),
      unit: 'mmHg',
    },
    {
      label: 'Temp',
      value: vitals.temperature ?? '-',
      abnormal: isTempAbnormal(vitals.temperature),
      unit: '°C',
    },
    {
      label: 'Pulse',
      value: vitals.pulseRate ?? vitals.heartRate ?? '-',
      abnormal: isPulseAbnormal(vitals.pulseRate ?? vitals.heartRate),
      unit: 'bpm',
    },
    {
      label: 'SpO2',
      value: vitals.oxygenSaturation ?? '-',
      abnormal: isSpO2Abnormal(vitals.oxygenSaturation),
      unit: '%',
    },
    {
      label: 'RR',
      value: vitals.respiratoryRate ?? '-',
      abnormal: isRRAbnormal(vitals.respiratoryRate),
      unit: '/min',
    },
    {
      label: 'Weight',
      value: vitals.weightKg ?? vitals.weight ?? '-',
      abnormal: false,
      unit: 'kg',
    },
  ];

  return (
    <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
          Latest Vitals
        </h2>
        <p className="text-[10px] text-on-surface-variant">
          Recorded {formatDateTime(vitalTimestamp(vitals))}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        {items.map((item) => (
          <div
            key={item.label}
            className={cn(
              'rounded-lg px-3 py-2 text-center',
              item.abnormal
                ? 'bg-red-50 ring-1 ring-red-300'
                : 'bg-surface-container-low',
            )}
          >
            <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">
              {item.label}
            </p>
            <p
              className={cn(
                'text-lg font-semibold',
                item.abnormal ? 'text-red-600' : 'text-on-surface',
              )}
            >
              {item.value}
            </p>
            <p className="text-[10px] text-on-surface-variant">{item.unit}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────

const VITALS_DUE_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4h

export default function NurseVitalsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPatientId = searchParams.get('patientId') ?? '';
  const initialKind = (searchParams.get('kind') as EncounterKind | null) ?? 'ipd';

  const [activeTab, setActiveTab] = useState<EncounterKind>(initialKind);
  const [selectedKey, setSelectedKey] = useState<string>(
    initialPatientId ? `${initialKind}:${initialPatientId}` : '',
  );
  const [patientSearch, setPatientSearch] = useState('');
  const [vitalsForm, setVitalsForm] = useState({ ...EMPTY_FORM });

  // ── Queries ──────────────────────────────────────────────
  const { data: myDoctorsData } = useMyAssignedDoctors();
  const myDoctorIds = useMemo(
    () => new Set((myDoctorsData?.data ?? []).map((d) => d.doctor.id)),
    [myDoctorsData],
  );

  // IPD admissions, scoped to assigned doctors (same rule the dashboard uses).
  const { data: admissionsRaw, isLoading: admissionsLoading } = useNurseAdmissions({
    status: 'admitted',
    limit: 200,
  });
  const allAdmissions: NurseAdmission[] = useMemo(() => {
    if (!admissionsRaw) return [];
    return Array.isArray(admissionsRaw)
      ? admissionsRaw
      : (admissionsRaw as unknown as { data: NurseAdmission[] }).data ?? [];
  }, [admissionsRaw]);

  const ipdEncounters: Encounter[] = useMemo(() => {
    if (myDoctorIds.size === 0) return [];
    return allAdmissions
      .filter((a) => a.doctorId && myDoctorIds.has(a.doctorId))
      .map(admissionToEncounter)
      .filter((e): e is Encounter => e != null);
  }, [allAdmissions, myDoctorIds]);

  // OPD: today's frontdesk-confirmed appointments under my assigned doctors.
  // The server scopes to confirmed | checked_in | waiting | in_consultation.
  const { data: opdData, isLoading: opdLoading } = useMyPatients({
    type: 'op',
    limit: 100,
  });
  const opdEncounters: Encounter[] = useMemo(
    () =>
      (opdData?.data ?? [])
        .map(appointmentToEncounter)
        .filter((e): e is Encounter => e != null),
    [opdData],
  );

  const activeEncounters = activeTab === 'ipd' ? ipdEncounters : opdEncounters;
  const isListLoading = activeTab === 'ipd' ? admissionsLoading : opdLoading;

  const filteredEncounters = useMemo(() => {
    if (!patientSearch.trim()) return activeEncounters;
    const q = patientSearch.toLowerCase();
    return activeEncounters.filter((e) => {
      const name = `${e.patient.firstName} ${e.patient.lastName ?? ''}`.toLowerCase();
      const mrn = (e.patient.mrn ?? '').toLowerCase();
      const ip = (e.ipNumber ?? '').toLowerCase();
      const bed = (e.bed?.bedNumber ?? '').toLowerCase();
      return (
        name.includes(q) || mrn.includes(q) || ip.includes(q) || bed.includes(q)
      );
    });
  }, [activeEncounters, patientSearch]);

  const selectedEncounter = useMemo<Encounter | null>(() => {
    if (!selectedKey) return null;
    const [kind, patientId] = selectedKey.split(':') as [EncounterKind, string];
    const pool = kind === 'ipd' ? ipdEncounters : opdEncounters;
    return pool.find((e) => e.patientId === patientId) ?? null;
  }, [selectedKey, ipdEncounters, opdEncounters]);

  // Auto-pick first encounter when nothing is selected and the list resolves.
  useEffect(() => {
    if (!selectedKey && activeEncounters.length > 0) {
      const first = activeEncounters[0];
      setSelectedKey(`${first.kind}:${first.patientId}`);
    }
  }, [activeEncounters, selectedKey]);

  const selectedPatientId = selectedEncounter?.patientId ?? '';

  const { data: latestVitalsRaw } = useLatestVitals(selectedPatientId);
  const latestVitals: Vital | undefined = useMemo(() => {
    if (!latestVitalsRaw) return undefined;
    return (latestVitalsRaw as unknown as { data: Vital }).data ?? latestVitalsRaw;
  }, [latestVitalsRaw]);

  const { data: vitalsRaw, isLoading: vitalsLoading } = usePatientVitals(
    selectedPatientId,
    { limit: 50 },
  );
  const vitals: Vital[] = useMemo(() => {
    if (!vitalsRaw) return [];
    return Array.isArray(vitalsRaw)
      ? vitalsRaw
      : (vitalsRaw as unknown as { data: Vital[] }).data ?? [];
  }, [vitalsRaw]);

  // For the "vitals overdue" red dot in the patient list.
  const { data: allVitalsData } = useAllVitals({ limit: 200 });
  const lastVitalAt = useMemo(() => {
    const map = new Map<string, number>();
    const arr = allVitalsData?.data ?? [];
    for (const v of arr) {
      const ts = vitalTimestamp(v);
      if (!ts) continue;
      const t = new Date(ts).getTime();
      const prev = map.get(v.patientId);
      if (!prev || t > prev) map.set(v.patientId, t);
    }
    return map;
  }, [allVitalsData]);

  // ── Mutations ────────────────────────────────────────────
  const recordVitals = useRecordVitals();
  const createNotification = useCreateNotification();

  // ── Handlers ─────────────────────────────────────────────
  function handleSwitchTab(kind: EncounterKind) {
    setActiveTab(kind);
    setSelectedKey('');
    setVitalsForm({ ...EMPTY_FORM });
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('kind', kind);
    sp.delete('patientId');
    router.replace(`/nurse/vitals?${sp.toString()}`, { scroll: false });
  }

  function handleSelect(encounter: Encounter) {
    setSelectedKey(`${encounter.kind}:${encounter.patientId}`);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('patientId', encounter.patientId);
    sp.set('kind', encounter.kind);
    router.replace(`/nurse/vitals?${sp.toString()}`, { scroll: false });
    setVitalsForm({ ...EMPTY_FORM });
  }

  function handleVitalChange(field: string, value: string) {
    setVitalsForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmitVitals() {
    if (!selectedEncounter) {
      toast.error('Please select a patient first');
      return;
    }

    // Build the encounter linkage. Prefer visitId when present so we never
    // hit the auto-create path twice. For OPD without a visit, send
    // appointmentId — server creates the Visit. For IPD send admissionId
    // (server resolves to the admission's visit).
    const linkage: { visitId?: string; admissionId?: string; appointmentId?: string } = {};
    if (selectedEncounter.visitId) {
      linkage.visitId = selectedEncounter.visitId;
    } else if (selectedEncounter.kind === 'ipd' && selectedEncounter.admissionId) {
      linkage.admissionId = selectedEncounter.admissionId;
    } else if (selectedEncounter.kind === 'opd' && selectedEncounter.appointmentId) {
      linkage.appointmentId = selectedEncounter.appointmentId;
    } else {
      toast.error('Cannot record vitals: this encounter has no visit, admission, or appointment id');
      return;
    }

    const payload = {
      patientId: selectedEncounter.patientId,
      ...linkage,
      bloodPressureSystolic: parseNum(vitalsForm.bloodPressureSystolic),
      bloodPressureDiastolic: parseNum(vitalsForm.bloodPressureDiastolic),
      temperature: parseNum(vitalsForm.temperature),
      pulseRate: parseNum(vitalsForm.pulseRate),
      respiratoryRate: parseNum(vitalsForm.respiratoryRate),
      oxygenSaturation: parseNum(vitalsForm.oxygenSaturation),
      weightKg: parseNum(vitalsForm.weightKg),
      heightCm: parseNum(vitalsForm.heightCm),
      bloodSugar: parseNum(vitalsForm.bloodSugar),
      notes: vitalsForm.notes || undefined,
    };

    const hasValue = [
      payload.bloodPressureSystolic,
      payload.bloodPressureDiastolic,
      payload.temperature,
      payload.pulseRate,
      payload.respiratoryRate,
      payload.oxygenSaturation,
      payload.weightKg,
      payload.heightCm,
      payload.bloodSugar,
    ].some((v) => v != null);

    if (!hasValue) {
      toast.error('Please enter at least one vital sign value');
      return;
    }

    const abnormal: string[] = [];
    if (
      isBpSystolicAbnormal(payload.bloodPressureSystolic) ||
      isBpDiastolicAbnormal(payload.bloodPressureDiastolic)
    ) {
      abnormal.push(
        `BP ${payload.bloodPressureSystolic ?? '?'}/${payload.bloodPressureDiastolic ?? '?'} mmHg`,
      );
    }
    if (isTempAbnormal(payload.temperature)) abnormal.push(`Temp ${payload.temperature}°C`);
    if (isPulseAbnormal(payload.pulseRate)) abnormal.push(`Pulse ${payload.pulseRate} bpm`);
    if (isSpO2Abnormal(payload.oxygenSaturation)) abnormal.push(`SpO₂ ${payload.oxygenSaturation}%`);
    if (isRRAbnormal(payload.respiratoryRate)) abnormal.push(`RR ${payload.respiratoryRate}/min`);

    recordVitals.mutate(payload, {
      onSuccess: () => {
        toast.success('Vitals recorded');
        setVitalsForm({ ...EMPTY_FORM });

        const doctorUserId = selectedEncounter.doctor.userId;
        if (abnormal.length > 0 && doctorUserId) {
          const patientName =
            `${selectedEncounter.patient.firstName} ${selectedEncounter.patient.lastName ?? ''}`.trim();
          const where =
            selectedEncounter.kind === 'ipd' && selectedEncounter.bed?.bedNumber
              ? ` Bed ${selectedEncounter.bed.bedNumber}.`
              : '';
          createNotification.mutate(
            {
              userId: doctorUserId,
              title: `Abnormal vitals: ${patientName}`,
              message: `Abnormal readings recorded — ${abnormal.join(', ')}.${where}`,
              notificationType: 'alert',
              channel: 'in_app',
              referenceType:
                selectedEncounter.kind === 'ipd' ? 'admission' : 'appointment',
              referenceId:
                selectedEncounter.kind === 'ipd'
                  ? selectedEncounter.admissionId
                  : selectedEncounter.appointmentId,
            },
            {
              onSuccess: () =>
                toast.warning(`Abnormal values flagged — doctor notified (${abnormal.join(', ')})`),
              onError: () =>
                toast.warning(
                  `Abnormal values detected (${abnormal.join(', ')}). Notification failed — alert the doctor directly.`,
                ),
            },
          );
        } else if (abnormal.length > 0) {
          toast.warning(
            `Abnormal values detected (${abnormal.join(', ')}). No assigned doctor on record.`,
          );
        }
      },
      onError: (err: unknown) => {
        toast.error((err as { message?: string })?.message ?? 'Failed to record vitals');
      },
    });
  }

  // ── Trend series (7-day window) ──────────────────────────
  const trendSeries = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const within = vitals.filter((v) => {
      const ts = vitalTimestamp(v);
      return ts ? new Date(ts).getTime() >= cutoff : false;
    });
    return {
      bp: within
        .filter((v) => v.bloodPressureSystolic != null || v.bloodPressureDiastolic != null)
        .map((v) => ({
          time: vitalTimestamp(v)!,
          value: v.bloodPressureSystolic ?? 0,
          value2: v.bloodPressureDiastolic ?? undefined,
        })),
      temp: within
        .filter((v) => v.temperature != null)
        .map((v) => ({ time: vitalTimestamp(v)!, value: v.temperature! })),
      pulse: within
        .filter((v) => v.pulseRate != null || v.heartRate != null)
        .map((v) => ({ time: vitalTimestamp(v)!, value: (v.pulseRate ?? v.heartRate)! })),
      rr: within
        .filter((v) => v.respiratoryRate != null)
        .map((v) => ({ time: vitalTimestamp(v)!, value: v.respiratoryRate! })),
      spo2: within
        .filter((v) => v.oxygenSaturation != null)
        .map((v) => ({ time: vitalTimestamp(v)!, value: v.oxygenSaturation! })),
    };
  }, [vitals]);

  const now = Date.now();

  // ── Render ───────────────────────────────────────────────
  if (myDoctorIds.size === 0) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold text-on-surface">Patient Vitals</h1>
        </div>
        <div className="rounded-xl bg-surface-container-lowest p-8 text-center shadow-sanctuary">
          <Stethoscope className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">Not assigned to any doctor</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ask your nurse admin to assign you to one or more doctors so their patients
            appear here.
          </p>
          <Link
            href="/nurse"
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-on-surface">Patient Vitals</h1>
            <p className="text-xs text-muted-foreground">
              Record vitals for assigned IPD patients and confirmed OPD appointments
            </p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          {ipdEncounters.length} IPD · {opdEncounters.length} OPD
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        {/* ── Patient list ───────────────────────────────────── */}
        <aside className="rounded-xl bg-surface-container-lowest p-3 shadow-sanctuary">
          {/* IPD / OPD tabs */}
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-surface-container-low p-1 text-xs">
            <button
              type="button"
              onClick={() => handleSwitchTab('ipd')}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition-colors',
                activeTab === 'ipd'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container',
              )}
            >
              <BedDouble className="h-3.5 w-3.5" />
              IPD
              <span className="text-[10px] opacity-70">({ipdEncounters.length})</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTab('opd')}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition-colors',
                activeTab === 'opd'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container',
              )}
            >
              <Stethoscope className="h-3.5 w-3.5" />
              OPD
              <span className="text-[10px] opacity-70">({opdEncounters.length})</span>
            </button>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              placeholder={
                activeTab === 'ipd'
                  ? 'Search name, MRN, bed...'
                  : 'Search name or MRN...'
              }
              className="h-8 pl-8 text-xs"
            />
          </div>

          {isListLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          ) : filteredEncounters.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              {activeTab === 'ipd'
                ? 'No admitted patients under your assigned doctors.'
                : 'No frontdesk-confirmed OPD appointments under your assigned doctors today.'}
            </p>
          ) : (
            <div className="max-h-[calc(100vh-320px)] space-y-1 overflow-y-auto pr-1">
              {filteredEncounters.map((enc) => {
                const last = lastVitalAt.get(enc.patientId);
                const overdue = last == null || now - last > VITALS_DUE_THRESHOLD_MS;
                return (
                  <EncounterListItem
                    key={enc.rowId}
                    encounter={enc}
                    isActive={selectedEncounter?.rowId === enc.rowId}
                    hasOverdueVitals={overdue}
                    onClick={() => handleSelect(enc)}
                  />
                );
              })}
            </div>
          )}
        </aside>

        {/* ── Workspace ──────────────────────────────────────── */}
        <section className="space-y-4">
          {!selectedEncounter ? (
            <div className="flex flex-col items-center justify-center rounded-xl bg-surface-container-lowest py-16 text-on-surface-variant shadow-sanctuary">
              <HeartPulse className="mb-3 h-12 w-12 opacity-30" />
              <p className="text-sm">Select a patient from the list to record vitals</p>
            </div>
          ) : (
            <>
              {/* Patient context bar */}
              <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-xs text-primary">
                      {`${selectedEncounter.patient.firstName?.[0] ?? ''}${selectedEncounter.patient.lastName?.[0] ?? ''}`.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {selectedEncounter.patient.firstName}{' '}
                        {selectedEncounter.patient.lastName ?? ''}
                      </p>
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                          selectedEncounter.kind === 'ipd'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-cyan-100 text-cyan-700',
                        )}
                      >
                        {selectedEncounter.kind.toUpperCase()}
                      </span>
                      {selectedEncounter.kind === 'opd' && selectedEncounter.status && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          {STATUS_SHORT[selectedEncounter.status] ?? selectedEncounter.status}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {[
                        selectedEncounter.patient.mrn ? `MRN ${selectedEncounter.patient.mrn}` : null,
                        selectedEncounter.kind === 'ipd' && selectedEncounter.ipNumber
                          ? `IP ${selectedEncounter.ipNumber}`
                          : null,
                        selectedEncounter.kind === 'ipd' ? selectedEncounter.ward?.name : null,
                        selectedEncounter.kind === 'ipd' && selectedEncounter.bed?.bedNumber
                          ? `Bed ${selectedEncounter.bed.bedNumber}`
                          : null,
                        selectedEncounter.kind === 'opd' && selectedEncounter.startTime
                          ? `Slot ${formatTime(selectedEncounter.startTime)}`
                          : null,
                        `Dr. ${selectedEncounter.doctor.firstName} ${selectedEncounter.doctor.lastName ?? ''}`.trim(),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                </div>
                {selectedEncounter.kind === 'opd' && !selectedEncounter.visitId && (
                  <p className="mt-2 rounded-md bg-cyan-50 px-2 py-1 text-[11px] text-cyan-700">
                    First reading will start the visit for this appointment.
                  </p>
                )}
              </div>

              {/* Was an inline chip off `selectedEncounter.patient.allergies`,
                  which no encounter endpoint returns — so it never appeared.
                  The shared banner fetches them and shows severity + reaction. */}
              <PatientSafetyBanner patientId={selectedPatientId} />

              {/* Latest vitals */}
              <LatestVitalsCard vitals={latestVitals} />

              {/* Capture form */}
              <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                    <Activity className="h-4 w-4 text-primary" />
                    Record New Reading
                  </h2>
                  <p className="text-[10px] text-muted-foreground">
                    Abnormal readings auto-notify the assigned doctor
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {VITAL_FIELDS.map((field) => {
                    const val = vitalsForm[field.key as keyof typeof vitalsForm] ?? '';
                    const numVal = parseNum(val);
                    const abnormal = isValueAbnormal(field.key, numVal);
                    const Icon = field.icon;
                    return (
                      <div key={field.key}>
                        <label className="font-label mb-1 flex items-center gap-1 text-[10px] uppercase tracking-widest text-on-surface-variant">
                          <Icon className="h-3 w-3" />
                          {field.label}
                          <span className="text-[9px] font-normal normal-case">
                            ({field.unit})
                          </span>
                        </label>
                        <div className="relative">
                          <Input
                            type="number"
                            step="any"
                            value={val}
                            onChange={(e) => handleVitalChange(field.key, e.target.value)}
                            placeholder={field.placeholder}
                            className={cn(
                              abnormal &&
                                'border-red-500 ring-1 ring-red-300 focus-visible:ring-red-500',
                            )}
                          />
                          {abnormal && (
                            <span className="absolute right-2 top-1/2 -translate-y-1/2">
                              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                            </span>
                          )}
                        </div>
                        {abnormal && NORMAL_RANGES[field.key] && (
                          <p className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                            Abnormal — Normal: {NORMAL_RANGES[field.key]}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4">
                  <label className="font-label mb-1 block text-[10px] uppercase tracking-widest text-on-surface-variant">
                    Notes
                  </label>
                  <Textarea
                    value={vitalsForm.notes}
                    onChange={(e) => handleVitalChange('notes', e.target.value)}
                    placeholder="Additional observations..."
                    rows={2}
                  />
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => setVitalsForm({ ...EMPTY_FORM })}
                    disabled={recordVitals.isPending}
                  >
                    Reset
                  </Button>
                  <Button
                    onClick={handleSubmitVitals}
                    disabled={recordVitals.isPending}
                    className="gap-2"
                  >
                    {recordVitals.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Record Vitals
                  </Button>
                </div>
              </div>

              {/* Trend charts */}
              <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-on-surface">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Trends — Last 7 Days
                </h2>
                {vitalsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : vitals.length === 0 ? (
                  <p className="py-8 text-center text-sm text-on-surface-variant">
                    No vitals recorded yet
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <VitalTrendChart
                      title="Blood Pressure"
                      unit="mmHg"
                      points={trendSeries.bp}
                      normalRange={[90, 140]}
                      normalRange2={[60, 90]}
                      seriesLabel="Systolic"
                      seriesLabel2="Diastolic"
                    />
                    <VitalTrendChart
                      title="Temperature"
                      unit="°C"
                      points={trendSeries.temp}
                      normalRange={[36.1, 38.0]}
                    />
                    <VitalTrendChart
                      title="Pulse Rate"
                      unit="bpm"
                      points={trendSeries.pulse}
                      normalRange={[60, 100]}
                    />
                    <VitalTrendChart
                      title="SpO2"
                      unit="%"
                      points={trendSeries.spo2}
                      normalRange={[94, 100]}
                      yMin={85}
                      yMax={100}
                    />
                    <VitalTrendChart
                      title="Respiratory Rate"
                      unit="/min"
                      points={trendSeries.rr}
                      normalRange={[12, 20]}
                    />
                  </div>
                )}
              </div>

              {/* History table */}
              <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-on-surface">
                  <Clock className="h-4 w-4 text-primary" />
                  Vital Records History
                </h2>
                {vitalsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : vitals.length === 0 ? (
                  <p className="py-8 text-center text-sm text-on-surface-variant">
                    No vitals recorded yet
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-outline-variant/30 text-left">
                          {[
                            'Date / Time',
                            'BP (mmHg)',
                            'Temp (°C)',
                            'Pulse (bpm)',
                            'RR (/min)',
                            'SpO2 (%)',
                            'Weight (kg)',
                            'Sugar (mg/dL)',
                            'Notes',
                          ].map((col) => (
                            <th
                              key={col}
                              className="px-2 py-2 font-label text-[10px] uppercase tracking-wider text-on-surface-variant"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {vitals.map((v) => {
                          const bpAbn =
                            isBpSystolicAbnormal(v.bloodPressureSystolic) ||
                            isBpDiastolicAbnormal(v.bloodPressureDiastolic);
                          const tempAbn = isTempAbnormal(v.temperature);
                          const pulseAbn = isPulseAbnormal(v.pulseRate ?? v.heartRate);
                          const rrAbn = isRRAbnormal(v.respiratoryRate);
                          const spo2Abn = isSpO2Abnormal(v.oxygenSaturation);
                          return (
                            <tr
                              key={v.id}
                              className="border-b border-outline-variant/20 hover:bg-surface-container-low"
                            >
                              <td className="px-2 py-2 font-medium text-foreground">
                                {formatDateTime(vitalTimestamp(v))}
                              </td>
                              <td
                                className={cn(
                                  'px-2 py-2',
                                  bpAbn ? 'font-semibold text-red-600' : 'text-foreground',
                                )}
                              >
                                {v.bloodPressureSystolic != null
                                  ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic ?? '-'}`
                                  : '-'}
                              </td>
                              <td
                                className={cn(
                                  'px-2 py-2',
                                  tempAbn ? 'font-semibold text-red-600' : 'text-foreground',
                                )}
                              >
                                {v.temperature ?? '-'}
                              </td>
                              <td
                                className={cn(
                                  'px-2 py-2',
                                  pulseAbn ? 'font-semibold text-red-600' : 'text-foreground',
                                )}
                              >
                                {v.pulseRate ?? v.heartRate ?? '-'}
                              </td>
                              <td
                                className={cn(
                                  'px-2 py-2',
                                  rrAbn ? 'font-semibold text-red-600' : 'text-foreground',
                                )}
                              >
                                {v.respiratoryRate ?? '-'}
                              </td>
                              <td
                                className={cn(
                                  'px-2 py-2',
                                  spo2Abn ? 'font-semibold text-red-600' : 'text-foreground',
                                )}
                              >
                                {v.oxygenSaturation ?? '-'}
                              </td>
                              <td className="px-2 py-2 text-foreground">
                                {v.weightKg ?? v.weight ?? '-'}
                              </td>
                              <td className="px-2 py-2 text-foreground">
                                {v.bloodSugar ?? '-'}
                              </td>
                              <td className="max-w-[180px] truncate px-2 py-2 text-muted-foreground">
                                {v.notes ?? '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
