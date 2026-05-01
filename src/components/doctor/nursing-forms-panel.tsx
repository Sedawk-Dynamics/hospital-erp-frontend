'use client';

// Read-only "Nursing Forms" panel for the doctor's consultation page.
// Only renders tiles for forms that have actually been recorded. Each tile
// opens a dialog with the complete recorded form details.

import { useState } from 'react';
import { ClipboardList, Eye } from 'lucide-react';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  usePatientFormsSummary,
  type AdmissionAssessment,
  type PainAssessment,
  type FallRiskAssessment,
  type IntakeOutputRecord,
  type WoundCareRecord,
  type NursingNoteRecord,
  type PatientFormsSummary,
} from '@/hooks/use-nursing-forms';

function nurseName(n?: { firstName: string; lastName: string | null } | null) {
  if (!n) return '—';
  return `${n.firstName} ${n.lastName ?? ''}`.trim();
}

type Emphasis = 'high' | 'amber' | 'low' | 'neutral';
type FormKind = 'admission' | 'pain' | 'fall' | 'io' | 'wound' | 'note';

function Tile({
  label,
  primary,
  secondary,
  meta,
  emphasis,
  onClick,
}: {
  label: string;
  primary: string;
  secondary?: string | null;
  meta?: string | null;
  emphasis?: Emphasis;
  onClick: () => void;
}) {
  const emphasisCls =
    emphasis === 'high'
      ? 'border-red-200 bg-red-50/50 hover:bg-red-50'
      : emphasis === 'amber'
        ? 'border-amber-200 bg-amber-50/50 hover:bg-amber-50'
        : emphasis === 'low'
          ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50'
          : 'border-input bg-surface-container-low hover:bg-surface-container';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group rounded-md border px-3 py-2 text-left transition-colors',
        emphasisCls,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          {label}
        </p>
        <Eye className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <p className="text-sm font-semibold mt-0.5 truncate">{primary}</p>
      {secondary && (
        <p className="text-[11px] text-muted-foreground truncate">{secondary}</p>
      )}
      {meta && (
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{meta}</p>
      )}
    </button>
  );
}

interface RecordedTile {
  key: FormKind;
  label: string;
  primary: string;
  secondary?: string | null;
  meta?: string | null;
  emphasis?: Emphasis;
}

