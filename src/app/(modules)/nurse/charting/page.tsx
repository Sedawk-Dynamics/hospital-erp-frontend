'use client';

import { useState, useMemo } from 'react';
import { formatDateTime, formatDate, formatTime } from '@/lib/date-utils';
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
  useNurseAdmissions,
  usePatientVitals,
  useLatestVitals,
  useRecordVitals,
  useNursingNotes,
  useCreateNursingNote,
  type NurseAdmission,
  type Vital,
  type NursingNote,
} from '@/hooks/use-nurse';
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
  { key: 'wound_care', label: 'Wound Care', icon: FileText },
  { key: 'iv_line', label: 'IV Line', icon: Syringe },
  { key: 'intake_output', label: 'Intake / Output', icon: GlassWater },
] as const;

type NoteTabKey = (typeof NOTE_TABS)[number]['key'];

// ── Component ──────────────────────────────────────────────

export default function ClinicalChartingPage() {
  const user = useAuthStore((s) => s.user);

  // Patient selector state
  const [selectedPatientId, setSelectedPatientId] = useState('');
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

  // Find selected admission
  const selectedAdmission = useMemo(
    () => admissions.find((a) => a.patientId === selectedPatientId),
    [admissions, selectedPatientId],
  );

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

  const { data: notesRaw, isLoading: notesLoading } = useNursingNotes({
    patientId: selectedPatientId || undefined,
    noteType: activeNoteTab,
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
  const formsTrigger = useActionFormsTrigger();
  const createNote = useCreateNursingNote();

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

    const payload = {
      patientId: selectedPatientId,
      admissionId: selectedAdmission?.id,
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
        // Fire any forms assigned to vital_signs_entry trigger
        formsTrigger.fire('vital_signs_entry', undefined, {
          patientId: selectedPatientId,
          admissionId: selectedAdmission?.id,
        });
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

  // ── Trends data (group vitals by date, last 7 days) ───────

  const trendsData = useMemo(() => {
    if (!vitals.length) return [];
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Group by date string
    const byDate = new Map<string, Vital[]>();
    for (const v of vitals) {
      const d = new Date(v.createdAt);
      if (d < sevenDaysAgo) continue;
      const dateKey = formatDate(v.createdAt);
      const existing = byDate.get(dateKey) ?? [];
      existing.push(v);
      byDate.set(dateKey, existing);
    }

    // Build columns — last 7 calendar days
    const columns: {
      date: string;
      bp?: string;
      bpAbnormal?: boolean;
      temp?: number;
      tempAbnormal?: boolean;
      pulse?: number;
      pulseAbnormal?: boolean;
      spo2?: number;
      spo2Abnormal?: boolean;
      rr?: number;
      rrAbnormal?: boolean;
    }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateKey = formatDate(d);
      const dayVitals = byDate.get(dateKey);

      if (dayVitals && dayVitals.length > 0) {
        // Use latest reading of the day
        const latest = dayVitals[0];
        const sys = latest.bloodPressureSystolic;
        const dia = latest.bloodPressureDiastolic;
        columns.push({
          date: dateKey,
          bp:
            sys != null && dia != null
              ? `${sys}/${dia}`
              : sys != null
                ? `${sys}/-`
                : undefined,
          bpAbnormal: isBpSystolicAbnormal(sys) || isBpDiastolicAbnormal(dia),
          temp: latest.temperature,
          tempAbnormal: isTempAbnormal(latest.temperature),
          pulse: latest.pulseRate,
          pulseAbnormal: isPulseAbnormal(latest.pulseRate),
          spo2: latest.oxygenSaturation,
          spo2Abnormal: isSpO2Abnormal(latest.oxygenSaturation),
          rr: latest.respiratoryRate,
          rrAbnormal: isRRAbnormal(latest.respiratoryRate),
        });
      } else {
        columns.push({ date: dateKey });
      }
    }
    return columns;
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

          {/* ── Vital Trends (7-day grid) ────────────────────── */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
            <h2 className="text-sm font-semibold text-on-surface mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Vital Trends — Last 7 Days
            </h2>

            {vitalsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : trendsData.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-8">
                No vitals recorded in the last 7 days
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant text-left py-2 pr-4 w-28">
                        Parameter
                      </th>
                      {trendsData.map((col) => (
                        <th
                          key={col.date}
                          className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant text-center py-2 px-2 min-w-[72px]"
                        >
                          {col.date.slice(0, 5)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {/* BP Row */}
                    <tr>
                      <td className="py-2 pr-4 text-xs font-medium text-on-surface">
                        <div className="flex items-center gap-1.5">
                          <Activity className="h-3 w-3 text-on-surface-variant" />
                          BP
                        </div>
                        <span className="text-[9px] text-on-surface-variant block">
                          {NORMAL_RANGES.bloodPressureSystolic}
                        </span>
                      </td>
                      {trendsData.map((col) => (
                        <td key={col.date} className="text-center py-2 px-2">
                          {col.bp ? (
                            <span
                              className={cn(
                                'text-xs font-medium px-1.5 py-0.5 rounded',
                                col.bpAbnormal
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-emerald-50 text-emerald-700',
                              )}
                            >
                              {col.bp}
                            </span>
                          ) : (
                            <span className="text-on-surface-variant/40">
                              --
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* Temp Row */}
                    <tr>
                      <td className="py-2 pr-4 text-xs font-medium text-on-surface">
                        <div className="flex items-center gap-1.5">
                          <Thermometer className="h-3 w-3 text-on-surface-variant" />
                          Temp
                        </div>
                        <span className="text-[9px] text-on-surface-variant block">
                          {NORMAL_RANGES.temperature}
                        </span>
                      </td>
                      {trendsData.map((col) => (
                        <td key={col.date} className="text-center py-2 px-2">
                          {col.temp != null ? (
                            <span
                              className={cn(
                                'text-xs font-medium px-1.5 py-0.5 rounded',
                                col.tempAbnormal
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-emerald-50 text-emerald-700',
                              )}
                            >
                              {col.temp}
                            </span>
                          ) : (
                            <span className="text-on-surface-variant/40">
                              --
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* Pulse Row */}
                    <tr>
                      <td className="py-2 pr-4 text-xs font-medium text-on-surface">
                        <div className="flex items-center gap-1.5">
                          <Heart className="h-3 w-3 text-on-surface-variant" />
                          Pulse
                        </div>
                        <span className="text-[9px] text-on-surface-variant block">
                          {NORMAL_RANGES.pulseRate}
                        </span>
                      </td>
                      {trendsData.map((col) => (
                        <td key={col.date} className="text-center py-2 px-2">
                          {col.pulse != null ? (
                            <span
                              className={cn(
                                'text-xs font-medium px-1.5 py-0.5 rounded',
                                col.pulseAbnormal
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-emerald-50 text-emerald-700',
                              )}
                            >
                              {col.pulse}
                            </span>
                          ) : (
                            <span className="text-on-surface-variant/40">
                              --
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* SpO2 Row */}
                    <tr>
                      <td className="py-2 pr-4 text-xs font-medium text-on-surface">
                        <div className="flex items-center gap-1.5">
                          <Droplets className="h-3 w-3 text-on-surface-variant" />
                          SpO2
                        </div>
                        <span className="text-[9px] text-on-surface-variant block">
                          {NORMAL_RANGES.oxygenSaturation}
                        </span>
                      </td>
                      {trendsData.map((col) => (
                        <td key={col.date} className="text-center py-2 px-2">
                          {col.spo2 != null ? (
                            <span
                              className={cn(
                                'text-xs font-medium px-1.5 py-0.5 rounded',
                                col.spo2Abnormal
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-emerald-50 text-emerald-700',
                              )}
                            >
                              {col.spo2}
                            </span>
                          ) : (
                            <span className="text-on-surface-variant/40">
                              --
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* RR Row */}
                    <tr>
                      <td className="py-2 pr-4 text-xs font-medium text-on-surface">
                        <div className="flex items-center gap-1.5">
                          <Wind className="h-3 w-3 text-on-surface-variant" />
                          RR
                        </div>
                        <span className="text-[9px] text-on-surface-variant block">
                          {NORMAL_RANGES.respiratoryRate}
                        </span>
                      </td>
                      {trendsData.map((col) => (
                        <td key={col.date} className="text-center py-2 px-2">
                          {col.rr != null ? (
                            <span
                              className={cn(
                                'text-xs font-medium px-1.5 py-0.5 rounded',
                                col.rrAbnormal
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-emerald-50 text-emerald-700',
                              )}
                            >
                              {col.rr}
                            </span>
                          ) : (
                            <span className="text-on-surface-variant/40">
                              --
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
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

            {/* Add note form */}
            <div className="mb-4 rounded-lg border border-outline-variant/30 p-3">
              <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                New{' '}
                {NOTE_TABS.find((t) => t.key === activeNoteTab)?.label ?? ''}{' '}
                Note
              </label>

              {activeNoteTab === 'intake_output' && (
                <p className="text-[10px] text-on-surface-variant mb-2">
                  Document intake (oral, IV fluids) and output (urine, drain,
                  emesis) volumes with timestamps.
                </p>
              )}
              {activeNoteTab === 'wound_care' && (
                <p className="text-[10px] text-on-surface-variant mb-2">
                  Document wound location, size, appearance, drainage,
                  dressing changes, and healing progress.
                </p>
              )}
              {activeNoteTab === 'iv_line' && (
                <p className="text-[10px] text-on-surface-variant mb-2">
                  Document IV site, gauge, insertion date, patency, dressing
                  condition, and any complications.
                </p>
              )}
              {activeNoteTab === 'observation' && (
                <p className="text-[10px] text-on-surface-variant mb-2">
                  General nursing observations, patient condition, pain
                  assessment, mobility status, etc.
                </p>
              )}

              <Textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder={`Enter ${NOTE_TABS.find((t) => t.key === activeNoteTab)?.label?.toLowerCase() ?? ''} note...`}
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

            {/* Notes list */}
            {notesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : notes.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-8">
                No{' '}
                {NOTE_TABS.find((t) => t.key === activeNoteTab)?.label?.toLowerCase() ??
                  ''}{' '}
                notes recorded
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
          </div>
        </>
      )}

      {/* Forms assigned to vital_signs_entry trigger fire after recording vitals */}
      <IntakeFormsModal
        open={formsTrigger.isOpen}
        trigger="vital_signs_entry"
        tenantId={formsTrigger.tenantId}
        context={formsTrigger.context}
        onComplete={formsTrigger.close}
      />

      {/* Forms assigned by admin to nurse_charting view location appear here */}
      <PatientFormSubmissionsPanel
        title="Nurse Forms Submissions"
        viewLocation="nurse_charting"
        patientId={selectedPatientId || undefined}
      />
    </div>
  );
}
