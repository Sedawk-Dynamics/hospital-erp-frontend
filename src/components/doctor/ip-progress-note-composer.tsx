'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { NotebookPen, Loader2, Stethoscope } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { apiGet } from '@/lib/api';
import { useCreateProgressNote, type SoapSectionPayload } from '@/hooks/use-doctor';
import { useRecordDoctorVisit } from '@/hooks/use-ip-ledger';

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

  const [condition, setCondition] = useState<string>('stable');
  const [subjective, setSubjective] = useState('');
  const [objective, setObjective] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');
  const [billVisit, setBillVisit] = useState(defaultBillVisit);

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
  };

  const anyFilled = [subjective, objective, assessment, plan].some((s) => s.trim());

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
    if (!anyFilled) return toast.error('Write at least one section of the round note.');
    if (!visitId) return toast.error('No active IP visit found for this patient.');
    try {
      await createNote.mutateAsync({
        patientId,
        visitId,
        admissionId,
        noteType: 'general',
        content: buildContent(),
        subjective: free(subjective),
        objective: free(objective),
        assessment: free(assessment),
        plan: free(plan),
      });
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
        toast.success('IP progress note saved to the admission log.');
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
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <NotebookPen className="h-5 w-5 text-primary" /> New IP Progress Note (Visit / Round)
          </DialogTitle>
          <DialogDescription>
            Documents this round in the patient&apos;s running admission log. This IP note is
            round-focused and stays on the record for the whole stay.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Condition / progress */}
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Condition since last review</Label>
            <div className="flex flex-wrap gap-1.5">
              {CONDITIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCondition(c.value)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    condition === c.value ? c.tone + ' border-transparent' : 'border-border text-muted-foreground hover:bg-muted/50',
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <SoapField label="Subjective" hint="Overnight events, complaints, how the patient feels" value={subjective} onChange={setSubjective} />
          <SoapField label="Objective" hint="Examination findings, today's vitals, device/line checks" value={objective} onChange={setObjective} />
          <SoapField label="Assessment" hint="Clinical impression / progress" value={assessment} onChange={setAssessment} />
          <SoapField label="Plan" hint="Today's plan, order changes, next steps" value={plan} onChange={setPlan} />

          <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={billVisit} onChange={(e) => setBillVisit(e.target.checked)} className="h-3.5 w-3.5 accent-primary" />
              <Stethoscope className="h-3.5 w-3.5 text-primary" /> Bill this visit (post consultation fee)
            </label>
            <p className="text-[11px] text-muted-foreground">This note flows into the discharge summary&apos;s hospital course automatically — no need to pin.</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Badge variant="outline" className="mr-auto self-center text-[10px]">Running IP log</Badge>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={busy || !anyFilled} className="gap-1.5">
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
    <div>
      <Label className="mb-1 block text-xs">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="ml-1.5 font-normal text-muted-foreground">— {hint}</span>
      </Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className="resize-none text-sm" placeholder={`${label}…`} />
    </div>
  );
}