export function NursingFormsPanel({ patientId }: { patientId: string }) {
  const { data, isLoading } = usePatientFormsSummary(patientId);
  const summary = data?.data;
  const [openKind, setOpenKind] = useState<FormKind | null>(null);

  const tiles: RecordedTile[] = [];

  if (summary) {
    if (summary.admissionAssessment.latest) {
      const a = summary.admissionAssessment.latest;
      tiles.push({
        key: 'admission',
        label: 'Admission Assessment',
        primary: a.chiefComplaint ?? 'Recorded',
        secondary: `${a.arrivalMode ?? '—'} · LOC ${a.consciousnessLevel ?? '—'}`,
        meta: `${formatDateTimeAmPm(a.assessedAt)} · ${nurseName(a.nurse)}`,
      });
    }

    const painLatest = summary.pain.recent[0];
    if (painLatest) {
      const score = painLatest.painScore;
      const emphasis: Emphasis | undefined =
        score == null ? undefined : score >= 7 ? 'high' : score >= 4 ? 'amber' : 'low';
      tiles.push({
        key: 'pain',
        label: 'Pain',
        primary: `${painLatest.painScore}/10 (${painLatest.painScale})`,
        secondary: painLatest.painLocation ?? null,
        meta: `${formatDateTimeAmPm(painLatest.assessedAt)} · ${nurseName(painLatest.nurse)}`,
        emphasis,
      });
    }

    const fall = summary.fallRisk.latest;
    if (fall) {
      const emphasis: Emphasis | undefined =
        fall.riskLevel === 'high'
          ? 'high'
          : fall.riskLevel === 'moderate'
            ? 'amber'
            : fall.riskLevel === 'low'
              ? 'low'
              : undefined;
      tiles.push({
        key: 'fall',
        label: 'Fall risk (Morse)',
        primary: `${fall.riskLevel.toUpperCase()} · ${fall.totalScore}`,
        secondary: fall.intervention ?? null,
        meta: `${formatDateTimeAmPm(fall.assessedAt)} · ${nurseName(fall.nurse)}`,
        emphasis,
      });
    }

    const ioSlice = summary.intakeOutput.recent;
    if (ioSlice.length > 0) {
      const intake = ioSlice
        .filter((r) => r.entryType === 'intake')
        .reduce((s, r) => s + (r.volumeMl ?? 0), 0);
      const output = ioSlice
        .filter((r) => r.entryType === 'output')
        .reduce((s, r) => s + (r.volumeMl ?? 0), 0);
      const balance = intake - output;
      tiles.push({
        key: 'io',
        label: 'Intake / Output (recent)',
        primary: `In ${intake} · Out ${output} ml`,
        secondary: `Balance ${balance >= 0 ? '+' : ''}${balance} ml`,
        meta: `Last: ${formatDateTimeAmPm(ioSlice[0].recordDatetime)}`,
      });
    }

    const wound = summary.woundCare.recent[0];
    if (wound) {
      tiles.push({
        key: 'wound',
        label: 'Wound Care',
        primary: wound.woundLocation,
        secondary: `${wound.woundType ?? '—'} · stage ${wound.woundStage ?? '—'} · ${wound.status}`,
        meta: `${formatDateTimeAmPm(wound.assessedAt)} · ${nurseName(wound.nurse)}`,
        emphasis: wound.status === 'worsening' ? 'high' : undefined,
      });
    }

    const note = summary.nursingNote.latest;
    if (note) {
      tiles.push({
        key: 'note',
        label: 'Latest Nursing Note',
        primary: note.content.slice(0, 80) + (note.content.length > 80 ? '…' : ''),
        secondary: note.noteType.replaceAll('_', ' '),
        meta: `${formatDateTimeAmPm(note.createdAt)} · ${nurseName(note.nurse)}`,
      });
    }
  }

  const totalsRow = summary
    ? [
        { label: 'Admissions', value: summary.admissionAssessment.total },
        { label: 'Pain', value: summary.pain.total },
        { label: 'Fall', value: summary.fallRisk.total },
        { label: 'I/O', value: summary.intakeOutput.total },
        { label: 'Wound', value: summary.woundCare.total },
        { label: 'Notes', value: summary.nursingNote.total },
      ].filter((t) => t.value > 0)
    : [];

  return (
    <section className="rounded-xl bg-surface-container-lowest shadow-sanctuary border-l-4 border-secondary p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-secondary" />
          <h2 className="font-headline text-sm font-bold">Nursing Forms</h2>
          {tiles.length > 0 && (
            <span className="rounded-full bg-secondary/10 text-secondary px-1.5 py-0.5 text-[10px] font-bold">
              {tiles.length}
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">
          Click any card · read-only · captured by nursing
        </span>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : !summary ? (
        <p className="text-xs text-muted-foreground">No data.</p>
      ) : tiles.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No nursing forms recorded yet for this patient.
        </p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {tiles.map((t) => (
            <Tile
              key={t.key}
              label={t.label}
              primary={t.primary}
              secondary={t.secondary}
              meta={t.meta}
              emphasis={t.emphasis}
              onClick={() => setOpenKind(t.key)}
            />
          ))}
        </div>
      )}

      {totalsRow.length > 0 && (
        <div className="mt-3 pt-3 border-t flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          {totalsRow.map((t) => (
            <span key={t.label}>
              {t.label}: {t.value}
            </span>
          ))}
        </div>
      )}

      <NursingFormDetailsDialog
        kind={openKind}
        summary={summary ?? null}
        onClose={() => setOpenKind(null)}
      />
    </section>
  );
}

// ────────────────────────────────────────────────────────────
// Detail dialog — shows full recorded form fields
// ────────────────────────────────────────────────────────────

const KIND_TITLES: Record<FormKind, { title: string; subtitle: string }> = {
  admission: {
    title: 'Admission Assessment',
    subtitle: 'Latest assessment captured at admission',
  },
  pain: { title: 'Pain Assessments', subtitle: 'Recent recorded entries' },
  fall: { title: 'Fall Risk (Morse) Assessment', subtitle: 'Latest screening' },
  io: { title: 'Intake / Output', subtitle: 'Recent recorded entries' },
  wound: { title: 'Wound Care', subtitle: 'Recent assessments' },
  note: { title: 'Latest Nursing Note', subtitle: 'Most recent note' },
};

