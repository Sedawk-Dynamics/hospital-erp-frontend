'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Stethoscope, Loader2, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCreateClinicalOTRequest, useDoctorProfile } from '@/hooks/use-doctor';
import {
  PatientVisitPicker,
  type SelectedPatient,
} from './patient-visit-picker';

type Urgency = 'elective' | 'urgent' | 'emergency';

const urgencyOptions: { value: Urgency; label: string; activeBg: string; color: string }[] = [
  { value: 'elective', label: 'Elective', activeBg: 'bg-primary text-primary-foreground', color: 'text-foreground' },
  { value: 'urgent', label: 'Urgent', activeBg: 'bg-secondary text-secondary-foreground', color: 'text-secondary' },
  { value: 'emergency', label: 'Emergency', activeBg: 'bg-destructive text-destructive-foreground', color: 'text-destructive' },
];

interface OTRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPatient?: SelectedPatient | null;
  initialVisitId?: string;
}

export function OTRequestDialog({
  open,
  onOpenChange,
  initialPatient = null,
  initialVisitId = '',
}: OTRequestDialogProps) {
  const { data: myDoctor } = useDoctorProfile();
  const [selectedPatient, setSelectedPatient] = useState<SelectedPatient | null>(initialPatient);
  const [visitId, setVisitId] = useState(initialVisitId);
  const [procedureName, setProcedureName] = useState('');
  const [procedureDetails, setProcedureDetails] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('elective');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number | ''>('');
  const [equipmentInput, setEquipmentInput] = useState('');
  const [equipment, setEquipment] = useState<string[]>([]);

  const createOtRequest = useCreateClinicalOTRequest();

  const reset = useCallback(() => {
    setSelectedPatient(initialPatient);
    setVisitId(initialVisitId);
    setProcedureName('');
    setProcedureDetails('');
    setUrgency('elective');
    setPreferredDate('');
    setPreferredTime('');
    setDurationMinutes('');
    setEquipmentInput('');
    setEquipment([]);
  }, [initialPatient, initialVisitId]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const addEquipment = useCallback(() => {
    const value = equipmentInput.trim();
    if (!value) return;
    if (equipment.includes(value)) {
      setEquipmentInput('');
      return;
    }
    setEquipment((prev) => [...prev, value]);
    setEquipmentInput('');
  }, [equipment, equipmentInput]);

  const removeEquipment = useCallback((value: string) => {
    setEquipment((prev) => prev.filter((v) => v !== value));
  }, []);

  const canSubmit = useMemo(
    () => !!selectedPatient && !!visitId && procedureName.trim().length > 0,
    [selectedPatient, visitId, procedureName],
  );

  const handleSubmit = async () => {
    if (!selectedPatient || !visitId) {
      toast.error('Select a patient and active visit');
      return;
    }
    const doctorId = myDoctor?.id;
    if (!doctorId) {
      toast.error('Unable to resolve your doctor profile');
      return;
    }
    if (!procedureName.trim()) {
      toast.error('Procedure name is required');
      return;
    }
    try {
      await createOtRequest.mutateAsync({
        patientId: selectedPatient.id,
        visitId,
        doctorId,
        procedureName: procedureName.trim(),
        procedureDetails: procedureDetails.trim() || undefined,
        urgency,
        preferredDate: preferredDate || undefined,
        preferredTime: preferredTime || undefined,
        durationMinutes: typeof durationMinutes === 'number' ? durationMinutes : undefined,
        requiredEquipment: equipment.length > 0 ? equipment : undefined,
      });
      toast.success('OT request raised');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create OT request');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            New OT Request
          </DialogTitle>
          <DialogDescription>
            Request an Operating Theatre slot with procedure details, urgency, preferred time, and
            equipment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <PatientVisitPicker
            selectedPatient={selectedPatient}
            onSelectPatient={setSelectedPatient}
            selectedVisitId={visitId}
            onSelectVisitId={setVisitId}
            doctorId={myDoctor?.id}
          />

          <div className="space-y-1.5">
            <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Procedure
            </Label>
            <Input
              placeholder="e.g., Laparoscopic cholecystectomy"
              value={procedureName}
              onChange={(e) => setProcedureName(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Procedure Details
            </Label>
            <Textarea
              placeholder="Pre-op diagnosis, anaesthesia type, surgical notes..."
              value={procedureDetails}
              onChange={(e) => setProcedureDetails(e.target.value)}
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Urgency
            </Label>
            <div className="flex gap-2">
              {urgencyOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setUrgency(opt.value)}
                  className={cn(
                    'rounded-lg px-4 py-1.5 text-sm font-medium border transition-all duration-200',
                    urgency === opt.value
                      ? opt.activeBg + ' border-transparent shadow-sm'
                      : 'bg-card border-border hover:border-primary/40 ' + opt.color,
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                Preferred Date
              </Label>
              <Input
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                Preferred Time
              </Label>
              <Input
                type="time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                Duration (min)
              </Label>
              <Input
                type="number"
                min={1}
                max={1440}
                placeholder="e.g., 90"
                value={durationMinutes}
                onChange={(e) => {
                  const v = e.target.value;
                  setDurationMinutes(v === '' ? '' : Math.max(1, Math.min(1440, parseInt(v, 10) || 0)));
                }}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Required Equipment
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., C-arm, Laparoscope"
                value={equipmentInput}
                onChange={(e) => setEquipmentInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addEquipment();
                  }
                }}
                className="h-9 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                onClick={addEquipment}
                disabled={!equipmentInput.trim()}
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
            {equipment.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {equipment.map((item) => (
                  <Badge
                    key={item}
                    variant="secondary"
                    className="flex items-center gap-1 py-1 px-2.5 text-sm"
                  >
                    {item}
                    <button
                      type="button"
                      onClick={() => removeEquipment(item)}
                      className="ml-1 rounded-full hover:bg-destructive/20 p-0.5 transition-colors"
                    >
                      <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleSubmit}
            disabled={createOtRequest.isPending || !canSubmit}
          >
            {createOtRequest.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Stethoscope className="h-3.5 w-3.5" />
            )}
            Raise OT Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
