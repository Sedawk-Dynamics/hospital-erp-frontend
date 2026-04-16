'use client';

import { useState } from 'react';
import {
  Pill,
  Sun,
  Cloud,
  Sunset,
  Moon,
  AlertCircle,
  Clock,
  CalendarDays,
  ChevronDown,
  Stethoscope,
  FileText,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { usePatientProfileStore } from '@/stores/patient-profile-store';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { HospitalFilter } from '../_components/hospital-filter';
import { parseFrequencyToSchedule } from '@/components/doctor/consultation-completion';

interface PrescriptionItem {
  drugName?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
  route?: string;
  isPrn?: boolean;
}

interface Diagnosis {
  id: string;
  diagnosisName: string;
  icdCode?: string;
  diagnosisType?: string;
}

interface VitalRecord {
  temperature?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  pulseRate?: number;
  heartRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weightKg?: number;
  heightCm?: number;
  bloodSugar?: number;
}

interface ProgressNote {
  id: string;
  content?: string;
  createdAt: string;
}

interface PrescriptionData {
  id: string;
  status: string;
  createdAt: string;
  notes?: string;
  followUpDate?: string | null;
  doctor?: { user?: { firstName: string; lastName: string } };
  patient?: { tenant?: { id: string; name: string } };
  prescriptionItems?: PrescriptionItem[];
  visit?: {
    progressNotes?: ProgressNote[];
    diagnoses?: Diagnosis[];
    vitals?: VitalRecord[];
  };
}

/** Parse progress note markdown into sections */
function parseNoteContent(content?: string): Record<string, string> {
  if (!content) return {};
  const sections: Record<string, string> = {};
  const blocks = content.split(/\n\n/);
  let currentKey = '';
  for (const block of blocks) {
    const headerMatch = block.match(/^\*\*(.+?):\*\*\s*([\s\S]*)/);
    if (headerMatch) {
      currentKey = headerMatch[1].trim();
      sections[currentKey] = headerMatch[2]?.trim() || '';
    } else if (currentKey) {
      sections[currentKey] = (sections[currentKey] ? sections[currentKey] + '\n' : '') + block.trim();
    }
  }
  return sections;
}

export default function PatientPrescriptionsPage() {
  const [hospitalFilter, setHospitalFilter] = useState('');
  const { selectedProfileId } = usePatientProfileStore();

  const { data, isLoading } = useQuery({
    queryKey: ['patient', 'prescriptions', hospitalFilter, selectedProfileId],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 30 };
      if (hospitalFilter) params.tenantId = hospitalFilter;
      if (selectedProfileId) params.profileId = selectedProfileId;
      const res = await apiGet<PrescriptionData[]>('/patient-portal/prescriptions', { params });
      return res.data ?? [];
    },
  });

  const prescriptions = data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-2">
          Care Records
        </p>
        <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
          My Prescriptions
        </h1>
        <p className="font-label text-sm text-on-surface-variant mt-1.5">
          Medications, dosing schedules, and visit summaries from your doctors
        </p>
      </div>

      <HospitalFilter value={hospitalFilter} onChange={setHospitalFilter} />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : prescriptions.length === 0 ? (
        <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-10 text-center">
          <div className="w-12 h-12 mx-auto bg-surface-container-high rounded-full flex items-center justify-center text-outline mb-3">
            <Pill className="h-5 w-5" />
          </div>
          <p className="font-label text-sm font-semibold text-on-surface">No prescriptions found</p>
          <p className="font-label text-xs text-on-surface-variant mt-1">
            Prescriptions issued by your doctors will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {prescriptions.map((rx) => (
            <PrescriptionCard key={rx.id} prescription={rx} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Full Prescription Card with Visit Details ──────────────────

function PrescriptionCard({ prescription: rx }: { prescription: PrescriptionData }) {
  const [expanded, setExpanded] = useState(false);

  const progressNote = rx.visit?.progressNotes?.[0];
  const sections = parseNoteContent(progressNote?.content);
  const diagnoses = rx.visit?.diagnoses ?? [];
  const vitals = rx.visit?.vitals?.[0];

  const visitDetails: { label: string; content: React.ReactNode }[] = [];

  if (sections['Chief Complaint']) {
    visitDetails.push({
      label: 'Symptoms',
      content: <span className="text-[11px]">{sections['Chief Complaint']}</span>,
    });
  }

  if (sections['General Examination']) {
    visitDetails.push({
      label: 'Examination',
      content: <span className="text-[11px]">{sections['General Examination']}</span>,
    });
  }

  if (diagnoses.length > 0) {
    visitDetails.push({
      label: 'Diagnosis',
      content: (
        <div className="flex flex-wrap gap-1.5">
          {diagnoses.map((d, i) => (
            <span key={d.id || i} className="text-[11px]">
              {d.diagnosisName}
              {d.icdCode && <span className="text-on-surface-variant"> ({d.icdCode})</span>}
              {d.diagnosisType && (
                <span
                  className={cn(
                    'text-[9px] font-bold font-label px-1.5 py-0 rounded-full ml-1 capitalize',
                    d.diagnosisType === 'primary'
                      ? 'bg-error/10 text-error'
                      : 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
                  )}
                >
                  {d.diagnosisType}
                </span>
              )}
              {i < diagnoses.length - 1 && ','}
            </span>
          ))}
        </div>
      ),
    });
  } else if (sections['Diagnosis']) {
    visitDetails.push({
      label: 'Diagnosis',
      content: <DiagnosisText content={sections['Diagnosis']} />,
    });
  }

  if (vitals) {
    visitDetails.push({
      label: 'Vitals',
      content: <VitalsCompact vitals={vitals} />,
    });
  } else if (sections['Vitals']) {
    visitDetails.push({
      label: 'Vitals',
      content: <VitalsText content={sections['Vitals']} />,
    });
  }

  if (sections['Advice']) {
    visitDetails.push({
      label: 'Advice',
      content: <span className="text-[11px]">{sections['Advice']}</span>,
    });
  }

  if (sections['Referral']) {
    visitDetails.push({
      label: 'Referral',
      content: <span className="text-[11px]">{sections['Referral']}</span>,
    });
  }

  const hasVisitDetails = visitDetails.length > 0;

  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
          <Stethoscope className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-label text-sm font-bold text-on-surface">
            Dr. {rx.doctor?.user?.firstName} {rx.doctor?.user?.lastName}
          </p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className="font-label text-xs text-on-surface-variant">
              {formatDate(rx.createdAt)}
            </span>
            {rx.patient?.tenant?.name && (
              <>
                <span className="text-on-surface-variant">·</span>
                <span className="font-label text-xs text-on-surface-variant">
                  {rx.patient.tenant.name}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className={cn(
              'text-[10px] font-bold font-label px-2 py-0.5 rounded-full capitalize',
              rx.status === 'active' && 'bg-primary/10 text-primary',
              rx.status === 'dispensed' && 'bg-primary/10 text-primary',
              rx.status === 'completed' && 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
              rx.status === 'cancelled' && 'bg-error/10 text-error',
            )}
          >
            {rx.status}
          </span>
        </div>
      </div>

      {/* Medicines */}
      {rx.prescriptionItems && rx.prescriptionItems.length > 0 && (
        <div className="border-t border-outline-variant/30 px-5 py-4 space-y-3">
          <p className="font-label text-[10px] font-bold uppercase tracking-widest text-primary">
            Medicines ({rx.prescriptionItems.length})
          </p>
          {rx.prescriptionItems.map((item, i) => (
            <MedicineScheduleCard key={i} item={item} index={i + 1} />
          ))}
        </div>
      )}

      {/* Visit Details Toggle */}
      {hasVisitDetails && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-center gap-1.5 border-t border-outline-variant/30 px-5 py-2 font-label text-xs font-bold text-primary hover:bg-surface-container-low transition-colors"
          >
            <FileText className="h-3 w-3" />
            {expanded ? 'Hide Visit Details' : 'View Visit Details'}
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')}
            />
          </button>

          {expanded && (
            <div className="border-t border-outline-variant/30 divide-y divide-surface-container/50">
              {visitDetails.map((item) => (
                <div key={item.label} className="px-5 py-2.5">
                  <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    {item.label}
                  </span>
                  <div className="mt-0.5 text-on-surface leading-relaxed">{item.content}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Follow-up Banner */}
      <FollowUpBanner prescription={rx} />
    </div>
  );
}

// ── Medicine Schedule Card ─────────────────────────────────

const TIMING_SLOTS = [
  { key: 'morning', label: 'Morning', icon: Sun, time: '8:00 AM' },
  { key: 'afternoon', label: 'Afternoon', icon: Cloud, time: '1:00 PM' },
  { key: 'evening', label: 'Evening', icon: Sunset, time: '6:00 PM' },
  { key: 'night', label: 'Night', icon: Moon, time: '10:00 PM' },
] as const;

function MedicineScheduleCard({ item, index }: { item: PrescriptionItem; index: number }) {
  const schedule = parseFrequencyToSchedule(item.frequency || '');
  const hasStructuredSchedule =
    schedule.morning || schedule.afternoon || schedule.evening || schedule.night || schedule.isPrn;

  return (
    <div className="rounded-xl bg-surface-container-low p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0 mt-0.5">
            <span className="font-label text-xs font-bold">{index}</span>
          </div>
          <div>
            <p className="font-label text-sm font-bold text-on-surface">{item.drugName}</p>
            {item.dosage && (
              <p className="font-label text-xs text-primary font-bold">{item.dosage}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.duration && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold font-label">
              <Clock className="h-2.5 w-2.5" />
              {item.duration}
            </span>
          )}
          {item.route && item.route !== 'oral' && (
            <span className="rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant px-2 py-0.5 text-[10px] font-bold font-label capitalize">
              {item.route}
            </span>
          )}
        </div>
      </div>

      {schedule.isPrn ? (
        <div className="flex items-center gap-2 rounded-lg bg-secondary-fixed/50 border-l-4 border-secondary px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 text-secondary" />
          <span className="font-label text-xs font-bold text-on-surface">
            Take as needed (SOS)
          </span>
        </div>
      ) : hasStructuredSchedule ? (
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-2">
            {TIMING_SLOTS.map((slot) => {
              const SlotIcon = slot.icon;
              const isActive = schedule[slot.key as keyof typeof schedule] as boolean;
              return (
                <div
                  key={slot.key}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg p-2 text-center transition-colors',
                    isActive
                      ? 'bg-primary/10'
                      : 'bg-surface-container opacity-50',
                  )}
                >
                  <SlotIcon
                    className={cn(
                      'h-4 w-4',
                      isActive ? 'text-primary' : 'text-on-surface-variant',
                    )}
                  />
                  <span
                    className={cn(
                      'font-label text-[10px] font-bold',
                      isActive ? 'text-on-surface' : 'text-on-surface-variant',
                    )}
                  >
                    {slot.label}
                  </span>
                  {isActive && (
                    <span className="font-label text-[9px] text-on-surface-variant">
                      {slot.time}
                    </span>
                  )}
                  {isActive && item.dosage && (
                    <span className="inline-flex items-center justify-center rounded bg-primary text-white px-1.5 py-0.5 text-[9px] font-bold font-label">
                      {item.dosage}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {schedule.mealRelation && (
            <div className="flex items-center justify-center">
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 text-secondary px-3 py-0.5 text-[10px] font-bold font-label">
                {schedule.mealRelation}
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="font-label text-xs text-on-surface-variant">
          {[item.dosage, item.frequency, item.duration].filter(Boolean).join(' · ')}
        </p>
      )}

      {item.instructions && (
        <p className="font-label text-xs text-on-surface-variant italic border-t border-outline-variant/30 pt-2">
          {item.instructions}
        </p>
      )}
    </div>
  );
}

// ── Compact Vitals Display ────────────────────────────────────

function VitalsCompact({ vitals }: { vitals: VitalRecord }) {
  const items: { label: string; value: string }[] = [];
  if (vitals.temperature) items.push({ label: 'Temp', value: `${vitals.temperature}°F` });
  if (vitals.bloodPressureSystolic || vitals.bloodPressureDiastolic) {
    items.push({
      label: 'BP',
      value: `${vitals.bloodPressureSystolic || '-'}/${vitals.bloodPressureDiastolic || '-'} mmHg`,
    });
  }
  if (vitals.pulseRate || vitals.heartRate)
    items.push({ label: 'Pulse', value: `${vitals.pulseRate || vitals.heartRate} bpm` });
  if (vitals.oxygenSaturation) items.push({ label: 'SpO2', value: `${vitals.oxygenSaturation}%` });
  if (vitals.weightKg) items.push({ label: 'Weight', value: `${vitals.weightKg} kg` });
  if (vitals.bloodSugar) items.push({ label: 'Sugar', value: `${vitals.bloodSugar} mg/dL` });

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-0.5">
      {items.map((item) => (
        <span key={item.label} className="text-[11px]">
          <span className="text-on-surface-variant">{item.label}:</span>{' '}
          <span className="font-bold">{item.value}</span>
        </span>
      ))}
    </div>
  );
}

function VitalsText({ content }: { content: string }) {
  const lines = content.split('\n').filter((l) => l.trim());
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-0.5">
      {lines.map((line, idx) => {
        const [label, value] = line.split(':').map((s) => s.trim());
        return (
          <span key={idx} className="text-[11px]">
            <span className="text-on-surface-variant">{label}:</span>{' '}
            <span className="font-bold">{value}</span>
          </span>
        );
      })}
    </div>
  );
}

function DiagnosisText({ content }: { content: string }) {
  const lines = content.split('\n').filter((l) => l.trim().startsWith('-'));
  if (lines.length === 0) return <span className="text-[11px]">{content}</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {lines.map((line, idx) => {
        const cleaned = line.replace(/^-\s*/, '');
        const typeMatch = cleaned.match(/\[(\w+)\]$/);
        const diagType = typeMatch?.[1];
        const nameOnly = cleaned.replace(/\s*\[\w+\]\s*$/, '');

        return (
          <span key={idx} className="text-[11px]">
            {nameOnly}
            {diagType && (
              <span
                className={cn(
                  'text-[9px] font-bold font-label px-1.5 py-0 rounded-full ml-1 capitalize',
                  diagType === 'primary'
                    ? 'bg-error/10 text-error'
                    : 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
                )}
              >
                {diagType}
              </span>
            )}
            {idx < lines.length - 1 && ','}
          </span>
        );
      })}
    </div>
  );
}

// ── Follow-up Banner ──────────────────────────────────────────

function FollowUpBanner({ prescription }: { prescription: PrescriptionData }) {
  const followUpDate = prescription.followUpDate || undefined;
  if (!followUpDate) return null;

  const dateObj = new Date(followUpDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dateObj.setHours(0, 0, 0, 0);
  const diffDays = Math.round((dateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const isPast = diffDays < 0;
  const isToday = diffDays === 0;
  const isSoon = diffDays > 0 && diffDays <= 3;

  const displayDate = dateObj.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  let statusLabel = `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  if (isToday) statusLabel = 'Today';
  else if (isPast)
    statusLabel = `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} overdue`;
  else if (diffDays === 1) statusLabel = 'Tomorrow';

  const bgClass = isPast
    ? 'bg-error-container/40'
    : isToday
      ? 'bg-secondary-fixed/50'
      : isSoon
        ? 'bg-secondary-fixed/30'
        : 'bg-primary-fixed/30';

  const iconClass = isPast
    ? 'text-error'
    : isToday
      ? 'text-secondary'
      : isSoon
        ? 'text-secondary'
        : 'text-primary';

  const chipClass = isPast
    ? 'bg-error/10 text-error'
    : isToday
      ? 'bg-secondary/10 text-secondary'
      : isSoon
        ? 'bg-secondary/10 text-secondary'
        : 'bg-primary/10 text-primary';

  return (
    <div
      className={cn(
        'flex items-center gap-3 border-t border-outline-variant/30 px-5 py-3',
        bgClass,
      )}
    >
      <CalendarDays className={cn('h-4 w-4 shrink-0', iconClass)} />
      <div className="flex-1 min-w-0">
        <p className="font-label text-xs font-bold text-on-surface">
          Follow-up: {displayDate}
          <span
            className={cn(
              'ml-2 text-[9px] font-bold font-label px-1.5 py-0.5 rounded-full capitalize',
              chipClass,
            )}
          >
            {statusLabel}
          </span>
        </p>
      </div>
      {!isPast && (
        <Link href="/patient-portal/book-appointment">
          <Button size="sm" variant="outline" className="text-xs gap-1 shrink-0">
            <CalendarDays className="h-3 w-3" />
            Book Now
          </Button>
        </Link>
      )}
    </div>
  );
}
