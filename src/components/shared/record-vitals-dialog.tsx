'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Activity } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useRecordVitals } from '@/hooks/use-nurse';

/**
 * Vital-sign entry, shared by the nursing module and the doctor's consultation
 * / IP workspace. Nursing runs the routine rounds, but a doctor examining a
 * patient records their own reading here too — the backend stamps `recordedBy`
 * so authorship is never ambiguous.
 *
 * Exactly one encounter key (visitId / admissionId / appointmentId) should be
 * supplied; the backend resolves it to a Visit.
 */
export interface RecordVitalsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  visitId?: string;
  admissionId?: string;
  appointmentId?: string;
  patientName?: string;
  onRecorded?: () => void;
}

const EMPTY_FORM = {
  bloodPressureSystolic: '',
  bloodPressureDiastolic: '',
  temperature: '',
  pulseRate: '',
  respiratoryRate: '',
  oxygenSaturation: '',
  weightKg: '',
  heightCm: '',
  bloodSugar: '',
  notes: '',
};

type FormState = typeof EMPTY_FORM;

const NUMERIC_FIELDS: { key: keyof FormState; label: string; unit: string; step?: string }[] = [
  { key: 'bloodPressureSystolic', label: 'BP Systolic', unit: 'mmHg' },
  { key: 'bloodPressureDiastolic', label: 'BP Diastolic', unit: 'mmHg' },
  { key: 'pulseRate', label: 'Pulse', unit: 'bpm' },
  { key: 'temperature', label: 'Temperature', unit: '°C', step: '0.1' },
  { key: 'respiratoryRate', label: 'Respiratory Rate', unit: '/min' },
  { key: 'oxygenSaturation', label: 'SpO₂', unit: '%' },
  { key: 'weightKg', label: 'Weight', unit: 'kg', step: '0.1' },
  { key: 'heightCm', label: 'Height', unit: 'cm', step: '0.1' },
  { key: 'bloodSugar', label: 'Blood Sugar', unit: 'mg/dL' },
];

function parseNum(v: string): number | undefined {
  const n = parseFloat(v);
  return isNaN(n) ? undefined : n;
}

export function RecordVitalsDialog({
  open,
  onOpenChange,
  patientId,
  visitId,
  admissionId,
  appointmentId,
  patientName,
  onRecorded,
}: RecordVitalsDialogProps) {
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const recordVitals = useRecordVitals();
  const queryClient = useQueryClient();

  const set = (key: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const hasAnyReading = NUMERIC_FIELDS.some((f) => form[f.key].trim() !== '');

  const handleOpenChange = (next: boolean) => {
    if (!next) setForm({ ...EMPTY_FORM });
    onOpenChange(next);
  };

  const handleSave = async () => {
    if (!patientId) {
      toast.error('Patient context is required to record vitals');
      return;
    }
    if (!visitId && !admissionId && !appointmentId) {
      toast.error('No visit, admission or appointment context for this reading');
      return;
    }
    if (!hasAnyReading) {
      toast.error('Enter at least one reading');
      return;
    }

    try {
      await recordVitals.mutateAsync({
        patientId,
        visitId,
        admissionId,
        appointmentId,
        temperature: parseNum(form.temperature),
        bloodPressureSystolic: parseNum(form.bloodPressureSystolic),
        bloodPressureDiastolic: parseNum(form.bloodPressureDiastolic),
        pulseRate: parseNum(form.pulseRate),
        respiratoryRate: parseNum(form.respiratoryRate),
        oxygenSaturation: parseNum(form.oxygenSaturation),
        weightKg: parseNum(form.weightKg),
        heightCm: parseNum(form.heightCm),
        bloodSugar: parseNum(form.bloodSugar),
        notes: form.notes.trim() || undefined,
      });
      // The doctor-side panels read through their own query namespaces.
      queryClient.invalidateQueries({ queryKey: ['nurse'] });
      queryClient.invalidateQueries({ queryKey: ['doctor'] });
      toast.success('Vitals recorded');
      onRecorded?.();
      handleOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to record vitals');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Record Vitals
          </DialogTitle>
          <DialogDescription>
            {patientName
              ? `New vital-sign reading for ${patientName}. Leave any field blank to skip it.`
              : 'New vital-sign reading. Leave any field blank to skip it.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {NUMERIC_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="font-label text-[11px] text-on-surface-variant">
                {f.label} <span className="text-outline">({f.unit})</span>
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                step={f.step ?? '1'}
                value={form[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                className="h-9"
              />
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <Label className="font-label text-[11px] text-on-surface-variant">Notes</Label>
          <Textarea
            rows={2}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Anything worth noting about this reading..."
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={recordVitals.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!hasAnyReading || recordVitals.isPending}>
            {recordVitals.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              'Save Vitals'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
