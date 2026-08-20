'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { NotebookPen, Loader2, Stethoscope, Pill, Link2, Activity } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { apiGet, apiPost } from '@/lib/api';
import { MedicineTable } from '@/components/doctor/prescription-pad/medicine-table';
import { buildPrescriptionItems } from '@/lib/prescription-items';
import type { MedicineFormData } from '@/components/doctor/consultation-completion/consultation-completion-schema';
import { useCreateProgressNote, type SoapSectionPayload,
  type GeneralCondition,
} from '@/hooks/use-doctor';
import { useRecordDoctorVisit } from '@/hooks/use-ip-ledger';
import { DoctorMentionPicker } from '@/components/doctor/doctor-mention-picker';
import { useAuthStore } from '@/stores/auth-store';
import { AtSign } from 'lucide-react';

// IP progress note = a doctor's daily round / visit note that accumulates into
// the admission's running clinical log. It is DELIBERATELY different from an OP
// consultation note: it is round-focused (progress since last review), it never
// auto-archives (the admission log must persist), and it can optionally post the
// visit fee at the same time — "adding a visit" and "writing the note" are one act.

const CONDITIONS = [
  { value: 'improving', label: 'Improving', tone: 'bg-emerald-100 text-emerald-700' },
  { value: 'stable', label: 'Stable', tone: 'bg-sky-100 text-sky-700' },
  { value: 'unchanged', label: 'Unchanged', tone: 'bg-slate-100 text-slate-700' },
  { value: 'deteriorating', label: 'Deteriorating', tone: 'bg-amber-100 text-amber-700' },
  { value: 'critical', label: 'Critical', tone: 'bg-red-100 text-red-700' },
] as const;

const free = (t: string): SoapSectionPayload | null => (t.trim() ? { free: t.trim() } : null);

