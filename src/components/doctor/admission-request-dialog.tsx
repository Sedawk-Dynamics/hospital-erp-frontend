'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { BedDouble, Loader2 } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { useCreateAdmissionRequest, useDoctorProfile } from '@/hooks/use-doctor';

type Urgency = 'routine' | 'urgent' | 'emergency';

const urgencyOptions: { value: Urgency; label: string; activeBg: string; color: string }[] = [
  {
    value: 'routine',
    label: 'Routine',
    activeBg: 'bg-primary text-primary-foreground',
    color: 'text-foreground',
  },
  {
    value: 'urgent',
    label: 'Urgent',
    activeBg: 'bg-secondary text-secondary-foreground',
    color: 'text-secondary',
  },
  {
    value: 'emergency',
    label: 'Emergency',
    activeBg: 'bg-destructive text-destructive-foreground',
    color: 'text-destructive',
  },
];

interface AdmissionRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
  visitId?: string;
}

export function AdmissionRequestDialog({
  open,
  onOpenChange,
  patientId,
  patientName,
  visitId,
}: AdmissionRequestDialogProps) {
  const { data: myDoctor } = useDoctorProfile();
  const [reason, setReason] = useState('');
  const [provisionalDiagnosis, setProvisionalDiagnosis] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('routine');
  const [preferredWardType, setPreferredWardType] = useState('');
  const [expectedAdmissionDate, setExpectedAdmissionDate] = useState('');
  const [notes, setNotes] = useState('');

  const createRequest = useCreateAdmissionRequest();

  const reset = useCallback(() => {
    setReason('');
    setProvisionalDiagnosis('');
    setUrgency('routine');
    setPreferredWardType('');
    setExpectedAdmissionDate('');
    setNotes('');
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const canSubmit = useMemo(
    () => reason.trim().length > 0 && !!myDoctor?.id,
    [reason, myDoctor?.id],
  );

  const handleSubmit = async () => {
    if (!myDoctor?.id) {
      toast.error('Unable to resolve your doctor profile');
      return;
    }
    if (!reason.trim()) {
      toast.error('Reason for admission is required');
      return;
    }
    try {
      await createRequest.mutateAsync({
        patientId,
        visitId,
        doctorId: myDoctor.id,
        reason: reason.trim(),
        provisionalDiagnosis: provisionalDiagnosis.trim() || undefined,
        urgency,
        preferredWardType: preferredWardType.trim() || undefined,
        expectedAdmissionDate: expectedAdmissionDate || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success('IP admission request sent to front desk');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send admission request');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BedDouble className="h-5 w-5 text-primary" />
            Request IP Admission
          </DialogTitle>
          <DialogDescription>
            Send an IP admission request for{' '}
            <span className="font-semibold text-foreground">{patientName}</span> to the front desk.
            They will allocate a ward/bed and confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Reason for Admission *
            </Label>
            <Textarea
              placeholder="e.g., Acute abdominal pain, requires observation and IV antibiotics"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Provisional Diagnosis
            </Label>
            <Textarea
              placeholder="e.g., Acute appendicitis"
              value={provisionalDiagnosis}
              onChange={(e) => setProvisionalDiagnosis(e.target.value)}
              rows={2}
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                Preferred Ward Type
              </Label>
              <Input
                placeholder="e.g., General, ICU, Private"
                value={preferredWardType}
                onChange={(e) => setPreferredWardType(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                Expected Admission Date
              </Label>
              <Input
                type="date"
                value={expectedAdmissionDate}
                onChange={(e) => setExpectedAdmissionDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Notes for Front Desk
            </Label>
            <Textarea
              placeholder="Any specific instructions for ward allocation, billing, attendant arrangements..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="text-sm resize-none"
            />
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
            disabled={createRequest.isPending || !canSubmit}
          >
            {createRequest.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <BedDouble className="h-3.5 w-3.5" />
            )}
            Send Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
