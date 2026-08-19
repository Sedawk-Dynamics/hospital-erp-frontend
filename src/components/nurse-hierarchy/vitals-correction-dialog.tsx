'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCorrectVital, type CorrectVitalInput, type Vital } from '@/hooks/use-vital-history';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vital: Vital | null;
  // Set to true when the logged-in user is a doctor; hides the "may be silent" hint.
  isDoctor?: boolean;
  onSaved?: (mode: 'self-correct-silent' | 'audited-correction') => void;
}

/**
 * Correction dialog for a Vital row. Always collects a `correctionReason`.
 * Backend decides whether this produces a silent in-place edit (grace window
 * self-correction) or an append-only corrected row — the UI treats both the
 * same way and surfaces the result mode in the success toast.
 */
export function VitalsCorrectionDialog({ open, onOpenChange, vital, isDoctor, onSaved }: Props) {
  const correct = useCorrectVital();
  const [form, setForm] = useState<Partial<CorrectVitalInput>>({});
  const [reason, setReason] = useState('');

  async function handleSubmit() {
    if (!vital) return;
    if (!reason.trim()) {
      toast.error('Correction reason is required');
      return;
    }
    try {
      const result = await correct.mutateAsync({
        id: vital.id,
        correctionReason: reason,
        ...form,
      });
      if (result.mode === 'audited-correction') {
        toast.success('Correction saved as a new audited entry');
      } else {
        toast.success('Entry updated');
      }
      onSaved?.(result.mode);
      onOpenChange(false);
      setForm({});
      setReason('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save correction';
      toast.error(msg);
    }
  }

  if (!vital) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record vital correction</DialogTitle>
          <DialogDescription>
            {isDoctor
              ? 'Doctors cannot edit vitals silently — this correction is always appended to the audit log.'
              : 'Edits outside the 15-minute recorder grace window are appended to the audit log as a new entry linked to the original.'}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          <AlertTriangle className="mr-1 inline h-3.5 w-3.5 align-text-top text-amber-600" />
          Only enter fields you want to change. Leave the rest blank — they will carry the original
          values forward.
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Systolic BP"
            value={form.bloodPressureSystolic}
            onChange={(v) => setForm((f) => ({ ...f, bloodPressureSystolic: v }))}
            placeholder={vital.bloodPressureSystolic?.toString() ?? '—'}
          />
          <Field
            label="Diastolic BP"
            value={form.bloodPressureDiastolic}
            onChange={(v) => setForm((f) => ({ ...f, bloodPressureDiastolic: v }))}
            placeholder={vital.bloodPressureDiastolic?.toString() ?? '—'}
          />
          <Field
            label="Pulse"
            value={form.pulseRate}
            onChange={(v) => setForm((f) => ({ ...f, pulseRate: v }))}
            placeholder={vital.pulseRate?.toString() ?? '—'}
          />
          <Field
            label="Temperature (°C)"
            step="0.1"
            value={form.temperature}
            onChange={(v) => setForm((f) => ({ ...f, temperature: v }))}
            placeholder={vital.temperature?.toString() ?? '—'}
          />
          <Field
            label="Respiratory rate"
            value={form.respiratoryRate}
            onChange={(v) => setForm((f) => ({ ...f, respiratoryRate: v }))}
            placeholder={vital.respiratoryRate?.toString() ?? '—'}
          />
          <Field
            label="SpO2 (%)"
            step="0.1"
            value={form.oxygenSaturation}
            onChange={(v) => setForm((f) => ({ ...f, oxygenSaturation: v }))}
            placeholder={vital.oxygenSaturation?.toString() ?? '—'}
          />
          <Field
            label="Weight (kg)"
            step="0.1"
            value={form.weightKg}
            onChange={(v) => setForm((f) => ({ ...f, weightKg: v }))}
            placeholder={vital.weightKg?.toString() ?? '—'}
          />
          <Field
            label="Height (cm)"
            step="0.1"
            value={form.heightCm}
            onChange={(v) => setForm((f) => ({ ...f, heightCm: v }))}
            placeholder={vital.heightCm?.toString() ?? '—'}
          />
          <Field
            label="Blood sugar"
            step="0.1"
            value={form.bloodSugar}
            onChange={(v) => setForm((f) => ({ ...f, bloodSugar: v }))}
            placeholder={vital.bloodSugar?.toString() ?? '—'}
          />
        </div>

        <div>
          <Label className="text-xs font-medium text-muted-foreground">Reason for correction</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. transposed digits, patient re-measured, instrument recalibrated"
            className="mt-1"
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={correct.isPending || !reason.trim()}>
            {correct.isPending ? 'Saving…' : 'Save correction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  step,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  step?: string;
}) {
  return (
    <div>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input
        type="number"
        step={step}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            onChange(undefined);
          } else {
            const n = Number(raw);
            onChange(Number.isFinite(n) ? n : undefined);
          }
        }}
      />
    </div>
  );
}
