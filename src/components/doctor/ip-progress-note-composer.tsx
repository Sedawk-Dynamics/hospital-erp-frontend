'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { NotebookPen, Loader2, Stethoscope, Pill, Link2, Activity, Pin, MapPinned } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
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
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { DISCHARGE_SECTIONS } from '@/components/doctor/discharge-pin-editor';
import { useAuthStore } from '@/stores/auth-store';
import { AtSign } from 'lucide-react';


const CONDITIONS = [
  { value: 'improving', label: 'Improving', tone: 'bg-emerald-100 text-emerald-700' },
  { value: 'stable', label: 'Stable', tone: 'bg-sky-100 text-sky-700' },
  { value: 'unchanged', label: 'Unchanged', tone: 'bg-slate-100 text-slate-700' },
  { value: 'deteriorating', label: 'Deteriorating', tone: 'bg-amber-100 text-amber-700' },
  { value: 'critical', label: 'Critical', tone: 'bg-red-100 text-red-700' },
] as const;

const SOAP_META = {
  subjective: { label: 'Subjective', hint: 'Overnight events, complaints, how the patient feels' },
  objective:  { label: 'Objective', hint: "Examination findings, today's vitals, device/line checks" },
  assessment: { label: 'Assessment', hint: 'Clinical impression / progress' },
  plan:       { label: 'Plan', hint: "Today's plan, order changes, next steps" },
} as const;

// Note-type options — `label` is shown in the UI, `value` is the
// ProgressNoteType enum stored on the note.
const NOTE_TYPES = [
  { label: 'Daily SOAP Round', value: 'daily_soap_round' },
  { label: 'Post-Op Note', value: 'post_op_note' },
  { label: 'Procedure Note', value: 'procedure_note' },
  { label: 'Consultation Note', value: 'consultation_note' },
  { label: 'OP Clinic Visit', value: 'op_clinic_visit' },
] as const;

type NoteTypeValue = (typeof NOTE_TYPES)[number]['value'];

const free = (t: string): SoapSectionPayload | null => (t.trim() ? { free: t.trim() } : null);