export function IpProgressNoteComposer({
  open,
  onOpenChange,
  patientId,
  admissionId,
  onCreated,
  defaultBillVisit = false,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  patientId: string;
  admissionId: string;
  onCreated?: () => void;
  defaultBillVisit?: boolean;
}) {
  const createNote = useCreateProgressNote();
  const recordVisit = useRecordDoctorVisit(admissionId);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [mentions, setMentions] = useState<string[]>([]);
  const [condition, setCondition] = useState<GeneralCondition>('stable');
  const [subjective, setSubjective] = useState('');
  const [objective, setObjective] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');
  const [billVisit, setBillVisit] = useState(defaultBillVisit);
  // Write a prescription as part of this round, rather than hunting for one the
  // doctor already wrote elsewhere. It is saved first and the note is linked to
  // it, so the medicines and the reasoning behind them stay together.
  const [writeRx, setWriteRx] = useState(false);
  const [medicines, setMedicines] = useState<MedicineFormData[]>([]);
  const [rxNotes, setRxNotes] = useState('');
  const qc = useQueryClient();

  // Bind the note to the patient's active IP visit (the ProgressNote row needs a
  // visitId; admissionId flags it as an IP running-log note).
  const { data: visits } = useQuery({
    queryKey: ['ip-note-visit', patientId],
    queryFn: async () =>
      (await apiGet<Array<{ id: string; visitType: string }>>('/clinical/visits', {
        params: { patientId, status: 'active', limit: 5 },
      })).data ?? [],
    enabled: open && !!patientId,
  });
  const visitId = useMemo(
    () => (visits?.find((v) => v.visitType === 'ip') ?? visits?.[0])?.id ?? '',
    [visits],
  );

  const reset = () => {
    setCondition('stable'); setSubjective(''); setObjective('');
    setAssessment(''); setPlan(''); setBillVisit(defaultBillVisit);
    setWriteRx(false); setMedicines([]); setRxNotes('');
    setMentions([]);
  };

  const anyFilled = [subjective, objective, assessment, plan].some((s) => s.trim());

  // A ward round where nothing changed is a real round: the doctor sees the
  // patient, writes the drugs, and records how they are. Requiring prose for
  // that produced either invented text or no note at all.
  //
  // A condition alone is deliberately NOT enough — it defaults to Stable, so
  // accepting it on its own would let an empty note be saved by pressing the
  // button. There has to be a prescription behind it, or something written.
  const hasPrescription = writeRx && medicines.length > 0;
  const canSubmit = anyFilled || hasPrescription;

  const buildContent = () => {
    const condLabel = CONDITIONS.find((c) => c.value === condition)?.label ?? condition;
    const parts = [`[Progress: ${condLabel}]`];
    if (subjective.trim()) parts.push(`S (Subjective): ${subjective.trim()}`);
    if (objective.trim()) parts.push(`O (Objective): ${objective.trim()}`);
    if (assessment.trim()) parts.push(`A (Assessment): ${assessment.trim()}`);
    if (plan.trim()) parts.push(`P (Plan): ${plan.trim()}`);
    return parts.join('\n');
  };

  const submit = async () => {
    if (!canSubmit)
      return toast.error('Add a prescription, or write at least one section of the round note.');
    if (!visitId) return toast.error('No active IP visit found for this patient.');

    const rxItems = writeRx ? buildPrescriptionItems(medicines) : [];
    if (writeRx && rxItems.length === 0) {
      return toast.error('Add at least one medicine, or turn the prescription off.');
    }

    // The prescription is written FIRST, because the note carries its id. If it
    // fails nothing is saved and the dialog stays exactly as it is \u2014 the doctor
    // keeps everything they typed and can retry or turn the prescription off.
    let newPrescriptionId: string | undefined;
    if (rxItems.length > 0) {
      try {
        const res = await apiPost<{ id: string }>('/prescriptions', {
          patientId,
          doctorId: currentUserId,
          visitId,
          prescriptionType: 'ip',
          notes: rxNotes || undefined,
          items: rxItems,
        });
        newPrescriptionId = res.data?.id;
        qc.invalidateQueries({
          predicate: (q) =>
            q.queryKey.some((k) => k === 'prescriptions' || k === 'indents' || k === 'emar'),
        });
      } catch (e) {
        toast.error(
          getApiErrorMessage(e, 'Could not write the prescription \u2014 the note has not been saved.'),
        );
        return;
      }
    }

    try {
      await createNote.mutateAsync({
        patientId,
        visitId,
        admissionId,
        prescriptionId: newPrescriptionId,
        noteType: 'general',
        content: buildContent(),
        // Also sent structured, not just baked into the content line, so the
        // timeline and discharge summary can read a trend rather than parse prose.
        generalCondition: condition,
        subjective: free(subjective),
        objective: free(objective),
        assessment: free(assessment),
        plan: free(plan),
        mentionedUserIds: mentions.length ? mentions : undefined,
      });
      if (mentions.length) {
        toast.success(`${mentions.length} doctor${mentions.length === 1 ? '' : 's'} notified.`);
      }
      // "Adding a visit" optionally also posts the doctor's visit fee to the IP bill.
      if (billVisit) {
        try {
          const res = await recordVisit.mutateAsync({ review: assessment.trim() || plan.trim() || undefined });
          const fee = Number((res as { fee?: number })?.fee ?? 0);
          toast.success(fee > 0 ? `Visit note saved · visit billed ₹${fee.toFixed(2)}` : 'Visit note saved · visit logged (no fee configured)');
        } catch {
          toast.success('Visit note saved (could not post the visit fee — post it from the ledger).');
        }
      } else {
        toast.success(
          newPrescriptionId
            ? `Visit note saved with ${rxItems.length} medicine${rxItems.length === 1 ? '' : 's'} prescribed.`
            : 'IP progress note saved to the admission log.',
        );
      }
      reset();
      onOpenChange(false);
      onCreated?.();
    } catch (e) {
      toast.error((e as Error)?.message || 'Could not save the progress note.');
    }
  };

  const busy = createNote.isPending || recordVisit.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) { onOpenChange(o); if (!o) reset(); } }}>
      {/* Wide + tall: the note now carries a full medicine table alongside the
          SOAP grid, and both need room. Header and footer stay fixed; only the
          body scrolls, so Save is always reachable. */}
      <DialogContent className="flex h-[94vh] w-[96vw] max-w-[88rem] flex-col gap-0 overflow-hidden p-0 sm:max-w-[88rem]">
        <DialogHeader className="shrink-0 border-b bg-muted/30 px-5 py-4 pr-14">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <NotebookPen className="h-5 w-5 text-primary" />
            </span>
            New IP Progress Note
            <Badge variant="outline" className="ml-1 text-[10px] font-normal">Visit / Round</Badge>
          </DialogTitle>
          <DialogDescription>
            Documents this round in the patient&apos;s running admission log — round-focused and kept
            on the record for the whole stay.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* Condition / progress */}
          <div>
            <Label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Activity className="h-3.5 w-3.5" /> Condition since last review
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {CONDITIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCondition(c.value)}
                  className={cn(
                    'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                    condition === c.value ? c.tone + ' border-transparent shadow-sm' : 'border-border text-muted-foreground hover:bg-muted/50',
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* SOAP — two columns on wider screens to use the space. */}
          <div>
            <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Round note (SOAP)</Label>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SoapField label="Subjective" hint="Overnight events, complaints, how the patient feels" value={subjective} onChange={setSubjective} />
              <SoapField label="Objective" hint="Examination findings, today's vitals, device/line checks" value={objective} onChange={setObjective} />
              <SoapField label="Assessment" hint="Clinical impression / progress" value={assessment} onChange={setAssessment} />
              <SoapField label="Plan" hint="Today's plan, order changes, next steps" value={plan} onChange={setPlan} />
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {/* Tag / @mention other doctors — they get a notification and can
                open this patient + note. */}
            <div>
              <Label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <AtSign className="h-3.5 w-3.5" /> Tag doctors <span className="font-normal normal-case">· optional</span>
              </Label>
              <DoctorMentionPicker value={mentions} onChange={setMentions} excludeUserId={currentUserId} />
            </div>

            {/* Bill this visit */}
            <label className="flex cursor-pointer flex-col justify-center gap-1.5 rounded-xl border bg-muted/30 p-3.5 transition-colors hover:bg-muted/50">
              <span className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={billVisit} onChange={(e) => setBillVisit(e.target.checked)} className="h-4 w-4 accent-primary" />
                <Stethoscope className="h-4 w-4 text-primary" /> Bill this visit (post consultation fee)
              </span>
              <span className="pl-6 text-[11px] text-muted-foreground">Flows into the discharge summary&apos;s hospital course automatically — no need to pin.</span>
            </label>
          </div>

          {/* Write a prescription as part of this round. This used to be a picker
              over prescriptions written elsewhere, which meant leaving the note
              to write one and coming back to link it. */}
          <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-3.5">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={writeRx}
                onChange={(e) => setWriteRx(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                <Pill className="h-4 w-4 text-primary" />
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-semibold text-foreground">
                  Prescribe with this note{' '}
                  <span className="font-normal text-muted-foreground">· optional</span>
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  Written as an IP prescription and linked to this note, so the medicines and the
                  reasoning behind them stay together.
                </span>
              </span>
            </label>

            {writeRx && (
              <div className="mt-3 space-y-3">
                <MedicineTable medicines={medicines} onChange={setMedicines} patientId={patientId} />
                <div>
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Prescription notes
                  </Label>
                  <Textarea
                    value={rxNotes}
                    onChange={(e) => setRxNotes(e.target.value)}
                    rows={2}
                    placeholder="Notes for the pharmacy / nursing…"
                    className="mt-1"
                  />
                </div>
                <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <Link2 className="mt-px h-3 w-3 shrink-0 text-primary" />
                  Goes to the pharmacy queue and the eMAR chart, exactly as a prescription written
                  from the IP page does.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 gap-2 border-t px-5 py-3">
          <Badge variant="outline" className="mr-auto self-center text-[10px]">Running IP log</Badge>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={busy || !canSubmit} className="gap-1.5">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <NotebookPen className="h-3.5 w-3.5" />}
            {busy ? 'Saving…' : 'Save Visit Note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SoapField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="rounded-lg border bg-surface-container-lowest p-2.5">
      <Label className="mb-1 block text-xs">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="ml-1.5 font-normal text-muted-foreground">— {hint}</span>
      </Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={6} className="resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0" placeholder={`${label}…`} />
    </div>
  );
}
