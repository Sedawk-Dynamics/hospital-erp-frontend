'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatDateTime } from '@/lib/date-utils';
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
import {
  useNurseAdmissions,
  usePatientVitals,
  useLatestVitals,
  useRecordVitals,
  useNursingNotes,
  useCreateNursingNote,
  useCreateNotification,
  type NurseAdmission,
  type Vital,
  type NursingNote,
} from '@/hooks/use-nurse';
import { VitalTrendChart } from '@/components/nurse/vital-trend-chart';
import { WoundCarePanel } from '@/components/nurse/wound-care-panel';
import { IvLinePanel } from '@/components/nurse/iv-line-panel';
import { IntakeOutputPanel } from '@/components/nurse/intake-output-panel';
import { ObservationsPanel } from '@/components/nurse/observations-panel';
import { ClinicalDevicesPanel } from '@/components/nurse/clinical-devices-panel';
import { ProceduresPanel } from '@/components/nurse/procedures-panel';
import {
  Search,
  Activity,
  Thermometer,
  Heart,
  Wind,
  Droplets,
  Scale,
  FileText,
  Plus,
  Loader2,
  AlertTriangle,
  Clock,
  TrendingUp,
  Clipboard,
  Syringe,
  GlassWater,
  Stethoscope,
  ListChecks,
} from 'lucide-react';

// ── Abnormal-value helpers ─────────────────────────────────