interface PartPin {
  content: string;                        // the part's text (or condition label)
  showToPatient: boolean;                 // the checkbox
  section: DischargeSectionOption | null; // pinned section (null = not pinned)
}



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
  const emptyParts = (): Record<PinKey, PartPin> => ({
    condition:  { content: '', showToPatient: false, section: null },
    subjective: { content: '', showToPatient: false, section: null },
    objective:  { content: '', showToPatient: false, section: null },
    assessment: { content: '', showToPatient: false, section: null },
    plan:       { content: '', showToPatient: false, section: null },
  });
  const [parts, setParts] = useState<Record<PinKey, PartPin>>(emptyParts);
  const updatePart = (key: PinKey, patch: Partial<PartPin>) =>setParts((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  const createNote = useCreateProgressNote();
  const recordVisit = useRecordDoctorVisit(admissionId);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [mentions, setMentions] = useState<string[]>([]);
  const [noteType, setNoteType] = useState<NoteTypeValue>('daily_soap_round');
  const [noteTitle, setNoteTitle] = useState('');
  const [condition, setCondition] = useState<GeneralCondition>('stable');
  const [billVisit, setBillVisit] = useState(defaultBillVisit);
  const [writeRx, setWriteRx] = useState(false);
  const [medicines, setMedicines] = useState<MedicineFormData[]>([]);
  const [rxNotes, setRxNotes] = useState('');
  const qc = useQueryClient();

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
    setCondition('stable'); setBillVisit(defaultBillVisit);
    setWriteRx(false); setMedicines([]); setRxNotes('');
    setMentions([]);
    setParts(emptyParts());
  };

  
  const buildContent = () => {
    const conditionLabel = CONDITIONS.find((c) => c.value === condition)?.label ?? condition;
    const lines = [`[Progress: ${conditionLabel}]`];
    const s = parts.subjective.content.trim();
    const o = parts.objective.content.trim();
    const a = parts.assessment.content.trim();
    const p = parts.plan.content.trim();
    if (s) lines.push(`S (Subjective): ${s}`);
    if (o) lines.push(`O (Objective): ${o}`);
    if (a) lines.push(`A (Assessment): ${a}`);
    if (p) lines.push(`P (Plan): ${p}`);
    return lines.join('\n');
  };

  const submit = async () => {
    if (!visitId) return toast.error('No active IP visit found for this patient.');

    const rxItems = writeRx ? buildPrescriptionItems(medicines) : [];
    if (writeRx && rxItems.length === 0) {
      return toast.error('Add at least one medicine, or turn the prescription off.');
    }
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

    const conditionLabel = CONDITIONS.find((c) => c.value === condition)?.label ?? condition;
    const contentFor = (k: PinKey) => (k === 'condition' ? conditionLabel : parts[k].content.trim());

    const pins = (Object.keys(parts) as PinKey[])
      .filter((k) => parts[k].section && contentFor(k))
      .map((k) => ({
        dischargeSection: parts[k].section!.key,
        content: contentFor(k),
        showToPatient: parts[k].showToPatient,
      }));

    try {
      await createNote.mutateAsync({
        patientId,
        visitId,
        admissionId,
        prescriptionId: newPrescriptionId,
        noteType: noteType,
        noteTitle: noteTitle,
        content: buildContent(),
        generalCondition: condition,
        subjective: free(parts.subjective.content),
        objective: free(parts.objective.content),
        assessment: free(parts.assessment.content),
        plan: free(parts.plan.content),
        pins:pins.length?pins:undefined,
        mentionedUserIds: mentions.length ? mentions : undefined,
      });
      if (mentions.length) {
        toast.success(`${mentions.length} doctor${mentions.length === 1 ? '' : 's'} notified.`);
      }
      // "Adding a visit" optionally also posts the doctor's visit fee to the IP bill.
      if (billVisit) {
        try {
          const res = await recordVisit.mutateAsync({ review: parts.assessment.content.trim() || parts.plan.content.trim() || undefined });
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
    <Dialog open={open} onOpenChange={(o) => { if (!busy) { onOpenChange(o); if (!o) reset(); } }}>      <DialogContent className="flex h-[94vh] w-[96vw] max-w-[88rem] flex-col gap-0 overflow-hidden p-0 sm:max-w-[88rem]">
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

        <div className="min-h-0 flex-1  space-y-5 overflow-y-auto px-5 py-4">
          {/* Condition / progress */}
          
          <div>
            <div className="mb-1.5 flex gap-2">
              <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <div className='flex gap-10 items-center justify-center'>
                  <div className='flex gap-2 items-center justify-center'>
                  <Activity className="h-3.5 w-3.5" /> Condition since last review
                  </div>
                <PartActions inline
                  pinned={parts.condition.section}
                  handlepinned={(s) => updatePart('condition', { section: s })}
                  handlepinnedNUll={() => updatePart('condition', { section: null })}
                  showToPatient={parts.condition.showToPatient}
                  onShowToPatient={(v) => updatePart('condition', { showToPatient: v })} />
                </div>
                
              </Label>
              
            </div>
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

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Note type</Label>
              <Select value={noteType} onValueChange={(v) => v && setNoteType(v as NoteTypeValue)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select note type" />
                </SelectTrigger>
                <SelectContent>
                  {NOTE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Note title</Label>
              <Input
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="e.g. Morning round — Day 2"
                maxLength={200}
              />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Round note (SOAP)</Label>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(['subjective', 'objective', 'assessment', 'plan'] as const).map((k) => (
                <SoapField key={k}
                  label={SOAP_META[k].label} hint={SOAP_META[k].hint}
                  value={parts[k].content}
                  onChange={(v) => updatePart(k, { content: v })}
                  pinned={parts[k].section}
                  handlepinned={(s) => updatePart(k, { section: s })}
                  handlepinnedNUll={() => updatePart(k, { section: null })}
                  showToPatient={parts[k].showToPatient}
                  onShowToPatient={(v) => updatePart(k, { showToPatient: v })} />
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
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
          <Button size="sm" onClick={submit} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <NotebookPen className="h-3.5 w-3.5" />}
            {busy ? 'Saving…' : 'Save Visit Note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}













function SoapField({ label, hint, value, onChange, pinned, handlepinned, handlepinnedNUll, showToPatient, onShowToPatient }: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  pinned: DischargeSectionOption | null;
  handlepinned?: (s: DischargeSectionOption) => void;
  handlepinnedNUll?: () => void;
  showToPatient?: boolean;
  onShowToPatient?: (v: boolean) => void;
}) {
  return (
    <div className="flex h-full flex-col rounded-lg border bg-surface-container-lowest p-2.5">
      <Label className="mb-1 block text-xs">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="ml-1.5 font-normal text-muted-foreground">— {hint}</span>
      </Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={6} className="resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0" placeholder={`${label}…`} />
      <PartActions pinned={pinned} handlepinned={handlepinned} handlepinnedNUll={handlepinnedNUll} showToPatient={showToPatient} onShowToPatient={onShowToPatient} />
    </div>
  );
}















type DischargeSectionOption = (typeof DISCHARGE_SECTIONS)[number];
type PinKey = 'condition' | 'subjective' | 'objective' | 'assessment' | 'plan';

function PartActions({ inline = false, pinned, handlepinned, handlepinnedNUll, showToPatient = false, onShowToPatient }: {
  inline?: boolean;
  pinned: DischargeSectionOption | null;
  handlepinned?: (s: DischargeSectionOption) => void;
  handlepinnedNUll?: () => void;
  showToPatient?: boolean;
  onShowToPatient?: (v: boolean) => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3',
        inline ? 'shrink-0 justify-center' : 'mt-auto justify-between border-t pt-2',
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            'flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
            pinned
              ? 'border-primary/30 bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted/50',
          )}
        >
          <Pin className="h-3 w-3" />
          {pinned ? `Pinned · ${pinned.label}` : 'Pin'}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48 h-50 overflow-y-auto">
          <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground">Pin to section</div>
          <DropdownMenuSeparator />
          {DISCHARGE_SECTIONS.map((s) => (
            <DropdownMenuItem
              key={s.key}
              className="text-xs "
              onClick={() => handlepinned?.(s)}
            >
              {s.label}
            </DropdownMenuItem>
          ))}
          {pinned && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                className="text-xs"
                onClick={handlepinnedNUll}
              >
                Unpin
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
        <input type="checkbox" className="h-3.5 w-3.5 accent-primary" checked={showToPatient} onChange={(e) => onShowToPatient?.(e.target.checked)} />
        Show to patient
      </label>
    </div>
  );
}
