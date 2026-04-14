'use client';

import { useState } from 'react';
import {
  Pill, Sun, Cloud, Sunset, Moon, AlertCircle, Clock, CalendarDays,
  ChevronDown, Stethoscope, Activity, Thermometer, Heart, Droplets,
  Weight, FileText,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

  const { data, isLoading } = useQuery({
    queryKey: ['patient', 'prescriptions', hospitalFilter],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 30 };
      if (hospitalFilter) params.tenantId = hospitalFilter;
      const res = await apiGet<PrescriptionData[]>('/patient-portal/prescriptions', { params });
      return res.data ?? [];
    },
  });

  const prescriptions = data ?? [];

  return (
    <div className="space-y-5 animate-fade-in-up">
      <h1 className="text-xl font-bold text-foreground">My Prescriptions</h1>

      <HospitalFilter value={hospitalFilter} onChange={setHospitalFilter} />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : prescriptions.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <Pill className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No prescriptions found</p>
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

  // Parse visit data
  const progressNote = rx.visit?.progressNotes?.[0];
  const sections = parseNoteContent(progressNote?.content);
  const diagnoses = rx.visit?.diagnoses ?? [];
  const vitals = rx.visit?.vitals?.[0];

  // Build visit detail items
  const visitDetails: { label: string; color: string; content: React.ReactNode }[] = [];

  if (sections['Chief Complaint']) {
    visitDetails.push({
      label: 'Symptoms',
      color: 'text-blue-600',
      content: <span className="text-[11px]">{sections['Chief Complaint']}</span>,
    });
  }

  if (sections['General Examination']) {
    visitDetails.push({
      label: 'Examination',
      color: 'text-teal-600',
      content: <span className="text-[11px]">{sections['General Examination']}</span>,
    });
  }

  // Diagnoses
  if (diagnoses.length > 0) {
    visitDetails.push({
      label: 'Diagnosis',
      color: 'text-red-600',
      content: (
        <div className="flex flex-wrap gap-1.5">
          {diagnoses.map((d, i) => (
            <span key={d.id || i} className="text-[11px]">
              {d.diagnosisName}
              {d.icdCode && <span className="text-muted-foreground"> ({d.icdCode})</span>}
              {d.diagnosisType && (
                <Badge variant="outline" className={cn(
                  'text-[8px] px-1 py-0 capitalize ml-1',
                  d.diagnosisType === 'primary' ? 'border-red-300 text-red-600' : 'border-gray-300 text-gray-500',
                )}>
                  {d.diagnosisType}
                </Badge>
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
      color: 'text-red-600',
      content: <DiagnosisText content={sections['Diagnosis']} />,
    });
  }

  // Vitals
  if (vitals) {
    visitDetails.push({
      label: 'Vitals',
      color: 'text-orange-600',
      content: <VitalsCompact vitals={vitals} />,
    });
  } else if (sections['Vitals']) {
    visitDetails.push({
      label: 'Vitals',
      color: 'text-orange-600',
      content: <VitalsText content={sections['Vitals']} />,
    });
  }

  // Advice
  if (sections['Advice']) {
    visitDetails.push({
      label: 'Advice',
      color: 'text-purple-600',
      content: <span className="text-[11px]">{sections['Advice']}</span>,
    });
  }

  // Referral
  if (sections['Referral']) {
    visitDetails.push({
      label: 'Referral',
      color: 'text-indigo-600',
      content: <span className="text-[11px]">{sections['Referral']}</span>,
    });
  }

  const hasVisitDetails = visitDetails.length > 0;

  return (
    <div className="rounded-xl border bg-card overflow-hidden transition-colors hover:border-primary/20">
      {/* ── Header: Doctor + Date + Status ── */}
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
          <Stethoscope className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Dr. {rx.doctor?.user?.firstName} {rx.doctor?.user?.lastName}
          </p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className="text-xs text-muted-foreground">{formatDate(rx.createdAt)}</span>
            {rx.patient?.tenant?.name && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">{rx.patient.tenant.name}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge className={cn(
            'text-[10px] capitalize',
            rx.status === 'active' && 'bg-green-100 text-green-800',
            rx.status === 'dispensed' && 'bg-blue-100 text-blue-800',
            rx.status === 'completed' && 'bg-gray-100 text-gray-800',
            rx.status === 'cancelled' && 'bg-red-100 text-red-800',
          )}>
            {rx.status}
          </Badge>
        </div>
      </div>

      {/* ── Medicines ── */}
      {rx.prescriptionItems && rx.prescriptionItems.length > 0 && (
        <div className="border-t px-5 py-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
            Medicines ({rx.prescriptionItems.length})
          </p>
          {rx.prescriptionItems.map((item, i) => (
            <MedicineScheduleCard key={i} item={item} index={i + 1} />
          ))}
        </div>
      )}

      {/* ── Visit Details Toggle ── */}
      {hasVisitDetails && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-center gap-1.5 border-t px-5 py-2 text-xs font-medium text-primary hover:bg-muted/30 transition-colors"
          >
            <FileText className="h-3 w-3" />
            {expanded ? 'Hide Visit Details' : 'View Visit Details'}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
          </button>

          {expanded && (
            <div className="border-t divide-y">
              {visitDetails.map((item) => (
                <div key={item.label} className="px-5 py-2.5">
                  <span className={cn('text-[10px] font-bold uppercase tracking-wide', item.color)}>
                    {item.label}
                  </span>
                  <div className="mt-0.5 text-foreground/80 leading-relaxed">{item.content}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Follow-up Banner ── */}
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
  const hasStructuredSchedule = schedule.morning || schedule.afternoon || schedule.evening || schedule.night || schedule.isPrn;

  return (
    <div className="rounded-lg border bg-background p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0 mt-0.5">
            <span className="text-xs font-bold">{index}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{item.drugName}</p>
            {item.dosage && (
              <p className="text-xs text-primary font-medium">{item.dosage}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.duration && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
              <Clock className="h-2.5 w-2.5" />
              {item.duration}
            </span>
          )}
          {item.route && item.route !== 'oral' && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
              {item.route}
            </span>
          )}
        </div>
      </div>

      {schedule.isPrn ? (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-xs font-semibold text-amber-700">Take as needed (SOS)</span>
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
                    'flex flex-col items-center gap-1 rounded-lg p-2 border text-center transition-colors',
                    isActive
                      ? 'bg-primary/5 border-primary/30'
                      : 'bg-muted/30 border-transparent opacity-40',
                  )}
                >
                  <SlotIcon className={cn('h-4 w-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
                  <span className={cn('text-[10px] font-semibold', isActive ? 'text-foreground' : 'text-muted-foreground')}>
                    {slot.label}
                  </span>
                  {isActive && (
                    <span className="text-[9px] text-muted-foreground">{slot.time}</span>
                  )}
                  {isActive && item.dosage && (
                    <span className="inline-flex items-center justify-center rounded bg-primary text-primary-foreground px-1.5 py-0.5 text-[9px] font-bold">
                      {item.dosage}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {schedule.mealRelation && (
            <div className="flex items-center justify-center">
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200 px-2.5 py-0.5 text-[10px] font-semibold text-orange-700">
                {schedule.mealRelation}
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {[item.dosage, item.frequency, item.duration].filter(Boolean).join(' · ')}
        </p>
      )}

      {item.instructions && (
        <p className="text-xs text-muted-foreground italic border-t pt-2">
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
    items.push({ label: 'BP', value: `${vitals.bloodPressureSystolic || '-'}/${vitals.bloodPressureDiastolic || '-'} mmHg` });
  }
  if (vitals.pulseRate || vitals.heartRate) items.push({ label: 'Pulse', value: `${vitals.pulseRate || vitals.heartRate} bpm` });
  if (vitals.oxygenSaturation) items.push({ label: 'SpO2', value: `${vitals.oxygenSaturation}%` });
  if (vitals.weightKg) items.push({ label: 'Weight', value: `${vitals.weightKg} kg` });
  if (vitals.bloodSugar) items.push({ label: 'Sugar', value: `${vitals.bloodSugar} mg/dL` });

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-0.5">
      {items.map((item) => (
        <span key={item.label} className="text-[11px]">
          <span className="text-muted-foreground">{item.label}:</span>{' '}
          <span className="font-semibold">{item.value}</span>
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
            <span className="text-muted-foreground">{label}:</span> <span className="font-semibold">{value}</span>
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
              <Badge variant="outline" className={cn(
                'text-[8px] px-1 py-0 capitalize ml-1',
                diagType === 'primary' ? 'border-red-300 text-red-600' : 'border-gray-300 text-gray-500',
              )}>
                {diagType}
              </Badge>
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
  let followUpDate: string | undefined;
  let followUpNotes = '';

  if (prescription.notes) {
    const match = prescription.notes.match(/Follow-up:\s*(.+)/i);
    if (match) {
      const dateMatch = match[1].match(/(\d{1,2}\s+\w+\s+\d{4}|\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        const parsed = new Date(dateMatch[1]);
        if (!isNaN(parsed.getTime())) {
          followUpDate = parsed.toISOString().split('T')[0];
        }
      }
      const notesParts = match[1].split('—').map((s: string) => s.trim());
      followUpNotes = notesParts.filter((p: string) => !p.match(/\d{4}/) && !p.match(/^After\s/i)).join(' ').trim();
    }
  }

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
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });

  let statusLabel = `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  if (isToday) statusLabel = 'Today';
  else if (isPast) statusLabel = `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} overdue`;
  else if (diffDays === 1) statusLabel = 'Tomorrow';

  return (
    <div
      className={cn(
        'flex items-center gap-3 border-t px-5 py-3',
        isPast && 'bg-red-50',
        isToday && 'bg-orange-50',
        isSoon && 'bg-amber-50',
        !isPast && !isToday && !isSoon && 'bg-blue-50',
      )}
    >
      <CalendarDays className={cn(
        'h-4 w-4 shrink-0',
        isPast ? 'text-red-500' : isToday ? 'text-orange-600' : isSoon ? 'text-amber-600' : 'text-blue-600',
      )} />
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-xs font-bold',
          isPast ? 'text-red-800' : isToday ? 'text-orange-800' : isSoon ? 'text-amber-800' : 'text-blue-800',
        )}>
          Follow-up: {displayDate}
          <Badge className={cn(
            'ml-2 text-[9px] px-1.5 py-0',
            isPast ? 'bg-red-100 text-red-700' : isToday ? 'bg-orange-100 text-orange-700' : isSoon ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700',
          )}>
            {statusLabel}
          </Badge>
        </p>
        {followUpNotes && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{followUpNotes}</p>
        )}
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