function NursingFormDetailsDialog({
  kind,
  summary,
  onClose,
}: {
  kind: FormKind | null;
  summary: PatientFormsSummary | null;
  onClose: () => void;
}) {
  const open = kind !== null;
  const meta = kind ? KIND_TITLES[kind] : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl w-[calc(100%-2rem)] p-0 gap-0 overflow-hidden max-h-[85vh] flex flex-col sm:max-w-3xl">
        {meta && (
          <div className="px-6 py-4 bg-surface-container-lowest border-b border-outline-variant/30 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary/10 text-secondary">
                <ClipboardList className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="font-headline text-base font-bold">
                  {meta.title}
                </DialogTitle>
                <DialogDescription className="text-[11px] text-on-surface-variant mt-0.5">
                  {meta.subtitle}
                </DialogDescription>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 bg-background">
          {kind === 'admission' && summary?.admissionAssessment.latest && (
            <AdmissionDetail data={summary.admissionAssessment.latest} />
          )}
          {kind === 'pain' && summary && (
            <PainDetail entries={summary.pain.recent} total={summary.pain.total} />
          )}
          {kind === 'fall' && summary?.fallRisk.latest && (
            <FallRiskDetail data={summary.fallRisk.latest} total={summary.fallRisk.total} />
          )}
          {kind === 'io' && summary && (
            <IODetail
              entries={summary.intakeOutput.recent}
              total={summary.intakeOutput.total}
            />
          )}
          {kind === 'wound' && summary && (
            <WoundDetail entries={summary.woundCare.recent} total={summary.woundCare.total} />
          )}
          {kind === 'note' && summary?.nursingNote.latest && (
            <NoteDetail data={summary.nursingNote.latest} total={summary.nursingNote.total} />
          )}
        </div>

        <div className="border-t border-outline-variant/30 bg-surface-container-low px-6 py-3 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-on-surface-variant">
            Read-only. Recorded by the nursing team.
          </p>
          <Button size="sm" variant="outline" onClick={onClose} className="h-8 text-xs">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Detail field helpers ─────────────────────────────────────

function Field({
  label,
  value,
  fullWidth,
}: {
  label: string;
  value: React.ReactNode;
  fullWidth?: boolean;
}) {
  const empty = value === null || value === undefined || value === '' || value === '—';
  return (
    <div className={cn('rounded-md bg-surface-container-low px-3 py-2', fullWidth && 'sm:col-span-2')}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
        {label}
      </p>
      <p
        className={cn(
          'text-sm mt-0.5 break-words',
          empty ? 'text-muted-foreground italic' : 'font-medium',
        )}
      >
        {empty ? '—' : value}
      </p>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mt-4 mb-2 first:mt-0">
      {children}
    </h3>
  );
}

function MetaRow({
  assessedAt,
  nurse,
}: {
  assessedAt?: string | null;
  nurse?: { firstName: string; lastName: string | null } | null;
}) {
  return (
    <p className="text-[11px] text-muted-foreground mt-3">
      {assessedAt ? formatDateTimeAmPm(assessedAt) : '—'} · {nurseName(nurse)}
    </p>
  );
}

// ── Admission Assessment ─────────────────────────────────────

function AdmissionDetail({ data }: { data: AdmissionAssessment }) {
  const nok = data.nextOfKin;
  return (
    <div>
      <SectionHeading>Arrival</SectionHeading>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label="Arrival mode" value={data.arrivalMode ?? '—'} />
        <Field label="Consciousness (LOC)" value={data.consciousnessLevel ?? '—'} />
        <Field label="Chief complaint" value={data.chiefComplaint} fullWidth />
      </div>

      <SectionHeading>Clinical baseline</SectionHeading>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label="Allergies" value={data.allergies} fullWidth />
        <Field label="Current medications" value={data.currentMedications} fullWidth />
        <Field label="Skin condition" value={data.skinCondition} />
        <Field label="Mobility" value={data.mobility} />
        <Field label="Nutrition status" value={data.nutritionStatus} />
        <Field label="Elimination" value={data.elimination} />
      </div>

      <SectionHeading>Personal & social</SectionHeading>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label="Preferred language" value={data.preferredLanguage} />
        <Field label="Religious needs" value={data.religiousNeeds} />
        <Field label="Next of kin — name" value={nok?.name ?? null} />
        <Field label="Relationship" value={nok?.relationship ?? null} />
        <Field label="Phone" value={nok?.phone ?? null} />
      </div>

      {data.notes && (
        <>
          <SectionHeading>Notes</SectionHeading>
          <div className="rounded-md bg-surface-container-low px-3 py-2 text-sm whitespace-pre-wrap">
            {data.notes}
          </div>
        </>
      )}

      <MetaRow assessedAt={data.assessedAt} nurse={data.nurse} />
    </div>
  );
}

// ── Pain ─────────────────────────────────────────────────────

function PainDetail({ entries, total }: { entries: PainAssessment[]; total: number }) {
  return (
    <div className="space-y-3">
      {total > entries.length && (
        <p className="text-[11px] text-muted-foreground">
          Showing {entries.length} most recent of {total} entries.
        </p>
      )}
      {entries.map((p) => {
        const score = p.painScore;
        const emphasis =
          score >= 7 ? 'border-red-200 bg-red-50/40' : score >= 4 ? 'border-amber-200 bg-amber-50/40' : 'border-emerald-200 bg-emerald-50/40';
        return (
          <div key={p.id} className={cn('rounded-lg border p-3', emphasis)}>
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <span className="text-base font-bold">
                {p.painScore}/10 <span className="text-xs font-normal text-muted-foreground">({p.painScale})</span>
              </span>
              <span className="text-[11px] text-muted-foreground">
                {formatDateTimeAmPm(p.assessedAt)} · {nurseName(p.nurse)}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Field label="Location" value={p.painLocation} />
              <Field label="Character" value={p.painCharacter} />
              <Field
                label="Onset"
                value={p.painOnsetAt ? formatDateTimeAmPm(p.painOnsetAt) : null}
              />
              <Field
                label="Reassessment due"
                value={p.reassessmentDueAt ? formatDateTimeAmPm(p.reassessmentDueAt) : null}
              />
              <Field label="Aggravating factors" value={p.aggravatingFactors} fullWidth />
              <Field label="Relieving factors" value={p.relievingFactors} fullWidth />
              <Field label="Intervention" value={p.intervention} fullWidth />
              <Field label="Notes" value={p.notes} fullWidth />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Fall risk ────────────────────────────────────────────────

function FallRiskDetail({ data, total }: { data: FallRiskAssessment; total: number }) {
  const items: { label: string; value: number }[] = [
    { label: 'History of falling', value: data.historyOfFalling },
    { label: 'Secondary diagnosis', value: data.secondaryDiagnosis },
    { label: 'Ambulatory aid', value: data.ambulatoryAid },
    { label: 'IV / saline lock', value: data.ivOrSalineLock },
    { label: 'Gait', value: data.gait },
    { label: 'Mental status', value: data.mentalStatus },
  ];
  const levelCls =
    data.riskLevel === 'high'
      ? 'bg-red-100 text-red-700'
      : data.riskLevel === 'moderate'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-emerald-100 text-emerald-700';
  return (
    <div>
      {total > 1 && (
        <p className="text-[11px] text-muted-foreground mb-2">
          Showing latest of {total} screenings.
        </p>
      )}
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('rounded-md px-3 py-1 text-sm font-bold uppercase', levelCls)}>
          {data.riskLevel}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
            Total score
          </p>
          <p className="text-2xl font-bold leading-none">{data.totalScore}</p>
        </div>
      </div>

      <SectionHeading>Score breakdown</SectionHeading>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {items.map((it) => (
          <Field key={it.label} label={it.label} value={String(it.value)} />
        ))}
      </div>

      <SectionHeading>Plan</SectionHeading>
      <div className="grid grid-cols-1 gap-2">
        <Field label="Intervention" value={data.intervention} />
        <Field label="Notes" value={data.notes} />
      </div>

      <MetaRow assessedAt={data.assessedAt} nurse={data.nurse} />
    </div>
  );
}

// ── I/O ──────────────────────────────────────────────────────

function IODetail({ entries, total }: { entries: IntakeOutputRecord[]; total: number }) {
  const intake = entries.filter((r) => r.entryType === 'intake').reduce((s, r) => s + (r.volumeMl ?? 0), 0);
  const output = entries.filter((r) => r.entryType === 'output').reduce((s, r) => s + (r.volumeMl ?? 0), 0);
  const balance = intake - output;
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Field label="Intake (ml)" value={intake} />
        <Field label="Output (ml)" value={output} />
        <Field
          label="Balance"
          value={
            <span className={cn(balance < 0 ? 'text-error' : 'text-emerald-700')}>
              {balance >= 0 ? '+' : ''}
              {balance}
            </span>
          }
        />
      </div>

      {total > entries.length && (
        <p className="text-[11px] text-muted-foreground mb-2">
          Showing {entries.length} most recent of {total} entries.
        </p>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="bg-surface-container-low text-on-surface-variant">
            <tr>
              <th className="text-left px-2 py-1.5 font-semibold uppercase tracking-wider text-[10px]">
                Time
              </th>
              <th className="text-left px-2 py-1.5 font-semibold uppercase tracking-wider text-[10px]">
                Type
              </th>
              <th className="text-left px-2 py-1.5 font-semibold uppercase tracking-wider text-[10px]">
                Category
              </th>
              <th className="text-right px-2 py-1.5 font-semibold uppercase tracking-wider text-[10px]">
                Volume (ml)
              </th>
              <th className="text-left px-2 py-1.5 font-semibold uppercase tracking-wider text-[10px]">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/30">
            {entries.map((r) => (
              <tr key={r.id} className="even:bg-surface-container-low/40">
                <td className="px-2 py-1.5">{formatDateTimeAmPm(r.recordDatetime)}</td>
                <td className="px-2 py-1.5">
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
                      r.entryType === 'intake'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700',
                    )}
                  >
                    {r.entryType}
                  </span>
                </td>
                <td className="px-2 py-1.5 capitalize">{r.category.replaceAll('_', ' ')}</td>
                <td className="px-2 py-1.5 text-right font-mono">{r.volumeMl ?? '—'}</td>
                <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[200px]">
                  {r.fluidDescription ?? r.notes ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Wound Care ───────────────────────────────────────────────

function WoundDetail({ entries, total }: { entries: WoundCareRecord[]; total: number }) {
  return (
    <div className="space-y-3">
      {total > entries.length && (
        <p className="text-[11px] text-muted-foreground">
          Showing {entries.length} most recent of {total} entries.
        </p>
      )}
      {entries.map((w) => {
        const dims = [w.lengthCm, w.widthCm, w.depthCm].filter((x) => x != null);
        const dimStr = dims.length > 0 ? `${dims.join(' × ')} cm` : null;
        const statusCls =
          w.status === 'worsening'
            ? 'bg-red-100 text-red-700'
            : w.status === 'healed'
              ? 'bg-emerald-100 text-emerald-700'
              : w.status === 'healing'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-amber-100 text-amber-700';
        return (
          <div key={w.id} className="rounded-lg border p-3">
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{w.woundLocation}</span>
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
                    statusCls,
                  )}
                >
                  {w.status}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {formatDateTimeAmPm(w.assessedAt)} · {nurseName(w.nurse)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Field label="Type" value={w.woundType} />
              <Field label="Stage" value={w.woundStage} />
              <Field label="Dimensions" value={dimStr} />
              <Field
                label="Next assessment"
                value={w.nextAssessmentDue ? formatDateTimeAmPm(w.nextAssessmentDue) : null}
              />
              <Field label="Exudate type" value={w.exudateType} />
              <Field label="Exudate amount" value={w.exudateAmount} />
              <Field label="Dressing applied" value={w.dressingApplied} fullWidth />
              <Field label="Treatment notes" value={w.treatmentNotes} fullWidth />
            </div>

            {w.photoUrl && (
              <a
                href={w.photoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
              >
                <Eye className="h-3 w-3" />
                View photo
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Nursing Note ─────────────────────────────────────────────

function NoteDetail({ data, total }: { data: NursingNoteRecord; total: number }) {
  return (
    <div>
      {total > 1 && (
        <p className="text-[11px] text-muted-foreground mb-2">
          Showing latest of {total} notes.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        <Field label="Type" value={data.noteType.replaceAll('_', ' ')} />
        <Field
          label="Recorded"
          value={`${formatDateTimeAmPm(data.createdAt)} · ${nurseName(data.nurse)}`}
        />
      </div>

      <SectionHeading>Note</SectionHeading>
      <div className="rounded-md bg-surface-container-low px-3 py-2 text-sm whitespace-pre-wrap">
        {data.content}
      </div>
    </div>
  );
}
