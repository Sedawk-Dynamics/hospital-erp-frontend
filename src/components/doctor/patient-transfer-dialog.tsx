'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeftRight, Loader2 } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/stores/auth-store';
import { useCreateDoctorTransfer, useDoctorProfile } from '@/hooks/use-doctor';
import { useDoctorsList } from '@/hooks/use-hospital';
import {
  PatientVisitPicker,
  type SelectedPatient,
} from './patient-visit-picker';

interface PatientTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional preselected patient (when launched from a patient view). */
  initialPatient?: SelectedPatient | null;
  initialVisitId?: string;
}

export function PatientTransferDialog({
  open,
  onOpenChange,
  initialPatient = null,
  initialVisitId = '',
}: PatientTransferDialogProps) {
  const { user } = useAuthStore();
  const { data: myDoctor } = useDoctorProfile();
  const { data: doctors } = useDoctorsList();

  const [selectedPatient, setSelectedPatient] = useState<SelectedPatient | null>(initialPatient);
  const [visitId, setVisitId] = useState(initialVisitId);
  const [toDoctorId, setToDoctorId] = useState('');
  const [reason, setReason] = useState('');

  const createTransfer = useCreateDoctorTransfer();

  const reset = useCallback(() => {
    setSelectedPatient(initialPatient);
    setVisitId(initialVisitId);
    setToDoctorId('');
    setReason('');
  }, [initialPatient, initialVisitId]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const handleSubmit = async () => {
    if (!selectedPatient || !visitId) {
      toast.error('Select a patient and active visit');
      return;
    }
    const fromDoctorId = myDoctor?.id;
    if (!fromDoctorId) {
      toast.error('Unable to resolve your doctor profile');
      return;
    }
    if (!toDoctorId) {
      toast.error('Select the receiving doctor');
      return;
    }
    if (toDoctorId === fromDoctorId) {
      toast.error('Cannot transfer to yourself');
      return;
    }
    try {
      await createTransfer.mutateAsync({
        patientId: selectedPatient.id,
        visitId,
        fromDoctorId,
        toDoctorId,
        reason: reason.trim() || undefined,
      });
      toast.success('Transfer request raised');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create transfer');
    }
  };

  const otherDoctors = (doctors ?? []).filter((d) => d.id !== myDoctor?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            Transfer Patient to Another Doctor
          </DialogTitle>
          <DialogDescription>
            Hand off this patient&apos;s ongoing visit to a colleague. They will see the patient in their
            list once accepted.
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
              Transfer To
            </Label>
            <Select value={toDoctorId} onValueChange={(v) => setToDoctorId(v ?? '')}>
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="Select a doctor" />
              </SelectTrigger>
              <SelectContent>
                {otherDoctors.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground text-center">
                    No other doctors available
                  </div>
                ) : (
                  otherDoctors.map((d) => {
                    const name =
                      d.user
                        ? `Dr. ${d.user.firstName ?? ''} ${d.user.lastName ?? ''}`.trim()
                        : d.id;
                    const spec = d.specialization ? ` — ${d.specialization}` : '';
                    return (
                      <SelectItem key={d.id} value={d.id}>
                        {name}
                        {spec}
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Requesting as{' '}
              {user ? `Dr. ${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : 'you'}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Reason
            </Label>
            <Textarea
              placeholder="Clinical reason for the transfer..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
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
            disabled={
              createTransfer.isPending || !selectedPatient || !visitId || !toDoctorId
            }
          >
            {createTransfer.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowLeftRight className="h-3.5 w-3.5" />
            )}
            Request Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
