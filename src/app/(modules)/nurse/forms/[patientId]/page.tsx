'use client';

// /nurse/forms/[patientId] — per-patient form workspace.
// Tabs across the six form types. Each tab shows the running history table
// plus a "+ New" button that opens the matching dialog. The visit/admission
// id from the query string scopes new entries to the current encounter.

import { use, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ClipboardList,
  Droplets,
  FileText,
  HeartPulse,
  Loader2,
  Plus,
  ShieldAlert,
  Stethoscope,
  Bandage,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { usePatientDetail } from '@/hooks/use-doctor';
import {
  useAdmissionAssessments,
  usePainAssessments,
  useFallRiskAssessments,
  useIntakeOutputRecords,
  useWoundCareRecords,
  useNursingNotes,
  type FallRiskLevel,
} from '@/hooks/use-nursing-forms';
import {
  AdmissionAssessmentDialog,
  PainAssessmentDialog,
  FallRiskDialog,
  IntakeOutputDialog,
  WoundCareDialog,
  NursingNoteDialog,
  type FormDialogContext,
} from '@/components/nurse/nursing-form-dialogs';

const FALL_RISK_BG: Record<FallRiskLevel, string> = {
  low: 'bg-emerald-100 text-emerald-700',
  moderate: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
};

function nurseName(n?: { firstName: string; lastName: string | null } | null) {
  if (!n) return '—';
  return `${n.firstName} ${n.lastName ?? ''}`.trim();
}

function EmptyRow({ label }: { label: string }) {
  return (
    <p className="py-6 text-center text-xs text-muted-foreground">{label}</p>
  );
}

function SectionHeader({
  title,
  subtitle,
  onNew,
  count,
}: {
  title: string;
  subtitle?: string;
  onNew: () => void;
  count?: number;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        <p className="text-sm font-semibold text-foreground">
          {title}
          {typeof count === 'number' && (
            <span className="ml-2 text-[10px] font-bold rounded-full bg-primary/10 text-primary px-1.5 py-0.5">
              {count}
            </span>
          )}
        </p>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
      <Button size="sm" onClick={onNew} className="h-8 gap-1">
        <Plus className="h-3.5 w-3.5" />
        New
      </Button>
    </div>
  );
}

export default function NursePatientFormsPage(props: { params: Promise<{ patientId: string }> }) {
  const router = useRouter();
  const { patientId } = use(props.params);
  const searchParams = useSearchParams();
  const visitId = searchParams.get('visitId') ?? undefined;
  const admissionId = searchParams.get('admissionId') ?? undefined;

  const { data: patient, isLoading: patientLoading } = usePatientDetail(patientId);

  const dialogCtx: FormDialogContext = {
    patientId,
    visitId,
    admissionId,
  };

  // Lists per form type
  const admissions = useAdmissionAssessments({ patientId, limit: 20 });
  const pains = usePainAssessments({ patientId, limit: 50 });
  const falls = useFallRiskAssessments({ patientId, limit: 20 });
  const ios = useIntakeOutputRecords({ patientId, limit: 100 });
  const wounds = useWoundCareRecords({ patientId, limit: 30 });
  const notes = useNursingNotes({ patientId, limit: 50 });

  // Open-state per dialog
  const [openAdmission, setOpenAdmission] = useState(false);
  const [openPain, setOpenPain] = useState(false);
  const [openFall, setOpenFall] = useState(false);
  const [openIO, setOpenIO] = useState(false);
  const [openWound, setOpenWound] = useState(false);
  const [openNote, setOpenNote] = useState(false);

  if (patientLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/nurse/forms')} className="gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
        <p className="text-sm text-muted-foreground">Patient not found.</p>
      </div>
    );
  }

  const initials = `${patient.firstName?.[0] ?? ''}${patient.lastName?.[0] ?? ''}`.toUpperCase();
  const fullName = `${patient.firstName} ${patient.lastName ?? ''}`.trim();
  const hasContext = !!(visitId || admissionId);

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/nurse/forms')}
          className="h-8 gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Patients
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {initials || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{fullName}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {[patient.mrn ? `MRN ${patient.mrn}` : null, patient.gender, patient.phone]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>
      </div>

      {!hasContext && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          No active visit/admission was selected. Pick a patient from the list so the entry is bound
          to the right encounter.
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="admission">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="admission" className="gap-1.5">
            <Stethoscope className="h-3.5 w-3.5" /> Admission
          </TabsTrigger>
          <TabsTrigger value="pain" className="gap-1.5">
            <HeartPulse className="h-3.5 w-3.5" /> Pain
          </TabsTrigger>
          <TabsTrigger value="fall" className="gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" /> Fall risk
          </TabsTrigger>
          <TabsTrigger value="io" className="gap-1.5">
            <Droplets className="h-3.5 w-3.5" /> I/O
          </TabsTrigger>
          <TabsTrigger value="wound" className="gap-1.5">
            <Bandage className="h-3.5 w-3.5" /> Wound
          </TabsTrigger>
          <TabsTrigger value="note" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" /> Note
          </TabsTrigger>
        </TabsList>

        {/* Admission Assessment */}
        <TabsContent value="admission" className="mt-3">
          <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
            <SectionHeader
              title="Admission Assessment"
              subtitle="Initial nursing intake on arrival/admission."
              onNew={() => setOpenAdmission(true)}
              count={admissions.data?.meta?.total}
            />
            {admissions.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary mx-auto my-4" />
            ) : (admissions.data?.data ?? []).length === 0 ? (
              <EmptyRow label="No admission assessments yet." />
            ) : (
              <div className="space-y-2">
                {(admissions.data?.data ?? []).map((row) => (
                  <div key={row.id} className="rounded-md border bg-surface-container-low p-3 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">{formatDateTimeAmPm(row.assessedAt)}</span>
                      <span className="text-muted-foreground">{nurseName(row.nurse)}</span>
                    </div>
                    {row.chiefComplaint && (
                      <p>
                        <span className="text-muted-foreground">Chief complaint:</span>{' '}
                        {row.chiefComplaint}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                      {row.arrivalMode && (
                        <span>
                          <span className="text-muted-foreground">Arrival:</span> {row.arrivalMode}
                        </span>
                      )}
                      {row.consciousnessLevel && (
                        <span>
                          <span className="text-muted-foreground">LOC:</span> {row.consciousnessLevel}
                        </span>
                      )}
                      {row.mobility && (
                        <span>
                          <span className="text-muted-foreground">Mobility:</span> {row.mobility}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Pain */}
        <TabsContent value="pain" className="mt-3">
          <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
            <SectionHeader
              title="Pain Assessment"
              subtitle="0–10 score, location, and intervention."
              onNew={() => setOpenPain(true)}
              count={pains.data?.meta?.total}
            />
            {pains.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary mx-auto my-4" />
            ) : (pains.data?.data ?? []).length === 0 ? (
              <EmptyRow label="No pain assessments yet." />
            ) : (
              <div className="space-y-2">
                {(pains.data?.data ?? []).map((row) => {
                  const sev = row.painScore >= 7 ? 'bg-red-100 text-red-700'
                    : row.painScore >= 4 ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700';
                  return (
                    <div key={row.id} className="rounded-md border bg-surface-container-low p-3 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={cn('font-bold rounded-full px-2 py-0.5', sev)}>
                            {row.painScore}/10
                          </span>
                          <span className="font-semibold">{formatDateTimeAmPm(row.assessedAt)}</span>
                        </div>
                        <span className="text-muted-foreground">{nurseName(row.nurse)}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                        <span><span className="text-muted-foreground">Scale:</span> {row.painScale}</span>
                        {row.painLocation && (
                          <span>
                            <span className="text-muted-foreground">Location:</span> {row.painLocation}
                          </span>
                        )}
                        {row.painCharacter && (
                          <span>
                            <span className="text-muted-foreground">Character:</span> {row.painCharacter}
                          </span>
                        )}
                      </div>
                      {row.intervention && (
                        <p className="mt-1">
                          <span className="text-muted-foreground">Intervention:</span> {row.intervention}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Fall risk */}
        <TabsContent value="fall" className="mt-3">
          <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
            <SectionHeader
              title="Fall Risk (Morse)"
              subtitle="Morse Fall Scale screening."
              onNew={() => setOpenFall(true)}
              count={falls.data?.meta?.total}
            />
            {falls.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary mx-auto my-4" />
            ) : (falls.data?.data ?? []).length === 0 ? (
              <EmptyRow label="No fall-risk screenings yet." />
            ) : (
              <div className="space-y-2">
                {(falls.data?.data ?? []).map((row) => (
                  <div key={row.id} className="rounded-md border bg-surface-container-low p-3 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={cn('font-bold rounded-full px-2 py-0.5', FALL_RISK_BG[row.riskLevel])}>
                          {row.riskLevel} ({row.totalScore})
                        </span>
                        <span className="font-semibold">{formatDateTimeAmPm(row.assessedAt)}</span>
                      </div>
                      <span className="text-muted-foreground">{nurseName(row.nurse)}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-0.5 mt-1 text-[11px]">
                      <span>Hist: {row.historyOfFalling}</span>
                      <span>2nd Dx: {row.secondaryDiagnosis}</span>
                      <span>Aid: {row.ambulatoryAid}</span>
                      <span>IV: {row.ivOrSalineLock}</span>
                      <span>Gait: {row.gait}</span>
                      <span>Mental: {row.mentalStatus}</span>
                    </div>
                    {row.intervention && (
                      <p className="mt-1">
                        <span className="text-muted-foreground">Plan:</span> {row.intervention}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* I/O */}
        <TabsContent value="io" className="mt-3">
          <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
            <SectionHeader
              title="Intake / Output"
              subtitle="Fluid balance entries."
              onNew={() => setOpenIO(true)}
              count={ios.data?.meta?.total}
            />
            {ios.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary mx-auto my-4" />
            ) : (ios.data?.data ?? []).length === 0 ? (
              <EmptyRow label="No intake/output records yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left py-1">Time</th>
                      <th className="text-left py-1">Type</th>
                      <th className="text-left py-1">Category</th>
                      <th className="text-right py-1">Volume (ml)</th>
                      <th className="text-left py-1">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(ios.data?.data ?? []).map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="py-1.5">{formatDateTimeAmPm(row.recordDatetime)}</td>
                        <td className="py-1.5">
                          <span
                            className={cn(
                              'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                              row.entryType === 'intake'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-purple-100 text-purple-700',
                            )}
                          >
                            {row.entryType}
                          </span>
                        </td>
                        <td className="py-1.5 capitalize">{row.category.replaceAll('_', ' ')}</td>
                        <td className="py-1.5 text-right font-semibold">{row.volumeMl}</td>
                        <td className="py-1.5 text-muted-foreground">{nurseName(row.nurse)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Wound */}
        <TabsContent value="wound" className="mt-3">
          <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
            <SectionHeader
              title="Wound Care"
              subtitle="Wound assessment & dressing changes."
              onNew={() => setOpenWound(true)}
              count={wounds.data?.meta?.total}
            />
            {wounds.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary mx-auto my-4" />
            ) : (wounds.data?.data ?? []).length === 0 ? (
              <EmptyRow label="No wound care entries yet." />
            ) : (
              <div className="space-y-2">
                {(wounds.data?.data ?? []).map((row) => (
                  <div key={row.id} className="rounded-md border bg-surface-container-low p-3 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">{row.woundLocation}</span>
                      <span className="text-muted-foreground">
                        {formatDateTimeAmPm(row.assessedAt)} · {nurseName(row.nurse)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                      {row.woundType && (
                        <span><span className="text-muted-foreground">Type:</span> {row.woundType}</span>
                      )}
                      {row.woundStage && (
                        <span><span className="text-muted-foreground">Stage:</span> {row.woundStage}</span>
                      )}
                      <span>
                        <span className="text-muted-foreground">Status:</span>{' '}
                        <span className="font-semibold">{row.status}</span>
                      </span>
                    </div>
                    {row.dressingApplied && (
                      <p>
                        <span className="text-muted-foreground">Dressing:</span> {row.dressingApplied}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Notes */}
        <TabsContent value="note" className="mt-3">
          <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
            <SectionHeader
              title="Nursing Daily Note"
              subtitle="Free-text shift observations."
              onNew={() => setOpenNote(true)}
              count={notes.data?.meta?.total}
            />
            {notes.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary mx-auto my-4" />
            ) : (notes.data?.data ?? []).length === 0 ? (
              <EmptyRow label="No nursing notes yet." />
            ) : (
              <div className="space-y-2">
                {(notes.data?.data ?? []).map((row) => (
                  <div key={row.id} className="rounded-md border bg-surface-container-low p-3 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold capitalize">{row.noteType.replaceAll('_', ' ')}</span>
                      <span className="text-muted-foreground">
                        {formatDateTimeAmPm(row.createdAt)} · {nurseName(row.nurse)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap">{row.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AdmissionAssessmentDialog open={openAdmission} onOpenChange={setOpenAdmission} ctx={dialogCtx} />
      <PainAssessmentDialog open={openPain} onOpenChange={setOpenPain} ctx={dialogCtx} />
      <FallRiskDialog open={openFall} onOpenChange={setOpenFall} ctx={dialogCtx} />
      <IntakeOutputDialog open={openIO} onOpenChange={setOpenIO} ctx={dialogCtx} />
      <WoundCareDialog open={openWound} onOpenChange={setOpenWound} ctx={dialogCtx} />
      <NursingNoteDialog open={openNote} onOpenChange={setOpenNote} ctx={dialogCtx} />
    </div>
  );
}