function isBpSystolicAbnormal(v?: number) {
  return v != null && v > 140;
}
function isBpDiastolicAbnormal(v?: number) {
  return v != null && v > 90;
}
function isTempAbnormal(v?: number) {
  return v != null && v > 38.5;
}
function isSpO2Abnormal(v?: number) {
  return v != null && v < 95;
}
function isPulseAbnormal(v?: number) {
  return v != null && (v > 100 || v < 60);
}
function isRRAbnormal(v?: number) {
  return v != null && v > 20;
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

// ── Normal range labels ────────────────────────────────────

const NORMAL_RANGES: Record<string, string> = {
  bloodPressureSystolic: '90-140 mmHg',
  bloodPressureDiastolic: '60-90 mmHg',
  temperature: '36.1-38.5 \u00b0C',
  pulseRate: '60-100 bpm',
  respiratoryRate: '12-20 /min',
  oxygenSaturation: '95-100 %',
};

// ── Note tab config ────────────────────────────────────────

const NOTE_TABS = [
  { key: 'observation', label: 'Observations', icon: Clipboard },
  { key: 'devices', label: 'Devices / Lines', icon: Stethoscope },
  { key: 'procedures', label: 'Procedures', icon: ListChecks },
  { key: 'wound_care', label: 'Wound Care', icon: FileText },
  { key: 'iv_line', label: 'IV Line', icon: Syringe },
  { key: 'intake_output', label: 'Intake / Output', icon: GlassWater },
  { key: 'general', label: 'Daily Note', icon: FileText },
] as const;

type NoteTabKey = (typeof NOTE_TABS)[number]['key'];

// ── Component ──────────────────────────────────────────────

export default function ClinicalChartingPage() {
  const user = useAuthStore((s) => s.user);
  const searchParams = useSearchParams();
  const admissionIdParam = searchParams.get('admissionId') ?? '';
  const patientIdParam = searchParams.get('patientId') ?? '';

  // Patient selector state
  const [selectedPatientId, setSelectedPatientId] = useState(patientIdParam);
  const [patientSearch, setPatientSearch] = useState('');

  // Vitals form state
  const [vitalsForm, setVitalsForm] = useState({
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    temperature: '',
    pulseRate: '',
    respiratoryRate: '',
    oxygenSaturation: '',
    weightKg: '',
    bloodSugar: '',
    notes: '',
  });

  // Nursing notes tab
  const [activeNoteTab, setActiveNoteTab] = useState<NoteTabKey>('observation');
  const [noteContent, setNoteContent] = useState('');

  // ── Queries ────────────────────────────────────────────────

  const { data: admissionsRaw, isLoading: admissionsLoading } =
    useNurseAdmissions({ status: 'admitted', limit: 200 });
  const admissions: NurseAdmission[] = useMemo(() => {
    if (!admissionsRaw) return [];
    return Array.isArray(admissionsRaw)
      ? admissionsRaw
      : (admissionsRaw as unknown as { data: NurseAdmission[] }).data ?? [];
  }, [admissionsRaw]);

  // Auto-select patient when ?admissionId= deep link is provided
  useEffect(() => {
    if (!admissionIdParam || selectedPatientId) return;
    const match = admissions.find((a) => a.id === admissionIdParam);
    if (match?.patientId) setSelectedPatientId(match.patientId);
  }, [admissionIdParam, admissions, selectedPatientId]);

  // Find selected admission — prefer the explicit ?admissionId= when given,
  // otherwise fall back to first admission for the selected patient.
  const selectedAdmission = useMemo(() => {
    if (admissionIdParam) {
      const byId = admissions.find((a) => a.id === admissionIdParam);
      if (byId) return byId;
    }
    return admissions.find((a) => a.patientId === selectedPatientId);
  }, [admissions, selectedPatientId, admissionIdParam]);

  // Filter admissions by search
  const filteredAdmissions = useMemo(() => {
    if (!patientSearch.trim()) return admissions;
    const q = patientSearch.toLowerCase();
    return admissions.filter((a) => {
      const name =
        `${a.patient?.firstName ?? ''} ${a.patient?.lastName ?? ''}`.toLowerCase();
      const mrn = (a.patient?.mrn ?? '').toLowerCase();
      const uhid = (a.patient?.uhid ?? '').toLowerCase();
      const ip = (a.ipNumber ?? '').toLowerCase();
      return (
        name.includes(q) || mrn.includes(q) || uhid.includes(q) || ip.includes(q)
      );
    });
  }, [admissions, patientSearch]);

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

  const { data: latestVitalsRaw } = useLatestVitals(selectedPatientId);
  const latestVitals: Vital | undefined = useMemo(() => {
    if (!latestVitalsRaw) return undefined;
    return (latestVitalsRaw as unknown as { data: Vital }).data ?? latestVitalsRaw;
  }, [latestVitalsRaw]);

  // Only fetch nursing notes for tabs that map onto a stored note type —
  // the new "devices" / "procedures" tabs render their own panels.
  const noteTypeForFetch =
    activeNoteTab === 'observation' ? 'observation' : 'general';
  const { data: notesRaw, isLoading: notesLoading } = useNursingNotes({
    patientId: selectedPatientId || undefined,
    noteType: noteTypeForFetch,
    limit: 50,
  });
  const notes: NursingNote[] = useMemo(() => {
    if (!notesRaw) return [];
    return Array.isArray(notesRaw)
      ? notesRaw
      : (notesRaw as unknown as { data: NursingNote[] }).data ?? [];
  }, [notesRaw]);

  // ── Mutations ──────────────────────────────────────────────

  const recordVitals = useRecordVitals();
  const createNote = useCreateNursingNote();
  const createNotification = useCreateNotification();

  // ── Handlers ───────────────────────────────────────────────

  function handleVitalChange(field: string, value: string) {
    setVitalsForm((prev) => ({ ...prev, [field]: value }));
  }

  function parseNum(v: string): number | undefined {
    const n = parseFloat(v);
    return isNaN(n) ? undefined : n;
  }

  function handleSubmitVitals() {
    if (!selectedPatientId) {
      toast.error('Please select a patient first');
      return;
    }

    if (!selectedAdmission?.visitId) {
      toast.error('Cannot record vitals: this admission has no associated visit');
      return;
    }

    const payload = {
      patientId: selectedPatientId,
      visitId: selectedAdmission.visitId,
      bloodPressureSystolic: parseNum(vitalsForm.bloodPressureSystolic),
      bloodPressureDiastolic: parseNum(vitalsForm.bloodPressureDiastolic),
      temperature: parseNum(vitalsForm.temperature),
      pulseRate: parseNum(vitalsForm.pulseRate),
      respiratoryRate: parseNum(vitalsForm.respiratoryRate),
      oxygenSaturation: parseNum(vitalsForm.oxygenSaturation),
      weightKg: parseNum(vitalsForm.weightKg),
      bloodSugar: parseNum(vitalsForm.bloodSugar),
      notes: vitalsForm.notes || undefined,
    };

    // Must have at least one value
    const hasValue = [
      payload.bloodPressureSystolic,
      payload.bloodPressureDiastolic,
      payload.temperature,
      payload.pulseRate,
      payload.respiratoryRate,
      payload.oxygenSaturation,
      payload.weightKg,
      payload.bloodSugar,
    ].some((v) => v != null);

    if (!hasValue) {
      toast.error('Please enter at least one vital sign value');
      return;
    }

    // Detect abnormal values in the current submission
    const abnormalSummary: string[] = [];
    if (isBpSystolicAbnormal(payload.bloodPressureSystolic) || isBpDiastolicAbnormal(payload.bloodPressureDiastolic)) {
      abnormalSummary.push(
        `BP ${payload.bloodPressureSystolic ?? '?'}/${payload.bloodPressureDiastolic ?? '?'} mmHg`,
      );
    }
    if (isTempAbnormal(payload.temperature)) abnormalSummary.push(`Temp ${payload.temperature}°C`);
    if (isPulseAbnormal(payload.pulseRate)) abnormalSummary.push(`Pulse ${payload.pulseRate} bpm`);
    if (isSpO2Abnormal(payload.oxygenSaturation)) abnormalSummary.push(`SpO₂ ${payload.oxygenSaturation}%`);
    if (isRRAbnormal(payload.respiratoryRate)) abnormalSummary.push(`RR ${payload.respiratoryRate}/min`);

    recordVitals.mutate(payload, {
      onSuccess: () => {
        toast.success('Vitals recorded successfully');
        setVitalsForm({
          bloodPressureSystolic: '',
          bloodPressureDiastolic: '',
          temperature: '',
          pulseRate: '',
          respiratoryRate: '',
          oxygenSaturation: '',
          weightKg: '',
          bloodSugar: '',
          notes: '',
        });

        // If any reading was abnormal, notify the assigned doctor (best-effort).
        const doctorUserId = selectedAdmission?.doctor?.userId;
        if (abnormalSummary.length > 0 && doctorUserId) {
          const patientName = selectedAdmission?.patient
            ? `${selectedAdmission.patient.firstName} ${selectedAdmission.patient.lastName}`
            : 'Patient';
          createNotification.mutate(
            {
              userId: doctorUserId,
              title: `Abnormal vitals: ${patientName}`,
              message: `Abnormal readings recorded — ${abnormalSummary.join(', ')}.${
                selectedAdmission?.bed?.bedNumber
                  ? ` Bed ${selectedAdmission.bed.bedNumber}.`
                  : ''
              }`,
              notificationType: 'alert',
              channel: 'in_app',
              referenceType: 'admission',
              referenceId: selectedAdmission?.id,
            },
            {
              onSuccess: () => {
                toast.warning(
                  `Abnormal values detected — doctor notified (${abnormalSummary.join(', ')})`,
                );
              },
              onError: () => {
                toast.warning(
                  `Abnormal values detected (${abnormalSummary.join(', ')}). Notification failed — please alert the doctor directly.`,
                );
              },
            },
          );
        } else if (abnormalSummary.length > 0) {
          toast.warning(
            `Abnormal values detected (${abnormalSummary.join(', ')}). No assigned doctor on record.`,
          );
        }
      },
      onError: (err: unknown) => {
        toast.error(
          (err as { message?: string })?.message ?? 'Failed to record vitals',
        );
      },
    });
  }

  function handleSubmitNote() {
    if (!selectedPatientId) {
      toast.error('Please select a patient first');
      return;
    }
    if (!noteContent.trim()) {
      toast.error('Note content cannot be empty');
      return;
    }

    createNote.mutate(
      {
        patientId: selectedPatientId,
        admissionId: selectedAdmission?.id,
        noteType: activeNoteTab,
        content: noteContent.trim(),
      },
      {
        onSuccess: () => {
          toast.success('Nursing note added');
          setNoteContent('');
        },
        onError: (err: unknown) => {
          toast.error(
            (err as { message?: string })?.message ?? 'Failed to add note',
          );
        },
      },
    );
  }

  // ── Trend series (keep every reading in the 7-day window) ─

  const trendSeries = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const within = vitals.filter(
      (v) => v.createdAt != null && new Date(v.createdAt).getTime() >= cutoff,
    );
    return {
      bp: within
        .filter(
          (v) => v.bloodPressureSystolic != null || v.bloodPressureDiastolic != null,
        )
        .map((v) => ({
          time: v.createdAt!,
          value: v.bloodPressureSystolic ?? 0,
          value2: v.bloodPressureDiastolic ?? undefined,
        })),
      temp: within
        .filter((v) => v.temperature != null)
        .map((v) => ({ time: v.createdAt!, value: v.temperature! })),
      pulse: within
        .filter((v) => v.pulseRate != null || v.heartRate != null)
        .map((v) => ({
          time: v.createdAt!,
          value: (v.pulseRate ?? v.heartRate)!,
        })),
      rr: within
        .filter((v) => v.respiratoryRate != null)
        .map((v) => ({ time: v.createdAt!, value: v.respiratoryRate! })),
      spo2: within
        .filter((v) => v.oxygenSaturation != null)
        .map((v) => ({ time: v.createdAt!, value: v.oxygenSaturation! })),
    };
  }, [vitals]);

  // ── Vital field config (for form) ─────────────────────────

  const VITAL_FIELDS = [
    {
      key: 'bloodPressureSystolic',
      label: 'BP Systolic',
      unit: 'mmHg',
      icon: Activity,
      placeholder: '120',
    },
    {
      key: 'bloodPressureDiastolic',
      label: 'BP Diastolic',
      unit: 'mmHg',
      icon: Activity,
      placeholder: '80',
    },
    {
      key: 'temperature',
      label: 'Temperature',
      unit: '\u00b0C',
      icon: Thermometer,
      placeholder: '36.6',
    },
    {
      key: 'pulseRate',
      label: 'Pulse Rate',
      unit: 'bpm',
      icon: Heart,
      placeholder: '72',
    },
    {
      key: 'respiratoryRate',
      label: 'Respiratory Rate',
      unit: '/min',
      icon: Wind,
      placeholder: '16',
    },
    {
      key: 'oxygenSaturation',
      label: 'SpO2',
      unit: '%',
      icon: Droplets,
      placeholder: '98',
    },
    {
      key: 'weightKg',
      label: 'Weight',
      unit: 'kg',
      icon: Scale,
      placeholder: '70',
    },
    {
      key: 'bloodSugar',
      label: 'Blood Sugar',
      unit: 'mg/dL',
      icon: TrendingUp,
      placeholder: '100',
    },
  ] as const;

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ── Page Header ──────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-on-surface">
          Clinical Charting
        </h1>
        <p className="text-sm text-on-surface-variant">
          Record vitals, observations, and nursing notes for admitted patients
        </p>
      </div>

      {/* ── Patient Selector ─────────────────────────────────── */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {/* Search input */}
          <div className="flex-1">
            <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
              Search Patient
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
              <Input
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Search by name, MRN, UHID, IP number..."
                className="pl-9"
              />
            </div>
          </div>

          {/* Patient select */}
          <div className="flex-1">
            <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
              Select Patient
            </label>
            <Select
              value={selectedPatientId || undefined}
              onValueChange={(value) => setSelectedPatientId(value ?? '')}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose an admitted patient" />
              </SelectTrigger>
              <SelectContent>
                {admissionsLoading && (
                  <div className="p-3 text-center text-sm text-on-surface-variant">
                    Loading...
                  </div>
                )}
                {filteredAdmissions.map((a) => (
                  <SelectItem key={a.patientId} value={a.patientId}>
                    {a.patient?.firstName ?? ''} {a.patient?.lastName ?? ''}{' '}
                    {a.patient?.mrn ? `(${a.patient.mrn})` : ''}{' '}
                    {a.ipNumber ? `- IP: ${a.ipNumber}` : ''}{' '}
                    {a.ward?.name ? `- ${a.ward.name}` : ''}
                    {a.bed?.bedNumber ? ` / Bed ${a.bed.bedNumber}` : ''}
                  </SelectItem>
                ))}
                {!admissionsLoading && filteredAdmissions.length === 0 && (
                  <div className="p-3 text-center text-sm text-on-surface-variant">
                    No admitted patients found
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Selected patient info bar */}
        {selectedAdmission && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-primary/5 px-3 py-2 text-sm">
            <span className="font-medium text-on-surface">
              {selectedAdmission.patient?.firstName}{' '}
              {selectedAdmission.patient?.lastName}
            </span>
            {selectedAdmission.patient?.mrn && (
              <span className="text-on-surface-variant">
                MRN: {selectedAdmission.patient.mrn}
              </span>
            )}
            {selectedAdmission.ipNumber && (
              <span className="text-on-surface-variant">
                IP: {selectedAdmission.ipNumber}
              </span>
            )}
            {selectedAdmission.ward?.name && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {selectedAdmission.ward.name}
                {selectedAdmission.bed?.bedNumber &&
                  ` / Bed ${selectedAdmission.bed.bedNumber}`}
              </span>
            )}
            {selectedAdmission.doctor?.user && (
              <span className="text-on-surface-variant">
                Dr. {selectedAdmission.doctor.user.firstName}{' '}
                {selectedAdmission.doctor.user.lastName}
              </span>
            )}
            {selectedAdmission.diagnosis && (
              <span className="text-on-surface-variant">
                Dx: {selectedAdmission.diagnosis}
              </span>
            )}
            {selectedAdmission.patient?.allergies &&
              selectedAdmission.patient.allergies.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Allergies: {selectedAdmission.patient.allergies.join(', ')}
                </span>
              )}
          </div>
        )}
      </div>

      {!selectedPatientId && (
        <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
          <Activity className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">Select a patient to begin charting</p>
        </div>
      )}

      {selectedPatientId && (
        <>
          {/* ── Latest Vitals Summary ────────────────────────── */}
          {latestVitals && (
            <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
              <h2 className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-3">
                Latest Vitals
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {[
                  {
                    label: 'BP',
                    value:
                      latestVitals.bloodPressureSystolic != null
                        ? `${latestVitals.bloodPressureSystolic}/${latestVitals.bloodPressureDiastolic ?? '-'}`
                        : '-',
                    abnormal:
                      isBpSystolicAbnormal(
                        latestVitals.bloodPressureSystolic,
                      ) ||
                      isBpDiastolicAbnormal(
                        latestVitals.bloodPressureDiastolic,
                      ),
                    unit: 'mmHg',
                  },
                  {
                    label: 'Temp',
                    value: latestVitals.temperature ?? '-',
                    abnormal: isTempAbnormal(latestVitals.temperature),
                    unit: '\u00b0C',
                  },
                  {
                    label: 'Pulse',
                    value: latestVitals.pulseRate ?? '-',
                    abnormal: isPulseAbnormal(latestVitals.pulseRate),
                    unit: 'bpm',
                  },
                  {
                    label: 'SpO2',
                    value: latestVitals.oxygenSaturation ?? '-',
                    abnormal: isSpO2Abnormal(latestVitals.oxygenSaturation),
                    unit: '%',
                  },
                  {
                    label: 'RR',
                    value: latestVitals.respiratoryRate ?? '-',
                    abnormal: isRRAbnormal(latestVitals.respiratoryRate),
                    unit: '/min',
                  },
                  {
                    label: 'Weight',
                    value:
                      latestVitals.weightKg ?? latestVitals.weight ?? '-',
                    abnormal: false,
                    unit: 'kg',
                  },
                ].map((item) => (
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
                    <p className="text-[10px] text-on-surface-variant">
                      {item.unit}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-on-surface-variant">
                Recorded {formatDateTime(latestVitals.createdAt)}
              </p>
            </div>
          )}

          {/* ── Vitals Recording Form ────────────────────────── */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
            <h2 className="text-sm font-semibold text-on-surface mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Record Vitals
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {VITAL_FIELDS.map((field) => {
                const val =
                  vitalsForm[field.key as keyof typeof vitalsForm];
                const numVal = parseNum(val);
                const abnormal = isValueAbnormal(field.key, numVal);
                const Icon = field.icon;
                return (
                  <div key={field.key}>
                    <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 flex items-center gap-1">
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
                        onChange={(e) =>
                          handleVitalChange(field.key, e.target.value)
                        }
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
                    {abnormal && (
                      <p className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 mt-1 inline-block">
                        Abnormal — Normal: {NORMAL_RANGES[field.key]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Notes */}
            <div className="mt-4">
              <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                Notes
              </label>
              <Textarea
                value={vitalsForm.notes}
                onChange={(e) => handleVitalChange('notes', e.target.value)}
                placeholder="Additional observations..."
                rows={2}
              />
            </div>

            <div className="mt-4 flex justify-end">
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

          {/* ── Vital Trends (line charts with normal-range bands) ─── */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
            <h2 className="text-sm font-semibold text-on-surface mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Vital Trends — Last 7 Days
            </h2>

            {vitalsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : vitals.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-8">
                No vitals recorded yet
              </p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
                  normalRange={[36.1, 38.5]}
                />
                <VitalTrendChart
                  title="Pulse Rate"
                  unit="bpm"
                  points={trendSeries.pulse}
                  normalRange={[60, 100]}
                />
                <VitalTrendChart
                  title="SpO₂"
                  unit="%"
                  points={trendSeries.spo2}
                  normalRange={[95, 100]}
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

          {/* ── Vitals History Table ─────────────────────────── */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
            <h2 className="text-sm font-semibold text-on-surface mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Vitals History
            </h2>

            {vitalsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : vitals.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-8">
                No vitals recorded yet
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-outline-variant/30">
                      {[
                        'Date/Time',
                        'BP (mmHg)',
                        'Temp (\u00b0C)',
                        'Pulse (bpm)',
                        'RR (/min)',
                        'SpO2 (%)',
                        'Weight (kg)',
                        'Sugar (mg/dL)',
                        'Notes',
                        'Recorded By',
                      ].map((h) => (
                        <th
                          key={h}
                          className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant text-left py-2 px-2 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {vitals.slice(0, 20).map((v) => (
                      <tr key={v.id} className="hover:bg-surface-container-low/40">
                        <td className="py-2 px-2 text-xs whitespace-nowrap text-on-surface">
                          {formatDateTime(v.createdAt)}
                        </td>
                        <td className="py-2 px-2 text-xs">
                          {v.bloodPressureSystolic != null ? (
                            <span
                              className={cn(
                                isBpSystolicAbnormal(
                                  v.bloodPressureSystolic,
                                ) ||
                                  isBpDiastolicAbnormal(
                                    v.bloodPressureDiastolic,
                                  )
                                  ? 'text-red-600 font-semibold'
                                  : 'text-on-surface',
                              )}
                            >
                              {v.bloodPressureSystolic}/
                              {v.bloodPressureDiastolic ?? '-'}
                            </span>
                          ) : (
                            <span className="text-on-surface-variant/40">
                              --
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-xs">
                          {v.temperature != null ? (
                            <span
                              className={cn(
                                isTempAbnormal(v.temperature)
                                  ? 'text-red-600 font-semibold'
                                  : 'text-on-surface',
                              )}
                            >
                              {v.temperature}
                            </span>
                          ) : (
                            <span className="text-on-surface-variant/40">
                              --
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-xs">
                          {v.pulseRate != null ? (
                            <span
                              className={cn(
                                isPulseAbnormal(v.pulseRate)
                                  ? 'text-red-600 font-semibold'
                                  : 'text-on-surface',
                              )}
                            >
                              {v.pulseRate}
                            </span>
                          ) : (
                            <span className="text-on-surface-variant/40">
                              --
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-xs">
                          {v.respiratoryRate != null ? (
                            <span
                              className={cn(
                                isRRAbnormal(v.respiratoryRate)
                                  ? 'text-red-600 font-semibold'
                                  : 'text-on-surface',
                              )}
                            >
                              {v.respiratoryRate}
                            </span>
                          ) : (
                            <span className="text-on-surface-variant/40">
                              --
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-xs">
                          {v.oxygenSaturation != null ? (
                            <span
                              className={cn(
                                isSpO2Abnormal(v.oxygenSaturation)
                                  ? 'text-red-600 font-semibold'
                                  : 'text-on-surface',
                              )}
                            >
                              {v.oxygenSaturation}
                            </span>
                          ) : (
                            <span className="text-on-surface-variant/40">
                              --
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-xs text-on-surface">
                          {v.weightKg ?? v.weight ?? (
                            <span className="text-on-surface-variant/40">
                              --
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-xs text-on-surface">
                          {v.bloodSugar ?? (
                            <span className="text-on-surface-variant/40">
                              --
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-xs text-on-surface-variant max-w-[120px] truncate">
                          {v.notes || '--'}
                        </td>
                        <td className="py-2 px-2 text-xs text-on-surface-variant whitespace-nowrap">
                          {v.recordedBy ?? '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {vitals.length > 20 && (
                  <p className="text-[10px] text-on-surface-variant mt-2 text-center">
                    Showing 20 of {vitals.length} records
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Nursing Notes Tabs ───────────────────────────── */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
            <h2 className="text-sm font-semibold text-on-surface mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Nursing Notes
            </h2>

            {/* Tab bar */}
            <div className="flex gap-1 border-b border-outline-variant/30 mb-4 overflow-x-auto">
              {NOTE_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeNoteTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveNoteTab(tab.key)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors',
                      isActive
                        ? 'border-primary text-primary'
                        : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant/50',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Observations: structured pain/AVPU/condition/mobility + intake/output snapshot */}
            {activeNoteTab === 'observation' && (
              <ObservationsPanel
                patientId={selectedPatientId}
                admissionId={selectedAdmission?.id}
              />
            )}

            {/* Devices / Lines: ongoing items with periodic checks */}
            {activeNoteTab === 'devices' && (
              <ClinicalDevicesPanel
                patientId={selectedPatientId}
                admissionId={selectedAdmission?.id}
              />
            )}

            {/* Procedures: one-time clinical actions */}
            {activeNoteTab === 'procedures' && (
              <ProceduresPanel
                patientId={selectedPatientId}
                admissionId={selectedAdmission?.id}
              />
            )}

            {/* Wound Care: structured form + records list */}
            {activeNoteTab === 'wound_care' && (
              <WoundCarePanel
                patientId={selectedPatientId}
                admissionId={selectedAdmission?.id}
              />
            )}

            {/* IV Line: structured form + active lines */}
            {activeNoteTab === 'iv_line' && (
              <IvLinePanel
                patientId={selectedPatientId}
                admissionId={selectedAdmission?.id}
              />
            )}

            {/* Intake / Output: dual-entry + 24h summary */}
            {activeNoteTab === 'intake_output' && (
              <IntakeOutputPanel
                patientId={selectedPatientId}
                admissionId={selectedAdmission?.id}
              />
            )}

            {/* Daily Note: free-text */}
            {activeNoteTab === 'general' && (
              <>
                <div className="mb-4 rounded-lg border border-outline-variant/30 p-3">
                  <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                    New Daily Note
                  </label>
                  <p className="text-[10px] text-on-surface-variant mb-2">
                    Free-text shift note for anything not covered by structured tabs.
                  </p>
                  <Textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Enter note..."
                    rows={3}
                  />
                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleSubmitNote}
                      disabled={createNote.isPending || !noteContent.trim()}
                      className="gap-1.5"
                    >
                      {createNote.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      Add Note
                    </Button>
                  </div>
                </div>

                {notesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : notes.length === 0 ? (
                  <p className="text-sm text-on-surface-variant text-center py-8">
                    No daily notes recorded
                  </p>
                ) : (
                  <div className="space-y-2">
                    {notes.map((note) => (
                      <div
                        key={note.id}
                        className="rounded-lg border border-outline-variant/20 p-3 hover:bg-surface-container-low/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
                              {note.noteType?.replace('_', ' ') ?? 'note'}
                            </span>
                            {note.createdBy && (
                              <span className="text-[10px] text-on-surface-variant">
                                by {note.createdBy.firstName}{' '}
                                {note.createdBy.lastName}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-on-surface-variant whitespace-nowrap flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(note.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-on-surface whitespace-pre-wrap">
                          {note.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
